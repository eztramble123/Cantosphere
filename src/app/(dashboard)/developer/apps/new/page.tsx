import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AppForm } from "@/components/developer/app-form";

export default async function NewAppPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <AppForm categories={categories} />
    </div>
  );
}
