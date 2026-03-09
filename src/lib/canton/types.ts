// ─── Canton gRPC API Types ───────────────────────────────

export interface UploadDarRequest {
  data: Buffer;
  filename: string;
  vetAllPackages: boolean;
  synchronizerIdOptional?: string;
}

export interface UploadDarResponse {
  hash: string;
}

export interface ListDarsRequest {
  limit?: number;
}

export interface DarDescription {
  hash: string;
  name: string;
  main: string;
  packages: string[];
  description: string;
}

export interface ListDarsResponse {
  dars: DarDescription[];
}

export interface VetDarRequest {
  darHash: string;
  synchronizerId?: string;
}

export interface UnvetDarRequest {
  darHash: string;
  synchronizerId?: string;
}

export interface ListPackagesRequest {
  limit?: number;
}

export interface PackageDescription {
  packageId: string;
  name: string;
  version: string;
  sourceDescription: string;
}

export interface ListPackagesResponse {
  packageDescriptions: PackageDescription[];
}

export interface GetPackageStatusRequest {
  packageId: string;
}

// ─── Node connection types ────────────────────────────────

export interface NodeConnectionConfig {
  host: string;
  port: number;
  useTls: boolean;
  synchronizerId?: string;
  // Future mTLS fields — structured for future addition
  tlsCertPath?: string;
  tlsKeyPath?: string;
  tlsCaPath?: string;
}

// ─── Deployment types ─────────────────────────────────────

export enum DeployStep {
  VALIDATE_DAR = "VALIDATE_DAR",
  CHECK_DEPENDENCIES = "CHECK_DEPENDENCIES",
  UPLOAD_DAR = "UPLOAD_DAR",
  VET_PACKAGES = "VET_PACKAGES",
  VERIFY_DEPLOYMENT = "VERIFY_DEPLOYMENT",
}

export interface DeploymentContext {
  deploymentId: string;
  nodeId: string;
  nodeConfig: NodeConnectionConfig;
  synchronizerId?: string;
  darFileKey: string;
  darFileHash: string;
  packageIds: string[];
  versionId?: string;
  installRequestId?: string;
}
