// 몬스터 표. 계획은 docs/siege/02_monsters.md. 수치는 초안(tools/sim.ts로 맞춘다).

export type Grade = 'common' | 'rare' | 'hero' | 'legend' | 'myth';
export type Role = 'assault' | 'shield' | 'ranged' | 'siege' | 'flying' | 'support';
export type Tribe = 'beast' | 'undead' | 'demon' | 'giant' | 'spirit' | 'bug' | 'fiend';

/** 부대장일 때만 켜지는 지휘 효과. 엔진은 이 값들만 읽는다. */
export interface Command {
  desc: string;
  speedMul?: number;        // 부대 이동 속도
  firstHitMul?: number;     // 각 병력의 첫 공격 배율
  gateMul?: number;         // 성문 피해 배율
  wallPass?: boolean;       // 성벽 레인 통과(비행 진입)
  towerMiss?: number;       // 망루가 이 부대를 빗맞힐 확률
  revive?: boolean;         // 쓰러진 병력이 한 번 해골로 부활
  regen?: number;           // 초당 최대 체력 비율 회복
  atkMul?: number;          // 부대 공격력 배율
  atkMulRole?: { role: Role; mul: number };
  rangeMul?: number;        // 사격 병력 사거리 배율
  hpMulRole?: { role: Role; mul: number };
  digMul?: number;          // 굴 파기 속도 배율
  dmgTakenMul?: number;     // 받는 피해 배율
  afterGateAtkMul?: number; // 성문이 부서진 뒤 공격력 배율
}

export interface Monster {
  id: string;
  name: string;
  grade: Grade;
  role: Role;
  tribe: Tribe;
  canDig?: boolean;         // 굴 파기 가능(지하 레인 열기)
  command?: Command;        // 희귀 이상
}

export const GRADES: Record<Grade, { label: string; hp: number; atk: number; cap: number; troops: number; color: string }> = {
  common: { label: '일반', hp: 150, atk: 14, cap: 1, troops: 0, color: '#9aa0b4' },
  rare: { label: '희귀', hp: 320, atk: 26, cap: 2, troops: 4, color: '#4fa3ff' },
  hero: { label: '영웅', hp: 700, atk: 50, cap: 4, troops: 6, color: '#b57bff' },
  legend: { label: '전설', hp: 1500, atk: 95, cap: 8, troops: 8, color: '#ffb547' },
  myth: { label: '신화', hp: 3400, atk: 180, cap: 16, troops: 10, color: '#ff5d7a' },
};

export const ROLES: Record<Role, { label: string; hp: number; atk: number; speed: number; range: number; iv: number }> = {
  assault: { label: '돌격', hp: 0.9, atk: 1.2, speed: 1.4, range: 30, iv: 0.9 },
  shield: { label: '방패', hp: 1.6, atk: 0.6, speed: 0.9, range: 30, iv: 1.1 },
  ranged: { label: '사격', hp: 0.6, atk: 1.1, speed: 1.0, range: 170, iv: 1.2 },
  siege: { label: '공성', hp: 1.2, atk: 1.0, speed: 0.8, range: 34, iv: 1.4 },
  flying: { label: '비행', hp: 0.7, atk: 0.9, speed: 1.3, range: 40, iv: 1.0 },
  support: { label: '지원', hp: 0.8, atk: 0.5, speed: 1.0, range: 140, iv: 1.2 },
};

const M = (id: string, name: string, grade: Grade, role: Role, tribe: Tribe, extra: Partial<Monster> = {}): Monster =>
  ({ id, name, grade, role, tribe, ...extra });

