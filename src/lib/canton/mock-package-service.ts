import type { IPackageService } from "./package-service";
import type {
  ListDarsResponse,
  ListPackagesResponse,
  DarDescription,
  PackageDescription,
} from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomHash(): string {
  const chars = "abcdef0123456789";
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Mock implementation of PackageService for development/testing.
 * Simulates Canton Admin API responses with realistic delays.
 */
export class MockPackageService implements IPackageService {
  private dars = new Map<string, DarDescription>();
  private packages = new Map<string, PackageDescription>();

  async uploadDar(
    _data: Buffer,
    filename: string,
    _vetAllPackages: boolean = true
  ): Promise<string> {
    await delay(1000);

    const hash = randomHash();
    const packageId = `pkg-${randomHash().slice(0, 16)}`;

    this.dars.set(hash, {
      hash,
      name: filename.replace(/\.dar$/, ""),
      main: packageId,
      packages: [packageId],
      description: `Mock DAR uploaded from ${filename}`,
    });

    this.packages.set(packageId, {
      packageId,
      name: filename.replace(/\.dar$/, ""),
      version: "1.0.0",
      sourceDescription: `Uploaded via ${filename}`,
    });

    console.log(`[MockPackageService] uploadDar: ${filename} → ${hash.slice(0, 12)}...`);
    return hash;
  }

  async listDars(): Promise<ListDarsResponse> {
    await delay(200);
    return { dars: Array.from(this.dars.values()) };
  }

  async listPackages(): Promise<ListPackagesResponse> {
    await delay(200);
    return { packageDescriptions: Array.from(this.packages.values()) };
  }

  async vetDar(darHash: string, _synchronizerId?: string): Promise<void> {
    await delay(500);
    console.log(`[MockPackageService] vetDar: ${darHash.slice(0, 12)}...`);
  }

  async unvetDar(darHash: string, _synchronizerId?: string): Promise<void> {
    await delay(500);
    console.log(`[MockPackageService] unvetDar: ${darHash.slice(0, 12)}...`);
  }

  async healthCheck(): Promise<boolean> {
    await delay(100);
    return true;
  }
}
