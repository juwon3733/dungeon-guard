// tools/pfx_sheets.mjs가 만든다(손대지 않음). 그림: pixelfx(MIT, https://github.com/patch-gg/pixelfx)
export type FxSheet = { w: number; h: number; cols: number; frames: number; px: number; py: number; life: number };
export const FX_SHEETS = {
  hit: { w: 117, h: 70, cols: 7, frames: 7, px: 32, py: 56, life: 0.47 }, // impacts/hit-spark
  crit: { w: 167, h: 129, cols: 8, frames: 9, px: 74, py: 100, life: 0.9 }, // impacts/crit-hit
  slash: { w: 127, h: 100, cols: 8, frames: 9, px: 43, py: 90, life: 0.6 }, // melee/sword-slash
  claw: { w: 74, h: 59, cols: 8, frames: 8, px: 5, py: 49, life: 0.8 }, // melee/claw-swipe
  poof: { w: 86, h: 75, cols: 8, frames: 11, px: 39, py: 64, life: 1.47 }, // spawn/poof
  soul: { w: 78, h: 125, cols: 8, frames: 14, px: 39, py: 112, life: 3.27 }, // spawn/soul-rise
  respawn: { w: 124, h: 149, cols: 8, frames: 14, px: 62, py: 136, life: 2.33 }, // spawn/respawn-beam
  big_boom: { w: 297, h: 261, cols: 8, frames: 15, px: 151, py: 231, life: 7 }, // explosions/big-explosion
  dirt_boom: { w: 248, h: 225, cols: 8, frames: 13, px: 127, py: 193, life: 3.47 }, // explosions/dirt-explosion
  small_boom: { w: 207, h: 221, cols: 8, frames: 12, px: 97, py: 179, life: 5.2 }, // explosions/small-explosion
  slam: { w: 242, h: 170, cols: 8, frames: 13, px: 121, py: 127, life: 3.03 }, // impacts/ground-slam
  quake: { w: 249, h: 76, cols: 8, frames: 15, px: 130, py: 61, life: 3 }, // nature/quake
  charmed: { w: 52, h: 58, cols: 8, frames: 12, px: 26, py: 66, life: 2.4 }, // status/charmed
  dash: { w: 210, h: 121, cols: 8, frames: 9, px: -52, py: 102, life: 0.9 }, // moves/dash-strike
  shield: { w: 70, h: 74, cols: 8, frames: 15, px: 35, py: 61, life: 2.5 }, // holy/divine-shield
  curse: { w: 93, h: 107, cols: 8, frames: 15, px: 44, py: 104, life: 3.5 }, // shadow/curse
  hex: { w: 136, h: 123, cols: 8, frames: 15, px: 68, py: 110, life: 4 }, // shadow/hex-sigil
  drain: { w: 165, h: 66, cols: 8, frames: 13, px: 24, py: 60, life: 2.17 }, // shadow/life-steal
  breath: { w: 154, h: 111, cols: 8, frames: 15, px: 11, py: 69, life: 1.5 }, // fire/fire-breath
  meteor: { w: 249, h: 222, cols: 8, frames: 16, px: 148, py: 198, life: 4.8 }, // fire/meteor
  fire_boom: { w: 204, h: 188, cols: 8, frames: 11, px: 107, py: 94, life: 1.47 }, // explosions/plasma-explosion
  heal_ring: { w: 232, h: 113, cols: 8, frames: 14, px: 116, py: 82, life: 2.8 }, // holy/heal-aoe
  dark_boom: { w: 246, h: 238, cols: 8, frames: 15, px: 123, py: 198, life: 4 }, // shadow/dark-explosion
  black_hole: { w: 165, h: 129, cols: 8, frames: 15, px: 81, py: 122, life: 4 }, // shadow/black-hole
  magic_circle: { w: 160, h: 219, cols: 8, frames: 15, px: 80, py: 192, life: 3.5 }, // arcane/magic-circle-cast
  arrow_hit: { w: 111, h: 70, cols: 8, frames: 8, px: 80, py: 59, life: 1.33 }, // impacts/bullet-impact
} satisfies Record<string, FxSheet>;
export type FxName = keyof typeof FX_SHEETS;
