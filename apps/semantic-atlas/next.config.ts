import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // deck.gl owns a WebGL context and currently misbehaves under dev double-mount.
  reactStrictMode: false,
  turbopack: {
    root: path.join(appRoot, "../.."),
  },
};

export default nextConfig;
