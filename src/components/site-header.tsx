import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle.tsx";
import { siteConfig } from "@/lib/site-config.ts";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          aria-label={`${siteConfig.name} home`}
          className="inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          to="/"
        >
          {/* Decorative: the link is already named by its aria-label. */}
          <img
            alt=""
            className="size-6 shrink-0"
            height={24}
            src={siteConfig.icon.path}
            width={24}
          />
          <span className="hidden sm:inline">{siteConfig.name}</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Primary navigation">
            <ul className="flex items-center gap-0.5 sm:gap-1">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    activeOptions={{ exact: item.href === "/" }}
                    activeProps={{
                      className: "bg-muted font-medium text-foreground",
                    }}
                    className="rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-3"
                    to={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
