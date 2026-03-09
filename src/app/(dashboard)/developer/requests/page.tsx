import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { ApproveRequestButton } from "@/components/developer/approve-request-button";
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

export default async function DeveloperRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const requests = await db.installRequest.findMany({
    where: { listing: { providerId: session.user.id } },
    orderBy: { requestedAt: "desc" },
    include: {
      listing: {
        include: {
          app: {
            select: { id: true, name: true, slug: true, icon: true },
          },
        },
      },
      requester: {
        select: { id: true, name: true, username: true, image: true },
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
              No install requests yet. Requests will appear here when
              validators request to install your listed apps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = statusConfig[req.status];
            return (
              <Card key={req.id}>
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
                        v{req.version.version} &middot; Node:{" "}
                        {req.node.name} &middot; By{" "}
                        {req.requester.name || req.requester.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.requestedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {req.status === "PENDING" && (
                      <ApproveRequestButton requestId={req.id} />
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
