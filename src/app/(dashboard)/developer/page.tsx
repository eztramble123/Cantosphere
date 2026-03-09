import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, Star, Download, Plus, Store, ClipboardList } from "lucide-react";

export default async function DeveloperDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    appCount,
    totalInstalls,
    totalReviews,
    listingCount,
    pendingRequestCount,
    recentApps,
    recentRequests,
  ] = await Promise.all([
    db.app.count({ where: { developerId: session.user.id } }),
    db.installation.count({
      where: { app: { developerId: session.user.id } },
    }),
    db.review.count({
      where: { app: { developerId: session.user.id } },
    }),
    db.appListing.count({ where: { providerId: session.user.id } }),
    db.installRequest.count({
      where: {
        listing: { providerId: session.user.id },
        status: "PENDING",
      },
    }),
    db.app.findMany({
      where: { developerId: session.user.id },
      include: {
        _count: { select: { installations: true, reviews: true } },
        versions: { where: { isLatest: true }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.installRequest.findMany({
      where: { listing: { providerId: session.user.id } },
      include: {
        listing: {
          include: {
            app: { select: { name: true } },
          },
        },
        requester: { select: { name: true, username: true } },
        version: { select: { version: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Developer Dashboard</h1>
        <Link href="/developer/apps/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New App
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Apps</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Installs
            </CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInstalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Listings</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{listingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Requests
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequestCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Apps</CardTitle>
          </CardHeader>
          <CardContent>
            {recentApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t published any apps yet.{" "}
                <Link
                  href="/developer/apps/new"
                  className="text-primary underline"
                >
                  Create your first app
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {recentApps.map((app) => (
                  <Link key={app.id} href={`/developer/apps/${app.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors">
                      <div>
                        <p className="font-medium">{app.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {app._count.installations} installs &middot;{" "}
                          {app._count.reviews} reviews
                          {app.versions[0] &&
                            ` · v${app.versions[0].version}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          app.status === "PUBLISHED"
                            ? "bg-green-100 text-green-700"
                            : app.status === "IN_REVIEW"
                              ? "bg-yellow-100 text-yellow-700"
                              : app.status === "DRAFT"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-red-100 text-red-700"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </Link>
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
                No incoming requests yet. Create a marketplace listing for
                your app to receive install requests.
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
                        by {req.requester.name || req.requester.username}
                        &middot;{" "}
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
