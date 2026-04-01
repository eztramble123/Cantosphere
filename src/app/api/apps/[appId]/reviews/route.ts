import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createReviewSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { checkAppVisibility } from "@/lib/utils/app-visibility";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const queryParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = paginationSchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize } = parsed.data;

    const app = await checkAppVisibility(appId);
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where: { appId },
        ...paginate(page, pageSize),
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      }),
      db.review.count({ where: { appId } }),
    ]);

    // Compute aggregate rating
    const ratingAgg = await db.review.aggregate({
      where: { appId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return NextResponse.json({
      data: reviews,
      summary: {
        averageRating: ratingAgg._avg.rating || null,
        totalReviews: ratingAgg._count.rating,
      },
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/apps/[appId]/reviews error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appId } = await params;

    // Verify app exists and is published
    const app = await db.app.findUnique({
      where: { id: appId },
      select: { id: true, status: true, developerId: true },
    });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    if (app.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Can only review published apps" },
        { status: 400 }
      );
    }

    // Developers cannot review their own apps
    if (app.developerId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot review your own app" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for existing review (one per user per app)
    const existingReview = await db.review.findUnique({
      where: { appId_userId: { appId, userId: session.user.id } },
    });
    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this app" },
        { status: 409 }
      );
    }

    const review = await db.review.create({
      data: {
        appId,
        userId: session.user.id,
        rating: parsed.data.rating,
        title: parsed.data.title,
        body: parsed.data.body,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, image: true },
        },
      },
    });

    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    console.error("POST /api/apps/[appId]/reviews error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
