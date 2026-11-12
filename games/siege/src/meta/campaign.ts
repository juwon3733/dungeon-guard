// 판 바깥 진행: 지도(지역), 군단(보유 몬스터), 던전 시설, 소환·굴복·타락, 저장. 시간 개념 없음.
// 계획: docs/siege/04_dungeon.md, 02_monsters.md
import { MON, GRADES, type Grade } from '../data/monsters';
import { CASTLE, type Castle } from '../data/castles';
import { PEOPLE, COMMANDERS, CORRUPT_NAMED_COST, affinityBoost, giftCost } from '../data/characters';

// ---------------- 지역(지도) ----------------
export interface Region {
  id: string; name: string; castle: string; basePower: number;
  gold: number; mana: number;           // 점령 보상(다시 공략하면 절반)
  wild: string[];                       // 굴복으로 얻는 그 지역 몬스터
  desc: string;
}
export const REGIONS: Region[] = [
  { id: 'r1', name: '개척 마을', castle: 'border_fort', basePower: 0.38, gold: 180, mana: 60, wild: ['goblin', 'dire_rat', 'kobold'], desc: '국경 끝의 작은 마을. 첫 공성으로 알맞다.' },
  { id: 'r2', name: '언덕 초소', castle: 'rock_keep', basePower: 0.42, gold: 220, mana: 70, wild: ['kobold', 'bat', 'wolf_alpha'], desc: '바위 언덕 위 초소. 굴을 팔 수 없다.' },
  { id: 'r3', name: '강가 방앗간', castle: 'lake_castle', basePower: 0.19, gold: 260, mana: 80, wild: ['slime', 'giant_spider', 'mushroom_shaman'], desc: '강물을 끌어들인 해자가 있다.' },
  { id: 'r4', name: '국경 요새', castle: 'border_fort', basePower: 1.2, gold: 340, mana: 100, wild: ['gargoyle', 'troll', 'sapper'], desc: '왕국 국경을 지키는 요새. 세 길이 모두 열려 있다.' },
  { id: 'r5', name: '철문 성채', castle: 'iron_gate', basePower: 1.3, gold: 420, mana: 120, wild: ['hellhound', 'troll', 'ogre_chief'], desc: '성문이 매우 단단하다. 장사가 필요하다.' },
  { id: 'r6', name: '호수 성', castle: 'lake_castle', basePower: 1.1, gold: 480, mana: 140, wild: ['harpy', 'giant_spider', 'minotaur'], desc: '넓은 호수에 둘러싸인 성.' },
  { id: 'r7', name: '바위 요새', castle: 'rock_keep', basePower: 1.3, gold: 560, mana: 160, wild: ['gargoyle', 'bone_archer', 'bat_queen'], desc: '1장의 마지막 요새.' },
  // 2장
  { id: 'r8', name: '산길 관문', castle: 'iron_gate', basePower: 2.0, gold: 620, mana: 180, wild: ['troll', 'hellhound', 'minotaur'], desc: '2장. 산맥으로 들어가는 관문.' },
  { id: 'r9', name: '산맥 신전', castle: 'mountain_temple', basePower: 2.2, gold: 700, mana: 200, wild: ['gargoyle', 'mushroom_shaman', 'lich'], desc: '성녀가 지키는 신전. 기사가 많다.' },
  { id: 'r10', name: '용사의 마을', castle: 'border_fort', basePower: 2.4, gold: 780, mana: 220, wild: ['orc_warrior', 'wolf_alpha', 'witch'], desc: '용사가 태어난 마을. 용사가 직접 지킨다.' },
  { id: 'r11', name: '왕도 외성', castle: 'capital_wall', basePower: 1.15, gold: 1200, mana: 360, wild: ['dark_knight', 'bat_queen', 'siren_queen'], desc: '장 보스. 여왕이 지키는 왕도의 바깥 성벽.' },
  // 3장
  { id: 'r12', name: '성기사 수련장', castle: 'mountain_temple', basePower: 2.9, gold: 1300, mana: 400, wild: ['dark_knight', 'troll', 'lich'], desc: '3장. 왕국 기사들이 마지막으로 모인 수련장.' },
  { id: 'r13', name: '하늘 성채', castle: 'sky_bastion', basePower: 2.6, gold: 1500, mana: 460, wild: ['gargoyle', 'bat_queen', 'harpy'], desc: '결계 기둥과 쇠뇌탑이 하늘을 막는 성채.' },
  { id: 'r14', name: '왕성 내성', castle: 'royal_keep', basePower: 1.05, gold: 2500, mana: 800, wild: ['vampire_lord', 'bone_dragon', 'siren_queen'], desc: '최종 보스. 왕녀가 지키는 왕성의 심장.' },
];
export const REGION: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// ---------------- 던전 시설 ----------------
export type FacId = 'nest' | 'warroom' | 'circle' | 'mine' | 'prison' | 'forge';
export const FACILITIES: Record<FacId, { name: string; desc: string; costs: number[]; values: number[]; unit: string }> = {
  nest: { name: '둥지', desc: '군단 수용량(일반 1, 희귀 2, 영웅 4, 전설 8, 신화 16)', costs: [0, 300, 700, 1400], values: [50, 70, 100, 140], unit: '' },
  warroom: { name: '작전실', desc: '한 번에 출전하는 부대 수', costs: [0, 400, 1000], values: [2, 3, 4], unit: '부대' },
  circle: { name: '소환진', desc: '소환에서 높은 등급이 나올 확률', costs: [0, 400, 900, 1600], values: [1, 2, 3, 4], unit: '단계' },
  mine: { name: '광산', desc: '공성으로 얻는 마석 증가', costs: [0, 250, 600], values: [0, 25, 50], unit: '%' },
  prison: { name: '감옥', desc: '가둘 수 있는 포로 수', costs: [0, 300, 700], values: [3, 5, 8], unit: '명' },
  forge: { name: '대장간', desc: '공성 장비를 만든다(1단계 사다리, 2단계 충차, 3단계 큰 방패). 장비는 출격할 때마다 금화로 산다', costs: [0, 250, 500, 800], values: [0, 1, 2, 3], unit: '종' },
};

