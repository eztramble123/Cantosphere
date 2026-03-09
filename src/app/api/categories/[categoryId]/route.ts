import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateCategorySchema } from "@/lib/validators";
import { apiLimiter } from "@/lib/rate-limit";
import slugifyLib from "slugify";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryId } = await params;
    const data: Record<string, unknown> = { ...parsed.data };

    if (parsed.data.name) {
      const slug = slugifyLib(parsed.data.name, { lower: true, strict: true });
      data.slug = slug;

      const existing = await db.category.findFirst({
        where: {
          OR: [{ name: parsed.data.name }, { slug }],
          NOT: { id: categoryId },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updated = await db.category.update({
      where: { id: categoryId },
      data,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PUT /api/categories/[categoryId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { categoryId } = await params;

    const appCount = await db.appCategory.count({
      where: { categoryId },
    });
    if (appCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with linked apps" },
        { status: 409 }
      );
    }

    await db.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/categories/[categoryId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
