"use client";

import { AppCard } from "./app-card";
import type { AppWithDeveloper } from "@/types";

interface AppGridProps {
  apps: (AppWithDeveloper & {
    _count?: { installations: number; reviews: number };
    avgRating?: number;
  })[];
}

export function AppGrid({ apps }: AppGridProps) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No apps found
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  );
}
