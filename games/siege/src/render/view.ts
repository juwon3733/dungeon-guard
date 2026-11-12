// 공성전 화면(Canvas): 위에서 내려다보는 탑다운, 왼쪽(아군 진영) → 오른쪽(성)으로 진군.
// 규칙은 core/siege.ts. 레인은 위아래로 나란한 띠: 0=북쪽 성벽 구간, 1=가운데 정문 길, 2=남쪽 굴.
import type { SiegeState, SiegeEvent, Unit } from '../core/siege';
import { TUNNEL_IN } from '../core/siege';
import { GRADES, ROLES, type Role } from '../data/monsters';

export const VW = 1280, VH = 720;
const LANE_CY = [190, 370, 560];          // 레인 띠의 가운데 y
const LANE_H = 150;                       // 띠 높이
const YARD_CY = 370, YARD_H = 420;        // 성 안뜰(레인이 합쳐지는 곳)
const ROLE_COL: Record<Role | 'foe', string> = {
  assault: '#e8623c', shield: '#8aa0b8', ranged: '#ffcc4d', siege: '#b07a4a', flying: '#9d7bff', support: '#5fd3a0', foe: '#c9d2ff',
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number }
interface Txt { x: number; y: number; str: string; col: string; life: number; size: number }
interface Fx { age: number; dur: number; draw: (c: CanvasRenderingContext2D, p: number) => void }

