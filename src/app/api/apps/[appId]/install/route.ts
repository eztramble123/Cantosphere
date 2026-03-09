import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createPackageService } from "@/lib/canton/service-factory";
import { apiLimiter } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { appId } = await params;

    // Verify app exists
    const app = await db.app.findUnique({
      where: { id: appId },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Accept optional versionId and nodeId from body
    let versionId: string | undefined;
    let nodeId: string | undefined;
    try {
      const body = await req.json();
      versionId = body.versionId;
      nodeId = body.nodeId;
    } catch {
      // No body or invalid JSON — that's fine
    }

    // Idempotent upsert — safe to call multiple times
    const installation = await db.installation.upsert({
      where: {
        userId_appId: {
          userId: session.user.id,
          appId,
        },
      },
      create: {
        userId: session.user.id,
        appId,
        ...(versionId && { versionId }),
        ...(nodeId && { nodeId }),
      },
      update: {
        ...(versionId && { versionId }),
        ...(nodeId && { nodeId }),
      },
    });

    return NextResponse.json({ data: installation });
  } catch (error) {
    console.error("POST /api/apps/[appId]/install error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { appId } = await params;

    // Verify installation exists
    const installation = await db.installation.findUnique({
      where: {
        userId_appId: { userId: session.user.id, appId },
      },
    });
    if (!installation) {
      return NextResponse.json({ error: "Not installed" }, { status: 404 });
    }

    // Find latest COMPLETED deployment on user's nodes for this app
    const deployment = await db.deployment.findFirst({
      where: {
        node: { ownerId: session.user.id },
        version: { appId },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      include: {
        node: { select: { id: true, host: true, port: true, useTls: true } },
        version: { select: { darFileHash: true } },
      },
    });

    let unvetWarning: string | undefined;
    if (deployment) {
      try {
        const packageService = createPackageService({
          host: deployment.node.host,
          port: deployment.node.port,
          useTls: deployment.node.useTls,
        });
        await packageService.unvetDar(deployment.version.darFileHash);
      } catch (err) {
        console.error("Failed to unvet DAR during uninstall:", err);
        unvetWarning = "DAR unvet failed — packages may still be active on the node";
      }

      // Mark the deployment as removed
      await db.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          errorMessage: "Uninstalled by user",
          completedAt: new Date(),
        },
      });
    }

    // Delete the installation record
    await db.installation.delete({
      where: { id: installation.id },
    });

    return NextResponse.json({
      data: { success: true, warning: unvetWarning },
    });
  } catch (error) {
    console.error("DELETE /api/apps/[appId]/install error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
