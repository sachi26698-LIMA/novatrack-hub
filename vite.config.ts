import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
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
