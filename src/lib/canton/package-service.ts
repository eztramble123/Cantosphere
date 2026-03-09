import {
  checkNodeHealth,
  getPackageServiceClient,
  makeServiceCall,
} from "./client";
import { UploadError, VettingError } from "./errors";
import type {
  NodeConnectionConfig,
  UploadDarResponse,
  ListDarsResponse,
  ListPackagesResponse,
} from "./types";

/**
 * Interface for Canton PackageService operations.
 * Both the real gRPC client and mock implementation conform to this.
 */
export interface IPackageService {
  uploadDar(data: Buffer, filename: string, vetAllPackages?: boolean): Promise<string>;
  listDars(): Promise<ListDarsResponse>;
  listPackages(): Promise<ListPackagesResponse>;
  vetDar(darHash: string, synchronizerId?: string): Promise<void>;
  unvetDar(darHash: string, synchronizerId?: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Real Canton PackageService implementation using protobuf-encoded gRPC.
 */
export class PackageService implements IPackageService {
  constructor(private config: NodeConnectionConfig) {}

  async uploadDar(
    data: Buffer,
    filename: string,
    vetAllPackages: boolean = true
  ): Promise<string> {
    try {
      const client = getPackageServiceClient(this.config);
      const response = await makeServiceCall<
        { data: Buffer; filename: string; vet_all_packages: boolean; synchronizer_id: string },
        UploadDarResponse
      >(
        client,
        "uploadDar",
        {
          data,
          filename,
          vet_all_packages: vetAllPackages,
          synchronizer_id: this.config.synchronizerId || "",
        },
        this.config,
        120000 // 2 min timeout for large uploads
      );
      return response.hash;
    } catch (error) {
      throw new UploadError(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async listDars(): Promise<ListDarsResponse> {
    const client = getPackageServiceClient(this.config);
    return makeServiceCall<{ limit: number }, ListDarsResponse>(
      client,
      "listDars",
      { limit: 1000 },
      this.config
    );
  }

  async listPackages(): Promise<ListPackagesResponse> {
    const client = getPackageServiceClient(this.config);
    return makeServiceCall<{ limit: number }, ListPackagesResponse>(
      client,
      "listPackages",
      { limit: 10000 },
      this.config
    );
  }

  async vetDar(darHash: string, synchronizerId?: string): Promise<void> {
    try {
      const client = getPackageServiceClient(this.config);
      await makeServiceCall(
        client,
        "vetDar",
        {
          dar_hash: darHash,
          synchronizer_id: synchronizerId || this.config.synchronizerId || "",
        },
        this.config
      );
    } catch (error) {
      throw new VettingError(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async unvetDar(darHash: string, synchronizerId?: string): Promise<void> {
    try {
      const client = getPackageServiceClient(this.config);
      await makeServiceCall(
        client,
        "unvetDar",
        {
          dar_hash: darHash,
          synchronizer_id: synchronizerId || this.config.synchronizerId || "",
        },
        this.config
      );
    } catch (error) {
      throw new VettingError(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    return checkNodeHealth(this.config);
  }
}
