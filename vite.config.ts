import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    react(),
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    watch: {
      ignored: ["**/node_modules/**", "**/.cache/**"],
    },
  },
  ssr: {
    external: ["pg", "pg-native", "net", "tls", "fs", "crypto", "stream", "path", "os", "util"],
    noExternal: [],
  },
  optimizeDeps: {
    exclude: ["pg", "pg-native"],
  },
});
