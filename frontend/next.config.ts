import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

const nextConfig = (phase: string): NextConfig => ({
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev-local" : ".next",
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: ["192.168.56.1"],
});

export default nextConfig;
