import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The grader is served as a page of the main site at /grader.
  basePath: '/grader',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/grader',
  },
  // Pin the Turbopack workspace root. Automatic inference hangs dev-server
  // startup for this project (16.2.x); see turbopack.md root docs.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
