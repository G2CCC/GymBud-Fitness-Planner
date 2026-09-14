import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./client/src/test/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/**/*.test.tsx"],
        },
      },
    ],
  },
});
