import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { markdownGuidePlugin } from "./src/plugins/markdownGuidePlugin";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // Pass the absolute path to our guide content directory
    markdownGuidePlugin(path.join(__dirname, "content/guide")),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      clientPort: 5173
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
});
