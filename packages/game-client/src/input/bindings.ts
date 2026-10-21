export const DEFAULT_BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'AltLeft'],
  attack: ['ControlLeft', 'ControlRight'],
  skill1: ['KeyQ'],
  skill2: ['KeyW'],
  skill3: ['KeyE'],
  skill4: ['KeyR'],
  potion1: ['Digit1'],
  potion2: ['Digit2'],
  pickup: ['KeyZ'],
  respawn: ['Enter'],
};
export type Action = keyof typeof DEFAULT_BINDINGS;
export type Keybindings = Record<Action, string[]>;

export function actionForCode(bindings: Keybindings, code: string): Action | undefined {
  return (Object.keys(bindings) as Action[]).find((a) => bindings[a].includes(code));
}

export function rebind(bindings: Keybindings, action: Action, code: string): Keybindings {
  if (
    !/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Control(Left|Right)|Alt(Left|Right)|Shift(Left|Right)|Enter)$/.test(
      code,
    )
  ) {
    throw new Error('Choose a letter, number, arrow, Space, Ctrl, Alt, Shift or Enter.');
  }
  return Object.fromEntries(
    Object.entries(bindings).map(([a, keys]) => [
      a,
      a === action ? [code] : keys.filter((k) => k !== code),
    ]),
  ) as Keybindings;
}

export function keyLabel(codes: string[]) {
  const names: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
  };
  return (
    [
      ...new Set(
        codes.map(
          (c) =>
            names[c] ??
            c
              .replace(/^(Key|Digit)/, '')
              .replace(/^Control(Left|Right)$/, 'Ctrl')
              .replace(/^(Alt|Shift)(Left|Right)$/, '$1'),
        ),
      ),
    ].join('/') || '—'
  );
}
