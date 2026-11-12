// 공성전 엔진(규칙만). 화면과 분리되어 tools/sim.ts에서 그대로 돌린다.
// 계획: docs/siege/03_siege.md. 횡스크롤 3레인, 부대 = 부대장 + 병력, 부대장이 살아 있을 때만 지휘 효과.
import { MON, GRADES, ROLES, SWIMMERS, SKILLS, type Command, type Role, type Skill } from '../data/monsters';
import { FOES, type Castle, type Lane, type FoeType } from '../data/castles';

export interface SquadPlan {
  leader: string;                              // 몬스터 id (희귀 이상)
  troops: { id: string; count: number }[];     // 일반·희귀
  lane: Lane;
  delay: number;                               // 자동 투입(시뮬레이션)일 때 이 초 전에는 내보내지 않는다
  gear?: Gear;                                 // 공성 장비(대장간): 부대장과 상관없이 부대에 붙는다
}

/** 공성 장비: 사다리(성벽 넘기), 충차(성문 피해 2배), 큰 방패(망루 피해 -30%) */
export type Gear = 'ladder' | 'ram' | 'mantlet';
export const GEARS: Record<Gear, { name: string; desc: string; cost: number; forge: number }> = {
  ladder: { name: '사다리', desc: '비행이 아니어도 성벽 레인을 넘는다', cost: 120, forge: 1 },
  ram: { name: '충차', desc: '부대의 성문 피해 2배', cost: 150, forge: 2 },
  mantlet: { name: '큰 방패', desc: '망루에게 받는 피해 -30%', cost: 100, forge: 3 },
};
const gearOf = (s: SiegeState, squad: number) => s.squads[squad]?.plan.gear;

export interface Unit {
  uid: number;
  side: 'ally' | 'foe';
  name: string;
  monId?: string;
  foeType?: FoeType;
  squad: number;           // 아군 부대 번호, 적은 -1
  isLeader: boolean;
  role: Role | 'foe';
  grade?: string;
  lane: Lane;
  x: number;
  hp: number; max: number;
  atk: number; range: number; iv: number; speed: number;
  atkT: number;
  alive: boolean;
  hitT: number;            // 맞은 직후 깜빡임
  firstHit: boolean;
  revived: boolean;
  canDig: boolean;
  core: boolean;           // 핵심 지점 수비대
  aggro: boolean;
  lungeT: number;
  homeX: number;           // 수비대가 지키는 자리(멀리 쫓아가지 않음)
  outpost?: boolean;       // 성 밖 외곽 초소 수비대
  shiftT: number; shiftMax: number; fromLane: Lane;   // 레인 바꾸는 중
  spikeT: number;          // 가시밭 피해 간격
  stunT: number;           // 기절(행동 불가)
  vulnT: number;           // 받는 피해 증가 남은 시간
  vulnMul: number;
}

export interface Tower { lane: Lane; x: number; hp: number; max: number; dmg: number; range: number; iv: number; atkT: number; alive: boolean; antiAir?: boolean; barrier?: boolean; splash?: number }

/** 부대 명령: 전진/정지, 성문 공격/대기 */
export interface Orders { advance: boolean; gate: 'attack' | 'wait'; lane?: Lane }
export interface Squad {
  idx: number; plan: SquadPlan; leader: Unit | null; started: boolean; retreated: boolean;
  orders: Orders;
  skill: Skill | null; skillCd: number;    // 부대장 고유 스킬(영웅 이상)
  shieldT: number;                          // 검은 방패 등 부대 피해 감소
}

export type SiegeEvent =
  | { t: 'attack'; from: Unit; to: { x: number; lane: Lane }; ranged: boolean }
  | { t: 'hit'; x: number; lane: Lane; dmg: number; ally: boolean; big?: boolean; u?: Unit }
  | { t: 'die'; u: Unit }
  | { t: 'revive'; u: Unit }
  | { t: 'tower'; x: number; lane: Lane; to: Unit; miss: boolean }
  | { t: 'gateBreak'; x: number }
  | { t: 'towerBreak'; x: number; lane: Lane }
  | { t: 'tunnelOpen'; x: number }
  | { t: 'leaderDown'; u: Unit }
  | { t: 'skill'; squad: number; leader: Unit; skill: Skill; x: number; y: number; lane: Lane; area?: number }
  | { t: 'skillHit'; kind: string; x: number; lane: Lane; r?: number }
  | { t: 'palisadeBreak'; x: number; lane: Lane }
  | { t: 'outpost'; lane: Lane }
  | { t: 'deploy'; squad: number; lane: Lane; x: number }
  | { t: 'end'; win: boolean; reason: string };

export interface SiegeState {
  castle: Castle;
  t: number;
  units: Unit[];
  squads: Squad[];
  towers: Tower[];
  gateHp: number; gateMax: number;
  tunnelWork: number; tunnelOpen: boolean;
  coreProg: number;
  over: null | { win: boolean; reason: string };
  rng: () => number;
  emit: (e: SiegeEvent) => void;
  stats: { allyDead: number; foeDead: number; leadersLost: number };
  noCommand: boolean;        // 시뮬레이션 비교용: 지휘 효과 끄기
  timers: { at: number; fn: () => void }[];
  palisades: { lane: Lane; x: number; hp: number; max: number; alive: boolean }[];
  outpostCleared: boolean[];   // 레인별 외곽 초소를 정리했는지(그 레인 망루 피해 -30%)
  /** 레벨·각성 보정(몬스터 id → 능력 배율), 호감도 보정(부대장 id → 부대 전체 배율) */
  boost: (monId: string) => number;
  squadBoost: (leaderId: string) => number;
  /** 부대별로 준 피해(MVP 계산) */
  dmgBy: number[];
  captainName?: string;
  /** 지휘력: 예비 부대를 투입하는 데 쓴다. 시간이 지나면 찬다 */
  cmdPts: number;
}

