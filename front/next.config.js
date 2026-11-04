/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Historical product photos still live on the WordPress site until the media migration.
  images: { remotePatterns: [{ protocol: "https", hostname: "arisma.com.co", pathname: "/**" }] },
}
