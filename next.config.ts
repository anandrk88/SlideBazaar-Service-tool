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
