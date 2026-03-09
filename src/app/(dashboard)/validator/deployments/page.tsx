import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Rocket } from "lucide-react";
import type { DeploymentStatus } from "@prisma/client";

const statusConfig: Record<
  DeploymentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  UPLOADING: { label: "Uploading", variant: "secondary" },
  VETTING: { label: "Vetting", variant: "secondary" },
  VERIFYING: { label: "Verifying", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "default" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export default async function ValidatorDeploymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const deployments = await db.deployment.findMany({
    where: { node: { ownerId: session.user.id } },
    orderBy: { startedAt: "desc" },
    include: {
      node: { select: { id: true, name: true } },
      version: {
        select: {
          id: true,
          version: true,
          app: { select: { id: true, name: true, slug: true, icon: true } },
        },
      },
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Deployments</h1>

      {deployments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Rocket className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No deployments yet. Deploy an app from the{" "}
              <Link href="/store" className="underline">
                store
              </Link>{" "}
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deployments.map((dep) => {
            const status = statusConfig[dep.status];
            return (
              <Link
                key={dep.id}
                href={`/store/${dep.version.app.slug}`}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {dep.version.app.icon ? (
                        <span className="text-2xl">{dep.version.app.icon}</span>
                      ) : (
                        <Rocket className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{dep.version.app.name}</p>
                        <p className="text-xs text-muted-foreground">
                          v{dep.version.version} &middot; {dep.node.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(dep.startedAt).toLocaleDateString()}{" "}
                        {new Date(dep.startedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
