import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createPackageService } from "@/lib/canton/service-factory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deployment = await db.deployment.findUnique({
      where: { id },
      include: {
        node: {
          select: { id: true, name: true, host: true, port: true, ownerId: true },
        },
        version: {
          select: {
            id: true,
            version: true,
            darFileHash: true,
            sdkVersion: true,
            app: { select: { id: true, name: true, slug: true, icon: true } },
          },
        },
        steps: {
          orderBy: { step: "asc" },
        },
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Only the node owner can view their deployments
    if (deployment.node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: deployment });
  } catch (error) {
    console.error("GET /api/deployments/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deployment = await db.deployment.findUnique({
      where: { id },
      include: {
        node: {
          select: {
            id: true,
            ownerId: true,
            host: true,
            port: true,
            useTls: true,
          },
        },
        version: {
          select: { darFileHash: true },
        },
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    if (deployment.node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only completed deployments can be undeployed
    if (deployment.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only undeploy completed deployments" },
        { status: 400 }
      );
    }

    // Unvet the DAR on the node
    const packageService = createPackageService({
      host: deployment.node.host,
      port: deployment.node.port,
      useTls: deployment.node.useTls,
    });

    try {
      await packageService.unvetDar(deployment.version.darFileHash);
    } catch (error) {
      console.error("Failed to unvet DAR on node:", error);
      return NextResponse.json(
        {
          error: "Failed to unvet DAR on node",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    // Update deployment status to indicate removal
    await db.deployment.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage: "Undeployed by user",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: { success: true, message: "Deployment removed" },
    });
  } catch (error) {
    console.error("DELETE /api/deployments/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
