import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default async function DeveloperAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-muted-foreground">
            Analytics coming soon
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Track installs, revenue, and usage metrics for your apps.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
