import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkNodeHealth } from "@/lib/canton/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;

    const node = await db.validatorNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isHealthy = await checkNodeHealth({
      host: node.host,
      port: node.port,
      useTls: node.useTls,
    });

    const healthStatus = isHealthy ? "HEALTHY" : "UNREACHABLE";

    // Update the node's health status in the database
    await db.validatorNode.update({
      where: { id: nodeId },
      data: {
        healthStatus,
        lastHealthCheck: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        nodeId,
        status: healthStatus,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/nodes/[nodeId]/health error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