// 소환진 단계별 등급 확률(%)
const SUMMON_ODDS: Record<number, Record<Grade, number>> = {
  1: { common: 62, rare: 33, hero: 5, legend: 0, myth: 0 },
  2: { common: 50, rare: 38, hero: 10, legend: 2, myth: 0 },
  3: { common: 40, rare: 40, hero: 15, legend: 4.5, myth: 0.5 },
  4: { common: 30, rare: 40, hero: 22, legend: 7, myth: 1 },
};
export const SUMMON_COST = 50;
export const CORRUPT_COST = 60;   // (옛 저장 호환용) 이름 없는 수비대장 외 기본값
/** 포로 종류별 타락 결과와 비용. 수비대장(이름 없음)은 마족 여럿 중 하나 */
export type PrisonerType = 'footman' | 'archer' | 'knight' | 'captain';
export const PRISONERS: Record<PrisonerType, { name: string; to: string | null; cost: number; chance: number }> = {
  footman: { name: '보병', to: 'fallen_footman', cost: 20, chance: 0.15 },
  archer: { name: '궁수', to: 'shadow_archer', cost: 40, chance: 0.15 },
  knight: { name: '기사', to: 'dark_knight', cost: 100, chance: 0.35 },
  captain: { name: '수비대장', to: null, cost: 150, chance: 0.65 },
};
const PRISON_ORDER: PrisonerType[] = ['captain', 'knight', 'archer', 'footman'];
// 타락: 포로 → 마족(사람 모습). 확률(%)
const CORRUPT_POOL: [string, number][] = [['succubus', 30], ['witch', 30], ['dark_knight', 25], ['vampire_lord', 15]];   // 이름 없는 수비대장 타락

// ---------------- 상태 ----------------
export interface Meta {
  v: 1;
  gold: number; mana: number; fame: number;
  owned: Record<string, number>;           // 몬스터 id → 수
  fac: Record<FacId, number>;               // 시설 단계(0부터)
  conquered: Record<string, number>;        // 지역 id → 최고 별
  captives: number;                         // (옛 저장) 쓰지 않음, 불러올 때 보병 포로로 옮김
  prisoners: Record<PrisonerType, number>;  // 종류별 포로
  lv: Record<string, number>;               // 몬스터 종 레벨(1~20)
  aw: Record<string, number>;               // 각성(0~5, 영웅 이상)
  affinity: Record<string, number>;         // 사람 모습 캐릭터 호감도(0~10)
  aide: string | null;                      // 측근
  named: string[];                          // 사로잡은 적장(타락 전)
  contracted: string[];                     // 계약을 마친 몬스터
}
const KEY = 'siege.meta.v1';

