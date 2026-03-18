/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001',
    NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001',
  },
  // async rewrites() {
  //   const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000';
  //   console.log('Backend URL for rewrites:', backendUrl);
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: `${backendUrl}/api/:path*`,
  //     },
  //   ];
  // },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  images: {
    domains: ['localhost', 'avatars.githubusercontent.com'],
  },
};

module.exports = nextConfig;
