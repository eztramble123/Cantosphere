import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { LicenseStatus } from "@prisma/client";

const statusConfig: Record<
  LicenseStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  EXPIRED: { label: "Expired", variant: "outline" },
  REVOKED: { label: "Revoked", variant: "destructive" },
  SUSPENDED: { label: "Suspended", variant: "secondary" },
};

export default async function ValidatorLicensesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const licenses = await db.license.findMany({
    where: { licenseeId: session.user.id },
    orderBy: { grantedAt: "desc" },
    include: {
      listing: {
        include: {
          app: {
            select: { id: true, name: true, slug: true, icon: true },
          },
        },
      },
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Licenses</h1>

      {licenses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No licenses yet. Browse the{" "}
              <Link href="/apps" className="underline">
                app catalog
              </Link>{" "}
              to acquire licenses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {licenses.map((license) => {
            const status = statusConfig[license.status];
            return (
              <Link
                key={license.id}
                href={`/apps/${license.listing.app.slug}`}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {license.listing.app.icon ? (
                        <span className="text-2xl">
                          {license.listing.app.icon}
                        </span>
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {license.listing.app.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {license.pricingModel} &middot; Granted{" "}
                          {new Date(license.grantedAt).toLocaleDateString()}
                          {license.expiresAt &&
                            ` · Expires ${new Date(license.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {license.amountPaid && (
                        <p className="text-xs text-muted-foreground hidden sm:block">
                          ${Number(license.amountPaid).toFixed(2)} paid
                        </p>
                      )}
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
