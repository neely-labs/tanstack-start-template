import {
  IconArrowRight,
  IconBolt,
  IconCloudUpload,
  IconCode,
  IconRoute,
  IconShieldCheck,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { CopyCommand } from "@/components/copy-command.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { buttonVariants } from "@/components/ui/button.tsx";
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
import { siteConfig } from "@/lib/site-config.ts";
import { cn } from "@/lib/utils.ts";

const foundation = [
  {
    description:
      "File-based routing, SSR, prerendering, and a Nitro production server.",
    icon: IconRoute,
    title: "Application runtime",
  },
  {
    description:
      "Tailwind CSS 4 with shadcn/ui on Base UI, the Rhea style, Mist tokens, and Tabler icons.",
    icon: IconCode,
    title: "Interface system",
  },
  {
    description:
      "Ultracite coordinates Oxlint, Oxfmt, type-aware checks, and stricter anti-slop rules.",
    icon: IconShieldCheck,
    title: "Quality gate",
  },
  {
    description:
      "Prerendered metadata, sitemap output, robots policy, and a direct Vercel deployment path.",
    icon: IconCloudUpload,
    title: "Production path",
  },
] as const;

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () =>
    createSeoHead({
      canonicalPath: "/",
      description: siteConfig.description,
      structuredData: createGraph([
        createWebsiteSchema(),
        createWebPageSchema({
          description: siteConfig.description,
          name: siteConfig.name,
          path: "/",
        }),
      ]),
      title: pageTitle(),
    }),
});

function HomePage() {
  return (
    <main className="flex-1" id="main-content">
      <section className="relative isolate overflow-hidden">
        {/* Decorative backdrop: a faint dot grid that fades out at the edges. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)] bg-size-[22px_22px]"
        />
        <div
          aria-hidden="true"
          className="absolute -top-40 left-1/2 -z-10 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
          <div className="max-w-3xl">
            <Badge
              className="mb-6 gap-1.5"
              render={<Link to="/setup" />}
              variant="outline"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand"
              />
              Example page. Make it yours
              <IconArrowRight aria-hidden="true" data-icon="inline-end" />
            </Badge>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
              Start with the decisions already made.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              A lean TanStack Start baseline with production output, strict
              validation, usable SEO defaults, and agent-friendly feedback built
              in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className={cn(buttonVariants({ size: "lg" }))}
                to="/runtime"
              >
                See it run
                <IconArrowRight aria-hidden="true" data-icon="inline-end" />
              </Link>
              <a
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" })
                )}
                href="#included"
              >
                What is included
              </a>
            </div>
          </div>

          <Card className="bg-card/80 backdrop-blur-sm" size="sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <IconBolt aria-hidden="true" className="size-4 text-brand" />
                One handoff gate
              </CardTitle>
              <CardDescription>
                Local, pre-push, and CI use the same command.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CopyCommand command="pnpm validate" />
              <ol className="mt-5 grid gap-3 text-sm">
                {[
                  "Lint and formatting",
                  "TypeScript",
                  "Vitest",
                  "Nitro production build",
                  "Rendered SEO output",
                ].map((item, index) => (
                  <li className="flex items-center gap-3" key={item}>
                    <span
                      aria-hidden="true"
                      className="grid size-5 place-items-center rounded-full bg-brand/10 font-mono text-[0.6875rem] font-medium text-brand"
                    >
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y bg-muted/35" id="included">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              A small surface with a complete path.
            </h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              The starter keeps infrastructure reusable and leaves product
              decisions for the product.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {foundation.map((item) => {
              const Icon = item.icon;

              return (
                <article className="bg-background p-6 sm:p-8" key={item.title}>
                  <span className="grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon aria-hidden="true" className="size-5" stroke={1.6} />
                  </span>
                  <h3 className="mt-5 font-medium">{item.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
