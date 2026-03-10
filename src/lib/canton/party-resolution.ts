import { db } from "@/lib/db";

/**
 * Resolve a Prisma user ID (CUID) to a Canton party ID.
 *
 * Looks up the CantonPartyMapping table for the user's party ID.
 * Falls back to the raw userId if no mapping exists (graceful degradation
 * in dev/mock mode).
 */
export async function resolvePartyId(userId: string): Promise<string> {
  const mapping = await db.cantonPartyMapping.findFirst({
    where: { userId },
    select: { partyId: true },
  });

  return mapping?.partyId ?? userId;
}
