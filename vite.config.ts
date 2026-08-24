import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import { publicPaths } from "./src/lib/public-routes.ts";
import { siteConfig } from "./src/lib/site-config.ts";

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
  ],
  resolve: { tsconfigPaths: true },
});

export default config;
