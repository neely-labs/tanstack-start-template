import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { publicPaths } from "./src/lib/public-routes.ts";
import { siteConfig } from "./src/lib/site-config.ts";
import { generatedSiteFiles } from "./src/lib/site-files.ts";

/**
 * Emits the identity files derived from `site-config.ts` into the client
 * output and serves the same content in development.
 *
 * `enforce: "pre"` is load-bearing: the development middleware has to be
 * registered before the application's catch-all handler, which would otherwise
 * answer `/robots.txt` with the document shell. It keeps the plugin's position
 * in the array from mattering, since a build alone would not reveal the
 * difference.
 */
function siteFiles(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = request.url?.split("?")[0]?.replace(/^\//u, "") ?? "";
        const match = Object.entries(generatedSiteFiles).find(
          ([fileName]) => fileName === name
        );

        if (match === undefined) {
          next();
          return;
        }

        const [, file] = match;
        response.setHeader("content-type", file.contentType);
        response.end(file.source);
      });
    },
    enforce: "pre",
    generateBundle() {
      if (this.environment.name !== "client") {
        return;
      }

      for (const [fileName, file] of Object.entries(generatedSiteFiles)) {
        this.emitFile({ fileName, source: file.source, type: "asset" });
      }
    },
    name: "site-files",
  };
}

const config = defineConfig({
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      pages: publicPaths.map((path) => ({ path })),
      prerender: {
        crawlLinks: false,
        enabled: true,
        failOnError: true,
      },
      sitemap: {
        enabled: true,
        host: siteConfig.origin,
      },
    }),
    nitro(),
    viteReact(),
    siteFiles(),
  ],
  resolve: { tsconfigPaths: true },
});

export default config;
