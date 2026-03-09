import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AppGrid } from "@/components/apps/app-grid";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const category = await db.category.findUnique({
    where: { slug },
  });

  if (!category) notFound();

  const apps = await db.app.findMany({
    where: {
      status: "PUBLISHED",
      categories: { some: { categoryId: category.id } },
    },
    include: {
      developer: {
        select: { id: true, name: true, image: true, username: true },
      },
      _count: { select: { installations: true, reviews: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground">{category.description}</p>
        )}
      </div>
      <AppGrid apps={apps} />
    </div>
  );
}
