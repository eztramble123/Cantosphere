import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { validateLicense } from "@/lib/licensing";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { licenseId } = await params;

    const license = await db.license.findUnique({
      where: { id: licenseId },
      select: { listingId: true, licenseeId: true },
    });

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    const result = await validateLicense(license.licenseeId, license.listingId);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/licenses/[licenseId]/validate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
