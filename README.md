# 던전 수호대 품질 시험판

계획서 1단계 시험판입니다. `index.html`을 더블클릭하면 설치 없이 실행됩니다.

- 범위: 지하 감옥 1개 층, 웨이브 10개, 몬스터 6종(일반 3, 희귀 2, 영웅 1)의 소환과 합치기, 용사 3종과 층 보스, 타락, 마왕 스킬 2개, 파티 예고
- 조작: 하단 몬스터 탭의 소환(S, 40G)으로 무작위 몬스터를 대기 칸(5칸)에 뽑습니다(일반 70%, 희귀 25%, 영웅 5%). 대기 칸의 몬스터를 길 옆 칸으로 끌어 놓습니다(비용 없음). 맵의 몬스터도 끌어 다른 칸으로 옮길 수 있습니다. 몬스터를 다른 몬스터 위에 놓으면 합칩니다: 조합식이면 정해진 몬스터, 같은 등급이면 상위 등급 무작위(영웅끼리는 불가). 숨은 조합식도 있습니다. 몬스터를 누르면 수치, 함께 합칠 수 있는 조합, 판매(일반 20G, 희귀 60G, 영웅 150G)가 나옵니다. 마우스와 터치 모두 됩니다. 마왕 탭의 Q 번개·W 호통, Tab 탭 전환, Space 다음 웨이브, F 배속, P 일시정지, M 소리, Esc·우클릭 취소
- 규칙 시험: `node tools/simulate.js` (전략별 승률. 뽑기 이전처럼 몬스터를 골라 고정 가격에 사는 기준), `node tools/smoke.js` (클릭 흐름)
- 화면 캡처: `npm install` 후 `node tools/capture.js [장면 이름...]` → `captures/`에 PNG 저장, 평균 FPS 출력, 콘솔 오류·빠진 그림이 있으면 종료 코드 1 (Edge 또는 Chrome 필요). 장면: title, prep, summon, drag, dragMerge, mergeSuck, merge, mergeEpic, hidden, popup, popupField, combat, units, elites, archmage, archmageIntro
- 그림: 용사와 몬스터는 PixelLab 그림, 정예·부대장·마왕은 Asteria 원본 에셋입니다. 몬스터 표, 소환 확률, 조합식은 `js/data/monsters.js`, 설계는 `docs/MONSTER_DESIGN.md`.
- 소리: Web Audio 합성음입니다. 3단계에서 음원으로 교체합니다.
