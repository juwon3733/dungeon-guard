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

자주 나오는 효과 넷은 PixelLab이 아니라 pixelfx(https://github.com/patch-gg/pixelfx, MIT, 커밋 `a841596`)로 만든 시트를 쓴다. 표기는 `NOTICE.md`.

| 옛 이름 | pixelfx id | 옵션 | 쓴 프레임 (30fps) | 재생 | 시트 |
|---|---|---|---|---|---|
| fx_hit_physical | `impacts/hit-spark` | 기본값 | 0~14 | 0.5초 | `assets/fx/pfx_hit_spark.png` 122×71 ×15, 25KB |
| fx_hit_crit | `impacts/crit-hit` | 기본값 | 0~17 | 0.6초 | `assets/fx/pfx_crit_hit.png` 174×131 ×18, 160KB |
| fx_explosion | `spawn/poof` | 기본값 | 0~34, 2칸마다 | 0.6초 | `assets/fx/pfx_poof.png` 91×76 ×18, 57KB |
| fx_blastViolet | `arcane/mana-burst` | `{"palette":["#160a28","#2e1456","#4a2088","#6a32b8","#8f52e0","#c28bff","#e6ccff","#ffffff"]}` | 6~36, 2칸마다 | 0.53초 | `assets/fx/pfx_mana_burst.png` 170×146 ×16, 266KB |

- 만드는 법: pixelfx를 저장소 밖에 clone하고 `tools/lib/fxlib.mjs`의 `renderFrames(fx, { bg: "none", actor: false, options })`로 렌더링한 뒤, 위 프레임만 골라 모든 프레임을 덮는 상자로 잘라 한 줄 8칸 시트로 붙인다. 결과 크기와 기준점은 `js/data/fx_sheets.js`에 적는다.
- 기준점: 효과의 origin(바닥)에서 위로 hit-spark 20, crit-hit 26, poof 25, mana-burst 28px 올린 점을 `Fx.anim` 좌표에 맞춘다. 타격 섬광과 폭발 중심이 맞는 자리다.
- 그리기: `Render.drawSheetEffects`가 보통 합성으로 그린다(빛이 시트에 이미 들어 있다). 화면 배율은 `round(size × WORLD_ZOOM / fit)`(최소 1)이라 대부분 1배, 수정 폭발 강화(반경 2칸)는 2배다.
- 옛 Asteria `fx_` 그림은 아직 불러온다. 정리는 따로 한다.

## 진행 순서

1. 용사 3종, 오크, 시설 3종은 만들어 연결했다(`boss_captain`은 만들지 않음).
2. 마왕은 Asteria `boss_rift_lord`를 쓰고 있다. 마왕 선택 기능을 하면 그때 `demon_lord`를 몇 종 만들지 정한다.
3. Asteria 캐릭터 그림은 정예몹과 보스에 쓸 수 있으니 지우지 않는다.
