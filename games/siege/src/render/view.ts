// 공성전 화면(Canvas): Asteria처럼 위에서 비스듬히 내려다보는 3/4 시점. 왼쪽(아군 진영) → 오른쪽(성)으로 진군.
// 땅은 화면 전체, 높이가 있는 물체는 윗면과 앞(남쪽)면이 보이게 그린다.
// 규칙은 core/siege.ts. 레인은 위아래로 나란한 띠: 0=북쪽 성벽 구간, 1=가운데 정문 길, 2=남쪽 굴.
import type { SiegeState, SiegeEvent, Unit } from '../core/siege';
import { TUNNEL_IN } from '../core/siege';
import { GRADES, ROLES, MON, type Role } from '../data/monsters';

export const VW = 1280, VH = 720;
/** 부대 색: 발밑 표시, 부대장 이름표, 패널에 같은 색을 쓴다 */
export const SQUAD_COL = ['#ff6b6b', '#4fd1ff', '#ffd166', '#7dff9a'];

// ---- 그림(있으면 쓰고, 없으면 도형) ----
// public/assets/monsters/<id>/sheet.png: 4×2 칸 시트(오른쪽을 보는 3/4 시점). 칸 순서:
// 0 서기, 1 걷기1, 2 걷기2, 3 공격, 4 스킬, 5 피격, 6 쓰러짐, 7 승리 (docs/siege/05_art_gpt.md)
const SHEETS: Record<string, HTMLImageElement | null> = {};
function sheetOf(id: string): HTMLImageElement | null {
  if (!(id in SHEETS)) {
    SHEETS[id] = null;
    if (typeof Image !== 'undefined') {
      const im = new Image();
      im.onload = () => { SHEETS[id] = im; };
      im.src = `assets/monsters/${id}/sheet.png`;
    }
  }
  return SHEETS[id];
}
const LANE_CY = [250, 390, 530];          // 레인 띠의 가운데(땅 위 y)
const LANE_H = 120;
const YARD_CY = 390, YARD_H = 360;        // 성 안뜰
const GROUND_TOP = 150, GROUND_BOT = 620; // 떠 있는 땅의 윗면 범위, 그 아래는 절벽 단면
const WALL_H = 70, TOWER_H = 100, KEEP_H = 120;
const ROLE_COL: Record<Role | 'foe', string> = {
  assault: '#e8623c', shield: '#8aa0b8', ranged: '#ffcc4d', siege: '#b07a4a', flying: '#9d7bff', support: '#5fd3a0', foe: '#c9d2ff',
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number }
interface Txt { x: number; y: number; str: string; col: string; life: number; size: number }
interface Fx { age: number; dur: number; draw: (c: CanvasRenderingContext2D, p: number) => void }

