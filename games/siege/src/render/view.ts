// 공성전 화면(Canvas): Asteria처럼 위에서 비스듬히 내려다보는 3/4 시점. 왼쪽(아군 진영) → 오른쪽(성)으로 진군.
// 땅은 화면 전체, 높이가 있는 물체는 윗면과 앞(남쪽)면이 보이게 그린다.
// 규칙은 core/siege.ts. 레인은 위아래로 나란한 띠: 0=북쪽 성벽 구간, 1=가운데 정문 길, 2=남쪽 굴.
import type { SiegeState, SiegeEvent, Unit } from '../core/siege';
import { TUNNEL_IN } from '../core/siege';
import { GRADES, ROLES, MON, type Role } from '../data/monsters';

export const VW = 1280, VH = 720;
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
  cutin: null | { name: string; skill: string; grade: string; role: Role; t: number; dur: number } = null;

  constructor(public canvas: HTMLCanvasElement, public s: SiegeState) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** 땅 위의 발 위치. 성 안에 들어오면 안뜰로 퍼진다 */
  pos(u: { x: number; lane: number; uid?: number }) {
    const c = this.s.castle;
    const j = u.uid != null ? jitter(u.uid) : 0;
    const laneY = LANE_CY[u.lane] + j * (LANE_H * (u.lane === 2 ? 0.08 : 0.3));
    const enter = u.lane === 2 ? c.wallX + TUNNEL_IN : c.wallX + 30;
    if (u.x <= enter) return { x: u.x, y: laneY };
    const k = Math.min(1, (u.x - enter) / 120);
    const yardY = YARD_CY + j * (YARD_H * 0.36);
    return { x: u.x, y: laneY + (yardY - laneY) * k };
  }
  laneY(lane: number) { return LANE_CY[lane]; }
  towerBase(lane: number) { return lane === 0 ? LANE_CY[0] - 10 : LANE_CY[1] - 70; }
  banner(str: string, col: string) { this.bannerQ.push({ str, col, t: 0 }); }

  onEvent(e: SiegeEvent) {
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
        this.cutin = { name: e.leader.name, skill: e.skill.name, grade: g, role: e.leader.role as Role, t: 0, dur: g === 'hero' ? 0.85 : 1.15 };
        break;
      }
      case 'skillHit': this.skillFx(e.kind, e.x, this.laneY(e.lane), e.r ?? 100); break;
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
    if (!this.cutin) return false;
    this.cutin.t += dt;
    if (this.cutin.t >= this.cutin.dur) { this.cutin = null; this.flash = 0.35; this.shake = 8; return false; }
    return true;
  }

  update(dt: number) {
    this.t += dt;
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.dur);
    for (const p of this.parts) { p.life -= dt; p.vx *= 0.92; p.vy *= 0.92; p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const x of this.texts) { x.life -= dt; x.y -= 26 * dt; }
    this.texts = this.texts.filter((x) => x.life > 0);
    this.shake = Math.max(0, this.shake - 40 * dt);
    this.flash = Math.max(0, this.flash - 2 * dt);
    if (this.bannerQ[0]) { this.bannerQ[0].t += dt; if (this.bannerQ[0].t > 1.6) this.bannerQ.shift(); }
    if (this.follow) {
      const allies = this.s.units.filter((u) => u.side === 'ally' && u.alive);
      const front = allies.length ? Math.max(...allies.map((u) => u.x)) : 0;
      const want = Math.max(0, Math.min(this.s.castle.length + 160 - VW, front - VW * 0.55));
      this.camX += (want - this.camX) * Math.min(1, dt * 2.5);
    }
  }

  draw() {
    const c = this.ctx, s = this.s, k = s.castle;
    const scale = this.canvas.width / VW;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.fillStyle = '#4a6b3a'; c.fillRect(0, 0, VW, VH);
    c.save();
    c.translate(-this.camX + (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawIsland(c);
    this.drawFloor(c);

    // 높이가 있는 것(유닛, 망루, 성벽 조각, 본관)은 발 위치 y 순서로 그린다
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const u of s.units) if (u.alive || u.hitT > 0) { const p = this.pos(u); items.push({ y: p.y, draw: () => this.drawUnit(c, u, p.x, p.y) }); }
    this.wallItems(items);
    for (const t of s.towers) { const by = this.towerBase(t.lane); items.push({ y: by + 1, draw: () => this.drawTower(c, t, by) }); }
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
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, VW, VH); }
    const b = this.bannerQ[0];
    if (b) {
      const a = Math.min(1, b.t * 5) * (b.t > 1.2 ? Math.max(0, 1 - (b.t - 1.2) / 0.4) : 1);
      c.globalAlpha = a; c.textAlign = 'center'; c.font = 'italic 900 40px sans-serif';
      c.lineWidth = 7; c.strokeStyle = '#140f1f'; c.strokeText(b.str, VW / 2, 70); c.fillStyle = b.col; c.fillText(b.str, VW / 2, 70);
      c.globalAlpha = 1;
    }
    if (this.cutin) this.drawCutin(c);
  }

  /** 컷인: 화면이 어두워지고 등급 색 띠가 사선으로 지나가며 부대장과 스킬 이름이 크게 나온다 */
  drawCutin(c: CanvasRenderingContext2D) {
    const ci = this.cutin!, p = ci.t / ci.dur;
    const inn = Math.min(1, p / 0.2), out = p > 0.82 ? (p - 0.82) / 0.18 : 0;
    const e = 1 - Math.pow(1 - inn, 3), a = 1 - out;
    const col = GRADES[ci.grade as keyof typeof GRADES].color;
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.6 * a})`; c.fillRect(0, 0, VW, VH);
    c.globalAlpha = a;
    c.translate((1 - e) * -VW, 0);
    const top = 250, h = 220;
    c.fillStyle = col; c.beginPath(); c.moveTo(-40, top + 40); c.lineTo(VW + 40, top - 20); c.lineTo(VW + 40, top + h - 60); c.lineTo(-40, top + h); c.closePath(); c.fill();
    c.fillStyle = 'rgba(16,12,28,.85)'; c.beginPath(); c.moveTo(-40, top + 56); c.lineTo(VW + 40, top - 4); c.lineTo(VW + 40, top + h - 76); c.lineTo(-40, top + h - 16); c.closePath(); c.fill();
    // 집중선
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const y = top + 10 + ((i * 47) % (h - 30)); const xx = VW - ((p * 2600 + i * 170) % (VW + 300)); c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + 80 + (i % 4) * 40, y); c.stroke(); }
    // 부대장(크게)
    const fx = 260 + (1 - e) * 80, fy = top + h - 24;
    this.drawFigure(c, fx, fy, 6.5, ROLE_COL[ci.role], ci.role === 'flying');
    // 글자
    c.textAlign = 'right';
    c.font = 'bold 22px sans-serif'; c.fillStyle = col; c.fillText(`${GRADES[ci.grade as keyof typeof GRADES].label} · ${ci.name}`, VW - 80, top + 70);
    c.font = 'italic 900 72px sans-serif'; c.lineWidth = 10; c.strokeStyle = '#140f1f'; c.strokeText(ci.skill, VW - 80, top + 150);
    c.fillStyle = '#ffffff'; c.fillText(ci.skill, VW - 80, top + 150);
    c.restore();
  }

  /** 컷인용 큰 캐릭터(유닛 그림과 같은 모양을 크게) */
  drawFigure(c: CanvasRenderingContext2D, x: number, feet: number, k: number, body: string, flying: boolean) {
    const bw = 12 * k, bh = 14 * k, hr = 6.5 * k, dark = shade(body, 0.7);
    c.fillStyle = dark; c.fillRect(x - bw * 0.35, feet - 5 * k, bw * 0.25, 5 * k); c.fillRect(x + bw * 0.1, feet - 5 * k, bw * 0.25, 5 * k);
    c.fillStyle = body; roundRect(c, x - bw / 2, feet - 5 * k - bh, bw, bh, 3 * k); c.fill();
    const hy = feet - 5 * k - bh - hr + 2;
    c.fillStyle = shade(body, 1.15); c.beginPath(); c.arc(x, hy, hr, 0, 7); c.fill();
    c.fillStyle = '#140f1f'; c.fillRect(x + hr * 0.25, hy - k, 2 * k, 2.5 * k);
    if (flying) { c.fillStyle = dark; c.beginPath(); c.moveTo(x - 2, feet - bh * 0.8); c.lineTo(x - bw - 10 * k, feet - bh - 10 * k); c.lineTo(x - bw * 0.6, feet - bh * 0.4); c.fill(); }
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

  drawTower(c: CanvasRenderingContext2D, t: { x: number; alive: boolean; hp: number; max: number; range: number }, by: number) {
    const r = 24;
    if (!t.alive) {
      c.fillStyle = '#5a5066'; c.beginPath(); c.ellipse(t.x, by, r, r * 0.5, 0, 0, 7); c.fill();
      c.fillStyle = '#4a4252'; c.fillRect(t.x - r, by - 18, r * 2, 18); c.beginPath(); c.ellipse(t.x, by - 18, r, r * 0.5, 0, 0, 7); c.fill();
      return;
    }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(t.x, by + 4, r + 6, (r + 6) * 0.45, 0, 0, 7); c.fill();
    c.fillStyle = '#6a6079'; c.fillRect(t.x - r, by - TOWER_H, r * 2, TOWER_H);              // 몸통 앞면
    c.fillStyle = '#5a5068'; c.beginPath(); c.ellipse(t.x, by, r, r * 0.5, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#8b8098'; c.beginPath(); c.ellipse(t.x, by - TOWER_H, r, r * 0.5, 0, 0, 7); c.fill();   // 윗면
    c.fillStyle = '#a33245'; c.beginPath(); c.moveTo(t.x - r - 4, by - TOWER_H); c.lineTo(t.x, by - TOWER_H - 40); c.lineTo(t.x + r + 4, by - TOWER_H); c.fill();   // 지붕
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

  drawUnit(c: CanvasRenderingContext2D, u: Unit, px: number, py: number) {
    const lunge = u.lungeT > 0 ? Math.sin((u.lungeT / 0.15) * Math.PI) * 8 * (u.side === 'ally' ? 1 : -1) : 0;
    const step = Math.abs(Math.sin(this.t * 9 + u.uid)) * 2;
    const x = px + lunge;
    const fly = u.role === 'flying' ? 30 + Math.sin(this.t * 4 + u.uid) * 3 : 0;
    const big = u.isLeader ? 1.9 : u.foeType === 'captain' ? 1.6 : u.foeType === 'knight' ? 1.2 : 1;
    const bw = 12 * big, bh = 14 * big, hr = 6.5 * big;
    c.save();
    if (!u.alive) c.globalAlpha = Math.max(0, u.hitT / 0.12);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py, bw * 0.8, bw * 0.32, 0, 0, 7); c.fill();
    const feet = py - fly - step;
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
      c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText(u.name, x, hy - hr - 14);
      bar(c, x, hy - hr - 10, 44, u.hp / u.max, '#62d394');
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
