import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createListingSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { createListing } from "@/lib/listing";

export async function GET(req: NextRequest) {
  try {
    const queryParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = paginationSchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize } = parsed.data;
    const pricingModel = req.nextUrl.searchParams.get("pricingModel");

    const where = {
      listingStatus: "ACTIVE" as const,
      ...(pricingModel ? { pricingModel: pricingModel as never } : {}),
    };

    const [listings, total] = await Promise.all([
      db.appListing.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy: { createdAt: "desc" },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              description: true,
              categories: { include: { category: true } },
              _count: { select: { reviews: true } },
            },
          },
          provider: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      }),
      db.appListing.count({ where }),
    ]);

    return NextResponse.json({
      data: listings,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/listings error:", error);
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

    const body = await req.json();
    const parsed = createListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { appId, ...config } = parsed.data;

    const listing = await createListing(appId, session.user.id, {
      ...config,
      pricingModel: config.pricingModel as never,
    });

    return NextResponse.json({ data: listing }, { status: 201 });
  } catch (error) {
    console.error("POST /api/listings error:", error);

    if (error instanceof Error) {
      const status =
        error.message === "Forbidden" ? 403 :
        error.message === "App not found" ? 404 :
        error.message.includes("must be") || error.message.includes("already") ? 400 :
        500;
      if (status !== 500) {
        return NextResponse.json({ error: error.message }, { status });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
