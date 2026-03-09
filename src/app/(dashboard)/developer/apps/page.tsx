import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function DeveloperAppsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const apps = await db.app.findMany({
    where: { developerId: session.user.id },
    include: {
      versions: { where: { isLatest: true }, take: 1 },
      _count: { select: { installations: true, reviews: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge variant="default">Published</Badge>;
      case "IN_REVIEW":
        return <Badge variant="secondary">In Review</Badge>;
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Apps</h1>
        <Link href="/developer/apps/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New App
          </Button>
        </Link>
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No apps yet. Create your first Daml app listing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Link key={app.id} href={`/developer/apps/${app.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {app._count.installations} installs &middot;{" "}
                        {app._count.reviews} reviews
                        {app.versions[0] &&
                          ` · v${app.versions[0].version}`}
                      </p>
                    </div>
                  </div>
                  {statusBadge(app.status)}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
