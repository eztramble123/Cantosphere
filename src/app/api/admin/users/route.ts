import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { z } from "zod";

const usersQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(["VALIDATOR", "DEVELOPER", "ADMIN"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = usersQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, search, role } = parsed.data;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          role: true,
          createdAt: true,
          _count: {
            select: { apps: true, reviews: true, nodes: true, installations: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