export function fresh(): Meta {
  return {
    v: 1, gold: 300, mana: 120, fame: 0,
    owned: { orc_warrior: 1, harpy: 1, bone_archer: 1, wolf_alpha: 1, goblin: 12, skeleton: 6, imp: 6, bat: 4, dire_rat: 4 },
    fac: { nest: 0, warroom: 0, circle: 0, mine: 0, prison: 0, forge: 0 },
    conquered: {}, captives: 0, prisoners: { footman: 0, archer: 0, knight: 0, captain: 0 }, lv: {}, aw: {}, affinity: {}, aide: null, named: [], contracted: [],
  };
}
export function load(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const m = JSON.parse(raw);
      if (m && m.v === 1) {
        const out: Meta = { ...fresh(), ...m };
        out.fac = { ...fresh().fac, ...(m.fac ?? {}) };
        out.prisoners = { ...fresh().prisoners, ...(m.prisoners ?? {}) };
        if (m.captives > 0) { out.prisoners.footman += m.captives; out.captives = 0; }   // 옛 저장: 숫자 포로 → 보병 포로
        return out;
      }
    }
  } catch { /* 못 읽으면 처음 상태 */ }
  return fresh();
}
export function save(m: Meta) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 무시 */ } }

export const facValue = (m: Meta, f: FacId) => FACILITIES[f].values[m.fac[f]];
export const capUsed = (m: Meta) => Object.entries(m.owned).reduce((a, [id, n]) => a + GRADES[MON[id].grade].cap * n, 0);
export const capMax = (m: Meta) => facValue(m, 'nest');
export const squadSlots = (m: Meta) => facValue(m, 'warroom');
export const threat = (m: Meta) => Object.keys(m.conquered).length;

/** 지역이 열렸는지: 앞 지역을 점령해야 열린다 */
export function unlocked(m: Meta, r: Region) {
  const i = REGIONS.indexOf(r);
  return i === 0 || REGIONS[i - 1].id in m.conquered;
}
export const THREAT_STEP = 0.08;   // 점령 하나마다 남은 성채 수비 강도 증가
/** 공성할 성채(위협도만큼 강해짐, 이미 점령한 곳은 그대로) */
export function regionCastle(m: Meta, r: Region): Castle {
  const t = r.id in m.conquered ? 0 : threat(m);
  return { ...CASTLE[r.castle], name: r.name, power: +(r.basePower + THREAT_STEP * t).toFixed(2) };
}

export function upgrade(m: Meta, f: FacId): string | null {
  const lv = m.fac[f], costs = FACILITIES[f].costs;
  if (lv + 1 >= costs.length) return '최고 단계입니다.';
  if (m.gold < costs[lv + 1]) return '금화가 모자랍니다.';
  m.gold -= costs[lv + 1]; m.fac[f] = lv + 1;
  return null;
}

function pickGrade(odds: Record<Grade, number>, rng: () => number): Grade {
  let r = rng() * 100;
  for (const g of ['myth', 'legend', 'hero', 'rare', 'common'] as Grade[]) { if (r < odds[g]) return g; r -= odds[g]; }
  return 'common';
}
// 타락 기사는 기사 포로로도, 소환으로도 얻는다(철문 성채 같은 곳의 방패 역할)
const NOT_SUMMONABLE = new Set(['fallen_footman', 'shadow_archer', ...CORRUPT_POOL.map(([id]) => id).filter((id) => id !== 'dark_knight')]);
const SUMMONABLE = (g: Grade) => Object.values(MON).filter((x) => x.grade === g && !x.id.startsWith('cmd_') && !NOT_SUMMONABLE.has(x.id));

/** 소환: 일반은 3마리, 그 외 1마리 */
export function summon(m: Meta, rng = Math.random): { id: string; n: number } | string {
  if (m.mana < SUMMON_COST) return '마석이 모자랍니다.';
  const g = pickGrade(SUMMON_ODDS[facValue(m, 'circle')], rng);
  const pool = SUMMONABLE(g);
  const id = pool[Math.floor(rng() * pool.length)].id;
  const n = g === 'common' ? 3 : 1;
  if (capUsed(m) + GRADES[g].cap * n > capMax(m)) return '둥지가 가득 찼습니다. 둥지를 넓히세요.';
  m.mana -= SUMMON_COST; m.owned[id] = (m.owned[id] ?? 0) + n;
  return { id, n };
}

export const prisonerCount = (m: Meta) => Object.values(m.prisoners).reduce((a, b) => a + b, 0);

