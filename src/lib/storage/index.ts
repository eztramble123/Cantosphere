export interface StorageProvider {
  save(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export { LocalStorage } from "./local";

import { LocalStorage } from "./local";

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalStorage(
      process.env.STORAGE_PATH || "./storage"
    );
  }
  return storageInstance!;
}
