/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow a verification build to an isolated dir (NEXT_DIST_DIR=.next-verify)
  // so it never overwrites the live `.next` that pm2 is serving.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // Required for our BullMQ workers + Puppeteer to load on server startup.
    instrumentationHook: true,
    // Keep puppeteer/bullmq/ioredis out of the server-component bundle (we
    // lazy-import them from worker / route handler code only). Avoids
    // "Critical dependency" warnings and the heavy Chromium download from
    // being inlined.
    serverComponentsExternalPackages: ["puppeteer", "bullmq", "ioredis"],
  },
  // Mark puppeteer + bullmq as Node externals at webpack level so the
  // route-handler chunks don't try to bundle their node:fs / node:path deps.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      externals.push(
        // Functional form so we externalise *any* sub-path
        ({ request }, callback) => {
          if (
            request &&
            (request.startsWith("puppeteer") ||
              request.startsWith("bullmq"))
          ) {
            return callback(null, "commonjs " + request);
          }
          callback();
        },
      );
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
