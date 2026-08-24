import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { ErrorFallback } from "@/components/error-fallback.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { SiteHeader } from "@/components/site-header.tsx";
import { siteConfig } from "@/lib/site-config.ts";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  errorComponent: RootErrorComponent,
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: "/manifest.json", rel: "manifest" },
      { href: "/favicon.ico", rel: "icon", sizes: "any" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: "#f7f9f9", name: "theme-color" },
      { content: siteConfig.name, name: "application-name" },
      { content: siteConfig.name, property: "og:site_name" },
      { content: siteConfig.locale, property: "og:locale" },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start gap-4 px-5 py-24 sm:px-8">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-xl text-muted-foreground">
        This route does not exist in the starter.
      </p>
      <Link className="text-sm font-medium underline underline-offset-4" to="/">
        Return home
      </Link>
    </main>
  ),
  shellComponent: RootDocument,
});

function RootErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <ErrorFallback
      error={error}
      onRetry={() => {
        void router.invalidate();
      }}
      showDetails={import.meta.env.DEV}
    />
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.language}>
      <head>
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
