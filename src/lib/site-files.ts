import { siteConfig } from "./site-config.ts";

/**
 * Files that restate public identity. Generating them from `site-config.ts`
 * keeps renaming the project a one-file edit instead of a hunt through
 * `public/`, where a stale origin would point crawlers at the wrong sitemap.
 */
export const generatedSiteFiles = {
  "manifest.json": {
    contentType: "application/manifest+json",
    source: `${JSON.stringify(
      {
        background_color: siteConfig.themeColor,
        categories: ["developer", "productivity"],
        description: siteConfig.description,
        display: "standalone",
        icons: [
          {
            sizes: "64x64 32x32 24x24 16x16",
            src: "/favicon.ico",
            type: "image/x-icon",
          },
          {
            purpose: "any",
            sizes: "any",
            src: siteConfig.icon.path,
            type: siteConfig.icon.type,
          },
        ],
        id: "/",
        lang: siteConfig.language,
        name: siteConfig.name,
        short_name: siteConfig.shortName,
        start_url: "/",
        theme_color: siteConfig.themeColor,
      },
      null,
      2
    )}\n`,
  },
  "robots.txt": {
    contentType: "text/plain; charset=utf-8",
    source: `User-agent: *\nAllow: /\n\nSitemap: ${siteConfig.origin}/sitemap.xml\n`,
  },
} as const;
