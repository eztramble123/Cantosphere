import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import type { IPackageService } from "./package-service";
import { createPackageService } from "./service-factory";
import { validateDar } from "./dar-parser";
import { DeployStep, type DeploymentContext } from "./types";
import type { DeploymentStatus, StepStatus } from "@prisma/client";

const STEP_ORDER: DeployStep[] = [
  DeployStep.VALIDATE_DAR,
  DeployStep.CHECK_DEPENDENCIES,
  DeployStep.UPLOAD_DAR,
  DeployStep.VET_PACKAGES,
  DeployStep.VERIFY_DEPLOYMENT,
];

const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 1000,
  retryableSteps: new Set([
    DeployStep.CHECK_DEPENDENCIES,
    DeployStep.UPLOAD_DAR,
    DeployStep.VET_PACKAGES,
    DeployStep.VERIFY_DEPLOYMENT,
  ]),
};

/**
 * Orchestrates the multi-step deployment of a DAR to a Canton node.
 * Each step is tracked in the database for real-time progress updates.
 */
export class DeployOrchestrator {
  private packageService: IPackageService;

  constructor(private ctx: DeploymentContext) {
    this.packageService = createPackageService(ctx.nodeConfig);
  }

  /**
   * Initialize deployment steps in the database
   */
  async initialize(): Promise<void> {
    await db.deploymentStep.createMany({
      data: STEP_ORDER.map((step) => ({
        deploymentId: this.ctx.deploymentId,
        step,
        status: "PENDING" as StepStatus,
      })),
    });
  }

  /**
   * Execute all deployment steps sequentially
   */
  async execute(): Promise<void> {
    try {
      // Pre-flight: verify node is reachable
      const healthy = await this.packageService.healthCheck();
      if (!healthy) {
        throw new Error(
          `Cannot reach Canton node at ${this.ctx.nodeConfig.host}:${this.ctx.nodeConfig.port}`
        );
      }

      for (const step of STEP_ORDER) {
        await this.executeStep(step);
      }
      await this.updateDeploymentStatus("COMPLETED");
      await this.syncInstallRequestStatus("COMPLETED");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await this.updateDeploymentStatus("FAILED", message);
      await this.syncInstallRequestStatus("FAILED", message);
      throw error;
    }
  }

  private async executeStep(step: DeployStep): Promise<void> {
    const canRetry = RETRY_CONFIG.retryableSteps.has(step);
    const maxAttempts = canRetry ? RETRY_CONFIG.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.updateStepStatus(step, "IN_PROGRESS",
        attempt > 1 ? `Retry ${attempt - 1}/${RETRY_CONFIG.maxRetries}` : undefined
      );

      try {
        switch (step) {
          case DeployStep.VALIDATE_DAR:
            await this.validateDar();
            break;
          case DeployStep.CHECK_DEPENDENCIES:
            await this.checkDependencies();
            break;
          case DeployStep.UPLOAD_DAR:
            await this.uploadDar();
            break;
          case DeployStep.VET_PACKAGES:
            await this.vetPackages();
            break;
          case DeployStep.VERIFY_DEPLOYMENT:
            await this.verifyDeployment();
            break;
        }
        await this.updateStepStatus(step, "COMPLETED");
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        if (attempt < maxAttempts) {
          console.warn(
            `Deployment ${this.ctx.deploymentId}: step ${step} failed (attempt ${attempt}/${maxAttempts}), retrying...`,
            message
          );
          const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        const finalMessage = canRetry
          ? `${message} (after ${maxAttempts} attempts)`
          : message;
        await this.updateStepStatus(step, "FAILED", finalMessage);
        throw new Error(finalMessage);
      }
    }
  }

  private async validateDar(): Promise<void> {
    const storage = getStorage();
    const darData = await storage.get(this.ctx.darFileKey);

    const isValid = await validateDar(darData);
    if (!isValid) {
      throw new Error("DAR file validation failed — invalid structure");
    }

    await this.updateDeploymentStatus("UPLOADING");
  }

