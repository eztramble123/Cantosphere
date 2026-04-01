import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    cantonPartyMapping: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../onboard-user", () => ({
  onboardUser: vi.fn(),
}));

vi.mock("../service-factory", () => ({
  isMockMode: vi.fn(),
}));

import { db } from "@/lib/db";
import { onboardUser } from "../onboard-user";
import { isMockMode } from "../service-factory";
import { resolvePartyId } from "../party-resolution";

const mockDb = vi.mocked(db);
const mockOnboardUser = vi.mocked(onboardUser);
const mockIsMockMode = vi.mocked(isMockMode);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMockMode.mockReturnValue(true); // Default to mock mode for backward compat
});

describe("resolvePartyId", () => {
  it("returns the mapped Canton party ID when a mapping exists", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce({
      partyId: "AppProvider::participant1",
    } as never);

    const result = await resolvePartyId("user-cuid-123");

    expect(result).toBe("AppProvider::participant1");
    expect(mockDb.cantonPartyMapping.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-cuid-123" },
      select: { partyId: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("falls back to the raw userId in mock mode when no mapping exists and no user found", async () => {
    mockIsMockMode.mockReturnValue(true);
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce(null as never);

    const result = await resolvePartyId("user-cuid-456");

    expect(result).toBe("user-cuid-456");
  });

  it("throws in non-mock mode when no mapping exists and no user found", async () => {
    mockIsMockMode.mockReturnValue(false);
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce(null as never);

    await expect(resolvePartyId("user-cuid-456")).rejects.toThrow(
      "Cannot use raw userId in non-mock mode"
    );
  });

  it("triggers lazy allocation when no mapping exists but user is found", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce({
      role: "VALIDATOR",
      name: "Test User",
      email: "test@example.com",
    } as never);
    mockOnboardUser.mockResolvedValueOnce({
      id: "mapping-1",
      userId: "user-cuid-789",
      partyId: "User_uid789::mock",
      participantId: "participant-mock",
      role: "VALIDATOR",
      createdAt: new Date(),
    } as never);

    const result = await resolvePartyId("user-cuid-789");

    expect(result).toBe("User_uid789::mock");
    expect(mockOnboardUser).toHaveBeenCalledWith(
      "user-cuid-789",
      "VALIDATOR",
      "Test User"
    );
  });

  it("uses email as display name when name is null", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce({
      role: "VALIDATOR",
      name: null,
      email: "test@example.com",
    } as never);
    mockOnboardUser.mockResolvedValueOnce({
      partyId: "User_test::mock",
    } as never);

    await resolvePartyId("user-123");

    expect(mockOnboardUser).toHaveBeenCalledWith(
      "user-123",
      "VALIDATOR",
      "test@example.com"
    );
  });

  it("returns cached mapping on subsequent calls", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce({
      partyId: "User_abc::mock",
    } as never);

    const result = await resolvePartyId("user-abc");

    expect(result).toBe("User_abc::mock");
    expect(mockOnboardUser).not.toHaveBeenCalled();
  });

  it("falls back to userId in mock mode when lazy allocation fails", async () => {
    mockIsMockMode.mockReturnValue(true);
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce({
      role: "VALIDATOR",
      name: "Test",
      email: "test@test.com",
    } as never);
    mockOnboardUser.mockRejectedValueOnce(new Error("Canton down"));

    const result = await resolvePartyId("user-fallback");

    expect(result).toBe("user-fallback");
  });

  it("throws in non-mock mode when lazy allocation fails", async () => {
    mockIsMockMode.mockReturnValue(false);
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockDb.user.findUnique.mockResolvedValueOnce({
      role: "VALIDATOR",
      name: "Test",
      email: "test@test.com",
    } as never);
    mockOnboardUser.mockRejectedValueOnce(new Error("Canton down"));

    await expect(resolvePartyId("user-fallback")).rejects.toThrow(
      "Cannot use raw userId in non-mock mode"
    );
  });
});
