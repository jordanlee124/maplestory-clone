'use client';

import { Button } from '@cindervale/ui';
import { useEffect, useRef, useState } from 'react';
import { GAME_URL } from '@/lib/api';

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

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;
    import('@cindervale/game-client')
      .then(({ startGame }) =>
        startGame(
          container.current!,
          { gameUrl: GAME_URL, token, characterId, mapId },
          { onExit: () => exit.current() },
        ),
      )
      .then(
        (stop) => {
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
    <div className="flex w-full flex-col items-center gap-3">
      <div
        ref={container}
        data-testid="game"
        data-status={status}
        className="aspect-video w-full max-w-[1280px] overflow-hidden bg-black"
      />
      {status !== 'playing' && (
        <p className="text-amber-100">{status === 'connecting' ? 'Connecting…' : status}</p>
      )}
      <p className="text-sm text-amber-100/80">
        Move ← → · Jump Space · Climb ↑ ↓ · Menu Esc · Debug F3
      </p>
      <Button onClick={onExit}>Exit to character select</Button>
    </div>
  );
}
