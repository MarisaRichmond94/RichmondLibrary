import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Produce .next/standalone for the double-clickable .app build
  // (scripts/build-mac-app.sh). Harmless for dev/start.
  output: "standalone",
};

export default nextConfig;
