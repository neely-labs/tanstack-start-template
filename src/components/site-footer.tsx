import { Link } from "@tanstack/react-router";

import { siteConfig } from "@/lib/site-config.ts";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 text-sm sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="max-w-sm">
          <p className="inline-flex items-center gap-2 font-medium">
            <img
              alt=""
              className="size-5"
              height={20}
              src={siteConfig.icon.path}
              width={20}
            />
            {siteConfig.name}
          </p>
          <p className="mt-2 leading-6 text-muted-foreground">
            {siteConfig.description}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    to={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-muted-foreground">
            Built from{" "}
            <a
              className="font-medium text-foreground underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
              href={siteConfig.templateUrl}
            >
              TanStack Start Template
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
