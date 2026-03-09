import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createVersionSchema } from "@/lib/validators";
import { parseDar, computeDarHash } from "@/lib/canton/dar-parser";
import { getStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import { apiLimiter } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const app = await db.app.findUnique({
      where: { id: appId },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const versions = await db.appVersion.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      include: {
        packages: {
          select: {
            id: true,
            packageId: true,
            packageName: true,
            lfVersion: true,
          },
        },
      },
    });

    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error("GET /api/apps/[appId]/versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = apiLimiter(session.user.id);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { appId } = await params;

    // Verify the app exists and belongs to this developer
    const app = await db.app.findUnique({
      where: { id: appId },
      select: { id: true, developerId: true },
    });
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    if (app.developerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const version = formData.get("version") as string;
    const changelog = formData.get("changelog") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "DAR file is required" },
        { status: 400 }
      );
    }

    // Validate version and changelog fields
    const parsed = createVersionSchema.safeParse({
      version,
      changelog: changelog || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check for duplicate version number
    const existingVersion = await db.appVersion.findUnique({
      where: { appId_version: { appId, version: parsed.data.version } },
    });
    if (existingVersion) {
      return NextResponse.json(
        { error: "Version already exists" },
        { status: 409 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse DAR metadata
    const darMetadata = await parseDar(buffer);
    const darFileHash = computeDarHash(buffer);

    // Store the DAR file
    const darFileKey = `dars/${appId}/${nanoid()}.dar`;
    const storage = getStorage();
    await storage.save(darFileKey, buffer);

    // Create version and package records in a transaction
    const newVersion = await db.$transaction(async (tx) => {
      // Mark all existing versions as not latest
      await tx.appVersion.updateMany({
        where: { appId, isLatest: true },
        data: { isLatest: false },
      });

      // Create the new version
      const created = await tx.appVersion.create({
        data: {
          appId,
          version: parsed.data.version,
          changelog: parsed.data.changelog,
          darFileKey,
          darFileHash,
          darFileSize: buffer.length,
          mainPackageId: darMetadata.mainPackageId,
          sdkVersion: darMetadata.sdkVersion,
          isLatest: true,
          packages: {
            create: darMetadata.packages.map((pkg) => ({
              packageId: pkg.packageId,
              packageName: pkg.packageName,
              lfVersion: pkg.lfVersion,
            })),
          },
        },
        include: {
          packages: true,
        },
      });

      return created;
    });

    // Sync listing darHash if one exists
    const listing = await db.appListing.findUnique({
      where: { appId },
    });
    if (listing) {
      await db.appListing.update({
        where: { id: listing.id },
        data: { darHash: darFileHash },
      });
    }

    return NextResponse.json({ data: newVersion }, { status: 201 });
  } catch (error) {
    console.error("POST /api/apps/[appId]/versions error:", error);

    // Handle DAR parsing errors specifically
    if (error instanceof Error && error.message.includes("DAR")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
