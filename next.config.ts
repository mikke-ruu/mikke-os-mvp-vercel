import type { NextConfig } from "next";

// Keep the isolated preview and build from replacing each other's manifests.
// Normal deployments retain Next's default output directory.
const localDist = process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:57680" &&
  [".next-academy2-stripe-isolated", ".next-academy2-dev", ".next-academy2-dev-recovery", ".next-academy2-dev-full-20260928", ".next-academy2-build", ".next-academy2-predeploy"].includes(process.env.ACADEMY2_LOCAL_DIST_DIR ?? "")
  ? process.env.ACADEMY2_LOCAL_DIST_DIR : undefined;
const nextConfig: NextConfig = {
  ...(localDist ? { distDir: localDist } : {}),
  ...(localDist ? { typescript: { tsconfigPath: 'tsconfig.academy2-full-check.json' } } : {}),
  // In the isolated dev runtime keep React debug data in the RSC response.
  // The separate debug WebSocket can stall hydration on slow local machines.
  // HMR remains enabled, and normal builds/deployments keep Next's defaults.
  ...(localDist && process.env.NODE_ENV === "development"
    ? { experimental: { reactDebugChannel: false } } : {}),
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/academy/h/:academyId/manage", destination: "/academy" },
      { source: "/academy/h/:academyId/manage/:path*", destination: "/academy/:path*" },
      { source: "/academy/h/:academyId/teach", destination: "/academy/portal" },
      { source: "/academy/h/:academyId/teach/offering-applications/mine", destination: "/academy/offering-applications/mine" },
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
