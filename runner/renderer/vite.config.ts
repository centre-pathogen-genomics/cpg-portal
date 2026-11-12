import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // The app serves the renderer from its own origin at `/`, so assets load
  // from there whatever route the window is on.
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../frontend/src", import.meta.url)),
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
  },
})
