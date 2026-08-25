import { IconCheck } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import {
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
  pageTitle,
} from "@/lib/seo.ts";

const description =
  "The reusable decisions, deliberate omissions, and first replacement points in this TanStack Start template.";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () =>
    createSeoHead({
      canonicalPath: "/about",
      description,
      structuredData: createGraph([
        createWebsiteSchema(),
        createWebPageSchema({
          description,
          name: "About the template",
          path: "/about",
          type: "AboutPage",
        }),
      ]),
      title: pageTitle("About"),
    }),
});

const replacementPoints = [
  "Rename the package and update the site metadata in src/lib/site-config.ts.",
  "Replace the example routes while keeping the shared root document and SEO helpers.",
  "Choose a real canonical origin and replace the social preview asset.",
  "Write product-specific guidance in PRODUCT.md, DESIGN.md, and AGENTS.md.",
] as const;

function AboutPage() {
  return (
    <main
      className="mx-auto w-full max-w-4xl flex-1 px-5 py-20 sm:px-8 sm:py-28"
      id="main-content"
    >
      <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
        Infrastructure first. Product assumptions last.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
        This repository makes the mechanical decisions once, then exposes a few
        obvious seams for the next product to own.
      </p>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          Replace these first
        </h2>
        <ul className="mt-6 border-t">
          {replacementPoints.map((item) => (
            <li className="flex gap-3 border-b py-5 leading-7" key={item}>
              <IconCheck
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 text-muted-foreground"
                stroke={1.8}
              />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
