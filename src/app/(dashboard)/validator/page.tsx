import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Server, Package, Activity, Plus, Key, ClipboardList } from "lucide-react";

export default async function ValidatorDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    nodeCount,
    installationCount,
    deploymentCount,
    licenseCount,
    installRequestCount,
    recentDeployments,
    recentRequests,
  ] = await Promise.all([
    db.validatorNode.count({ where: { ownerId: session.user.id } }),
    db.installation.count({ where: { userId: session.user.id } }),
    db.deployment.count({
      where: { node: { ownerId: session.user.id } },
    }),
    db.license.count({ where: { licenseeId: session.user.id } }),
    db.installRequest.count({ where: { requesterId: session.user.id } }),
    db.deployment.findMany({
      where: { node: { ownerId: session.user.id } },
      include: {
        version: { include: { app: { select: { name: true, slug: true } } } },
        node: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    db.installRequest.findMany({
      where: { requesterId: session.user.id },
      include: {
        listing: {
          include: {
            app: { select: { name: true, slug: true } },
          },
        },
        node: { select: { name: true } },
        version: { select: { version: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Validator Dashboard</h1>
        <Link href="/validator/nodes">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Node
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Installed Apps
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installationCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Deployments
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deploymentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Licenses</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{licenseCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Install Requests
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installRequestCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDeployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deployments yet. Browse the{" "}
                <Link href="/apps" className="text-primary underline">
                  app catalog
                </Link>{" "}
                to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentDeployments.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {dep.version.app.name} v{dep.version.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dep.node.name} &middot;{" "}
                        {new Date(dep.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        dep.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : dep.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {dep.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Install Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No install requests yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {req.listing.app.name} v{req.version.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.node.name} &middot;{" "}
                        {new Date(req.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        req.status === "COMPLETED"
                          ? "default"
                          : req.status === "FAILED"
                            ? "destructive"
                            : req.status === "PENDING"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
