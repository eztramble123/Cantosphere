import { describe, it, expect, vi, beforeEach } from "vitest";
import { purchaseWithCC } from "../index";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    appListing: {
      findUnique: vi.fn(),
    },
    license: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/canton/service-factory", () => ({
  isMockMode: vi.fn(),
}));

vi.mock("@/lib/canton/contracts", () => ({
  createContractServices: vi.fn(),
}));

vi.mock("@/lib/canton/party-resolution", () => ({
  resolvePartyId: vi.fn(),
}));

vi.mock("@/lib/licensing", () => ({
  acquireLicense: vi.fn(),
}));

describe("purchaseWithCC", () => {
  let db: typeof import("@/lib/db").db;
  let isMockMode: () => boolean;
  let createContractServices: () => ReturnType<typeof import("@/lib/canton/contracts").createContractServices>;
  let resolvePartyId: (userId: string) => Promise<string>;
  let acquireLicense: typeof import("@/lib/licensing").acquireLicense;

  const mockListing = {
    id: "listing-1",
    appId: "app-1",
    providerId: "provider-user-1",
    pricingModel: "ONE_TIME" as const,
    priceAmount: 50,
    priceCurrency: "CC",
    listingStatus: "ACTIVE" as const,
    onChainContractId: "onchain-listing-1",
    app: { id: "app-1", name: "Test App", slug: "test-app" },
  };

  const mockPayments = {
    getBalance: vi.fn(),
    purchaseOnChain: vi.fn(),
    mintCoins: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbMod = await import("@/lib/db");
    db = dbMod.db;

    const sfMod = await import("@/lib/canton/service-factory");
    isMockMode = sfMod.isMockMode as unknown as () => boolean;

    const contractMod = await import("@/lib/canton/contracts");
    createContractServices = contractMod.createContractServices as unknown as () => ReturnType<typeof contractMod.createContractServices>;

    const partyMod = await import("@/lib/canton/party-resolution");
    resolvePartyId = partyMod.resolvePartyId as unknown as (userId: string) => Promise<string>;

    const licenseMod = await import("@/lib/licensing");
    acquireLicense = licenseMod.acquireLicense;
  });

  it("should purchase a ONE_TIME listing successfully on-chain", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue(mockListing as never);
    vi.mocked(db.license.findUnique).mockResolvedValue(null);
    vi.mocked(isMockMode).mockReturnValue(false);
    vi.mocked(resolvePartyId)
      .mockResolvedValueOnce("buyer::123")
      .mockResolvedValueOnce("provider::456");
    vi.mocked(createContractServices).mockReturnValue({
      payments: mockPayments,
    } as never);
    mockPayments.getBalance.mockResolvedValue({
      total: "100.00",
      coins: [
        { contractId: "coin-1", payload: { amount: "100.00", owner: "buyer::123" } },
      ],
    });
    mockPayments.purchaseOnChain.mockResolvedValue({
      licenseContractId: "license-contract-1",
      changeContractId: "change-1",
    });

    const mockCreatedLicense = {
      id: "license-1",
      listingId: "listing-1",
      status: "ACTIVE",
      paymentRef: "cc:license-contract-1",
      priceCurrency: "CC",
      listing: { app: { id: "app-1", name: "Test App", slug: "test-app" } },
    };
    vi.mocked(db.license.create).mockResolvedValue(mockCreatedLicense as never);

    const result = await purchaseWithCC("listing-1", "user-1");

    expect(result.paymentRef).toBe("cc:license-contract-1");
    expect(db.license.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentRef: "cc:license-contract-1",
          onChainContractId: "license-contract-1",
        }),
      })
    );
  });

  it("should fall back to acquireLicense in mock mode", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue(mockListing as never);
    vi.mocked(db.license.findUnique).mockResolvedValue(null);
    vi.mocked(isMockMode).mockReturnValue(true);
    vi.mocked(acquireLicense).mockResolvedValue({ id: "license-mock" } as never);

    const result = await purchaseWithCC("listing-1", "user-1");

    expect(result).toEqual({ id: "license-mock" });
    expect(acquireLicense).toHaveBeenCalledWith("listing-1", "user-1");
  });

  it("should throw if listing not found", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue(null);

    await expect(purchaseWithCC("missing", "user-1")).rejects.toThrow("Listing not found");
  });

  it("should throw if listing is not active", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue({
      ...mockListing,
      listingStatus: "SUSPENDED",
    } as never);

    await expect(purchaseWithCC("listing-1", "user-1")).rejects.toThrow("Listing is not active");
  });

  it("should throw if listing is not ONE_TIME", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue({
      ...mockListing,
      pricingModel: "FREE",
    } as never);

    await expect(purchaseWithCC("listing-1", "user-1")).rejects.toThrow(
      "Only ONE_TIME listings can be purchased with CC"
    );
  });

  it("should throw if already licensed", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue(mockListing as never);
    vi.mocked(db.license.findUnique).mockResolvedValue({
      id: "existing-license",
      status: "ACTIVE",
    } as never);

    await expect(purchaseWithCC("listing-1", "user-1")).rejects.toThrow("Already licensed");
  });

  it("should throw if insufficient CC balance", async () => {
    vi.mocked(db.appListing.findUnique).mockResolvedValue(mockListing as never);
    vi.mocked(db.license.findUnique).mockResolvedValue(null);
    vi.mocked(isMockMode).mockReturnValue(false);
    vi.mocked(resolvePartyId)
      .mockResolvedValueOnce("buyer::123")
      .mockResolvedValueOnce("provider::456");
    vi.mocked(createContractServices).mockReturnValue({
      payments: mockPayments,
    } as never);
    mockPayments.getBalance.mockResolvedValue({
      total: "10.00",
      coins: [
        { contractId: "coin-1", payload: { amount: "10.00", owner: "buyer::123" } },
      ],
    });

    await expect(purchaseWithCC("listing-1", "user-1")).rejects.toThrow("Insufficient CC balance");
  });
});
