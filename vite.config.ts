// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    build: {
      // Split big, rarely-changing vendor code into long-lived cacheable
      // chunks so app updates don't invalidate the whole payload and the
      // browser can download them in parallel.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-tanstack";
            if (id.includes("react-dom") || /node_modules\/react(\/|$)/.test(id))
              return "vendor-react";
            return;
          },
        },
      },
    },
  },

});
