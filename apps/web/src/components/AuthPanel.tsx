'use client';

import { Button, Field, Panel } from '@cindervale/ui';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

export function AuthPanel({ onAuth }: { onAuth: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const creds = {
      username: String(form.get('username')),
      password: String(form.get('password')),
    };
    setBusy(true);
    setError(null);
    try {
      const { token } = await (mode === 'login' ? api.login(creds) : api.register(creds));
      onAuth(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={mode === 'login' ? 'Log in' : 'Create account'}>
      <form onSubmit={submit}>
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={16}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={8}
        />
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          <Button type="submit" disabled={busy}>
            {mode === 'login' ? 'Log in' : 'Register'}
          </Button>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
