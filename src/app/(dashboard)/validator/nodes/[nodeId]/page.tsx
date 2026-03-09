import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NodeForm } from "@/components/nodes/node-form";
import { NodeHealth } from "@/components/nodes/node-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ nodeId: string }>;
}

export default async function NodeDetailPage({ params }: Props) {
  const { nodeId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Handle "new" as a special case for creating a new node
  if (nodeId === "new") {
    return (
      <div className="max-w-2xl">
        <NodeForm />
      </div>
    );
  }

  const node = await db.validatorNode.findUnique({
    where: { id: nodeId },
    include: {
      deployments: {
        include: {
          version: {
            include: { app: { select: { name: true, slug: true } } },
          },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!node || node.ownerId !== session.user.id) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{node.name}</h1>
          <p className="text-muted-foreground">
            {node.host}:{node.port} {node.useTls ? "(TLS)" : ""}
          </p>
        </div>
        <NodeHealth nodeId={node.id} initialStatus={node.healthStatus} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NodeForm node={node} />

        <Card>
          <CardHeader>
            <CardTitle>Deployment History</CardTitle>
          </CardHeader>
          <CardContent>
            {node.deployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deployments to this node yet.
              </p>
            ) : (
              <div className="space-y-3">
                {node.deployments.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {dep.version.app.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{dep.version.version} &middot;{" "}
                        {new Date(dep.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        dep.status === "COMPLETED"
                          ? "default"
                          : dep.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {dep.status}
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
