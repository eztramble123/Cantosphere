import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acquireLicenseSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { acquireLicense } from "@/lib/licensing";
import { apiLimiter } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queryParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = paginationSchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, pageSize } = parsed.data;

    const where = { licenseeId: session.user.id };

    const [licenses, total] = await Promise.all([
      db.license.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy: { grantedAt: "desc" },
        include: {
          listing: {
            include: {
              app: {
                select: { id: true, name: true, slug: true, icon: true },
              },
            },
          },
        },
      }),
      db.license.count({ where }),
    ]);

    return NextResponse.json({
      data: licenses,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/licenses error:", error);
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

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = acquireLicenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const license = await acquireLicense(parsed.data.listingId, session.user.id);
    return NextResponse.json({ data: license }, { status: 201 });
  } catch (error) {
    console.error("POST /api/licenses error:", error);

    if (error instanceof Error) {
      const status =
        error.message === "Listing not found" ? 404 :
        error.message === "Listing is not active" ||
        error.message === "Already licensed" ||
        error.message === "Use purchaseWithCC for ONE_TIME paid listings" ? 400 :
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
