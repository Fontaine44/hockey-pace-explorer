import { BarChart3 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const navigation = [{ label: "Overview", href: "/", icon: BarChart3 }];

function Navigation() {
  return (
    <nav aria-label="Primary navigation" className="flex gap-1 md:flex-col">
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )
          }
        >
          <item.icon className="size-4" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r bg-card p-4 md:block">
        <div className="mb-7 px-2 text-sm font-semibold tracking-tight">
          Hockey Pace Explorer
        </div>
        <Navigation />
      </aside>
      <header className="border-b bg-card px-4 py-3 md:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Hockey Pace Explorer</span>
          <Navigation />
        </div>
      </header>
      <main className="md:pl-56">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