const NOCMD: Command = { desc: '' };
let UID = 1;

export function mulberry(seed: number) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 부대 지휘 효과: 부대장이 살아 있을 때만 */
export function cmdOf(s: SiegeState, squad: number): Command {
  const sq = s.squads[squad];
  if (s.noCommand || !sq || !sq.leader || !sq.leader.alive) return NOCMD;
  return MON[sq.leader.monId!].command ?? NOCMD;
}

export function troopCap(leaderId: string) { return GRADES[MON[leaderId].grade].troops; }

function allyUnit(monId: string, squad: number, lane: Lane, x: number, isLeader: boolean, cmd: Command, mult = 1): Unit {
  const m = MON[monId], g = GRADES[m.grade], r = ROLES[m.role];
  let hp = g.hp * r.hp * (isLeader ? 2 : 1) * mult;
  if (cmd.hpMulRole && cmd.hpMulRole.role === m.role) hp *= cmd.hpMulRole.mul;
  let range = r.range;
  if (m.role === 'ranged' && cmd.rangeMul) range *= cmd.rangeMul;
  return {
    uid: UID++, side: 'ally', name: m.name, monId, squad, isLeader, role: m.role, grade: m.grade, lane, x,
    hp, max: hp, atk: g.atk * r.atk * mult, range, iv: r.iv, speed: 40 * r.speed * (cmd.speedMul ?? 1),
    atkT: 0.3, alive: true, hitT: 0, firstHit: true, revived: false, canDig: !!m.canDig, core: false, aggro: true, lungeT: 0, homeX: x, stunT: 0, vulnT: 0, vulnMul: 1, shiftT: 0, shiftMax: 1, fromLane: lane, spikeT: 0,
  };
}

function foeUnit(type: FoeType, lane: Lane, x: number, core: boolean, pw: number): Unit {
  const f = FOES[type];
  return {
    uid: UID++, side: 'foe', name: f.name, foeType: type, squad: -1, isLeader: type === 'captain', role: 'foe', lane, x,
    hp: f.hp * pw, max: f.hp * pw, atk: f.atk * pw, range: f.range, iv: f.iv, speed: f.speed,
    atkT: 0.5, alive: true, hitT: 0, firstHit: false, revived: false, canDig: false, core, aggro: false, lungeT: 0, homeX: x, stunT: 0, vulnT: 0, vulnMul: 1, shiftT: 0, shiftMax: 1, fromLane: lane, spikeT: 0,
  };
}

export function createSiege(castle: Castle, plans: SquadPlan[], opts: {
  seed?: number; emit?: (e: SiegeEvent) => void; noCommand?: boolean;
  boost?: (monId: string) => number; squadBoost?: (leaderId: string) => number; captainName?: string;
} = {}): SiegeState {
  const rng = opts.seed != null ? mulberry(opts.seed) : Math.random;
  const s: SiegeState = {
    castle, t: 0, units: [], squads: [], towers: castle.towers.map((t) => ({ ...t, hp: t.hp * castle.power, max: t.hp * castle.power, dmg: t.dmg * castle.power, atkT: 1, alive: true })),
    gateHp: castle.gateHp * castle.power, gateMax: castle.gateHp * castle.power, tunnelWork: 0, tunnelOpen: false, coreProg: 0, over: null,
    rng, emit: opts.emit ?? (() => {}), stats: { allyDead: 0, foeDead: 0, leadersLost: 0 }, noCommand: !!opts.noCommand, timers: [], palisades: [], outpostCleared: [false, false, false],
    boost: opts.boost ?? (() => 1), squadBoost: opts.squadBoost ?? (() => 1), dmgBy: plans.map(() => 0), captainName: opts.captainName, cmdPts: CMD_START,
  };
  plans.forEach((p, i) => s.squads.push({ idx: i, plan: p, leader: null, started: false, retreated: false,
    orders: { advance: true, gate: 'attack' }, skill: SKILLS[p.leader] ?? null, skillCd: 4, shieldT: 0 }));
  for (const g of castle.garrison) {
    for (let i = 0; i < g.count; i++) {
      const lane: Lane = g.lane === 'core' ? 1 : g.lane;
      { const fu = foeUnit(g.type, lane, g.x + i * 18, g.lane === 'core', castle.power); if (g.outpost) fu.outpost = true; s.units.push(fu); }
    }
  }  for (const o of castle.outworks ?? []) if (o.kind === 'palisade') s.palisades.push({ lane: o.lane, x: o.x, hp: o.hp * castle.power, max: o.hp * castle.power, alive: true });

  if (s.captainName) for (const u of s.units) if (u.foeType === 'captain') u.name = s.captainName;
  return s;
}

