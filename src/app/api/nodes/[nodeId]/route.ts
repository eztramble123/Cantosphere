import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateNodeSchema } from "@/lib/validators";

async function getOwnedNode(nodeId: string, userId: string) {
  const node = await db.validatorNode.findUnique({
    where: { id: nodeId },
  });
  if (!node) return { error: "Node not found", status: 404, node: null };
  if (node.ownerId !== userId) return { error: "Forbidden", status: 403, node: null };
  return { error: null, status: 200, node };
}

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
    const { error, status, node } = await getOwnedNode(nodeId, session.user.id);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const nodeWithRelations = await db.validatorNode.findUnique({
      where: { id: nodeId },
      include: {
        deployments: {
          orderBy: { startedAt: "desc" },
          take: 10,
          include: {
            version: {
              select: {
                id: true,
                version: true,
                app: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
        _count: { select: { deployments: true } },
      },
    });

    return NextResponse.json({ data: nodeWithRelations });
  } catch (error) {
    console.error("GET /api/nodes/[nodeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;
    const { error, status } = await getOwnedNode(nodeId, session.user.id);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json();
    const parsed = updateNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updatedNode = await db.validatorNode.update({
      where: { id: nodeId },
      data: parsed.data,
    });

    return NextResponse.json({ data: updatedNode });
  } catch (error) {
    console.error("PUT /api/nodes/[nodeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;
    const { error, status } = await getOwnedNode(nodeId, session.user.id);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Check for active deployments
    const activeDeployments = await db.deployment.count({
      where: {
        nodeId,
        status: { in: ["PENDING", "UPLOADING", "VETTING", "VERIFYING"] },
      },
    });
    if (activeDeployments > 0) {
      return NextResponse.json(
        { error: "Cannot delete node with active deployments" },
        { status: 400 }
      );
    }

    await db.validatorNode.delete({ where: { id: nodeId } });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/nodes/[nodeId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
