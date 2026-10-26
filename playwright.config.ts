import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "4173";
if (!/^[1-9]\d{0,4}$/u.test(port) || Number(port) > 65_535) {
  throw new Error("E2E_PORT must be an integer from 1 to 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

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
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start",
    env: { NITRO_HOST: "127.0.0.1", NITRO_PORT: port },
    reuseExistingServer: false,
    timeout: 30_000,
    url: `${baseURL}/api/health`,
  },
});
