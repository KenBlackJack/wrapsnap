import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: externalize next-auth (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["next-auth"],
};

export default nextConfig;
