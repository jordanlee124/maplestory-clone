'use client';

import { useState } from 'react';
import { AuthPanel } from './AuthPanel';
import { CharacterPanel } from './CharacterPanel';
import { GameView } from './GameView';

interface Session {
  token: string;
  characterId?: string;
}

const SESSION_KEY = 'cindervale:session';

function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
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
      ) : !session.characterId ? (
        <CharacterPanel
          token={session.token}
          onPlay={(characterId) => setSession({ ...session, characterId })}
          onLogout={() => setSession(null)}
        />
      ) : (
        <GameView
          token={session.token}
          characterId={session.characterId}
          onExit={() => setSession({ token: session.token })}
        />
      )}
    </main>
  );
}
