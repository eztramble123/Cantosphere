import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { appId, versionId } = await params;

    const version = await db.appVersion.findFirst({
      where: { id: versionId, appId },
      include: {
        app: {
          select: { name: true, slug: true, status: true, developerId: true },
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Only published apps can be downloaded publicly; developers can download their own
    if (
      version.app.status !== "PUBLISHED" &&
      version.app.developerId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storage = getStorage();
    const darData = await storage.get(version.darFileKey);

    const filename = `${version.app.slug}-${version.version}.dar`;

    return new NextResponse(new Uint8Array(darData), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(darData.length),
      },
    });
  } catch (error) {
    console.error("GET /api/apps/[appId]/versions/[versionId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
