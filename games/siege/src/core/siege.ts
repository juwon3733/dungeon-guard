// 공성전 엔진(규칙만). 화면과 분리되어 tools/sim.ts에서 그대로 돌린다.
// 계획: docs/siege/03_siege.md. 횡스크롤 3레인, 부대 = 부대장 + 병력, 부대장이 살아 있을 때만 지휘 효과.
import { MON, GRADES, ROLES, SWIMMERS, type Command, type Role } from '../data/monsters';
import { FOES, type Castle, type Lane, type FoeType } from '../data/castles';

export interface SquadPlan {
  leader: string;                              // 몬스터 id (희귀 이상)
  troops: { id: string; count: number }[];     // 일반·희귀
  lane: Lane;
  delay: number;                               // 출발 지연(초)
}

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
}

export interface Tower { lane: Lane; x: number; hp: number; max: number; dmg: number; range: number; iv: number; atkT: number; alive: boolean }

export interface Squad { idx: number; plan: SquadPlan; leader: Unit | null; started: boolean; retreated: boolean }

export type SiegeEvent =
  | { t: 'attack'; from: Unit; to: { x: number; lane: Lane }; ranged: boolean }
  | { t: 'hit'; x: number; lane: Lane; dmg: number; ally: boolean; big?: boolean }
  | { t: 'die'; u: Unit }
  | { t: 'revive'; u: Unit }
  | { t: 'tower'; x: number; lane: Lane; to: Unit; miss: boolean }
  | { t: 'gateBreak'; x: number }
  | { t: 'towerBreak'; x: number; lane: Lane }
  | { t: 'tunnelOpen'; x: number }
  | { t: 'leaderDown'; u: Unit }
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

function allyUnit(monId: string, squad: number, lane: Lane, x: number, isLeader: boolean, cmd: Command): Unit {
  const m = MON[monId], g = GRADES[m.grade], r = ROLES[m.role];
  let hp = g.hp * r.hp * (isLeader ? 2 : 1);
  if (cmd.hpMulRole && cmd.hpMulRole.role === m.role) hp *= cmd.hpMulRole.mul;
  let range = r.range;
  if (m.role === 'ranged' && cmd.rangeMul) range *= cmd.rangeMul;
  return {
    uid: UID++, side: 'ally', name: m.name, monId, squad, isLeader, role: m.role, grade: m.grade, lane, x,
    hp, max: hp, atk: g.atk * r.atk, range, iv: r.iv, speed: 40 * r.speed * (cmd.speedMul ?? 1),
    atkT: 0.3, alive: true, hitT: 0, firstHit: true, revived: false, canDig: !!m.canDig, core: false, aggro: true, lungeT: 0, homeX: x,
  };
}

function foeUnit(type: FoeType, lane: Lane, x: number, core: boolean, pw: number): Unit {
  const f = FOES[type];
  return {
    uid: UID++, side: 'foe', name: f.name, foeType: type, squad: -1, isLeader: type === 'captain', role: 'foe', lane, x,
    hp: f.hp * pw, max: f.hp * pw, atk: f.atk * pw, range: f.range, iv: f.iv, speed: f.speed,
    atkT: 0.5, alive: true, hitT: 0, firstHit: false, revived: false, canDig: false, core, aggro: false, lungeT: 0, homeX: x,
  };
}

export function createSiege(castle: Castle, plans: SquadPlan[], opts: { seed?: number; emit?: (e: SiegeEvent) => void; noCommand?: boolean } = {}): SiegeState {
  const rng = opts.seed != null ? mulberry(opts.seed) : Math.random;
  const s: SiegeState = {
    castle, t: 0, units: [], squads: [], towers: castle.towers.map((t) => ({ ...t, hp: t.hp * castle.power, max: t.hp * castle.power, dmg: t.dmg * castle.power, atkT: 1, alive: true })),
    gateHp: castle.gateHp * castle.power, gateMax: castle.gateHp * castle.power, tunnelWork: 0, tunnelOpen: false, coreProg: 0, over: null,
    rng, emit: opts.emit ?? (() => {}), stats: { allyDead: 0, foeDead: 0, leadersLost: 0 }, noCommand: !!opts.noCommand,
  };
  plans.forEach((p, i) => s.squads.push({ idx: i, plan: p, leader: null, started: false, retreated: false }));
  for (const g of castle.garrison) {
    for (let i = 0; i < g.count; i++) {
      const lane: Lane = g.lane === 'core' ? 1 : g.lane;
      s.units.push(foeUnit(g.type, lane, g.x + i * 18, g.lane === 'core', castle.power));
    }
  }
  return s;
}

