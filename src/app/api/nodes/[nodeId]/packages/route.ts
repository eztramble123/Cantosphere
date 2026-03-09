import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PackageService } from "@/lib/canton/package-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { nodeId } = await params;

    const node = await db.validatorNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const packageService = new PackageService({
      host: node.host,
      port: node.port,
      useTls: node.useTls,
    });

    const packages = await packageService.listPackages();

    return NextResponse.json({
      data: packages.packageDescriptions || [],
    });
  } catch (error) {
    console.error("GET /api/nodes/[nodeId]/packages error:", error);

    // Handle connection errors gracefully
    if (error instanceof Error && error.name === "ConnectionError") {
      return NextResponse.json(
        { error: "Unable to connect to node", details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
