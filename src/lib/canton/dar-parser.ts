import JSZip from "jszip";
import { createHash } from "crypto";
import { DarValidationError } from "./errors";

export interface DarMetadata {
  mainPackageId: string;
  packages: DarPackageInfo[];
  sdkVersion: string | null;
  manifest: Record<string, string>;
}

export interface DarPackageInfo {
  packageId: string;
  packageName: string | null;
  lfVersion: string | null;
}

/**
 * Parse a DAR file (ZIP archive) and extract metadata.
 * DAR structure:
 *   META-INF/MANIFEST.MF — manifest with SDK version, main package
 *   *.dalf — compiled Daml packages
 */
export async function parseDar(data: Buffer): Promise<DarMetadata> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new DarValidationError("File is not a valid ZIP archive");
  }

  // Parse MANIFEST.MF
  const manifestFile = zip.file("META-INF/MANIFEST.MF");
  if (!manifestFile) {
    throw new DarValidationError("DAR is missing META-INF/MANIFEST.MF");
  }

  const manifestContent = await manifestFile.async("string");
  const manifest = parseManifest(manifestContent);

  // Find all .dalf files
  const dalfFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith(".dalf") && !zip.files[name].dir
  );

  if (dalfFiles.length === 0) {
    throw new DarValidationError("DAR contains no .dalf package files");
  }

  // Compute package IDs (SHA-256 of each .dalf)
  const packages: DarPackageInfo[] = [];
  for (const dalfPath of dalfFiles) {
    const dalfData = await zip.files[dalfPath].async("nodebuffer");
    const packageId = createHash("sha256").update(dalfData).digest("hex");

    // Extract package name from path (e.g., "com-example-app-1.0.0.dalf")
    const fileName = dalfPath.split("/").pop() || dalfPath;
    const packageName = fileName.replace(/\.dalf$/, "");

    packages.push({
      packageId,
      packageName,
      lfVersion: manifest["Lf-Version"] || null,
    });
  }

  // Determine main package
  const mainDalf = manifest["Main-Dalf"] || dalfFiles[0];
  let mainPackageId = packages[0]?.packageId || "";

  if (mainDalf) {
    const mainDalfFile = zip.file(mainDalf);
    if (mainDalfFile) {
      const mainData = await mainDalfFile.async("nodebuffer");
      mainPackageId = createHash("sha256").update(mainData).digest("hex");
    }
  }

  return {
    mainPackageId,
    packages,
    sdkVersion: manifest["Sdk-Version"] || null,
    manifest,
  };
}

/**
 * Compute SHA-256 hash of a DAR file
 */
export function computeDarHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Validate that a buffer looks like a valid DAR/ZIP
 */
export async function validateDar(data: Buffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(data);
    const hasManifest = zip.file("META-INF/MANIFEST.MF") !== null;
    const hasDalf = Object.keys(zip.files).some((n) => n.endsWith(".dalf"));
    return hasManifest && hasDalf;
  } catch {
    return false;
  }
}

function parseManifest(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  // MANIFEST.MF uses "Key: Value" format with possible line continuations
  const lines = content.split(/\r?\n/);
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    if (line.startsWith(" ") && currentKey) {
      // Continuation line
      currentValue += line.substring(1);
    } else {
      // Save previous entry
      if (currentKey) {
        result[currentKey] = currentValue;
      }
      // Parse new entry
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        currentKey = line.substring(0, colonIdx).trim();
        currentValue = line.substring(colonIdx + 1).trim();
      } else {
        currentKey = "";
        currentValue = "";
      }
    }
  }

  if (currentKey) {
    result[currentKey] = currentValue;
  }

  return result;
}
