import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNodeSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nodes = await db.validatorNode.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { deployments: true },
        },
      },
    });

    return NextResponse.json({ data: nodes });
  } catch (error) {
    console.error("GET /api/nodes error:", error);
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

    const body = await req.json();
    const parsed = createNodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, host, port, useTls, participantId, synchronizerId } = parsed.data;

    // Check for duplicate node name for this user
    const existing = await db.validatorNode.findUnique({
      where: { ownerId_name: { ownerId: session.user.id, name } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A node with this name already exists" },
        { status: 409 }
      );
    }

    const node = await db.validatorNode.create({
      data: {
        ownerId: session.user.id,
        name,
        host,
        port,
        useTls,
        participantId,
        synchronizerId,
      },
    });

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (error) {
    console.error("POST /api/nodes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
