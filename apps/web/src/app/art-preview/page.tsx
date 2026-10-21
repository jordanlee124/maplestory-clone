'use client';

import dynamic from 'next/dynamic';

// Phaser requires browser APIs; follow the same client-only boundary as the playable app.
const ArtPreview = dynamic(() => import('@/components/ArtPreview'), { ssr: false });

export default function ArtPreviewPage() {
  return <ArtPreview />;
}
