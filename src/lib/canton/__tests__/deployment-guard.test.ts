import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    deployment: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { checkDuplicateDeployment } from "../deployment-guard";

const mockDb = vi.mocked(db);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkDuplicateDeployment", () => {
  it("returns null when no active deployment exists", async () => {
    mockDb.deployment.findFirst.mockResolvedValueOnce(null);

    const result = await checkDuplicateDeployment("node-1", "version-1");

    expect(result).toBeNull();
    expect(mockDb.deployment.findFirst).toHaveBeenCalledWith({
      where: {
        nodeId: "node-1",
        versionId: "version-1",
        status: { in: ["PENDING", "UPLOADING", "VETTING", "VERIFYING", "COMPLETED"] },
      },
    });
  });

  it("returns existing deployment when one is active", async () => {
    const existing = {
      id: "deploy-1",
      nodeId: "node-1",
      versionId: "version-1",
      status: "COMPLETED",
    };
    mockDb.deployment.findFirst.mockResolvedValueOnce(existing as never);

    const result = await checkDuplicateDeployment("node-1", "version-1");

    expect(result).toEqual(existing);
  });

  it("returns existing deployment when one is pending", async () => {
    const existing = {
      id: "deploy-2",
      nodeId: "node-1",
      versionId: "version-1",
      status: "PENDING",
    };
    mockDb.deployment.findFirst.mockResolvedValueOnce(existing as never);

    const result = await checkDuplicateDeployment("node-1", "version-1");

    expect(result).toEqual(existing);
  });

  it("uses the global db client when no tx client is provided", async () => {
    mockDb.deployment.findFirst.mockResolvedValueOnce(null);

    await checkDuplicateDeployment("node-1", "version-1");

    expect(mockDb.deployment.findFirst).toHaveBeenCalledTimes(1);
  });

  it("uses the provided tx client instead of global db", async () => {
    const mockTxFindFirst = vi.fn().mockResolvedValueOnce(null);
    const txClient = {
      deployment: { findFirst: mockTxFindFirst },
    } as never;

    const result = await checkDuplicateDeployment("node-1", "version-1", txClient);

    expect(result).toBeNull();
    expect(mockTxFindFirst).toHaveBeenCalledWith({
      where: {
        nodeId: "node-1",
        versionId: "version-1",
        status: { in: ["PENDING", "UPLOADING", "VETTING", "VERIFYING", "COMPLETED"] },
      },
    });
    // Global db should NOT have been called
    expect(mockDb.deployment.findFirst).not.toHaveBeenCalled();
  });
});
