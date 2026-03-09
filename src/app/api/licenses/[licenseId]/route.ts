import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revokeLicense } from "@/lib/licensing";

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
      include: {
        listing: {
          include: {
            app: {
              select: { id: true, name: true, slug: true, icon: true },
            },
            provider: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    });

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    // Only the licensee, provider, or admin can view
    const isAdmin = session.user.role === "ADMIN";
    if (
      license.licenseeId !== session.user.id &&
      license.listing.providerId !== session.user.id &&
      !isAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: license });
  } catch (error) {
    console.error("GET /api/licenses/[licenseId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ licenseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { licenseId } = await params;
    const isAdmin = session.user.role === "ADMIN";

    const license = await revokeLicense(licenseId, session.user.id, isAdmin);
    return NextResponse.json({ data: license });
  } catch (error) {
    console.error("DELETE /api/licenses/[licenseId] error:", error);

    if (error instanceof Error) {
      if (error.message === "License not found") {
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
