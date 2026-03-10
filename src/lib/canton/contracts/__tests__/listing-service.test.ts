import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListingContractService } from "../listing-service";
import type { ILedgerApiClient } from "../../ledger-api/types";

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    appListing: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

function createMockLedger(): ILedgerApiClient {
  return {
    createContract: vi.fn().mockResolvedValue("mock-contract-1"),
    exerciseChoice: vi.fn().mockResolvedValue({
      completionOffset: "offset-1",
      transaction: { events: [] },
    }),
    getActiveContracts: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

describe("ListingContractService", () => {
  let service: ListingContractService;
  let mockLedger: ILedgerApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger = createMockLedger();
    service = new ListingContractService(mockLedger, "operator::test");
  });

  describe("createOnChainListing", () => {
    it("should create a contract and update Postgres", async () => {
      const { db } = await import("@/lib/db");

      const contractId = await service.createOnChainListing("listing-1", {
        providerParty: "provider::123",
        appId: "app-1",
        appName: "Test App",
        description: "A test application",
        darHash: "abc123",
        pricingModel: "FREE",
        supportEmail: "test@example.com",
        supportUrl: "https://example.com",
      });

      expect(contractId).toBe("mock-contract-1");
      expect(mockLedger.createContract).toHaveBeenCalledWith(
        "Canton.Marketplace:AppListing",
        expect.objectContaining({
          operator: "operator::test",
          provider: "provider::123",
          appName: "Test App",
          active: true,
          pricingModel: { tag: "Free" },
        })
      );
      expect(db.appListing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { onChainContractId: "mock-contract-1" },
      });
    });

    it("should handle paid pricing models correctly", async () => {
      await service.createOnChainListing("listing-2", {
        providerParty: "provider::123",
        appId: "app-2",
        appName: "Paid App",
        description: "A paid app",
        darHash: "def456",
        pricingModel: "SUBSCRIPTION",
        priceAmount: "9.99",
        priceCurrency: "USD",
        billingPeriodDays: 30,
      });

      expect(mockLedger.createContract).toHaveBeenCalledWith(
        "Canton.Marketplace:AppListing",
        expect.objectContaining({
          pricingModel: {
            tag: "Subscription",
            value: { amount: "9.99", currency: "USD", intervalDays: 30 },
          },
        })
      );
    });
  });

  describe("delistOnChain", () => {
    it("should exercise DelistApp choice", async () => {
      await service.delistOnChain("contract-1");

      expect(mockLedger.exerciseChoice).toHaveBeenCalledWith(
        "contract-1",
        "Canton.Marketplace:AppListing",
        "DelistApp",
        {}
      );
    });
  });

  describe("queryActiveListings", () => {
    it("should return active listing contracts", async () => {
      (mockLedger.getActiveContracts as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          contractId: "c1",
          templateId: "Canton.Marketplace:AppListing",
          payload: { appName: "App 1", active: true },
        },
      ]);

      const results = await service.queryActiveListings();
      expect(results).toHaveLength(1);
      expect(results[0].payload.appName).toBe("App 1");
    });
  });
});
