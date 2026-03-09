import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppForm } from "@/components/developer/app-form";
import { ListingForm } from "@/components/developer/listing-form";
import { SuspendListingButton } from "@/components/developer/suspend-listing-button";
import Link from "next/link";
import { Plus, ExternalLink, Mail, Globe } from "lucide-react";

interface Props {
  params: Promise<{ appId: string }>;
}

export default async function DeveloperAppDetailPage({ params }: Props) {
  const { appId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const app = await db.app.findUnique({
    where: { id: appId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        include: { packages: true },
      },
      categories: { include: { category: true } },
      listing: true,
      _count: { select: { installations: true, reviews: true } },
    },
  });

  if (!app || app.developerId !== session.user.id) notFound();

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  const listing = app.listing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{app.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant={
                app.status === "PUBLISHED"
                  ? "default"
                  : app.status === "IN_REVIEW"
                    ? "secondary"
                    : "outline"
              }
            >
              {app.status}
            </Badge>
            {listing && (
              <Badge
                variant={
                  listing.listingStatus === "ACTIVE"
                    ? "default"
                    : listing.listingStatus === "SUSPENDED"
                      ? "destructive"
                      : "secondary"
                }
              >
                Listing: {listing.listingStatus}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {app._count.installations} installs &middot;{" "}
              {app._count.reviews} reviews
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {app.status === "PUBLISHED" && (
            <Link href={`/apps/${app.slug}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Listing
              </Button>
            </Link>
          )}
          <Link href={`/developer/apps/${app.id}/versions/new`}>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Version
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="versions">
        <TabsList>
          <TabsTrigger value="versions">
            Versions ({app.versions.length})
          </TabsTrigger>
          <TabsTrigger value="listing">Listing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="mt-6">
          {app.versions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No versions uploaded yet.{" "}
                  <Link
                    href={`/developer/apps/${app.id}/versions/new`}
                    className="text-primary underline"
                  >
                    Upload your first DAR
                  </Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {app.versions.map((version) => (
                <Card key={version.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            v{version.version}
                          </span>
                          {version.isLatest && (
                            <Badge variant="default">Latest</Badge>
                          )}
                        </div>
                        {version.changelog && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {version.changelog}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {version.packages.length} packages &middot;{" "}
                          {(version.darFileSize / 1024).toFixed(0)} KB
                          &middot;{" "}
                          {new Date(
                            version.createdAt
                          ).toLocaleDateString()}
                          {version.sdkVersion &&
                            ` · SDK ${version.sdkVersion}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="listing" className="mt-6">
          <div className="max-w-2xl space-y-6">
            {app.status !== "PUBLISHED" ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Your app must be published before you can create a
                    marketplace listing. Submit it for review first.
                  </p>
                </CardContent>
              </Card>
            ) : listing ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Listing Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Pricing Model
                      </span>
                      <span className="font-medium">
                        {listing.pricingModel}
                      </span>
                    </div>
                    {listing.priceAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium">
                          {listing.priceAmount.toString()}{" "}
                          {listing.priceCurrency}
                        </span>
                      </div>
                    )}
                    {listing.billingPeriodDays && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Billing Period
                        </span>
                        <span>{listing.billingPeriodDays} days</span>
                      </div>
                    )}
                    {listing.usageUnit && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Usage Unit
                        </span>
                        <span>{listing.usageUnit}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge
                        variant={
                          listing.listingStatus === "ACTIVE"
                            ? "default"
                            : listing.listingStatus === "SUSPENDED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {listing.listingStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DAR Hash</span>
                      <span className="font-mono text-xs truncate max-w-48">
                        {listing.darHash}
                      </span>
                    </div>
                    {listing.supportEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{listing.supportEmail}</span>
                      </div>
                    )}
                    {listing.supportUrl && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={listing.supportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {listing.supportUrl}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <ListingForm appId={app.id} listing={listing} />

                {listing.listingStatus === "ACTIVE" && (
                  <SuspendListingButton listingId={listing.id} />
                )}
              </>
            ) : app.versions.length > 0 ? (
              <ListingForm appId={app.id} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Upload at least one version before creating a listing.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="max-w-2xl">
            <AppForm categories={categories} app={app} />

            {app.status === "DRAFT" && app.versions.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Submit for Review</CardTitle>
                  <CardDescription>
                    Submit your app to the Cantosphere team for review
                    and publication.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubmitForReviewButton appId={app.id} />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubmitForReviewButton({ appId }: { appId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { db } = await import("@/lib/db");
        await db.app.update({
          where: { id: appId },
          data: { status: "IN_REVIEW" },
        });
        const { redirect } = await import("next/navigation");
        redirect(`/developer/apps/${appId}`);
      }}
    >
      <Button type="submit">Submit for Review</Button>
    </form>
  );
}
