// pixelfx(https://github.com/patch-gg/pixelfx, MIT)로 만든 전투 효과 시트. 만든 방법은 docs/PIXELLAB_ASSETS.md와 tools/pfx_sheets.mjs
// 열쇠는 코드가 부르는 효과 이름이다(옛 Asteria 효과 이름도 그대로 쓴다). 그림은 assets/fx/<image>.png, 한 줄에 cols칸씩 왼쪽 위부터 채운다.
// pivot은 Fx.anim에 넘긴 좌표가 닿는 그림 속 점, life는 재생 길이(초), fit은 화면 1배로 그리는 기준 size(화면 px)다.
// loop가 true면 상태 표시처럼 Game.time에 맞춰 반복해 그린다(Render.drawLoopSheet). shot이 true면 투사체 그림이다(날아가는 방향으로 돌린다)
const FX_SHEETS = {
    fx_hit_physical: { image: 'pfx_hit_spark', w: 122, h: 71, cols: 8, frames: 15, pivotX: 34, pivotY: 36, life: 0.5, fit: 110 }, // impacts/hit-spark
    fx_hit_crit: { image: 'pfx_crit_hit', w: 174, h: 131, cols: 8, frames: 18, pivotX: 77, pivotY: 76, life: 0.6, fit: 150 }, // impacts/crit-hit
    fx_explosion: { image: 'pfx_poof', w: 91, h: 76, cols: 8, frames: 18, pivotX: 43, pivotY: 40, life: 0.6, fit: 100 }, // spawn/poof
    fx_blastViolet: { image: 'pfx_mana_burst', w: 170, h: 146, cols: 8, frames: 16, pivotX: 85, pivotY: 93, life: 0.533, fit: 180 }, // arcane/mana-burst
    // 옛 Asteria 효과를 바꾼 것
    fx_hit_lightning: { image: 'pfx_zap_hit', w: 129, h: 104, cols: 8, frames: 14, pivotX: 75, pivotY: 52, life: 0.45, fit: 130 }, // lightning/zap-hit
    fx_hit_fire: { image: 'pfx_fire_blast', w: 206, h: 190, cols: 8, frames: 20, pivotX: 108, pivotY: 95, life: 0.7, fit: 200 }, // explosions/plasma-explosion(불 팔레트)
    fx_blastGold: { image: 'pfx_gold_burst', w: 170, h: 146, cols: 8, frames: 16, pivotX: 85, pivotY: 93, life: 0.6, fit: 180 }, // arcane/mana-burst(금색)
    fx_blastCyan: { image: 'pfx_cyan_burst', w: 170, h: 146, cols: 8, frames: 16, pivotX: 85, pivotY: 93, life: 0.5, fit: 180 }, // arcane/mana-burst(청록)
    fx_blastPink: { image: 'pfx_roar', w: 151, h: 114, cols: 8, frames: 20, pivotX: 76, pivotY: 63, life: 0.9, fit: 150 }, // scifi/emp-blast(분홍)
    fx_adv_arcanist_lightning: { image: 'pfx_lightning_strike', w: 231, h: 262, cols: 8, frames: 19, pivotX: 115, pivotY: 227, life: 0.8, fit: 300 }, // lightning/lightning-strike
    fx_adv_arcanist_thunderGod: { image: 'pfx_thunderclap', w: 254, h: 151, cols: 8, frames: 23, pivotX: 128, pivotY: 110, life: 0.9, fit: 254 }, // lightning/thunderclap
    fx_adv_doomMelody_requiem: { image: 'pfx_soul_rise', w: 88, h: 114, cols: 8, frames: 20, pivotX: 44, pivotY: 101, life: 0.9, fit: 120 }, // spawn/soul-rise(보라)
    // 투사체(pivot은 앞 끝)
    fx_arrowPoison: { image: 'pfx_arrow', w: 94, h: 18, cols: 8, frames: 9, pivotX: 88, pivotY: 10, life: 0.3, fit: 90, shot: true }, // projectiles/arrow
    fx_arrowBig: { image: 'pfx_arrow', w: 94, h: 18, cols: 8, frames: 9, pivotX: 88, pivotY: 10, life: 0.3, fit: 90, shot: true }, // 같은 화살을 2배로
    fx_shot_curse: { image: 'pfx_arrow_curse', w: 94, h: 18, cols: 8, frames: 9, pivotX: 88, pivotY: 10, life: 0.3, fit: 90, shot: true }, // projectiles/arrow(보라)
    fx_shot_fire: { image: 'pfx_fireball', w: 117, h: 54, cols: 8, frames: 12, pivotX: 94, pivotY: 27, life: 0.6, fit: 110, shot: true }, // fire/fireball
    fx_shot_blood: { image: 'pfx_bloodball', w: 117, h: 54, cols: 8, frames: 12, pivotX: 94, pivotY: 27, life: 0.6, fit: 110, shot: true }, // fire/fireball(핏빛)
    fx_shot_ice: { image: 'pfx_ice_lance', w: 142, h: 50, cols: 8, frames: 12, pivotX: 129, pivotY: 25, life: 0.4, fit: 130, shot: true }, // ice/ice-lance
    fx_shot_axe: { image: 'pfx_axe', w: 97, h: 48, cols: 8, frames: 15, pivotX: 72, pivotY: 24, life: 0.5, fit: 90, shot: true }, // projectiles/energy-disc(강철)
    fx_shot_jester: { image: 'pfx_jester_disc', w: 97, h: 48, cols: 8, frames: 15, pivotX: 72, pivotY: 24, life: 0.5, fit: 90, shot: true }, // projectiles/energy-disc(분홍)
    // 몬스터 능력
    fx_burning: { image: 'pfx_burning', w: 78, h: 100, cols: 8, frames: 15, pivotX: 39, pivotY: 71, life: 1.5, fit: 100, loop: true }, // fire/spirit-flame(불)
    fx_fire_ground: { image: 'pfx_fire_ground', w: 162, h: 122, cols: 8, frames: 8, pivotX: 81, pivotY: 87, life: 0.8, fit: 160, loop: true }, // fire/fire-ring
    fx_snowflake: { image: 'pfx_snowflake', w: 126, h: 115, cols: 8, frames: 20, pivotX: 63, pivotY: 74, life: 0.8, fit: 130 }, // ice/snowflake-burst
    fx_stunned: { image: 'pfx_stunned', w: 50, h: 39, cols: 8, frames: 15, pivotX: 24, pivotY: 20, life: 1, fit: 50, loop: true }, // status/stunned
    fx_heal: { image: 'pfx_heal', w: 77, h: 88, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.7, fit: 80 }, // pickups/collect-burst(초록)
    fx_lifesteal: { image: 'pfx_lifesteal', w: 77, h: 88, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.6, fit: 80 }, // pickups/collect-burst(붉은)
    fx_gold: { image: 'pfx_gold', w: 77, h: 88, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.8, fit: 80 }, // pickups/collect-burst(금색)
    fx_heal_aoe: { image: 'pfx_heal_aoe', w: 234, h: 117, cols: 8, frames: 22, pivotX: 117, pivotY: 86, life: 1.2, fit: 230 }, // holy/heal-aoe
    fx_rune_heal: { image: 'pfx_rune_heal', w: 118, h: 95, cols: 8, frames: 15, pivotX: 59, pivotY: 75, life: 4, fit: 120, loop: true }, // arcane/rune-circle(초록)
    fx_rune_damage: { image: 'pfx_rune_damage', w: 118, h: 95, cols: 8, frames: 15, pivotX: 59, pivotY: 75, life: 4, fit: 120, loop: true }, // arcane/rune-circle(붉은)
    fx_rune_attackSpeed: { image: 'pfx_rune_speed', w: 118, h: 96, cols: 8, frames: 15, pivotX: 59, pivotY: 76, life: 4, fit: 120, loop: true }, // arcane/rune-circle(노랑)
    fx_cleave: { image: 'pfx_cleave', w: 183, h: 101, cols: 8, frames: 23, pivotX: 79, pivotY: 82, life: 0.5, fit: 180 }, // melee/spin-slash(주황)
    fx_thorns: { image: 'pfx_thorns', w: 203, h: 77, cols: 8, frames: 20, pivotX: 100, pivotY: 64, life: 0.8, fit: 200 } // nature/thorns
};
