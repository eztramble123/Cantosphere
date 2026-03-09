import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { validateDar, parseDar, computeDarHash } from "../dar-parser";

async function createTestDar(options?: {
  includeManifest?: boolean;
  includeDalf?: boolean;
  manifestContent?: string;
}): Promise<Buffer> {
  const {
    includeManifest = true,
    includeDalf = true,
    manifestContent = "Sdk-Version: 2.8.0\nMain-Dalf: test.dalf\n",
  } = options ?? {};

  const zip = new JSZip();

  if (includeManifest) {
    zip.file("META-INF/MANIFEST.MF", manifestContent);
  }

  if (includeDalf) {
    zip.file("test.dalf", Buffer.from("fake-dalf-content"));
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buf);
}

describe("validateDar", () => {
  it("returns true for a valid DAR with manifest and dalf", async () => {
    const dar = await createTestDar();
    expect(await validateDar(dar)).toBe(true);
  });

  it("returns false when manifest is missing", async () => {
    const dar = await createTestDar({ includeManifest: false });
    expect(await validateDar(dar)).toBe(false);
  });

  it("returns false when dalf is missing", async () => {
    const dar = await createTestDar({ includeDalf: false });
    expect(await validateDar(dar)).toBe(false);
  });

  it("returns false for non-zip data", async () => {
    const data = Buffer.from("this is not a zip file");
    expect(await validateDar(data)).toBe(false);
  });
});

describe("parseDar", () => {
  it("extracts packages and SDK version from a valid DAR", async () => {
    const dar = await createTestDar();
    const metadata = await parseDar(dar);

    expect(metadata.sdkVersion).toBe("2.8.0");
    expect(metadata.packages).toHaveLength(1);
    expect(metadata.packages[0].packageName).toBe("test");
    expect(metadata.packages[0].packageId).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.mainPackageId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws on invalid ZIP", async () => {
    const data = Buffer.from("not a zip");
    await expect(parseDar(data)).rejects.toThrow("Invalid DAR file");
  });

  it("throws when manifest is missing", async () => {
    const dar = await createTestDar({ includeManifest: false });
    await expect(parseDar(dar)).rejects.toThrow("Invalid DAR file");
  });

  it("throws when no dalf files exist", async () => {
    const dar = await createTestDar({ includeDalf: false });
    await expect(parseDar(dar)).rejects.toThrow("Invalid DAR file");
  });
});

describe("computeDarHash", () => {
  it("returns consistent SHA-256 hex output", () => {
    const data = Buffer.from("test-dar-content");
    const hash1 = computeDarHash(data);
    const hash2 = computeDarHash(data);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different data", () => {
    const hash1 = computeDarHash(Buffer.from("data-a"));
    const hash2 = computeDarHash(Buffer.from("data-b"));
    expect(hash1).not.toBe(hash2);
  });
});
