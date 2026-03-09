import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        role: true,
        bio: true,
        company: true,
        createdAt: true,
        _count: {
          select: {
            apps: true,
            reviews: true,
            nodes: true,
            installations: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { username, ...rest } = parsed.data;

    // If username is being changed, check uniqueness
    if (username) {
      const existingUser = await db.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...rest,
        username,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        role: true,
        bio: true,
        company: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: updatedUser });
  } catch (error) {
    console.error("PUT /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
