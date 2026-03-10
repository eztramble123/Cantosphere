import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isMockMode } from "@/lib/canton/service-factory";
import { createContractServices } from "@/lib/canton/contracts";
import { resolvePartyId } from "@/lib/canton/party-resolution";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isMockMode()) {
      return NextResponse.json({
        data: { balance: "1000.00", coins: [] },
      });
    }

    const contracts = createContractServices();
    const party = await resolvePartyId(session.user.id);
    const { total, coins } = await contracts.payments.getBalance(party);

    return NextResponse.json({
      data: {
        balance: total,
        coins: coins.map((c) => ({
          contractId: c.contractId,
          amount: c.payload.amount,
          currency: c.payload.currency,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/wallet/balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
