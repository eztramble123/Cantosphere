// ─── Daml Template Payloads ─────────────────────────────

export type DamlPricingModel =
  | { tag: "Free" }
  | { tag: "OneTime"; value: { amount: string; currency: string } }
  | { tag: "Subscription"; value: { amount: string; currency: string; intervalDays: number } }
  | { tag: "UsageBased"; value: { ratePerMarker: string; currency: string } };

export interface DamlAppListing {
  operator: string;
  provider: string;
  appId: string;
  appName: string;
  description: string;
  darHash: string;
  pricingModel: DamlPricingModel;
  supportEmail: string;
  supportUrl: string;
  active: boolean;
}

export interface DamlInstallRequest {
  operator: string;
  provider: string;
  requester: string;
  listingContractId: string;
  appName: string;
  nodeId: string;
  versionId: string;
  status: "Pending" | "Provisioning" | "Completed" | "Failed" | "Cancelled";
}

export interface DamlInstallation {
  operator: string;
  provider: string;
  user: string;
  appId: string;
  appName: string;
  nodeId: string;
  versionId: string;
  darHash: string;
}

export interface DamlCantonCoin {
  issuer: string;
  owner: string;
  amount: string; // Decimal as string
  currency: string;
}

export interface DamlLicense {
  operator: string;
  provider: string;
  licensee: string;
  listingContractId: string;
  appName: string;
  pricingModel: DamlPricingModel;
  grantedAt: string;
  expiresAt: string | null;
  active: boolean;
}

// ─── Ledger API Response Types ──────────────────────────

export interface TransactionEvent {
  created?: {
    contractId: string;
    templateId: string;
    payload: Record<string, unknown>;
  };
  archived?: {
    contractId: string;
    templateId: string;
  };
}

export interface ActiveContract<T> {
  contractId: string;
  templateId: string;
  payload: T;
}

export interface CommandResult {
  completionOffset: string;
  transaction?: {
    events: TransactionEvent[];
  };
}

// ─── Client Interface ───────────────────────────────────

export interface LedgerApiConfig {
  baseUrl: string;
  actAs: string[];
  readAs?: string[];
  applicationId?: string;
}

export interface ILedgerApiClient {
  createContract<T>(templateId: string, payload: T): Promise<string>;
  exerciseChoice(
    contractId: string,
    templateId: string,
    choice: string,
    argument: Record<string, unknown>
  ): Promise<CommandResult>;
  getActiveContracts<T>(
    templateId: string,
    filter?: Record<string, unknown>
  ): Promise<ActiveContract<T>[]>;
  healthCheck(): Promise<boolean>;
}
