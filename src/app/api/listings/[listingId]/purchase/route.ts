import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purchaseWithCC } from "@/lib/payment";
import { apiLimiter } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { listingId } = await params;
    const license = await purchaseWithCC(listingId, session.user.id);

    return NextResponse.json(
      { data: license, txRef: license.paymentRef },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/listings/[listingId]/purchase error:", error);

    if (error instanceof Error) {
      if ((error as Error & { code?: string }).code === "INSUFFICIENT_BALANCE") {
        return NextResponse.json({ error: error.message }, { status: 402 });
      }
      const status =
        error.message === "Listing not found" ? 404 :
        error.message === "Listing is not active" ||
        error.message === "Already licensed" ||
        error.message === "Only ONE_TIME listings can be purchased with CC" ? 400 :
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
