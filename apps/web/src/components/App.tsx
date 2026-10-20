'use client';

import { useState } from 'react';
import { AuthPanel } from './AuthPanel';
import { CharacterPanel } from './CharacterPanel';
import { GameView } from './GameView';

interface Session {
  token: string;
  /** Set together with mapId while in game. */
  characterId?: string;
  mapId?: string;
}

const SESSION_KEY = 'cindervale:session';

function loadSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    // Sessions saved before mapId existed go back to character select.
    return s && !s.mapId ? { token: s.token } : s;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSessionState] = useState<Session | null>(loadSession);
  const setSession = (s: Session | null) => {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
    setSessionState(s);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-4xl font-bold tracking-wide text-amber-300 drop-shadow-[2px_2px_0_#78350f]">
        Cindervale Online
      </h1>
      {!session ? (
        <AuthPanel onAuth={(token) => setSession({ token })} />
      ) : !session.characterId || !session.mapId ? (
        <CharacterPanel
          token={session.token}
          onPlay={(characterId, mapId) => setSession({ ...session, characterId, mapId })}
          onLogout={() => setSession(null)}
        />
      ) : (
        <GameView
          token={session.token}
          characterId={session.characterId}
          mapId={session.mapId}
          onExit={() => setSession({ token: session.token })}
        />
      )}
    </main>
  );
}
