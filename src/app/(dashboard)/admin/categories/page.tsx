import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CategoryList } from "@/components/admin/category-list";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { apps: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categories</h1>
      <CategoryList categories={categories} />
    </div>
  );
}
