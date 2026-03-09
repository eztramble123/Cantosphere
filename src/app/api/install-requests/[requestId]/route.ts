import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { startDeployment } from "@/lib/canton/deploy-orchestrator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;

    const request = await db.installRequest.findUnique({
      where: { id: requestId },
      include: {
        listing: {
          include: {
            app: {
              select: { id: true, name: true, slug: true, icon: true },
            },
            provider: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        requester: {
          select: { id: true, name: true, username: true, image: true },
        },
        node: {
          select: { id: true, name: true, host: true, port: true },
        },
        version: {
          select: { id: true, version: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Install request not found" }, { status: 404 });
    }

    // Only requester, provider, or admin
    const isAdmin = session.user.role === "ADMIN";
    if (
      request.requesterId !== session.user.id &&
      request.listing.providerId !== session.user.id &&
      !isAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: request });
  } catch (error) {
    console.error("GET /api/install-requests/[requestId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await req.json();
    const { action } = body as { action: "approve" | "cancel" };

    const request = await db.installRequest.findUnique({
      where: { id: requestId },
      include: {
        listing: { select: { providerId: true, appId: true } },
        node: true,
        version: {
          include: {
            packages: { select: { packageId: true } },
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Install request not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot ${action} a request with status ${request.status}` },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      if (request.requesterId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const updated = await db.installRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "approve") {
      const isProvider = request.listing.providerId === session.user.id;
      const isAdmin = session.user.role === "ADMIN";
      if (!isProvider && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Create deployment via existing pipeline
      const deployment = await db.deployment.create({
        data: {
          nodeId: request.nodeId,
          versionId: request.versionId,
          status: "PENDING",
        },
      });

      // Update install request to PROVISIONING with deployment link
      const updated = await db.installRequest.update({
        where: { id: requestId },
        data: {
          status: "PROVISIONING",
          deploymentId: deployment.id,
        },
      });

      // Start deployment asynchronously
      await startDeployment({
        deploymentId: deployment.id,
        nodeId: request.nodeId,
        nodeConfig: {
          host: request.node.host,
          port: request.node.port,
          useTls: request.node.useTls,
        },
        synchronizerId: request.node.synchronizerId || undefined,
        darFileKey: request.version.darFileKey,
        darFileHash: request.version.darFileHash,
        packageIds: request.version.packages.map((p) => p.packageId),
        versionId: request.versionId,
        installRequestId: requestId,
      });

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PUT /api/install-requests/[requestId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