// ---------------- 예비대 투입 ----------------
export const CMD_START = 7, CMD_MAX = 12, CMD_RATE = 0.55;   // 시작 7, 약 1.8초에 1, 최대 10
const DEPLOY_COST: Record<string, number> = { rare: 2, hero: 3, legend: 5, myth: 7 };
export const deployCost = (leaderId: string) => DEPLOY_COST[MON[leaderId].grade] ?? 3;
/** 그 레인에서 투입할 자리: 외곽 초소를 정리하면 그 자리까지 앞당겨진다 */
export function deployX(s: SiegeState, lane: Lane) {
  const posts = s.units.filter((u) => u.outpost && u.lane === lane);
  return s.outpostCleared[lane] && posts.length ? Math.min(...posts.map((u) => u.homeX)) - 40 : 40;
}
export function canDeploy(s: SiegeState, squad: number, lane: Lane) {
  const q = s.squads[squad];
  return !!q && !q.started && !s.over && s.cmdPts >= deployCost(q.plan.leader) && !(lane === 2 && !s.castle.tunnel);
}
/** 예비 부대를 그 레인에 내보낸다 */
export function deploy(s: SiegeState, squad: number, lane: Lane): boolean {
  if (!canDeploy(s, squad, lane)) return false;
  const q = s.squads[squad];
  s.cmdPts -= deployCost(q.plan.leader);
  q.plan.lane = lane;
  spawnSquad(s, q);
  s.emit({ t: 'deploy', squad, lane, x: deployX(s, lane) });
  return true;
}
/** 시뮬레이션용: 편성 순서대로, 지휘력이 차면 정한 레인에 */
export function autoDeploy(s: SiegeState) {
  // 남은 부대를 한꺼번에 낼 만큼(또는 가득) 모았다가 연달아 낸다(조금씩 내면 각개 격파당한다)
  const rest = s.squads.filter((x) => !x.started);
  if (!rest.length) return;
  const need = Math.min(CMD_MAX, rest.reduce((a, x) => a + deployCost(x.plan.leader), 0));
  if (s.cmdPts < need) return;
  for (const q of rest) deploy(s, q.idx, q.plan.lane);
}

function spawnSquad(s: SiegeState, sq: Squad) {
  sq.started = true;
  const x0 = deployX(s, sq.plan.lane) - 40;
  const cmd = s.noCommand ? NOCMD : (MON[sq.plan.leader].command ?? NOCMD);
  const lane = sq.plan.lane;
  const sb = s.squadBoost(sq.plan.leader);
  const leader = allyUnit(sq.plan.leader, sq.idx, lane, x0 + 40, true, cmd, s.boost(sq.plan.leader) * sb);
  sq.leader = leader;
  s.units.push(leader);
  let k = 0;
  const cap = troopCap(sq.plan.leader);
  for (const t of sq.plan.troops) {
    for (let i = 0; i < t.count && k < cap; i++, k++) s.units.push(allyUnit(t.id, sq.idx, lane, x0 + 70 + (k % 4) * 16 - Math.floor(k / 4) * 14, false, cmd, s.boost(t.id) * sb));
  }
}

/** 성 안(레인이 합쳐진 곳)에 있는지. 지하는 성 안쪽 굴을 지나 경사로를 올라와야 성 안이다 */
export const TUNNEL_IN = 150;
const inside = (s: SiegeState, u: { x: number; lane?: number }) =>
  u.x > s.castle.mergeX && (u.lane !== 2 || u.x > s.castle.wallX + TUNNEL_IN);

/** 두 위치가 서로 닿을 수 있는 레인인지(성 안은 하나로 합쳐짐) */
function sameField(s: SiegeState, a: Unit, b: Unit) {
  if (inside(s, a) && inside(s, b)) return true;
  return a.lane === b.lane;
}

function canPassWall(s: SiegeState, u: Unit) {
  return u.role === 'flying' || !!cmdOf(s, u.squad).wallPass || gearOf(s, u.squad) === 'ladder';
}

/** 아군 유닛이 이 레인에서 갈 수 있는 가장 먼 x */
function allyLimit(s: SiegeState, u: Unit): number {
  const c = s.castle;
  if (u.x > c.wallX) return c.coreX + 20;   // 성 안: 핵심 지점에서 멈춰 점거
  if (u.role !== 'flying') for (const p of s.palisades) if (p.alive && p.lane === u.lane && p.x > u.x - 4) return Math.min(p.x - 22, laneLimit(s, u));
  return laneLimit(s, u);
}
function laneLimit(s: SiegeState, u: Unit): number {
  const c = s.castle;
  if (u.lane === 0 && !canPassWall(s, u)) return c.wallX - 24;
  if (u.lane === 1 && s.gateHp > 0) return c.wallX - 24;
  if (u.lane === 2 && !s.tunnelOpen) return c.wallX - 24;
  return c.coreX + 20;
}

/** 적 유닛이 나올 수 있는 가장 왼쪽 x */
function foeLimit(s: SiegeState, u: Unit): number {
  const c = s.castle;
  if (u.core) return c.mergeX;
  if (u.outpost) return u.homeX - 200;
  if (u.lane === 1 && s.gateHp <= 0) return c.wallX - 260;
  if (u.lane === 2 && s.tunnelOpen) return c.wallX - 180;
  return c.wallX + 10;
}

