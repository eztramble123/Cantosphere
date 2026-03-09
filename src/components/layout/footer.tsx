import Link from "next/link";
import { Store } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Store className="size-4" />
            <span>Cantosphere</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/apps"
              className="transition-colors hover:text-foreground"
            >
              Browse
            </Link>
            <Link
              href="/categories"
              className="transition-colors hover:text-foreground"
            >
              Categories
            </Link>
            <Link
              href="/docs"
              className="transition-colors hover:text-foreground"
            >
              Documentation
            </Link>
            <Link
              href="/support"
              className="transition-colors hover:text-foreground"
            >
              Support
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Cantosphere. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
