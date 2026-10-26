import { IconArrowLeft } from "@tabler/icons-react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRoute,
  HeadContent,
  Link,
  ScriptOnce,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { ErrorFallback } from "@/components/error-fallback.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { SiteHeader } from "@/components/site-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { siteConfig } from "@/lib/site-config.ts";
import { themeScript } from "@/lib/theme.ts";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  errorComponent: RootErrorComponent,
  head: () => ({
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
    ],
  }),
  notFoundComponent: () => (
    <main
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center px-5 py-20 sm:px-8 sm:py-28"
      id="main-content"
    >
      <p className="font-mono text-sm font-medium text-brand">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
        This route does not exist. Check the address, or head back to the home
        page.
      </p>
      <Button
        className="mt-8"
        nativeButton={false}
        render={<Link to="/" />}
        size="lg"
      >
        <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
        Return home
      </Button>
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
