"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface AppFormProps {
  categories: Category[];
  app?: {
    id: string;
    name: string;
    description: string;
    longDescription?: string | null;
    license?: string | null;
    repoUrl?: string | null;
    websiteUrl?: string | null;
  };
}

export function AppForm({ categories, app }: AppFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const isEditing = !!app;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      longDescription: (formData.get("longDescription") as string) || undefined,
      license: (formData.get("license") as string) || undefined,
      repoUrl: (formData.get("repoUrl") as string) || undefined,
      websiteUrl: (formData.get("websiteUrl") as string) || undefined,
      categoryIds: selectedCategories,
    };

    try {
      const url = isEditing ? `/api/apps/${app.id}` : "/api/apps";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save app");
      }

      const data = await res.json();
      router.push(`/developer/apps/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit App" : "Create New App"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your app listing details"
            : "Fill in the details to list your Daml application"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">App Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={app?.name}
              placeholder="My Daml App"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={app?.description}
              placeholder="A brief description of your app..."
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="longDescription">
              Detailed Description (optional)
            </Label>
            <Textarea
              id="longDescription"
              name="longDescription"
              defaultValue={app?.longDescription || ""}
              placeholder="A more detailed description with features, requirements, etc."
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="license">License</Label>
              <Input
                id="license"
                name="license"
                defaultValue={app?.license || ""}
                placeholder="Apache-2.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repoUrl">Repository URL</Label>
              <Input
                id="repoUrl"
                name="repoUrl"
                defaultValue={app?.repoUrl || ""}
                placeholder="https://github.com/..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              defaultValue={app?.websiteUrl || ""}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  variant={
                    selectedCategories.includes(cat.id)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => toggleCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Update" : "Create"} App
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
