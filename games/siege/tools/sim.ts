// 공성 시뮬레이션: 편성마다 자동 공성 승률·시간·별을 출력한다.
// 실행: npm run sim  (빠르게: npm test)
// 기준(docs/siege/06_roadmap.md): 지휘 효과를 성채에 맞춘 편성은 승률이 높고, 안 맞춘 같은 등급 편성은 확연히 낮아야 한다.
import { CASTLE } from '../src/data/castles';
import { createSiege, step, stars, autoCast, autoDeploy, setOrders, type SquadPlan, type SiegeState } from '../src/core/siege';

const quick = process.argv.includes('--quick');
const N = quick ? 20 : 100;
const DT = 1 / 20;

const sq = (leader: string, lane: 0 | 1 | 2, troops: [string, number][], delay = 0): SquadPlan =>
  ({ leader, lane, delay, troops: troops.map(([id, count]) => ({ id, count })) });

// 같은 수준(영웅 1 + 희귀 2)으로 맞춘 편성들
const PRESETS: Record<string, SquadPlan[]> = {
  '정문 힘싸움 (지휘 효과 안 맞음)': [
    sq('dark_knight', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('orc_warrior', 1, [['goblin', 4]], 4),
    sq('bone_archer', 1, [['imp', 4]], 6),
  ],
  '성문 공성 (오우거 족장)': [
    sq('ogre_chief', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('orc_warrior', 1, [['goblin', 4]], 4),
    sq('bone_archer', 1, [['imp', 4]], 6),
  ],
  '성문 공성 + 방패 (오우거 + 타락 기사)': [
    sq('dark_knight', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('ogre_chief', 1, [['skeleton', 3], ['goblin', 3]], 3),
    sq('bone_archer', 1, [['imp', 4]], 6),
  ],
  '성벽 넘기 (박쥐 여왕 + 하피)': [
    sq('bat_queen', 0, [['bat', 3], ['goblin', 3]]),
    sq('harpy', 0, [['goblin', 4]], 3),
    sq('bone_archer', 1, [['imp', 4]], 0),
  ],
  '지하 침투 (굴착 고블린)': [
    sq('sapper', 2, [['dire_rat', 4]]),
    sq('dark_knight', 2, [['skeleton', 3], ['goblin', 3]], 6),
    sq('bone_archer', 1, [['imp', 4]], 0),
  ],
  '망루 무력화 + 정문 (버섯 주술사)': [
    sq('dark_knight', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('mushroom_shaman', 1, [['goblin', 4]], 0),
    sq('orc_warrior', 1, [['goblin', 4]], 4),
  ],
  '부활 군단 (리치) 정문': [
    sq('lich', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('orc_warrior', 1, [['goblin', 4]], 4),
    sq('bone_archer', 1, [['imp', 4]], 6),
  ],
  '호수 건너기 (해마녀)': [
    sq('siren_queen', 1, [['skeleton', 4], ['goblin', 4]]),
    sq('orc_warrior', 1, [['goblin', 4]], 4),
    sq('bone_archer', 1, [['imp', 4]], 6),
  ],
  '비행 군단 (박쥐 여왕 + 가고일 + 하피)': [
    sq('bat_queen', 0, [['bat', 6]]),
    sq('gargoyle', 0, [['bat', 4]], 2),
    sq('harpy', 0, [['goblin', 4]], 4),
  ],
  '여러 갈래 (오우거 정문 + 하피 성벽 + 굴착)': [
    sq('ogre_chief', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('harpy', 0, [['goblin', 4]], 2),
    sq('sapper', 2, [['dire_rat', 4]], 0),
  ],
};

const base = CASTLE[process.argv.find((a) => CASTLE[a]) ?? 'border_fort'];

/** 운영 방식: 방치(아무것도 안 함) / 스킬(자동 사용) / 스킬+명령(망루가 무너질 때까지 성문 대기) */
type Policy = 'idle' | 'skill' | 'smart';
function play(s: SiegeState, policy: Policy) {
  autoDeploy(s);
  if (policy === 'smart') {
    // 망루가 남아 있고, 그걸 부술 원거리가 정문 쪽에 있을 때만 성문 공격을 미룬다
    const towersUp = s.towers.some((t) => t.alive);
    const ranged = s.units.some((u) => u.side === 'ally' && u.alive && u.lane === 1 && u.role === 'ranged');
    for (const q of s.squads) setOrders(s, q.idx, { gate: towersUp && ranged ? 'wait' : 'attack' });
  }
  if (policy !== 'idle') autoCast(s);
}

function winRate(power: number, plans: SquadPlan[], policy: Policy, n: number) {
  const castle = { ...base, power };
  let win = 0, time = 0, st = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = createSiege(castle, plans, { seed });
    let tick = 0;
    while (!s.over) { if (tick++ % 4 === 0) play(s, policy); step(s, DT); }
    if (s.over.win) { win++; time += s.t; st += stars(s); }
  }
  return { rate: win / n, time: win ? time / win : 0, stars: win ? st / win : 0 };
}
function limitPowerOn(castle: typeof base, plans: SquadPlan[], policy: Policy) {
  let lo = 0.3, hi = 3;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    let win = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = createSiege({ ...castle, power: mid }, plans, { seed });
      let tick = 0;
      while (!s.over) { if (tick++ % 4 === 0) play(s, policy); step(s, DT); }
      if (s.over.win) win++;
    }
    if (win / 6 >= 0.5) lo = mid; else hi = mid;
  }
  return lo;
}
/** 이길 수 있는(승률 50% 이상) 최대 수비 배율 */
function limitPower(plans: SquadPlan[], policy: Policy) {
  let lo = 0.3, hi = 3;
  for (let i = 0; i < (quick ? 6 : 9); i++) {
    const mid = (lo + hi) / 2;
    if (winRate(mid, plans, policy, quick ? 6 : 12).rate >= 0.5) lo = mid; else hi = mid;
  }
  return lo;
}

// --castles: 모든 성채에서 편성별 한계 배율(스킬 자동 + 성문 대기 명령)을 한 표로
if (process.argv.includes('--castles')) {
  const names = Object.keys(CASTLE);
  console.log('편성'.padEnd(36), names.map((id) => CASTLE[id].name.padStart(8)).join(''));
  for (const [name, plans] of Object.entries(PRESETS)) {
    const usesTunnel = plans.some((p) => p.lane === 2);
    const row = names.map((id) => {
      if (usesTunnel && !CASTLE[id].tunnel) return '       -';
      const saved = base; (globalThis as any).__base = CASTLE[id];
      const v = limitPowerOn(CASTLE[id], plans, 'smart');
      void saved; return v.toFixed(2).padStart(8);
    });
    console.log(name.padEnd(36), row.join(''));
  }
  process.exit(0);
}
console.log(`성채: ${base.name}  현재 수비 배율 ${base.power}`);
console.log('편성'.padEnd(34), '한계배율: 방치', '  스킬', ' 스킬+명령', '   (스킬+명령) 현재 배율 승률·시간·★');
for (const [name, plans] of Object.entries(PRESETS)) {
  const a = limitPower(plans, 'idle'), b = limitPower(plans, 'skill'), c = limitPower(plans, 'smart');
  const cur = winRate(base.power, plans, 'smart', N);
  console.log(name.padEnd(34), a.toFixed(2).padStart(9), b.toFixed(2).padStart(7), c.toFixed(2).padStart(9),
    `     ${Math.round(cur.rate * 100)}% ${cur.time ? cur.time.toFixed(0) + '초' : '-'} ${cur.stars ? cur.stars.toFixed(1) : '-'}`);
}
