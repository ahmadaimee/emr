import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@grove/ui', '@grove/db', '@grove/domain', '@grove/auth', '@grove/audit', '@grove/reporting', '@grove/clearinghouse', '@grove/x12', '@grove/rules', '@grove/storage'],
  // Server-only packages must not be bundled for the client.
  serverExternalPackages: ['postgres', '@node-rs/argon2', 'pg-boss', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // PHI must never land in a shared cache.
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default config;
