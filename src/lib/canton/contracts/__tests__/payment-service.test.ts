import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentContractService } from "../payment-service";
import type { ILedgerApiClient } from "../../ledger-api/types";

function createMockLedger(): ILedgerApiClient {
  return {
    createContract: vi.fn().mockResolvedValue("mock-coin-1"),
    exerciseChoice: vi.fn().mockResolvedValue({
      completionOffset: "offset-1",
      transaction: {
        events: [
          {
            archived: {
              contractId: "listing-contract-1",
              templateId: "Canton.Marketplace:AppListing",
            },
          },
          {
            created: {
              contractId: "mock-license-1",
              templateId: "Canton.Marketplace:License",
              payload: {},
            },
          },
          {
            created: {
              contractId: "mock-change-1",
              templateId: "Canton.Coin:CantonCoin",
              payload: {},
            },
          },
        ],
      },
    }),
    getActiveContracts: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

describe("PaymentContractService", () => {
  let service: PaymentContractService;
  let mockLedger: ILedgerApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLedger = createMockLedger();
    service = new PaymentContractService(mockLedger, "operator::test");
  });

  describe("purchaseOnChain", () => {
    it("should exercise Purchase choice and return license + change contract IDs", async () => {
      const result = await service.purchaseOnChain("listing-contract-1", {
        buyerParty: "buyer::123",
        coinContractId: "coin-1",
      });

      expect(result.licenseContractId).toBe("mock-license-1");
      expect(result.changeContractId).toBe("mock-change-1");
      expect(mockLedger.exerciseChoice).toHaveBeenCalledWith(
        "listing-contract-1",
        "Canton.Marketplace:AppListing",
        "Purchase",
        {
          buyer: "buyer::123",
          coinCid: "coin-1",
        }
      );
    });

    it("should handle purchase without change (exact payment)", async () => {
      (mockLedger.exerciseChoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        completionOffset: "offset-2",
        transaction: {
          events: [
            {
              created: {
                contractId: "mock-license-2",
                templateId: "Canton.Marketplace:License",
                payload: {},
              },
            },
          ],
        },
      });

      const result = await service.purchaseOnChain("listing-contract-1", {
        buyerParty: "buyer::123",
        coinContractId: "coin-1",
      });

      expect(result.licenseContractId).toBe("mock-license-2");
      expect(result.changeContractId).toBeUndefined();
    });

    it("should throw if no license contract is produced", async () => {
      (mockLedger.exerciseChoice as ReturnType<typeof vi.fn>).mockResolvedValue({
        completionOffset: "offset-3",
        transaction: { events: [] },
      });

      await expect(
        service.purchaseOnChain("listing-contract-1", {
          buyerParty: "buyer::123",
          coinContractId: "coin-1",
        })
      ).rejects.toThrow("Purchase did not produce a License contract");
    });
  });

  describe("getBalance", () => {
    it("should sum coins for a party", async () => {
      (mockLedger.getActiveContracts as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          contractId: "coin-1",
          templateId: "Canton.Coin:CantonCoin",
          payload: { issuer: "operator::test", owner: "alice::1", amount: "100.00", currency: "CC" },
        },
        {
          contractId: "coin-2",
          templateId: "Canton.Coin:CantonCoin",
          payload: { issuer: "operator::test", owner: "alice::1", amount: "50.50", currency: "CC" },
        },
        {
          contractId: "coin-3",
          templateId: "Canton.Coin:CantonCoin",
          payload: { issuer: "operator::test", owner: "bob::2", amount: "200.00", currency: "CC" },
        },
      ]);

      const result = await service.getBalance("alice::1");

      expect(result.total).toBe("150.50");
      expect(result.coins).toHaveLength(2);
      expect(result.coins.every((c) => c.payload.owner === "alice::1")).toBe(true);
    });

    it("should return zero for a party with no coins", async () => {
      (mockLedger.getActiveContracts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.getBalance("alice::1");

      expect(result.total).toBe("0.00");
      expect(result.coins).toHaveLength(0);
    });
  });

  describe("mintCoins", () => {
    it("should create a CantonCoin contract", async () => {
      const contractId = await service.mintCoins("alice::1", "500.00");

      expect(contractId).toBe("mock-coin-1");
      expect(mockLedger.createContract).toHaveBeenCalledWith(
        "Canton.Coin:CantonCoin",
        {
          issuer: "operator::test",
          owner: "alice::1",
          amount: "500.00",
          currency: "CC",
        }
      );
    });
  });
});
