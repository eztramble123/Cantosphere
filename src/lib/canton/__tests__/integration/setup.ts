import { LedgerApiClient } from "../../ledger-api/client";
import type { ILedgerApiClient, LedgerApiConfig } from "../../ledger-api/types";

const SANDBOX_BASE_URL =
  process.env.CANTON_JSON_API_URL || "http://localhost:4021";

const OPERATOR_PARTY =
  process.env.CANTON_PARTY_MARKETPLACE_OPERATOR ||
  "MarketplaceOperator::sandbox";
const PROVIDER_PARTY =
  process.env.CANTON_PARTY_APP_PROVIDER || "AppProvider::sandbox";
const VALIDATOR_PARTY =
  process.env.CANTON_PARTY_VALIDATOR1 || "Validator1::sandbox";

export const parties = {
  operator: OPERATOR_PARTY,
  provider: PROVIDER_PARTY,
  validator: VALIDATOR_PARTY,
} as const;

/**
 * Check whether the Canton sandbox is reachable.
 */
export async function isSandboxAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SANDBOX_BASE_URL}/v2/version`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a LedgerApiClient configured for the sandbox with operator + provider parties.
 */
export function createTestClient(
  overrides?: Partial<LedgerApiConfig>
): ILedgerApiClient {
  return new LedgerApiClient({
    baseUrl: SANDBOX_BASE_URL,
    actAs: [OPERATOR_PARTY, PROVIDER_PARTY],
    readAs: [OPERATOR_PARTY, PROVIDER_PARTY, VALIDATOR_PARTY],
    applicationId: "canton-store-integration-test",
    ...overrides,
  });
}

/**
 * Generate a unique ID for test isolation.
 */
export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
