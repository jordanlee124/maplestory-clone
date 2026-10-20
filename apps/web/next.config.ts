import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
