import type { IPackageService } from "./package-service";
import { PackageService } from "./package-service";
import { MockPackageService } from "./mock-package-service";
import type { NodeConnectionConfig } from "./types";

/**
 * Determines whether to use mock mode.
 *
 * Mock mode is enabled when:
 * - CANTON_MOCK_MODE=true is set explicitly, OR
 * - NODE_ENV=development AND no CANTON_ADMIN_URL is configured
 */
function isMockMode(): boolean {
  if (process.env.CANTON_MOCK_MODE === "true") return true;
  if (process.env.CANTON_MOCK_MODE === "false") return false;
  return process.env.NODE_ENV === "development" && !process.env.CANTON_ADMIN_URL;
}

// Singleton mock instance (shares in-memory state across calls in dev)
let mockInstance: MockPackageService | null = null;

/**
 * Create a PackageService instance for the given node config.
 * Returns a MockPackageService in dev/mock mode, or a real PackageService otherwise.
 */
export function createPackageService(config: NodeConnectionConfig): IPackageService {
  if (isMockMode()) {
    if (!mockInstance) {
      mockInstance = new MockPackageService();
      console.log("[Canton] Using MockPackageService (CANTON_MOCK_MODE or development without CANTON_ADMIN_URL)");
    }
    return mockInstance;
  }

  return new PackageService(config);
}
