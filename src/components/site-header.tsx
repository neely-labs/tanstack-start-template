import { Link } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config.ts";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          aria-label={`${siteConfig.name} home`}
          className="inline-flex items-center gap-2.5 font-semibold tracking-tight"
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
