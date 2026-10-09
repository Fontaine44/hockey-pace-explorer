import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

const navigation = [
  { label: "What is pace?", href: "/" },
  { label: "Pace & outcomes", href: "/pace-outcomes" },
  { label: "Game review", href: "/game-review" },
];

function Navigation() {
  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap gap-1">
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="relative shrink-0 border-b bg-card">
        <div className="flex min-h-14 max-w-6xl items-center gap-8 px-5 py-3">
          <span className="shrink-0 text-sm font-semibold tracking-tight">
            Hockey Pace Explorer
          </span>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Navigation />
        </div>
        <span className="absolute right-5 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm text-gray-500">
          Built by Raphael Fontaine
        </span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex h-full min-h-0 w-full flex-col p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
