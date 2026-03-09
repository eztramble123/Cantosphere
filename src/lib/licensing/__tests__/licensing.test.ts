import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db before importing the module under test
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

import { db } from "@/lib/db";
import { validateLicense, acquireLicense, revokeLicense } from "../index";

const mockDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateLicense", () => {
  it("returns invalid when no license exists", async () => {
    mockDb.license.findUnique.mockResolvedValue(null);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: false, reason: "No license found" });
  });

  it("returns invalid when license is REVOKED", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "REVOKED",
      expiresAt: null,
      usageLimit: null,
      usageCount: 0,
    } as never);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: false, reason: "License is revoked" });
  });

  it("returns invalid when license is expired", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "ACTIVE",
      expiresAt: pastDate,
      usageLimit: null,
      usageCount: 0,
    } as never);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: false, reason: "License expired" });
  });

  it("returns invalid when usage limit reached", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "ACTIVE",
      expiresAt: null,
      usageLimit: 10,
      usageCount: 10,
    } as never);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: false, reason: "Usage limit reached" });
  });

  it("returns valid for an active, non-expired license", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "ACTIVE",
      expiresAt: futureDate,
      usageLimit: 100,
      usageCount: 5,
    } as never);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid when no expiry and no usage limit", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "ACTIVE",
      expiresAt: null,
      usageLimit: null,
      usageCount: 0,
    } as never);
    const result = await validateLicense("user1", "listing1");
    expect(result).toEqual({ valid: true });
  });
});

describe("acquireLicense", () => {
  it("throws when listing not found", async () => {
    mockDb.appListing.findUnique.mockResolvedValue(null);
    await expect(acquireLicense("listing1", "user1")).rejects.toThrow(
      "Listing not found"
    );
  });

  it("throws when already licensed", async () => {
    mockDb.appListing.findUnique.mockResolvedValue({
      id: "listing1",
      listingStatus: "ACTIVE",
      pricingModel: "FREE",
    } as never);
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      status: "ACTIVE",
    } as never);
    await expect(acquireLicense("listing1", "user1")).rejects.toThrow(
      "Already licensed"
    );
  });

  it("creates a new license for FREE listing", async () => {
    mockDb.appListing.findUnique.mockResolvedValue({
      id: "listing1",
      listingStatus: "ACTIVE",
      pricingModel: "FREE",
      priceAmount: null,
    } as never);
    mockDb.license.findUnique.mockResolvedValue(null);
    mockDb.license.create.mockResolvedValue({
      id: "new-lic",
      status: "ACTIVE",
    } as never);

    const result = await acquireLicense("listing1", "user1");
    expect(result).toEqual({ id: "new-lic", status: "ACTIVE" });
    expect(mockDb.license.create).toHaveBeenCalled();
  });
});

describe("revokeLicense", () => {
  it("throws when license not found", async () => {
    mockDb.license.findUnique.mockResolvedValue(null);
    await expect(revokeLicense("lic1", "user1", false)).rejects.toThrow(
      "License not found"
    );
  });

  it("allows licensee to revoke", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      licenseeId: "user1",
      listing: { providerId: "dev1" },
    } as never);
    mockDb.license.update.mockResolvedValue({ id: "lic1", status: "REVOKED" } as never);

    const result = await revokeLicense("lic1", "user1", false);
    expect(result.status).toBe("REVOKED");
  });

  it("allows provider to revoke", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      licenseeId: "user1",
      listing: { providerId: "dev1" },
    } as never);
    mockDb.license.update.mockResolvedValue({ id: "lic1", status: "REVOKED" } as never);

    const result = await revokeLicense("lic1", "dev1", false);
    expect(result.status).toBe("REVOKED");
  });

  it("throws Forbidden for unauthorized user", async () => {
    mockDb.license.findUnique.mockResolvedValue({
      id: "lic1",
      licenseeId: "user1",
      listing: { providerId: "dev1" },
    } as never);

    await expect(revokeLicense("lic1", "random-user", false)).rejects.toThrow(
      "Forbidden"
    );
  });
});
