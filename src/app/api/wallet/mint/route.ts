import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isMockMode } from "@/lib/canton/service-factory";
import { createContractServices } from "@/lib/canton/contracts";
import { resolvePartyId } from "@/lib/canton/party-resolution";
import { mintSchema } from "@/lib/validators";
import { apiLimiter } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin only in production, any authenticated user in dev/mock mode
    if (!isMockMode() && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = mintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (isMockMode()) {
      return NextResponse.json(
        { data: { contractId: "mock-mint-1", amount: parsed.data.amount } },
        { status: 201 }
      );
    }

    const contracts = createContractServices();
    const party = await resolvePartyId(session.user.id);
    const contractId = await contracts.payments.mintCoins(
      party,
      parsed.data.amount
    );

    return NextResponse.json(
      { data: { contractId, amount: parsed.data.amount } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/wallet/mint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
