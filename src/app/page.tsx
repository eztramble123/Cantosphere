import Link from "next/link";
import { Store, Rocket, Code2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: Search,
    title: "Discover Apps",
    description:
      "Browse a curated marketplace of Canton-powered applications built for the decentralized network.",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description:
      "Deploy apps directly to your Canton nodes with automated DAR package management and configuration.",
  },
  {
    icon: Code2,
    title: "Developer Tools",
    description:
      "Publish, version, and manage your Daml applications with built-in analytics and review workflows.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex items-center justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Store className="size-8" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Cantosphere
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              The marketplace for Canton Network. Discover, deploy, and manage
              Daml applications across your decentralized infrastructure.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/apps">Browse Apps</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/developer/apps/new">Publish Your App</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/40 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything you need for Canton apps
            </h2>
            <p className="mt-3 text-muted-foreground">
              A complete platform for discovering, deploying, and publishing
              applications on the Canton Network.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardHeader>
                  <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Simple Footer for Landing */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Cantosphere. All rights reserved.</p>
      </footer>
    </div>
  );
}
