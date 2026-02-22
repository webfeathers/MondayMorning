import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@wf/db', '@wf/shared', '@wf/auth'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
