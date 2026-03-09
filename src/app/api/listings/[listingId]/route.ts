import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateListingSchema } from "@/lib/validators";
import { updateListing, suspendListing } from "@/lib/listing";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const { listingId } = await params;

    const listing = await db.appListing.findUnique({
      where: { id: listingId },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            description: true,
            longDescription: true,
            categories: { include: { category: true } },
            tags: { include: { tag: true } },
            _count: { select: { reviews: true, installations: true } },
          },
        },
        provider: {
          select: { id: true, name: true, username: true, image: true },
        },
        _count: {
          select: { licenses: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json({ data: listing });
  } catch (error) {
    console.error("GET /api/listings/[listingId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listingId } = await params;
    const body = await req.json();
    const parsed = updateListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const listing = await updateListing(listingId, session.user.id, parsed.data as never);
    return NextResponse.json({ data: listing });
  } catch (error) {
    console.error("PUT /api/listings/[listingId] error:", error);

    if (error instanceof Error) {
      if (error.message === "Listing not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listingId } = await params;
    const isAdmin = session.user.role === "ADMIN";

    await suspendListing(listingId, session.user.id, isAdmin);
    return NextResponse.json({ data: { message: "Listing suspended" } });
  } catch (error) {
    console.error("DELETE /api/listings/[listingId] error:", error);

    if (error instanceof Error) {
      if (error.message === "Listing not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
