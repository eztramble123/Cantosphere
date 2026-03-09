"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Download } from "lucide-react";
import type { AppWithDeveloper } from "@/types";

interface AppCardProps {
  app: AppWithDeveloper & {
    _count?: { installations: number; reviews: number };
    avgRating?: number;
  };
}

export function AppCard({ app }: AppCardProps) {
  return (
    <Link href={`/apps/${app.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary text-lg font-bold">
              {app.icon ? (
                <img
                  src={app.icon}
                  alt={app.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                app.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{app.name}</h3>
              <p className="text-sm text-muted-foreground">
                {app.developer.name || app.developer.username}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {app.description}
          </p>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{app.avgRating?.toFixed(1) || "N/A"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            <span>{app._count?.installations || 0}</span>
          </div>
          {app.featured && <Badge variant="secondary">Featured</Badge>}
        </CardFooter>
      </Card>
    </Link>
  );
}
