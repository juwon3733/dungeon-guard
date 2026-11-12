// 캠페인 시뮬레이션: 가상의 플레이어가 처음부터 진행한다. 지역마다 몇 번째 출격에 뚫리는지, 어디서 막히는지 본다.
// 실행: npx tsx tools/campaign.ts [판 수=3]
// 플레이어: 기본 편성(autoForm), 스킬 자동 + 망루가 남으면 성문 대기, 금화는 시설 → 훈련, 마석은 적장 타락 → 계약 → 포로 타락 → 소환.
import { createSiege, step, stars, autoCast, setOrders } from '../src/core/siege';
import { MON } from '../src/data/monsters';
import { PEOPLE, giftCost } from '../src/data/characters';
import {
  fresh, REGIONS, regionCastle, regionCaptain, unlocked, applyResult, upgrade, summon, corrupt, corruptNamed, train, gift, setAide,
  boostOf, squadBoostOf, capUsed, capMax, CONTRACTS, contractState, signContract, lvOf, SUMMON_COST, CORRUPT_COST, facValue, type Meta,
} from '../src/meta/campaign';
import { autoForm } from '../src/meta/autoform';

function mulberry(seed: number) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function siege(m: Meta, rid: string, seed: number) {
  const r = REGIONS.find((x) => x.id === rid)!;
  const plans = autoForm(m, r);
  const s = createSiege(regionCastle(m, r), plans, { seed, boost: (id) => boostOf(m, id), squadBoost: (id) => squadBoostOf(m, id), captainName: regionCaptain(m, r) });
  let tick = 0;
  while (!s.over) {
    if (tick++ % 4 === 0) {
      const up = s.towers.some((t) => t.alive), ranged = s.units.some((u) => u.side === 'ally' && u.alive && u.lane === 1 && u.role === 'ranged');
      for (const q of s.squads) setOrders(s, q.idx, { gate: up && ranged ? 'wait' : 'attack' });
      autoCast(s);
    }
    step(s, 0.05);
  }
  let best = -1, bi = 0; s.dmgBy.forEach((d, i) => { if (d > best) { best = d; bi = i; } });
  return { win: s.over.win, stars: stars(s), leaders: plans.map((p) => p.leader), mvp: s.over.win ? plans[bi].leader : null };
}

function spend(m: Meta, rng: () => number) {
  // 금화: 작전실 → 둥지(80% 넘게 찼으면) → 소환진(3단계까지) → 광산 → 감옥 → 훈련
  for (let guard = 0; guard < 50; guard++) {
    if (!upgrade(m, 'warroom')) continue;
    if (capUsed(m) > capMax(m) * 0.8 && !upgrade(m, 'nest')) continue;
    if (facValue(m, 'circle') < 3 && !upgrade(m, 'circle')) continue;
    if (!upgrade(m, 'mine')) continue;
    // 훈련: 부대장 후보(희귀 이상) 중 레벨이 가장 낮은 것
    const leaders = Object.keys(m.owned).filter((id) => MON[id].grade !== 'common' && m.owned[id] > 0).sort((a, b) => lvOf(m, a) - lvOf(m, b));
    if (leaders.length && lvOf(m, leaders[0]) < 15 && !train(m, leaders[0])) continue;
    break;
  }
  // 측근: 호감도 3까지 선물, 측근 지정
  if (!m.aide) for (const id of Object.keys(PEOPLE)) if (m.owned[id] > 0) {
    while ((m.affinity[id] ?? 0) < 3 && m.gold >= giftCost(m.affinity[id] ?? 0)) gift(m, id);
    if (!setAide(m, id)) break;
  }
  // 마석: 적장 타락 → 계약 → 포로 타락 → 소환
  for (const id of [...m.named]) corruptNamed(m, id);
  for (const c of CONTRACTS) if (contractState(m, c) === 'open') signContract(m, c.id);
  while (m.captives > 0 && m.mana >= CORRUPT_COST + 40) if (typeof corrupt(m, rng) === 'string') break;
  while (m.mana >= SUMMON_COST + 40) if (typeof summon(m, rng) === 'string') break;
}

const RUNS = Number(process.argv[2] ?? 3);
const table: Record<string, number[]> = {};
for (let run = 1; run <= RUNS; run++) {
  const m = fresh(), rng = mulberry(run * 97);
  let sorties = 0, fails = 0, stuck = '';
  const firstAt: Record<string, number> = {};
  while (sorties < 400) {
    spend(m, rng);
    const target = REGIONS.find((r) => !(r.id in m.conquered) && unlocked(m, r));
    if (!target) break;
    sorties++;
    const res = siege(m, target.id, sorties * 13 + run);
    if (res.win) { applyResult(m, target, true, res.stars, res.leaders, res.mvp, rng); firstAt[target.id] = sorties; fails = 0; continue; }
    fails++;
    if (fails > 40) { stuck = target.name; break; }
    // 졌으면 마지막으로 점령한 곳을 다시 쳐서 자원을 모은다
    const farm = [...REGIONS].reverse().find((r) => r.id in m.conquered);
    if (farm) { sorties++; const f = siege(m, farm.id, sorties * 7 + run); if (f.win) applyResult(m, farm, true, f.stars, f.leaders, f.mvp, rng); }
  }
  for (const r of REGIONS) (table[r.id] ??= []).push(firstAt[r.id] ?? NaN);
  const army = Object.entries(m.owned).filter(([id, n]) => n > 0 && MON[id].grade !== 'common').map(([id]) => `${MON[id].name}(${lvOf(m, id)})`).join(', ');
  console.log(`판 ${run}: 출격 ${sorties}회${stuck ? `, 막힘: ${stuck}` : ''}  군단: ${army}`);
}
console.log('\n지역별 첫 점령 출격 번호(판마다)');
for (const r of REGIONS) console.log(`${r.name.padEnd(8)} ${table[r.id].map((v) => (Number.isNaN(v) ? '  -' : String(v).padStart(3))).join(' ')}`);
