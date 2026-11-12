// 캠페인 시뮬레이션: 가상의 플레이어가 처음부터 진행한다. 지역마다 몇 번째 출격에 뚫리는지, 어디서 막히는지 본다.
// 실행: npx tsx tools/campaign.ts [판 수=3]
// 플레이어: 기본 편성(autoForm), 스킬 자동 + 망루가 남으면 성문 대기, 금화는 시설 → 훈련, 마석은 적장 타락 → 계약 → 포로 타락 → 소환.
import { createSiege, step, stars, autoCast, autoDodge, setOrders } from '../src/core/siege';
import { MON } from '../src/data/monsters';
import { PEOPLE, giftCost } from '../src/data/characters';
import {
  fresh, release, buyMana, REGIONS, regionCastle, regionCaptain, unlocked, applyResult, upgrade, summon, corrupt, corruptNamed, train, gift, setAide,
  boostOf, squadBoostOf, capUsed, capMax, CONTRACTS, contractState, signContract, lvOf, SUMMON_COST, PRISONERS, facValue, type Meta, type PrisonerType,
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
      autoCast(s); autoDodge(s);
    }
    step(s, 0.05);
  }
  let best = -1, bi = 0; s.dmgBy.forEach((d, i) => { if (d > best) { best = d; bi = i; } });
  const defeated: Partial<Record<PrisonerType, number>> = {};
  for (const u of s.units) if (u.side === 'foe' && !u.alive && u.foeType) defeated[u.foeType] = (defeated[u.foeType] ?? 0) + 1;
  return { win: s.over.win, stars: stars(s), leaders: plans.map((p) => p.leader), mvp: s.over.win ? plans[bi].leader : null, defeated };
}

/** 약한 몬스터 하나(일반은 3마리)를 내보낸다: 남는 일반 → 겹치는 희귀 → 희귀. 사람 모습 동료와 측근은 남긴다 */
function makeRoom(m: Meta): boolean {
  const ids = Object.keys(m.owned).filter((id) => m.owned[id] > 0 && !PEOPLE[id] && m.aide !== id);
  const pick = ids.filter((id) => MON[id].grade === 'common' && m.owned[id] > 3).sort((a, b) => m.owned[b] - m.owned[a])[0]
    ?? ids.filter((id) => MON[id].grade === 'rare' && m.owned[id] > 1)[0]
    ?? ids.filter((id) => MON[id].grade === 'rare').sort((a, b) => lvOf(m, a) - lvOf(m, b))[0];
  return !!pick && !release(m, pick);
}

