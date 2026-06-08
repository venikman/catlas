import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // deck.gl owns a WebGL context and currently misbehaves under dev double-mount.
  reactStrictMode: false,
};

export default nextConfig;
