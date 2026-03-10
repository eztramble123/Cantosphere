import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    cantonPartyMapping: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { resolvePartyId } from "../party-resolution";

const mockDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
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
    });
  });

  it("falls back to the raw userId when no mapping exists", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);

    const result = await resolvePartyId("user-cuid-456");

    expect(result).toBe("user-cuid-456");
  });

  it("falls back to the raw userId when mapping lookup returns undefined partyId", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(
      { partyId: undefined } as never
    );

    const result = await resolvePartyId("user-cuid-789");

    expect(result).toBe("user-cuid-789");
  });
});
