import Link from "next/link";
import { db } from "@/lib/db";
import { FolderTree } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    include: {
      _count: {
        select: {
          apps: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Categories</h1>
        <p className="text-muted-foreground">
          Browse Daml applications by category
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((category) => (
          <Link key={category.id} href={`/categories/${category.slug}`}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FolderTree className="size-5 text-primary" />
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {category.description && (
                  <CardDescription className="mb-2">
                    {category.description}
                  </CardDescription>
                )}
                <p className="text-sm text-muted-foreground">
                  {category._count.apps}{" "}
                  {category._count.apps === 1 ? "app" : "apps"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}

        {categories.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">
            No categories yet.
          </p>
        )}
      </div>
    </div>
  );
}
