"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeployDialog } from "@/components/deploy/deploy-dialog";
import { InstallRequestDialog } from "@/components/marketplace/install-request-dialog";
import { UninstallButton } from "./uninstall-button";
import { Download, Check, ArrowUpCircle } from "lucide-react";

interface ListingInfo {
  id: string;
  pricingModel: string;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  listingStatus: string;
}

interface InstallButtonProps {
  appId: string;
  appName: string;
  isInstalled?: boolean;
  installedVersionId?: string | null;
  versions: { id: string; version: string; isLatest?: boolean }[];
  nodes: { id: string; name: string }[];
  listing?: ListingInfo;
}

function getPriceLabel(listing?: ListingInfo): string | null {
  if (!listing) return null;
  if (listing.pricingModel === "FREE") return "Free";
  const amount = listing.priceAmount ?? 0;
  return `$${amount.toFixed(2)}`;
}

export function InstallButton({
  appId,
  appName,
  isInstalled = false,
  installedVersionId,
  versions,
  nodes,
  listing,
}: InstallButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const latestVersion = versions.find((v) => v.isLatest) || versions[0];
  const hasUpgrade =
    isInstalled &&
    installedVersionId &&
    latestVersion &&
    latestVersion.id !== installedVersionId;

  if (isInstalled && !hasUpgrade) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled size="sm">
          <Check className="mr-2 h-4 w-4" />
          Installed
        </Button>
        <UninstallButton appId={appId} appName={appName} />
      </div>
    );
  }

  if (hasUpgrade) {
    const priceLabel = getPriceLabel(listing);
    const useMarketplace = listing && listing.listingStatus === "ACTIVE";

    return (
      <div className="flex items-center gap-2">
        <Button onClick={() => setShowDialog(true)} variant="secondary">
          <ArrowUpCircle className="mr-2 h-4 w-4" />
          Upgrade to v{latestVersion.version}
        </Button>
        <UninstallButton appId={appId} appName={appName} />
        {useMarketplace ? (
          <InstallRequestDialog
            open={showDialog}
            onOpenChange={setShowDialog}
            appId={appId}
            appName={appName}
            versions={versions}
            nodes={nodes}
            listing={listing}
          />
        ) : (
          <DeployDialog
            open={showDialog}
            onOpenChange={setShowDialog}
            appId={appId}
            appName={appName}
            versions={versions}
            nodes={nodes}
          />
        )}
      </div>
    );
  }

  const priceLabel = getPriceLabel(listing);
  const useMarketplace = listing && listing.listingStatus === "ACTIVE";

  return (
    <>
      <Button onClick={() => setShowDialog(true)}>
        <Download className="mr-2 h-4 w-4" />
        Install{priceLabel ? ` — ${priceLabel}` : ""}
      </Button>
      {useMarketplace ? (
        <InstallRequestDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          appId={appId}
          appName={appName}
          versions={versions}
          nodes={nodes}
          listing={listing}
        />
      ) : (
        <DeployDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          appId={appId}
          appName={appName}
          versions={versions}
          nodes={nodes}
        />
      )}
    </>
  );
}
