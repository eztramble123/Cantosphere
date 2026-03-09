import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createAppSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { generateSlug } from "@/lib/utils/slug";
import { apiLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const listQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]).optional(),
  sort: z.enum(["newest", "oldest", "name", "popular", "rating"]).default("newest"),
  developerId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize, category, status, sort, developerId } = parsed.data;

    const where: Record<string, unknown> = {
      status: status || "PUBLISHED",
    };

    if (category) {
      where.categories = {
        some: { category: { slug: category } },
      };
    }

    if (developerId) {
      where.developerId = developerId;
    }

    let orderBy: Record<string, unknown> = {};
    switch (sort) {
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
      case "popular":
        orderBy = { installations: { _count: "desc" } };
        break;
      case "rating":
        orderBy = { reviews: { _count: "desc" } };
        break;
    }

    const [apps, total] = await Promise.all([
      db.app.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy,
        include: {
          developer: {
            select: { id: true, name: true, username: true, image: true },
          },
          categories: {
            include: { category: true },
          },
          tags: {
            include: { tag: true },
          },
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
    console.error("GET /api/apps error:", error);
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
    if (session.user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = createAppSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, longDescription, license, repoUrl, websiteUrl, categoryIds, tags } =
      parsed.data;

    const slug = generateSlug(name);

    const app = await db.app.create({
      data: {
        name,
        slug,
        description,
        longDescription,
        license,
        repoUrl: repoUrl || null,
        websiteUrl: websiteUrl || null,
        developerId: session.user.id,
        categories: categoryIds?.length
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
        tags: tags?.length
          ? {
              create: await Promise.all(
                tags.map(async (tagName) => {
                  const tag = await db.tag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: {
                      name: tagName,
                      slug: tagName.toLowerCase().replace(/\s+/g, "-"),
                    },
                  });
                  return { tagId: tag.id };
                })
              ),
            }
          : undefined,
      },
      include: {
        developer: {
          select: { id: true, name: true, username: true, image: true },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ data: app }, { status: 201 });
  } catch (error) {
    console.error("POST /api/apps error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
