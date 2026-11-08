// pixelfx(https://github.com/patch-gg/pixelfx, MIT)로 만든 전투 효과 시트. 만든 방법은 docs/PIXELLAB_ASSETS.md와 tools/pfx_sheets.mjs
// 열쇠는 코드가 부르는 효과 이름이다(이전 효과 그림의 이름을 그대로 쓴다). 그림은 assets/fx/<image>.png, 한 줄에 cols칸씩 왼쪽 위부터 채운다.
// pivot은 Fx.anim에 넘긴 좌표가 닿는 그림 속 점, life는 재생 길이(초), fit은 화면 1배로 그리는 기준 size(화면 px)다.
// loop가 true면 상태 표시처럼 Game.time에 맞춰 반복해 그린다(Render.drawLoopSheet). shot이 true면 투사체 그림이다(날아가는 방향으로 돌린다)
// 효과 픽셀 하나를 화면 몇 px 이상으로 그리는가. pixelfx 효과는 작은 캐릭터 기준이라 몬스터(키 76px 안팎) 옆에서는 2배라야 또렷하다.
// 시트마다 px로 바꿀 수 있다(바닥에 깔리는 룬과 장판, 해상도가 높은 Asteria 그림은 1)
const FX_PIXEL = 2;

const FX_SHEETS = {
    // add: 검은 바탕 그림이라 빛을 더해(lighter) 그린다
    // 정예와 보스 처치: Asteria 해적 선장의 동전 폭발(tools/import_asteria_gold.py)
    fx_coin_blast: { image: 'pfx_coin_blast', w: 128, h: 128, cols: 8, frames: 8, pivotX: 64, pivotY: 64, life: 0.6, fit: 128, add: true, px: 1 },
    // 정예 용사 오라: Asteria 모험가 오라 그대로(tools/import_asteria_heroes.py). 몸 뒤에서 돈다
    fx_aura_elite_swordsman: { image: 'pfx_aura_nightExecutioner', w: 128, h: 128, cols: 8, frames: 8, pivotX: 64, pivotY: 64, life: 0.8, fit: 128, loop: true },
    fx_aura_elite_tamer: { image: 'pfx_aura_mistBlade', w: 128, h: 128, cols: 8, frames: 8, pivotX: 64, pivotY: 64, life: 0.8, fit: 128, loop: true },
    fx_aura_elite_stormcaller: { image: 'pfx_aura_thunderSage', w: 128, h: 128, cols: 8, frames: 8, pivotX: 64, pivotY: 64, life: 0.8, fit: 128, loop: true },
    fx_aura_elite_rhapsodist: { image: 'pfx_aura_sunMoonDance', w: 128, h: 128, cols: 8, frames: 8, pivotX: 64, pivotY: 64, life: 0.8, fit: 128, loop: true },
    fx_hit_physical: { image: 'pfx_hit_spark', w: 119, h: 70, cols: 8, frames: 15, pivotX: 32, pivotY: 56, life: 0.5, fit: 110 }, // impacts/hit-spark
    fx_hit_crit: { image: 'pfx_crit_hit', w: 170, h: 129, cols: 8, frames: 18, pivotX: 74, pivotY: 100, life: 0.6, fit: 150 }, // impacts/crit-hit
    fx_explosion: { image: 'pfx_poof', w: 86, h: 75, cols: 8, frames: 18, pivotX: 39, pivotY: 64, life: 0.6, fit: 100 }, // spawn/poof
    fx_blastViolet: { image: 'pfx_mana_burst', w: 167, h: 145, cols: 8, frames: 16, pivotX: 85, pivotY: 92, life: 0.533, fit: 180 }, // arcane/mana-burst
    // 이전 효과 그림을 바꾼 것
    fx_hit_lightning: { image: 'pfx_zap_hit', w: 129, h: 104, cols: 8, frames: 14, pivotX: 75, pivotY: 52, life: 0.45, fit: 130 }, // lightning/zap-hit
    fx_shock_small: { image: 'pfx_zap_hit', w: 129, h: 104, cols: 8, frames: 14, pivotX: 75, pivotY: 52, life: 0.45, fit: 130, px: 1 }, // 용사(정예 뇌술사)의 범위 감전: 같은 그림을 1배로
    fx_hit_fire: { image: 'pfx_fire_blast', w: 200, h: 190, cols: 8, frames: 20, pivotX: 102, pivotY: 95, life: 0.7, fit: 200 }, // explosions/plasma-explosion(불 팔레트)
    fx_blastGold: { image: 'pfx_gold_burst', w: 167, h: 145, cols: 8, frames: 16, pivotX: 85, pivotY: 92, life: 0.6, fit: 180 }, // arcane/mana-burst(금색)
    fx_blastCyan: { image: 'pfx_cyan_burst', w: 167, h: 145, cols: 8, frames: 16, pivotX: 85, pivotY: 92, life: 0.5, fit: 180 }, // arcane/mana-burst(청록)
    fx_blastPink: { image: 'pfx_roar', w: 151, h: 112, cols: 8, frames: 20, pivotX: 76, pivotY: 62, life: 0.9, fit: 150 }, // scifi/emp-blast(분홍)
    fx_adv_arcanist_lightning: { image: 'pfx_lightning_strike', w: 231, h: 262, cols: 8, frames: 19, pivotX: 115, pivotY: 227, life: 0.8, fit: 300 }, // lightning/lightning-strike
    fx_adv_arcanist_thunderGod: { image: 'pfx_thunderclap', w: 254, h: 151, cols: 8, frames: 23, pivotX: 128, pivotY: 110, life: 0.9, fit: 254 }, // lightning/thunderclap
    fx_adv_doomMelody_requiem: { image: 'pfx_soul_rise', w: 84, h: 113, cols: 8, frames: 20, pivotX: 42, pivotY: 100, life: 0.9, fit: 120 }, // spawn/soul-rise(보라)
    // 투사체(pivot은 앞 끝)
    fx_arrowPoison: { image: 'pfx_arrow', w: 93, h: 16, cols: 8, frames: 9, pivotX: 88, pivotY: 9, life: 0.3, fit: 90, shot: true }, // projectiles/arrow
    fx_arrowBig: { image: 'pfx_arrow', w: 93, h: 16, cols: 8, frames: 9, pivotX: 88, pivotY: 9, life: 0.3, fit: 90, shot: true }, // 같은 화살을 2배로
    fx_shot_curse: { image: 'pfx_arrow_curse', w: 93, h: 16, cols: 8, frames: 9, pivotX: 88, pivotY: 9, life: 0.3, fit: 90, shot: true }, // projectiles/arrow(보라)
    fx_shot_fire: { image: 'pfx_fireball', w: 117, h: 53, cols: 8, frames: 12, pivotX: 94, pivotY: 26, life: 0.6, fit: 110, shot: true }, // fire/fireball
    fx_shot_blood: { image: 'pfx_bloodball', w: 117, h: 53, cols: 8, frames: 12, pivotX: 94, pivotY: 26, life: 0.6, fit: 110, shot: true }, // fire/fireball(핏빛)
    fx_shot_ice: { image: 'pfx_ice_lance', w: 142, h: 44, cols: 8, frames: 12, pivotX: 129, pivotY: 22, life: 0.4, fit: 130, shot: true }, // ice/ice-lance
    fx_shot_axe: { image: 'pfx_axe', w: 96, h: 48, cols: 8, frames: 15, pivotX: 72, pivotY: 24, life: 0.5, fit: 90, shot: true }, // projectiles/energy-disc(강철)
    fx_shot_jester: { image: 'pfx_jester_disc', w: 96, h: 48, cols: 8, frames: 15, pivotX: 72, pivotY: 24, life: 0.5, fit: 90, shot: true }, // projectiles/energy-disc(분홍)
    // 몬스터 능력
    fx_poison_cloud: { image: 'pfx_poison_cloud', w: 213, h: 74, cols: 8, frames: 15, pivotX: 107, pivotY: 61, life: 4, fit: 220, loop: true, px: 1 }, // nature/poison-cloud(역병 구름)
    fx_acid_splash: { image: 'pfx_acid_splash', w: 112, h: 68, cols: 8, frames: 13, pivotX: 55, pivotY: 53, life: 0.8, fit: 120, px: 1 }, // nature/acid-splash(독이 옮음)
    fx_burning: { image: 'pfx_burning', w: 76, h: 98, cols: 8, frames: 15, pivotX: 38, pivotY: 70, life: 1.5, fit: 100, loop: true }, // fire/spirit-flame(불)
    fx_fire_ground: { image: 'pfx_fire_ground', w: 152, h: 117, cols: 8, frames: 8, pivotX: 76, pivotY: 82, life: 0.8, fit: 160, loop: true, px: 1 }, // fire/fire-ring
    fx_snowflake: { image: 'pfx_snowflake', w: 120, h: 113, cols: 8, frames: 20, pivotX: 60, pivotY: 73, life: 0.8, fit: 130 }, // ice/snowflake-burst
    fx_stunned: { image: 'pfx_stunned', w: 50, h: 37, cols: 8, frames: 15, pivotX: 24, pivotY: 37, life: 1, fit: 50, loop: true, px: 1 }, // status/stunned
    fx_heal: { image: 'pfx_heal', w: 77, h: 87, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.7, fit: 80 }, // pickups/collect-burst(초록)
    fx_lifesteal: { image: 'pfx_lifesteal', w: 77, h: 87, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.6, fit: 80 }, // pickups/collect-burst(붉은)
    fx_gold: { image: 'pfx_gold', w: 77, h: 87, cols: 8, frames: 19, pivotX: 36, pivotY: 51, life: 0.8, fit: 80 }, // pickups/collect-burst(금색)
    fx_heal_aoe: { image: 'pfx_heal_aoe', w: 232, h: 114, cols: 8, frames: 22, pivotX: 116, pivotY: 83, life: 1.2, fit: 230, px: 1 }, // holy/heal-aoe
    fx_rune_heal: { image: 'pfx_rune_heal', w: 116, h: 89, cols: 8, frames: 15, pivotX: 58, pivotY: 70, life: 4, fit: 120, loop: true, px: 1 }, // arcane/rune-circle(초록)
    fx_rune_damage: { image: 'pfx_rune_damage', w: 116, h: 89, cols: 8, frames: 15, pivotX: 58, pivotY: 70, life: 4, fit: 120, loop: true, px: 1 }, // arcane/rune-circle(붉은)
    fx_rune_attackSpeed: { image: 'pfx_rune_speed', w: 116, h: 90, cols: 8, frames: 15, pivotX: 58, pivotY: 71, life: 4, fit: 120, loop: true, px: 1 }, // arcane/rune-circle(노랑)
    fx_cleave: { image: 'pfx_cleave', w: 183, h: 99, cols: 8, frames: 23, pivotX: 79, pivotY: 80, life: 0.5, fit: 180 }, // melee/spin-slash(주황)
    fx_thorns: { image: 'pfx_thorns', w: 203, h: 76, cols: 8, frames: 20, pivotX: 26, pivotY: 63, life: 0.8, fit: 200 } // nature/thorns
};
