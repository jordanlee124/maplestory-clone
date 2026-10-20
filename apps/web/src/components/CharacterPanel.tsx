'use client';

import { CLASSES, CLASS_IDS, type ClassId } from '@cindervale/content';
import type { CharacterSummary } from '@cindervale/protocol';
import { Button, Field, Panel } from '@cindervale/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface Props {
  token: string;
  onPlay: (characterId: string, mapId: string) => void;
  onLogout: () => void;
}

export function CharacterPanel({ token, onPlay, onLogout }: Props) {
  const [characters, setCharacters] = useState<CharacterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCharacters(token).then(setCharacters, (e: Error) => {
      // An expired token sends the player back to login.
      if (/auth/i.test(e.message)) onLogout();
      else setError(e.message);
    });
  }, [token, onLogout]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    try {
      const c = await api.createCharacter(token, {
        name: String(form.get('name')),
        classId: String(form.get('classId')) as ClassId,
      });
      setCharacters((list) => [...(list ?? []), c]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel title="Choose your character">
      {characters === null ? (
        <p>Loading…</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {characters.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded border border-amber-900/40 p-2"
            >
              <span>
                <strong>{c.name}</strong> · Lv {c.level} {CLASSES[c.classId].name}
              </span>
              <Button onClick={() => onPlay(c.id, c.mapId)}>Play</Button>
            </li>
          ))}
          {characters.length === 0 && <li className="text-sm">No characters yet.</li>}
        </ul>
      )}
      <form onSubmit={create} className="border-t border-amber-900/40 pt-4">
        <Field label="New character name" name="name" required minLength={3} maxLength={12} />
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold">Class</span>
          <select
            name="classId"
            className="w-full rounded border-2 border-amber-900 bg-white px-3 py-2"
          >
            {CLASS_IDS.map((id) => (
              <option key={id} value={id}>
                {CLASSES[id].name} — {CLASSES[id].role}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-between">
          <Button type="submit">Create</Button>
          <button type="button" className="text-sm underline" onClick={onLogout}>
            Log out
          </button>
        </div>
      </form>
    </Panel>
  );
}
