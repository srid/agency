// @ts-check

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Project page deploy: served from https://srid.github.io/agency/
// When a custom domain lands, drop `base` (and `site`) accordingly.
const SITE = process.env.SITE ?? "https://srid.github.io";
const BASE = process.env.BASE ?? "/agency/";
const DEV_PORT = 4321;

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: "ignore",
  server: { port: DEV_PORT, host: "127.0.0.1" },
  vite: {
    plugins: [tailwindcss()],
  },
});
