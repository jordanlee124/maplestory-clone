'use client';

import {
  DEFAULT_BINDINGS,
  keyLabel,
  rebind,
  type Action,
  type Keybindings,
} from '@cindervale/game-client/bindings';
import { useState } from 'react';

export function KeybindingSettings({
  bindings,
  onChange,
  onOpen,
}: {
  bindings: Keybindings;
  onChange: (bindings: Keybindings) => void;
  onOpen: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<Action>();
  const [message, setMessage] = useState('Select a control, then press its new key. Esc cancels.');
  return (
    <details
      className="w-full max-w-4xl rounded border border-amber-100/30 p-3 text-amber-100"
      onToggle={(e) => {
        onOpen(e.currentTarget.open);
        setEditing(undefined);
      }}
    >
      <summary className="cursor-pointer">Keybindings</summary>
      <p className="my-2 text-sm" role="status">
        {message}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(bindings) as Action[]).map((action) => (
          <button
            type="button"
            key={action}
            className="rounded border border-amber-100/30 px-2 py-2 text-sm focus:outline-2 focus:outline-amber-300"
            aria-label={`Rebind ${action}`}
            onClick={() => setEditing(action)}
            onKeyDown={(event) => {
              if (editing !== action) return;
              event.preventDefault();
              event.stopPropagation();
              if (event.code === 'Escape') {
                setEditing(undefined);
                return;
              }
              try {
                onChange(rebind(bindings, action, event.code));
                setEditing(undefined);
                setMessage(`Updated ${action}. Duplicate bindings were removed.`);
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            {action}: {editing === action ? 'Press a key…' : keyLabel(bindings[action])}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded border border-amber-100/30 px-3 py-2"
        onClick={() => onChange(DEFAULT_BINDINGS)}
      >
        Reset keybindings
      </button>
    </details>
  );
}
