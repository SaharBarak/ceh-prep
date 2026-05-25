/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd().replace(/\/app$/, ""),
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "localhost:3000"] },
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