const inZone = (s: SiegeState, u: Unit, kind: 'forest' | 'hill') =>
  (s.castle.terrain ?? []).some((z) => z.kind === kind && z.lane === u.lane && u.x >= z.x0 && u.x <= z.x1);

function damage(s: SiegeState, src: Unit | null, tgt: Unit, raw: number) {
  if (!tgt.alive) return;
  let dmg = raw;
  // 숲: 숲 안 아군은 원거리(망루·투석기·궁수) 피해 -30%
  if (tgt.side === 'ally' && (!src || src.range > 60) && inZone(s, tgt, 'forest')) dmg *= 0.7;
  if (tgt.side === 'ally') { dmg *= cmdOf(s, tgt.squad).dmgTakenMul ?? 1; if (s.squads[tgt.squad]?.shieldT > 0) dmg *= 0.5; }
  if (tgt.vulnT > 0) dmg *= tgt.vulnMul;
  dmg = Math.max(1, Math.round(dmg));
  tgt.hp -= dmg; tgt.hitT = 0.12;
  if (src && src.side === 'ally' && tgt.side === 'foe' && src.squad >= 0) s.dmgBy[src.squad] += Math.min(dmg, tgt.hp + dmg);
  s.emit({ t: 'hit', x: tgt.x, lane: tgt.lane, dmg, ally: tgt.side === 'ally', big: dmg >= 60, u: tgt });
  if (tgt.hp > 0) return;
  // 리치 등: 병력은 한 번 해골로 부활
  if (tgt.side === 'ally' && !tgt.isLeader && !tgt.revived && cmdOf(s, tgt.squad).revive) {
    tgt.revived = true; tgt.monId = 'skeleton'; tgt.name = '해골 병사'; tgt.role = 'shield';
    tgt.max = GRADES.common.hp * ROLES.shield.hp; tgt.hp = tgt.max * 0.6; tgt.atk = GRADES.common.atk * ROLES.shield.atk;
    tgt.range = ROLES.shield.range; tgt.iv = ROLES.shield.iv;
    s.emit({ t: 'revive', u: tgt });
    return;
  }
  tgt.alive = false; tgt.hp = 0;
  s.emit({ t: 'die', u: tgt });
  if (tgt.side === 'ally') {
    s.stats.allyDead++;
    if (tgt.isLeader) { s.stats.leadersLost++; s.emit({ t: 'leaderDown', u: tgt }); }
  } else s.stats.foeDead++;
  void src;
}

/** 결계 기둥이 하나라도 살아 있으면 성 안 아군 공격력 -40% */
const barrierUp = (s: SiegeState) => s.towers.some((t) => t.barrier && t.alive);
function allyAtk(s: SiegeState, u: Unit): number {
  const cmd = cmdOf(s, u.squad);
  let a = u.atk * (cmd.atkMul ?? 1);
  if (u.x > s.castle.wallX && barrierUp(s)) a *= 0.6;
  if (cmd.atkMulRole && cmd.atkMulRole.role === u.role) a *= cmd.atkMulRole.mul;
  if (s.gateHp <= 0 && cmd.afterGateAtkMul) a *= cmd.afterGateAtkMul;
  if (u.firstHit) { a *= cmd.firstHitMul ?? 1; u.firstHit = false; }
  return a;
}

type Target = { kind: 'unit'; u: Unit } | { kind: 'tower'; t: Tower } | { kind: 'gate' } | { kind: 'palisade'; p: Pal };

type Pal = SiegeState['palisades'][number];
function findAllyTarget(s: SiegeState, u: Unit): Target | null {
  let best: Target | null = null, bd = Infinity;
  const ranged = u.range > 60;
  const range = u.range * (ranged && inZone(s, u, 'hill') ? 1.25 : 1);   // 언덕: 사격 사거리 +25%
  for (const f of s.units) {
    if (f.side !== 'foe' || !f.alive) continue;
    // 사격은 성벽 위(레인 0) 적도 쏠 수 있다
    const ok = sameField(s, u, f) || (ranged && u.lane === 1 && f.lane === 0);
    if (!ok) continue;
    const d = Math.abs(f.x - u.x);
    // 성 밖에서는 앞쪽 적만, 성 안에서는 방향 상관없이(지나친 적에게 뒤를 잡히지 않게)
    const facing = inside(s, u) || f.x >= u.x - 10;
    if (facing && d <= range && d < bd) { bd = d; best = { kind: 'unit', u: f }; }
  }
  if (best) return best;
  for (const t of s.towers) {
    if (!t.alive) continue;
    const ok = t.lane === u.lane || (ranged && u.lane === 1 && t.lane === 0) || (inside(s, u));
    const d = Math.abs(t.x - u.x);
    if (ok && d <= range + 10 && d < bd) { bd = d; best = { kind: 'tower', t }; }
  }
  if (best) return best;
  // 목책: 길을 막고 있으면 부순다
  for (const p of s.palisades) if (p.alive && p.lane === u.lane && p.x >= u.x - 10 && p.x - u.x <= range + 26 && u.role !== 'flying') return { kind: 'palisade', p };
  // 성문은 근접·공성만 친다(사격은 앞으로 나가 망루와 성벽 궁수를 노린다)
  const atGate = s.castle.wallX - u.x <= 30;   // 사격도 성문 바로 앞까지 오면 성문을 친다
  if (s.squads[u.squad]?.orders.gate === 'wait') return null;
  if (u.lane === 1 && s.gateHp > 0 && (u.range <= 60 || u.role === 'siege' || atGate) && u.x < s.castle.wallX && s.castle.wallX - u.x <= u.range + 26) return { kind: 'gate' };
  return null;
}

