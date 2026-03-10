import { describe, it, expect, vi, beforeEach } from "vitest";
import { LedgerApiClient } from "../client";

const BASE_URL = "http://localhost:4021";
const CONFIG = {
  baseUrl: BASE_URL,
  actAs: ["operator::1234"],
  applicationId: "test",
};

describe("LedgerApiClient", () => {
  let client: LedgerApiClient;

  beforeEach(() => {
    client = new LedgerApiClient(CONFIG);
    vi.restoreAllMocks();
  });

  describe("createContract", () => {
    it("should submit a create command and return the contract ID", async () => {
      const mockResponse = {
        completionOffset: "offset-1",
        transaction: {
          events: [
            {
              created: {
                contractId: "contract-123",
                templateId: "Module:Template",
                payload: { field: "value" },
              },
            },
          ],
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const result = await client.createContract("Module:Template", {
        field: "value",
      });

      expect(result).toBe("contract-123");
      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/v2/commands/submit-and-wait`,
        expect.objectContaining({ method: "POST" })
      );

      const body = JSON.parse(
        (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(body.actAs).toEqual(["operator::1234"]);
      expect(body.commands[0].createCommand.templateId).toBe(
        "Module:Template"
      );
    });

    it("should throw if no created event in response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({ completionOffset: "1", transaction: { events: [] } }),
        })
      );

      await expect(
        client.createContract("Module:Template", {})
      ).rejects.toThrow("No contract created");
    });
  });

  describe("exerciseChoice", () => {
    it("should submit an exercise command", async () => {
      const mockResponse = {
        completionOffset: "offset-2",
        transaction: {
          events: [
            { archived: { contractId: "c1", templateId: "M:T" } },
          ],
        },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const result = await client.exerciseChoice(
        "c1",
        "M:T",
        "Archive",
        {}
      );

      expect(result.completionOffset).toBe("offset-2");

      const body = JSON.parse(
        (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(body.commands[0].exerciseCommand.choice).toBe("Archive");
      expect(body.commands[0].exerciseCommand.contractId).toBe("c1");
    });
  });

  describe("getActiveContracts", () => {
    it("should query and return active contracts", async () => {
      const mockResponse = {
        contractEntries: [
          {
            activeContract: {
              createdEvent: {
                contractId: "c1",
                templateId: "M:T",
                createArguments: { name: "test" },
              },
            },
          },
          {
            activeContract: {
              createdEvent: {
                contractId: "c2",
                templateId: "M:T",
                createArguments: { name: "test2" },
              },
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const results = await client.getActiveContracts<{ name: string }>(
        "M:T"
      );

      expect(results).toHaveLength(2);
      expect(results[0].contractId).toBe("c1");
      expect(results[0].payload.name).toBe("test");
      expect(results[1].contractId).toBe("c2");
    });

    it("should return empty array when no contracts", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ contractEntries: [] }),
        })
      );

      const results = await client.getActiveContracts("M:T");
      expect(results).toHaveLength(0);
    });
  });

  describe("healthCheck", () => {
    it("should return true when API responds ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true })
      );

      expect(await client.healthCheck()).toBe(true);
    });

    it("should return false on network error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
      );

      expect(await client.healthCheck()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw LedgerApiError on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal error"),
        })
      );

      await expect(
        client.createContract("M:T", {})
      ).rejects.toThrow("Ledger API");
    });

    it("should throw LedgerApiError on connection failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
      );

      await expect(
        client.createContract("M:T", {})
      ).rejects.toThrow("Failed to connect");
    });
  });
});
