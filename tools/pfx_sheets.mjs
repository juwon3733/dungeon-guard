// pixelfx(https://github.com/patch-gg/pixelfx, MIT, 커밋 a841596) 효과를 게임용 시트로 만든다.
// 실행: git clone https://github.com/patch-gg/pixelfx <저장소 밖 폴더>
//       node tools/pfx_sheets.mjs <pixelfx 폴더>            (모든 시트)
//       node tools/pfx_sheets.mjs <pixelfx 폴더> pfx_burning (시트 하나만)
// 결과: assets/fx/<image>.png 와, js/data/fx_sheets.js에 옮길 줄(크기, 칸, 기준점)을 출력한다.
// 방법: renderFrames(fx, { bg: 'none', actor: false, options })로 30fps 프레임을 만들고, 고른 프레임만 모든 프레임을 덮는 상자로 잘라
// 한 줄 8칸 시트로 붙인다. 기준점은 효과의 origin에서 up px 위(타격 섬광과 폭발 중심)다. 표는 docs/PIXELLAB_ASSETS.md에도 적는다.
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const PAL = {
    gold: ['#1e1206', '#4a2c08', '#86520c', '#c48412', '#f0b424', '#ffe066', '#fff6c4', '#ffffff'],
    cyan: ['#04161e', '#0a3040', '#10566a', '#1a8a9e', '#3cc4d4', '#8ef0f4', '#dcffff', '#ffffff'],
    pink: ['#200614', '#4a0e30', '#8a1a58', '#d42a84', '#ff5aa8', '#ff9ccc', '#ffdcee', '#ffffff'],
    violet: ['#160a28', '#2e1456', '#4a2088', '#6a32b8', '#8f52e0', '#c28bff', '#e6ccff', '#ffffff'],
    green: ['#04140a', '#0a3018', '#14602a', '#22a03e', '#4ad462', '#9cf59c', '#e4ffe0', '#ffffff'],
    red: ['#14040a', '#3a0a14', '#6a101c', '#a01824', '#d42a30', '#ff5a50', '#ff9a8a', '#ffe6de'],
    yellow: ['#1a1404', '#40300a', '#7a5a10', '#c09018', '#f0c828', '#ffe870', '#fff8c8', '#ffffff'],
    fire: ['#4a1712', '#8a1f17', '#c9281f', '#f2561d', '#ff8a2a', '#ffc23d', '#ffe26b', '#fff3a6', '#ffffff'],
    blood: ['#0a0206', '#2a0410', '#5a0818', '#8a1020', '#c01830', '#ff3048', '#ff8090', '#ffd0d8', '#ffffff'],
    steel: ['#14100c', '#3a2c20', '#6a5440', '#9a8a78', '#c8c0b4', '#ece8e0', '#ffffff'],
    jester: ['#1a0620', '#4a1060', '#8a20a8', '#d040e0', '#ff7af0', '#ffc8fa', '#ffffff'],
    orange: ['#2a0c10', '#7a1a10', '#c9401a', '#ff8a2a', '#ffc23d', '#fff0a0', '#ffffff']
};