/** 타락 의식: 그 종류의 포로 1명 + 마석 → 정해진 몬스터(수비대장은 마족 여럿 중 하나) */
export function corrupt(m: Meta, type: PrisonerType = 'footman', rng = Math.random): string | { id: string } {
  const P = PRISONERS[type];
  if ((m.prisoners[type] ?? 0) <= 0) return `${P.name} 포로가 없습니다.`;
  if (m.mana < P.cost) return '마석이 모자랍니다.';
  let id = P.to;
  if (!id) { let r = rng() * 100; id = CORRUPT_POOL[0][0]; for (const [k, p] of CORRUPT_POOL) { if (r < p) { id = k; break; } r -= p; } }
  if (capUsed(m) + GRADES[MON[id].grade].cap > capMax(m)) return '둥지가 가득 찼습니다.';
  m.mana -= P.cost; m.prisoners[type]--; m.owned[id] = (m.owned[id] ?? 0) + 1;
  return { id };
}

/** 마석 교환: 남는 금화를 마석으로(일부러 손해 보는 비율, 금화 3 → 마석 1) */
export const EXCHANGE = { gold: 150, mana: 50 };
export function buyMana(m: Meta): string | null {
  if (m.gold < EXCHANGE.gold) return '금화가 모자랍니다.';
  m.gold -= EXCHANGE.gold; m.mana += EXCHANGE.mana; return null;
}

/** 내보내기: 둥지 자리를 비운다(일반은 3마리씩, 그 외 1마리). 측근은 내보낼 수 없다 */
export function release(m: Meta, id: string): string | null {
  const have = m.owned[id] ?? 0;
  if (have <= 0) return '없는 몬스터입니다.';
  if (m.aide === id && have <= 1) return '측근은 내보낼 수 없습니다.';
  const n = MON[id].grade === 'common' ? Math.min(3, have) : 1;
  m.owned[id] = have - n;
  return null;
}

/** 편성 검사: 가진 수를 넘게 쓰지 않았는지 */
export function checkPlans(m: Meta, plans: { leader: string; troops: { id: string; count: number }[] }[]): string | null {
  const use: Record<string, number> = {};
  for (const p of plans) {
    use[p.leader] = (use[p.leader] ?? 0) + 1;
    for (const t of p.troops) if (t.count > 0) use[t.id] = (use[t.id] ?? 0) + t.count;
  }
  for (const [id, n] of Object.entries(use)) if (n > (m.owned[id] ?? 0)) return `${MON[id].name}: ${n}마리 필요, ${m.owned[id] ?? 0}마리 보유`;
  return null;
}

// ---------------- 성장: 레벨·각성 ----------------
export const MAX_LV = 20, MAX_AW = 5;
export const lvOf = (m: Meta, id: string) => m.lv[id] ?? 1;
export const awOf = (m: Meta, id: string) => m.aw[id] ?? 0;
/** 훈련 비용(마석). 금화는 시설·선물, 마석은 몬스터 얻기·키우기 */
export const trainCost = (m: Meta, id: string) => 20 * lvOf(m, id) * GRADES[MON[id].grade].cap;
/** 엔진에 넘기는 능력 배율: 레벨 1당 +5%, 각성 1당 +8% */
export const boostOf = (m: Meta, id: string) => (1 + 0.05 * (lvOf(m, id) - 1)) * (1 + 0.08 * awOf(m, id));
export const squadBoostOf = (m: Meta, leaderId: string) => (PEOPLE[leaderId] ? affinityBoost(m.affinity[leaderId] ?? 0) : 1);

export function train(m: Meta, id: string): string | null {
  if (lvOf(m, id) >= MAX_LV) return '최고 레벨입니다.';
  const c = trainCost(m, id);
  if (m.mana < c) return '마석이 모자랍니다.';
  m.mana -= c; m.lv[id] = lvOf(m, id) + 1; return null;
}
export function awaken(m: Meta, id: string): string | null {
  const g = MON[id].grade;
  if (g === 'common' || g === 'rare') return '영웅 이상만 각성할 수 있습니다.';
  if ((m.owned[id] ?? 0) < 2) return '같은 몬스터가 하나 더 있어야 합니다.';
  if (awOf(m, id) >= MAX_AW) return '최고 각성입니다.';
  m.owned[id] -= 1; m.aw[id] = awOf(m, id) + 1; return null;
}

