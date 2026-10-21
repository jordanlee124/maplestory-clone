import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A browser test stack must not share the user's running dev-server lock or cache.
  distDir: process.env.CINDERVALE_E2E_DEV === 'true' ? '.next-e2e' : '.next',
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    '@cindervale/content',
    '@cindervale/game-client',
    '@cindervale/game-core',
    '@cindervale/protocol',
    '@cindervale/ui',
  ],
};

export default nextConfig;
