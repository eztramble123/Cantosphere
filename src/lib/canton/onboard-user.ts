import { db } from "@/lib/db";
import { allocateParty, sanitizePartyHint } from "./party-service";

/**
 * Onboard a user by allocating a Canton party and storing the mapping.
 *
 * Idempotent — returns the existing mapping if one already exists.
 */
export async function onboardUser(
  userId: string,
  role: string,
  displayName: string
) {
  // Check for existing mapping
  const existing = await db.cantonPartyMapping.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  // Generate party hint: User_{last8OfUserId}
  const suffix = userId.slice(-8);
  const partyHint = sanitizePartyHint(`User_${suffix}`);

  const { partyId, participantId } = await allocateParty(
    partyHint,
    displayName
  );

  // Upsert to handle any race conditions
  const mapping = await db.cantonPartyMapping.upsert({
    where: {
      userId_participantId: { userId, participantId },
    },
    update: {},
    create: {
      userId,
      partyId,
      participantId,
      role,
    },
  });

  return mapping;
}
