'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { startArtValidation } from '@cindervale/game-client/art-validation';

export default function ArtValidation() {
  const parent = useRef<HTMLDivElement>(null);
  const controls = useRef<ReturnType<typeof startArtValidation>>(undefined);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<readonly string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('@cindervale/game-client/art-validation')
      .then(({ startArtValidation }) => {
        if (!cancelled)
          controls.current = startArtValidation(parent.current!, (keys) => {
            setLoaded(keys);
            setReady(true);
          });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      controls.current?.stop();
    };
  }, []);
  return (
    <main className="text-slate-100">
      <h1 className="p-3 text-xl">Cindervale art direction · validation scene</h1>
      <p className="px-3 pb-3">
        Visual direction approved. Live Fernreach now uses this original AI-assisted design. The
        Twig Creature pose sheet and woodland HUD panel below are approved for live Fernreach. HUD
        values are samples, with no connection to gameplay. Full motion sets and separate character
        layers remain unfinished. Pause before selecting a pose to inspect it.
      </p>
      <p className="px-3 pb-3">
        <a className="underline" href="#comparison">
          Compare the previous placeholder art with the approved direction
        </a>
      </p>
      <div className="flex flex-wrap gap-4 p-3">
        <label>
          Camera zoom{' '}
          <select
            aria-label="Camera zoom"
            defaultValue="1"
            disabled={!ready}
            onChange={(e) => controls.current?.zoom(Number(e.target.value))}
            className="bg-slate-800 p-2"
          >
            {[0.75, 1, 1.25, 1.5].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
        <label>
          Pose{' '}
          <select
            aria-label="Pose"
            disabled={!ready || !loaded.includes('adventurer-body')}
            onChange={(e) => controls.current?.action(e.target.value)}
            className="bg-slate-800 p-2"
          >
            {['idle', 'attack', 'skill'].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Twig pose{' '}
          <select
            aria-label="Twig pose"
            disabled={!ready || !loaded.includes('twig-creature')}
            onChange={(e) => controls.current?.twigAction(e.target.value)}
            className="bg-slate-800 p-2"
          >
            {['idle', 'walk', 'attack', 'hit', 'defeat'].map((action) => (
              <option key={action}>{action}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={!ready}
            onChange={(e) => controls.current?.facing(e.target.checked)}
          />{' '}
          Face left
        </label>
        <label>
          <input
            type="checkbox"
            disabled={!ready}
            onChange={(e) => controls.current?.guides(e.target.checked)}
          />{' '}
          Measurement guides
        </label>
        <label>
          <input
            type="checkbox"
            disabled={!ready}
            onChange={(e) => controls.current?.pause(e.target.checked)}
          />{' '}
          Pause preview
        </label>
        <label>
          Parallax pan{' '}
          <input
            aria-label="Parallax pan"
            type="range"
            min="0"
            max="320"
            defaultValue="0"
            disabled={!ready}
            onChange={(e) => controls.current?.pan(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div ref={parent} data-testid="art-validation" className="w-full overflow-auto bg-black" />
      <p className="p-3">
        Review the earlier placeholder board at{' '}
        <a className="underline" href="/art-preview">
          /art-preview
        </a>
        . Production specifications: docs/art/ART_DIRECTION.md.
      </p>
      <details id="comparison" className="mx-auto max-w-7xl p-3">
        <summary className="cursor-pointer text-lg">Before / candidate comparison</summary>
        <p className="py-3">
          These captures compare the previous placeholder game with the approved direction study.
          Live Fernreach now uses this design; full animation coverage is still pending. Open either
          historical capture at full size to judge native detail.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {[
            [
              'legacy-gameplay-1280x720.png',
              'Before: temporary live gameplay',
              'Temporary rectangular character and monster sprites, tiled soil and geometric hills',
            ],
            [
              'candidate-1280x720.png',
              'Candidate: Fernreach direction study',
              'Original chibi adventurer and Fern Frog on an organic platform with botanical woodland scenery',
            ],
          ].map(([file, title, alt]) => (
            <figure key={file}>
              <figcaption className="pb-2">{title}</figcaption>
              <a
                href={`/reviews/${file}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open full-size capture: ${title}`}
              >
                <Image
                  src={`/reviews/${file}`}
                  width={1280}
                  height={720}
                  alt={alt!}
                  unoptimized
                  className="h-auto w-full"
                />
              </a>
            </figure>
          ))}
        </div>
        <p className="pt-3">
          Review silhouette, head/body proportions, facial readability, platform design and
          background density. Separate hair/face/equipment layers, full animation sets and alpha
          cleanup remain pending.
        </p>
      </details>
    </main>
  );
}
