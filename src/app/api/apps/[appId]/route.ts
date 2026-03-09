import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateAppSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const app = await db.app.findUnique({
      where: { id: appId },
      include: {
        developer: {
          select: { id: true, name: true, username: true, image: true, bio: true },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        versions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            version: true,
            changelog: true,
            darFileSize: true,
            sdkVersion: true,
            isLatest: true,
            createdAt: true,
          },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true },
            },
          },
        },
        listing: {
          select: {
            id: true,
            pricingModel: true,
            priceAmount: true,
            priceCurrency: true,
            listingStatus: true,
          },
        },
        _count: {
          select: { reviews: true, installations: true },
        },
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    // Only allow public access to published apps, or owner/admin access to all statuses
    if (app.status !== "PUBLISHED") {
      const session = await auth();
      if (
        !session?.user ||
        (session.user.id !== app.developerId && session.user.role !== "ADMIN")
      ) {
        return NextResponse.json({ error: "App not found" }, { status: 404 });
      }
    }

    // Compute average rating
    const ratingAgg = await db.review.aggregate({
      where: { appId },
      _avg: { rating: true },
    });

    return NextResponse.json({
      data: {
        ...app,
        averageRating: ratingAgg._avg.rating || null,
      },
    });
  } catch (error) {
    console.error("GET /api/apps/[appId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { appId } = await params;

    const existingApp = await db.app.findUnique({
      where: { id: appId },
      select: { developerId: true },
    });
    if (!existingApp) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    if (existingApp.developerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateAppSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryIds, tags, ...updateData } = parsed.data;

    // Update app, categories, and tags
    await db.app.update({
      where: { id: appId },
      data: {
        ...updateData,
        repoUrl: updateData.repoUrl || null,
        websiteUrl: updateData.websiteUrl || null,
      },
    });

    // Update categories if provided
    if (categoryIds !== undefined) {
      await db.appCategory.deleteMany({ where: { appId } });
      if (categoryIds.length > 0) {
        await db.appCategory.createMany({
          data: categoryIds.map((categoryId) => ({ appId, categoryId })),
        });
      }
    }

    // Update tags if provided
    if (tags !== undefined) {
      await db.appTag.deleteMany({ where: { appId } });
      for (const tagName of tags) {
        const tag = await db.tag.upsert({
          where: { name: tagName },
          update: {},
          create: {
            name: tagName,
            slug: tagName.toLowerCase().replace(/\s+/g, "-"),
          },
        });
        await db.appTag.create({ data: { appId, tagId: tag.id } });
      }
    }

    // Fetch the updated app with relations
    const app = await db.app.findUnique({
      where: { id: appId },
      include: {
        developer: {
          select: { id: true, name: true, username: true, image: true },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ data: app });
  } catch (error) {
    console.error("PUT /api/apps/[appId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