// image: 시트 파일 이름, id: pixelfx 효과, options: 효과 옵션, from/to/step: 고를 프레임(30fps, to 포함), up: 기준점(origin 위 px)
export const SHEETS = [
    // 이전 효과 그림을 바꾼 것
    { image: 'pfx_zap_hit', id: 'lightning/zap-hit', options: {}, from: 0, to: 26, step: 2, up: 0 },
    { image: 'pfx_fire_blast', id: 'explosions/plasma-explosion', options: { palette: ['#200806', '#5c1410', '#a8281a', '#f05a1d', '#ffa030', '#ffe080', '#ffffff'], accent: ['#2a0c06', '#7a2010', '#e0481c', '#ffb060', '#fff0c0'] }, from: 0, to: 38, step: 2, up: 0 },
    { image: 'pfx_gold_burst', id: 'arcane/mana-burst', options: { palette: PAL.gold }, from: 6, to: 36, step: 2, up: 28 },
    { image: 'pfx_cyan_burst', id: 'arcane/mana-burst', options: { palette: PAL.cyan }, from: 6, to: 36, step: 2, up: 28 },
    { image: 'pfx_roar', id: 'scifi/emp-blast', options: { palette: PAL.pink, fringe: '#ffd0ec' }, from: 0, to: 57, step: 3, up: 20 },
    { image: 'pfx_lightning_strike', id: 'lightning/lightning-strike', options: {}, from: 12, to: 66, step: 3, up: 0 },
    { image: 'pfx_thunderclap', id: 'lightning/thunderclap', options: {}, from: 0, to: 44, step: 2, up: 10 },
    { image: 'pfx_soul_rise', id: 'spawn/soul-rise', options: { palette: PAL.violet.slice(1) }, from: 0, to: 57, step: 3, up: 0 },
    { image: 'pfx_arrow', id: 'projectiles/arrow', options: {}, from: 0, to: 16, step: 2, up: 0 },
    { image: 'pfx_arrow_curse', id: 'projectiles/arrow', options: { palette: ['#4a1a7a', '#8a3ce0', '#e6ccff', '#ffffff'] }, from: 0, to: 16, step: 2, up: 0 },
    // 몬스터 투사체
    { image: 'pfx_fireball', id: 'fire/fireball', options: {}, from: 0, to: 33, step: 3, up: 0 },
    { image: 'pfx_bloodball', id: 'fire/fireball', options: { palette: PAL.blood }, from: 0, to: 33, step: 3, up: 0 },
    { image: 'pfx_ice_lance', id: 'ice/ice-lance', options: {}, from: 0, to: 22, step: 2, up: 0 },
    { image: 'pfx_axe', id: 'projectiles/energy-disc', options: { palette: PAL.steel, teeth: 3 }, from: 0, to: 14, step: 1, up: 0 },
    { image: 'pfx_jester_disc', id: 'projectiles/energy-disc', options: { palette: PAL.jester, teeth: 4 }, from: 0, to: 14, step: 1, up: 0 },
    // 능력 효과
    { image: 'pfx_burning', id: 'fire/spirit-flame', options: { palette: PAL.fire }, from: 0, to: 84, step: 6, up: 0 },
    { image: 'pfx_fire_ground', id: 'fire/fire-ring', options: { reach: 60 }, from: 15, to: 36, step: 3, up: 0 },
    { image: 'pfx_snowflake', id: 'ice/snowflake-burst', options: {}, from: 0, to: 57, step: 3, up: 30 },
    { image: 'pfx_stunned', id: 'status/stunned', options: {}, from: 0, to: 56, step: 4, up: 0 },
    { image: 'pfx_heal', id: 'pickups/collect-burst', options: { palette: PAL.green }, from: 0, to: 36, step: 2, up: 30 },
    { image: 'pfx_lifesteal', id: 'pickups/collect-burst', options: { palette: PAL.red }, from: 0, to: 36, step: 2, up: 30 },
    { image: 'pfx_gold', id: 'pickups/collect-burst', options: { palette: PAL.gold }, from: 0, to: 36, step: 2, up: 30 },
    { image: 'pfx_heal_aoe', id: 'holy/heal-aoe', options: {}, from: 6, to: 69, step: 3, up: 0 },
    { image: 'pfx_rune_heal', id: 'arcane/rune-circle', options: { palette: PAL.green }, from: 0, to: 112, step: 8, up: 0 },
    { image: 'pfx_rune_damage', id: 'arcane/rune-circle', options: { palette: PAL.red }, from: 0, to: 112, step: 8, up: 0 },
    { image: 'pfx_rune_speed', id: 'arcane/rune-circle', options: { palette: PAL.yellow }, from: 0, to: 112, step: 8, up: 0 },
    { image: 'pfx_cleave', id: 'melee/spin-slash', options: { palette: PAL.orange }, from: 0, to: 22, step: 1, up: 0 },
    { image: 'pfx_thorns', id: 'nature/thorns', options: { count: 3 }, from: 0, to: 57, step: 3, up: 0 }
];

const COLS = 8;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [pfxDir, ...only] = process.argv.slice(2);
if (!pfxDir) {
    console.error('사용법: node tools/pfx_sheets.mjs <pixelfx 폴더> [시트 이름...]');
    process.exit(2);
}
const lib = await import(pathToFileURL(join(pfxDir, 'tools/lib/fxlib.mjs')));
const { encodePNG } = await import(pathToFileURL(join(pfxDir, 'tools/lib/png.mjs')));
mkdirSync(join(root, 'assets/fx'), { recursive: true });
let total = 0;
for (const s of SHEETS) {
    if (only.length && !only.includes(s.image)) continue;
    const fx = await lib.loadEffect(s.id);
    const r = lib.renderFrames(fx, { bg: 'none', actor: false, options: s.options });
    const picks = [];
    for (let i = s.from; i <= Math.min(s.to, r.n - 1); i += s.step) picks.push(i);
    // 고른 모든 프레임을 덮는 상자
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (const i of picks) {
        const c = r.frames[i].clear;
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
            if (c[(y * r.w + x) * 4 + 3] === 0) continue;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const cols = Math.min(COLS, picks.length), rows = Math.ceil(picks.length / cols);
    const out = new Uint8ClampedArray(w * cols * h * rows * 4);
    picks.forEach((f, k) => {
        const c = r.frames[f].clear;
        const ox = (k % cols) * w, oy = Math.floor(k / cols) * h;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const si = ((y + y0) * r.w + x + x0) * 4, di = ((oy + y) * w * cols + ox + x) * 4;
            out[di] = c[si]; out[di + 1] = c[si + 1]; out[di + 2] = c[si + 2]; out[di + 3] = c[si + 3];
        }
    });
    const png = encodePNG(w * cols, h * rows, out);
    writeFileSync(join(root, 'assets/fx', s.image + '.png'), png);
    total += png.length;
    const [ox, oy] = fx.meta.origin;
    const life = Math.round(picks.length * s.step / r.fps * 1000) / 1000;
    console.log(`${s.image}: { image: '${s.image}', w: ${w}, h: ${h}, cols: ${cols}, frames: ${picks.length}, pivotX: ${ox - x0}, pivotY: ${oy - s.up - y0}, life: ${life} }, // ${s.id} ${Math.round(png.length / 1024)}KB`);
}
console.log(`합계 ${Math.round(total / 1024)}KB`);
