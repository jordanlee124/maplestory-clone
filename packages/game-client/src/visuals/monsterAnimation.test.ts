import { expect, it } from 'vitest';
import { MonsterAnimation } from './monsterAnimation';
import { VALIDATION_CANDIDATES } from './validationCandidates';
import { liveVisual } from './approvedAssets';

it('plays monster actions from confirmed modes/events with continuous movement timing', () => {
  const asset = VALIDATION_CANDIDATES[0]!;
  const animation = new MonsterAnimation();
  const quiet = { hitUntil: 0, attackUntil: 0 };
  expect(animation.sample(asset, 'idle', 0, quiet).frame.name).toBe('idle');
  expect(animation.sample(asset, 'patrol', 100, quiet).frame.name).toBe('idle');
  expect(animation.sample(asset, 'patrol', 260, quiet).frame.name).toBe('walk');
  expect(animation.sample(asset, 'chase', 261, quiet).frame.name).toBe('walk');
  const attack = { ...quiet, attackUntil: 700 };
  expect(animation.sample(asset, 'chase', 400, attack).frame.name).toBe('windup');
  expect(animation.sample(asset, 'chase', 490, attack).frame.name).toBe('strike');
  expect(animation.sample(asset, 'chase', 500, { ...attack, hitUntil: 680 }).frame.name).toBe(
    'hurt',
  );
  expect(animation.sample(asset, 'dead', 501, { hitUntil: 680, attackUntil: 700 }).frame.name).toBe(
    'defeat',
  );
  expect(animation.sample(asset, 'idle', 1500, quiet).frame.name).toBe('idle');
});

it('keeps absent drawings on an explicit idle hold and supports authored respawn clips', () => {
  const animation = new MonsterAnimation();
  const asset = liveVisual('fern-frog');
  expect(animation.sample(asset, 'dead', 100, { hitUntil: 0, attackUntil: 0 })).toMatchObject({
    action: 'defeat',
    frame: { name: 'idle' },
  });
  const respawn = {
    ...asset,
    clips: { ...asset.clips, respawn: { frames: ['idle'], durations: [300], loop: false } },
  };
  expect(
    animation.sample(respawn, 'idle', 200, { hitUntil: 0, attackUntil: 0, respawnUntil: 500 })
      .action,
  ).toBe('respawn');
});
