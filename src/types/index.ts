import type {
  App,
  AppVersion,
  DarPackage,
  Category,
  Tag,
  Review,
  User,
  ValidatorNode,
  Deployment,
  DeploymentStep,
  Installation,
} from "@prisma/client";

// ─── App types with relations ─────────────────────────────

export type AppWithDeveloper = App & {
  developer: Pick<User, "id" | "name" | "image" | "username">;
};

export type AppWithDetails = AppWithDeveloper & {
  versions: AppVersion[];
  categories: { category: Category }[];
  tags: { tag: Tag }[];
  _count: { reviews: number; installations: number };
};

export type AppVersionWithPackages = AppVersion & {
  packages: DarPackage[];
};

// ─── Deployment types ─────────────────────────────────────

export type DeploymentWithDetails = Deployment & {
  steps: DeploymentStep[];
  version: AppVersion & { app: Pick<App, "id" | "name" | "slug"> };
  node: Pick<ValidatorNode, "id" | "name" | "host" | "port">;
};

// ─── Review types ─────────────────────────────────────────

export type ReviewWithUser = Review & {
  user: Pick<User, "id" | "name" | "image" | "username">;
};

// ─── API response types ───────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

// ─── Search & filter types ────────────────────────────────

export interface AppSearchParams {
  q?: string;
  category?: string;
  tag?: string;
  status?: string;
  sort?: "newest" | "popular" | "rating";
  page?: number;
  pageSize?: number;
}

// Re-export Prisma types
export type {
  App,
  AppVersion,
  DarPackage,
  Category,
  Tag,
  Review,
  User,
  ValidatorNode,
  Deployment,
  DeploymentStep,
  Installation,
};
