# 이어서 작업하기

- 계획서: https://claude.ai/artifact/FwzVME8xY65Ht3bVfHACMM
- 다음 작업: 맵, 배경, 전투 효과, UI는 Asteria 것을 유지하고 용사, 보스, 오크, 마왕, 시설 그림을 PixelLab으로 교체한다.
- 그림 목록과 규격: `docs/PIXELLAB_ASSETS.md`. 전사 하나만 먼저 만들어 맵에서 크기와 시점을 확인한 뒤 나머지를 만든다.
- 작업 방식: 작업관제소의 주니어들을 이용한다.

## 현재 상태

- 품질 시험판이 동작한다. `index.html`을 바로 열면 실행된다.
- 자동 시험: `node tools/simulate.js`, `node tools/smoke.js`
- 사람이 끝까지 플레이한 검증과 소리 확인은 아직 없다. 난이도도 자동 조작 기준이다.
- 표시 배율은 `js/core/config.js`의 `HERO_SCALE`(1.25), `BOSS_SCALE`(1.5)이다. PixelLab 그림은 정수 2배로 표시할 계획이므로 교체할 때 함께 바꾼다.
- 그림 경로와 프레임 이름은 `js/core/assets.js`, `js/game/render.js`의 `heroSpriteName`에 있다. 지금 이름은 Asteria 파일명 기준이다.
- 궁수탑 그림 `facility_archer.png`는 Asteria 벽과 유령의 임시 합성이다.

## 주니어로 옮길 때 확인할 것

1. GitHub 저장소로 옮긴 뒤 `작업관제소/config.json`의 `repos`에 이 저장소를 추가한다.
2. 주니어는 PixelLab을 그대로 쓸 수 없다. `junior.py`가 `setting_sources=["project"]`로 사용자 범위 MCP를 읽지 않고, `allowed_tools`에도 PixelLab 도구가 없다. 주니어에게 그림 생성을 맡기려면 이 설정을 고쳐야 하고, 아니면 메인 세션이 그림을 만들고 주니어는 코드 연결을 맡는다.
3. 주니어를 켜려면 `작업관제소/start.bat`을 실행한다. 작업 시점에는 꺼져 있었다.
4. 주니어 비용은 API 크레딧에서, 그림 생성 비용은 PixelLab 계정에서 나간다.
5. PixelLab 토큰은 저장소에 넣지 않는다.

## 공개 전 확인

`assets/sprites`에는 Asteria 그림이 많이 들어 있다. 저장소를 공개로 만들지 비공개로 만들지 먼저 정한다.
