import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRoute,
  HeadContent,
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { NotFound } from "@/components/not-found.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { SiteHeader } from "@/components/site-header.tsx";
import { recoveryMeta } from "@/lib/seo.ts";
import { siteConfig } from "@/lib/site-config.ts";
import { themeScript } from "@/lib/theme.ts";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: ({ matches }) => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/manifest.json", rel: "manifest" },
      { href: "/favicon.ico", rel: "icon", sizes: "32x32" },
      { href: siteConfig.icon.path, rel: "icon", type: siteConfig.icon.type },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: siteConfig.themeColor, name: "theme-color" },
      { content: siteConfig.name, name: "application-name" },
      { content: siteConfig.name, property: "og:site_name" },
      { content: siteConfig.locale, property: "og:locale" },
      ...recoveryMeta(matches),
    ],
  }),
  // The router's default renders a missing URL and a not-found that a loader
  // throws. This one also puts a not-found boundary around every page, for
  // `notFound({ routeId: rootRouteId })` thrown while a component renders.
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets the `dark` class before React hydrates.
    <html lang={siteConfig.language} suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        <a
          className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground focus:not-sr-only"
          href="#main-content"
        >
          Skip to content
        </a>
        <div className="flex min-h-svh flex-col">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right", triggerMode: "fixed" }}
            plugins={[
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
