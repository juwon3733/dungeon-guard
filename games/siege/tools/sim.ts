// 공성 시뮬레이션: 편성마다 자동 공성 승률·시간·별을 출력한다.
// 실행: npm run sim  (빠르게: npm test)
// 기준(docs/siege/06_roadmap.md): 지휘 효과를 성채에 맞춘 편성은 승률이 높고, 안 맞춘 같은 등급 편성은 확연히 낮아야 한다.
import { CASTLE } from '../src/data/castles';
import { createSiege, step, stars, type SquadPlan } from '../src/core/siege';

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
  '여러 갈래 (오우거 정문 + 하피 성벽 + 굴착)': [
    sq('ogre_chief', 1, [['skeleton', 3], ['goblin', 3]]),
    sq('harpy', 0, [['goblin', 4]], 2),
    sq('sapper', 2, [['dire_rat', 4]], 0),
  ],
};

const base = CASTLE[process.argv.find((a) => CASTLE[a]) ?? 'border_fort'];

function winRate(power: number, plans: SquadPlan[], noCommand: boolean, n: number) {
  const castle = { ...base, power };
  let win = 0, time = 0, st = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = createSiege(castle, plans, { seed, noCommand });
    while (!s.over) step(s, DT);
    if (s.over.win) { win++; time += s.t; st += stars(s); }
  }
  return { rate: win / n, time: win ? time / win : 0, stars: win ? st / win : 0 };
}
/** 이길 수 있는(승률 50% 이상) 최대 수비 배율을 이분 탐색으로 찾는다 */
function limitPower(plans: SquadPlan[], noCommand: boolean) {
  let lo = 0.3, hi = 3;
  for (let i = 0; i < (quick ? 6 : 9); i++) {
    const mid = (lo + hi) / 2;
    if (winRate(mid, plans, noCommand, quick ? 6 : 12).rate >= 0.5) lo = mid; else hi = mid;
  }
  return lo;
}

console.log(`성채: ${base.name}  현재 수비 배율 ${base.power}`);
console.log('편성'.padEnd(34), '한계배율(효과 켬)', '(효과 끔)', ' 효과 이득', '  현재 배율 승률·시간·★');
for (const [name, plans] of Object.entries(PRESETS)) {
  const on = limitPower(plans, false), off = limitPower(plans, true);
  const cur = winRate(base.power, plans, false, N);
  console.log(name.padEnd(34), on.toFixed(2).padStart(10), off.toFixed(2).padStart(12), `${Math.round((on / off - 1) * 100)}%`.padStart(9),
    `   ${Math.round(cur.rate * 100)}% ${cur.time ? cur.time.toFixed(0) + '초' : '-'} ${cur.stars ? cur.stars.toFixed(1) : '-'}`);
}
