"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface NodeFormProps {
  node?: {
    id: string;
    name: string;
    host: string;
    port: number;
    useTls: boolean;
    participantId?: string | null;
    synchronizerId?: string | null;
  };
}

export function NodeForm({ node }: NodeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!node;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      host: formData.get("host") as string,
      port: parseInt(formData.get("port") as string) || 5002,
      useTls: formData.get("useTls") === "on",
      participantId: (formData.get("participantId") as string) || undefined,
      synchronizerId: (formData.get("synchronizerId") as string) || undefined,
    };

    try {
      const url = isEditing ? `/api/nodes/${node.id}` : "/api/nodes";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save node");
      }

      router.push("/validator/nodes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Node" : "Register Node"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Node Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={node?.name}
              placeholder="My Canton Node"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                name="host"
                defaultValue={node?.host}
                placeholder="localhost"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                name="port"
                type="number"
                defaultValue={node?.port || 5002}
                placeholder="5002"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useTls"
              name="useTls"
              defaultChecked={node?.useTls}
              className="rounded border-gray-300"
            />
            <Label htmlFor="useTls">Use TLS</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="participantId">Participant ID (optional)</Label>
            <Input
              id="participantId"
              name="participantId"
              defaultValue={node?.participantId || ""}
              placeholder="PAR::participant::..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="synchronizerId">Synchronizer ID (optional)</Label>
            <Input
              id="synchronizerId"
              name="synchronizerId"
              defaultValue={node?.synchronizerId || ""}
              placeholder="global-synchronizer::..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Register"} Node
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
