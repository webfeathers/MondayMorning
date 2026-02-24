import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@wf/db', '@wf/shared', '@wf/auth', '@wf/observability'],
  output: 'standalone', // Required for Docker deployment
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
