"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ListingFormProps {
  appId: string;
  listing?: {
    id: string;
    pricingModel: string;
    priceAmount?: { toString(): string } | string | number | null;
    priceCurrency?: string | null;
    billingPeriodDays?: number | null;
    usageUnit?: string | null;
    usageRate?: { toString(): string } | string | number | null;
    supportEmail?: string | null;
    supportUrl?: string | null;
  };
}

export function ListingForm({ appId, listing }: ListingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState(
    listing?.pricingModel || "FREE"
  );

  const isEditing = !!listing;
  const isPaid = pricingModel !== "FREE";
  const isSubscription = pricingModel === "SUBSCRIPTION";
  const isUsageBased = pricingModel === "USAGE_BASED";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      pricingModel,
      supportEmail: (formData.get("supportEmail") as string) || undefined,
      supportUrl: (formData.get("supportUrl") as string) || undefined,
    };

    if (isPaid) {
      body.priceAmount = parseFloat(formData.get("priceAmount") as string) || 0;
      body.priceCurrency = (formData.get("priceCurrency") as string) || "USD";
    }

    if (isSubscription) {
      body.billingPeriodDays =
        parseInt(formData.get("billingPeriodDays") as string) || 30;
    }

    if (isUsageBased) {
      body.usageUnit = (formData.get("usageUnit") as string) || undefined;
      body.usageRate =
        parseFloat(formData.get("usageRate") as string) || undefined;
    }

    if (!isEditing) {
      body.appId = appId;
    }

    try {
      const url = isEditing
        ? `/api/listings/${listing.id}`
        : "/api/listings";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save listing");
      }

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
        <CardTitle>
          {isEditing ? "Edit Listing" : "Create Marketplace Listing"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your marketplace listing settings"
            : "Configure pricing and support for your marketplace listing"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pricing Model</Label>
            <Select value={pricingModel} onValueChange={setPricingModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="ONE_TIME">One-Time Purchase</SelectItem>
                <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                <SelectItem value="USAGE_BASED">Usage-Based</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isPaid && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceAmount">Price</Label>
                <Input
                  id="priceAmount"
                  name="priceAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={listing?.priceAmount?.toString() || ""}
                  placeholder="9.99"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceCurrency">Currency</Label>
                <Input
                  id="priceCurrency"
                  name="priceCurrency"
                  defaultValue={listing?.priceCurrency || "USD"}
                  placeholder="USD"
                />
              </div>
            </div>
          )}

          {isSubscription && (
            <div className="space-y-2">
              <Label htmlFor="billingPeriodDays">Billing Period (days)</Label>
              <Input
                id="billingPeriodDays"
                name="billingPeriodDays"
                type="number"
                min="1"
                defaultValue={listing?.billingPeriodDays?.toString() || "30"}
                placeholder="30"
              />
            </div>
          )}

          {isUsageBased && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usageUnit">Usage Unit</Label>
                <Input
                  id="usageUnit"
                  name="usageUnit"
                  defaultValue={listing?.usageUnit || ""}
                  placeholder="e.g. API call, transaction"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usageRate">Rate per Unit</Label>
                <Input
                  id="usageRate"
                  name="usageRate"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={listing?.usageRate?.toString() || ""}
                  placeholder="0.01"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                name="supportEmail"
                type="email"
                defaultValue={listing?.supportEmail || ""}
                placeholder="support@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportUrl">Support URL</Label>
              <Input
                id="supportUrl"
                name="supportUrl"
                defaultValue={listing?.supportUrl || ""}
                placeholder="https://..."
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update" : "Create"} Listing
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
