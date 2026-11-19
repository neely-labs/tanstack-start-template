import { IconHome, IconRefresh } from "@tabler/icons-react";
import { useLocation, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { Button, buttonVariants } from "@/components/ui/button.tsx";
import { reportCaughtError } from "@/lib/report-error.ts";

interface ErrorFallbackProps {
  /** Any thrown value, including null. */
  error: unknown;
  onRetry: () => void;
  showDetails?: boolean;
}

export function ErrorFallback({
  error,
  onRetry,
  showDetails = false,
}: ErrorFallbackProps) {
  const alertRef = useRef<HTMLElement>(null);

  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-5 py-20 sm:px-8 sm:py-28">
      {/*
       * React moves this tag into the document head. A failed route's own
       * robots tag stays beside it, and crawlers obey the stricter of the two.
       */}
      <meta content="noindex" name="robots" />
      <section
        aria-labelledby="error-heading"
        className="w-full max-w-2xl outline-none"
        ref={alertRef}
        role="alert"
        tabIndex={-1}
      >
        <h1
          className="text-4xl font-semibold tracking-display text-balance sm:text-5xl"
          id="error-heading"
        >
          This page couldn&apos;t finish loading.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          Try again. If the problem continues, return to the home page and start
          from there.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={onRetry} size="lg">
            <IconRefresh aria-hidden="true" data-icon="inline-start" />
            Try again
          </Button>
          <a
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href="/"
          >
            <IconHome aria-hidden="true" data-icon="inline-start" />
            Return home
          </a>
        </div>
        {showDetails ? (
          <details className="mt-8 border-t pt-5 text-sm text-muted-foreground">
            <summary className="font-medium text-foreground">
              Technical details
            </summary>
            <pre className="mt-3 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
              {error instanceof Error
                ? error.message
                : "An unexpected error occurred."}
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}

/**
 * The router's default error component, so a failed loader or a render error
 * on any route shows this page, on the server and in the browser alike. It
 * reports the error when it shows it, from the browser only. Retrying
 * invalidates the router, which reruns the loaders and resets the boundary
 * that caught a render error.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const path = useLocation({ select: (location) => location.pathname });

  useEffect(() => {
    reportCaughtError({ error, path });
  }, [error, path]);

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
