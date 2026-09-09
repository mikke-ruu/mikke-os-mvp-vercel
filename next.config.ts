import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/academy/h/:academyId/manage", destination: "/academy" },
      { source: "/academy/h/:academyId/manage/:path*", destination: "/academy/:path*" },
      { source: "/academy/h/:academyId/teach", destination: "/academy/portal" },
      { source: "/academy/h/:academyId/teach/:path*", destination: "/academy/portal/:path*" }
    ];
  },
  async headers() {
    return [
      {
        source: "/hq/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
      }
    ];
  }
};

export default nextConfig;
