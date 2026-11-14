import type { PublicPath } from "./public-routes.ts";
import { siteConfig } from "./site-config.ts";

const defaultRobots =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

export type JsonLdValue =
  | boolean
  | number
  | string
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue };

export type StructuredData = Record<string, JsonLdValue>;

/** The schema.org types a page node can take; `pnpm seo:verify` looks for one. */
export const webPageTypes = ["AboutPage", "CollectionPage", "WebPage"] as const;

interface SeoHeadOptions {
  canonicalPath: PublicPath;
  description: string;
  noIndex?: boolean;
  structuredData?: StructuredData;
  title: string;
  type?: "article" | "website";
}

interface WebPageSchemaOptions {
  description: string;
  name: string;
  path: PublicPath;
  type?: (typeof webPageTypes)[number];
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${siteConfig.origin}/`).toString();
}

/**
 * Composes a document title from the configured site name, so renaming the
 * project in `site-config.ts` renames every page with it. Called without a page
 * name it returns the site name alone, which is what the home route wants.
 */
export function pageTitle(page?: string): string {
  return page === undefined ? siteConfig.name : `${page} | ${siteConfig.name}`;
}

/** Document titles for the two recovery pages, before the site name. */
export const recoveryTitles = {
  error: "Page couldn't load",
  notFound: "Page not found",
} as const;

/** The parts of a route match the recovery head reads. */
interface MatchState {
  readonly status: string;
  /**
   * Set on the match whose not-found boundary renders a missing URL. The field
   * is the router's own; `src/router.test.tsx` fails if it stops being set.
   */
  readonly _notFound?: boolean;
}

/**
 * The root route's title for a recovery page, so the tab never shows a bare
 * URL. A missing URL matches only the root, so this is the page's title. When
 * a route fails, that route's head still runs and its own title wins. The
 * recovery components mark their pages `noindex` themselves, because a render
 * error leaves every match successful and only the component knows.
 */
export function recoveryMeta(matches: readonly MatchState[]) {
  if (matches.some((match) => match.status === "error")) {
    return [{ title: pageTitle(recoveryTitles.error) }];
  }
  if (
    matches.some(
      (match) => match.status === "notFound" || match._notFound === true
    )
  ) {
    return [{ title: pageTitle(recoveryTitles.notFound) }];
  }
  return [];
}

export function createSeoHead({
  canonicalPath,
  description,
  noIndex = false,
  structuredData,
  title,
  type = "website",
}: SeoHeadOptions) {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(siteConfig.socialImage.path);
  const robots = noIndex ? "noindex, nofollow" : defaultRobots;

  return {
    links: [{ href: canonicalUrl, rel: "canonical" }],
    meta: [
      { title },
      { content: description, name: "description" },
      { content: robots, name: "robots" },
      { content: title, property: "og:title" },
      { content: description, property: "og:description" },
      { content: type, property: "og:type" },
      { content: canonicalUrl, property: "og:url" },
      { content: imageUrl, property: "og:image" },
      { content: siteConfig.socialImage.type, property: "og:image:type" },
      {
        content: String(siteConfig.socialImage.width),
        property: "og:image:width",
      },
      {
        content: String(siteConfig.socialImage.height),
        property: "og:image:height",
      },
      { content: siteConfig.socialImage.alt, property: "og:image:alt" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: title, name: "twitter:title" },
      { content: description, name: "twitter:description" },
      { content: imageUrl, name: "twitter:image" },
      { content: siteConfig.socialImage.alt, name: "twitter:image:alt" },
      ...(structuredData === undefined
        ? []
        : [{ "script:ld+json": structuredData }]),
    ],
  };
}

export function createWebsiteSchema() {
  return {
    "@id": `${siteConfig.origin}/#website`,
    "@type": "WebSite",
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    name: siteConfig.name,
    url: `${siteConfig.origin}/`,
  } satisfies StructuredData;
}

export function createWebPageSchema({
  description,
  name,
  path,
  type = "WebPage",
}: WebPageSchemaOptions) {
  const url = absoluteUrl(path);

  return {
    "@id": `${url}#webpage`,
    "@type": type,
    description,
    inLanguage: siteConfig.language,
    isPartOf: { "@id": `${siteConfig.origin}/#website` },
    name,
    url,
  } satisfies StructuredData;
}

export function createGraph(items: readonly StructuredData[]) {
  return {
    "@context": "https://schema.org",
    "@graph": items,
  } satisfies StructuredData;
}
