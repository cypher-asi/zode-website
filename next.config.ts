import type { NextConfig } from "next";

// Next dev tooling (HMR, React Refresh) needs eval; production does not.
const scriptSrc = `script-src 'self' 'unsafe-inline'${
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
}`;

// 'unsafe-inline' for scripts is required by Next's inline RSC bootstrap and
// the theme-init snippet; tightening to nonces is a possible follow-up.
const contentSecurityPolicy = [
  scriptSrc,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Hide the on-screen Next.js dev indicator (bottom-left).
  devIndicators: false,
  // Pin the workspace root so Turbopack ignores the stray lockfile in the home
  // directory when inferring the project root.
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
