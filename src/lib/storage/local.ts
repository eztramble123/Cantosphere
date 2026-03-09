import fs from "fs/promises";
import path from "path";
import type { StorageProvider } from "./index";

export class LocalStorage implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  private filePath(key: string): string {
    // Prevent path traversal
    const sanitized = key.replace(/\.\./g, "").replace(/^\//, "");
    return path.join(this.basePath, sanitized);
  }

  async save(key: string, data: Buffer): Promise<void> {
    const fp = this.filePath(key);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.filePath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(key));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(key));
      return true;
    } catch {
      return false;
    }
  }
}
