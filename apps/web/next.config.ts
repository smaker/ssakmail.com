import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ssakmail/data-access", "@ssakmail/ui"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
