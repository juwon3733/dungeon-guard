// 전쟁 지도: 양피지 위에 지역을 성 모양 점으로, 진군로로 잇는다. 점을 누르면 옆에 정보와 출격.
import { useState } from 'react';
import { MON } from '../data/monsters';
import { PEOPLE, COMMANDERS } from '../data/characters';
import { REGIONS, unlocked, regionCastle, regionCaptain, type Meta, type Region } from '../meta/campaign';
import { IconGold, IconMana, IconThreat } from './icons';

// 지도 위 자리(가로 1200 × 세로 560)
const POS: Record<string, [number, number]> = {
  r1: [90, 420], r2: [190, 300], r3: [300, 400], r4: [400, 260], r5: [500, 360], r6: [600, 450], r7: [650, 300],
  r8: [770, 210], r9: [860, 300], r10: [930, 170], r11: [1000, 300],
  r12: [1060, 420], r13: [1110, 150], r14: [1150, 290],
};
const CHAPTERS = [{ name: '1장 · 국경 지대', x: 60, w: 650 }, { name: '2장 · 산맥과 왕도', x: 720, w: 320 }, { name: '3장 · 왕성', x: 1040, w: 150 }];

export function WorldMap({ meta, onSortie }: { meta: Meta; onSortie: (r: Region) => void }) {
  const next = REGIONS.find((r) => !(r.id in meta.conquered) && unlocked(meta, r)) ?? REGIONS[REGIONS.length - 1];
  const [sel, setSel] = useState<string>(next.id);
  const r = REGIONS.find((x) => x.id === sel)!;
  const open = unlocked(meta, r), done = r.id in meta.conquered;
  const c = regionCastle(meta, r);
  const skulls = Math.max(1, Math.min(5, Math.round(c.power * 2)));
  const captain = regionCaptain(meta, r);
  const cmd = COMMANDERS[r.id];
  return (
    <div className="worldmap">
      <div className="map-canvas">
      <svg className="worldmap-svg" viewBox="0 0 1200 560" role="img" aria-label="전쟁 지도">
        <defs>
          <radialGradient id="parch" cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#d9c497" /><stop offset="0.7" stopColor="#c2a571" /><stop offset="1" stopColor="#8c6f43" /></radialGradient>
          <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.6" fill="rgba(90,60,30,.12)" /></pattern>
        </defs>
        <rect width="1200" height="560" fill="url(#parch)" />
        <rect width="1200" height="560" fill="url(#grain)" />
        {/* 바다(왼쪽 아래)와 강 */}
        <path d="M0 470 C80 450 140 500 220 520 L220 560 L0 560 Z" fill="#7d9aa6" opacity=".55" />
        <path d="M250 0 C280 120 240 220 330 330 C400 410 520 430 610 520 L640 560" fill="none" stroke="#6f8e9c" strokeWidth="9" opacity=".6" />
        {/* 산맥 */}
        {[[720, 120], [760, 90], [800, 130], [840, 95], [880, 140], [700, 190], [960, 230], [1000, 200]].map(([x, y], i) => (
          <g key={i} opacity=".75"><path d={`M${x - 34} ${y + 30} L${x} ${y - 24} L${x + 34} ${y + 30} Z`} fill="#8a7458" /><path d={`M${x} ${y - 24} L${x + 10} ${y - 6} L${x - 8} ${y - 8} Z`} fill="#efe6d4" /></g>
        ))}
        {/* 숲 */}
        {[[150, 200], [175, 215], [200, 195], [430, 470], [455, 485], [480, 465], [560, 220], [585, 235], [1080, 520], [1100, 505]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="13" fill="#5f7a44" opacity=".7" />
        ))}
        {/* 왕성 쪽 성벽 그림 */}
        <path d="M1110 60 h70 v40 h-70z" fill="#7a6a5a" opacity=".5" />
        {/* 장 구분 */}
        {CHAPTERS.map((ch) => (
          <g key={ch.name}><text x={ch.x + ch.w / 2} y="34" textAnchor="middle" className="map-chapter">{ch.name}</text></g>
        ))}
        <path d="M712 50 V540 M1036 50 V540" stroke="rgba(90,60,30,.35)" strokeDasharray="6 8" />
        {/* 진군로 */}
        {REGIONS.slice(1).map((reg, i) => {
          const a = POS[REGIONS[i].id], b = POS[reg.id];
          const walked = reg.id in meta.conquered || (REGIONS[i].id in meta.conquered && unlocked(meta, reg));
          return <path key={reg.id} d={`M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 - 30} ${b[0]} ${b[1]}`} fill="none"
            stroke={walked ? '#8c1f2e' : 'rgba(90,60,30,.45)'} strokeWidth={walked ? 4 : 3} strokeDasharray={walked ? undefined : '4 8'} />;
        })}
        {/* 지역 */}
        {REGIONS.map((reg, i) => {
          const [x, y] = POS[reg.id], isOpen = unlocked(meta, reg), isDone = reg.id in meta.conquered, isSel = reg.id === sel;
          const boss = reg.id === 'r7' || reg.id === 'r11' || reg.id === 'r14';
          const k = boss ? 1.35 : 1;
          return (
            <g key={reg.id} className={`map-node${isOpen ? '' : ' locked'}`} transform={`translate(${x} ${y})`} onClick={() => setSel(reg.id)} role="button" aria-label={reg.name} tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setSel(reg.id); }}>
              {isSel && <circle r={30 * k} fill="none" stroke="#f5d27a" strokeWidth="3" className="map-sel" />}
              {isOpen && !isDone && <circle r={22 * k} fill="rgba(245,210,122,.35)" className="map-pulse" />}
              <g transform={`scale(${k})`}>
                <ellipse cy="14" rx="18" ry="6" fill="rgba(60,40,20,.35)" />
                <path d="M-14 12 V-6 h4 v-5 h4 v5 h4 v-5 h4 v5 h4 v-5 h4 v5 h4 V12 Z" fill={isDone ? '#5b3b6e' : isOpen ? '#6e5a44' : '#8c7a64'} stroke="#2a1e14" strokeWidth="1.5" />
                <rect x="-4" y="2" width="8" height="10" fill="#2a1e14" />
                {isDone && <><path d="M0 -11 V-30" stroke="#2a1e14" strokeWidth="2" /><path d="M0 -30 L16 -25 L0 -20 Z" fill="#a33245" /></>}
              </g>
              <text y={34 * k} textAnchor="middle" className="map-label">{i + 1}. {reg.name}</text>
              {isDone && <text y={48 * k} textAnchor="middle" className="map-stars">{'★'.repeat(meta.conquered[reg.id])}</text>}
            </g>
          );
        })}
      </svg>
      </div>
      <aside className="map-panel">
        <div className="map-panel-title">{r.name}</div>
        <div className="map-panel-sub">{done ? `점령 ${'★'.repeat(meta.conquered[r.id])}` : open ? '공략 가능' : '앞 지역을 점령하면 열린다'}</div>
        <p className="map-panel-desc">{r.desc}</p>
        <div className="map-row"><span>수비</span><span className="pips">{Array.from({ length: 5 }, (_, i) => <span key={i} style={{ opacity: i < skulls ? 1 : 0.2 }}><IconThreat size={15} /></span>)}</span></div>
        <div className="map-row"><span>성채</span><span>{[c.tunnel ? '굴' : null, c.moat ? '해자' : null, c.towers.some((t) => t.antiAir) ? '쇠뇌탑' : null, c.towers.some((t) => t.barrier) ? '결계' : null].filter(Boolean).join(' · ') || '평범한 성벽'}</span></div>
        {cmd && <div className="map-row"><span>적장</span><span>{captain ?? (meta.owned[cmd] ? `${MON[cmd].name} (동료)` : '사로잡음')}</span></div>}
        <div className="map-row"><span>전리품</span><span className="pips"><IconGold size={15} />{done ? Math.round(r.gold / 2) : r.gold}<IconMana size={15} />{done ? Math.round(r.mana / 2) : r.mana}</span></div>
        <div className="map-row"><span>사는 것</span><span className="faint">{r.wild.map((id) => MON[id].name).join(', ')}</span></div>
        <button className="btn-war" disabled={!open} onClick={() => onSortie(r)}>{done ? '다시 공략' : '출격'}</button>
        {cmd && captain && <div className="map-hint">★2 이상으로 점령하면 {PEOPLE[cmd].human}을(를) 사로잡는다</div>}
      </aside>
    </div>
  );
}
