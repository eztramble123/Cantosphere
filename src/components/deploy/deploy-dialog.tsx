"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DeployProgress } from "./deploy-progress";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  appName: string;
  versions: { id: string; version: string }[];
  nodes: { id: string; name: string }[];
}

export function DeployDialog({
  open,
  onOpenChange,
  appId,
  appName,
  versions,
  nodes,
}: DeployDialogProps) {
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(
    versions[0]?.id || ""
  );
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeploy() {
    if (!selectedNode || !selectedVersion) return;

    setIsDeploying(true);
    setError(null);

    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: selectedNode,
          versionId: selectedVersion,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start deployment");
      }

      const json = await res.json();
      setDeploymentId(json.data.id);

      // Also create installation record
      await fetch(`/api/apps/${appId}/install`, {
        method: "POST",
      }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      setError(message);
      toast.error(message);
      setIsDeploying(false);
    }
  }

  function handleClose() {
    if (!isDeploying || deploymentId) {
      setDeploymentId(null);
      setIsDeploying(false);
      setError(null);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deploy {appName}</DialogTitle>
          <DialogDescription>
            Select a target node and version to deploy this application.
          </DialogDescription>
        </DialogHeader>

        {deploymentId ? (
          <DeployProgress
            deploymentId={deploymentId}
            onComplete={handleClose}
          />
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Node</Label>
                {nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No nodes registered.{" "}
                    <a href="/validator/nodes" className="text-primary underline">
                      Register a node
                    </a>{" "}
                    first.
                  </p>
                ) : (
                  <Select
                    value={selectedNode}
                    onValueChange={setSelectedNode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <Select
                  value={selectedVersion}
                  onValueChange={setSelectedVersion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleDeploy}
                disabled={
                  !selectedNode || !selectedVersion || isDeploying
                }
              >
                {isDeploying && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Deploy
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
