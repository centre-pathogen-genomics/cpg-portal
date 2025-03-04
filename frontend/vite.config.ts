import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite(),
    { // https://jupyterlite.readthedocs.io/en/stable/howto/content/python.html#synchronous-communication-with-the-kernel-over-atomics-wait-via-sharedarraybuffer
      name: 'add-jupyter-headers', 
      configureServer(server) {
        // Middleware to add headers to every response
        server.middlewares.use((req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          // Optionally include CORP
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          next();
        });
      },
    },

  ],
})
