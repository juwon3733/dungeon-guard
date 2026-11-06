# PixelLab 그림 목록 (품질 시험판)

맵과 배경, 전투 효과, UI는 Asteria 것을 유지하고, 아래 캐릭터와 시설만 새로 만든다.

## 공통 규격

- 도구: PixelLab MCP. 만들기 전에 `get_balance`로 잔액을 확인한다.
- 시점: `high top-down`. 맵의 3/4 시점에 가장 가까운 값이며, 첫 캐릭터를 맵에 올려 보고 확정한다.
- 외곽선: `single color black outline`, 자세한 정도: `high detail`
- 표시: 그림 자체는 2배로 두고 세계 전체를 0.75배로 그려 화면에서 1.5배로 보인다(칸 72px). 도트 크기가 조금 불균일한 것은 감수하기로 했다.
- 파일 위치: `assets/sprites/pl_<이름>/` (`rotations/`, `animations/<동작>/<방향>/frame_000.png`). 전사 폴더: 걷기 `walking`, 공격 `slash`, 사망 `falling_backward`
- 동작 방식: 템플릿 모드는 들고 있는 무기와 방패가 사라진다. 걷기와 사망은 `mode=skeleton-v3`(프레임 캔버스 64px), 공격은 `mode=v3`와 `action_description`으로 만든다. 전사 기준 48px 캐릭터 하나에 4방향 28회다(걷기 12, 사망 12, 공격 4). 아래 표의 동작 이름과 예상 비용은 템플릿 기준으로 쓴 것이라 이 방식이면 더 든다
- 분위기: 작고 귀여운 판타지 용사. 어두운 보라색 맵에서 눈에 띄도록 밝은 색을 쓴다.

## 공통 스타일 문구

모든 설명 뒤에 붙인다.

```
cute fantasy game unit, chunky readable silhouette, bright saturated colors, clean pixel clusters
```

## 캐릭터

크기는 캔버스 기준이다. 4방향은 south, west, east, north다.

| 이름 | 역할 | 크기 | 방향 | 동작 | 설명 |
|---|---|---|---|---|---|
| hero_warrior | 전사 | 48 | 4 | walking-6-frames, cross-punch, falling-back-death | young human warrior, steel armor, red cape, sword and round shield |
| hero_rogue | 도적 | 48 | 4 | running-6-frames, lead-jab, falling-back-death | nimble thief in green hood, leather armor, twin daggers |
| hero_mage | 마법사 | 48 | 4 | walking-6-frames, fireball, falling-back-death | young wizard, blue robe, pointed hat, glowing staff |
| boss_captain | 용사단 부대장 | 96 | 4 | walking-6-frames, surprise-uppercut, fireball | armored hero captain, golden plate armor, white plume, huge greatsword |
| orc_guard | 오크 부하 | 48 | 4 | walking-6-frames, cross-punch, falling-back-death | stout green orc guard, leather armor, spiked club |
| demon_lord | 마왕 | 96 | south만 | breathing-idle, fireball, taking-punch | small grumpy demon lord, black and purple robe, curved horns, gold crown |

- 타락 유닛은 용사 그림에 보라색을 입혀 쓰므로 따로 만들지 않는다.
- PixelLab에는 공격 전용 템플릿이 없어 가장 가까운 동작을 쓴다.

## 시설

배경이 투명한 한 방향 오브젝트로 만든다.

| 이름 | 크기 | 설명 |
|---|---|---|
| fac_archer | 96 | stone watchtower with a skeleton archer on top, dark purple banner |
| fac_crystal | 96 | floating dark amethyst crystal on a carved stone pedestal, magic glow |
| fac_barracks | 96 | small orc war camp hut, wooden spikes, red tribal banner |

## 예상 비용

마왕 외에는 실제 쓴 비용이다.

