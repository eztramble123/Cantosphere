import type {
  ILedgerApiClient,
  ActiveContract,
  CommandResult,
  TransactionEvent,
} from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let contractCounter = 0;
let offsetCounter = 0;

/**
 * In-memory mock implementation of ILedgerApiClient.
 * Mirrors MockPackageService pattern for development/testing.
 */
export class MockLedgerApiClient implements ILedgerApiClient {
  private contracts = new Map<
    string,
    { templateId: string; payload: Record<string, unknown> }
  >();

  async createContract<T>(templateId: string, payload: T): Promise<string> {
    await delay(200);

    contractCounter++;
    const contractId = `mock-contract-${contractCounter}`;

    this.contracts.set(contractId, {
      templateId,
      payload: payload as Record<string, unknown>,
    });

    console.log(
      `[MockLedgerApi] createContract: ${templateId} -> ${contractId}`
    );
    return contractId;
  }

  async exerciseChoice(
    contractId: string,
    templateId: string,
    choice: string,
    _argument: Record<string, unknown>
  ): Promise<CommandResult> {
    await delay(200);

    offsetCounter++;
    const events: TransactionEvent[] = [];

    // Simulate archiving the exercised contract
    events.push({
      archived: { contractId, templateId },
    });

    // For choices that produce new contracts, create them
    const producesOneContract = [
      "RequestInstall",
      "ApproveRequest",
      "GrantLicense",
      "Renew",
      "Transfer",
      "Merge",
    ];
    if (producesOneContract.includes(choice)) {
      contractCounter++;
      const newContractId = `mock-contract-${contractCounter}`;
      events.push({
        created: {
          contractId: newContractId,
          templateId,
          payload: {},
        },
      });
    } else if (choice === "Split") {
      // Split produces two contracts
      contractCounter++;
      const c1 = `mock-contract-${contractCounter}`;
      contractCounter++;
      const c2 = `mock-contract-${contractCounter}`;
      events.push(
        { created: { contractId: c1, templateId, payload: {} } },
        { created: { contractId: c2, templateId, payload: {} } }
      );
    } else if (choice === "Purchase") {
      // Purchase produces a License + optionally a change CantonCoin
      contractCounter++;
      const licenseCid = `mock-contract-${contractCounter}`;
      events.push({
        created: {
          contractId: licenseCid,
          templateId: "Canton.Marketplace:License",
          payload: {},
        },
      });
      // Simulate change coin if buyer overpaid
      contractCounter++;
      const changeCid = `mock-contract-${contractCounter}`;
      events.push({
        created: {
          contractId: changeCid,
          templateId: "Canton.Coin:CantonCoin",
          payload: {},
        },
      });
    }

    console.log(
      `[MockLedgerApi] exerciseChoice: ${choice} on ${contractId}`
    );

    return {
      completionOffset: `mock-offset-${offsetCounter}`,
      transaction: { events },
    };
  }

  async getActiveContracts<T>(
    templateId: string,
    _filter?: Record<string, unknown>
  ): Promise<ActiveContract<T>[]> {
    await delay(100);

    const results: ActiveContract<T>[] = [];
    for (const [contractId, contract] of this.contracts) {
      if (contract.templateId === templateId) {
        results.push({
          contractId,
          templateId: contract.templateId,
          payload: contract.payload as T,
        });
      }
    }

    console.log(
      `[MockLedgerApi] getActiveContracts: ${templateId} -> ${results.length} results`
    );
    return results;
  }

  async healthCheck(): Promise<boolean> {
    await delay(50);
    return true;
  }
}
