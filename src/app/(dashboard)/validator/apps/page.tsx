import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UninstallButton } from "@/components/apps/uninstall-button";
import Link from "next/link";

export default async function ValidatorAppsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const installations = await db.installation.findMany({
    where: { userId: session.user.id },
    include: {
      app: {
        include: {
          developer: { select: { name: true } },
          versions: {
            where: { isLatest: true },
            take: 1,
          },
          _count: { select: { installations: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Installed Apps</h1>

      {installations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t installed any apps yet.{" "}
              <Link href="/apps" className="text-primary underline">
                Browse the catalog
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {installations.map(({ app, createdAt }) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <Link href={`/apps/${app.slug}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold flex-shrink-0">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{app.name}</p>
                    <p className="text-xs text-muted-foreground">
                      by {app.developer.name} &middot; Installed{" "}
                      {new Date(createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {app.versions[0] && (
                    <Badge variant="outline">
                      v{app.versions[0].version}
                    </Badge>
                  )}
                  <UninstallButton appId={app.id} appName={app.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