| 항목 | 계산 | 생성 횟수 |
|---|---|---|
| 전사 | 만들기 2 + 동작 28 + 시험 18 | 실제 48 |
| 도적, 마법사 | 2개 × (만들기 2 + 걷기 9 + 공격 3 + 사망 1) | 실제 30 |
| 오크 | 만들기 2 + 걷기 9 + 공격 3 | 실제 14 |
| 시설 3개 | 96px 후보 4장, 개당 10 | 실제 30 |
| 부대장 | 만들지 않음, Asteria `boss_fallen_knight` 사용 | 0 |
| 96px 마왕 (만든다면 1종당) | 만들기 3 + 동작 3개, south만 8~11 | 약 11~14 (추정) |

## 전투 효과 (pixelfx)

전투 효과는 모두 PixelLab이 아니라 pixelfx(https://github.com/patch-gg/pixelfx, MIT, 커밋 `a841596`)로 만든 시트를 쓴다. 표기는 `NOTICE.md`.

| 옛 이름 | pixelfx id | 옵션 | 쓴 프레임 (30fps) | 재생 | 시트 |
|---|---|---|---|---|---|
| fx_hit_physical | `impacts/hit-spark` | 기본값 | 0~14 | 0.5초 | `assets/fx/pfx_hit_spark.png` 122×71 ×15, 25KB |
| fx_hit_crit | `impacts/crit-hit` | 기본값 | 0~17 | 0.6초 | `assets/fx/pfx_crit_hit.png` 174×131 ×18, 160KB |
| fx_explosion | `spawn/poof` | 기본값 | 0~34, 2칸마다 | 0.6초 | `assets/fx/pfx_poof.png` 91×76 ×18, 57KB |
| fx_blastViolet | `arcane/mana-burst` | `{"palette":["#160a28","#2e1456","#4a2088","#6a32b8","#8f52e0","#c28bff","#e6ccff","#ffffff"]}` | 6~36, 2칸마다 | 0.53초 | `assets/fx/pfx_mana_burst.png` 170×146 ×16, 266KB |

- 만드는 법: pixelfx를 저장소 밖에 clone하고 `tools/lib/fxlib.mjs`의 `renderFrames(fx, { bg: "none", actor: false, options })`로 렌더링한 뒤, 위 프레임만 골라 모든 프레임을 덮는 상자로 잘라 한 줄 8칸 시트로 붙인다. 결과 크기와 기준점은 `js/data/fx_sheets.js`에 적는다.
- 기준점: 효과의 origin(바닥)에서 위로 hit-spark 20, crit-hit 26, poof 25, mana-burst 28px 올린 점을 `Fx.anim` 좌표에 맞춘다. 타격 섬광과 폭발 중심이 맞는 자리다.
- 그리기: `Render.drawSheetEffects`가 보통 합성으로 그린다(빛이 시트에 이미 들어 있다). 화면 배율은 `round(size × WORLD_ZOOM / fit)`(최소 1)이라 대부분 1배, 수정 폭발 강화(반경 2칸)는 2배다.
- 옛 Asteria `fx_` 그림은 모두 아래 시트로 바꿔 더 불러오지 않는다(파일은 `assets/sprites/`에 남아 있다).

### 바꾼 효과와 몬스터 능력 효과 (2026-11-06)

옛 Asteria 효과 10개를 모두 pixelfx로 바꾸고, 새 능력마다 효과를 넣었다. 재현은 `node tools/pfx_sheets.mjs <pixelfx 폴더> [시트 이름...]`이다(pixelfx는 저장소 밖에 clone한다). 이 도구의 `SHEETS` 표에 효과, 옵션(팔레트 색값 포함), 고른 프레임, 기준점 높이(`up`)가 있고, 실행하면 시트를 쓰고 `js/data/fx_sheets.js`에 옮길 줄을 출력한다. 재생 시간은 화면이 효과로 덮이지 않게 원래보다 짧게 `fx_sheets.js`에 적었다.

| 쓰는 곳(코드 열쇠) | pixelfx id | 옵션 | 쓴 프레임 (30fps) | 재생 | 시트 |
|---|---|---|---|---|---|
| fx_hit_lightning, 연쇄 번개 | `lightning/zap-hit` | 기본값 | 0~26, 2칸마다 | 0.45초 | `assets/fx/pfx_zap_hit.png` 61KB |
| fx_hit_fire(왕좌 피격), 용암 악마 폭발 | `explosions/plasma-explosion` | palette 불 7색, accent 불 5색 | 0~38, 2칸마다 | 0.7초 | `assets/fx/pfx_fire_blast.png` 231KB |
| fx_blastGold(제물, 강화) | `arcane/mana-burst` | palette 금색 8색 | 6~36, 2칸마다 | 0.6초 | `assets/fx/pfx_gold_burst.png` 257KB |
| fx_blastCyan(배치) | `arcane/mana-burst` | palette 청록 8색 | 6~36, 2칸마다 | 0.5초 | `assets/fx/pfx_cyan_burst.png` 253KB |
| fx_blastPink(호통) | `scifi/emp-blast` | palette 분홍 8색, fringe `#ffd0ec` | 0~57, 3칸마다 | 0.9초 | `assets/fx/pfx_roar.png` 134KB |
| fx_adv_arcanist_lightning(번개 기둥) | `lightning/lightning-strike` | 기본값 | 12~66, 3칸마다 | 0.8초 | `assets/fx/pfx_lightning_strike.png` 426KB |
| fx_adv_arcanist_thunderGod(번개 바닥, 보스 처치) | `lightning/thunderclap` | 기본값 | 0~44, 2칸마다 | 0.9초 | `assets/fx/pfx_thunderclap.png` 228KB |
| fx_adv_doomMelody_requiem(타락, 꺼 둠) | `spawn/soul-rise` | palette 보라 7색 | 0~57, 3칸마다 | 0.9초 | `assets/fx/pfx_soul_rise.png` 105KB |
| fx_arrowPoison, fx_arrowBig(화살, 큰 화살은 2배) | `projectiles/arrow` | 기본값 | 0~16, 2칸마다 | 반복 0.3초 | `assets/fx/pfx_arrow.png` 2KB |
| fx_shot_curse(저주 화살) | `projectiles/arrow` | palette 보라 4색 | 0~16, 2칸마다 | 반복 0.3초 | `assets/fx/pfx_arrow_curse.png` 2KB |
| fx_shot_fire(임프, 용암 악마) | `fire/fireball` | 기본값 | 0~33, 3칸마다 | 반복 0.6초 | `assets/fx/pfx_fireball.png` 67KB |
| fx_shot_blood(뱀파이어) | `fire/fireball` | palette 핏빛 9색 | 0~33, 3칸마다 | 반복 0.6초 | `assets/fx/pfx_bloodball.png` 66KB |
| fx_shot_ice(서리 마녀) | `ice/ice-lance` | 기본값 | 0~22, 2칸마다 | 반복 0.4초 | `assets/fx/pfx_ice_lance.png` 36KB |
| fx_shot_axe(그놀 도끼) | `projectiles/energy-disc` | palette 강철 7색, teeth 3 | 0~14 | 반복 0.5초 | `assets/fx/pfx_axe.png` 24KB |
| fx_shot_jester(광대 원반) | `projectiles/energy-disc` | palette 분홍보라 7색, teeth 4 | 0~14 | 반복 0.5초 | `assets/fx/pfx_jester_disc.png` 25KB |
| fx_burning(화상, 용사 몸 위) | `fire/spirit-flame` | palette 불 9색 | 0~84, 6칸마다 | 반복 1.5초 | `assets/fx/pfx_burning.png` 90KB |
| fx_fire_ground(용암 장판) | `fire/fire-ring` | reach 60 | 15~36, 3칸마다 | 반복 0.8초 | `assets/fx/pfx_fire_ground.png` 133KB |
| fx_snowflake(빙결, 서리 마녀 폭발) | `ice/snowflake-burst` | 기본값 | 0~57, 3칸마다 | 0.8초 | `assets/fx/pfx_snowflake.png` 178KB |
| fx_stunned(기절, 용사 머리 위) | `status/stunned` | 기본값 | 0~56, 4칸마다 | 반복 1초 | `assets/fx/pfx_stunned.png` 38KB |
| fx_heal(재생, 회복 오라) | `pickups/collect-burst` | palette 초록 8색 | 0~36, 2칸마다 | 0.7초 | `assets/fx/pfx_heal.png` 45KB |
| fx_lifesteal(흡혈) | `pickups/collect-burst` | palette 붉은 8색 | 0~36, 2칸마다 | 0.6초 | `assets/fx/pfx_lifesteal.png` 47KB |
| fx_gold(약탈) | `pickups/collect-burst` | palette 금색 8색 | 0~36, 2칸마다 | 0.8초 | `assets/fx/pfx_gold.png` 48KB |
| fx_heal_aoe(회복 오라 물결) | `holy/heal-aoe` | 기본값 | 6~69, 3칸마다 | 1.2초 | `assets/fx/pfx_heal_aoe.png` 303KB |
| fx_rune_heal(회복 오라 고리) | `arcane/rune-circle` | palette 초록 8색 | 0~112, 8칸마다 | 반복 4초 | `assets/fx/pfx_rune_heal.png` 194KB |
| fx_rune_damage(피해 오라 고리) | `arcane/rune-circle` | palette 붉은 8색 | 0~112, 8칸마다 | 반복 4초 | `assets/fx/pfx_rune_damage.png` 174KB |
| fx_rune_attackSpeed(공격 속도 오라 고리) | `arcane/rune-circle` | palette 노랑 8색 | 0~112, 8칸마다 | 반복 4초 | `assets/fx/pfx_rune_speed.png` 193KB |
| fx_cleave(가르기) | `melee/spin-slash` | palette 주황 7색 | 0~22 | 0.5초 | `assets/fx/pfx_cleave.png` 143KB |
| fx_thorns(가시) | `nature/thorns` | count 3 | 0~57, 3칸마다 | 0.8초 | `assets/fx/pfx_thorns.png` 98KB |

- 합계: 시트 32장, 4.0MB(한도 15MB).
- 반복 시트(`loop: true`)는 `Render.drawLoopSheet`가 `Game.time`으로 프레임을 골라 그린다(화상, 기절, 장판, 오라 고리). 투사체 시트(`shot: true`)는 날아가는 방향으로 돌려 그린다.
- 자주 나오는 효과는 작게 둔다: 재생·흡혈은 몬스터마다 0.5~1.5초에 한 번, 가시는 0.8초에 한 번, 회복 오라 물결은 3초에 한 번만 띄운다. 화상·빙결·기절 표시는 용사 몸 크기다.
- 빙결은 몸에 붙는 상태 그림(`status/frozen`)이 PixelLab 몸 모양 마스크를 그려 우리 용사와 맞지 않아, 맞을 때 `ice/snowflake-burst`와 코드로 그린 서리 빛(발밑 고리, 푸른 빛, 떨어지는 얼음)으로 보인다. 같은 이유로 화상은 `status/burning` 대신 `fire/spirit-flame`에 불 팔레트를 썼다.
- 기준점은 도구가 출력한 값을 쓰되 둘만 손으로 옮겼다: `fx_stunned`는 별이 도는 가운데(pivotY 20, 머리 위에 맞춤), `fx_thorns`는 가시 줄 가운데(pivotX 100, 몬스터 발밑에 맞춤).
- 옛 효과 중 남긴 것은 없다.

## 진행 순서

1. 용사 3종, 오크, 시설 3종은 만들어 연결했다(`boss_captain`은 만들지 않음).
2. 마왕은 Asteria `boss_rift_lord`를 쓰고 있다. 마왕 선택 기능을 하면 그때 `demon_lord`를 몇 종 만들지 정한다.
3. Asteria 캐릭터 그림은 정예몹과 보스에 쓸 수 있으니 지우지 않는다.
