# PixelLab 그림 목록 (품질 시험판)

캐릭터, 마왕, 소품, 장비, 유물, UI 아이콘, 본부 그림은 PixelLab으로 만든다. 맵 지역(섬, 우주 배경, 다리)과 UI 틀(창, 버튼, 칸)은 사용자가 만든 게임 Asteria의 그림을 다시 쓴다(2026-11-07 사용자 결정, 아래 "Asteria 지역과 UI 틀"). 전투 효과는 pixelfx 시트다(아래).

## 공통 규격

- 도구: PixelLab MCP. 만들기 전에 `get_balance`로 잔액을 확인한다.
- 시점: `high top-down`. 맵의 3/4 시점에 가장 가까운 값이며, 첫 캐릭터를 맵에 올려 보고 확정한다.
- 외곽선: `single color black outline`, 자세한 정도: `high detail`
- 표시: 도트 1칸 = 화면 2픽셀. 세계를 `WORLD_ZOOM` 2/3로 그리고(칸 96 → 화면 64px) 캐릭터, 마왕, 소품은 세계 배율 3(`PIXEL_SCALE`)으로 그린다. 그림의 왼쪽 위를 화면 정수 픽셀에 맞춰(`snapWorld`) 도트가 흐려지지 않는다. 타일은 32px을 칸 하나(화면 64px)로 그린다.
- 파일 위치: `assets/sprites/pl_<이름>/` (`rotations/`, `animations/<동작>/<방향>/frame_000.png`). 전사 폴더: 걷기 `walking`, 공격 `slash`, 사망 `falling_backward`
- 동작 방식: 템플릿 모드는 들고 있는 무기와 방패가 사라진다. 걷기와 사망은 `mode=skeleton-v3`(프레임 캔버스 64px), 공격은 `mode=v3`와 `action_description`으로 만든다. 전사 기준 48px 캐릭터 하나에 4방향 28회다(걷기 12, 사망 12, 공격 4). 아래 표의 동작 이름과 예상 비용은 템플릿 기준으로 쓴 것이라 이 방식이면 더 든다
- 분위기: 작고 귀여운 판타지 용사. 지역마다 바닥 색이 달라(용암, 눈, 모래, 물) 어느 바닥에서도 눈에 띄도록 밝은 색과 검은 외곽선을 쓴다.

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
| 부대장 | `pl_boss_captain`으로 만들었다(아래 2026-11 표) | - |
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
- 이전 `fx_` 그림은 모두 아래 시트로 바꿨고 파일도 지웠다.

### 바꾼 효과와 몬스터 능력 효과 (2026-11-06)

이전 효과 그림 10개를 모두 pixelfx로 바꾸고, 새 능력마다 효과를 넣었다. 재현은 `node tools/pfx_sheets.mjs <pixelfx 폴더> [시트 이름...]`이다(pixelfx는 저장소 밖에 clone한다). 이 도구의 `SHEETS` 표에 효과, 옵션(팔레트 색값 포함), 고른 프레임, 기준점 높이(`up`)가 있고, 실행하면 시트를 쓰고 `js/data/fx_sheets.js`에 옮길 줄을 출력한다. 재생 시간은 화면이 효과로 덮이지 않게 원래보다 짧게 `fx_sheets.js`에 적었다.

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

## 정예, 보스, 마왕, 맵, 소품, UI (2026-11)

이전 그림을 모두 지우고 아래 그림으로 바꿨다. 시설 그림 `pl_fac_*`도 쓰지 않아 지웠다. 2026-11-07에 맵 타일(`tileset_path`, `tileset_water`), 쓰지 않는 소품(`prop2_gate`, `cage`, `spikes`, `stairs`, `tree`), 양피지·나무판 UI(`ui_kit.png`, `ui_buttons.png`)를 지우고 Asteria 지역과 UI 틀로 바꿨다(아래).

### 정예와 보스

동작 형식은 용사와 같다(`anim`, 방향 `PL_DIRS` = south, east, north, 서쪽은 동쪽 반전). 프레임은 모두 6장이다. 캔버스가 동작과 방향마다 달라 첫 프레임의 발끝 높이(`footPx`)를 방향별로 `js/data/balance.js`에 적었다. 사망 동작은 전사처럼 south 하나다.

