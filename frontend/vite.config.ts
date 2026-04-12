import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@emoji-mart") || id.includes("emoji-mart")) {
            return "vendor-emoji";
          }

          if (
            id.includes("socket.io-client") ||
            id.includes("engine.io-client") ||
            id.includes("socket.io-parser")
          ) {
            return "vendor-realtime";
          }

          if (id.includes("react-router")) {
            return "vendor-router";
          }

          if (
            id.includes("@radix-ui") ||
            id.includes("lucide-react") ||
            id.includes("sonner")
          ) {
            return "vendor-ui";
          }

          if (
            /node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ||
            id.includes("/react.js")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
