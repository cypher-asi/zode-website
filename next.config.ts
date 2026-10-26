import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Every asset this site loads is same-origin: `next/font/google` self-hosts at
// build time, the 3D model and images come from /public, and data room files
// stream through the site's own access-checked routes. External URLs in content
// are plain anchors. The one cross-origin call is data room uploads, which go
// from the browser straight to Vercel Blob (see `connect-src`).
//
// 'unsafe-inline' for scripts is required by Next's inline RSC bootstrap.
// Replacing it with nonces would force every page to render
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
  "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
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

// Deny every powerful browser feature but fullscreen, which only the site
// itself may use (the investor deck presents in it).
const permissionsPolicy = [
  "accelerometer",
  "autoplay",
  "camera",
  "display-capture",
  "encrypted-media",
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
  .concat("fullscreen=(self)")
  .join(", ");

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  // Pages prerender a static shell around their request-time parts, and links
  // prefetch it, so navigations paint at once while the rest streams in.
  cacheComponents: true,
  partialPrefetching: true,
  // Memoizes components and hooks at build time, so a parent's state change
  // doesn't re-render subtrees whose props are unchanged.
  reactCompiler: true,
  experimental: {
    // Group CSS by which routes import it, so a route downloads close to only
    // the CSS it uses instead of shared chunks carrying every section's styles.
    cssChunking: "graph",
  },
  // Hide the on-screen Next.js dev indicator (bottom-left).
  devIndicators: false,
  // Pin the workspace root so Turbopack ignores the stray lockfile in the home
  // directory when inferring the project root.
  turbopack: {
    root: import.meta.dirname,
  },
  // The MNDA template and fonts are read with fs when an agreement is signed,
  // which tracing can't follow; ship them with the routes whose actions sign.
  outputFileTracingIncludes: {
    "/mnda": ["src/features/mnda/assets/**/*"],
    "/data-rooms/invite/*": ["src/features/mnda/assets/**/*"],
    // Likewise the deployment, teaser and presentation PDFs' fonts and wordmark, and the presentations' site images.
    "/api/deployments/**": [
      "src/features/deployments/assets/**/*",
      "src/assets/fonts/display/*.ttf",
      "public/wordmark.svg",
      "src/features/presentations/sites/**/*.jpg",
    ],
    "/api/shared/deployments/**": [
      "src/features/deployments/assets/**/*",
      "src/assets/fonts/display/*.ttf",
      "public/wordmark.svg",
      "src/features/presentations/sites/**/*.jpg",
    ],
  },
  // AVIF first (roughly 20% smaller than WebP at the same quality), WebP for
  // browsers without it. AVIF's first encode is slower; the result is cached.
  images: {
    formats: ["image/avif", "image/webp"],
    // The optimizer only serves the site's own photography; every other path,
    // and any query string, is refused.
    localPatterns: [{ pathname: "/images/**", search: "" }],
  },
  async redirects() {
    return [
      { source: "/future-home", destination: "/", permanent: false },
      // Pages retired when the site moved to the home page's structure.
      { source: "/rent-compute", destination: "/buy-compute?mode=rent", permanent: true },
      { source: "/give-compute", destination: "/", permanent: true },
      { source: "/legacy", destination: "/", permanent: true },
      { source: "/network", destination: "/", permanent: true },
      { source: "/deployments/:path*", destination: "/", permanent: true },
      // Renamed; the query string carries over, so shared cluster links still open.
      { source: "/cluster-configurator", destination: "/cluster-builder", permanent: true },
      // Portal apps open on their first section. Done here rather than with a
      // page that calls redirect(): a prerendered page that throws trips React's
      // dev performance track ("cannot have a negative time stamp").
      { source: "/portal/zrm", destination: "/portal/zrm/people", permanent: false },
      { source: "/portal/capacity", destination: "/portal/capacity/sites", permanent: false },
      // All deployments moved to the app's root, ahead of the status tabs.
      { source: "/portal/deployments/all", destination: "/portal/deployments", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // RFC 9116 requires security.txt at this path; the route handler lives at
      // a non-dotted segment so it is a normal, buildable App Router route.
      { source: "/.well-known/security.txt", destination: "/security-txt" },
      // The agent-facing brand files, likewise generated by dot-free route handlers.
      { source: "/styleguide.md", destination: "/styleguide-md" },
      { source: "/brand/tokens.css", destination: "/brand-tokens-css" },
      { source: "/brand/tokens.json", destination: "/brand-tokens-json" },
      { source: "/llms.txt", destination: "/llms-txt" },
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
      // The data room's zip service worker and the library it loads are checked
      // for updates on every registration, so a fix reaches browsers at once.
      ...["/data-room-sw.js", "/data-room-zip.js"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      })),
      // The public brand files are meant to be fetched and embedded from other
      // origins (agents, partner sites), so they relax the same-origin policy
      // above; a later match overrides the same key.
      ...["/brand/:path*", "/styleguide.md", "/llms.txt"].map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      })),
    ];
  },
};

export default nextConfig;