export const MONSTERS: Monster[] = [
  // 일반: 병력 전용
  M('goblin', '고블린', 'common', 'assault', 'fiend'),
  M('skeleton', '해골 병사', 'common', 'shield', 'undead'),
  M('imp', '임프', 'common', 'ranged', 'demon'),
  M('dire_rat', '거대 쥐', 'common', 'assault', 'beast', { canDig: true }),
  M('slime', '슬라임', 'common', 'shield', 'spirit'),
  M('kobold', '코볼트 궁수', 'common', 'ranged', 'beast'),
  M('zombie', '좀비', 'common', 'shield', 'undead'),
  M('bat', '흡혈 박쥐', 'common', 'flying', 'beast'),
  // 희귀
  M('orc_warrior', '오크 전사', 'rare', 'assault', 'fiend', { command: { desc: '돌격 병력 공격력 +15%', atkMulRole: { role: 'assault', mul: 1.15 } } }),
  M('wolf_alpha', '늑대 우두머리', 'rare', 'assault', 'beast', { command: { desc: '이동 속도 +30%, 첫 공격 2배', speedMul: 1.3, firstHitMul: 2 } }),
  M('gargoyle', '가고일', 'rare', 'flying', 'demon', { command: { desc: '성벽을 넘어 진입, 비행 병력 체력 +25%', wallPass: true, hpMulRole: { role: 'flying', mul: 1.25 } } }),
  M('bone_archer', '해골 궁수대장', 'rare', 'ranged', 'undead', { command: { desc: '사격 병력 사거리 +20%', rangeMul: 1.2 } }),
  M('troll', '트롤', 'rare', 'shield', 'giant', { command: { desc: '병력 초당 체력 2% 회복', regen: 0.02 } }),
  M('harpy', '하피', 'rare', 'flying', 'fiend', { command: { desc: '부대가 성벽을 넘어 진입', wallPass: true } }),
  M('mushroom_shaman', '버섯 주술사', 'rare', 'support', 'spirit', { command: { desc: '망루 명중률 -40% (포자 안개)', towerMiss: 0.4 } }),
  M('giant_spider', '거대 거미', 'rare', 'assault', 'bug', { command: { desc: '받는 피해 -15% (거미줄 엄폐)', dmgTakenMul: 0.85 } }),
  M('hellhound', '지옥견', 'rare', 'assault', 'demon', { command: { desc: '부대 공격력 +20%', atkMul: 1.2 } }),
  M('sapper', '굴착 고블린', 'rare', 'siege', 'fiend', { canDig: true, command: { desc: '굴 파기 속도 3배', digMul: 3 } }),
  // 영웅
  M('ogre_chief', '오우거 족장', 'hero', 'siege', 'giant', { command: { desc: '성문 피해 2.5배', gateMul: 2.5 } }),
  M('lich', '리치', 'hero', 'support', 'undead', { command: { desc: '쓰러진 병력이 한 번 해골로 부활', revive: true } }),
  M('succubus', '서큐버스', 'hero', 'support', 'fiend', { command: { desc: '부대 공격력 +25%, 받는 피해 -10%', atkMul: 1.25, dmgTakenMul: 0.9 } }),
  M('bat_queen', '박쥐 여왕', 'hero', 'flying', 'fiend', { command: { desc: '성벽 진입, 망루 명중률 -25%', wallPass: true, towerMiss: 0.25 } }),
  M('minotaur', '미노타우로스', 'hero', 'assault', 'giant', { command: { desc: '성문 피해 1.5배, 성문 돌파 뒤 공격력 +40%', gateMul: 1.5, afterGateAtkMul: 1.4 } }),
  M('dark_knight', '타락 기사', 'hero', 'shield', 'fiend', { command: { desc: '받는 피해 -25%', dmgTakenMul: 0.75 } }),
  M('witch', '늪의 마녀', 'hero', 'ranged', 'fiend', { command: { desc: '사격 병력 공격력 +30%', atkMulRole: { role: 'ranged', mul: 1.3 } } }),
  // 전설
  M('vampire_lord', '흡혈 군주', 'legend', 'assault', 'fiend', { command: { desc: '부대 공격력 +30%, 초당 체력 3% 회복', atkMul: 1.3, regen: 0.03 } }),
  M('bone_dragon', '해골 용', 'legend', 'flying', 'undead', { command: { desc: '성벽 진입, 부활', wallPass: true, revive: true } }),
  M('demon_general', '마장군', 'legend', 'siege', 'demon', { command: { desc: '성문 피해 2배, 공격력 +20%', gateMul: 2, atkMul: 1.2 } }),
  M('siren_queen', '해마녀', 'legend', 'support', 'fiend', { command: { desc: '해자 무시, 받는 피해 -20%', dmgTakenMul: 0.8 } }),
  // 신화
  M('abyss_dragon', '심연의 용', 'myth', 'flying', 'demon', { command: { desc: '성벽 진입, 망루 무력화, 공격력 +30%', wallPass: true, towerMiss: 1, atkMul: 1.3 } }),
];

export const MON: Record<string, Monster> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

/** 해자 무시(해마녀) 같은 특수 처리는 id로 확인한다. */
export const SWIMMERS = new Set(['siren_queen', 'slime']);
