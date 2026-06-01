import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 5000,
      allowedHosts: true,
    },
    ssr: {
      // Externalize ws so Vite SSR doesn't bundle it — Node.js loads it natively via require()
      external: ["ws"],
      noExternal: [],
    },
  },
});