  private async checkDependencies(): Promise<void> {
    // Check which packages are already on the node
    const existingPackages = await this.packageService.listPackages();
    const existingIds = new Set(
      existingPackages.packageDescriptions?.map((p) => p.packageId) || []
    );

    const missing = this.ctx.packageIds.filter(
      (id) => !existingIds.has(id)
    );

    await this.updateStepMessage(
      DeployStep.CHECK_DEPENDENCIES,
      `${missing.length} of ${this.ctx.packageIds.length} packages need uploading`
    );
  }

  private async uploadDar(): Promise<void> {
    await this.updateDeploymentStatus("UPLOADING");

    const storage = getStorage();
    const darData = await storage.get(this.ctx.darFileKey);

    await this.packageService.uploadDar(
      darData,
      `${this.ctx.darFileHash}.dar`,
      true
    );
  }

  private async vetPackages(): Promise<void> {
    await this.updateDeploymentStatus("VETTING");
    await this.packageService.vetDar(this.ctx.darFileHash, this.ctx.synchronizerId);
  }

  private async verifyDeployment(): Promise<void> {
    await this.updateDeploymentStatus("VERIFYING");

    const packages = await this.packageService.listPackages();
    const deployedIds = new Set(
      packages.packageDescriptions?.map((p) => p.packageId) || []
    );

    const allDeployed = this.ctx.packageIds.every((id) =>
      deployedIds.has(id)
    );

    if (!allDeployed) {
      throw new Error(
        "Not all packages were verified as deployed on the node"
      );
    }
  }

  // ─── Install request sync ───────────────────────────────

  private async syncInstallRequestStatus(
    status: "COMPLETED" | "FAILED",
    errorMessage?: string
  ): Promise<void> {
    if (!this.ctx.installRequestId) return;

    try {
      const request = await db.installRequest.update({
        where: { id: this.ctx.installRequestId },
        data: {
          status,
          statusMessage: errorMessage,
          completedAt: new Date(),
        },
        select: { requesterId: true, listing: { select: { appId: true } } },
      });

      // On success, upsert an Installation record
      if (status === "COMPLETED") {
        await db.installation.upsert({
          where: {
            userId_appId: {
              userId: request.requesterId,
              appId: request.listing.appId,
            },
          },
          create: {
            userId: request.requesterId,
            appId: request.listing.appId,
            nodeId: this.ctx.nodeId,
            versionId: this.ctx.versionId,
          },
          update: {
            nodeId: this.ctx.nodeId,
            versionId: this.ctx.versionId,
          },
        });
      }
    } catch (err) {
      // Bookkeeping failure must not corrupt the deployment
      console.error("Failed to sync install request status:", err);
    }
  }

  // ─── Database helpers ─────────────────────────────────

  private async updateDeploymentStatus(
    status: DeploymentStatus,
    errorMessage?: string
  ): Promise<void> {
    await db.deployment.update({
      where: { id: this.ctx.deploymentId },
      data: {
        status,
        errorMessage,
        completedAt:
          status === "COMPLETED" || status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  }

  private async updateStepStatus(
    step: DeployStep,
    status: StepStatus,
    message?: string
  ): Promise<void> {
    await db.deploymentStep.update({
      where: {
        deploymentId_step: {
          deploymentId: this.ctx.deploymentId,
          step,
        },
      },
      data: {
        status,
        message,
        startedAt: status === "IN_PROGRESS" ? new Date() : undefined,
        completedAt:
          status === "COMPLETED" || status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  }

  private async updateStepMessage(
    step: DeployStep,
    message: string
  ): Promise<void> {
    await db.deploymentStep.update({
      where: {
        deploymentId_step: {
          deploymentId: this.ctx.deploymentId,
          step,
        },
      },
      data: { message },
    });
  }
}

/**
 * Start a deployment asynchronously.
 * Creates the orchestrator and runs it without blocking.
 */
export async function startDeployment(
  ctx: DeploymentContext
): Promise<void> {
  const orchestrator = new DeployOrchestrator(ctx);
  await orchestrator.initialize();

  // Run asynchronously — don't await
  orchestrator.execute().catch((error) => {
    console.error(`Deployment ${ctx.deploymentId} failed:`, error);
  });
}
