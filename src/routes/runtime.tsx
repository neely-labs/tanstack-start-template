import { IconArrowUpRight, IconServerBolt } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useActionState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
  pageTitle,
} from "@/lib/seo.ts";
import {
  analyzeText,
  describeEnvironment,
  getRenderSnapshot,
} from "@/lib/server-runtime.ts";
import type { RenderSnapshot, TextAnalysis } from "@/lib/server-runtime.ts";
import { maxTextLength } from "@/lib/text-stats.ts";

const description =
  "How this template uses the TanStack Start execution model: server functions, a validated mutation, request middleware, a server route, and isomorphic code.";

export const Route = createFileRoute("/runtime")({
  loader: async () => await getRenderSnapshot(),
  component: RuntimePage,
  head: () =>
    createSeoHead({
      canonicalPath: "/runtime",
      description,
      structuredData: createGraph([
        createWebsiteSchema(),
        createWebPageSchema({
          description,
          name: "Runtime execution model",
          path: "/runtime",
        }),
      ]),
      title: pageTitle("Runtime"),
    }),
});

function RuntimePage() {
  const snapshot = Route.useLoaderData();

  return (
    <main
      className="mx-auto w-full max-w-4xl flex-1 px-5 py-20 sm:px-8 sm:py-28"
      id="main-content"
    >
      <Badge variant="secondary">Execution model</Badge>
      <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
        Code that knows where it runs.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
        TanStack Start splits one codebase across the server and the browser.
        This page exercises each seam so the boundary is observable rather than
        described.
      </p>

      <EnvironmentSection snapshot={snapshot} />
      <AnalyzerSection />
      <EndpointSection />
    </main>
  );
}

/** The environment description never changes, so nothing has to be observed. */
function subscribeToEnvironment() {
  return () => {
    // No teardown: there is no subscription to cancel.
  };
}

/**
 * Used on the server and during hydration, which keeps the first client render
 * identical to the server markup. React swaps in the client branch on the
 * commit that follows.
 */
function getServerEnvironment() {
  return null;
}

function EnvironmentSection({ snapshot }: { snapshot: RenderSnapshot }) {
  const clientEnvironment = useSyncExternalStore(
    subscribeToEnvironment,
    describeEnvironment,
    getServerEnvironment
  );

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        One function, two implementations
      </h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        <code className="text-foreground">createIsomorphicFn</code> keeps a
        server branch and a client branch behind one call. Each branch is
        stripped from the bundle it does not belong to.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Server branch</CardTitle>
            <CardDescription>
              Returned by a server function, which runs wherever the loader
              does: at build time for the prerendered HTML, then again on the
              server when the router revalidates after hydration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm break-all">
              {snapshot.environment}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Loader ran at {snapshot.renderedAt}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Client branch</CardTitle>
            <CardDescription>
              Read in the browser once hydration completes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm break-all">
              {clientEnvironment ?? "Waiting for hydration"}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface AnalyzerState {
  analysis: TextAnalysis | null;
  errorMessage: string | null;
  /** React resets an uncontrolled form after an action, so carry the input. */
  text: string;
}

const initialAnalyzerState: AnalyzerState = {
  analysis: null,
  errorMessage: null,
  text: "",
};

function AnalyzerSection() {
  const analyze = useServerFn(analyzeText);

  const [state, submitAnalysis, isPending] = useActionState(
    async (
      _previous: AnalyzerState,
      formData: FormData
    ): Promise<AnalyzerState> => {
      // A form field can also carry a File, which the server validator would
      // reject anyway; treat anything that is not text as empty input.
      const submitted = formData.get("text");
      const text =
        submitted === null || submitted instanceof File ? "" : submitted;

      try {
        return {
          analysis: await analyze({ data: { text } }),
          errorMessage: null,
          text,
        };
      } catch (error) {
        return {
          analysis: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : "The request could not be completed.",
          text,
        };
      }
    },
    initialAnalyzerState
  );

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        A validated server function
      </h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        Submitting calls a <code className="text-foreground">POST</code> server
        function through a React action. Its{" "}
        <code className="text-foreground">.validator</code> stage rejects blank
        or oversized input before the handler runs, and the handler body never
        ships to the browser.
      </p>

      <form action={submitAnalysis} className="mt-6">
        <label className="text-sm font-medium" htmlFor="analyzer-input">
          Text to analyze
        </label>
        <textarea
          aria-describedby={
            state.errorMessage === null ? "analyzer-hint" : "analyzer-error"
          }
          aria-invalid={state.errorMessage !== null}
          className="mt-2 block min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive"
          defaultValue={state.text}
          id="analyzer-input"
          maxLength={maxTextLength}
          name="text"
        />
        <p className="mt-2 text-xs text-muted-foreground" id="analyzer-hint">
          Up to {maxTextLength} characters. Validation runs on the server.
        </p>

        <Button className="mt-4" disabled={isPending} type="submit">
          {isPending ? "Analyzing…" : "Analyze on the server"}
        </Button>
      </form>

      <output aria-live="polite" className="mt-6 block">
        {state.errorMessage === null ? null : (
          <p className="text-sm text-destructive" id="analyzer-error">
            {state.errorMessage}
          </p>
        )}
        {state.analysis === null ? null : (
          <AnalysisResult analysis={state.analysis} />
        )}
      </output>
    </section>
  );
}

function AnalysisResult({ analysis }: { analysis: TextAnalysis }) {
  const measures = [
    { label: "Words", value: analysis.stats.words },
    { label: "Characters", value: analysis.stats.characters },
    { label: "Reading minutes", value: analysis.stats.readingMinutes },
  ] as const;

  return (
    <Card size="sm">
      <CardContent>
        <dl className="grid grid-cols-3 gap-4">
          {measures.map((measure) => (
            <div key={measure.label}>
              <dt className="text-xs text-muted-foreground">{measure.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {measure.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Computed by {analysis.environment} at {analysis.computedAt}.
        </p>
      </CardContent>
    </Card>
  );
}

function EndpointSection() {
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        A server route beside the pages
      </h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        <code className="text-foreground">src/routes/api/health.ts</code>{" "}
        answers with JSON instead of a document. It shares the same file-based
        routing, and every response it returns carries the security headers set
        by the request middleware in{" "}
        <code className="text-foreground">src/start.ts</code>.
      </p>
      <Button
        className="mt-6"
        nativeButton={false}
        render={
          <a
            aria-label="Open the health endpoint in a new tab"
            href="/api/health"
            rel="noreferrer"
            target="_blank"
          />
        }
        variant="outline"
      >
        <IconServerBolt aria-hidden="true" data-icon="inline-start" />
        Open /api/health
        <IconArrowUpRight aria-hidden="true" data-icon="inline-end" />
      </Button>
    </section>
  );
}
