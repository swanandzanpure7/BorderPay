/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip type checking and linting during build — run separately in CI
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Improve bundle analysis in development
  ...(process.env.ANALYZE === 'true' ? { experimental: { bundlePagesRouterDependencies: true } } : {}),
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
