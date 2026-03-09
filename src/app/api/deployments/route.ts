import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createDeploymentSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { startDeployment } from "@/lib/canton/deploy-orchestrator";
import { deployLimiter } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queryParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = paginationSchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize } = parsed.data;

    const where = {
      node: { ownerId: session.user.id },
    };

    const [deployments, total] = await Promise.all([
      db.deployment.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy: { startedAt: "desc" },
        include: {
          node: {
            select: { id: true, name: true, host: true, port: true },
          },
          version: {
            select: {
              id: true,
              version: true,
              app: { select: { id: true, name: true, slug: true, icon: true } },
            },
          },
        },
      }),
      db.deployment.count({ where }),
    ]);

    return NextResponse.json({
      data: deployments,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/deployments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = deployLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = createDeploymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { nodeId, versionId } = parsed.data;

    // Verify the node exists and belongs to the user
    const node = await db.validatorNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the version exists and its app is published
    const version = await db.appVersion.findUnique({
      where: { id: versionId },
      include: {
        app: { select: { status: true } },
        packages: { select: { packageId: true } },
      },
    });
    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }
    if (version.app.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Can only deploy published apps" },
        { status: 400 }
      );
    }

    // Check for an existing active deployment of the same version to this node
    const existingDeployment = await db.deployment.findFirst({
      where: {
        nodeId,
        versionId,
        status: { in: ["PENDING", "UPLOADING", "VETTING", "VERIFYING", "COMPLETED"] },
      },
    });
    if (existingDeployment) {
      return NextResponse.json(
        { error: "This version is already deployed or deploying to this node" },
        { status: 409 }
      );
    }

    // Create the deployment record
    const deployment = await db.deployment.create({
      data: {
        nodeId,
        versionId,
        status: "PENDING",
      },
      include: {
        node: { select: { id: true, name: true, host: true, port: true } },
        version: {
          select: {
            id: true,
            version: true,
            app: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    // Start the deployment asynchronously
    await startDeployment({
      deploymentId: deployment.id,
      nodeId,
      nodeConfig: {
        host: node.host,
        port: node.port,
        useTls: node.useTls,
      },
      synchronizerId: node.synchronizerId || undefined,
      darFileKey: version.darFileKey,
      darFileHash: version.darFileHash,
      packageIds: version.packages.map((p) => p.packageId),
      versionId,
    });

    return NextResponse.json({ data: deployment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/deployments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