function spend(m: Meta, rng: () => number) {
  // 금화: 작전실 → 둥지(80% 넘게 찼으면) → 소환진(3단계까지) → 광산 → 감옥 → 훈련
  for (let guard = 0; guard < 50; guard++) {
    if (!upgrade(m, 'warroom')) continue;
    if (capUsed(m) > capMax(m) * 0.8) { if (!upgrade(m, 'nest')) continue; if (m.fac.nest < 3) break; }   // 둥지가 차면 증축을 위해 금화를 모은다
    if (facValue(m, 'circle') < 4 && !upgrade(m, 'circle')) continue;
    if (!upgrade(m, 'prison')) continue;
    if (!upgrade(m, 'mine')) continue;
    break;
  }
  // 측근: 호감도 3까지 선물, 측근 지정
  if (!m.aide) for (const id of Object.keys(PEOPLE)) if (m.owned[id] > 0) {
    while ((m.affinity[id] ?? 0) < 3 && m.gold >= giftCost(m.affinity[id] ?? 0)) gift(m, id);
    if (!setAide(m, id)) break;
  }
  // 남는 금화는 마석으로 바꾼다
  while (m.gold > 1500) buyMana(m);
  // 둥지가 90% 넘게 차면 남는 일반 몬스터(종류마다 8마리 넘는 것)를 내보낸다
  while (capUsed(m) > capMax(m) * 0.9) {
    const extra = Object.keys(m.owned).filter((id) => MON[id].grade === 'common' && m.owned[id] > 8).sort((a, b) => m.owned[b] - m.owned[a])[0];
    if (!extra || release(m, extra)) break;
  }
  // 마석: 적장 타락 → 계약 → 포로 타락 → 소환
  for (const id of [...m.named]) {
    // 둥지가 차서 막히면 약한 몬스터부터 내보내 자리를 만든다
    for (let g = 0; g < 30 && corruptNamed(m, id) === '둥지가 가득 찼습니다.'; g++) if (!makeRoom(m)) break;
  }
  // 사로잡은 적장이 남아 있으면(마석이 모자라) 나머지에 쓰지 말고 모은다
  if (m.named.length) return;
  for (const c of CONTRACTS) if (contractState(m, c) === 'open') signContract(m, c.id);
  for (const t of ['captain', 'knight', 'archer', 'footman'] as PrisonerType[]) {
    // 보병·궁수는 둥지에 여유가 있을 때만(일반 몬스터로 둥지가 차면 소환·계약이 막힌다)
    const roomy = capUsed(m) < capMax(m) * 0.7;
    if ((t === 'footman' || t === 'archer') && !roomy) continue;
    while (m.prisoners[t] > 0 && m.mana >= PRISONERS[t].cost + 40) {
      const r = corrupt(m, t, rng);
      if (r === '둥지가 가득 찼습니다.' && (t === 'captain' || t === 'knight') && makeRoom(m)) continue;
      if (typeof r === 'string') break;
    }
  }
  // 훈련(마석): 부대장 후보 중 레벨이 가장 낮은 것부터, 소환할 몫은 남긴다
  for (let guard = 0; guard < 60; guard++) {
    const leaders = Object.keys(m.owned).filter((id) => MON[id].grade !== 'common' && m.owned[id] > 0).sort((a, b) => lvOf(m, a) - lvOf(m, b));
    if (!leaders.length || lvOf(m, leaders[0]) >= 20 || m.mana < 150 || train(m, leaders[0])) break;
  }
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
    if (res.win) { applyResult(m, target, true, res.stars, res.leaders, res.mvp, rng, res.defeated); firstAt[target.id] = sorties; fails = 0; continue; }
    fails++;
    if (fails > 40) {
      stuck = target.name;
      if (process.env.DEBUG) {
        const plan = autoForm(m, target);
        console.log('  막힌 곳', target.name, '수비 강도', regionCastle(m, target).power, '금화', m.gold, '마석', m.mana, '명성', m.fame, '시설', JSON.stringify(m.fac), '포로', JSON.stringify(m.prisoners));
        console.log('  사로잡은 적장', JSON.stringify(m.named), '타락 시도:', m.named.map((id) => corruptNamed(structuredClone(m), id)).join(' / '), '둥지', capUsed(m), '/', capMax(m));
        console.log('  편성', plan.map((p) => `${MON[p.leader].name}[L${p.lane}] ${p.troops.map((t) => MON[t.id].name + t.count).join('+')}`).join(' | '));
        console.log('  보유', Object.entries(m.owned).filter(([, n]) => n > 0).map(([id, n]) => `${MON[id].name}×${n}(Lv${lvOf(m, id)})`).join(', '));
      }
      break;
    }
    // 졌으면 마지막으로 점령한 곳을 다시 쳐서 자원을 모은다
    const farm = [...REGIONS].reverse().find((r) => r.id in m.conquered);
    if (farm) { sorties++; const f = siege(m, farm.id, sorties * 7 + run); if (f.win) applyResult(m, farm, true, f.stars, f.leaders, f.mvp, rng, f.defeated); }
  }
  for (const r of REGIONS) (table[r.id] ??= []).push(firstAt[r.id] ?? NaN);
  const army = Object.entries(m.owned).filter(([id, n]) => n > 0 && MON[id].grade !== 'common').map(([id]) => `${MON[id].name}(${lvOf(m, id)})`).join(', ');
  console.log(`판 ${run}: 출격 ${sorties}회${stuck ? `, 막힘: ${stuck}` : ''}  군단: ${army}`);
}
console.log('\n지역별 첫 점령 출격 번호(판마다)');
for (const r of REGIONS) console.log(`${r.name.padEnd(8)} ${table[r.id].map((v) => (Number.isNaN(v) ? '  -' : String(v).padStart(3))).join(' ')}`);
