import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  reporter: "list",
  retries: process.env.CI === "true" ? 1 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start",
    env: { NITRO_HOST: "127.0.0.1", NITRO_PORT: "4173" },
    reuseExistingServer: false,
    timeout: 30_000,
    url: "http://127.0.0.1:4173/api/health",
  },
});
