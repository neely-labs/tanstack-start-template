import { IconStack2 } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config.ts";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          aria-label={`${siteConfig.name} home`}
          className="inline-flex items-center gap-2 font-semibold tracking-tight"
          to="/"
        >
          <IconStack2 aria-hidden="true" className="size-5" stroke={1.7} />
          <span>Start / TS</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-1">
            {siteConfig.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  activeProps={{ className: "text-foreground" }}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  to={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