/** 해마녀처럼 해자를 건너게 하는 부대장이 같은 레인에 살아 있으면 그 레인의 모든 부대가 물을 그대로 건넌다 */
function moatFree(s: SiegeState, u: Unit) {
  if (s.noCommand) return false;
  return s.squads.some((q) => q.plan.lane === u.lane && q.leader?.alive && MON[q.plan.leader].command?.moatIgnore);
}

function stepAlly(s: SiegeState, u: Unit, dt: number) {
  const cmd = cmdOf(s, u.squad);
  const c0 = s.castle;
  if (cmd.regen) u.hp = Math.min(u.max, u.hp + u.max * cmd.regen * dt);
  // 가시밭: 지나가는 동안 피해(비행 제외)
  if (u.role !== 'flying') for (const o of c0.outworks ?? []) if (o.kind === 'spikes' && o.lane === u.lane && u.x >= o.x0 && u.x <= o.x1) {
    u.spikeT -= dt; if (u.spikeT <= 0) { u.spikeT = 0.5; damage(s, null, u, o.dps * 0.5 * c0.power); }
  }
  // 레인 바꾸기: 성벽에 닿기 전이면 명령한 레인으로 비스듬히 옮긴다(옮기는 동안 공격 못 함)
  const want = s.squads[u.squad]?.orders.lane;
  if (u.shiftT > 0) {
    u.shiftT -= dt; u.x = Math.min(allyLimit(s, u), u.x + u.speed * 0.5 * dt);
    return;
  }
  if (want != null && want !== u.lane && u.x < c0.wallX - 60 && !(want === 2 && !c0.tunnel)) {
    u.fromLane = u.lane; u.shiftMax = u.shiftT = 1.0 * Math.abs(want - u.lane); u.lane = want;
    return;
  }
  u.atkT -= dt;
  const tgt = findAllyTarget(s, u);
  if (tgt) {
    if (u.atkT <= 0) {
      u.atkT = u.iv; u.lungeT = 0.15;
      const a = allyAtk(s, u);
      if (tgt.kind === 'unit') {
        s.emit({ t: 'attack', from: u, to: { x: tgt.u.x, lane: tgt.u.lane }, ranged: u.range > 60 });
        damage(s, u, tgt.u, a * (0.9 + s.rng() * 0.2));
      } else if (tgt.kind === 'tower') {
        s.emit({ t: 'attack', from: u, to: { x: tgt.t.x, lane: tgt.t.lane }, ranged: u.range > 60 });
        tgt.t.hp -= a * (u.role === 'siege' ? 2 : 1);
        s.emit({ t: 'hit', x: tgt.t.x, lane: tgt.t.lane, dmg: Math.round(a), ally: false });
        if (tgt.t.hp <= 0) { tgt.t.alive = false; s.emit({ t: 'towerBreak', x: tgt.t.x, lane: tgt.t.lane }); }
      } else if (tgt.kind === 'palisade') {
        const g = a * (u.role === 'siege' ? 3 : 1) * (gearOf(s, u.squad) === 'ram' ? 2 : 1);
        s.emit({ t: 'attack', from: u, to: { x: tgt.p.x, lane: tgt.p.lane }, ranged: u.range > 60 });
        tgt.p.hp -= g;
        s.emit({ t: 'hit', x: tgt.p.x, lane: tgt.p.lane, dmg: Math.round(g), ally: false });
        if (tgt.p.hp <= 0) { tgt.p.alive = false; s.emit({ t: 'palisadeBreak', x: tgt.p.x, lane: tgt.p.lane }); }
      } else {
        const g = a * (u.role === 'siege' ? 3 : 1) * (cmd.gateMul ?? 1) * (gearOf(s, u.squad) === 'ram' ? 2 : 1);
        s.emit({ t: 'attack', from: u, to: { x: s.castle.wallX, lane: 1 }, ranged: u.range > 60 });
        s.gateHp -= g;
        s.emit({ t: 'hit', x: s.castle.wallX, lane: 1, dmg: Math.round(g), ally: false, big: g >= 80 });
        if (s.gateHp <= 0) { s.gateHp = 0; s.emit({ t: 'gateBreak', x: s.castle.wallX }); }
      }
    }
    return;
  }
  // 이동(정지 명령이면 제자리에서 싸우기만)
  if (!s.squads[u.squad].orders.advance) return;
  const lim = allyLimit(s, u);
  let speed = u.speed;
  const c = s.castle;
  if (u.role !== 'flying' && (c.outworks ?? []).some((o) => o.kind === 'spikes' && o.lane === u.lane && u.x >= o.x0 && u.x <= o.x1)) speed *= 0.7;
  if (u.lane === 1 && c.moat && u.x > c.moat[0] && u.x < c.moat[1] && u.role !== 'flying' && !SWIMMERS.has(u.monId!) && !moatFree(s, u)) speed *= c.moatSlow ?? 0.6;
  // 성 안에서는 남은 적을 쫓아간다(방향 상관없이)
  if (inside(s, u)) {
    let near: Unit | null = null, nd = Infinity;
    for (const f of s.units) if (f.side === 'foe' && f.alive && inside(s, f)) { const d = Math.abs(f.x - u.x); if (d < nd) { nd = d; near = f; } }
    if (near) { const dir = near.x < u.x ? -1 : 1; u.x = Math.max(c.mergeX, Math.min(lim, u.x + dir * speed * dt)); return; }
  }
  if (u.x < lim) u.x = Math.min(lim, u.x + speed * dt);
  // 굴에서 경사로를 올라오면 땅 위(정문 레인)로 합류한다(경계에서 오락가락하지 않게)
  if (u.lane === 2 && u.x > c.wallX + TUNNEL_IN) u.lane = 1;
  // 성벽을 못 넘는 병력(비행 진입을 주던 부대장이 쓰러짐)은 정문 레인으로 내려간다
  if (u.lane === 0 && !canPassWall(s, u) && u.x >= lim - 1) u.lane = 1;
  // 굴 파기
  if (u.lane === 2 && !s.tunnelOpen && u.canDig && u.x >= lim - 1) {
    s.tunnelWork += dt * (cmd.digMul ?? 1);
    if (s.tunnelWork >= c.tunnelDig) { s.tunnelOpen = true; s.emit({ t: 'tunnelOpen', x: c.wallX }); }
  }
}

