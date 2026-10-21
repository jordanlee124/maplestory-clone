'use client';

import dynamic from 'next/dynamic';

// Phaser is browser-only; keep its import graph out of server rendering.
export default dynamic(() => import('./ArtValidation'), { ssr: false });
