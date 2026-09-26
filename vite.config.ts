import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "Room 01" is the standalone reference viewer, not part of the app build.
  server: { open: true },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