function stepFoe(s: SiegeState, u: Unit, dt: number) {
  if (u.stunT > 0) return;
  u.atkT -= dt;
  let best: Unit | null = null, bd = Infinity;
  for (const a of s.units) {
    if (a.side !== 'ally' || !a.alive) continue;
    // 성벽 위 궁수는 정문 레인도 쏜다
    const ok = sameField(s, u, a) || (u.lane === 0 && a.lane === 1 && u.range > 60);
    if (!ok) continue;
    const d = Math.abs(a.x - u.x);
    if (d < bd) { bd = d; best = a; }
  }
  if (!best) return;
  if (bd <= u.range) {
    u.aggro = true;
    if (u.atkT <= 0) {
      u.atkT = u.iv; u.lungeT = 0.15;
      s.emit({ t: 'attack', from: u, to: { x: best.x, lane: best.lane }, ranged: u.range > 60 });
      damage(s, u, best, u.atk * (0.9 + s.rng() * 0.2) * (u.foeType === 'archer' && best.role === 'flying' ? 1.5 : 1));
    }
    return;
  }
  // 자기 자리에서 LEASH 안쪽까지만 쫓아간다. 벗어나면 자리로 돌아간다
  const leash = u.core ? 320 : 150;
  const lim = foeLimit(s, u);
  if (bd <= 280 && Math.abs(best.x - u.homeX) <= leash + u.range) {
    u.aggro = true;
    const dir = best.x < u.x ? -1 : 1;
    u.x = Math.max(lim, Math.min(u.homeX + leash, Math.max(u.homeX - leash, u.x + dir * u.speed * dt)));
  } else if (Math.abs(u.x - u.homeX) > 4) {
    u.x += (u.homeX > u.x ? 1 : -1) * u.speed * dt;
  }
}

function stepTower(s: SiegeState, t: Tower, dt: number) {
  if (t.barrier) return;   // 결계 기둥은 공격하지 않는다
  t.atkT -= dt;
  if (t.atkT > 0) return;
  let best: Unit | null = null, bd = Infinity;
  for (const a of s.units) {
    if (a.side !== 'ally' || !a.alive || a.lane === 2) continue;
    const fly = a.role === 'flying';
    if (t.antiAir) {
      // 쇠뇌탑: 비행을 먼저(성 안까지), 없으면 성 밖 아군
      if (!fly && a.x > s.castle.wallX + 10) continue;
      const d = Math.abs(a.x - t.x) - (fly ? 1000 : 0);   // 비행 우선
      if (Math.abs(a.x - t.x) <= t.range && d < bd) { bd = d; best = a; }
      continue;
    }
    if (a.x > s.castle.wallX + 10) continue;   // 망루는 성 밖(접근하는 적)만 쏜다
    if (!t.splash && t.lane === 1 && a.lane !== 1) continue;   // 투석기는 땅 위 모든 레인
    const d = Math.abs(a.x - t.x);
    if (d <= t.range && d < bd) { bd = d; best = a; }
  }
  if (!best) return;
  t.atkT = t.iv;
  const miss = s.rng() < (cmdOf(s, best.squad).towerMiss ?? 0);
  s.emit({ t: 'tower', x: t.x, lane: t.lane, to: best, miss });
  const mult = (t.antiAir && best.role === 'flying' ? 2.5 : 1) * (gearOf(s, best.squad) === 'mantlet' ? 0.7 : 1) * (s.outpostCleared[t.lane] ? 0.7 : 1);
  if (!miss) {
    if (t.splash) {   // 투석기: 떨어진 자리 주변 같은 레인 아군 모두
      const hitX = best.x, hitLane = best.lane;
      for (const a of s.units) if (a.side === 'ally' && a.alive && a.lane === hitLane && Math.abs(a.x - hitX) <= t.splash) damage(s, null, a, t.dmg * mult);
    } else damage(s, null, best, t.dmg * mult);
  }
}

