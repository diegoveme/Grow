import type { NextConfig } from "next";
import path from "node:path";

// Monorepo: this app imports @raiz/shared from packages/shared (outside
// apps/web). Pin Turbopack's workspace root to the repo root so those files are
// inside the compile boundary. Computed from cwd (apps/web at build time) —
// note next.config.ts loads as ESM here, so __dirname is unavailable.
const repoRoot = path.resolve(process.cwd(), "..", "..");

const nextConfig: NextConfig = {
  // The app is fully client-rendered (wallet + API calls happen in the browser;
  // the NestJS API is a separate service). Export a static site so hosting is
  // trivial and portable — no server runtime needed.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
