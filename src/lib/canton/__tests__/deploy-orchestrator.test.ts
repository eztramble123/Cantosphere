import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeployStep } from "../types";

// Mock dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    deploymentStep: {
      createMany: vi.fn(),
      update: vi.fn(),
    },
    deployment: {
      update: vi.fn(),
    },
    installRequest: {
      update: vi.fn(),
    },
    installation: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(() => ({
    get: vi.fn(() => Promise.resolve(Buffer.from("mock-dar-data"))),
  })),
}));

vi.mock("../dar-parser", () => ({
  validateDar: vi.fn(() => Promise.resolve(true)),
}));

const mockPackageService = {
  uploadDar: vi.fn(() => Promise.resolve("mock-hash")),
  listPackages: vi.fn(() =>
    Promise.resolve({
      packageDescriptions: [
        { packageId: "pkg-1", name: "test", version: "1.0.0", sourceDescription: "" },
      ],
    })
  ),
  listDars: vi.fn(() => Promise.resolve({ dars: [] })),
  vetDar: vi.fn(() => Promise.resolve()),
  unvetDar: vi.fn(() => Promise.resolve()),
  healthCheck: vi.fn(() => Promise.resolve(true)),
};

vi.mock("../service-factory", () => ({
  createPackageService: vi.fn(() => mockPackageService),
}));

import { db } from "@/lib/db";
import { validateDar } from "../dar-parser";
import { DeployOrchestrator, startDeployment } from "../deploy-orchestrator";

const mockDb = vi.mocked(db);
const mockValidateDar = vi.mocked(validateDar);

function createTestContext() {
  return {
    deploymentId: "deploy-1",
    nodeId: "node-1",
    nodeConfig: { host: "localhost", port: 5002, useTls: false },
    darFileKey: "test-key",
    darFileHash: "test-hash",
    packageIds: ["pkg-1"],
    versionId: "ver-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.installRequest.update.mockResolvedValue({
    requesterId: "user-1",
    listing: { appId: "app-1" },
  } as never);
  mockDb.installation.upsert.mockResolvedValue({} as never);
});

describe("DeployOrchestrator", () => {
  describe("initialize", () => {
    it("creates 5 deployment steps in the database", async () => {
      const orchestrator = new DeployOrchestrator(createTestContext());
      await orchestrator.initialize();

      expect(mockDb.deploymentStep.createMany).toHaveBeenCalledTimes(1);
      const call = mockDb.deploymentStep.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(5);
      expect(call.data.map((d: { step: string }) => d.step)).toEqual([
        DeployStep.VALIDATE_DAR,
        DeployStep.CHECK_DEPENDENCIES,
        DeployStep.UPLOAD_DAR,
        DeployStep.VET_PACKAGES,
        DeployStep.VERIFY_DEPLOYMENT,
      ]);
    });
  });

  describe("execute", () => {
    it("completes all steps in order on success", async () => {
      const orchestrator = new DeployOrchestrator(createTestContext());
      await orchestrator.execute();

      // Verify steps were marked IN_PROGRESS then COMPLETED
      const stepCalls = mockDb.deploymentStep.update.mock.calls;
      // Each step gets at least IN_PROGRESS + COMPLETED = 2 calls = 10 total minimum
      expect(stepCalls.length).toBeGreaterThanOrEqual(10);

      // Verify deployment marked COMPLETED
      const deploymentCalls = mockDb.deployment.update.mock.calls;
      const lastDeploymentCall = deploymentCalls[deploymentCalls.length - 1];
      expect(lastDeploymentCall[0].data.status).toBe("COMPLETED");
    });

    it("marks deployment FAILED on step error", async () => {
      mockValidateDar.mockResolvedValueOnce(false);

      const orchestrator = new DeployOrchestrator(createTestContext());
      await expect(orchestrator.execute()).rejects.toThrow();

      const deploymentCalls = mockDb.deployment.update.mock.calls;
      const lastCall = deploymentCalls[deploymentCalls.length - 1];
      expect(lastCall[0].data.status).toBe("FAILED");
    });
  });

  describe("health check", () => {
    it("fails fast when node is unreachable", async () => {
      mockPackageService.healthCheck.mockResolvedValueOnce(false);

      const orchestrator = new DeployOrchestrator(createTestContext());
      await expect(orchestrator.execute()).rejects.toThrow(
        "Cannot reach Canton node at localhost:5002"
      );

      const deploymentCalls = mockDb.deployment.update.mock.calls;
      const lastCall = deploymentCalls[deploymentCalls.length - 1];
      expect(lastCall[0].data.status).toBe("FAILED");
    });
  });

  describe("retry logic", () => {
    it("does not retry VALIDATE_DAR step", async () => {
      mockValidateDar.mockResolvedValueOnce(false);

      const orchestrator = new DeployOrchestrator(createTestContext());
      await expect(orchestrator.execute()).rejects.toThrow();

      // validateDar should be called only once (no retry)
      expect(mockValidateDar).toHaveBeenCalledTimes(1);
    });

    it("retries UPLOAD_DAR on transient failure", async () => {
      mockPackageService.uploadDar
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("hash");

      const orchestrator = new DeployOrchestrator(createTestContext());
      await orchestrator.execute();

      // uploadDar should be called twice (1 failure + 1 success)
      expect(mockPackageService.uploadDar).toHaveBeenCalledTimes(2);
    });
  });

  describe("syncInstallRequestStatus", () => {
    it("creates Installation on COMPLETED with installRequestId", async () => {
      const ctx = {
        ...createTestContext(),
        installRequestId: "req-1",
      };

      const orchestrator = new DeployOrchestrator(ctx);
      await orchestrator.execute();

      expect(mockDb.installRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({ status: "COMPLETED" }),
        })
      );

      expect(mockDb.installation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nodeId: "node-1",
            versionId: "ver-1",
          }),
        })
      );
    });

    it("does not sync when installRequestId is absent", async () => {
      const orchestrator = new DeployOrchestrator(createTestContext());
      await orchestrator.execute();

      expect(mockDb.installRequest.update).not.toHaveBeenCalled();
    });
  });
});

describe("startDeployment", () => {
  it("initializes and starts execution asynchronously", async () => {
    const ctx = createTestContext();
    await startDeployment(ctx);

    expect(mockDb.deploymentStep.createMany).toHaveBeenCalledTimes(1);
    // The execute runs asynchronously, so we can't easily assert completion
    // but we can verify initialization happened
  });
});
