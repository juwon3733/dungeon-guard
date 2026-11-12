// pixelfx(https://github.com/patch-gg/pixelfx, MIT, Patch & Hugo Duprez) 효과를 전투용 시트로 굽는다.
// 실행: node tools/pfx_sheets.mjs <pixelfx 폴더>
// 결과: public/assets/fx/<name>.png, src/data/fx_sheets.ts
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const PAL = {
  violet: ['#160a28', '#2e1456', '#4a2088', '#6a32b8', '#8f52e0', '#c28bff', '#e6ccff', '#ffffff'],
  pink: ['#200614', '#4a0e30', '#8a1a58', '#d42a84', '#ff5aa8', '#ff9ccc', '#ffdcee', '#ffffff'],
  blood: ['#0a0206', '#2a0410', '#5a0818', '#8a1020', '#c01830', '#ff3048', '#ff8090', '#ffd0d8', '#ffffff'],
  dust: ['#120e16', '#241c2a', '#3a3042', '#544a5c', '#71667a', '#90869a'],
  earth: ['#140c06', '#3a2412', '#6a4422', '#9a6a3a', '#c9a477', '#ecd8b0', '#ffffff'],
  cyan: ['#04161e', '#0a3040', '#10566a', '#1a8a9e', '#3cc4d4', '#8ef0f4', '#dcffff', '#ffffff'],
  green: ['#04140a', '#0a3018', '#14602a', '#22a03e', '#4ad462', '#9cf59c', '#e4ffe0', '#ffffff'],
};
// name: 게임 이름, id: pixelfx 효과, max: 최대 칸 수
const SHEETS = [
  { name: 'hit', id: 'impacts/hit-spark', max: 10 },
  { name: 'crit', id: 'impacts/crit-hit', max: 12 },
  { name: 'slash', id: 'melee/sword-slash', max: 10 },
  { name: 'claw', id: 'melee/claw-swipe', max: 10 },
  { name: 'poof', id: 'spawn/poof', options: { palette: PAL.dust }, max: 12 },
  { name: 'soul', id: 'spawn/soul-rise', options: { palette: PAL.violet.slice(1) }, max: 14 },
  { name: 'respawn', id: 'spawn/respawn-beam', max: 16 },
  { name: 'big_boom', id: 'explosions/big-explosion', max: 16 },
  { name: 'dirt_boom', id: 'explosions/dirt-explosion', options: { palette: PAL.earth }, max: 14 },
  { name: 'small_boom', id: 'explosions/small-explosion', max: 12 },
  { name: 'slam', id: 'impacts/ground-slam', max: 14 },
  { name: 'quake', id: 'nature/quake', max: 16 },
  { name: 'charmed', id: 'status/charmed', max: 14 },
  { name: 'dash', id: 'moves/dash-strike', max: 12 },
  { name: 'shield', id: 'holy/divine-shield', max: 16 },
  { name: 'curse', id: 'shadow/curse', max: 16 },
  { name: 'hex', id: 'shadow/hex-sigil', max: 16 },
  { name: 'drain', id: 'shadow/life-steal', options: { palette: PAL.blood }, max: 14 },
  { name: 'breath', id: 'fire/fire-breath', max: 16 },
  { name: 'meteor', id: 'fire/meteor', max: 16 },
  { name: 'fire_boom', id: 'explosions/plasma-explosion', max: 14 },
  { name: 'heal_ring', id: 'holy/heal-aoe', max: 16 },
  { name: 'dark_boom', id: 'shadow/dark-explosion', max: 16 },
  { name: 'black_hole', id: 'shadow/black-hole', max: 16 },
  { name: 'magic_circle', id: 'arcane/magic-circle-cast', max: 16 },
  { name: 'arrow_hit', id: 'impacts/bullet-impact', max: 8 },
];
const COLS = 8;
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..');
const pfxDir = process.argv[2];
if (!pfxDir) { console.error('사용법: node tools/pfx_sheets.mjs <pixelfx 폴더>'); process.exit(2); }
const lib = await import(pathToFileURL(join(pfxDir, 'tools/lib/fxlib.mjs')));
const { encodePNG } = await import(pathToFileURL(join(pfxDir, 'tools/lib/png.mjs')));
mkdirSync(join(root, 'public/assets/fx'), { recursive: true });
const rows = [];
for (const s of SHEETS) {
  let fx;
  try { fx = await lib.loadEffect(s.id); } catch (e) { console.error('없음', s.id); continue; }
  const r = lib.renderFrames(fx, { bg: 'none', actor: false, options: Object.assign({ light: 0.5 }, s.options) });
  // 빈 프레임 빼고 고르게 max칸
  const live = [];
  for (let i = 0; i < r.n; i++) { const c = r.frames[i].clear; let any = false; for (let k = 3; k < c.length; k += 4) if (c[k]) { any = true; break; } if (any) live.push(i); }
  const step = Math.max(1, Math.ceil(live.length / s.max));
  const picks = live.filter((_, i) => i % step === 0);
  let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
  for (const i of picks) { const c = r.frames[i].clear; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (c[(y * r.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, cols = Math.min(COLS, picks.length), nr = Math.ceil(picks.length / cols);
  const out = new Uint8ClampedArray(w * cols * h * nr * 4);
  picks.forEach((f, k) => { const c = r.frames[f].clear, ox = (k % cols) * w, oy = Math.floor(k / cols) * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = ((y + y0) * r.w + x + x0) * 4, di = ((oy + y) * w * cols + ox + x) * 4; out.set(c.subarray(si, si + 4), di); } });
  writeFileSync(join(root, 'public/assets/fx', s.name + '.png'), encodePNG(w * cols, h * nr, out));
  const [ox, oy] = fx.meta.origin;
  const life = Math.round(picks.length * step / r.fps * 100) / 100;
  rows.push(`  ${s.name}: { w: ${w}, h: ${h}, cols: ${cols}, frames: ${picks.length}, px: ${ox - x0}, py: ${oy - y0}, life: ${life} }, // ${s.id}`);
}
writeFileSync(join(root, 'src/data/fx_sheets.ts'), `// tools/pfx_sheets.mjs가 만든다(손대지 않음). 그림: pixelfx(MIT, https://github.com/patch-gg/pixelfx)
export type FxSheet = { w: number; h: number; cols: number; frames: number; px: number; py: number; life: number };
export const FX_SHEETS = {
${rows.join('\n')}
} satisfies Record<string, FxSheet>;
export type FxName = keyof typeof FX_SHEETS;
`);
console.log(rows.join('\n'));
