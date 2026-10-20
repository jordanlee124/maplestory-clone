'use client';

import { Button } from '@cindervale/ui';
import { useEffect, useRef, useState } from 'react';
import { GAME_URL } from '@/lib/api';

interface Props {
  token: string;
  characterId: string;
  onExit: () => void;
}

export function GameView({ token, characterId, onExit }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'playing' | string>('connecting');

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;
    import('@cindervale/game-client')
      .then(({ startGame }) =>
        startGame(container.current!, { gameUrl: GAME_URL, token, characterId }),
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
  }, [token, characterId]);

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
      <p className="text-sm text-amber-100/80">Move: ← → or A D · Jump: Space or Alt</p>
      <Button onClick={onExit}>Exit to character select</Button>
    </div>
  );
}
