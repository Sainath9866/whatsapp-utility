import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep browser tests isolated from the developer’s running server.
  distDir: process.env.QUEUE_E2E === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
