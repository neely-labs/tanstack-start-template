import { IconHome, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button.tsx";

interface ErrorFallbackProps {
  error: Error;
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
    <main
      className="mx-auto flex w-full max-w-4xl flex-1 items-center px-5 py-20 sm:px-8 sm:py-28"
      id="main-content"
    >
      <section
        aria-labelledby="error-heading"
        className="w-full max-w-2xl outline-none"
        ref={alertRef}
        role="alert"
        tabIndex={-1}
      >
        <h1
          className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl"
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
          <Button
            nativeButton={false}
            render={<a aria-label="Return home" href="/" />}
            size="lg"
            variant="outline"
          >
            <IconHome aria-hidden="true" data-icon="inline-start" />
            Return home
          </Button>
        </div>
        {showDetails ? (
          <details className="mt-8 border-t pt-5 text-sm text-muted-foreground">
            <summary className="font-medium text-foreground">
              Technical details
            </summary>
            <pre className="mt-3 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
              {error.message}
            </pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}
