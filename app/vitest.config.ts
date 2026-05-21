import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    env: {
      SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
      UNSUB_SECRET: "test-unsub-secret-32-characters-long",
      CRON_SECRET: "test-cron-secret-32-characters",
      MONGO_URI: "memory://",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
