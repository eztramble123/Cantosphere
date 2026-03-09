import { db } from "@/lib/db";
import { AppGrid } from "@/components/apps/app-grid";
import { AppSearch } from "@/components/apps/app-search";

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function AppsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const pageSize = 12;

  const where: Record<string, unknown> = { status: "PUBLISHED" };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.category) {
    where.categories = {
      some: { category: { slug: params.category } },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any =
    params.sort === "popular"
      ? { installations: { _count: "desc" } }
      : { createdAt: "desc" };

  const [apps, total, categories] = await Promise.all([
    db.app.findMany({
      where,
      include: {
        developer: { select: { id: true, name: true, image: true, username: true } },
        _count: { select: { installations: true, reviews: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.app.count({ where }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Browse Apps</h1>
        <p className="text-muted-foreground">
          Discover Daml applications for your Canton Network node
        </p>
      </div>

      <div className="mb-6">
        <AppSearch categories={categories} />
      </div>

      <AppGrid apps={apps} />

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (p) => (
              <a
                key={p}
                href={`/apps?${new URLSearchParams({ ...params, page: String(p) }).toString()}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-accent"
                }`}
              >
                {p}
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}
