import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { InstallRequestStatus } from "@prisma/client";

const statusConfig: Record<
  InstallRequestStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  PROVISIONING: { label: "Provisioning", variant: "secondary" },
  COMPLETED: { label: "Completed", variant: "default" },
  FAILED: { label: "Failed", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

export default async function ValidatorInstallRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const requests = await db.installRequest.findMany({
    where: { requesterId: session.user.id },
    orderBy: { requestedAt: "desc" },
    include: {
      listing: {
        include: {
          app: {
            select: { id: true, name: true, slug: true, icon: true },
          },
        },
      },
      node: { select: { id: true, name: true } },
      version: { select: { id: true, version: true } },
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Install Requests</h1>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No install requests yet. Browse the{" "}
              <Link href="/apps" className="underline">
                app catalog
              </Link>{" "}
              to request installations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = statusConfig[req.status];
            return (
              <Link
                key={req.id}
                href={`/apps/${req.listing.app.slug}`}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {req.listing.app.icon ? (
                        <span className="text-2xl">
                          {req.listing.app.icon}
                        </span>
                      ) : (
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {req.listing.app.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          v{req.version.version} &middot; {req.node.name}
                          &middot;{" "}
                          {new Date(req.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(req.requestedAt).toLocaleTimeString([], {
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
