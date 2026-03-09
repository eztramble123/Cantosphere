import { db } from "@/lib/db";
import type { PricingModel, ListingStatus } from "@prisma/client";

interface CreateListingInput {
  pricingModel: PricingModel;
  priceAmount?: number;
  priceCurrency?: string;
  billingPeriodDays?: number;
  usageUnit?: string;
  usageRate?: number;
  supportEmail?: string;
  supportUrl?: string;
}

interface UpdateListingInput {
  pricingModel?: PricingModel;
  priceAmount?: number;
  priceCurrency?: string;
  billingPeriodDays?: number;
  usageUnit?: string;
  usageRate?: number;
  supportEmail?: string;
  supportUrl?: string;
  listingStatus?: ListingStatus;
}

/**
 * Create a marketplace listing for an app.
 * The app must be PUBLISHED and have at least one version.
 */
export async function createListing(
  appId: string,
  userId: string,
  config: CreateListingInput
) {
  const app = await db.app.findUnique({
    where: { id: appId },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      listing: { select: { id: true } },
    },
  });

  if (!app) throw new Error("App not found");
  if (app.developerId !== userId) throw new Error("Forbidden");
  if (app.status !== "PUBLISHED") throw new Error("App must be published");
  if (app.versions.length === 0) throw new Error("App must have at least one version");
  if (app.listing) throw new Error("App already has a listing");

  const latestVersion = app.versions[0];

  return db.appListing.create({
    data: {
      appId,
      providerId: userId,
      pricingModel: config.pricingModel,
      priceAmount: config.priceAmount,
      priceCurrency: config.priceCurrency || "USD",
      billingPeriodDays: config.billingPeriodDays,
      usageUnit: config.usageUnit,
      usageRate: config.usageRate,
      supportEmail: config.supportEmail || null,
      supportUrl: config.supportUrl || null,
      darHash: latestVersion.darFileHash,
      listingStatus: config.pricingModel === "FREE" ? "ACTIVE" : "PENDING",
    },
    include: {
      app: {
        select: { id: true, name: true, slug: true, icon: true },
      },
    },
  });
}

/**
 * Update a listing's pricing, support info, or status.
 */
export async function updateListing(
  listingId: string,
  userId: string,
  updates: UpdateListingInput
) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
    select: { providerId: true },
  });

  if (!listing) throw new Error("Listing not found");
  if (listing.providerId !== userId) throw new Error("Forbidden");

  return db.appListing.update({
    where: { id: listingId },
    data: {
      ...updates,
      supportEmail: updates.supportEmail === "" ? null : updates.supportEmail,
      supportUrl: updates.supportUrl === "" ? null : updates.supportUrl,
    },
    include: {
      app: {
        select: { id: true, name: true, slug: true, icon: true },
      },
    },
  });
}

/**
 * Sync the listing's darHash from the app's latest version.
 */
export async function syncDarHash(listingId: string) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
    select: { appId: true },
  });
  if (!listing) throw new Error("Listing not found");

  const latestVersion = await db.appVersion.findFirst({
    where: { appId: listing.appId, isLatest: true },
    select: { darFileHash: true },
  });
  if (!latestVersion) throw new Error("No version found");

  return db.appListing.update({
    where: { id: listingId },
    data: { darHash: latestVersion.darFileHash },
  });
}

/**
 * Update the provider heartbeat timestamp.
 */
export async function heartbeat(listingId: string, userId: string) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
    select: { providerId: true },
  });
  if (!listing) throw new Error("Listing not found");
  if (listing.providerId !== userId) throw new Error("Forbidden");

  return db.appListing.update({
    where: { id: listingId },
    data: { providerHeartbeat: new Date() },
  });
}

/**
 * Suspend a listing (provider or admin).
 */
export async function suspendListing(listingId: string, userId: string, isAdmin: boolean) {
  const listing = await db.appListing.findUnique({
    where: { id: listingId },
    select: { providerId: true },
  });
  if (!listing) throw new Error("Listing not found");
  if (listing.providerId !== userId && !isAdmin) throw new Error("Forbidden");

  return db.appListing.update({
    where: { id: listingId },
    data: { listingStatus: "SUSPENDED" },
  });
}
