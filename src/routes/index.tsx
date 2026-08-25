import {
  IconArrowRight,
  IconBolt,
  IconCloudUpload,
  IconCode,
  IconRoute,
  IconShieldCheck,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";

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
import { siteConfig } from "@/lib/site-config.ts";

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
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
        <div className="max-w-3xl">
          <Badge className="mb-6" variant="secondary">
            Ready to build
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
            <Button
              nativeButton={false}
              render={<Link to="/about" />}
              size="lg"
            >
              Review the baseline
              <IconArrowRight aria-hidden="true" data-icon="inline-end" />
            </Button>
            <Button
              nativeButton={false}
              render={<a aria-label="See what is included" href="#included" />}
              size="lg"
              variant="outline"
            >
              See what is included
            </Button>
          </div>
        </div>

        <Card className="bg-card/80" size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <IconBolt aria-hidden="true" className="size-4" />
              One handoff gate
            </CardTitle>
            <CardDescription>
              Local, pre-push, and CI use the same command.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded-lg bg-muted px-4 py-3 text-sm font-medium">
              pnpm validate
            </code>
            <ol className="mt-5 grid gap-3 text-sm">
              {[
                "Lint and formatting",
                "TypeScript",
                "Vitest",
                "Nitro production build",
                "Rendered SEO output",
              ].map((item) => (
                <li className="flex items-center gap-3" key={item}>
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-primary"
                  />
                  {item}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
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
          <div className="mt-10 border-t">
            {foundation.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  className="grid gap-4 border-b py-6 sm:grid-cols-[2rem_14rem_1fr] sm:items-start"
                  key={item.title}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                    stroke={1.6}
                  />
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="max-w-2xl leading-7 text-muted-foreground">
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
