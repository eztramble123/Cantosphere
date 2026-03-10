import { isMockMode } from "../service-factory";
import { LedgerApiClient } from "./client";
import { MockLedgerApiClient } from "./mock-ledger-client";
import type { ILedgerApiClient, LedgerApiConfig } from "./types";

export type { ILedgerApiClient, LedgerApiConfig } from "./types";
export type {
  ActiveContract,
  CommandResult,
  DamlAppListing,
  DamlCantonCoin,
  DamlInstallRequest,
  DamlInstallation,
  DamlLicense,
  DamlPricingModel,
} from "./types";

let mockInstance: MockLedgerApiClient | null = null;

function getDefaultConfig(): LedgerApiConfig {
  const baseUrl =
    process.env.CANTON_JSON_API_URL || "http://localhost:4021";
  const operatorParty =
    process.env.CANTON_PARTY_MARKETPLACE_OPERATOR || "MarketplaceOperator::mock";

  return {
    baseUrl,
    actAs: [operatorParty],
    applicationId: "canton-store",
  };
}

/**
 * Create a Ledger API client.
 * Returns a MockLedgerApiClient in mock mode, or a real LedgerApiClient otherwise.
 */
export function createLedgerApiClient(
  config?: LedgerApiConfig
): ILedgerApiClient {
  if (isMockMode()) {
    if (!mockInstance) {
      mockInstance = new MockLedgerApiClient();
      console.log(
        "[Canton] Using MockLedgerApiClient (mock mode)"
      );
    }
    return mockInstance;
  }

  return new LedgerApiClient(config ?? getDefaultConfig());
}
