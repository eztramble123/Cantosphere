import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * Check if the caller can see a given app.
 * Published apps are visible to everyone.
 * Unpublished apps are visible only to the developer or admins.
 * Returns null if the app doesn't exist or isn't visible.
 */
export async function checkAppVisibility(appId: string) {
  const app = await db.app.findUnique({
    where: { id: appId },
    select: { id: true, status: true, developerId: true },
  });
  if (!app) return null;
  if (app.status === "PUBLISHED") return app;

  const session = await auth();
  if (!session?.user) return null;
  if (session.user.id === app.developerId || session.user.role === "ADMIN") return app;
  return null;
}
