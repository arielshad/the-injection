// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { readFileSync } from "node:fs";

// lastmod per story page from the feed, so crawlers re-fetch only what changed.
const feedData = JSON.parse(readFileSync(new URL("./src/data/items.json", import.meta.url), "utf8"));
const lastmod = new Map(feedData.items.map((i) => [`/items/${i.id}/`, i.publishDate]));

// One variable decides where the site lives. On a custom domain it is just the
// origin; on a GitHub Pages project site it carries the repo path, which
// becomes Astro's `base`.
const siteUrl = new URL((process.env.SITE_URL || "https://theinjection.dev").replace(/\/$/, "") + "/");

export default defineConfig({
  site: siteUrl.origin,
  base: siteUrl.pathname,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [
    react(),
    sitemap({
      serialize(item) {
        const path = new URL(item.url).pathname.slice(siteUrl.pathname.length - 1);
        const mod = lastmod.get(path) ?? (path === "/" || path.startsWith("/category/") ? feedData.generatedAt : undefined);
        return mod ? { ...item, lastmod: mod } : item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