function spawnSquad(s: SiegeState, sq: Squad) {
  sq.started = true;
  const cmd = s.noCommand ? NOCMD : (MON[sq.plan.leader].command ?? NOCMD);
  const lane = sq.plan.lane;
  const leader = allyUnit(sq.plan.leader, sq.idx, lane, 40, true, cmd);
  sq.leader = leader;
  s.units.push(leader);
  let k = 0;
  const cap = troopCap(sq.plan.leader);
  for (const t of sq.plan.troops) {
    for (let i = 0; i < t.count && k < cap; i++, k++) s.units.push(allyUnit(t.id, sq.idx, lane, 70 + (k % 4) * 16 - Math.floor(k / 4) * 14, false, cmd));
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
  return u.role === 'flying' || !!cmdOf(s, u.squad).wallPass;
}

/** 아군 유닛이 이 레인에서 갈 수 있는 가장 먼 x */
function allyLimit(s: SiegeState, u: Unit): number {
  const c = s.castle;
  if (u.x > c.wallX) return c.coreX + 20;   // 성 안: 핵심 지점에서 멈춰 점거
  if (u.lane === 0 && !canPassWall(s, u)) return c.wallX - 24;
  if (u.lane === 1 && s.gateHp > 0) return c.wallX - 24;
  if (u.lane === 2 && !s.tunnelOpen) return c.wallX - 24;
  return c.coreX + 20;
}

/** 적 유닛이 나올 수 있는 가장 왼쪽 x */
function foeLimit(s: SiegeState, u: Unit): number {
  const c = s.castle;
  if (u.core) return c.mergeX;
  if (u.lane === 1 && s.gateHp <= 0) return c.wallX - 260;
  if (u.lane === 2 && s.tunnelOpen) return c.wallX - 180;
  return c.wallX + 10;
}

function damage(s: SiegeState, src: Unit | null, tgt: Unit, raw: number) {
  if (!tgt.alive) return;
  let dmg = raw;
  if (tgt.side === 'ally') dmg *= cmdOf(s, tgt.squad).dmgTakenMul ?? 1;
  dmg = Math.max(1, Math.round(dmg));
  tgt.hp -= dmg; tgt.hitT = 0.12;
  s.emit({ t: 'hit', x: tgt.x, lane: tgt.lane, dmg, ally: tgt.side === 'ally', big: dmg >= 60 });
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

function allyAtk(s: SiegeState, u: Unit): number {
  const cmd = cmdOf(s, u.squad);
  let a = u.atk * (cmd.atkMul ?? 1);
  if (cmd.atkMulRole && cmd.atkMulRole.role === u.role) a *= cmd.atkMulRole.mul;
  if (s.gateHp <= 0 && cmd.afterGateAtkMul) a *= cmd.afterGateAtkMul;
  if (u.firstHit) { a *= cmd.firstHitMul ?? 1; u.firstHit = false; }
  return a;
}

type Target = { kind: 'unit'; u: Unit } | { kind: 'tower'; t: Tower } | { kind: 'gate' };

function findAllyTarget(s: SiegeState, u: Unit): Target | null {
  let best: Target | null = null, bd = Infinity;
  const ranged = u.range > 60;
  for (const f of s.units) {
    if (f.side !== 'foe' || !f.alive) continue;
    // 사격은 성벽 위(레인 0) 적도 쏠 수 있다
    const ok = sameField(s, u, f) || (ranged && u.lane === 1 && f.lane === 0);
    if (!ok) continue;
    const d = Math.abs(f.x - u.x);
    // 성 밖에서는 앞쪽 적만, 성 안에서는 방향 상관없이(지나친 적에게 뒤를 잡히지 않게)
    const facing = inside(s, u) || f.x >= u.x - 10;
    if (facing && d <= u.range && d < bd) { bd = d; best = { kind: 'unit', u: f }; }
  }
  if (best) return best;
  for (const t of s.towers) {
    if (!t.alive) continue;
    const ok = t.lane === u.lane || (ranged && u.lane === 1 && t.lane === 0) || (inside(s, u));
    const d = Math.abs(t.x - u.x);
    if (ok && d <= u.range + 10 && d < bd) { bd = d; best = { kind: 'tower', t }; }
  }
  if (best) return best;
  // 성문은 근접·공성만 친다(사격은 앞으로 나가 망루와 성벽 궁수를 노린다)
  const atGate = s.castle.wallX - u.x <= 30;   // 사격도 성문 바로 앞까지 오면 성문을 친다
  if (u.lane === 1 && s.gateHp > 0 && (u.range <= 60 || u.role === 'siege' || atGate) && u.x < s.castle.wallX && s.castle.wallX - u.x <= u.range + 26) return { kind: 'gate' };
  return null;
}

function stepAlly(s: SiegeState, u: Unit, dt: number) {
  const cmd = cmdOf(s, u.squad);
  if (cmd.regen) u.hp = Math.min(u.max, u.hp + u.max * cmd.regen * dt);
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
      } else {
        const g = a * (u.role === 'siege' ? 3 : 1) * (cmd.gateMul ?? 1);
        s.emit({ t: 'attack', from: u, to: { x: s.castle.wallX, lane: 1 }, ranged: u.range > 60 });
        s.gateHp -= g;
        s.emit({ t: 'hit', x: s.castle.wallX, lane: 1, dmg: Math.round(g), ally: false, big: g >= 80 });
        if (s.gateHp <= 0) { s.gateHp = 0; s.emit({ t: 'gateBreak', x: s.castle.wallX }); }
      }
    }
    return;
  }
  // 이동
  const lim = allyLimit(s, u);
  let speed = u.speed;
  const c = s.castle;
  if (u.lane === 1 && c.moat && u.x > c.moat[0] && u.x < c.moat[1] && u.role !== 'flying' && !SWIMMERS.has(u.monId!)) speed *= 0.6;
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
      damage(s, u, best, u.atk * (0.9 + s.rng() * 0.2));
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
  t.atkT -= dt;
  if (t.atkT > 0) return;
  let best: Unit | null = null, bd = Infinity;
  for (const a of s.units) {
    if (a.side !== 'ally' || !a.alive || a.lane === 2) continue;
    if (a.x > s.castle.wallX + 10) continue;   // 망루는 성 밖(접근하는 적)만 쏜다
    if (t.lane === 1 && a.lane !== 1) continue;
    const d = Math.abs(a.x - t.x);
    if (d <= t.range && d < bd) { bd = d; best = a; }
  }
  if (!best) return;
  t.atkT = t.iv;
  const miss = s.rng() < (cmdOf(s, best.squad).towerMiss ?? 0);
  s.emit({ t: 'tower', x: t.x, lane: t.lane, to: best, miss });
  if (!miss) damage(s, null, best, t.dmg);
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
  for (const sq of s.squads) if (!sq.started && s.t >= sq.plan.delay) spawnSquad(s, sq);
  for (const u of s.units) {
    u.hitT = Math.max(0, u.hitT - dt); u.lungeT = Math.max(0, u.lungeT - dt);
    if (!u.alive) continue;
    if (u.side === 'ally') stepAlly(s, u, dt); else stepFoe(s, u, dt);
  }
  for (const t of s.towers) if (t.alive) stepTower(s, t, dt);

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
