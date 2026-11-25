/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Each client store run on this machine (front/start-store.ps1) builds into its own folder, next to Arisma's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Local payment tests: Wompi refuses localhost as a return address, so stores are opened at <store>.localhost.
  allowedDevOrigins: ["arisma.localhost", "*.localhost"],
  // Photos are served as WebP at the width each screen needs (modules/shared/ui/optimized-image.ts) and cached for 30
  // days. Historical product photos still live on the WordPress site until the media migration; the hosts here must
  // match OPTIMIZED_HOSTS in that file.
  // the store's error pages run in a sandboxed frame (modules/shared/ui/error-frame.tsx): its fonts load from another origin
  async headers() {
    return [{ source: "/_next/static/media/:path*", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] }]
  },
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [{ protocol: "https", hostname: "arisma.com.co", pathname: "/**" }],
  },
}
