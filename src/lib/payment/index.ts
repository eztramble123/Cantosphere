import { db } from "@/lib/db";
import { isMockMode } from "@/lib/canton/service-factory";
import { createContractServices } from "@/lib/canton/contracts";
import { resolvePartyId } from "@/lib/canton/party-resolution";
import { acquireLicense } from "@/lib/licensing";

/**
 * Purchase a ONE_TIME listing with Canton Coin (CC).
 *
 * In mock mode, falls back to direct license creation via acquireLicense().
 * In non-mock mode, exercises the Purchase choice on-chain for atomic payment.
 */
export async function purchaseWithCC(listingId: string, userId: string) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
    include: { app: { select: { id: true, name: true, slug: true } } },
  });

  if (!listing) throw new Error("Listing not found");
  if (listing.listingStatus !== "ACTIVE") throw new Error("Listing is not active");
  if (listing.pricingModel !== "ONE_TIME") {
    throw new Error("Only ONE_TIME listings can be purchased with CC");
  }

  // Check for existing active license
  const existing = await db.license.findUnique({
    where: { listingId_licenseeId: { listingId, licenseeId: userId } },
  });
  if (existing && existing.status === "ACTIVE") {
    throw new Error("Already licensed");
  }

  // Mock mode: fall back to direct license creation
  if (isMockMode()) {
    return acquireLicense(listingId, userId);
  }

  // ── On-chain purchase flow ────────────────────────────
  const contracts = createContractServices();
  const buyerParty = await resolvePartyId(userId);
  const providerParty = await resolvePartyId(listing.providerId);

  // Query buyer's CC balance
  const { total, coins } = await contracts.payments.getBalance(buyerParty);
  const price = parseFloat(listing.priceAmount?.toString() ?? "0");

  if (parseFloat(total) < price) {
    const err = new Error("Insufficient CC balance");
    (err as Error & { code: string }).code = "INSUFFICIENT_BALANCE";
    throw err;
  }

  // Find a single coin with sufficient balance
  const suitableCoin = coins.find(
    (c) => parseFloat(c.payload.amount) >= price
  );
  if (!suitableCoin) {
    const err = new Error("No single coin with sufficient balance. Merge coins first.");
    (err as Error & { code: string }).code = "INSUFFICIENT_BALANCE";
    throw err;
  }

  if (!listing.onChainContractId) {
    throw new Error("Listing has no on-chain contract");
  }

  // Exercise Purchase choice atomically
  const { licenseContractId } = await contracts.payments.purchaseOnChain(
    listing.onChainContractId,
    {
      buyerParty,
      coinContractId: suitableCoin.contractId,
    }
  );

  // Create Postgres license record from on-chain result
  const license = existing
    ? await db.license.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          pricingModel: listing.pricingModel,
          grantedAt: new Date(),
          amountPaid: listing.priceAmount,
          paymentRef: `cc:${licenseContractId}`,
          onChainContractId: licenseContractId,
        },
        include: {
          listing: {
            include: { app: { select: { id: true, name: true, slug: true } } },
          },
        },
      })
    : await db.license.create({
        data: {
          listingId,
          licenseeId: userId,
          pricingModel: listing.pricingModel,
          status: "ACTIVE",
          amountPaid: listing.priceAmount,
          paymentRef: `cc:${licenseContractId}`,
          onChainContractId: licenseContractId,
        },
        include: {
          listing: {
            include: { app: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

  return license;
}
