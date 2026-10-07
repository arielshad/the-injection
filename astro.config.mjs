// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

const site = (process.env.SITE_URL || "https://theinjection.dev").replace(/\/$/, "");

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
