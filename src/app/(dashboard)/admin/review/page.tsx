import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AppReviewTable } from "@/components/admin/app-review-table";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import type { AppStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const validStatuses: AppStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
];

export default async function AdminReviewPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const status = validStatuses.includes(params.status as AppStatus)
    ? (params.status as AppStatus)
    : "IN_REVIEW";
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;

  const where = { status };

  const [apps, total] = await Promise.all([
    db.app.findMany({
      where,
      ...paginate(page, pageSize),
      orderBy: { updatedAt: "desc" },
      include: {
        developer: { select: { name: true, email: true } },
        versions: {
          where: { isLatest: true },
          select: {
            version: true,
            darFileSize: true,
            sdkVersion: true,
            changelog: true,
            createdAt: true,
          },
          take: 1,
        },
        categories: { include: { category: { select: { name: true } } } },
        tags: { include: { tag: { select: { name: true } } } },
        _count: { select: { reviews: true, installations: true } },
      },
    }),
    db.app.count({ where }),
  ]);

  const serializedApps = apps.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    versions: app.versions.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apps Review</h1>
      <AppReviewTable
        apps={serializedApps}
        pagination={paginationMeta(total, page, pageSize)}
      />
    </div>
  );
}
