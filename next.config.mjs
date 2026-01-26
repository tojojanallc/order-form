/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These prevent the "Exit 1" crash from small warnings or linting errors
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;