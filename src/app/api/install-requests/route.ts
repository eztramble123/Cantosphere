import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createInstallRequestSchema, paginationSchema } from "@/lib/validators";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import { validateLicense, acquireLicense } from "@/lib/licensing";
import { startDeployment } from "@/lib/canton/deploy-orchestrator";
import { checkDuplicateDeployment } from "@/lib/canton/deployment-guard";
import { apiLimiter } from "@/lib/rate-limit";
import { isMockMode } from "@/lib/canton/service-factory";
import { createContractServices } from "@/lib/canton/contracts";
import { resolvePartyId } from "@/lib/canton/party-resolution";

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
    const statusFilter = req.nextUrl.searchParams.get("status");

    // Validators see their own requests; developers see requests for their apps
    const where = {
      OR: [
        { requesterId: session.user.id },
        { listing: { providerId: session.user.id } },
      ],
      ...(statusFilter ? { status: statusFilter as never } : {}),
    };

    const [requests, total] = await Promise.all([
      db.installRequest.findMany({
        where,
        ...paginate(page, pageSize),
        orderBy: { requestedAt: "desc" },
        include: {
          listing: {
            include: {
              app: {
                select: { id: true, name: true, slug: true, icon: true },
              },
            },
          },
          requester: {
            select: { id: true, name: true, username: true, image: true },
          },
          node: {
            select: { id: true, name: true },
          },
          version: {
            select: { id: true, version: true },
          },
        },
      }),
      db.installRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: requests,
      pagination: paginationMeta(total, page, pageSize),
    });
  } catch (error) {
    console.error("GET /api/install-requests error:", error);
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
    const parsed = createInstallRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { listingId, nodeId, versionId } = parsed.data;

    // Validate listing is active
    const listing = await db.appListing.findUnique({
      where: { id: listingId },
    });
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (listing.listingStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Listing is not active" }, { status: 400 });
    }

    // Validate node belongs to user
    const node = await db.validatorNode.findUnique({
      where: { id: nodeId },
    });
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    if (node.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate version exists and belongs to the listing's app
    const version = await db.appVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.appId !== listing.appId) {
      return NextResponse.json({ error: "Version not found for this listing" }, { status: 404 });
    }

    // Check for duplicate active request
    const existingRequest = await db.installRequest.findFirst({
      where: {
        listingId,
        nodeId,
        versionId,
        status: { in: ["PENDING", "PROVISIONING"] },
      },
    });
    if (existingRequest) {
      return NextResponse.json(
        { error: "An active install request already exists for this listing, node, and version" },
        { status: 409 }
      );
    }

    // For paid apps, validate license exists
    let licenseId: string | null = null;
    if (listing.pricingModel !== "FREE") {
      const licenseCheck = await validateLicense(session.user.id, listingId);
      if (!licenseCheck.valid) {
        return NextResponse.json(
          { error: `Valid license required: ${licenseCheck.reason}` },
          { status: 402 }
        );
      }
      const license = await db.license.findUnique({
        where: { listingId_licenseeId: { listingId, licenseeId: session.user.id } },
      });
      licenseId = license?.id ?? null;
    } else {
      // For FREE apps, auto-create license if needed
      const existingLicense = await db.license.findUnique({
        where: { listingId_licenseeId: { listingId, licenseeId: session.user.id } },
      });
      if (!existingLicense || existingLicense.status !== "ACTIVE") {
        const newLicense = await acquireLicense(listingId, session.user.id);
        licenseId = newLicense.id;
      } else {
        licenseId = existingLicense.id;
      }
    }

    const installRequest = await db.installRequest.create({
      data: {
        listingId,
        requesterId: session.user.id,
        nodeId,
        versionId,
        status: "PENDING",
        licenseId,
      },
      include: {
        listing: {
          include: {
            app: {
              select: { id: true, name: true, slug: true, icon: true },
            },
          },
        },
        node: { select: { id: true, name: true } },
        version: { select: { id: true, version: true } },
      },
    });

    // Exercise RequestInstall on-chain if listing has a contract
    if (!isMockMode() && listing.onChainContractId) {
      try {
        const contracts = createContractServices();
        const requesterParty = await resolvePartyId(session.user.id);
        await contracts.installs.requestInstallOnChain(
          listing.onChainContractId,
          installRequest.id,
          {
            requesterParty,
            nodeId,
            versionId,
          }
        );
      } catch (error) {
        console.error("[Canton] Failed to create on-chain install request:", error);
      }
    }

    // Auto-approve FREE active listings — no developer approval needed
    if (listing.pricingModel === "FREE" && listing.listingStatus === "ACTIVE") {
      // Re-fetch version with packages for deployment context
      const versionWithPackages = await db.appVersion.findUnique({
        where: { id: versionId },
        include: { packages: { select: { packageId: true } } },
      });

      if (versionWithPackages) {
        // Check + create atomically to prevent race conditions
        const { deployment, isDuplicate } = await db.$transaction(async (tx) => {
          const existing = await checkDuplicateDeployment(nodeId, versionId, tx);
          if (existing) return { deployment: existing, isDuplicate: true };
          const created = await tx.deployment.create({
            data: {
              nodeId,
              versionId,
              status: "PENDING",
            },
          });
          return { deployment: created, isDuplicate: false };
        });

        const updated = await db.installRequest.update({
          where: { id: installRequest.id },
          data: {
            status: "PROVISIONING",
            deploymentId: deployment.id,
          },
          include: {
            listing: {
              include: {
                app: {
                  select: { id: true, name: true, slug: true, icon: true },
                },
              },
            },
            node: { select: { id: true, name: true } },
            version: { select: { id: true, version: true } },
          },
        });

        if (!isDuplicate) {
          await startDeployment({
            deploymentId: deployment.id,
            nodeId,
            nodeConfig: {
              host: node.host,
              port: node.port,
              useTls: node.useTls,
            },
            synchronizerId: node.synchronizerId || undefined,
            darFileKey: versionWithPackages.darFileKey,
            darFileHash: versionWithPackages.darFileHash,
            packageIds: versionWithPackages.packages.map((p) => p.packageId),
            versionId,
            installRequestId: installRequest.id,
          });
        }

        return NextResponse.json({ data: updated }, { status: 201 });
      }
    }

    return NextResponse.json({ data: installRequest }, { status: 201 });
  } catch (error) {
    console.error("POST /api/install-requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
