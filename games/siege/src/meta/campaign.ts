// 판 바깥 진행: 지도(지역), 군단(보유 몬스터), 던전 시설, 소환·굴복·타락, 저장. 시간 개념 없음.
// 계획: docs/siege/04_dungeon.md, 02_monsters.md
import { MON, GRADES, type Grade } from '../data/monsters';
import { CASTLE, type Castle } from '../data/castles';

// ---------------- 지역(지도) ----------------
export interface Region {
  id: string; name: string; castle: string; basePower: number;
  gold: number; mana: number;           // 점령 보상(다시 공략하면 절반)
  wild: string[];                       // 굴복으로 얻는 그 지역 몬스터
  desc: string;
}
export const REGIONS: Region[] = [
  { id: 'r1', name: '개척 마을', castle: 'border_fort', basePower: 0.45, gold: 180, mana: 60, wild: ['goblin', 'dire_rat', 'kobold'], desc: '국경 끝의 작은 마을. 첫 공성으로 알맞다.' },
  { id: 'r2', name: '언덕 초소', castle: 'rock_keep', basePower: 0.42, gold: 220, mana: 70, wild: ['kobold', 'bat', 'wolf_alpha'], desc: '바위 언덕 위 초소. 굴을 팔 수 없다.' },
  { id: 'r3', name: '강가 방앗간', castle: 'lake_castle', basePower: 0.48, gold: 260, mana: 80, wild: ['slime', 'giant_spider', 'mushroom_shaman'], desc: '강물을 끌어들인 해자가 있다.' },
  { id: 'r4', name: '국경 요새', castle: 'border_fort', basePower: 0.8, gold: 340, mana: 100, wild: ['gargoyle', 'troll', 'sapper'], desc: '왕국 국경을 지키는 요새. 세 길이 모두 열려 있다.' },
  { id: 'r5', name: '철문 성채', castle: 'iron_gate', basePower: 0.75, gold: 420, mana: 120, wild: ['hellhound', 'troll', 'ogre_chief'], desc: '성문이 매우 단단하다. 장사가 필요하다.' },
  { id: 'r6', name: '호수 성', castle: 'lake_castle', basePower: 0.8, gold: 480, mana: 140, wild: ['harpy', 'giant_spider', 'minotaur'], desc: '넓은 호수에 둘러싸인 성.' },
  { id: 'r7', name: '바위 요새', castle: 'rock_keep', basePower: 0.85, gold: 560, mana: 160, wild: ['gargoyle', 'bone_archer', 'bat_queen'], desc: '1장의 마지막 요새.' },
];
export const REGION: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// ---------------- 던전 시설 ----------------
export type FacId = 'nest' | 'warroom' | 'circle' | 'mine' | 'prison';
export const FACILITIES: Record<FacId, { name: string; desc: string; costs: number[]; values: number[]; unit: string }> = {
  nest: { name: '둥지', desc: '군단 수용량(일반 1, 희귀 2, 영웅 4, 전설 8, 신화 16)', costs: [0, 300, 700, 1400], values: [50, 70, 100, 140], unit: '' },
  warroom: { name: '작전실', desc: '한 번에 출전하는 부대 수', costs: [0, 400, 1000], values: [2, 3, 4], unit: '부대' },
  circle: { name: '소환진', desc: '소환에서 높은 등급이 나올 확률', costs: [0, 400, 900, 1600], values: [1, 2, 3, 4], unit: '단계' },
  mine: { name: '광산', desc: '공성으로 얻는 마석 증가', costs: [0, 250, 600], values: [0, 25, 50], unit: '%' },
  prison: { name: '감옥', desc: '가둘 수 있는 포로 수', costs: [0, 300, 700], values: [2, 4, 6], unit: '명' },
};

// 소환진 단계별 등급 확률(%)
const SUMMON_ODDS: Record<number, Record<Grade, number>> = {
  1: { common: 62, rare: 33, hero: 5, legend: 0, myth: 0 },
  2: { common: 50, rare: 38, hero: 10, legend: 2, myth: 0 },
  3: { common: 40, rare: 40, hero: 15, legend: 4.5, myth: 0.5 },
  4: { common: 30, rare: 40, hero: 22, legend: 7, myth: 1 },
};
export const SUMMON_COST = 50;
export const CORRUPT_COST = 60;
// 타락: 포로 → 마족(사람 모습). 확률(%)
const CORRUPT_POOL: [string, number][] = [['succubus', 30], ['dark_knight', 30], ['witch', 30], ['vampire_lord', 10]];

