// @ts-check

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Custom domain — agency.srid.ca, served from GitHub Pages via the
// website/public/CNAME file. Override via SITE env if you ever need to
// preview a different host.
const SITE = process.env.SITE ?? "https://agency.srid.ca";
const DEV_PORT = 4321;

export default defineConfig({
  site: SITE,
  trailingSlash: "ignore",
  server: { port: DEV_PORT, host: "127.0.0.1" },
  vite: {
    plugins: [tailwindcss()],
  },
});