const jitter = (uid: number) => (((uid * 2654435761) >>> 0) % 1000) / 500 - 1;
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export class SiegeView {
  ctx: CanvasRenderingContext2D;
  camX = 0;
  parts: Particle[] = [];
  texts: Txt[] = [];
  fx: Fx[] = [];
  shake = 0;
  flash = 0;
  t = 0;
  follow = true;
  bannerQ: { str: string; col: string; t: number }[] = [];
  /** 부대장 스킬 컷인. 이게 있는 동안 전투를 멈춘다 */
  cutin: null | {
    uid: number; lx: number; ly: number; name: string; skill: string; kind: string; grade: string;
    t: number; dur: number; release: number; released: boolean; pending: SiegeEvent[];
  } = null;

  constructor(public canvas: HTMLCanvasElement, public s: SiegeState) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** 땅 위의 발 위치. 성 안에 들어오면 안뜰로 퍼진다 */
  pos(u: { x: number; lane: number; uid?: number; shiftT?: number; shiftMax?: number; fromLane?: number }) {
    const c = this.s.castle;
    const j = u.uid != null ? jitter(u.uid) : 0;
    let laneY = LANE_CY[u.lane] + j * (LANE_H * (u.lane === 2 ? 0.08 : 0.3));
    if (u.shiftT && u.shiftT > 0 && u.fromLane != null) {   // 레인을 옮기는 중: 이전 레인에서 비스듬히
      const k = 1 - u.shiftT / (u.shiftMax || 1);
      const from = LANE_CY[u.fromLane] + j * (LANE_H * 0.3);
      laneY = from + (laneY - from) * k;
    }
    const enter = u.lane === 2 ? c.wallX + TUNNEL_IN : c.wallX + 30;
    if (u.x <= enter) return { x: u.x, y: laneY };
    const k = Math.min(1, (u.x - enter) / 120);
    const yardY = YARD_CY + j * (YARD_H * 0.36);
    return { x: u.x, y: laneY + (yardY - laneY) * k };
  }
  laneY(lane: number) { return LANE_CY[lane]; }
  towerBase(lane: number, t?: { x: number; barrier?: boolean; splash?: number }) { return t?.barrier ? YARD_CY - 60 : t?.splash ? LANE_CY[lane] - LANE_H / 2 + 20 : lane === 0 ? LANE_CY[0] - 10 : LANE_CY[1] - 70; }
  banner(str: string, col: string) { this.bannerQ.push({ str, col, t: 0 }); }

  onEvent(e: SiegeEvent) {
    // 연출 중에 생긴 일(스킬 효과, 피해 숫자)은 모아 두었다가 터뜨리는 순간에 보여 준다
    if (this.cutin && !this.cutin.released && e.t !== 'skill') { this.cutin.pending.push(e); return; }
    const R = Math.random;
    switch (e.t) {
      case 'hit': {
        const y = this.laneY(e.lane) - 40;
        this.texts.push({ x: e.x + (R() - 0.5) * 20, y: y + (R() - 0.5) * 30, str: String(e.dmg), col: e.ally ? '#ff7a7a' : e.big ? '#ffd166' : '#ffffff', life: 0.8, size: e.big ? 22 : 14 });
        if (e.big) this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'attack': {
        const f = e.from, a = this.pos(f);
        const tx = e.to.x, ty = this.laneY(e.to.lane) - 18 + (R() - 0.5) * 30;
        if (e.ranged) {
          const col = f.side === 'ally' ? '#ffd166' : '#aac4ff';
          const ay = a.y - 22;
          this.fx.push({ age: 0, dur: 0.25, draw: (c, p) => {
            const x = a.x + (tx - a.x) * p, y = ay + (ty - ay) * p - Math.sin(p * Math.PI) * 30;
            c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 7, y + 2); c.lineTo(x, y); c.stroke();
          } });
        } else {
          this.burst(tx, a.y - 18, 3, f.side === 'ally' ? '#fff1b0' : '#ffb0b0', 90, 3, 0.25);
        }
        break;
      }
      case 'tower': {
        const tx = e.x, ty = this.towerBase(e.lane) - TOWER_H, to = this.pos(e.to);
        this.fx.push({ age: 0, dur: 0.32, draw: (c, p) => {
          c.strokeStyle = e.miss ? 'rgba(200,200,200,.5)' : '#ff9f43'; c.lineWidth = 3;
          const x = tx + (to.x - tx) * p, y = ty + (to.y - 20 - ty) * p - Math.sin(p * Math.PI) * 40;
          c.beginPath(); c.moveTo(x + 8, y - 2); c.lineTo(x - 4, y); c.stroke();
        } });
        if (e.miss) this.texts.push({ x: to.x, y: to.y - 50, str: '빗나감', col: '#9fe0a0', life: 0.7, size: 13 });
        break;
      }
      case 'die': { const p = this.pos(e.u); this.burst(p.x, p.y - 16, e.u.isLeader ? 30 : 10, e.u.side === 'ally' ? '#c08aff' : '#ffe08a', 160, 4, 0.6); break; }
      case 'revive': {
        const p = this.pos(e.u);
        this.burst(p.x, p.y - 16, 18, '#7dffb2', 120, 4, 0.8);
        this.texts.push({ x: p.x, y: p.y - 56, str: '부활', col: '#7dffb2', life: 1, size: 16 });
        break;
      }
      case 'gateBreak':
        this.shake = 16; this.flash = 0.6;
        this.burst(e.x, LANE_CY[1] - 30, 70, '#c9a477', 320, 6, 1.1);
        this.banner('성문 파괴!', '#ffd166');
        break;
      case 'towerBreak':
        this.shake = 10;
        this.burst(e.x, this.towerBase(e.lane) - TOWER_H / 2, 50, '#d9c7a0', 260, 5, 0.9);
        this.banner('망루 붕괴', '#ffffff');
        break;
      case 'tunnelOpen':
        this.shake = 8;
        this.burst(this.s.castle.wallX + TUNNEL_IN, LANE_CY[2], 40, '#8b6a45', 200, 5, 0.9);
        this.banner('굴이 뚫렸다', '#c9a477');
        break;
      case 'skill': {
        const g = MON[e.leader.monId!].grade;
        const p = this.pos(e.leader);
        const [dur, release] = g === 'myth' ? [2.0, 1.35] : g === 'legend' ? [1.45, 0.9] : [0.95, 0.55];
        this.cutin = { uid: e.leader.uid, lx: p.x, ly: p.y, name: e.leader.name, skill: e.skill.name, kind: e.skill.kind, grade: g,
          t: 0, dur, release, released: false, pending: [] };
        break;
      }
      case 'skillHit': this.skillFx(e.kind, e.x, this.laneY(e.lane), e.r ?? 100); break;
      case 'palisadeBreak':
        this.shake = 8; this.burst(e.x, LANE_CY[e.lane] - 20, 40, '#a07448', 240, 5, 0.9);
        this.banner('목책 돌파', '#e0b77f');
        break;
      case 'outpost':
        this.banner(`외곽 초소 정리 — ${['성벽', '정문', '지하'][e.lane]} 레인 망루 피해 -30%`, '#7dff9a');
        break;
      case 'leaderDown':
        this.banner(`${e.u.name} 쓰러짐 — 지휘 효과 사라짐`, '#ff7a7a');
        break;
    }
  }

  burst(x: number, y: number, n: number, col: string, speed: number, size: number, life: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = (0.3 + Math.random() * 0.7) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.6 + Math.random() * 0.4), max: life, col, size });
    }
  }

  /** 컷인 시간만 진행. 컷인이 끝나면 false */
  updateCutin(dt: number) {
    const ci = this.cutin;
    if (!ci) return false;
    ci.t += dt;
    this.t += dt;
    if (!ci.released) {
      // 준비 동작: 부대장 발밑으로 등급 색 기운이 모여든다
      const col = GRADES[ci.grade as keyof typeof GRADES].color;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.283, r = 60 + Math.random() * 50;
        this.parts.push({ x: ci.lx + Math.cos(a) * r, y: ci.ly - 20 + Math.sin(a) * r * 0.5, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 1.1, life: 0.4, max: 0.4, col, size: 4 });
      }
      if (ci.t >= ci.release) {
        ci.released = true;
        this.shake = ci.grade === 'hero' ? 12 : 20; this.flash = ci.grade === 'myth' ? 0.7 : 0.3;
        const ev = ci.pending; ci.pending = [];
        for (const e of ev) this.onEvent(e);
      }
    }
    this.updateFx(dt);
    if (ci.t >= ci.dur) { this.cutin = null; return false; }
    return true;
  }

  /** 연출 진행 정도(0~1): 다가가기 → 준비 → 터뜨리며 빠지기 */
  focusAmount() {
    const ci = this.cutin;
    if (!ci) return 0;
    if (ci.t < ci.release) return Math.min(1, ci.t / 0.25);
    return Math.max(0, 1 - (ci.t - ci.release) / 0.22);
  }

  update(dt: number) {
    this.t += dt;
    this.updateFx(dt);
    if (this.bannerQ[0]) { this.bannerQ[0].t += dt; if (this.bannerQ[0].t > 1.6) this.bannerQ.shift(); }
    if (this.follow) {
      const allies = this.s.units.filter((u) => u.side === 'ally' && u.alive);
      const front = allies.length ? Math.max(...allies.map((u) => u.x)) : 0;
      const want = Math.max(0, Math.min(this.s.castle.length + 160 - VW, front - VW * 0.55));
      this.camX += (want - this.camX) * Math.min(1, dt * 2.5);
    }
  }

  updateFx(dt: number) {
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.dur);
    for (const p of this.parts) { p.life -= dt; p.vx *= 0.92; p.vy *= 0.92; p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const x of this.texts) { x.life -= dt; x.y -= 26 * dt; }
    this.texts = this.texts.filter((x) => x.life > 0);
    this.shake = Math.max(0, this.shake - 40 * dt);
    this.flash = Math.max(0, this.flash - 2 * dt);
  }

  draw() {
    const c = this.ctx, s = this.s, k = s.castle;
    const scale = this.canvas.width / VW;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.fillStyle = '#4a6b3a'; c.fillRect(0, 0, VW, VH);
    c.save();
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const f = this.focusAmount(), ci = this.cutin;
    if (ci && f > 0) {
      // 부대장을 화면 가운데로 당기며 확대(영웅 1.6배, 전설 1.8배, 신화 2배)
      const zMax = ci.grade === 'myth' ? 2 : ci.grade === 'legend' ? 1.8 : 1.6;
      const e = f * f * (3 - 2 * f), z = 1 + (zMax - 1) * e;
      const tx = (ci.lx - this.camX) + (VW / 2 - (ci.lx - this.camX)) * e, ty = ci.ly + (VH * 0.58 - ci.ly) * e;
      c.translate(tx + sx, ty + sy); c.scale(z, z); c.translate(-ci.lx, -ci.ly);
    } else {
      c.translate(-this.camX + sx, sy);
    }
    this.drawIsland(c);
    this.drawFloor(c);

    // 높이가 있는 것(유닛, 망루, 성벽 조각, 본관)은 발 위치 y 순서로 그린다
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const u of s.units) if (u.alive || u.hitT > 0) { const p = this.pos(u); items.push({ y: p.y, draw: () => this.drawUnit(c, u, p.x, p.y) }); }
    this.wallItems(items);
    for (const d of this.decor()) items.push({ y: d.y, draw: () => this.drawDecor(c, d) });
    for (const p of s.palisades) items.push({ y: LANE_CY[p.lane] + LANE_H / 2 - 12, draw: () => this.drawPalisade(c, p) });
    for (const L of [0, 1, 2]) {   // 외곽 초소 깃발
      const post = s.units.filter((u) => u.outpost && u.lane === L);
      if (!post.length) continue;
      const x = Math.min(...post.map((u) => u.homeX)) - 30, y = LANE_CY[L] - LANE_H / 2 + 16;
      items.push({ y, draw: () => this.drawOutpostFlag(c, x, y, !!s.outpostCleared[L]) });
    }
    for (const t of s.towers) { const by = this.towerBase(t.lane, t); items.push({ y: by + 1, draw: () => this.drawTower(c, t, by) }); }
    items.push({ y: YARD_CY + 110, draw: () => this.drawKeep(c) });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

    for (const f of this.fx) { c.save(); f.draw(c, Math.min(1, f.age / f.dur)); c.restore(); }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    c.restore();
    c.textAlign = 'center';
    for (const x of this.texts) {
      c.globalAlpha = Math.min(1, x.life * 2); c.font = `bold ${x.size}px sans-serif`;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(x.str, x.x, x.y); c.fillStyle = x.col; c.fillText(x.str, x.x, x.y);
    }
    c.globalAlpha = 1;
    c.restore();
    void k;
    if (ci && f > 0) this.drawFocus(c, f);
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, VW, VH); }
    const b = this.bannerQ[0];
    if (b) {
      const a = Math.min(1, b.t * 5) * (b.t > 1.2 ? Math.max(0, 1 - (b.t - 1.2) / 0.4) : 1);
      c.globalAlpha = a; c.textAlign = 'center'; c.font = 'italic 900 40px sans-serif';
      c.lineWidth = 7; c.strokeStyle = '#140f1f'; c.strokeText(b.str, VW / 2, 70); c.fillStyle = b.col; c.fillText(b.str, VW / 2, 70);
      c.globalAlpha = 1;
    }
  }

  /** 연출 덮개: 부대장만 비추는 조명, 전설·신화는 하늘색이 바뀐다. 스킬 이름은 부대장 위에 작게 */
  drawFocus(c: CanvasRenderingContext2D, f: number) {
    const ci = this.cutin!;
    const col = GRADES[ci.grade as keyof typeof GRADES].color;
    const cx = VW / 2, cy = VH * 0.58;
    c.save();
    // 전설·신화: 스킬마다 하늘색
    const TINT: Record<string, string> = { breath: '60,255,110', feast: '255,30,70', hellfire: '255,110,20', song: '70,210,255', doom: '110,20,255' };
    if (ci.grade !== 'hero') {
      const tint = TINT[ci.kind] ?? '255,255,255';
      c.fillStyle = `rgba(${tint},${0.22 * f})`; c.fillRect(0, 0, VW, VH);
    }
    // 조명: 가운데(부대장)는 밝고 바깥은 어둡게
    const g = c.createRadialGradient(cx, cy - 30, 60, cx, cy - 30, 520);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,3,12,${0.78 * f})`);
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    // 신화: 거대한 그림자가 화면을 가로지른다
    if (ci.grade === 'myth' && !ci.released) {
      const p = ci.t / ci.release, x = -400 + p * (VW + 800);
      c.fillStyle = `rgba(10,0,20,${0.55 * f})`;
      c.beginPath(); c.moveTo(x - 380, 40); c.quadraticCurveTo(x - 120, 200, x, 150); c.quadraticCurveTo(x + 120, 200, x + 380, 40); c.quadraticCurveTo(x, 110, x - 380, 40); c.fill();
    }
    // 스킬 이름: 부대장 머리 위에 작게
    if (!ci.released) {
      const a = Math.min(1, ci.t / 0.2);
      c.globalAlpha = a * f; c.textAlign = 'center';
      c.font = 'bold 13px sans-serif'; c.fillStyle = col; c.fillText(ci.name, cx, cy - 150);
      c.font = 'bold 22px sans-serif'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(ci.skill, cx, cy - 124); c.fillStyle = '#fff'; c.fillText(ci.skill, cx, cy - 124);
    }
    c.restore();
  }

  /** 스킬 이펙트 */
  skillFx(kind: string, x: number, y: number, r: number) {
    const ring = (col: string, dur: number, w = 8) => this.fx.push({ age: 0, dur, draw: (c, p) => {
      c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = w * (1 - p) + 1;
      c.beginPath(); c.ellipse(x, y, r * (0.3 + p), r * (0.3 + p) * 0.5, 0, 0, 7); c.stroke();
    } });
    const glow = (col: string, dur: number) => this.fx.push({ age: 0, dur, draw: (c, p) => {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 * (1 - p);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.55, 0, 0, 7); c.fill();
    } });
    switch (kind) {
      case 'slam': ring('#ffd08a', 0.6, 14); ring('#ffffff', 0.4, 6); this.burst(x, y, 40, '#c9a477', 280, 6, 0.8); this.shake = 14; break;
      case 'charm': glow('rgba(255,110,190,1)', 1.0); ring('#ff8ad8', 0.8); this.burst(x, y - 20, 24, '#ff9ad8', 140, 4, 1.0); break;
      case 'swarm': for (let i = 0; i < 14; i++) this.parts.push({ x: x - 60 + Math.random() * 120, y: y - 60 + Math.random() * 60, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 160, life: 0.6, max: 0.6, col: '#9d7bff', size: 7 }); ring('#9d7bff', 0.4, 5); break;
      case 'charge': this.burst(x, y, 36, '#d9b48a', 240, 5, 0.7); ring('#ffb070', 0.45, 10); this.shake = 12; break;
      case 'aegis': this.fx.push({ age: 0, dur: 1.2, draw: (c, p) => { c.globalAlpha = 0.8 * (1 - p); c.strokeStyle = '#8fd0ff'; c.lineWidth = 5; c.beginPath(); c.arc(x, y - 30, 70, Math.PI, 0); c.stroke(); c.fillStyle = 'rgba(143,208,255,.15)'; c.fill(); } }); break;
      case 'hex': glow('rgba(140,60,200,1)', 1.4); this.burst(x, y - 20, 30, '#a26bff', 90, 6, 1.3); break;
      case 'feast': glow('rgba(220,30,60,1)', 0.9); ring('#ff4d6d', 0.7, 10); this.burst(x, y - 20, 30, '#ff4d6d', 200, 5, 0.9); break;
      case 'breath': this.fx.push({ age: 0, dur: 0.9, draw: (c, p) => { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 * (1 - p); const g = c.createLinearGradient(x, 0, x + r, 0); g.addColorStop(0, '#b8ff7a'); g.addColorStop(1, 'rgba(80,200,60,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + r, y - 90); c.lineTo(x + r, y + 50); c.closePath(); c.fill(); } }); this.shake = 10; break;
      case 'hellfire': for (let i = 0; i < 6; i++) { const tx = x - 60 + Math.random() * 160, ty = y - 120 + Math.random() * 200, d = i * 0.08; this.fx.push({ age: -d, dur: 0.5, draw: (c, p) => { if (p < 0) return; const fy = ty - 300 * (1 - p); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#ff7a2a'; c.beginPath(); c.arc(tx, fy, 12, 0, 7); c.fill(); } }); } setTimeout(() => { this.burst(x, y - 40, 70, '#ff7a2a', 320, 6, 1); this.shake = 18; this.flash = 0.4; }, 400); break;
      case 'song': ring('#7ae7ff', 1.2, 6); ring('#c8f6ff', 0.9, 4); for (let i = 0; i < 10; i++) this.texts.push({ x: x - r / 2 + Math.random() * r, y: y - 40 - Math.random() * 60, str: '♪', col: '#9ff0ff', life: 1.2, size: 22 }); break;
      case 'doom': this.flash = 0.9; this.shake = 24; ring('#ff3df0', 1.0, 18); glow('rgba(170,40,255,1)', 1.2); this.burst(x + 200, y, 120, '#d07bff', 500, 7, 1.2); break;
    }
  }

  /** 빈 들판 장식: 레인 사이·위아래에 바위와 덤불(위치는 고정) */
  decor(): { x: number; y: number; kind: 'tree' | 'rock' | 'bush'; r: number }[] {
    if (this._decor) return this._decor;
    const k = this.s.castle, out: { x: number; y: number; kind: 'tree' | 'rock' | 'bush'; r: number }[] = [];
    const bands = [[60, LANE_CY[0] - LANE_H / 2 - 6], [LANE_CY[0] + LANE_H / 2 + 4, LANE_CY[1] - LANE_H / 2 - 4], [LANE_CY[1] + LANE_H / 2 + 4, LANE_CY[2] - 24], [LANE_CY[2] + 26, 700]];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = -60; x < k.wallX - 40; x += 46) for (const [y0, y1] of bands) {
      if (y1 - y0 < 10 || rnd() < 0.45) continue;
      const kind = rnd() < 0.45 ? 'tree' : rnd() < 0.5 ? 'rock' : 'bush';
      out.push({ x: x + rnd() * 30, y: y0 + rnd() * (y1 - y0), kind, r: 8 + rnd() * 10 });
    }
    // 숲 지형 안의 나무
    for (const z of k.terrain ?? []) if (z.kind === 'forest') for (let x = z.x0 + 10; x < z.x1; x += 34) {
      out.push({ x: x + rnd() * 12, y: LANE_CY[z.lane] - LANE_H / 2 + 14 + rnd() * 10, kind: 'tree', r: 14 });
      out.push({ x: x + 16 + rnd() * 12, y: LANE_CY[z.lane] + LANE_H / 2 - 18 - rnd() * 10, kind: 'tree', r: 13 });
    }
    return (this._decor = out);
  }
  _decor: { x: number; y: number; kind: 'tree' | 'rock' | 'bush'; r: number }[] | null = null;
  drawDecor(c: CanvasRenderingContext2D, d: { x: number; y: number; kind: string; r: number }) {
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(d.x, d.y + 2, d.r, d.r * 0.4, 0, 0, 7); c.fill();
    if (d.kind === 'tree') {
      c.fillStyle = '#5a3d24'; c.fillRect(d.x - 3, d.y - d.r, 6, d.r);
      c.fillStyle = '#2f5a2a'; c.beginPath(); c.arc(d.x, d.y - d.r * 1.6, d.r, 0, 7); c.fill();
      c.fillStyle = '#3d7034'; c.beginPath(); c.arc(d.x - d.r * 0.3, d.y - d.r * 1.8, d.r * 0.6, 0, 7); c.fill();
    } else if (d.kind === 'rock') {
      c.fillStyle = '#7d7a72'; c.beginPath(); c.ellipse(d.x, d.y - d.r * 0.3, d.r * 0.9, d.r * 0.6, 0, 0, 7); c.fill();
      c.fillStyle = '#99958a'; c.beginPath(); c.ellipse(d.x - 2, d.y - d.r * 0.5, d.r * 0.5, d.r * 0.3, 0, 0, 7); c.fill();
    } else {
      c.fillStyle = '#3b6b33'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(d.x + i * d.r * 0.5, d.y - d.r * 0.4, d.r * 0.55, 0, 7); c.fill(); }
    }
  }

  /** 땅(풀밭)이 화면 전체를 채운다 */
  drawIsland(c: CanvasRenderingContext2D) {
    const k = this.s.castle, x0 = -200, x1 = k.length + 400;
    c.fillStyle = '#4a6b3a'; c.fillRect(x0, -100, x1 - x0, VH + 200);
    c.fillStyle = 'rgba(255,255,255,.04)';
    for (let x = x0; x < x1; x += 64) for (let y = -96; y < VH + 100; y += 48) if ((((x - x0) / 64 + (y + 96) / 48) | 0) % 2 === 0) c.fillRect(x, y, 64, 48);
  }

  /** 바닥에 붙은 것: 길, 해자, 굴, 안뜰 */
  drawFloor(c: CanvasRenderingContext2D) {
    const s = this.s, k = s.castle;
    const road = (lane: number, col: string) => { c.fillStyle = col; c.fillRect(-80, LANE_CY[lane] - LANE_H / 2 + 12, k.wallX + 80, LANE_H - 24); };
    road(0, 'rgba(150,135,100,.35)'); road(1, 'rgba(176,152,108,.6)');
    // 지형: 언덕(밝은 둔덕과 등고선), 숲은 나무를 유닛과 같이 그린다(drawTrees)
    for (const z of k.terrain ?? []) {
      if (z.kind !== 'hill') continue;
      const cy = LANE_CY[z.lane];
      c.fillStyle = 'rgba(214,196,140,.35)'; c.beginPath(); c.ellipse((z.x0 + z.x1) / 2, cy, (z.x1 - z.x0) / 2, LANE_H * 0.42, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(120,100,60,.35)'; c.lineWidth = 2;
      for (let r = 0.3; r < 1; r += 0.3) { c.beginPath(); c.ellipse((z.x0 + z.x1) / 2, cy, (z.x1 - z.x0) / 2 * r, LANE_H * 0.42 * r, 0, 0, 7); c.stroke(); }
      c.fillStyle = 'rgba(80,60,30,.8)'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('언덕 · 사거리 +25%', (z.x0 + z.x1) / 2, cy + LANE_H * 0.42 - 4);
    }
    for (const z of k.terrain ?? []) {
      if (z.kind !== 'forest') continue;
      c.fillStyle = 'rgba(30,60,30,.35)'; c.fillRect(z.x0, LANE_CY[z.lane] - LANE_H / 2 + 6, z.x1 - z.x0, LANE_H - 12);
      const ly = LANE_CY[z.lane] - LANE_H / 2 - 4;   // 안내 글자는 띠 위쪽(나무에 안 가리게)
      c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
      const tw = c.measureText('숲 · 원거리 피해 -30%').width;
      c.fillStyle = 'rgba(10,20,10,.6)'; c.fillRect((z.x0 + z.x1) / 2 - tw / 2 - 6, ly - 13, tw + 12, 18);
      c.fillStyle = '#c8f0c8'; c.fillText('숲 · 원거리 피해 -30%', (z.x0 + z.x1) / 2, ly);
    }
    // 가시밭
    for (const o of k.outworks ?? []) {
      if (o.kind !== 'spikes') continue;
      const cy = LANE_CY[o.lane];
      c.fillStyle = 'rgba(90,60,40,.45)'; c.fillRect(o.x0, cy - LANE_H / 2 + 14, o.x1 - o.x0, LANE_H - 28);
      c.fillStyle = '#8c8c96';
      for (let x = o.x0 + 6; x < o.x1; x += 14) for (let y = cy - LANE_H / 2 + 20; y < cy + LANE_H / 2 - 16; y += 16) {
        c.beginPath(); c.moveTo(x - 4, y + 6); c.lineTo(x, y - 6); c.lineTo(x + 4, y + 6); c.fill();
      }
    }
    // 안뜰(돌바닥)
    c.fillStyle = '#7a6d5e'; c.fillRect(k.wallX, YARD_CY - YARD_H / 2 - 30, k.length - k.wallX + 160, YARD_H + 60);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
    for (let x = k.wallX; x < k.length + 160; x += 40) { c.beginPath(); c.moveTo(x, YARD_CY - YARD_H / 2 - 30); c.lineTo(x, YARD_CY + YARD_H / 2 + 30); c.stroke(); }
    for (let y = YARD_CY - YARD_H / 2 - 30; y < YARD_CY + YARD_H / 2 + 30; y += 30) { c.beginPath(); c.moveTo(k.wallX, y); c.lineTo(k.length + 160, y); c.stroke(); }
    // 해자(정문 길 앞, 움푹 들어간 물)
    if (k.moat) {
      const top = LANE_CY[1] - LANE_H / 2, h = LANE_H;
      c.fillStyle = '#3a2c22'; c.fillRect(k.moat[0], top, k.moat[1] - k.moat[0], 8);
      c.fillStyle = '#2d6286'; c.fillRect(k.moat[0], top + 8, k.moat[1] - k.moat[0], h - 8);
      c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = top + 20; y < top + h - 8; y += 22) c.fillRect(k.moat[0] + 10 + Math.sin(this.t * 2 + y) * 6, y, k.moat[1] - k.moat[0] - 30, 2);
    }
    // 굴: 밖은 파 들어간 도랑, 성벽 밑은 점선, 안쪽 굴과 구멍
    if (k.tunnel) {
      c.fillStyle = '#2a1f18'; c.fillRect(-80, LANE_CY[2] - 16, k.wallX + 56, 32);
      c.fillStyle = '#3d2e22'; c.fillRect(-80, LANE_CY[2] - 16, k.wallX + 56, 6);
      c.setLineDash([12, 10]); c.lineWidth = 5; c.strokeStyle = s.tunnelOpen ? '#e0b77f' : 'rgba(224,183,127,.35)';
      c.beginPath(); c.moveTo(k.wallX - 24, LANE_CY[2]); c.lineTo(k.wallX + TUNNEL_IN, LANE_CY[2]); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(30,22,18,.55)'; c.fillRect(k.wallX + 30, LANE_CY[2] - 14, TUNNEL_IN - 30, 28);
      c.fillStyle = s.tunnelOpen ? '#120d0a' : '#4a3a2c'; c.beginPath(); c.ellipse(k.wallX + TUNNEL_IN, LANE_CY[2], 24, 14, 0, 0, 7); c.fill();
      if (!s.tunnelOpen) { c.fillStyle = '#e0b77f'; c.fillRect(k.wallX - 80, LANE_CY[2] + 22, 60 * Math.min(1, s.tunnelWork / k.tunnelDig), 5); }
    }
    // 점거 원(바닥)
    c.fillStyle = 'rgba(177,76,255,.14)'; c.beginPath(); c.ellipse(k.coreX, YARD_CY, 80, 46, 0, 0, 7); c.fill();
    c.strokeStyle = s.coreProg > 0 ? '#c27bff' : 'rgba(217,210,255,.45)'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(k.coreX, YARD_CY, 80, 46, 0, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.max(0.001, s.coreProg / k.holdSec)); c.stroke();
  }

  /** 성벽: 세로로 긴 벽을 조각내 y 순서에 끼워 넣는다(유닛이 앞뒤로 자연스럽게 가려지게) */
  wallItems(items: { y: number; draw: () => void }[]) {
    const s = this.s, k = s.castle, c = this.ctx;
    const gTop = LANE_CY[1] - 42, gBot = LANE_CY[1] + 42;
    const seg = 30, x = k.wallX - 20, w = 40;
    for (let y = GROUND_TOP + 10; y < GROUND_BOT - 10; y += seg) {
      const y2 = Math.min(GROUND_BOT - 10, y + seg);
      if (y2 > gTop && y < gBot) continue;
      items.push({ y: y2, draw: () => {
        c.fillStyle = '#8b8098'; c.fillRect(x, y - WALL_H, w, y2 - y);                      // 윗면
        c.fillStyle = '#9d93ab'; c.fillRect(x - 3, y - WALL_H - 8, 10, 8); c.fillRect(x + w - 7, y - WALL_H - 8, 10, 8);   // 총안
        c.fillStyle = '#5f566e'; c.fillRect(x, y2 - WALL_H, w, WALL_H);                       // 앞면(남쪽)
        c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, y2 - WALL_H, w, 4);
      } });
    }
    // 성문(벽 사이의 문틀과 문짝)
    items.push({ y: gBot, draw: () => {
      c.fillStyle = '#5f566e'; c.fillRect(x - 6, gTop - WALL_H - 10, w + 12, 18);              // 문 위 아치
      if (s.gateHp > 0) {
        c.fillStyle = '#7a5532'; c.fillRect(x + 4, gTop - WALL_H + 8, w - 8, gBot - gTop + WALL_H - 8);
        c.strokeStyle = '#3a2614'; c.lineWidth = 3;
        for (let yy = gTop - WALL_H + 22; yy < gBot; yy += 18) { c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + w - 4, yy); c.stroke(); }
        bar(c, k.wallX, gTop - WALL_H - 22, 60, s.gateHp / s.gateMax, '#ffb347');
      } else {
        c.fillStyle = '#2b2119'; c.fillRect(x + 4, gBot - 24, w - 8, 24);                    // 부서진 문짝 잔해
      }
    } });
  }

  drawPalisade(c: CanvasRenderingContext2D, p: { lane: number; x: number; hp: number; max: number; alive: boolean }) {
    const top = LANE_CY[p.lane] - LANE_H / 2 + 12, bot = LANE_CY[p.lane] + LANE_H / 2 - 12;
    if (!p.alive) { c.fillStyle = '#5a3d24'; for (let y = top; y < bot; y += 14) c.fillRect(p.x - 8 + ((y / 14) % 2) * 6, y + 6, 14, 5); return; }
    for (let y = top; y < bot; y += 12) {
      c.fillStyle = '#7a5532'; c.fillRect(p.x - 6, y - 18, 12, 24);
      c.fillStyle = '#9a7048'; c.beginPath(); c.moveTo(p.x - 6, y - 18); c.lineTo(p.x, y - 26); c.lineTo(p.x + 6, y - 18); c.fill();
    }
    bar(c, p.x, top - 34, 44, p.hp / p.max, '#e0b77f');
  }

  drawOutpostFlag(c: CanvasRenderingContext2D, x: number, y: number, cleared: boolean) {
    c.fillStyle = '#4a3a2c'; c.fillRect(x - 2, y - 40, 4, 40);
    c.fillStyle = cleared ? '#b14cff' : '#3f6fd8';
    c.beginPath(); c.moveTo(x + 2, y - 40); c.lineTo(x + 30, y - 32); c.lineTo(x + 2, y - 24); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'left'; c.fillText(cleared ? '초소 점령' : '외곽 초소', x + 6, y - 46);
  }

  drawTower(c: CanvasRenderingContext2D, t: { x: number; alive: boolean; hp: number; max: number; range: number; barrier?: boolean }, by: number) {
    const r = 24;
    if ((t as { splash?: number }).splash) {   // 투석기: 나무 틀과 팔
      if (!t.alive) { c.fillStyle = '#5a3d24'; c.fillRect(t.x - 20, by - 10, 40, 10); return; }
      c.fillStyle = '#6b4a2b'; c.fillRect(t.x - 22, by - 16, 44, 14);
      c.fillStyle = '#4a3220'; c.fillRect(t.x - 18, by - 40, 6, 26); c.fillRect(t.x + 12, by - 40, 6, 26);
      const sw = Math.sin(this.t * 2) * 0.2;
      c.strokeStyle = '#8a6440'; c.lineWidth = 5; c.beginPath(); c.moveTo(t.x, by - 36); c.lineTo(t.x + Math.cos(-2.2 + sw) * 40, by - 36 + Math.sin(-2.2 + sw) * 40); c.stroke();
      bar(c, t.x, by - 70, 44, t.hp / t.max, '#ff6b6b');
      return;
    }
    if (t.barrier) {   // 결계 기둥: 빛나는 수정
      if (!t.alive) { c.fillStyle = '#5a6a8a'; c.fillRect(t.x - 14, by - 16, 28, 16); return; }
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(t.x, by - 60, 4, t.x, by - 60, 90); g.addColorStop(0, `rgba(140,220,255,${0.5 + 0.3 * pulse})`); g.addColorStop(1, 'rgba(140,220,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(t.x, by - 60, 90, 0, 7); c.fill(); c.restore();
      c.fillStyle = '#9fe6ff'; c.beginPath(); c.moveTo(t.x, by - 120); c.lineTo(t.x + 18, by - 50); c.lineTo(t.x, by); c.lineTo(t.x - 18, by - 50); c.closePath(); c.fill();
      c.fillStyle = '#e8fbff'; c.beginPath(); c.moveTo(t.x, by - 110); c.lineTo(t.x + 6, by - 55); c.lineTo(t.x, by - 20); c.closePath(); c.fill();
      bar(c, t.x, by - 134, 44, t.hp / t.max, '#9fe6ff');
      return;
    }
    if (!t.alive) {
      c.fillStyle = '#5a5066'; c.beginPath(); c.ellipse(t.x, by, r, r * 0.5, 0, 0, 7); c.fill();
      c.fillStyle = '#4a4252'; c.fillRect(t.x - r, by - 18, r * 2, 18); c.beginPath(); c.ellipse(t.x, by - 18, r, r * 0.5, 0, 0, 7); c.fill();
      return;
    }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(t.x, by + 4, r + 6, (r + 6) * 0.45, 0, 0, 7); c.fill();
    c.fillStyle = '#6a6079'; c.fillRect(t.x - r, by - TOWER_H, r * 2, TOWER_H);              // 몸통 앞면
    c.fillStyle = '#5a5068'; c.beginPath(); c.ellipse(t.x, by, r, r * 0.5, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#8b8098'; c.beginPath(); c.ellipse(t.x, by - TOWER_H, r, r * 0.5, 0, 0, 7); c.fill();   // 윗면
    if ((t as { antiAir?: boolean }).antiAir) {   // 쇠뇌탑: 지붕 대신 하늘을 향한 쇠뇌
      c.strokeStyle = '#3a2614'; c.lineWidth = 5; c.beginPath(); c.moveTo(t.x - 22, by - TOWER_H - 6); c.quadraticCurveTo(t.x, by - TOWER_H - 34, t.x + 22, by - TOWER_H - 6); c.stroke();
      c.strokeStyle = '#c9d2ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(t.x - 4, by - TOWER_H); c.lineTo(t.x + 14, by - TOWER_H - 44); c.stroke();
    } else {
      c.fillStyle = '#a33245'; c.beginPath(); c.moveTo(t.x - r - 4, by - TOWER_H); c.lineTo(t.x, by - TOWER_H - 40); c.lineTo(t.x + r + 4, by - TOWER_H); c.fill();   // 지붕
    }
    c.fillStyle = '#ffcf6e'; c.fillRect(t.x - 4, by - TOWER_H + 20, 8, 12);                 // 창
    bar(c, t.x, by - TOWER_H - 52, 44, t.hp / t.max, '#ff6b6b');
  }

  drawKeep(c: CanvasRenderingContext2D) {
    const k = this.s.castle, x = k.coreX + 70, w = 170, top = YARD_CY - 120, bot = YARD_CY + 110;
    c.fillStyle = '#6e6382'; c.fillRect(x, top - KEEP_H, w, bot - top);                       // 윗면
    c.fillStyle = '#4c4360'; c.fillRect(x, bot - KEEP_H, w, KEEP_H);                          // 앞면
    c.fillStyle = '#a33245';
    c.beginPath(); c.moveTo(x - 8, top - KEEP_H); c.lineTo(x + w / 2, top - KEEP_H - 50); c.lineTo(x + w + 8, top - KEEP_H); c.fill();
    c.fillStyle = '#ffcf6e'; for (let i = 0; i < 4; i++) c.fillRect(x + 20 + i * 38, bot - KEEP_H + 30, 12, 18);
    c.fillStyle = '#2b2119'; c.fillRect(x + w / 2 - 18, bot - 44, 36, 44);                  // 문
    c.fillStyle = this.s.coreProg > 0 ? '#c27bff' : '#d9d2ff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
    c.fillText('본관', x + w / 2, bot - KEEP_H - 8);
  }

  /** 부대장 이름표: 부대 색 점 + 이름 + 체력. 같은 레인에서 겹치지 않게 부대마다 높이를 엇갈린다 */
  leaderTag(c: CanvasRenderingContext2D, u: Unit, x: number, top: number) {
    const y = top - 10 - (u.squad % 2) * 20;
    c.textAlign = 'center'; c.font = 'bold 12px sans-serif';
    const w = c.measureText(u.name).width;
    c.fillStyle = 'rgba(10,8,20,.6)'; c.fillRect(x - w / 2 - 12, y - 13, w + 18, 24);
    c.fillStyle = SQUAD_COL[u.squad % SQUAD_COL.length]; c.beginPath(); c.arc(x - w / 2 - 5, y - 4, 4, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillText(u.name, x + 3, y);
    bar(c, x, y + 4, 44, u.hp / u.max, '#62d394');
  }

  drawUnit(c: CanvasRenderingContext2D, u: Unit, px: number, py: number) {
    const lunge = u.lungeT > 0 ? Math.sin((u.lungeT / 0.15) * Math.PI) * 8 * (u.side === 'ally' ? 1 : -1) : 0;
    const step = Math.abs(Math.sin(this.t * 9 + u.uid)) * 2;
    const x = px + lunge;
    const fly = u.role === 'flying' ? 30 + Math.sin(this.t * 4 + u.uid) * 3 : 0;
    const ci = this.cutin, focused = !!ci && ci.uid === u.uid && !ci.released;
    const wind = focused ? Math.min(1, ci!.t / ci!.release) : 0;
    const big = (u.isLeader ? 1.9 : u.foeType === 'captain' ? 1.6 : u.foeType === 'knight' ? 1.2 : 1) * (1 + 0.18 * wind);
    if (focused) {
      const gc = GRADES[u.grade as keyof typeof GRADES].color;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 20);
      const gg = c.createRadialGradient(px, py, 2, px, py, 70); gg.addColorStop(0, gc); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.beginPath(); c.ellipse(px, py, 70, 30, 0, 0, 7); c.fill(); c.restore();
    }
    const bw = 12 * big, bh = 14 * big, hr = 6.5 * big;
    c.save();
    if (!u.alive) c.globalAlpha = Math.max(0, u.hitT / 0.12);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py, bw * 0.8, bw * 0.32, 0, 0, 7); c.fill();
    if (u.side === 'ally' && u.squad >= 0) {   // 부대 색 발밑 표시
      c.strokeStyle = SQUAD_COL[u.squad % SQUAD_COL.length]; c.lineWidth = u.isLeader ? 2 : 1.5;
      c.beginPath(); c.ellipse(px, py, bw * 0.75, bw * 0.3, 0, 0, 7); c.stroke();
    }
    const feet = py - fly - step - wind * 14;
    const sheet = u.side === 'ally' && u.monId ? sheetOf(u.monId) : null;
    if (sheet) {
      // 칸 고르기: 쓰러짐 > 피격 > 스킬 준비 > 공격 > 걷기
      const frame = !u.alive ? 6 : u.hitT > 0 ? 5 : focused ? 4 : u.lungeT > 0 ? 3 : Math.floor(this.t * 6 + u.uid) % 2 ? 1 : 2;
      const fw = sheet.naturalWidth / 4, fh = sheet.naturalHeight / 2;
      const h = (u.isLeader ? 72 : 40) * (1 + 0.18 * wind), w = h * (fw / fh);
      c.drawImage(sheet, (frame % 4) * fw, Math.floor(frame / 4) * fh, fw, fh, x - w / 2, feet - h, w, h);
      if (u.isLeader) this.leaderTag(c, u, x, feet - h);
      c.restore();
      return;
    }
    const body = u.hitT > 0 ? '#ffffff' : ROLE_COL[u.role];
    const dark = u.hitT > 0 ? '#ffffff' : shade(body, 0.7);
    // 다리
    c.fillStyle = dark; c.fillRect(x - bw * 0.35, feet - 5 * big, bw * 0.25, 5 * big); c.fillRect(x + bw * 0.1, feet - 5 * big, bw * 0.25, 5 * big);
    // 몸통
    c.fillStyle = body; roundRect(c, x - bw / 2, feet - 5 * big - bh, bw, bh, 3 * big); c.fill();
    // 머리
    const hy = feet - 5 * big - bh - hr + 2;
    c.fillStyle = u.side === 'ally' ? shade(body, 1.15) : '#e9d6c2';
    c.beginPath(); c.arc(x, hy, hr, 0, 7); c.fill();
    // 눈(오른쪽을 봄)
    c.fillStyle = '#140f1f'; c.fillRect(x + hr * 0.25, hy - 1, 2 * big, 2.5 * big);
    if (u.side === 'foe') {
      // 투구와 방패
      c.fillStyle = u.foeType === 'captain' ? '#ffd166' : '#7d8bb8'; c.fillRect(x - hr, hy - hr, hr * 2, hr * 0.7);
      c.fillStyle = u.foeType === 'archer' ? '#8a5a2e' : '#9fb0d8'; c.fillRect(x - bw / 2 - 4, feet - 5 * big - bh + 2, 5, bh - 4);
    }
    if (u.role === 'flying') {
      const w = Math.sin(this.t * 16 + u.uid) * 6;
      c.fillStyle = dark;
      c.beginPath(); c.moveTo(x - 2, feet - bh * 0.8); c.lineTo(x - bw - 10, feet - bh - 10 - w); c.lineTo(x - bw * 0.6, feet - bh * 0.4); c.fill();
    }
    if (u.side === 'ally' && u.isLeader) {
      const g = GRADES[u.grade as keyof typeof GRADES];
      c.strokeStyle = g.color; c.lineWidth = 3; c.beginPath(); c.ellipse(px, py, bw * 1.1, bw * 0.45, 0, 0, 7); c.stroke();
      this.leaderTag(c, u, x, hy - hr);
    } else if (u.revived) {
      c.strokeStyle = '#7dffb2'; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py, bw, bw * 0.4, 0, 0, 7); c.stroke();
    }
    if (u.side === 'foe' && (u.foeType === 'captain' || u.foeType === 'knight')) bar(c, x, hy - hr - 8, 28, u.hp / u.max, '#ff6b6b');
    c.restore();
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function bar(c: CanvasRenderingContext2D, cx: number, y: number, w: number, p: number, col: string) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(cx - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col; c.fillRect(cx - w / 2, y, w * Math.max(0, Math.min(1, p)), 4);
}

export const roleLabel = (r: Role) => ROLES[r].label;
