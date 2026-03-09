"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Server,
  Rocket,
  PlusCircle,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Users,
  FolderTree,
  Menu,
  X,
  Store,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type UserRole = "VALIDATOR" | "DEVELOPER" | "ADMIN";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItemsByRole: Record<UserRole, NavItem[]> = {
  VALIDATOR: [
    { label: "Overview", href: "/validator", icon: LayoutDashboard },
    { label: "My Apps", href: "/validator/apps", icon: Package },
    { label: "Nodes", href: "/validator/nodes", icon: Server },
    { label: "Deployments", href: "/validator/deployments", icon: Rocket },
    { label: "Licenses", href: "/validator/licenses", icon: Key },
    { label: "Install Requests", href: "/validator/install-requests", icon: ClipboardList },
  ],
  DEVELOPER: [
    { label: "Overview", href: "/developer", icon: LayoutDashboard },
    { label: "My Apps", href: "/developer/apps", icon: Package },
    { label: "New App", href: "/developer/apps/new", icon: PlusCircle },
    { label: "Requests", href: "/developer/requests", icon: ClipboardList },
    { label: "Analytics", href: "/developer/analytics", icon: BarChart3 },
  ],
  ADMIN: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Apps Review", href: "/admin/review", icon: ClipboardCheck },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Categories", href: "/admin/categories", icon: FolderTree },
  ],
};

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = navItemsByRole[role] ?? navItemsByRole.DEVELOPER;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <Store className="size-5" />
        <span>Cantosphere</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role.toLowerCase()}` && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Role: <span className="font-medium text-foreground">{role}</span>
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-background transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
        {sidebarContent}
      </aside>
    </>
  );
}
