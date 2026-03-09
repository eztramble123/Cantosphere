import slugifyLib from "slugify";
import { nanoid } from "nanoid";

export function generateSlug(name: string): string {
  const base = slugifyLib(name, { lower: true, strict: true });
  return `${base}-${nanoid(6)}`;
}
