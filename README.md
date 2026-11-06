# 던전 수호대 품질 시험판

계획서 1단계 시험판입니다. `index.html`을 더블클릭하면 설치 없이 실행됩니다.

- 범위: 지하 감옥 1개 층, 웨이브 10개, 몬스터 3종(오크 경비병, 스켈레톤 궁수, 암흑 마법사), 용사 3종과 층 보스, 타락, 마왕 스킬 2개, 파티 예고, 3단계 강화
- 조작: 하단 몬스터 탭에서 몬스터(1·2·3)를 고르고 길 옆 칸을 눌러 배치(Shift 이어 놓기, 우클릭·Esc 취소). 근접 몬스터는 가장 가까운 길로 걸어 나가 막습니다. 놓은 칸이나 몬스터를 눌러 강화·판매, 마왕 탭의 Q 번개·W 호통, Tab 탭 전환, Space 다음 웨이브, F 배속, P 일시정지, M 소리
- 규칙 시험: `node tools/simulate.js` (전략별 승률), `node tools/smoke.js` (클릭 흐름)
- 화면 캡처: `npm install` 후 `node tools/capture.js [title|prep|combat|units]` → `captures/`에 PNG 저장, 평균 FPS 출력, 콘솔 오류·빠진 그림이 있으면 종료 코드 1 (Edge 또는 Chrome 필요)
- 그림: 용사와 몬스터는 PixelLab 그림, 정예·부대장·마왕은 Asteria 원본 에셋입니다. 몬스터 표는 `js/data/monsters.js`, 설계는 `docs/MONSTER_DESIGN.md`.
- 소리: Web Audio 합성음입니다. 3단계에서 음원으로 교체합니다.
