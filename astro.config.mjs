import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://doctor.yokoten.app",
  srcDir: "./web/src",
  publicDir: "./web/public",
  outDir: "./dist",
  devToolbar: { enabled: false },
  // policy allows no inline script or style
  build: { format: "file", inlineStylesheets: "never" },
  vite: { build: { assetsInlineLimit: 0 } }
});
