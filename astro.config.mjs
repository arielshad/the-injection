// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

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
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
