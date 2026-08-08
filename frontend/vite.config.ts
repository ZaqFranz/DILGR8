import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    // Vite blocks requests whose Host header isn't localhost by default (an
    // anti DNS-rebinding measure) - only relax it when explicitly opted in
    // (e.g. for a temporary cloudflared tunnel demo), never by default.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS ? process.env.VITE_ALLOWED_HOSTS.split(",") : undefined,
  },
});
