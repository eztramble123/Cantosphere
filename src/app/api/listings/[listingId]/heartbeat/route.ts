import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { heartbeat } from "@/lib/listing";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { listingId } = await params;
    const listing = await heartbeat(listingId, session.user.id);

    return NextResponse.json({ data: { providerHeartbeat: listing.providerHeartbeat } });
  } catch (error) {
    console.error("POST /api/listings/[listingId]/heartbeat error:", error);

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
