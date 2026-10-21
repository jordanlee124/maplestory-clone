import { MONSTERS } from '@cindervale/content';
import type Phaser from 'phaser';

import { assetByKey, MONSTER_FRAMES, SPRITE_CELL } from './manifest';

/** Original temporary pixel placeholders, sized to server hurt boxes, feet at bottom-centre. */
export function createMonsterTextures(scene: Phaser.Scene) {
  for (const def of Object.values(MONSTERS)) {
    if (assetByKey(def.id).status !== 'placeholder' || scene.textures.exists(def.id)) continue;
    const { width: w, height: h } = def.size;
    const tex = scene.textures.createCanvas(
      def.id,
      SPRITE_CELL.width * MONSTER_FRAMES.length,
      SPRITE_CELL.height,
    )!;
    const ctx = tex.context;
    MONSTER_FRAMES.forEach((frame, i) => {
      const ox = i * SPRITE_CELL.width + (SPRITE_CELL.width - w) / 2;
      const lift = frame === 'idle1' || frame === 'move1' ? 2 : 0;
      const rect = (x: number, y: number, width: number, height: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(ox + x, SPRITE_CELL.height - h + y - lift, width, height);
      };
      if (frame === 'defeat') {
        rect(2, h - 6, w - 4, 6, '#525768');
        rect(w / 2 - 3, h - 9, 6, 3, '#a5d695');
        return;
      }
      if (def.id === 'twig-creature') {
        rect(7, 10, 15, h - 13, '#453027');
        rect(9, 11, 11, h - 15, '#a57745');
        rect(3, 16, 6, 5, '#78502f');
        rect(20, frame === 'attack' ? 11 : 17, 8, 4, '#a57745');
        rect(8, 2, 3, 12, '#78502f');
        rect(18, 0, 3, 13, '#78502f');
        rect(3, 3, 7, 4, '#71b961');
        rect(20, 2, 7, 4, '#94d96d');
      } else if (def.id === 'fern-frog') {
        rect(3, 10, w - 6, h - 13, '#305b41');
        rect(5, 10, w - 10, h - 15, '#75b654');
        rect(6, 4, 7, 10, '#9dd868');
        rect(20, 4, 7, 10, '#9dd868');
        rect(10, 18, 13, 5, '#d9dfa0');
        if (frame === 'attack') rect(24, 16, 8, 3, '#ee969c');
      } else {
        rect(3, 13, w - 6, 12, '#373c66');
        rect(8, 9, 24, 13, '#7777a8');
        rect(13, 2, 8, 17, '#7fdfe5');
        rect(21, 5, 8, 15, '#b2a5f7');
        rect(15, 0, 4, 7, '#d7ffff');
        if (frame === 'attack') rect(31, 10, 8, 4, '#d7ffff');
      }
      const step = frame === 'move1' ? 2 : 0;
      rect(4 + step, h - 4 + lift, 7, 4, '#354236');
      rect(w - 11 - step, h - 4 + lift, 7, 4, '#354236');
      rect(w - 13, 12, 3, 3, frame === 'hit' ? '#ffb6aa' : '#172332');
      rect(w - 6, 12, 3, 3, '#172332');
    });
    tex.refresh();
  }
}
