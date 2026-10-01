import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API and auth requests to the Express server so the browser sees a
  // single origin and better-auth session cookies stay first-party.
  async rewrites() {
    const serverUrl = (process.env.SERVER_INTERNAL_URL || "http://localhost:4000").replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${serverUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
