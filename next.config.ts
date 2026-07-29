import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Every asset this site loads is same-origin: `next/font/google` self-hosts at
// build time, the 3D model and images come from /public, and the only network
// call is the same-origin /api/leads POST. External URLs in content are plain
// anchors, so nothing here needs a cross-origin allowance.
//
// 'unsafe-inline' for scripts is required by Next's inline RSC bootstrap and the
// theme-init snippet. Replacing it with nonces would force every page to render
// dynamically and lose CDN caching, so it stays; `script-src-attr 'none'` blocks
// the inline-handler (onclick=) attack surface that 'unsafe-inline' would
// otherwise open. Dev additionally needs eval for HMR and React Refresh.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Deny every powerful browser feature; this site uses none of them.
const permissionsPolicy = [
  "accelerometer",
  "autoplay",
  "camera",
  "display-capture",
  "encrypted-media",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "usb",
  "xr-spatial-tracking",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  // Hide the on-screen Next.js dev indicator (bottom-left).
  devIndicators: false,
  // Pin the workspace root so Turbopack ignores the stray lockfile in the home
  // directory when inferring the project root.
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return [
      // RFC 9116 requires security.txt at this path; the route handler lives at
      // a non-dotted segment so it is a normal, buildable App Router route.
      { source: "/.well-known/security.txt", destination: "/security-txt" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            // `preload` is inert until the domain is submitted to
            // hstspreload.org, and harmless in the meantime.
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          // Cross-origin isolation. Safe because no resource is cross-origin;
          // adding a third-party embed or script later means relaxing COEP to
          // `credentialless` (or serving that origin with CORP headers).
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          // 0 disables the legacy XSS auditor, which introduced its own
          // side-channels; the CSP above is the real defense.
          { key: "X-XSS-Protection", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
