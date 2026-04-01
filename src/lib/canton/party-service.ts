import { isMockMode } from "./service-factory";

export interface AllocatePartyResult {
  partyId: string;
  participantId: string;
}

/**
 * Sanitize a string to be a valid Canton party hint (alphanumeric + underscores).
 */
export function sanitizePartyHint(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "");
}

/**
 * Allocate a Canton party via the JSON API v2.
 *
 * In mock mode, returns a synthetic party ID without making any HTTP call.
 */
export async function allocateParty(
  partyHint: string,
  displayName: string
): Promise<AllocatePartyResult> {
  if (isMockMode()) {
    return {
      partyId: `${partyHint}::mock`,
      participantId: "participant-mock",
    };
  }

  const jsonApiUrl =
    process.env.CANTON_JSON_API_URL || "http://localhost:4021";
  const participantId =
    process.env.CANTON_PARTICIPANT_ID || "participant1";

  const response = await fetch(`${jsonApiUrl}/v2/parties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partyIdHint: partyHint,
      displayName,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Party allocation failed (${response.status}): ${body}`
    );
  }

  const data = await response.json();
  const partyId = data.party;

  if (!partyId || typeof partyId !== "string") {
    throw new Error(
      `Unexpected response from party allocation: ${JSON.stringify(data)}`
    );
  }

  return { partyId, participantId };
}