// ---------------- 숙소·측근·적장 ----------------
export const people = (m: Meta) => Object.keys(PEOPLE).filter((id) => (m.owned[id] ?? 0) > 0);
export function gift(m: Meta, id: string): string | null {
  const a = m.affinity[id] ?? 0;
  if (a >= 10) return '호감도가 가득 찼습니다.';
  if (m.gold < giftCost(a)) return '금화가 모자랍니다.';
  m.gold -= giftCost(a); m.affinity[id] = a + 1; return null;
}
export function setAide(m: Meta, id: string): string | null {
  if (!PEOPLE[id] || !(m.owned[id] > 0)) return '측근으로 둘 수 없습니다.';
  if ((m.affinity[id] ?? 0) < 3) return '호감도 3 이상이어야 측근이 됩니다.';
  m.aide = id; return null;
}
const aideBonus = (m: Meta, kind: string) => (m.aide && PEOPLE[m.aide]?.aide.kind === kind ? PEOPLE[m.aide].aide.v : 0);

/** 지역 수비대장 이름: 아직 사로잡지 않은 적장이면 그 이름으로 나온다 */
export function regionCaptain(m: Meta, r: Region): string | undefined {
  const id = COMMANDERS[r.id];
  if (!id || m.named.includes(id) || (m.owned[id] ?? 0) > 0) return undefined;
  return PEOPLE[id].human;
}
/** 적장 타락 비용: 등급에 따라 */
export const namedCost = (id: string) => CORRUPT_NAMED_COST[MON[id].grade as 'hero' | 'legend' | 'myth'] ?? 150;
export function corruptNamed(m: Meta, id: string): string | null {
  if (!m.named.includes(id)) return '사로잡은 적장이 아닙니다.';
  if (m.mana < namedCost(id)) return '마석이 모자랍니다.';
  if (capUsed(m) + GRADES[MON[id].grade].cap > capMax(m)) return '둥지가 가득 찼습니다.';
  m.mana -= namedCost(id); m.named = m.named.filter((x) => x !== id);
  m.owned[id] = (m.owned[id] ?? 0) + 1; m.affinity[id] = m.affinity[id] ?? 0;
  return null;
}

/** 공성 결과 반영. 보상 글을 돌려준다. leaders: 출전한 부대장, mvp: 가장 활약한 부대장 */
export function applyResult(m: Meta, r: Region, win: boolean, stars: number, leaders: string[] = [], mvp: string | null = null, rng = Math.random,
  defeated: Partial<Record<PrisonerType, number>> = {}): string[] {
  const out: string[] = [];
  if (!win) { out.push('잃은 것은 없습니다. 편성을 바꿔 다시 도전하세요.'); return out; }
  const first = !(r.id in m.conquered);
  const k = first ? 1 : 0.5;
  const gold = Math.round(r.gold * k * (1 + 0.15 * (stars - 1)) * (1 + aideBonus(m, 'gold') / 100));
  const mana = Math.round(r.mana * k * (1 + (facValue(m, 'mine') + aideBonus(m, 'mana')) / 100));
  m.gold += gold; m.mana += mana; m.fame += first ? 10 * stars : stars;
  out.push(`금화 +${gold}, 마석 +${mana}${first ? ' (첫 점령)' : ' (다시 공략: 절반)'}`);
  // 적장 포획: ★2 이상이면 확정, ★1이면 50%
  const cmd = COMMANDERS[r.id];
  if (cmd && regionCaptain(m, r) && (stars >= 2 || rng() < 0.5)) {
    m.named.push(cmd); out.push(`적장 「${PEOPLE[cmd].human}」을(를) 사로잡았습니다! 감옥에서 타락 의식을 할 수 있습니다.`);
  }
  m.conquered[r.id] = Math.max(m.conquered[r.id] ?? 0, stars);
  // 굴복: 그 지역 몬스터 하나(일반은 3마리)
  const id = r.wild[Math.floor(rng() * r.wild.length)];
  const g = MON[id].grade;
  const chance = (g === 'common' ? 1 : g === 'rare' ? 0.6 : 0.25) * (1 + aideBonus(m, 'subdue') / 100);
  if (rng() < chance) {
    const n = g === 'common' ? 3 : 1;
    if (capUsed(m) + GRADES[g].cap * n <= capMax(m)) { m.owned[id] = (m.owned[id] ?? 0) + n; out.push(`굴복: ${MON[id].name}${n > 1 ? ` ×${n}` : ''} 합류`); }
    else out.push(`굴복한 ${MON[id].name}이(가) 있었지만 둥지가 가득 차 돌려보냈습니다.`);
  }
  // 포로: 쓰러뜨린 적 중 일부를 종류대로 사로잡는다(높은 종류부터 감옥 자리만큼). 측근 효과로 더
  const got: Record<string, number> = {};
  const extra = aideBonus(m, 'captive');
  for (const type of PRISON_ORDER) {
    let n = 0;
    for (let i = 0; i < (defeated[type] ?? 0); i++) if (rng() < PRISONERS[type].chance) n++;
    if (type === 'footman') n += extra;   // 측근 보너스는 보병 포로로
    for (let i = 0; i < n; i++) {
      if (prisonerCount(m) >= facValue(m, 'prison')) {
        // 감옥이 가득 차면 이번 포로보다 낮은 포로 하나를 풀어 주고 자리를 만든다
        const low = [...PRISON_ORDER].reverse().find((t) => PRISON_ORDER.indexOf(t) > PRISON_ORDER.indexOf(type) && m.prisoners[t] > 0);
        if (!low) break;
        m.prisoners[low]--; out.push(`감옥이 가득 차 ${PRISONERS[low].name} 포로 하나를 풀어 주었습니다.`);
      }
      m.prisoners[type]++; got[type] = (got[type] ?? 0) + 1;
    }
  }
  const caught = PRISON_ORDER.filter((t) => got[t]).map((t) => `${PRISONERS[t].name} ${got[t]}`);
  if (caught.length) out.push(`포로: ${caught.join(', ')} (감옥 ${prisonerCount(m)}/${facValue(m, 'prison')})`);
  else if (prisonerCount(m) >= facValue(m, 'prison')) out.push('감옥이 가득 차 포로를 더 잡지 못했습니다.');
  // 호감도: 함께 이긴 사람 모습 부대장 +1, MVP는 +1 더
  for (const L of new Set(leaders)) if (PEOPLE[L]) {
    const add = L === mvp ? 2 : 1;
    const before = m.affinity[L] ?? 0;
    m.affinity[L] = Math.min(10, before + add);
    if (m.affinity[L] !== before) out.push(`${MON[L].name} 호감도 ${before} → ${m.affinity[L]}`);
  }
  if (first) out.push(`위협도 ${threat(m)}: 아직 점령하지 않은 성채가 강해집니다.`);
  return out;
}

