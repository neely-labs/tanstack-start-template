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

interface SeoHeadOptions {
  canonicalPath: string;
  description: string;
  noIndex?: boolean;
  structuredData?: StructuredData;
  title: string;
  type?: "article" | "website";
}

interface WebPageSchemaOptions {
  description: string;
  name: string;
  path: string;
  type?: "AboutPage" | "CollectionPage" | "WebPage";
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${siteConfig.origin}/`).toString();
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
