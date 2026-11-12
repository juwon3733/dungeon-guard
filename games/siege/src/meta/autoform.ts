// 기본 편성: 화면(편성 열 때)과 캠페인 시뮬레이션(tools/campaign.ts)이 같이 쓴다.
import { MON, type Grade } from '../data/monsters';
import type { Lane } from '../data/castles';
import { troopCap, type SquadPlan } from '../core/siege';
import { squadSlots, regionCastle, type Meta, type Region } from './campaign';

const GRADE_ORDER: Grade[] = ['myth', 'legend', 'hero', 'rare', 'common'];
const ROLE_PICK = ['siege', 'shield', 'assault', 'ranged', 'support', 'flying'];

/** prev가 있으면 그 편성을 살리고(가진 몬스터만), 빈 자리는 알아서 채운다 */
export function autoForm(meta: Meta, region: Region, prev: SquadPlan[] = []): SquadPlan[] {
  const slots = squadSlots(meta);
  // 부대장: 높은 등급부터, 같은 등급이면 근접 하나 → 사격 하나 → 나머지
  const pool = Object.keys(meta.owned).filter((id) => MON[id].grade !== 'common' && meta.owned[id] > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(MON[a].grade) - GRADE_ORDER.indexOf(MON[b].grade) || ROLE_PICK.indexOf(MON[a].role) - ROLE_PICK.indexOf(MON[b].role));
  const leaders: string[] = [];
  const melee = pool.find((id) => ['siege', 'shield', 'assault'].includes(MON[id].role));
  const ranged = pool.find((id) => MON[id].role === 'ranged');
  for (const id of [melee, ranged, ...pool]) if (id && !leaders.includes(id)) leaders.push(id);
  const castle = regionCastle(meta, region);
  const laneFor = (id: string): Lane => (MON[id].role === 'flying' || MON[id].command?.wallPass ? 0 : MON[id].canDig && castle.tunnel ? 2 : 1);
  const next: SquadPlan[] = [];
  for (let i = 0; i < Math.min(slots, leaders.length); i++) {
    const p = prev[i];
    next.push(p && meta.owned[p.leader] ? structuredClone(p) : { leader: leaders[i], lane: laneFor(leaders[i]), delay: i * 3, troops: [] });
  }
  // 병력: 남은 일반 몬스터로 부대마다 수용량까지, 부대장 역할에 맞는 것부터
  const left: Record<string, number> = {};
  for (const [id, n] of Object.entries(meta.owned)) if (MON[id].grade === 'common') left[id] = n;
  for (const p of next) for (const t of p.troops) if (left[t.id] != null) left[t.id] = Math.max(0, left[t.id] - t.count);
  for (const p of next) {
    if (p.troops.some((t) => t.count > 0)) continue;
    let need = troopCap(p.leader); p.troops = [];
    const L = MON[p.leader];
    const want = L.role === 'ranged' ? 'ranged' : L.role === 'flying' || L.command?.wallPass ? 'flying' : L.canDig ? 'dig' : L.role === 'assault' ? 'assault' : 'shield';
    const fit = (id: string) => (want === 'dig' ? (MON[id].canDig ? 0 : 1) : MON[id].role === want ? 0 : 1);
    for (const id of Object.keys(left).sort((a, b) => fit(a) - fit(b) || left[b] - left[a])) {
      if (need <= 0 || p.troops.length >= 2) break;
      const n = Math.min(need, left[id]); if (n <= 0) continue;
      p.troops.push({ id, count: n }); left[id] -= n; need -= n;
    }
    while (p.troops.length < 2) p.troops.push({ id: 'goblin', count: 0 });
  }
  return next;
}
