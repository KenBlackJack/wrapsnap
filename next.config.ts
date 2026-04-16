import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Next.js 16: externalize next-auth (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["next-auth"],
  // Anchor file tracing to this project's root, not a parent workspace
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
