"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { AppStatus } from "@prisma/client";

interface AppDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: {
    id: string;
    name: string;
    description: string;
    longDescription: string | null;
    status: AppStatus;
    developer: { name: string | null; email: string };
    versions: {
      version: string;
      darFileSize: number;
      sdkVersion: string | null;
      changelog: string | null;
    }[];
    categories: { category: { name: string } }[];
    tags: { tag: { name: string } }[];
    _count: { reviews: number; installations: number };
  };
}

export function AppDetailDialog({
  open,
  onOpenChange,
  app,
}: AppDetailDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const latestVersion = app.versions[0];

  async function handleAction(status: "PUBLISHED" | "REJECTED") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/apps/${app.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "REJECTED" && rejectionReason
            ? { rejectionReason }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setLoading(false);
      setShowRejectReason(false);
      setRejectionReason("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{app.name}</DialogTitle>
          <DialogDescription>{app.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {app.longDescription && (
            <div>
              <h4 className="text-sm font-medium mb-1">Full Description</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {app.longDescription}
              </p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-1">Developer</h4>
            <p className="text-sm text-muted-foreground">
              {app.developer.name || app.developer.email}
            </p>
          </div>

          {latestVersion && (
            <div>
              <h4 className="text-sm font-medium mb-1">Latest Version</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Version: {latestVersion.version}</p>
                <p>
                  DAR Size:{" "}
                  {(latestVersion.darFileSize / 1024).toFixed(1)} KB
                </p>
                {latestVersion.sdkVersion && (
                  <p>SDK Version: {latestVersion.sdkVersion}</p>
                )}
                {latestVersion.changelog && (
                  <p>Changelog: {latestVersion.changelog}</p>
                )}
              </div>
            </div>
          )}

          {app.categories.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Categories</h4>
              <div className="flex flex-wrap gap-1">
                {app.categories.map((c) => (
                  <Badge key={c.category.name}>{c.category.name}</Badge>
                ))}
              </div>
            </div>
          )}

          {app.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {app.tags.map((t) => (
                  <Badge key={t.tag.name} variant="outline">
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{app._count.reviews} reviews</span>
            <span>{app._count.installations} installs</span>
          </div>

          {showRejectReason && (
            <div>
              <h4 className="text-sm font-medium mb-1">
                Rejection Reason (optional)
              </h4>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this app is being rejected..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {showRejectReason ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectReason(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction("REJECTED")}
                disabled={loading}
              >
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowRejectReason(true)}
                disabled={loading}
              >
                Reject
              </Button>
              <Button
                onClick={() => handleAction("PUBLISHED")}
                disabled={loading}
              >
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