| 표 | 폴더(캐릭터 크기) | 걷기 `walking` 캔버스 / 발끝 | 공격 동작 캔버스 / 발끝 | 사망 `falling_backward` |
|---|---|---|---|---|
| elite_swordsman 정예 검사 | `pl_elite_duelist` (64) | S 96/78, E 96/78, N 80/68 | `slash` S 84/72, E 84/72, N 80/67 | 84/72 |
| elite_tamer 정예 조련사 | `pl_elite_tamer` (64) | S 96/78, E 96/78, N 96/77 | `slash` S 84/72, E 88/74, N 84/71 | 84/72 |
| elite_stormcaller 정예 뇌술사 | `pl_elite_thunder_sage` (64) | S 96/78, E 96/79, N 96/77 | `cast` S 84/72, E 84/72, N 84/71 | 84/72 |
| elite_rhapsodist 정예 음유시인 | `pl_elite_bard` (64) | S 96/78, E 96/78, N 96/77 | `cast` S 84/72, E 84/72, N 84/71 | 84/72 |
| 보스 fallen_knight 부대장 | `pl_boss_captain` (96) | S 144/120, E 144/120, N 144/121 | `slash` S 132/113, E 136/116, N 136/114 | 132/113 (쓰지 않음) |
| 보스 archmage 대마도사 | `pl_boss_grand_wizard` (96) | S 144/119, E 144/119, N 128/110 | `cast` S 132/111, E 132/113, N 128/109 | 132/111 (쓰지 않음) |

- 부대장은 경고(windup) 중에 `slash` 첫 프레임으로 멈춰 서고, 대마도사는 `cast`를 반복한다(`art.windupLoop`).
- 보스 초상은 `rotations/south`의 얼굴을 잘라 쓴다(`BOSSES[].portrait.crop`). UI는 정수 배율로만 키운다(`UI.drawPortrait`).

### 마왕

- `lord_rift.png`(128px), `lord_bone_queen.png`, `lord_gold_king.png`. 화면 2배(256px)로 왕좌 앞에 선다. 주문 때는 세 마왕 모두 어두워진 화면 위로 빛과 함께 다시 그린다(`Render.drawLordCast`). 초상은 머리를 잘라 쓴다(`DEMON_LORDS[].portrait.crop`).

### Asteria 지역과 UI 틀 (2026-11-07)

- 지역 8곳(`moonGarden`, `coast`, `frost`, `skySea`, `sunForge`, `warTemple`, `starChoir`, `ember`)마다 `void_<지역>.webp`(우주 배경, 1672x941 또는 1920x1080), `island_<지역>.webp`(떠 있는 섬, 1254x1254), `bridgedeck_<지역>.webp`(다리, 1536x1024). webp라 `assetPath`가 확장자를 고른다.
- 섬은 화면 네모 `ISLAND_RECT`(지역마다 `ZONES[].island`로 바꿀 수 있다)로 늘려 그린다. 다리는 `ZONES[].deck`(난간 포함 세로 범위, 원본 px)을 잘라 폭 `DECK_W`로 경로를 따라 깐다. 꺾이는 곳은 같은 그림의 가운데 돌바닥 띠(난간 없는 60%)로 잇는다(`Render.deckFloor`).
- UI 틀은 48px 9칸 원본: `ui_window`(남색 창), `ui_button`·`ui_buttonHover`(은청색 버튼), `ui_itemSlot`(은테 칸), `ui_skillSlot`(금테 칸), `ui_closeButton`. 자르는 좌표는 `js/ui/uikit.js`의 `UI_SLICES`. 금색·빨강 버튼은 같은 모양을 코드로 칠한다(`UIKit.bevel`). `asteria_ui_kit.png`는 원본 키트로 남겨 둔다(코드에서 부르지 않는다).

### 소품과 UI 아이콘

- `prop2_<mushrooms|crystal|boulder|brazier|bones|chest|obelisk|banner|pillar|cauldron|throne>.png`(64px, 화면 2배). 지역마다 2~3개(`ZONES[].props`), 발끝은 `PROP_FOOT`. 왕좌 의자는 `prop2_throne`(마왕 뒤). 입구 문은 그림 없이 코드로 그린 소용돌이 문이다(`Render.drawGate`).
- `uiicon_*.png`(48px). 버튼, 탭, 칸, 재화에 쓴다.

## 진행 순서

1. 용사 3종, 오크, 몬스터 23종, 정예 4종, 보스 2종, 마왕 3명, 맵 타일, 소품, 장비, 유물, UI 아이콘을 만들어 연결했다.
2. UI는 Asteria 구성(남색 창, 금선, 은청색 버튼, 금테 칸)으로 바꿨다(`ui_window` 등 48px 틀, `uiicon_*`, 규칙은 `docs/ART_BIBLE.md`).

### Asteria 몬스터 그림 (2026-11-07)

`assets/sprites/ast_mon_<id>/`는 사용자 게임 Asteria 빌드의 몹·보스 그림이다. PixelLab과 같은 폴더 구조이고 `tools/import_asteria_monsters.py`로 다시 만든다. 어떤 몬스터에 어떤 원본을 쓰는지는 그 스크립트의 `ART` 표에 있다.
