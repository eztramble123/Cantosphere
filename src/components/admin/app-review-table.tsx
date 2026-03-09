"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AppDetailDialog } from "./app-detail-dialog";
import type { AppStatus } from "@prisma/client";

const statusConfig: Record<
  AppStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  IN_REVIEW: { label: "In Review", variant: "secondary" },
  PUBLISHED: { label: "Published", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

type AppRow = {
  id: string;
  name: string;
  description: string;
  longDescription: string | null;
  status: AppStatus;
  createdAt: string;
  developer: { name: string | null; email: string };
  versions: {
    version: string;
    darFileSize: number;
    sdkVersion: string | null;
    changelog: string | null;
    createdAt: string;
  }[];
  categories: { category: { name: string } }[];
  tags: { tag: { name: string } }[];
  _count: { reviews: number; installations: number };
};

interface AppReviewTableProps {
  apps: AppRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function AppReviewTable({ apps, pagination }: AppReviewTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [detailApp, setDetailApp] = useState<AppRow | null>(null);

  const currentStatus = searchParams.get("status") || "IN_REVIEW";

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/admin/review?${params.toString()}`);
  }

  async function handleAction(
    appId: string,
    status: "PUBLISHED" | "REJECTED",
    reason?: string
  ) {
    setLoading(appId);
    try {
      const res = await fetch(`/api/admin/apps/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(reason ? { rejectionReason: reason } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setLoading(null);
      setRejectDialog(null);
      setRejectionReason("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={currentStatus}
          onValueChange={(value) =>
            updateParams({ status: value, page: undefined })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IN_REVIEW">In Review</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No apps found.
              </TableCell>
            </TableRow>
          ) : (
            apps.map((app) => {
              const config = statusConfig[app.status];
              return (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        by {app.developer.name || app.developer.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {app.versions[0]?.version || "—"}
                  </TableCell>
                  <TableCell>
                    {new Date(app.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetailApp(app)}
                      >
                        View
                      </Button>
                      {app.status === "IN_REVIEW" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              handleAction(app.id, "PUBLISHED")
                            }
                            disabled={loading === app.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRejectDialog(app.id)}
                            disabled={loading === app.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() =>
                updateParams({ page: String(pagination.page - 1) })
              }
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                updateParams({ page: String(pagination.page + 1) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectDialog}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialog(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject App</DialogTitle>
          </DialogHeader>
          <div>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectDialog &&
                handleAction(rejectDialog, "REJECTED", rejectionReason)
              }
              disabled={loading === rejectDialog}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {detailApp && (
        <AppDetailDialog
          open={!!detailApp}
          onOpenChange={(open) => !open && setDetailApp(null)}
          app={detailApp}
        />
      )}
    </div>
  );
}
