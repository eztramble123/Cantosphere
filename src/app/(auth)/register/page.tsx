"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Server, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const roles = [
  {
    value: "VALIDATOR" as const,
    label: "Validator",
    icon: Server,
    description:
      "Run Canton nodes and deploy applications from the marketplace to your infrastructure.",
  },
  {
    value: "DEVELOPER" as const,
    label: "Developer",
    icon: Code2,
    description:
      "Build and publish Daml applications to Cantosphere for validators to discover.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selectedRole) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      if (!res.ok) throw new Error("Failed to set role");
      const route = selectedRole === "DEVELOPER" ? "/developer" : "/validator";
      router.push(route);
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </div>
        <CardTitle className="mt-4 text-2xl">Choose your role</CardTitle>
        <CardDescription>
          Select how you want to use Cantosphere. You can change this later
          in settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => setSelectedRole(role.value)}
            className={cn(
              "flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
              selectedRole === role.value &&
                "border-primary bg-primary/5 ring-1 ring-primary"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <role.icon className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{role.label}</p>
              <p className="text-sm text-muted-foreground">
                {role.description}
              </p>
            </div>
          </button>
        ))}

        <Button
          className="w-full"
          size="lg"
          disabled={!selectedRole || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Setting up..." : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
