import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

// In a git worktree, node_modules lives in the parent project — not locally.
// On Vercel (normal build), node_modules is in __dirname.
const hasLocalModules = existsSync(path.join(__dirname, "node_modules", "next", "package.json"));
const projectRoot = hasLocalModules ? __dirname : path.join(__dirname, "..", "..", "..");

const nextConfig: NextConfig = {
  // Next.js 16: externalize next-auth (replaces experimental.serverComponentsExternalPackages)
  serverExternalPackages: ["next-auth"],
  // Must match turbopack.root per Next.js 16 requirement
  outputFileTracingRoot: projectRoot,
  // Tell Turbopack where to find node_modules
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
