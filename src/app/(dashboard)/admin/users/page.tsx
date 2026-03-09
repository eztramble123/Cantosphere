import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { UsersTable } from "@/components/admin/users-table";
import { paginate, paginationMeta } from "@/lib/utils/pagination";
import type { UserRole } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{ search?: string; role?: string; page?: string }>;
}

const validRoles: UserRole[] = ["VALIDATOR", "DEVELOPER", "ADMIN"];

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const search = params.search || "";
  const role = validRoles.includes(params.role as UserRole)
    ? (params.role as UserRole)
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 20;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    where.role = role;
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      ...paginate(page, pageSize),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: { apps: true, reviews: true, nodes: true, installations: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <UsersTable
        users={serializedUsers}
        pagination={paginationMeta(total, page, pageSize)}
      />
    </div>
  );
}
