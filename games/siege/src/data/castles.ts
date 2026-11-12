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
  moatSlow?: number;        // 해자 속도 배율(기본 0.6)
  tunnel: boolean;          // 지하 레인 있음
  tunnelDig: number;        // 굴을 여는 데 필요한 작업량(초·마리)
  towers: { lane: Lane; x: number; hp: number; dmg: number; range: number; iv: number; antiAir?: boolean }[];   // antiAir: 쇠뇌탑(비행 우선, 성 안까지, 비행 피해 2.5배)
  garrison: { lane: Lane | 'core'; x: number; type: FoeType; count: number }[];
  tip: string;
}

export const CASTLES: Castle[] = [
  {
    id: 'border_fort',
    name: '국경 요새',
    length: 1900, wallX: 1000, mergeX: 1040, coreX: 1780, holdSec: 8, timeLimit: 300, power: 1.3,
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
  {
    id: 'rock_keep',
    name: '바위 요새',
    length: 1800, wallX: 980, mergeX: 1020, coreX: 1680, holdSec: 8, timeLimit: 300, power: 0.95,
    gateHp: 3600, tunnel: false, tunnelDig: 999,
    towers: [
      { lane: 0, x: 1100, hp: 1000, dmg: 30, range: 320, iv: 1.6, antiAir: true },
      { lane: 0, x: 960, hp: 1200, dmg: 38, range: 280, iv: 1.4 },
      { lane: 0, x: 1010, hp: 1200, dmg: 38, range: 280, iv: 1.4 },
      { lane: 1, x: 1000, hp: 1200, dmg: 38, range: 300, iv: 1.4 },
      { lane: 1, x: 1050, hp: 1200, dmg: 38, range: 300, iv: 1.4 },
    ],
    garrison: [
      { lane: 0, x: 1040, type: 'archer', count: 3 },
      { lane: 1, x: 1060, type: 'footman', count: 4 },
      { lane: 'core', x: 1600, type: 'knight', count: 2 },
      { lane: 'core', x: 1640, type: 'captain', count: 1 },
    ],
    tip: '바위 위라 굴을 팔 수 없고 망루가 넷이다. 망루를 무력화하거나 하늘로 넘어라.',
  },
  {
    id: 'lake_castle',
    name: '호수 성',
    length: 1900, wallX: 1000, mergeX: 1040, coreX: 1780, holdSec: 8, timeLimit: 300, power: 1.0,
    gateHp: 3200, moat: [560, 960], moatSlow: 0.3, tunnel: false, tunnelDig: 999,
    towers: [
      { lane: 0, x: 1120, hp: 1000, dmg: 30, range: 320, iv: 1.6, antiAir: true },
      { lane: 0, x: 1000, hp: 1100, dmg: 44, range: 340, iv: 1.4 },
      { lane: 1, x: 1020, hp: 1100, dmg: 44, range: 380, iv: 1.4 },
      { lane: 1, x: 1060, hp: 1100, dmg: 44, range: 380, iv: 1.4 },
    ],
    garrison: [
      { lane: 0, x: 1060, type: 'archer', count: 6 },
      { lane: 1, x: 1080, type: 'footman', count: 3 },
      { lane: 1, x: 1110, type: 'archer', count: 2 },
      { lane: 'core', x: 1700, type: 'knight', count: 2 },
      { lane: 'core', x: 1740, type: 'captain', count: 1 },
    ],
    tip: '넓은 호수가 정문을 감싼다. 물에서 느려지는 동안 망루와 궁수에게 맞는다. 물을 건너는 힘이나 날개가 필요하다.',
  },
  {
    id: 'iron_gate',
    name: '철문 성채',
    length: 1900, wallX: 1000, mergeX: 1040, coreX: 1780, holdSec: 8, timeLimit: 210, power: 1.15,
    gateHp: 18000, tunnel: true, tunnelDig: 20,
    towers: [
      { lane: 0, x: 1120, hp: 1000, dmg: 30, range: 320, iv: 1.6, antiAir: true },
      { lane: 0, x: 1000, hp: 1300, dmg: 36, range: 280, iv: 1.5 },
      { lane: 1, x: 1040, hp: 1300, dmg: 36, range: 300, iv: 1.5 },
    ],
    garrison: [
      { lane: 0, x: 1060, type: 'archer', count: 5 },
      { lane: 1, x: 1080, type: 'knight', count: 2 },
      { lane: 2, x: 1080, type: 'knight', count: 2 },
      { lane: 'core', x: 1700, type: 'knight', count: 2 },
      { lane: 'core', x: 1740, type: 'captain', count: 1 },
    ],
    tip: '성문이 매우 단단하다. 성문을 부술 장사를 데려오거나, 짧은 굴로 파고들어라. 성벽 위 궁수가 많다.',
  },
  {
    id: 'mountain_temple',
    name: '산맥 신전',
    length: 1750, wallX: 960, mergeX: 1000, coreX: 1640, holdSec: 10, timeLimit: 300, power: 1,
    gateHp: 6000, tunnel: true, tunnelDig: 30,
    towers: [
      { lane: 0, x: 960, hp: 1400, dmg: 40, range: 300, iv: 1.4 },
      { lane: 1, x: 1000, hp: 1400, dmg: 40, range: 320, iv: 1.4 },
      { lane: 0, x: 1080, hp: 1100, dmg: 32, range: 320, iv: 1.6, antiAir: true },
    ],
    garrison: [
      { lane: 0, x: 1020, type: 'archer', count: 4 },
      { lane: 1, x: 1040, type: 'knight', count: 3 },
      { lane: 2, x: 1040, type: 'knight', count: 2 },
      { lane: 'core', x: 1560, type: 'knight', count: 4 },
      { lane: 'core', x: 1600, type: 'captain', count: 1 },
    ],
    tip: '기사가 지키는 좁은 신전. 어디로 들어가도 기사와 부딪친다. 버티는 힘과 회복이 필요하다.',
  },
  {
    id: 'capital_wall',
    name: '왕도 외성',
    length: 2000, wallX: 1040, mergeX: 1080, coreX: 1880, holdSec: 12, timeLimit: 330, power: 1,
    gateHp: 20000, moat: [860, 1000], moatSlow: 0.5, tunnel: true, tunnelDig: 45,
    towers: [
      { lane: 0, x: 1040, hp: 1600, dmg: 44, range: 320, iv: 1.4 },
      { lane: 0, x: 1100, hp: 1600, dmg: 44, range: 320, iv: 1.4 },
      { lane: 1, x: 1080, hp: 1600, dmg: 44, range: 340, iv: 1.4 },
      { lane: 0, x: 1160, hp: 1200, dmg: 34, range: 340, iv: 1.6, antiAir: true },
      { lane: 0, x: 1240, hp: 1200, dmg: 34, range: 340, iv: 1.6, antiAir: true },
    ],
    garrison: [
      { lane: 0, x: 1100, type: 'archer', count: 5 },
      { lane: 1, x: 1120, type: 'knight', count: 3 },
      { lane: 1, x: 1160, type: 'footman', count: 4 },
      { lane: 2, x: 1120, type: 'knight', count: 2 },
      { lane: 'core', x: 1780, type: 'knight', count: 4 },
      { lane: 'core', x: 1830, type: 'captain', count: 2 },
    ],
    tip: '1부의 마지막 성벽. 성문, 해자, 망루, 쇠뇌탑, 굴, 수비대 모두 가장 강하다. 지금까지 모은 모든 것을 써라.',
  },
];

export const CASTLE: Record<string, Castle> = Object.fromEntries(CASTLES.map((c) => [c.id, c]));
