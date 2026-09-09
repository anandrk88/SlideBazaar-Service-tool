import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Designers submit a PPTX plus one image per slide in a single server
      // action. Next's default is 1 MB, which rejects every real deck.
      // Keep this in step with MAX_UPLOAD_BYTES in src/lib/catalog.ts and with
      // any body-size limit on the reverse proxy in front of the app.
      bodySizeLimit: "250mb",
    },
    // Any route covered by middleware has its request body buffered so the
    // middleware could read it, and Next truncates that buffer at 10 MB by
    // default. The designer's upload posts to /admin/orders/[id], which the
    // middleware matcher covers, so without this the body was silently cut off
    // at 10 MB and the action failed with "Unexpected end of form" — a message
    // that says nothing about size. Keep this at or above bodySizeLimit.
    middlewareClientMaxBodySize: "250mb",
  },
  // Security response headers. CSP is intentionally permissive about inline
  // styles because Tailwind and Next inject them; tighten if that changes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
