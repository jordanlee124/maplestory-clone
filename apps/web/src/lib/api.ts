import type {
  AuthResponse,
  CharacterSummary,
  CreateCharacter,
  Credentials,
} from '@cindervale/protocol';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const GAME_URL = process.env.NEXT_PUBLIC_GAME_URL ?? 'ws://localhost:2567';

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  register: (c: Credentials) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: c }),
  login: (c: Credentials) => request<AuthResponse>('/auth/login', { method: 'POST', body: c }),
  listCharacters: (token: string) => request<CharacterSummary[]>('/characters', { token }),
  createCharacter: (token: string, body: CreateCharacter) =>
    request<CharacterSummary>('/characters', { method: 'POST', body, token }),
};