/** 유닛마다 고정된 흩어짐(-1..1). 무리가 띠 안에 퍼져 보이게 */
const jitter = (uid: number) => (((uid * 2654435761) >>> 0) % 1000) / 500 - 1;

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

  constructor(public canvas: HTMLCanvasElement, public s: SiegeState) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** 위에서 본 위치. 성 안에 들어오면 안뜰로 퍼진다 */
  pos(u: { x: number; lane: number; uid?: number }) {
    const c = this.s.castle;
    const j = u.uid != null ? jitter(u.uid) : 0;
    const laneY = LANE_CY[u.lane] + j * (LANE_H * (u.lane === 2 ? 0.1 : 0.32));   // 굴은 좁다
    const enter = u.lane === 2 ? c.wallX + TUNNEL_IN : c.wallX + 20;
    if (u.x <= enter) return { x: u.x, y: laneY };
    const k = Math.min(1, (u.x - enter) / 120);
    const yardY = YARD_CY + j * (YARD_H * 0.38);
    return { x: u.x, y: laneY + (yardY - laneY) * k };
  }
  laneY(lane: number) { return LANE_CY[lane]; }
  towerY(lane: number) { return lane === 0 ? LANE_CY[0] - 30 : LANE_CY[1] - LANE_H / 2 - 10; }
  banner(str: string, col: string) { this.bannerQ.push({ str, col, t: 0 }); }

  onEvent(e: SiegeEvent) {
    const R = Math.random;
    switch (e.t) {
      case 'hit': {
        const y = this.laneY(e.lane) - 20;
        this.texts.push({ x: e.x + (R() - 0.5) * 20, y: y + (R() - 0.5) * 30, str: String(e.dmg), col: e.ally ? '#ff7a7a' : e.big ? '#ffd166' : '#ffffff', life: 0.8, size: e.big ? 22 : 14 });
        if (e.big) this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'attack': {
        const f = e.from, a = this.pos(f);
        const tx = e.to.x, ty = this.laneY(e.to.lane) + (R() - 0.5) * 40;
        if (e.ranged) {
          const col = f.side === 'ally' ? '#ffd166' : '#aac4ff';
          this.fx.push({ age: 0, dur: 0.22, draw: (c, p) => {
            const x = a.x + (tx - a.x) * p, y = a.y + (ty - a.y) * p;
            c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x, y); c.stroke();
          } });
        } else {
          this.burst(tx, a.y, 3, f.side === 'ally' ? '#fff1b0' : '#ffb0b0', 90, 3, 0.25);
        }
        break;
      }
      case 'tower': {
        const tx = e.x, ty = this.towerY(e.lane), to = this.pos(e.to);
        this.fx.push({ age: 0, dur: 0.3, draw: (c, p) => {
          c.strokeStyle = e.miss ? 'rgba(200,200,200,.5)' : '#ff9f43'; c.lineWidth = 3;
          const x = tx + (to.x - tx) * p, y = ty + (to.y - ty) * p;
          c.beginPath(); c.moveTo(x + 8, y); c.lineTo(x - 4, y); c.stroke();
        } });
        if (e.miss) this.texts.push({ x: to.x, y: to.y - 24, str: '빗나감', col: '#9fe0a0', life: 0.7, size: 13 });
        break;
      }
      case 'die': { const p = this.pos(e.u); this.burst(p.x, p.y, e.u.isLeader ? 30 : 10, e.u.side === 'ally' ? '#c08aff' : '#ffe08a', 160, 4, 0.6); break; }
      case 'revive': {
        const p = this.pos(e.u);
        this.burst(p.x, p.y, 18, '#7dffb2', 120, 4, 0.8);
        this.texts.push({ x: p.x, y: p.y - 30, str: '부활', col: '#7dffb2', life: 1, size: 16 });
        break;
      }
      case 'gateBreak':
        this.shake = 16; this.flash = 0.6;
        this.burst(e.x, LANE_CY[1], 70, '#c9a477', 320, 6, 1.1);
        this.banner('성문 파괴!', '#ffd166');
        break;
      case 'towerBreak':
        this.shake = 10;
        this.burst(e.x, this.towerY(e.lane), 50, '#d9c7a0', 260, 5, 0.9);
        this.banner('망루 붕괴', '#ffffff');
        break;
      case 'tunnelOpen':
        this.shake = 8;
        this.burst(this.s.castle.wallX + TUNNEL_IN, LANE_CY[2], 40, '#8b6a45', 200, 5, 0.9);
        this.banner('굴이 뚫렸다', '#c9a477');
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

  update(dt: number) {
    this.t += dt;
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.dur);
    for (const p of this.parts) { p.life -= dt; p.vx *= 0.92; p.vy *= 0.92; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const x of this.texts) { x.life -= dt; x.y -= 26 * dt; }
    this.texts = this.texts.filter((x) => x.life > 0);
    this.shake = Math.max(0, this.shake - 40 * dt);
    this.flash = Math.max(0, this.flash - 2 * dt);
    if (this.bannerQ[0]) { this.bannerQ[0].t += dt; if (this.bannerQ[0].t > 1.6) this.bannerQ.shift(); }
    if (this.follow) {
      const allies = this.s.units.filter((u) => u.side === 'ally' && u.alive);
      const front = allies.length ? Math.max(...allies.map((u) => u.x)) : 0;
      const want = Math.max(0, Math.min(this.s.castle.length + 140 - VW, front - VW * 0.55));
      this.camX += (want - this.camX) * Math.min(1, dt * 2.5);
    }
  }

  draw() {
    const c = this.ctx, s = this.s;
    const scale = this.canvas.width / VW;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.fillStyle = '#2d3a26'; c.fillRect(0, 0, VW, VH);
    c.save();
    c.translate(-this.camX + (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawGround(c);
    this.drawCastle(c);
    // 유닛: 위(먼 쪽)부터
    const list = s.units.filter((u) => u.alive || u.hitT > 0).map((u) => ({ u, p: this.pos(u) })).sort((a, b) => a.p.y - b.p.y);
    for (const { u, p } of list) this.drawUnit(c, u, p.x, p.y);
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
      c.lineWidth = 7; c.strokeStyle = '#140f1f'; c.strokeText(b.str, VW / 2, 70); c.fillStyle = b.col; c.fillText(b.str, VW / 2, 70);
      c.globalAlpha = 1;
    }
  }

  drawGround(c: CanvasRenderingContext2D) {
    const k = this.s.castle;
    // 풀밭 무늬
    c.fillStyle = '#34432b';
    for (let x = 0; x < k.length + 200; x += 80) for (let y = 0; y < VH; y += 80) if (((x + y) / 80) % 2 === 0) c.fillRect(x, y, 80, 80);
    // 레인 길(성 밖)
    const road = (lane: number, col: string) => { c.fillStyle = col; c.fillRect(-50, LANE_CY[lane] - LANE_H / 2 + 14, k.wallX + 50, LANE_H - 28); };
    road(0, 'rgba(120,110,90,.35)'); road(1, 'rgba(160,140,100,.55)');
    // 굴(지하): 성벽 밑을 점선으로 지나 안뜰 구멍으로
    if (k.tunnel) {
      c.strokeStyle = '#1a1410'; c.lineWidth = 34; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, LANE_CY[2]); c.lineTo(k.wallX - 24, LANE_CY[2]); c.stroke();
      c.setLineDash([16, 12]); c.lineWidth = 6; c.strokeStyle = this.s.tunnelOpen ? '#c9a477' : 'rgba(201,164,119,.35)';
      c.beginPath(); c.moveTo(k.wallX - 24, LANE_CY[2]); c.lineTo(k.wallX + TUNNEL_IN, LANE_CY[2]); c.stroke();
      c.setLineDash([]); c.lineCap = 'butt';
      if (!this.s.tunnelOpen) { c.fillStyle = '#c9a477'; c.fillRect(k.wallX - 70, LANE_CY[2] + 26, 60 * Math.min(1, this.s.tunnelWork / k.tunnelDig), 5); }
      c.fillStyle = this.s.tunnelOpen ? '#120d0a' : '#4a3a2c';
      c.beginPath(); c.ellipse(k.wallX + TUNNEL_IN, LANE_CY[2], 26, 18, 0, 0, 7); c.fill();
    }
    // 해자(성벽 앞 물길)
    if (k.moat) {
      // 규칙상 정문 레인만 느려지므로 정문 길 앞에만 그린다
      const top = LANE_CY[1] - LANE_H / 2, h = LANE_H;
      c.fillStyle = '#2d5d7c'; c.fillRect(k.moat[0], top, k.moat[1] - k.moat[0], h);
      c.fillStyle = 'rgba(255,255,255,.08)'; for (let y = top + 16; y < top + h - 10; y += 30) c.fillRect(k.moat[0] + 10, y + Math.sin(this.t * 2 + y) * 4, k.moat[1] - k.moat[0] - 20, 3);
    }
  }

  drawCastle(c: CanvasRenderingContext2D) {
    const s = this.s, k = s.castle;
    // 안뜰
    c.fillStyle = '#5b5148'; c.fillRect(k.wallX + 20, YARD_CY - YARD_H / 2 - 40, k.length - k.wallX + 120, YARD_H + 80);
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1;
    for (let x = k.wallX + 20; x < k.length + 140; x += 40) { c.beginPath(); c.moveTo(x, YARD_CY - YARD_H / 2 - 40); c.lineTo(x, YARD_CY + YARD_H / 2 + 40); c.stroke(); }
    // 성 안쪽 굴(지하 수비대가 지키는 통로)
    if (k.tunnel) { c.fillStyle = '#1e1714'; c.fillRect(k.wallX + 20, LANE_CY[2] - 22, TUNNEL_IN - 20, 44); }
    // 본관(핵심 지점)과 점거 원
    c.fillStyle = '#3d3550'; c.fillRect(k.coreX + 40, YARD_CY - 120, 160, 240);
    c.fillStyle = '#4f4566'; c.fillRect(k.coreX + 50, YARD_CY - 110, 140, 220);
    c.fillStyle = 'rgba(177,76,255,.12)'; c.beginPath(); c.arc(k.coreX, YARD_CY, 70, 0, 7); c.fill();
    c.strokeStyle = s.coreProg > 0 ? '#b14cff' : 'rgba(217,210,255,.5)'; c.lineWidth = 4;
    c.beginPath(); c.arc(k.coreX, YARD_CY, 70, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.max(0.001, s.coreProg / k.holdSec)); c.stroke();
    c.fillStyle = '#d9d2ff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('본관', k.coreX + 120, YARD_CY + 5);
    // 성벽(세로로 길게), 가운데 성문
    const gateTop = LANE_CY[1] - 45, gateBot = LANE_CY[1] + 45;
    c.fillStyle = '#6b6178';
    c.fillRect(k.wallX - 22, 30, 44, gateTop - 30);
    c.fillRect(k.wallX - 22, gateBot, 44, VH - 30 - gateBot);
    c.fillStyle = '#7d728c'; for (let y = 34; y < VH - 30; y += 26) { if (y > gateTop - 10 && y < gateBot) continue; c.fillRect(k.wallX - 26, y, 8, 14); }
    if (s.gateHp > 0) {
      c.fillStyle = '#6b4a2b'; c.fillRect(k.wallX - 16, gateTop, 32, gateBot - gateTop);
      c.strokeStyle = '#3a2614'; c.lineWidth = 3; for (let y = gateTop + 15; y < gateBot; y += 18) { c.beginPath(); c.moveTo(k.wallX - 16, y); c.lineTo(k.wallX + 16, y); c.stroke(); }
      bar(c, k.wallX, gateTop - 14, 60, s.gateHp / s.gateMax, '#ffb347');
    } else {
      c.fillStyle = '#3a2f28'; c.fillRect(k.wallX - 16, gateTop, 32, gateBot - gateTop);
    }
    // 망루(성벽 위 둥근 탑), 사거리를 반원으로
    for (const t of s.towers) {
      const ty = this.towerY(t.lane);
      if (!t.alive) { c.fillStyle = '#4a4252'; c.beginPath(); c.arc(t.x, ty, 20, 0, 7); c.fill(); continue; }
      c.strokeStyle = 'rgba(255,120,80,.18)'; c.lineWidth = 2; c.beginPath(); c.arc(t.x, ty, t.range, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
      c.fillStyle = '#80758f'; c.beginPath(); c.arc(t.x, ty, 26, 0, 7); c.fill();
      c.fillStyle = '#9c2b3b'; c.beginPath(); c.arc(t.x, ty, 16, 0, 7); c.fill();
      bar(c, t.x, ty - 38, 44, t.hp / t.max, '#ff6b6b');
    }
  }

  drawUnit(c: CanvasRenderingContext2D, u: Unit, px: number, py: number) {
    const lunge = u.lungeT > 0 ? Math.sin((u.lungeT / 0.15) * Math.PI) * 8 * (u.side === 'ally' ? 1 : -1) : 0;
    const bob = Math.sin(this.t * 7 + u.uid) * 1.2;
    const x = px + lunge;
    const fly = u.role === 'flying' ? 16 : 0;
    const r = u.isLeader ? 17 : u.side === 'foe' ? 9 : 8;
    c.save();
    if (!u.alive) c.globalAlpha = Math.max(0, u.hitT / 0.12);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py + r * 0.6, r * 0.9, r * 0.4, 0, 0, 7); c.fill();
    const y = py - fly + bob;
    const col = u.hitT > 0 ? '#ffffff' : ROLE_COL[u.role];
    if (u.side === 'ally') {
      c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + r * 0.35, y - r * 0.5); c.lineTo(x + r * 0.35, y + r * 0.5); c.fill();
      if (u.role === 'flying') {
        const w = Math.sin(this.t * 16 + u.uid) * 4;
        c.fillStyle = col; c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x - r - 8, y - r - w); c.lineTo(x - r - 2, y); c.lineTo(x - r - 8, y + r + w); c.fill();
      }
      if (u.isLeader) {
        const g = GRADES[u.grade as keyof typeof GRADES];
        c.strokeStyle = g.color; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 3, 0, 7); c.stroke();
        c.fillStyle = '#140f1f'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText(u.name[0], x - 2, y + 5);
        c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText(u.name, x, y - r - 14);
        bar(c, x, y - r - 10, 44, u.hp / u.max, '#62d394');
      } else if (u.revived) {
        c.strokeStyle = '#7dffb2'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 2, 0, 7); c.stroke();
      }
    } else {
      c.fillStyle = col; c.fillRect(x - r, y - r, r * 2, r * 2);
      c.fillStyle = u.foeType === 'captain' ? '#ffd166' : u.foeType === 'archer' ? '#7fb0ff' : '#5b6aa8';
      c.fillRect(x - r, y - r, r * 2, 4);
      if (u.foeType === 'captain' || u.foeType === 'knight') bar(c, x, y - r - 8, 28, u.hp / u.max, '#ff6b6b');
    }
    c.restore();
  }
}

function bar(c: CanvasRenderingContext2D, cx: number, y: number, w: number, p: number, col: string) {
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(cx - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col; c.fillRect(cx - w / 2, y, w * Math.max(0, Math.min(1, p)), 4);
}

export const roleLabel = (r: Role) => ROLES[r].label;