export function retreat(s: SiegeState, squad: number) {
  const sq = s.squads[squad];
  if (!sq || sq.retreated) return;
  sq.retreated = true;
  for (const u of s.units) if (u.side === 'ally' && u.squad === squad && u.alive) u.alive = false;
}

export function step(s: SiegeState, dt: number) {
  if (s.over) return;
  s.t += dt;
  s.cmdPts = Math.min(CMD_MAX, s.cmdPts + CMD_RATE * dt);
  for (const u of s.units) {
    u.hitT = Math.max(0, u.hitT - dt); u.lungeT = Math.max(0, u.lungeT - dt);
    u.stunT = Math.max(0, u.stunT - dt); u.vulnT = Math.max(0, u.vulnT - dt);
    if (!u.alive) continue;
    if (u.side === 'ally') stepAlly(s, u, dt); else stepFoe(s, u, dt);
  }
  for (const t of s.towers) if (t.alive) stepTower(s, t, dt);
  for (const q of s.squads) { q.skillCd = Math.max(0, q.skillCd - dt); q.shieldT = Math.max(0, q.shieldT - dt); }
  for (const L of [0, 1, 2] as Lane[]) {
    if (s.outpostCleared[L]) continue;
    const posts = s.units.filter((u) => u.outpost && u.lane === L);
    if (posts.length && posts.every((u) => !u.alive)) { s.outpostCleared[L] = true; s.emit({ t: 'outpost', lane: L }); }
  }
  for (let i = s.timers.length - 1; i >= 0; i--) if (s.t >= s.timers[i].at) { const tm = s.timers.splice(i, 1)[0]; tm.fn(); }

  // 핵심 지점 점거
  const c = s.castle;
  const holders = s.units.filter((u) => u.side === 'ally' && u.alive && Math.abs(u.x - c.coreX) <= 70);
  const defenders = s.units.filter((u) => u.side === 'foe' && u.alive && inside(s, u) && Math.abs(u.x - c.coreX) <= 240);
  if (holders.length && !defenders.length) s.coreProg += dt;

  if (s.coreProg >= c.holdSec) return finish(s, true, '핵심 지점 점령');
  const allStarted = s.squads.every((q) => q.started);
  if (allStarted && !s.units.some((u) => u.side === 'ally' && u.alive)) return finish(s, false, '부대 전멸');
  if (s.t >= c.timeLimit) return finish(s, false, '시간 초과');
}

function finish(s: SiegeState, win: boolean, reason: string) {
  s.over = { win, reason };
  s.emit({ t: 'end', win, reason });
}

/** 별 평가: ★1 점령, ★2 부대장 전원 생존, ★3 120초 안에 */
export function stars(s: SiegeState): number {
  if (!s.over?.win) return 0;
  let n = 1;
  if (s.stats.leadersLost === 0) n++;
  if (s.t <= 120) n++;
  return n;
}

// ---------------- 부대 명령과 부대장 스킬 ----------------

export function setOrders(s: SiegeState, squad: number, patch: Partial<Orders>) {
  const q = s.squads[squad];
  if (!q) return;
  if (patch.lane != null && patch.lane === 2 && !s.castle.tunnel) return;
  Object.assign(q.orders, patch);
  if (patch.lane != null) q.plan.lane = patch.lane;
}

export function canCast(s: SiegeState, squad: number) {
  const q = s.squads[squad];
  return !!q && !!q.skill && q.started && !q.retreated && !!q.leader?.alive && q.skillCd <= 0 && !s.over;
}

const later = (s: SiegeState, delay: number, fn: () => void) => s.timers.push({ at: s.t + delay, fn });
const foesNear = (s: SiegeState, x: number, lane: Lane, r: number, anyLane = false) =>
  s.units.filter((f) => f.side === 'foe' && f.alive && Math.abs(f.x - x) <= r && (anyLane || f.lane === lane || (inside(s, f) && x > s.castle.mergeX)));

function hitTowers(s: SiegeState, x: number, r: number, dmg: number) {
  for (const t of s.towers) if (t.alive && Math.abs(t.x - x) <= r) {
    t.hp -= dmg; s.emit({ t: 'hit', x: t.x, lane: t.lane, dmg: Math.round(dmg), ally: false, big: true });
    if (t.hp <= 0) { t.alive = false; s.emit({ t: 'towerBreak', x: t.x, lane: t.lane }); }
  }
}
function hitGate(s: SiegeState, dmg: number) {
  if (s.gateHp <= 0) return;
  s.gateHp -= dmg; s.emit({ t: 'hit', x: s.castle.wallX, lane: 1, dmg: Math.round(dmg), ally: false, big: true });
  if (s.gateHp <= 0) { s.gateHp = 0; s.emit({ t: 'gateBreak', x: s.castle.wallX }); }
}

