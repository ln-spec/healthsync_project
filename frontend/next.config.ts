import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

const nextConfig = (phase: string): NextConfig => ({
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  outputFileTracingRoot: path.resolve(__dirname),
});

export default nextConfig;
