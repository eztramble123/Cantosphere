import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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
      select: {
        id: true,
        status: true,
        statusMessage: true,
        deploymentId: true,
        requestedAt: true,
        completedAt: true,
        requesterId: true,
        listing: { select: { providerId: true } },
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

    // If provisioning, include deployment status and steps
    let deployment = null;
    if (request.deploymentId) {
      deployment = await db.deployment.findUnique({
        where: { id: request.deploymentId },
        include: {
          steps: {
            orderBy: { step: "asc" },
          },
        },
      });
    }

    return NextResponse.json({
      data: {
        id: request.id,
        status: request.status,
        statusMessage: request.statusMessage,
        requestedAt: request.requestedAt,
        completedAt: request.completedAt,
        deployment,
      },
    });
  } catch (error) {
    console.error("GET /api/install-requests/[requestId]/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
