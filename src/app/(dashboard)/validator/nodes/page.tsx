import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NodeHealth } from "@/components/nodes/node-health";
import Link from "next/link";
import { Plus, Server } from "lucide-react";

export default async function ValidatorNodesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const nodes = await db.validatorNode.findMany({
    where: { ownerId: session.user.id },
    include: {
      _count: { select: { deployments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canton Nodes</h1>
        <Link href="/validator/nodes/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Register Node
          </Button>
        </Link>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Server className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No nodes registered. Register a Canton participant node to
              start deploying apps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => (
            <Link key={node.id} href={`/validator/nodes/${node.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{node.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {node.host}:{node.port}{" "}
                        {node.useTls ? "(TLS)" : ""} &middot;{" "}
                        {node._count.deployments} deployments
                      </p>
                    </div>
                  </div>
                  <NodeHealth
                    nodeId={node.id}
                    initialStatus={node.healthStatus}
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
