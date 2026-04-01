import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallButton } from "@/components/apps/install-button";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewForm } from "@/components/reviews/review-form";
import {
  Star,
  Download,
  ExternalLink,
  GitBranch,
  Calendar,
  Package,
  DollarSign,
  Mail,
  Globe,
} from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

function formatPrice(listing: {
  pricingModel: string;
  priceAmount?: unknown;
  priceCurrency?: string | null;
  billingPeriodDays?: number | null;
  usageUnit?: string | null;
  usageRate?: unknown;
}): string {
  if (listing.pricingModel === "FREE") return "Free";
  const amount = listing.priceAmount ? Number(listing.priceAmount) : 0;
  const currency = listing.priceCurrency || "USD";
  const formatted = `$${amount.toFixed(2)}`;
  if (listing.pricingModel === "SUBSCRIPTION") {
    const days = listing.billingPeriodDays || 30;
    return days === 30 ? `${formatted}/mo` : `${formatted}/${days}d`;
  }
  if (listing.pricingModel === "USAGE_BASED") {
    return `From ${formatted}/${listing.usageUnit || "unit"}`;
  }
  return formatted;
}

export default async function AppDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();

  const app = await db.app.findUnique({
    where: { slug },
    include: {
      developer: {
        select: { id: true, name: true, image: true, username: true },
      },
      versions: {
        orderBy: { createdAt: "desc" },
        include: { packages: true },
      },
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      reviews: {
        include: {
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      listing: true,
      _count: { select: { installations: true, reviews: true } },
    },
  });

  if (!app || (app.status !== "PUBLISHED" && app.developerId !== session?.user?.id && session?.user?.role !== "ADMIN")) {
    notFound();
  }

  const avgRating =
    app.reviews.length > 0
      ? app.reviews.reduce((sum, r) => sum + r.rating, 0) / app.reviews.length
      : null;

  let isInstalled = false;
  let installedVersionId: string | null = null;
  let userNodes: { id: string; name: string }[] = [];
  if (session?.user) {
    const installation = await db.installation.findUnique({
      where: {
        userId_appId: { userId: session.user.id, appId: app.id },
      },
      select: { id: true, versionId: true },
    });
    isInstalled = !!installation;
    installedVersionId = installation?.versionId ?? null;

    if (session.user.role === "VALIDATOR") {
      userNodes = await db.validatorNode.findMany({
        where: { ownerId: session.user.id },
        select: { id: true, name: true },
      });
    }
  }

  const latestVersion = app.versions.find((v) => v.isLatest) || app.versions[0];
  const listing = app.listing;
  const listingData = listing
    ? {
        id: listing.id,
        pricingModel: listing.pricingModel,
        priceAmount: listing.priceAmount ? Number(listing.priceAmount) : null,
        priceCurrency: listing.priceCurrency,
        listingStatus: listing.listingStatus,
      }
    : undefined;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 text-primary text-3xl font-bold flex-shrink-0">
          {app.icon ? (
            <img
              src={app.icon}
              alt={app.name}
              className="h-20 w-20 rounded-xl object-cover"
            />
          ) : (
            app.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{app.name}</h1>
          <p className="text-muted-foreground mt-1">
            by {app.developer.name || app.developer.username}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {avgRating !== null && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({app._count.reviews} reviews)
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              {app._count.installations} installs
            </div>
            {listing && listing.listingStatus === "ACTIVE" && (
              <Badge variant="secondary">
                <DollarSign className="mr-1 h-3 w-3" />
                {formatPrice(listing)}
              </Badge>
            )}
            {app.categories.map(({ category }) => (
              <Badge key={category.id} variant="secondary">
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {session?.user?.role === "VALIDATOR" && (
            <InstallButton
              appId={app.id}
              appName={app.name}
              isInstalled={isInstalled}
              installedVersionId={installedVersionId}
              versions={app.versions.map((v) => ({
                id: v.id,
                version: v.version,
                isLatest: v.isLatest,
              }))}
              nodes={userNodes}
              listing={listingData}
            />
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">
            Versions ({app.versions.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews ({app._count.reviews})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="text-muted-foreground whitespace-pre-wrap">
                {app.longDescription || app.description}
              </p>
            </div>
            <div className="space-y-4">
              {listing && listing.listingStatus === "ACTIVE" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium">
                        {listing.pricingModel === "FREE"
                          ? "Free"
                          : listing.pricingModel === "ONE_TIME"
                            ? "One-Time"
                            : listing.pricingModel === "SUBSCRIPTION"
                              ? "Subscription"
                              : "Usage-Based"}
                      </span>
                    </div>
                    {listing.priceAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium">
                          ${Number(listing.priceAmount).toFixed(2)}{" "}
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
                          Usage Rate
                        </span>
                        <span>
                          ${Number(listing.usageRate).toFixed(4)}/
                          {listing.usageUnit}
                        </span>
                      </div>
                    )}
                    {listing.supportEmail && (
                      <a
                        href={`mailto:${listing.supportEmail}`}
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        Support
                      </a>
                    )}
                    {listing.supportUrl && (
                      <a
                        href={listing.supportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        Support Site
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {latestVersion && (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>v{latestVersion.version}</span>
                    </div>
                  )}
                  {app.license && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">License:</span>
                      <span>{app.license}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {app.repoUrl && (
                    <a
                      href={app.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <GitBranch className="h-4 w-4" />
                      Source Code
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {app.websiteUrl && (
                    <a
                      href={app.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </CardContent>
              </Card>

              {app.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {app.tags.map(({ tag }) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <div className="space-y-4">
            {app.versions.map((version) => (
              <Card key={version.id}>
                <CardContent className="flex items-center justify-between p-4">
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
                      {version.packages.length} packages |{" "}
                      {(version.darFileSize / 1024).toFixed(0)} KB |{" "}
                      {new Date(version.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <ReviewList reviews={app.reviews} />
            </div>
            {session?.user && (
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Write a Review</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReviewForm appId={app.id} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
