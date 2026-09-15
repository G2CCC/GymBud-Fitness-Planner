import "dotenv/config";
import { defineConfig } from "@playwright/test";

const e2eUserId = process.env.DEMO_USER_ID ?? "e2e-demo-user";
process.env.DEMO_USER_ID = e2eUserId;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  globalSetup: "./tests/e2e/support/global-setup.ts",
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start:e2e --workspace @fitness/server",
      url: "http://localhost:3000/health",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        AI_PROVIDER: "fake",
        DEMO_USER_ID: e2eUserId,
        NODE_ENV: "development",
        PORT: "3000",
      },
    },
    {
      command: "npm run dev --workspace @fitness/client -- --host localhost",
      url: "http://localhost:5173",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: "http://localhost:3000/api",
      },
    },
  ],
});
