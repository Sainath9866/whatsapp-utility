import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  webServer: {
    command: "npm run dev -- --webpack --port 3100",
    url: "http://localhost:3100",
    env: { QUEUE_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chrome", use: { channel: "chrome", viewport: { width: 1280, height: 900 } } },
    { name: "android-chrome", use: { channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "small-android-chrome", use: { channel: "chrome", viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
    { name: "desktop-webkit", use: { browserName: "webkit", viewport: { width: 1280, height: 900 } } },
    { name: "ios-webkit", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
