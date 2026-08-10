import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
const buildDate = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
const appVersion = buildCommit ? `v${buildDate}+${buildCommit}` : "vlocal";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    // allowedHosts = the web addresses Vite is willing to answer to
    allowedHosts: ["stout-hence-good.ngrok-free.dev", ".barbi.beer"], // added ".barbi.beer" so ssdev.barbi.beer works
    hmr: {
      overlay: false,
    },
    watch: {
      usePolling: false,
    },
  },
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
