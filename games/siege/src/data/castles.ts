// 성채 표. 계획은 docs/siege/03_siege.md (횡스크롤 + 3레인).
// 좌표: x는 왼쪽(아군 진영)에서 오른쪽(성 안)으로. 레인 0=위(성벽), 1=가운데(정문), 2=아래(지하).

export type Lane = 0 | 1 | 2;
export const LANE_NAMES = ['성벽', '정문', '지하'] as const;

export type FoeType = 'footman' | 'archer' | 'knight' | 'captain';
export const FOES: Record<FoeType, { name: string; hp: number; atk: number; range: number; iv: number; speed: number }> = {
  footman: { name: '보병', hp: 160, atk: 12, range: 30, iv: 1.0, speed: 40 },
  archer: { name: '궁수', hp: 100, atk: 8, range: 180, iv: 1.3, speed: 36 },
  knight: { name: '기사', hp: 420, atk: 22, range: 32, iv: 1.2, speed: 34 },
  captain: { name: '수비대장', hp: 1300, atk: 34, range: 36, iv: 1.3, speed: 30 },
};

export interface Castle {
  id: string;
  name: string;
  length: number;           // 맵 길이
  wallX: number;            // 성벽·성문·굴 입구가 있는 x
  mergeX: number;           // 이 x를 넘으면 레인이 하나로 합쳐짐(성 안)
  coreX: number;            // 핵심 지점
  holdSec: number;          // 핵심 지점 점거에 필요한 시간
  timeLimit: number;
  power: number;            // 수비 전체 배율(적 체력·공격력, 성문, 망루)
  gateHp: number;
  moat?: [number, number];  // 정문 레인 해자 구간(느려짐)
  tunnel: boolean;          // 지하 레인 있음
  tunnelDig: number;        // 굴을 여는 데 필요한 작업량(초·마리)
  towers: { lane: Lane; x: number; hp: number; dmg: number; range: number; iv: number }[];
  garrison: { lane: Lane | 'core'; x: number; type: FoeType; count: number }[];
  tip: string;
}

export const CASTLES: Castle[] = [
  {
    id: 'border_fort',
    name: '국경 요새',
    length: 1900, wallX: 1000, mergeX: 1040, coreX: 1780, holdSec: 8, timeLimit: 300, power: 1,
    gateHp: 4500, moat: [820, 960], tunnel: true, tunnelDig: 36,
    towers: [
      { lane: 0, x: 1000, hp: 1300, dmg: 42, range: 260, iv: 1.5 },
      { lane: 1, x: 1040, hp: 1300, dmg: 42, range: 280, iv: 1.5 },
    ],
    garrison: [
      { lane: 0, x: 1060, type: 'archer', count: 3 },
      { lane: 1, x: 1080, type: 'footman', count: 4 },
      { lane: 1, x: 1120, type: 'knight', count: 1 },
      { lane: 2, x: 1080, type: 'footman', count: 4 },
      { lane: 2, x: 1110, type: 'knight', count: 1 },
      { lane: 'core', x: 1700, type: 'knight', count: 2 },
      { lane: 'core', x: 1740, type: 'captain', count: 1 },
    ],
    tip: '정문은 단단하고 해자가 있다. 성문을 부술 힘을 모으거나, 성벽을 넘거나, 굴을 파서 들어가라.',
  },
];

export const CASTLE: Record<string, Castle> = Object.fromEntries(CASTLES.map((c) => [c.id, c]));
