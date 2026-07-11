import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
