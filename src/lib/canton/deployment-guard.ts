import { db } from "@/lib/db";
import type { Deployment, PrismaClient } from "@prisma/client";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Check for an existing active/in-progress deployment of the same version to the same node.
 * Returns the existing deployment if found, null otherwise.
 * Accepts an optional transaction client for atomicity with deployment creation.
 */
export async function checkDuplicateDeployment(
  nodeId: string,
  versionId: string,
  client?: TxClient
): Promise<Deployment | null> {
  return (client ?? db).deployment.findFirst({
    where: {
      nodeId,
      versionId,
      status: { in: ["PENDING", "UPLOADING", "VETTING", "VERIFYING", "COMPLETED"] },
    },
  });
}
