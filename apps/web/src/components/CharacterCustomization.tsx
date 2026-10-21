'use client';

import { useState } from 'react';
import { DEFAULT_APPEARANCE, type CharacterAppearance } from '@cindervale/game-client/appearance';
import type { startArtValidation } from '@cindervale/game-client/art-validation';

type Controls = ReturnType<typeof startArtValidation>;
const options = {
  body: ['adventurer', 'adventurer-tall'],
  skinTone: ['warm', 'deep', 'fair'],
  face: ['bright', 'calm'],
  eyes: ['mint', 'amber'],
  hairStyle: ['tousled', 'braided'],
  hairColor: ['honey', 'chestnut', 'silver'],
  outfit: ['woodland', 'traveler'],
  weapon: ['none', 'seed-blade'],
  hat: ['none', 'fern-cap'],
  cape: ['none', 'leaf-mantle'],
} as const;
const names = {
  body: 'Body variant',
  skinTone: 'Skin tone',
  face: 'Face',
  eyes: 'Eyes',
  hairStyle: 'Hairstyle',
  hairColor: 'Hair color',
  outfit: 'Outfit',
  weapon: 'Weapon',
  hat: 'Hat',
  cape: 'Cape',
};

export default function CharacterCustomization({
  controls,
  ready,
}: {
  controls: () => Controls | undefined;
  ready: boolean;
}) {
  const [appearance, setAppearance] = useState<CharacterAppearance>({ ...DEFAULT_APPEARANCE });
  const [missing, setMissing] = useState<readonly string[]>([]);
  const change = (patch: Partial<CharacterAppearance>) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    setMissing(controls()?.appearance(patch) ?? []);
  };
  return (
    <fieldset disabled={!ready} className="m-3 rounded border border-slate-600 bg-slate-900 p-4">
      <legend className="px-2 text-lg">Character customization · development preview</legend>
      <p className="mb-4 max-w-4xl text-sm text-slate-300">
        Original flattened adventurer study. All separate layer selections are missing asset slots;
        the study stays visible as a development placeholder. Its painted clothing, hair and weapon
        cannot yet be removed or recolored independently. No stats or server data change.
      </p>
      <div className="flex flex-wrap gap-4">
        {Object.entries(options).map(([slot, values]) => (
          <label key={slot} className="flex flex-col gap-1 text-sm">
            {names[slot as keyof typeof options]}
            <select
              className="rounded bg-slate-800 p-2"
              value={appearance[slot as keyof typeof options]}
              onChange={(event) => change({ [slot]: event.target.value })}
            >
              {values.map((value) => (
                <option key={value} value={value}>
                  {value} · missing layer
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm">
          Playback speed
          <select
            className="rounded bg-slate-800 p-2"
            defaultValue="1"
            onChange={(event) => controls()?.speed(Number(event.target.value))}
          >
            {[0, 0.25, 0.5, 1, 2].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Background
          <select
            className="rounded bg-slate-800 p-2"
            onChange={(event) => controls()?.background(event.target.value)}
          >
            {['forest', 'light', 'dark'].map((background) => (
              <option key={background}>{background}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sprite scale
          <select
            className="rounded bg-slate-800 p-2"
            defaultValue={96 / 426}
            onChange={(event) => controls()?.scale(Number(event.target.value))}
          >
            {[0.15, 96 / 426, 0.3, 0.4].map((scale) => (
              <option key={scale} value={scale}>
                {scale.toFixed(3)}× source pixels
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="mt-4 text-sm text-amber-200">
        {missing.length
          ? `Missing layers: ${missing.join(', ')}`
          : 'Separate character layers await original artwork; use measurement guides to inspect alignment.'}
      </p>
    </fieldset>
  );
}
