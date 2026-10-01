import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { FreeForDialog } from "@/components/mpla/FreeForDialog";
import { Button } from "@/components/ui/button";
import { useMyPlaAuth } from "@/hooks/use-mypla-auth";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/current", label: "Current" },
  { to: "/upcoming", label: "Upcoming" },
  { to: "/explore", label: "Explore" },
  { to: "/schedule", label: "Schedule" },
  { to: "/reflect", label: "Reflect" },
  { to: "/profile", label: "Profile" },
] as const;

/** App frame: brand, primary navigation, and the always-available quick action. */
export function MyPlaShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { enabled, user, signOut } = useMyPlaAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-lg font-semibold tracking-tight">
            My<span className="text-primary">PLA</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                activeProps={{ className: "bg-secondary text-secondary-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {enabled && user ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSignOutError(null);
                  void signOut().catch(() => setSignOutError("Sign out failed. Please try again."));
                }}
              >
                Sign out
              </Button>
            </div>
          ) : null}
          <FreeForDialog />
        </div>
        {signOutError ? (
          <p role="alert" className="mx-auto max-w-6xl px-4 pb-2 text-xs text-destructive">
            {signOutError}
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="hero-gradient mb-6 rounded-2xl border border-border p-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground">
        MyPLA suggests; you decide. Assistant changes always appear as proposals you approve.
      </footer>
    </div>
  );
}
