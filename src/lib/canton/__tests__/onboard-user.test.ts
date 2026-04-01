import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    cantonPartyMapping: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../party-service", () => ({
  allocateParty: vi.fn(),
  sanitizePartyHint: vi.fn((s: string) => s.replace(/[^a-zA-Z0-9_]/g, "")),
}));

import { db } from "@/lib/db";
import { allocateParty } from "../party-service";
import { onboardUser } from "../onboard-user";

const mockDb = vi.mocked(db);
const mockAllocateParty = vi.mocked(allocateParty);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("onboardUser", () => {
  it("returns existing mapping if one already exists", async () => {
    const existing = {
      id: "mapping-1",
      userId: "user-123",
      partyId: "User_user123::mock",
      participantId: "participant-mock",
      role: "VALIDATOR",
      createdAt: new Date(),
    };
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(
      existing as never
    );

    const result = await onboardUser("user-123", "VALIDATOR", "Test User");

    expect(result).toBe(existing);
    expect(mockAllocateParty).not.toHaveBeenCalled();
    expect(mockDb.cantonPartyMapping.upsert).not.toHaveBeenCalled();
  });

  it("allocates party and creates mapping on first call", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockAllocateParty.mockResolvedValueOnce({
      partyId: "User_user123::mock",
      participantId: "participant-mock",
    });
    const created = {
      id: "mapping-2",
      userId: "user-123",
      partyId: "User_user123::mock",
      participantId: "participant-mock",
      role: "VALIDATOR",
      createdAt: new Date(),
    };
    mockDb.cantonPartyMapping.upsert.mockResolvedValueOnce(created as never);

    const result = await onboardUser("user-123", "VALIDATOR", "Test User");

    expect(mockAllocateParty).toHaveBeenCalledWith(
      "User_user123",
      "Test User"
    );
    expect(mockDb.cantonPartyMapping.upsert).toHaveBeenCalledWith({
      where: {
        userId_participantId: {
          userId: "user-123",
          participantId: "participant-mock",
        },
      },
      update: {},
      create: {
        userId: "user-123",
        partyId: "User_user123::mock",
        participantId: "participant-mock",
        role: "VALIDATOR",
      },
    });
    expect(result).toBe(created);
  });

  it("uses last 8 characters of userId for party hint", async () => {
    mockDb.cantonPartyMapping.findFirst.mockResolvedValueOnce(null as never);
    mockAllocateParty.mockResolvedValueOnce({
      partyId: "User_abcd1234::mock",
      participantId: "participant-mock",
    });
    mockDb.cantonPartyMapping.upsert.mockResolvedValueOnce({} as never);

    await onboardUser("cm3xyzabcd1234", "VALIDATOR", "Test");

    expect(mockAllocateParty).toHaveBeenCalledWith(
      "User_abcd1234",
      "Test"
    );
  });
});
