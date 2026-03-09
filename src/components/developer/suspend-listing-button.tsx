"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function SuspendListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuspend() {
    if (!confirm("Are you sure you want to suspend this listing?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to suspend listing");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-sm text-destructive">
          Suspend Listing
        </CardTitle>
        <CardDescription>
          Suspending will hide this listing from the marketplace and prevent new
          installations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        <Button
          variant="destructive"
          onClick={handleSuspend}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suspend Listing
        </Button>
      </CardContent>
    </Card>
  );
}
