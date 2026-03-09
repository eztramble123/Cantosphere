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
import { Badge } from "@/components/ui/badge";
import { DeployProgress } from "@/components/deploy/deploy-progress";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface InstallRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  appName: string;
  versions: { id: string; version: string }[];
  nodes: { id: string; name: string }[];
  listing: {
    id: string;
    pricingModel: string;
    priceAmount?: number | null;
    priceCurrency?: string | null;
    listingStatus: string;
  };
}

type Step = "select" | "license" | "submitting" | "deploying" | "done";

export function InstallRequestDialog({
  open,
  onOpenChange,
  appName,
  versions,
  nodes,
  listing,
}: InstallRequestDialogProps) {
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(
    versions[0]?.id || ""
  );
  const [step, setStep] = useState<Step>("select");
  const [hasLicense, setHasLicense] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const isFree = listing.pricingModel === "FREE";
  const priceLabel = isFree
    ? "Free"
    : `$${(listing.priceAmount ?? 0).toFixed(2)} ${listing.priceCurrency || "USD"}`;

  async function checkLicense() {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user already has a license for this listing
      const res = await fetch("/api/licenses");
      if (!res.ok) throw new Error("Failed to check licenses");

      const { data } = await res.json();
      const existing = data?.find(
        (l: { listingId: string; status: string }) =>
          l.listingId === listing.id && l.status === "ACTIVE"
      );

      if (existing || isFree) {
        setHasLicense(true);
        setStep("license");
      } else {
        setHasLicense(false);
        setStep("license");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check license";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function acquireLicense() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to acquire license");
      }

      setHasLicense(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to acquire license";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitRequest() {
    setIsLoading(true);
    setError(null);
    setStep("submitting");

    try {
      const res = await fetch("/api/install-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          nodeId: selectedNode,
          versionId: selectedVersion,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit install request");
      }

      const { data } = await res.json();
      setRequestId(data.id);

      // If auto-approved (FREE app), show deployment progress
      if (data.status === "PROVISIONING" && data.deploymentId) {
        setDeploymentId(data.deploymentId);
        setStep("deploying");
        toast.success("Deployment started");
      } else {
        setStep("done");
        toast.success("Install request submitted");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit request";
      setError(message);
      toast.error(message);
      setStep("license");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    if (step === "submitting") return;
    setStep("select");
    setHasLicense(false);
    setError(null);
    setRequestId(null);
    setDeploymentId(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install {appName}</DialogTitle>
          <DialogDescription>
            {step === "select" &&
              "Select a target node and version for this installation."}
            {step === "license" && "Review pricing and license before proceeding."}
            {step === "submitting" && "Submitting your install request..."}
            {step === "deploying" && "Deploying application to your node..."}
            {step === "done" && "Your install request has been submitted."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm text-muted-foreground">Price</span>
                <Badge variant="secondary">{priceLabel}</Badge>
              </div>

              <div className="space-y-2">
                <Label>Target Node</Label>
                {nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No nodes registered.{" "}
                    <a
                      href="/validator/nodes"
                      className="text-primary underline"
                    >
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
                onClick={checkLicense}
                disabled={!selectedNode || !selectedVersion || isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "license" && (
          <>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pricing</span>
                  <span className="text-sm">{priceLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">License</span>
                  {hasLicense ? (
                    <Badge variant="default">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Licensed
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not Licensed</Badge>
                  )}
                </div>
              </div>

              {!hasLicense && !isFree && (
                <Button
                  onClick={acquireLicense}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Acquire License — {priceLabel}
                </Button>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={submitRequest}
                disabled={(!hasLicense && !isFree) || isLoading}
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Install Request
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "submitting" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Submitting your install request...
            </p>
          </div>
        )}

        {step === "deploying" && deploymentId && (
          <DeployProgress
            deploymentId={deploymentId}
            onComplete={handleClose}
          />
        )}

        {step === "done" && (
          <>
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium">
                Install request submitted successfully
              </p>
              <p className="text-xs text-muted-foreground">
                The developer will review your request. You can track its
                status in your dashboard.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
