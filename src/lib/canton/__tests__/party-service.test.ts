import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../service-factory", () => ({
  isMockMode: vi.fn(),
}));

import { isMockMode } from "../service-factory";
import { allocateParty, sanitizePartyHint } from "../party-service";

const mockIsMockMode = vi.mocked(isMockMode);

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("sanitizePartyHint", () => {
  it("removes non-alphanumeric characters except underscores", () => {
    expect(sanitizePartyHint("User_abc123")).toBe("User_abc123");
    expect(sanitizePartyHint("hello@world.com")).toBe("helloworldcom");
    expect(sanitizePartyHint("my-user-name")).toBe("myusername");
    expect(sanitizePartyHint("special!@#chars")).toBe("specialchars");
  });
});

describe("allocateParty", () => {
  describe("mock mode", () => {
    beforeEach(() => {
      mockIsMockMode.mockReturnValue(true);
    });

    it("returns synthetic party ID without HTTP call", async () => {
      const result = await allocateParty("User_abc123", "Test User");

      expect(result).toEqual({
        partyId: "User_abc123::mock",
        participantId: "participant-mock",
      });
    });

    it("includes the party hint in the synthetic ID", async () => {
      const result = await allocateParty("MyParty", "My Party");

      expect(result.partyId).toBe("MyParty::mock");
    });
  });

  describe("real mode", () => {
    beforeEach(() => {
      mockIsMockMode.mockReturnValue(false);
    });

    it("calls fetch to /v2/parties with correct body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ party: "User_abc123::participant1" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await allocateParty("User_abc123", "Test User");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4021/v2/parties",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partyIdHint: "User_abc123",
            displayName: "Test User",
          }),
          signal: expect.any(AbortSignal),
        })
      );
      expect(result.partyId).toBe("User_abc123::participant1");
    });

    it("throws on non-OK response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve("Party already exists"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        allocateParty("User_abc123", "Test User")
      ).rejects.toThrow("Party allocation failed (409)");
    });

    it("throws on unexpected response shape", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ unexpected: "data" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        allocateParty("User_abc123", "Test User")
      ).rejects.toThrow("Unexpected response from party allocation");
    });
  });
});
