# PixelLab 그림 목록 (품질 시험판)

맵과 배경, 전투 효과, UI는 Asteria 것을 유지하고, 아래 캐릭터와 시설만 새로 만든다.

## 공통 규격

- 도구: PixelLab MCP. 만들기 전에 `get_balance`로 잔액을 확인한다.
- 시점: `high top-down`. 맵의 3/4 시점에 가장 가까운 값이며, 첫 캐릭터를 맵에 올려 보고 확정한다.
- 외곽선: `single color black outline`, 자세한 정도: `high detail`
- 표시: 정수 2배로 그려 도트 격자를 유지한다.
- 파일 위치: `assets/sprites/pl_<이름>/` (`rotations/`, `animations/<동작>/<방향>/frame_000.png`)
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

공식 문서 기준 추정치이며, 실제 비용은 만들기 전에 잔액과 함께 확인한다.

| 항목 | 계산 | 생성 횟수 |
|---|---|---|
| 캐릭터 만들기 | 6개, 개당 1~2 | 6~12 |
| 48px 동작 | 4개 × 동작 3 × 4방향 × 1 | 48 |
| 96px 부대장 동작 | 동작 3 × 4방향 × 1 | 12 |
| 96px 마왕 동작 | 동작 3 × 1방향 × 1 | 3 |
| 시설 | 3개 | 문서에서 비용을 확인하지 못함 |

## 진행 순서

1. `hero_warrior` 하나만 만들어 맵에 올려 크기와 시점을 확인한다.
2. 괜찮으면 나머지를 만든다.
3. 게임의 그림 경로를 바꾸고 Asteria 캐릭터 그림을 지운다.
4. 화면을 캡처해 검수하고 자동 시험을 돌린다.