// ---------------- 계약: 명성이 쌓이면 찾아오는 몬스터(한 번씩) ----------------
export interface Contract { id: string; fame: number; mana: number; need?: { circle?: number; region?: string }; desc: string }
export const CONTRACTS: Contract[] = [
  { id: 'troll', fame: 20, mana: 80, desc: '떠돌던 트롤이 둥지 냄새를 맡고 왔다.' },
  { id: 'gargoyle', fame: 40, mana: 90, desc: '무너진 성당의 가고일이 새 주인을 찾는다.' },
  { id: 'minotaur', fame: 70, mana: 200, desc: '미궁에서 나온 미노타우로스. 힘을 시험하고 싶어 한다.' },
  { id: 'lich', fame: 100, mana: 240, desc: '오래된 리치가 던전의 이름을 들었다.' },
  { id: 'bone_dragon', fame: 150, mana: 450, need: { circle: 3 }, desc: '해골 용은 소환진이 3단계는 되어야 내려앉는다.' },
  { id: 'demon_general', fame: 200, mana: 520, need: { region: 'r7' }, desc: '1장을 끝낸 군단에만 마장군이 고개를 숙인다.' },
  { id: 'abyss_dragon', fame: 320, mana: 1200, need: { circle: 4, region: 'r11' }, desc: '심연의 용. 왕도 외성을 무너뜨린 마왕에게만 나타난다.' },
];
export function contractState(m: Meta, c: Contract): 'done' | 'open' | 'locked' {
  if (m.contracted.includes(c.id)) return 'done';
  if (m.fame < c.fame) return 'locked';
  if (c.need?.circle && facValue(m, 'circle') < c.need.circle) return 'locked';
  if (c.need?.region && !(c.need.region in m.conquered)) return 'locked';
  return 'open';
}
export function signContract(m: Meta, id: string): string | null {
  const c = CONTRACTS.find((x) => x.id === id)!;
  if (contractState(m, c) !== 'open') return '아직 계약할 수 없습니다.';
  if (m.mana < c.mana) return '마석이 모자랍니다.';
  if (capUsed(m) + GRADES[MON[id].grade].cap > capMax(m)) return '둥지가 가득 찼습니다.';
  m.mana -= c.mana; m.contracted.push(id); m.owned[id] = (m.owned[id] ?? 0) + 1;
  return null;
}
