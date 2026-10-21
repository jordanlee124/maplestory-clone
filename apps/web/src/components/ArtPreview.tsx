'use client';

import { useEffect, useRef } from 'react';

export default function ArtPreview() {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    import('@cindervale/game-client/art-preview').then(({ startArtPreview }) => {
      if (!cancelled) stop = startArtPreview(parent.current!);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return (
    <main>
      <h1 className="p-3 text-amber-100">
        Pixel-art review board — temporary art and alignment fixtures
      </h1>
      <div ref={parent} data-testid="art-preview" className="w-full overflow-auto bg-black" />
      <p className="p-3 text-amber-100">
        Missing approved assets are listed in docs/art/PIXEL_ART_GUIDE.md. Use 100% browser zoom;
        narrower windows scroll instead of shrinking pixels.
      </p>
    </main>
  );
}
