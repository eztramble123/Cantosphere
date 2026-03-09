"use client";

import { useState, useRef } from "react";
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
import { Upload, FileArchive, Loader2 } from "lucide-react";

interface DarUploadProps {
  appId: string;
}

export function DarUpload({ appId }: DarUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("file", file);

    try {
      const res = await fetch(`/api/apps/${appId}/versions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload version");
      }

      router.push(`/developer/apps/${appId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload New Version</CardTitle>
        <CardDescription>
          Upload a DAR file to create a new version of your app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              name="version"
              placeholder="1.0.0"
              pattern="\d+\.\d+\.\d+(-[\w.]+)?"
              title="Must be semver format (e.g., 1.0.0)"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">Changelog (optional)</Label>
            <Textarea
              id="changelog"
              name="changelog"
              placeholder="What's new in this version..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>DAR File</Label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <>
                  <FileArchive className="mb-2 h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload a .dar file
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".dar"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !file}>
              {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload Version
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
