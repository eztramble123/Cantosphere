import { db } from "@/lib/db";
import { isMockMode } from "@/lib/canton/service-factory";
import { createContractServices } from "@/lib/canton/contracts";
import { resolvePartyId } from "@/lib/canton/party-resolution";

/**
 * Acquire a license for a listing.
 * FREE apps get auto-granted. ONE_TIME paid apps must use purchaseWithCC() instead.
 */
export async function acquireLicense(listingId: string, userId: string) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) throw new Error("Listing not found");
  if (listing.listingStatus !== "ACTIVE") throw new Error("Listing is not active");
  if (listing.pricingModel === "ONE_TIME") {
    throw new Error("Use purchaseWithCC for ONE_TIME paid listings");
  }

  // Check for existing active license
  const existing = await db.license.findUnique({
    where: { listingId_licenseeId: { listingId, licenseeId: userId } },
  });
  if (existing && existing.status === "ACTIVE") {
    throw new Error("Already licensed");
  }

  // For subscriptions, compute next renewal
  let expiresAt: Date | null = null;
  let nextRenewalAt: Date | null = null;
  if (listing.pricingModel === "SUBSCRIPTION" && listing.billingPeriodDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + listing.billingPeriodDays);
    nextRenewalAt = expiresAt;
  }

  if (existing) {
    // Reactivate a previously revoked/expired license
    return db.license.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        pricingModel: listing.pricingModel,
        grantedAt: new Date(),
        expiresAt,
        nextRenewalAt,
        usageCount: 0,
      },
      include: {
        listing: {
          include: { app: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  }

  const license = await db.license.create({
    data: {
      listingId,
      licenseeId: userId,
      pricingModel: listing.pricingModel,
      status: "ACTIVE",
      expiresAt,
      nextRenewalAt,
      amountPaid: listing.priceAmount,
    },
    include: {
      listing: {
        include: { app: { select: { id: true, name: true, slug: true } } },
      },
    },
  });

  // Create on-chain license contract (non-blocking, best-effort)
  if (!isMockMode() && listing.onChainContractId) {
    try {
      const contracts = createContractServices();
      const providerParty = await resolvePartyId(listing.providerId);
      const licenseeParty = await resolvePartyId(userId);
      await contracts.licenses.grantLicenseOnChain(license.id, {
        providerParty,
        licenseeParty,
        listingContractId: listing.onChainContractId,
        appName: license.listing.app.name,
        pricingModel: listing.pricingModel,
        priceAmount: listing.priceAmount?.toString(),
        priceCurrency: listing.priceCurrency,
        billingPeriodDays: listing.billingPeriodDays,
        usageRate: listing.usageRate?.toString(),
        expiresAt,
      });
    } catch (error) {
      console.error("[Canton] Failed to create on-chain license:", error);
    }
  }

  return license;
}

/**
 * Validate whether a user has an active, non-expired license for a listing.
 */
export async function validateLicense(
  userId: string,
  listingId: string
): Promise<{ valid: boolean; reason?: string }> {
  const license = await db.license.findUnique({
    where: { listingId_licenseeId: { listingId, licenseeId: userId } },
  });

  if (!license) return { valid: false, reason: "No license found" };
  if (license.status !== "ACTIVE") return { valid: false, reason: `License is ${license.status.toLowerCase()}` };
  if (license.expiresAt && license.expiresAt < new Date()) {
    return { valid: false, reason: "License expired" };
  }
  if (license.usageLimit && license.usageCount >= license.usageLimit) {
    return { valid: false, reason: "Usage limit reached" };
  }

  return { valid: true };
}

/**
 * Revoke or cancel a license.
 * The licensee can cancel their own; provider/admin can revoke.
 */
export async function revokeLicense(
  licenseId: string,
  userId: string,
  isAdmin: boolean
) {
  const license = await db.license.findUnique({
    where: { id: licenseId },
    include: { listing: { select: { providerId: true } } },
  });

  if (!license) throw new Error("License not found");

  const isLicensee = license.licenseeId === userId;
  const isProvider = license.listing.providerId === userId;
  if (!isLicensee && !isProvider && !isAdmin) {
    throw new Error("Forbidden");
  }

  // Revoke or cancel on-chain
  if (!isMockMode() && license.onChainContractId) {
    try {
      const contracts = createContractServices();
      if (isLicensee) {
        await contracts.licenses.cancelOnChain(license.onChainContractId);
      } else {
        await contracts.licenses.revokeOnChain(license.onChainContractId);
      }
    } catch (error) {
      console.error("[Canton] Failed to revoke/cancel on-chain license:", error);
    }
  }

  return db.license.update({
    where: { id: licenseId },
    data: { status: "REVOKED" },
  });
}
