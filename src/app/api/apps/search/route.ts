import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { z } from "zod";

const searchQuerySchema = paginationSchema.extend({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(["newest", "oldest", "name", "popular", "rating"]).default("newest"),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = searchQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, page, pageSize, category, tag, sort } = parsed.data;

    const where: Record<string, unknown> = {
      status: "PUBLISHED",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { longDescription: { contains: q, mode: "insensitive" } },
        {
          tags: {
            some: { tag: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ],
    };

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      };
    }

    if (tag) {
      where.tags = {
        ...((where.tags as object) || {}),
        some: { tag: { slug: tag } },
      };
    }

    const [apps, total] = await Promise.all([
      db.app.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy:
          sort === "popular"
            ? { installations: { _count: "desc" as const } }
            : sort === "rating"
              ? { reviews: { _count: "desc" as const } }
              : sort === "oldest"
                ? { createdAt: "asc" as const }
                : sort === "name"
                  ? { name: "asc" as const }
                  : { createdAt: "desc" as const },
        include: {
          developer: {
            select: { id: true, name: true, username: true, image: true },
          },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
          versions: {
            where: { isLatest: true },
            select: { id: true, version: true, createdAt: true },
            take: 1,
          },
          _count: {
            select: { reviews: true, installations: true },
          },
        },
      }),
      db.app.count({ where }),
    ]);

    return NextResponse.json({
      data: apps,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/apps/search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
