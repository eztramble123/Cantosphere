import { z } from "zod";

// ─── App Validators ───────────────────────────────────────

export const createAppSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  longDescription: z.string().max(10000).optional(),
  license: z.string().max(100).optional(),
  repoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  categoryIds: z.array(z.string()).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateAppSchema = createAppSchema.partial();

export const submitForReviewSchema = z.object({
  appId: z.string(),
});

// ─── Version Validators ───────────────────────────────────

export const createVersionSchema = z.object({
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[\w.]+)?$/,
      "Version must follow semver (e.g., 1.0.0)"
    ),
  changelog: z.string().max(5000).optional(),
});

// ─── Node Validators ─────────────────────────────────────

export const createNodeSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(5002),
  useTls: z.boolean().default(false),
  participantId: z.string().optional(),
  synchronizerId: z.string().optional(),
});

export const updateNodeSchema = createNodeSchema.partial();

// ─── Deployment Validators ────────────────────────────────

export const createDeploymentSchema = z.object({
  nodeId: z.string(),
  versionId: z.string(),
});

// ─── Review Validators ────────────────────────────────────

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
});

// ─── User Validators ─────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores")
    .optional(),
  bio: z.string().max(500).optional(),
  company: z.string().max(100).optional(),
  role: z.enum(["VALIDATOR", "DEVELOPER"]).optional(),
});

// ─── Listing Validators ──────────────────────────────────

export const createListingSchema = z.object({
  appId: z.string(),
  pricingModel: z.enum(["FREE", "ONE_TIME", "SUBSCRIPTION", "USAGE_BASED"]),
  priceAmount: z.number().min(0).optional(),
  priceCurrency: z.string().max(10).default("USD").optional(),
  billingPeriodDays: z.number().int().min(1).optional(),
  usageUnit: z.string().max(50).optional(),
  usageRate: z.number().min(0).optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  supportUrl: z.string().url().optional().or(z.literal("")),
});

export const updateListingSchema = createListingSchema.partial().omit({ appId: true });

// ─── License Validators ──────────────────────────────────

export const acquireLicenseSchema = z.object({
  listingId: z.string(),
});

// ─── Payment Validators ─────────────────────────────────

export const purchaseSchema = z.object({
  listingId: z.string(),
});

export const mintSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Must be a decimal number"),
});

// ─── Install Request Validators ──────────────────────────

export const createInstallRequestSchema = z.object({
  listingId: z.string(),
  nodeId: z.string(),
  versionId: z.string(),
});

// ─── Pagination ───────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Admin Validators ────────────────────────────────────

export const updateAppStatusSchema = z.object({
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]),
  rejectionReason: z.string().max(1000).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["VALIDATOR", "DEVELOPER", "ADMIN"]),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const adminAppsQuerySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"]).optional(),
});