/** 부대장 스킬 사용. 성공하면 true */
export function cast(s: SiegeState, squad: number): boolean {
  if (!canCast(s, squad)) return false;
  const q = s.squads[squad], L = q.leader!, sk = q.skill!;
  q.skillCd = sk.cd;
  const atk = L.atk * (cmdOf(s, squad).atkMul ?? 1);
  const lane = L.lane, x = L.x;
  const nearGate = lane === 1 && s.gateHp > 0 && s.castle.wallX - x <= 120;
  s.emit({ t: 'skill', squad, leader: L, skill: sk, x, y: 0, lane });
  switch (sk.kind) {
    case 'slam':
      for (const f of foesNear(s, x, lane, 110)) { damage(s, L, f, atk * 3); f.stunT = 2; }
      if (nearGate) hitGate(s, atk * 12);
      s.emit({ t: 'skillHit', kind: 'slam', x, lane, r: 110 });
      break;
    case 'raise':
      for (let i = 0; i < 2; i++) {
        const u = allyUnit('skeleton', squad, lane, x - 20 - i * 10, false, cmdOf(s, squad));
        s.units.push(u); s.emit({ t: 'revive', u });
      }
      break;
    case 'charm':
      for (const f of foesNear(s, x, lane, 170)) { f.stunT = 3; f.vulnT = 6; f.vulnMul = 1.3; }
      s.emit({ t: 'skillHit', kind: 'charm', x, lane, r: 170 });
      break;
    case 'swarm':
      for (let i = 0; i < 3; i++) later(s, i * 0.35, () => {
        for (const f of foesNear(s, x, lane, 150, true)) damage(s, L, f, atk * 1.1);
        hitTowers(s, x, 180, atk * 1.2);
        s.emit({ t: 'skillHit', kind: 'swarm', x, lane, r: 150 });
      });
      break;
    case 'charge': {
      const lim = allyLimit(s, L), to = Math.min(lim, x + 160);
      for (const f of s.units) if (f.side === 'foe' && f.alive && (f.lane === lane || inside(s, f)) && f.x >= x - 10 && f.x <= to + 30) { damage(s, L, f, atk * 3); f.stunT = 1; }
      L.x = to;
      if (lane === 1 && s.gateHp > 0 && s.castle.wallX - to <= 40) hitGate(s, atk * 10);
      s.emit({ t: 'skillHit', kind: 'charge', x: to, lane });
      break;
    }
    case 'aegis':
      q.shieldT = 5;
      s.emit({ t: 'skillHit', kind: 'aegis', x, lane, r: 90 });
      break;
    case 'hex': {
      const foes = s.units.filter((f) => f.side === 'foe' && f.alive && Math.abs(f.x - x) <= 260);
      const c = foes.length ? foes.reduce((a, b) => (foesNear(s, a.x, a.lane, 90, true).length >= foesNear(s, b.x, b.lane, 90, true).length ? a : b)) : null;
      if (!c) break;
      for (const f of foesNear(s, c.x, c.lane, 100, true)) { damage(s, L, f, atk * 1.5); f.vulnT = 6; f.vulnMul = 1.4; }
      s.emit({ t: 'skillHit', kind: 'hex', x: c.x, lane: c.lane, r: 100 });
      break;
    }
    case 'feast':
      for (const f of foesNear(s, x, lane, 120)) damage(s, L, f, atk * 2);
      for (const u of s.units) if (u.side === 'ally' && u.alive && u.squad === squad) u.hp = Math.min(u.max, u.hp + u.max * 0.3);
      s.emit({ t: 'skillHit', kind: 'feast', x, lane, r: 120 });
      break;
    case 'breath':
      for (const f of s.units) if (f.side === 'foe' && f.alive && f.x >= x && f.x <= x + 300) damage(s, L, f, atk * 3);
      hitTowers(s, x + 150, 160, atk * 4);
      s.emit({ t: 'skillHit', kind: 'breath', x, lane, r: 300 });
      break;
    case 'hellfire':
      hitGate(s, atk * 8);
      hitTowers(s, s.castle.wallX, 400, atk * 5);
      s.emit({ t: 'skillHit', kind: 'hellfire', x: s.castle.wallX, lane: 1, r: 140 });
      break;
    case 'song':
      for (const f of s.units) if (f.side === 'foe' && f.alive && Math.abs(f.x - x) <= 280) f.stunT = 4;
      s.emit({ t: 'skillHit', kind: 'song', x, lane, r: 280 });
      break;
    case 'doom':
      for (const f of s.units) if (f.side === 'foe' && f.alive && Math.abs(f.x - x) <= 600) damage(s, L, f, atk * 4);
      hitTowers(s, x, 600, atk * 5); if (s.castle.wallX - x <= 600) hitGate(s, atk * 6);
      s.emit({ t: 'skillHit', kind: 'doom', x, lane, r: 600 });
      break;
  }
  return true;
}

/** 시뮬레이션·자동 진행용: 스킬을 쓸 만한 때 쓴다 */
export function autoCast(s: SiegeState) {
  for (const q of s.squads) {
    if (!canCast(s, q.idx)) continue;
    const L = q.leader!;
    const near = s.units.filter((f) => f.side === 'foe' && f.alive && Math.abs(f.x - L.x) <= 180).length;
    const gate = L.lane === 1 && s.gateHp > 0 && s.castle.wallX - L.x <= 120;
    const towers = s.towers.some((t) => t.alive && Math.abs(t.x - L.x) <= 300);
    const hurt = s.units.filter((u) => u.side === 'ally' && u.alive && u.squad === q.idx && u.hp < u.max * 0.6).length >= 2;
    const k = q.skill!.kind;
    if ((k === 'aegis' || k === 'feast') ? hurt || near >= 3 : k === 'hellfire' ? gate || towers : near >= 2 || (gate && (k === 'slam' || k === 'charge')) || (towers && (k === 'swarm' || k === 'breath' || k === 'doom'))) cast(s, q.idx);
  }
}