// ---------------- 상태 ----------------
export interface Meta {
  v: 1;
  gold: number; mana: number; fame: number;
  owned: Record<string, number>;           // 몬스터 id → 수
  fac: Record<FacId, number>;               // 시설 단계(0부터)
  conquered: Record<string, number>;        // 지역 id → 최고 별
  captives: number;
}
const KEY = 'siege.meta.v1';

export function fresh(): Meta {
  return {
    v: 1, gold: 300, mana: 120, fame: 0,
    owned: { orc_warrior: 1, harpy: 1, bone_archer: 1, wolf_alpha: 1, goblin: 12, skeleton: 6, imp: 6, bat: 4, dire_rat: 4 },
    fac: { nest: 0, warroom: 0, circle: 0, mine: 0, prison: 0 },
    conquered: {}, captives: 0,
  };
}
export function load(): Meta {
  try { const raw = localStorage.getItem(KEY); if (raw) { const m = JSON.parse(raw); if (m && m.v === 1) return { ...fresh(), ...m }; } } catch { /* 못 읽으면 처음 상태 */ }
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
/** 공성할 성채(위협도만큼 강해짐, 이미 점령한 곳은 그대로) */
export function regionCastle(m: Meta, r: Region): Castle {
  const t = r.id in m.conquered ? 0 : threat(m);
  return { ...CASTLE[r.castle], name: r.name, power: +(r.basePower + 0.04 * t).toFixed(2) };
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
const SUMMONABLE = (g: Grade) => Object.values(MON).filter((x) => x.grade === g && !CORRUPT_POOL.some(([id]) => id === x.id));

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

/** 타락 의식: 포로 1명 + 마석 → 마족 */
export function corrupt(m: Meta, rng = Math.random): string | { id: string } {
  if (m.captives <= 0) return '포로가 없습니다.';
  if (m.mana < CORRUPT_COST) return '마석이 모자랍니다.';
  let r = rng() * 100, id = CORRUPT_POOL[0][0];
  for (const [k, p] of CORRUPT_POOL) { if (r < p) { id = k; break; } r -= p; }
  if (capUsed(m) + GRADES[MON[id].grade].cap > capMax(m)) return '둥지가 가득 찼습니다.';
  m.mana -= CORRUPT_COST; m.captives--; m.owned[id] = (m.owned[id] ?? 0) + 1;
  return { id };
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

/** 공성 결과 반영. 보상 글을 돌려준다 */
export function applyResult(m: Meta, r: Region, win: boolean, stars: number, rng = Math.random): string[] {
  const out: string[] = [];
  if (!win) { out.push('잃은 것은 없습니다. 편성을 바꿔 다시 도전하세요.'); return out; }
  const first = !(r.id in m.conquered);
  const k = first ? 1 : 0.5;
  const gold = Math.round(r.gold * k * (1 + 0.15 * (stars - 1)));
  const mana = Math.round(r.mana * k * (1 + facValue(m, 'mine') / 100));
  m.gold += gold; m.mana += mana; m.fame += first ? 10 * stars : stars;
  out.push(`금화 +${gold}, 마석 +${mana}${first ? ' (첫 점령)' : ' (다시 공략: 절반)'}`);
  m.conquered[r.id] = Math.max(m.conquered[r.id] ?? 0, stars);
  // 굴복: 그 지역 몬스터 하나(일반은 3마리)
  const id = r.wild[Math.floor(rng() * r.wild.length)];
  const g = MON[id].grade;
  const chance = g === 'common' ? 1 : g === 'rare' ? 0.6 : 0.25;
  if (rng() < chance) {
    const n = g === 'common' ? 3 : 1;
    if (capUsed(m) + GRADES[g].cap * n <= capMax(m)) { m.owned[id] = (m.owned[id] ?? 0) + n; out.push(`굴복: ${MON[id].name}${n > 1 ? ` ×${n}` : ''} 합류`); }
    else out.push(`굴복한 ${MON[id].name}이(가) 있었지만 둥지가 가득 차 돌려보냈습니다.`);
  }
  // 포로
  if (m.captives < facValue(m, 'prison')) { m.captives++; out.push('포로 1명을 감옥에 가뒀습니다.'); }
  if (first) out.push(`위협도 ${threat(m)}: 아직 점령하지 않은 성채가 강해집니다.`);
  return out;
}
