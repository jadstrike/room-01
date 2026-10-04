import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { coin } from "./api/_moth.js";

/**
 * The /api functions Vercel runs in production, served by the dev server too,
 * with MOTH_API_KEY read from the git-ignored .env. The key only ever lives on
 * the server: it has no VITE_ prefix, so it is never bundled.
 */
function mothApi(): Plugin {
  return {
    name: "moth-api",
    configureServer(server) {
      process.env.MOTH_API_KEY ??= loadEnv(server.config.mode, process.cwd(), "").MOTH_API_KEY;
      server.middlewares.use("/api/coin", (req, res) => {
        // Connect strips the mount path; the handler expects the full one.
        req.url = `/api/coin${req.url ?? ""}`;
        void coin(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mothApi()],
  // "Room 01" is the standalone reference viewer, not part of the app build.
  server: { open: true },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
