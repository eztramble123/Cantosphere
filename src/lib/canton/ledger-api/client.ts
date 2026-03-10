import { LedgerApiError } from "../errors";
import type {
  LedgerApiConfig,
  ILedgerApiClient,
  ActiveContract,
  CommandResult,
} from "./types";

const DEFAULT_APPLICATION_ID = "canton-store";

/**
 * HTTP client wrapping Canton JSON Ledger API V2.
 *
 * Endpoints:
 * - POST /v2/commands/submit-and-wait  (create contracts, exercise choices)
 * - POST /v2/state/active-contracts    (query active contracts)
 * - GET  /v2/version                   (health check)
 */
export class LedgerApiClient implements ILedgerApiClient {
  private baseUrl: string;
  private actAs: string[];
  private readAs: string[];
  private applicationId: string;

  constructor(config: LedgerApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.actAs = config.actAs;
    this.readAs = config.readAs ?? config.actAs;
    this.applicationId = config.applicationId ?? DEFAULT_APPLICATION_ID;
  }

  async createContract<T>(templateId: string, payload: T): Promise<string> {
    const result = await this.submitCommand({
      commands: [
        {
          createCommand: {
            templateId,
            createArguments: payload,
          },
        },
      ],
    });

    const created = result.transaction?.events?.find((e) => e.created);
    if (!created?.created) {
      throw new LedgerApiError("No contract created in response");
    }
    return created.created.contractId;
  }

  async exerciseChoice(
    contractId: string,
    templateId: string,
    choice: string,
    argument: Record<string, unknown>
  ): Promise<CommandResult> {
    return this.submitCommand({
      commands: [
        {
          exerciseCommand: {
            contractId,
            templateId,
            choice,
            choiceArgument: argument,
          },
        },
      ],
    });
  }

  async getActiveContracts<T>(
    templateId: string,
    filter?: Record<string, unknown>
  ): Promise<ActiveContract<T>[]> {
    const body: Record<string, unknown> = {
      filter: {
        templateFilter: {
          value: { templateIds: [templateId] },
        },
      },
    };

    if (filter) {
      body.activeAtOffset = filter.activeAtOffset;
    }

    const response = await this.fetch("/v2/state/active-contracts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const contracts: ActiveContract<T>[] = [];

    if (data.contractEntries) {
      for (const entry of data.contractEntries) {
        if (entry.activeContract?.createdEvent) {
          const event = entry.activeContract.createdEvent;
          contracts.push({
            contractId: event.contractId,
            templateId: event.templateId,
            payload: event.createArguments as T,
          });
        }
      }
    }

    return contracts;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch("/v2/version", { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async submitCommand(
    command: Record<string, unknown>
  ): Promise<CommandResult> {
    const body = {
      ...command,
      actAs: this.actAs,
      readAs: this.readAs,
      applicationId: this.applicationId,
      commandId: crypto.randomUUID(),
    };

    const response = await this.fetch("/v2/commands/submit-and-wait", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return {
      completionOffset: data.completionOffset ?? "",
      transaction: data.transaction,
    };
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };

    let response: Response;
    try {
      response = await fetch(url, { ...init, headers });
    } catch (error) {
      throw new LedgerApiError(
        `Failed to connect to Ledger API at ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LedgerApiError(
        `Ledger API ${init.method} ${path} returned ${response.status}: ${text}`
      );
    }

    return response;
  }
}
