import { IconArrowUpRight } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button.tsx";
import {
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
  pageTitle,
} from "@/lib/seo.ts";
import { siteConfig } from "@/lib/site-config.ts";
import { cn } from "@/lib/utils.ts";

const description =
  "The first replacement points for turning this TanStack Start template into your own application.";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/setup",
      description,
      structuredData: createGraph([
        createWebsiteSchema(),
        createWebPageSchema({
          description,
          name: "Make it yours",
          path: "/setup",
        }),
      ]),
      title: pageTitle("Setup"),
    }),
});

const steps = [
  {
    detail: (
      <>
        Set the name, description, and origin in{" "}
        <code>src/lib/site-config.ts</code>, and the package name in{" "}
        <code>package.json</code>.
      </>
    ),
    title: "Rename the project",
  },
  {
    detail: (
      <>
        Change <code>--brand</code> in <code>src/styles.css</code> and replace
        the logo, favicon, and social card in <code>public/</code>.
      </>
    ),
    title: "Pick an accent and brand assets",
  },
  {
    detail: (
      <>
        Rewrite or delete the routes in <code>src/routes</code>. The root
        document, SEO helpers, and recovery states stay.
      </>
    ),
    title: "Replace the example pages",
  },
  {
    detail: (
      <>
        Describe the product in <code>PRODUCT.md</code>, <code>DESIGN.md</code>,
        and <code>AGENTS.md</code> so people and agents build the right thing.
      </>
    ),
    title: "Write the product guidance",
  },
] as const;

function SetupPage() {
  return (
    <main
      className="mx-auto w-full max-w-4xl flex-1 px-5 py-20 sm:px-8 sm:py-28"
      id="main-content"
      tabIndex={-1}
    >
      <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
        Make it yours.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
        Infrastructure first, product assumptions last. The mechanical decisions
        are made once; these are the seams the next product owns.
      </p>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          Replace these first
        </h2>
        <ol className="mt-6 border-t">
          {steps.map((step, index) => (
            <li className="flex gap-4 border-b py-6" key={step.title}>
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 font-mono text-sm font-medium text-brand"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="mt-1.5 leading-7 text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <a
          className={cn(
            buttonVariants({ className: "mt-8", variant: "outline" })
          )}
          href={`${siteConfig.templateUrl}/blob/main/docs/template-setup.md`}
        >
          Read the full setup guide
          <IconArrowUpRight aria-hidden="true" data-icon="inline-end" />
        </a>
      </section>
    </main>
  );
}
