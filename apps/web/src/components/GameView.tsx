'use client';

import { Button } from '@cindervale/ui';
import { useEffect, useRef, useState } from 'react';
import { GAME_URL } from '@/lib/api';
import { DEFAULT_BINDINGS, type Keybindings } from '@cindervale/game-client/bindings';
import { KeybindingSettings } from './KeybindingSettings';

interface Props {
  token: string;
  characterId: string;
  mapId: string;
  onExit: () => void;
}

export function GameView({ token, characterId, mapId, onExit }: Props) {
  const container = useRef<HTMLDivElement>(null);
  // A ref so the in-game menu always calls the latest onExit without restarting the game.
  const exit = useRef(onExit);
  useEffect(() => {
    exit.current = onExit;
  });
  const [status, setStatus] = useState<'connecting' | 'playing' | string>('connecting');
  const [bindings, setBindings] = useState<Keybindings>(DEFAULT_BINDINGS);
  const bindingsRef = useRef(bindings);
  const settingsOpen = useRef(false);
  const updateBindings = (value: Keybindings) => {
    bindingsRef.current = value;
    setBindings(value);
  };

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;
    import('@cindervale/game-client')
      .then(({ startGame }) => {
        if (cancelled) return;
        return startGame(
          container.current!,
          { gameUrl: GAME_URL, token, characterId, mapId },
          {
            onExit: () => exit.current(),
            bindings: () => bindingsRef.current,
            inputEnabled: () => !settingsOpen.current,
          },
        );
      })
      .then(
        (stop) => {
          if (!stop) return;
          if (cancelled) return stop();
          teardown = stop;
          setStatus('playing');
        },
        (e: Error) => !cancelled && setStatus(`Could not join: ${e.message}`),
      );
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [token, characterId, mapId]);

  return (
    <div className="flex w-screen flex-col items-center gap-3">
      <div
        ref={container}
        data-testid="game"
        data-status={status}
        className="w-full overflow-auto bg-black"
      />
      {status !== 'playing' && (
        <p className="text-amber-100">{status === 'connecting' ? 'Connecting…' : status}</p>
      )}
      <p className="text-sm text-amber-100/80">
        Arrows: move/climb · Space: jump · Ctrl: attack · Q/W/E/R: skills · 1/2: potions (pending) ·
        Z: loot · Enter: respawn · Esc: menu · F3: debug
      </p>
      <p className="text-xs text-amber-100/60">
        Approved Fernreach art direction is live. Animation coverage and class outfits are draft;
        Twig Creature and other-map art still use placeholders.{' '}
        {process.env.NODE_ENV !== 'production' && (
          <a className="underline" href="/art-validation" target="_blank" rel="noreferrer">
            View the art validation scene
          </a>
        )}
      </p>
      <KeybindingSettings
        bindings={bindings}
        onChange={updateBindings}
        onOpen={(open) => {
          settingsOpen.current = open;
        }}
      />
      <Button onClick={onExit}>Exit to character select</Button>
    </div>
  );
}
