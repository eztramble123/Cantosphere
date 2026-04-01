import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { updateAppStatusSchema } from "@/lib/validators";
import { apiLimiter } from "@/lib/rate-limit";
import type { AppStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["ARCHIVED"],
  REJECTED: ["DRAFT"],
  ARCHIVED: ["DRAFT"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const parsed = updateAppStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { appId } = await params;
    const app = await db.app.findUnique({ where: { id: appId } });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const targetStatus = parsed.data.status as AppStatus;
    const allowed = VALID_TRANSITIONS[app.status as AppStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${app.status} to ${targetStatus}` },
        { status: 400 }
      );
    }

    const updated = await db.app.update({
      where: { id: appId },
      data: {
        status: targetStatus,
        rejectionReason: parsed.data.rejectionReason ?? null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/apps/[appId]/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
