import { db } from "@/lib/db";
import { onboardUser } from "./onboard-user";
import { isMockMode } from "./service-factory";

/**
 * Resolve a Prisma user ID (CUID) to a Canton party ID.
 *
 * Looks up the CantonPartyMapping table for the user's party ID.
 * If no mapping exists, attempts lazy allocation before falling back
 * to the raw userId (last-resort for mock mode only).
 */
export async function resolvePartyId(userId: string): Promise<string> {
  const mapping = await db.cantonPartyMapping.findFirst({
    where: { userId },
    select: { partyId: true },
    orderBy: { createdAt: "asc" },
  });

  if (mapping?.partyId) return mapping.partyId;

  // Lazy allocation — user signed in before party service was available
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, email: true },
    });
    if (user) {
      const result = await onboardUser(
        userId,
        user.role,
        user.name ?? user.email ?? "User"
      );
      return result.partyId;
    }
  } catch (error) {
    console.error("[Canton] Lazy party allocation failed:", error);
  }

  // In non-mock mode, a raw userId is not a valid Canton party — throw instead
  if (!isMockMode()) {
    throw new Error(
      `[Canton] No party mapping found for user ${userId} and allocation failed. Cannot use raw userId in non-mock mode.`
    );
  }
  return userId; // Mock-only fallback
}
