import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the on-screen Next.js dev indicator (bottom-left).
  devIndicators: false,
  // Pin the workspace root so Turbopack ignores the stray lockfile in the home
  // directory when inferring the project root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
