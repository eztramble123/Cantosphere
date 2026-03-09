import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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
          select: { id: true, name: true, ownerId: true },
        },
        steps: {
          orderBy: { step: "asc" },
          select: {
            step: true,
            status: true,
            message: true,
            startedAt: true,
            completedAt: true,
          },
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

    return NextResponse.json({
      data: {
        deploymentId: deployment.id,
        status: deployment.status,
        errorMessage: deployment.errorMessage,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
        steps: deployment.steps,
      },
    });
  } catch (error) {
    console.error("GET /api/deployments/[id]/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
