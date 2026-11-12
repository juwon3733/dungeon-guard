// 공성전 화면(Canvas). 규칙은 core/siege.ts, 여기는 그리기와 연출만.
// 횡스크롤: 왼쪽 아군 진영 → 오른쪽 성. 레인 0=성벽 위, 1=땅(정문), 2=지하.
import type { SiegeState, SiegeEvent, Unit } from '../core/siege';
import { TUNNEL_IN } from '../core/siege';
import { GRADES, ROLES, type Role } from '../data/monsters';

export const VW = 1280, VH = 720;
const GROUND = 500;                                  // 땅 높이(정문 레인 발 위치)

const LANE_Y = [300, GROUND, 640];                   // 레인별 발 위치
const ROLE_COL: Record<Role | 'foe', string> = {
  assault: '#e8623c', shield: '#8aa0b8', ranged: '#ffcc4d', siege: '#b07a4a', flying: '#9d7bff', support: '#5fd3a0', foe: '#c9d2ff',
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Txt { x: number; y: number; str: string; col: string; life: number; size: number }
interface Fx { age: number; dur: number; draw: (c: CanvasRenderingContext2D, p: number) => void }

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

  constructor(public canvas: HTMLCanvasElement, public s: SiegeState) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** 유닛의 화면 y: 성 안으로 들어가면 땅 높이로 내려온다 */
  unitY(u: { x: number; lane: number }) {
    const c = this.s.castle;
    const base = LANE_Y[u.lane];
    // 지하는 성 안쪽 굴(수비대 대기실) 끝에서 땅 위로 올라온다
    const rise = u.lane === 2 ? c.wallX + TUNNEL_IN : c.wallX + 10;
    if (u.x <= rise || u.lane === 1) return base;
    const k = Math.min(1, (u.x - rise) / 90);
    return base + (GROUND - base) * k;
  }

  onEvent(e: SiegeEvent) {
    const R = Math.random;
    switch (e.t) {
      case 'hit': {
        const y = LANE_Y[e.lane] - 30;
        this.texts.push({ x: e.x + (R() - 0.5) * 16, y, str: String(e.dmg), col: e.ally ? '#ff7a7a' : e.big ? '#ffd166' : '#ffffff', life: 0.8, size: e.big ? 22 : 15 });
        this.burst(e.x, y + 10, e.big ? 10 : 4, e.ally ? '#ff8a8a' : '#fff1b0', 120, 3, 0.4);
        if (e.big) this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'attack': {
        if (!e.ranged) break;
        const f = e.from, fy = this.unitY(f) - 24, ty = LANE_Y[e.to.lane] - 24, tx = e.to.x;
        const col = f.side === 'ally' ? '#ffd166' : '#aac4ff';
        this.fx.push({ age: 0, dur: 0.25, draw: (c, p) => {
          const x = f.x + (tx - f.x) * p, y = fy + (ty - fy) * p - Math.sin(p * Math.PI) * 30;
          c.fillStyle = col; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
        } });
        break;
      }
      case 'tower': {
        const tx = e.x, ty = LANE_Y[e.lane] - 150, to = e.to, toY = this.unitY(to) - 20;
        this.fx.push({ age: 0, dur: 0.3, draw: (c, p) => {
          c.strokeStyle = e.miss ? 'rgba(200,200,200,.5)' : '#ff9f43'; c.lineWidth = 3;
          const x = tx + (to.x - tx) * p, y = ty + (toY - ty) * p;
          c.beginPath(); c.moveTo(x - 6, y - 4); c.lineTo(x + 6, y + 4); c.stroke();
        } });
        if (e.miss) this.texts.push({ x: to.x, y: toY - 20, str: '빗나감', col: '#9fe0a0', life: 0.7, size: 13 });
        break;
      }
      case 'die':
        this.burst(e.u.x, this.unitY(e.u) - 16, e.u.isLeader ? 30 : 10, e.u.side === 'ally' ? '#c08aff' : '#ffe08a', 160, 4, 0.7);
        break;
      case 'revive':
        this.burst(e.u.x, this.unitY(e.u) - 16, 18, '#7dffb2', 120, 4, 0.8, -80);
        this.texts.push({ x: e.u.x, y: this.unitY(e.u) - 50, str: '부활', col: '#7dffb2', life: 1, size: 16 });
        break;
      case 'gateBreak':
        this.shake = 16; this.flash = 0.6;
        this.burst(e.x, GROUND - 60, 70, '#c9a477', 320, 6, 1.2, 300);
        this.banner('성문 파괴!', '#ffd166');
        break;
      case 'towerBreak':
        this.shake = 10;
        this.burst(e.x, LANE_Y[e.lane] - 150, 50, '#d9c7a0', 260, 5, 1, 300);
        this.banner('망루 붕괴', '#ffffff');
        break;
      case 'tunnelOpen':
        this.shake = 8;
        this.burst(e.x, LANE_Y[2] - 10, 40, '#8b6a45', 200, 5, 1, 200);
        this.banner('굴이 뚫렸다', '#c9a477');
        break;
      case 'leaderDown':
        this.banner(`${e.u.name} 쓰러짐 — 지휘 효과 사라짐`, '#ff7a7a');
        break;
    }
  }

  bannerQ: { str: string; col: string; t: number }[] = [];
  banner(str: string, col: string) { this.bannerQ.push({ str, col, t: 0 }); }

  burst(x: number, y: number, n: number, col: string, speed: number, size: number, life: number, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = (0.3 + Math.random() * 0.7) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life * (0.6 + Math.random() * 0.4), max: life, col, size, g });
    }
  }

  update(dt: number) {
    this.t += dt;
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.dur);
    for (const p of this.parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const x of this.texts) { x.life -= dt; x.y -= 30 * dt; }
    this.texts = this.texts.filter((x) => x.life > 0);
    this.shake = Math.max(0, this.shake - 40 * dt);
    this.flash = Math.max(0, this.flash - 2 * dt);
    if (this.bannerQ[0]) { this.bannerQ[0].t += dt; if (this.bannerQ[0].t > 1.6) this.bannerQ.shift(); }
    // 카메라: 가장 앞선 아군을 따라간다
    if (this.follow) {
      const allies = this.s.units.filter((u) => u.side === 'ally' && u.alive);
      const front = allies.length ? Math.max(...allies.map((u) => u.x)) : 0;
      const want = Math.max(0, Math.min(this.s.castle.length + 120 - VW, front - VW * 0.55));
      this.camX += (want - this.camX) * Math.min(1, dt * 2.5);
    }
  }

  draw() {
    const c = this.ctx, s = this.s, k = s.castle;
    const scale = this.canvas.width / VW;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#1b1530'); sky.addColorStop(1, '#4a2f4f');
    c.fillStyle = sky; c.fillRect(0, 0, VW, VH);
    c.save();
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    c.translate(-this.camX * 0.3 + sx, sy);
    // 먼 산
    c.fillStyle = '#2a2140';
    c.beginPath(); c.moveTo(0, GROUND);
    for (let x = 0; x <= k.length + VW; x += 120) c.lineTo(x, GROUND - 120 - Math.sin(x * 0.01) * 60 - Math.sin(x * 0.023) * 30);
    c.lineTo(k.length + VW, GROUND); c.fill();
    c.restore();

    c.save();
    c.translate(-this.camX + sx, sy);
    // 땅과 지하
    c.fillStyle = '#3b2f2a'; c.fillRect(-50, GROUND, k.length + 200, VH - GROUND);
    c.fillStyle = '#4f3f33'; c.fillRect(-50, GROUND, k.length + 200, 10);
    // 지하 굴(레인 2)
    if (k.tunnel) {
      c.fillStyle = '#1e1714';
      c.fillRect(0, LANE_Y[2] - 60, k.wallX - 20, 70);                       // 아군이 파 온 굴
      c.fillRect(k.wallX + 20, LANE_Y[2] - 60, TUNNEL_IN - 20, 70);          // 성 안쪽 굴(수비대)
      c.beginPath(); c.moveTo(k.wallX + TUNNEL_IN, LANE_Y[2] - 60); c.lineTo(k.wallX + TUNNEL_IN + 90, GROUND);
      c.lineTo(k.wallX + TUNNEL_IN + 40, GROUND); c.lineTo(k.wallX + TUNNEL_IN - 20, LANE_Y[2] + 10); c.closePath(); c.fill();   // 올라오는 경사로
      if (s.tunnelOpen) c.fillRect(k.wallX - 20, LANE_Y[2] - 60, 40, 70);
      if (!s.tunnelOpen) {
        c.fillStyle = '#5b4636'; c.fillRect(k.wallX - 20, LANE_Y[2] - 60, 40, 70);
        const p = s.tunnelWork / k.tunnelDig;
        c.fillStyle = '#c9a477'; c.fillRect(k.wallX - 20, LANE_Y[2] + 14, 40 * Math.min(1, p), 5);
      }
    }
    // 해자
    if (k.moat) { c.fillStyle = '#2d5d7c'; c.fillRect(k.moat[0], GROUND - 6, k.moat[1] - k.moat[0], 18); }
    // 성 안 바닥과 핵심 지점(성채 본관)
    c.fillStyle = '#5a4a3f'; c.fillRect(k.wallX, GROUND - 4, k.length - k.wallX + 100, 8);
    c.fillStyle = '#3d3550'; c.fillRect(k.coreX - 60, GROUND - 230, 200, 230);
    c.fillStyle = '#2b2540'; for (let i = 0; i < 5; i++) c.fillRect(k.coreX - 60 + i * 44, GROUND - 250, 26, 22);
    c.fillStyle = s.coreProg > 0 ? '#b14cff' : '#d9d2ff';
    c.fillRect(k.coreX + 30, GROUND - 330, 4, 80);
    c.beginPath(); c.moveTo(k.coreX + 34, GROUND - 330); c.lineTo(k.coreX + 84, GROUND - 315); c.lineTo(k.coreX + 34, GROUND - 300); c.fill();
    // 성벽
    c.fillStyle = '#6b6178'; c.fillRect(k.wallX - 20, LANE_Y[0], 60, GROUND - LANE_Y[0]);
    c.fillStyle = '#7d728c'; for (let i = 0; i < 3; i++) c.fillRect(k.wallX - 20 + i * 22, LANE_Y[0] - 18, 14, 18);
    // 성문
    if (s.gateHp > 0) {
      c.fillStyle = '#6b4a2b'; c.fillRect(k.wallX - 22, GROUND - 110, 46, 110);
      c.strokeStyle = '#3a2614'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(k.wallX - 22, GROUND - 100 + i * 26); c.lineTo(k.wallX + 24, GROUND - 100 + i * 26); c.stroke(); }
      bar(c, k.wallX, GROUND - 124, 60, s.gateHp / s.gateMax, '#ffb347');
    } else {
      c.fillStyle = '#1b1530'; c.fillRect(k.wallX - 22, GROUND - 110, 46, 110);
    }
    // 망루
    for (const t of s.towers) {
      const ty = LANE_Y[t.lane] - (t.lane === 0 ? 0 : 200);
      if (!t.alive) { c.fillStyle = '#4a4252'; c.fillRect(t.x - 18, ty - 20, 36, 20); continue; }
      c.fillStyle = '#80758f'; c.fillRect(t.x - 18, ty - 120, 36, 120);
      c.fillStyle = '#9c2b3b'; c.beginPath(); c.moveTo(t.x - 24, ty - 120); c.lineTo(t.x, ty - 150); c.lineTo(t.x + 24, ty - 120); c.fill();
      bar(c, t.x, ty - 160, 44, t.hp / t.max, '#ff6b6b');
    }
    // 유닛: 먼 레인부터
    const order = [...s.units].filter((u) => u.alive || u.hitT > 0).sort((a, b) => this.unitY(a) - this.unitY(b));
    for (const u of order) this.drawUnit(c, u);
    // 연출
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

    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, VW, VH); }
    const b = this.bannerQ[0];
    if (b) {
      const a = Math.min(1, b.t * 5) * (b.t > 1.2 ? Math.max(0, 1 - (b.t - 1.2) / 0.4) : 1);
      c.globalAlpha = a; c.textAlign = 'center'; c.font = 'italic 900 40px sans-serif';
      c.lineWidth = 7; c.strokeStyle = '#140f1f'; c.strokeText(b.str, VW / 2, 120); c.fillStyle = b.col; c.fillText(b.str, VW / 2, 120);
      c.globalAlpha = 1;
    }
  }

  drawUnit(c: CanvasRenderingContext2D, u: Unit) {
    const y0 = this.unitY(u);
    const bob = Math.sin(this.t * 6 + u.uid) * 1.5;
    const lunge = u.lungeT > 0 ? Math.sin((u.lungeT / 0.15) * Math.PI) * 8 * (u.side === 'ally' ? 1 : -1) : 0;
    const x = u.x + lunge, y = y0 + bob;
    const fly = u.role === 'flying' ? 26 : 0;
    const r = u.isLeader ? 20 : u.side === 'foe' ? 11 : 10;
    c.save();
    if (!u.alive) c.globalAlpha = Math.max(0, u.hitT / 0.12);
    // 그림자
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(u.x, y0 + 2, r, r * 0.3, 0, 0, 7); c.fill();
    const col = u.hitT > 0 ? '#ffffff' : ROLE_COL[u.role];
    if (u.side === 'ally') {
      c.fillStyle = col; c.beginPath(); c.arc(x, y - r - fly, r, 0, 7); c.fill();
      if (u.role === 'flying') { c.beginPath(); c.moveTo(x - r, y - r - fly); c.lineTo(x - r - 14, y - r - fly - 10 + Math.sin(this.t * 14 + u.uid) * 6); c.lineTo(x - r + 2, y - fly - 4); c.fill(); }
      if (u.isLeader) {
        const g = GRADES[u.grade as keyof typeof GRADES];
        c.strokeStyle = g.color; c.lineWidth = 3; c.beginPath(); c.arc(x, y - r - fly, r + 3, 0, 7); c.stroke();
        c.fillStyle = '#140f1f'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText(u.name[0], x, y - r - fly + 5);
        c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText(u.name, x, y - r * 2 - fly - 14);
        bar(c, x, y - r * 2 - fly - 10, 44, u.hp / u.max, '#62d394');
      } else if (u.revived) {
        c.fillStyle = '#7dffb2'; c.fillRect(x - 2, y - r * 2 - fly - 4, 4, 4);
      }
    } else {
      c.fillStyle = col;
      c.fillRect(x - r, y - r * 2.2, r * 2, r * 2.2);
      c.fillStyle = u.foeType === 'captain' ? '#ffd166' : '#5b6aa8'; c.fillRect(x - r, y - r * 2.2, r * 2, 5);
      if (u.foeType === 'captain' || u.foeType === 'knight') bar(c, x, y - r * 2.2 - 9, 30, u.hp / u.max, '#ff6b6b');
    }
    c.restore();
  }
}

function bar(c: CanvasRenderingContext2D, cx: number, y: number, w: number, p: number, col: string) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(cx - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col; c.fillRect(cx - w / 2, y, w * Math.max(0, Math.min(1, p)), 4);
}

export const roleLabel = (r: Role) => ROLES[r].label;
