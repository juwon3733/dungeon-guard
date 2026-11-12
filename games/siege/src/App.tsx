// 화면: 편성(Astryx) → 공성전(Canvas) → 결과. M1 시험장이라 모든 몬스터를 쓸 수 있다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Button } from '@astryxdesign/core/Button';
import { Card, VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { MONSTERS, MON, GRADES, ROLES, SKILLS } from './data/monsters';
import { CASTLES, LANE_NAMES, type Lane } from './data/castles';
import { createSiege, step, stars, retreat, troopCap, cmdOf, cast, canCast, setOrders, type SquadPlan, type SiegeState } from './core/siege';
import { SiegeView, VW, VH } from './render/view';

const LEADERS = MONSTERS.filter((m) => m.grade !== 'common');
const TROOPS = MONSTERS.filter((m) => m.grade === 'common' || m.grade === 'rare');
const monLabel = (id: string) => { const m = MON[id]; return `${m.name} · ${GRADES[m.grade].label} ${ROLES[m.role].label}`; };

const DEFAULT: SquadPlan[] = [
  { leader: 'ogre_chief', lane: 1, delay: 0, troops: [{ id: 'skeleton', count: 3 }, { id: 'goblin', count: 3 }] },
  { leader: 'harpy', lane: 0, delay: 0, troops: [{ id: 'bat', count: 2 }, { id: 'goblin', count: 2 }] },
  { leader: 'bone_archer', lane: 1, delay: 5, troops: [{ id: 'imp', count: 4 }, { id: 'kobold', count: 0 }] },
];

export default function App() {
  const [plans, setPlans] = useState<SquadPlan[]>(DEFAULT);
  const [castleId] = useState(CASTLES[0].id);
  const [battle, setBattle] = useState<null | { plans: SquadPlan[] }>(null);
  const castle = CASTLES.find((c) => c.id === castleId)!;
  return (
    <Theme theme={neutralTheme} mode="dark">
      {battle
        ? <Battle plans={battle.plans} castleId={castleId} onExit={() => setBattle(null)} />
        : <Formation plans={plans} setPlans={setPlans} castle={castle} onStart={() => setBattle({ plans: structuredClone(plans) })} />}
    </Theme>
  );
}

// ---------------- 편성 ----------------
function Formation({ plans, setPlans, castle, onStart }: {
  plans: SquadPlan[]; setPlans: (p: SquadPlan[]) => void; castle: (typeof CASTLES)[number]; onStart: () => void;
}) {
  const [estimate, setEstimate] = useState<string>('');
  const update = (i: number, f: (p: SquadPlan) => SquadPlan) => { setPlans(plans.map((p, j) => (j === i ? f(structuredClone(p)) : p))); setEstimate(''); };
  const runEstimate = () => {
    let win = 0; const n = 20;
    for (let seed = 1; seed <= n; seed++) { const s = createSiege(castle, plans, { seed }); while (!s.over) step(s, 1 / 20); if (s.over.win) win++; }
    setEstimate(`자동 진행 기준 예상 승률 ${Math.round((win / n) * 100)}% (직접 지휘하면 달라집니다)`);
  };
  const laneInfo = [
    `망루 ${castle.towers.filter((t) => t.lane === 0).length}, 성벽 궁수. 비행이나 성벽 진입 지휘 효과가 있어야 넘는다.`,
    `해자${castle.moat ? ' 있음' : ' 없음'}, 성문 체력 ${castle.gateHp}, 망루 ${castle.towers.filter((t) => t.lane === 1).length}, 정문 수비대.`,
    castle.tunnel ? `굴을 파야 열린다(굴착 몬스터: 굴착 고블린, 거대 쥐). 지하 수비대.` : '지하 길 없음.',
  ];
  return (
    <div className="page">
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={1}>마계 진군 · 공성 시험장</Heading>
          <Text color="secondary">M1 시험판: 모든 몬스터를 쓸 수 있습니다. 부대장일 때만 지휘 효과가 켜집니다.</Text>
        </VStack>
        <Card padding={4}>
          <VStack gap={2}>
            <HStack gap={2}><Heading level={2}>{castle.name}</Heading><Badge label={`제한 ${castle.timeLimit}초`} /></HStack>
            <Text color="secondary">{castle.tip}</Text>
            <div className="lanes">
              {laneInfo.map((t, i) => (
                <div className="lane-box" key={i}><Text weight="bold">{['위', '가운데', '아래'][i]} · {LANE_NAMES[i]}</Text><br /><Text size="sm" color="secondary">{t}</Text></div>
              ))}
            </div>
          </VStack>
        </Card>
        <div className="squads">
          {plans.map((p, i) => <SquadCard key={i} idx={i} plan={p} onChange={(f) => update(i, f)} tunnel={castle.tunnel} />)}
        </div>
        <HStack gap={3}>
          <Button label="공성 시작" variant="primary" size="lg" onClick={onStart} />
          <Button label="예상 승률 계산" onClick={runEstimate} />
          {estimate && <Text color="secondary">{estimate}</Text>}
        </HStack>
      </VStack>
    </div>
  );
}

function SquadCard({ idx, plan, onChange, tunnel }: { idx: number; plan: SquadPlan; onChange: (f: (p: SquadPlan) => SquadPlan) => void; tunnel: boolean }) {
  const leader = MON[plan.leader];
  const cap = troopCap(plan.leader);
  const used = plan.troops.reduce((a, t) => a + t.count, 0);
  const g = GRADES[leader.grade];
  const setTroop = (k: number, patch: Partial<{ id: string; count: number }>) => onChange((p) => {
    p.troops[k] = { ...p.troops[k], ...patch };
    // 수용량을 넘으면 다른 칸을 줄인다
    let over = p.troops.reduce((a, t) => a + t.count, 0) - troopCap(p.leader);
    for (let j = p.troops.length - 1; j >= 0 && over > 0; j--) { if (j === k) continue; const cut = Math.min(over, p.troops[j].count); p.troops[j].count -= cut; over -= cut; }
    if (over > 0) p.troops[k].count -= over;
    return p;
  });
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2}><Heading level={3}>{idx + 1}부대</Heading><Badge label={`${g.label} 부대장 · 병력 ${used}/${cap}`} /></HStack>
        <Selector label="부대장" value={plan.leader}
          options={LEADERS.map((m) => ({ value: m.id, label: monLabel(m.id) }))}
          onChange={(v) => onChange((p) => { p.leader = v; let left = troopCap(v); p.troops.forEach((t) => { t.count = Math.min(t.count, left); left -= t.count; }); return p; })} />
        <Text size="sm" color="secondary"><span className="dot" style={{ background: g.color }} />지휘 효과: {leader.command?.desc ?? '없음'}</Text>
        {SKILLS[plan.leader] && <Text size="sm" color="secondary">스킬 「{SKILLS[plan.leader].name}」({SKILLS[plan.leader].cd}초): {SKILLS[plan.leader].desc}</Text>}
        {plan.troops.map((t, k) => (
          <HStack gap={2} key={k}>
            <Selector label={`병력 ${k + 1}`} value={t.id} options={TROOPS.map((m) => ({ value: m.id, label: monLabel(m.id) }))} onChange={(v) => setTroop(k, { id: v })} />
            <NumberInput label="수" value={t.count} min={0} max={cap} onChange={(v) => setTroop(k, { count: Math.max(0, Math.floor(v ?? 0)) })} />
          </HStack>
        ))}
        <SegmentedControl label="레인" value={String(plan.lane)} onChange={(v) => onChange((p) => { p.lane = Number(v) as Lane; return p; })}>
          {LANE_NAMES.map((n, i) => <SegmentedControlItem key={i} value={String(i)} label={n} isDisabled={i === 2 && !tunnel} />)}
        </SegmentedControl>
        <SegmentedControl label="출발" value={String(plan.delay)} onChange={(v) => onChange((p) => { p.delay = Number(v); return p; })}>
          {[0, 5, 10, 20].map((d) => <SegmentedControlItem key={d} value={String(d)} label={d ? `${d}초 뒤` : '바로'} />)}
        </SegmentedControl>
      </VStack>
    </Card>
  );
}

// ---------------- 공성전 ----------------
function Battle({ plans, castleId, onExit }: { plans: SquadPlan[]; castleId: string; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);                   // 다시 하기
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, force] = useState(0);
  const ref = useRef<{ s: SiegeState; view: SiegeView } | null>(null);
  const ctl = useRef({ paused, speed });
  ctl.current = { paused, speed };
  const castle = useMemo(() => CASTLES.find((c) => c.id === castleId)!, [castleId]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = VW * 1.5; canvas.height = VH * 1.5;
    let view: SiegeView | null = null;
    const s = createSiege(castle, plans, { emit: (e) => view?.onEvent(e) });
    view = new SiegeView(canvas, s);
    ref.current = { s, view };
    let last = performance.now(), raf = 0, hud = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (view!.updateCutin(dt)) { /* 컷인 중에는 전투를 멈춘다 */ }
      else if (!ctl.current.paused) {
        let rem = dt * ctl.current.speed;
        while (rem > 1e-6) { const d = Math.min(1 / 30, rem); step(s, d); rem -= d; }
        view!.update(dt * ctl.current.speed);
      }
      view!.draw();
      if ((hud += dt) > 0.2) { hud = 0; force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= s.squads.length) cast(s, n - 1); if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, [plans, castle, run]);

  const s = ref.current?.s;
  return (
    <div className="battle">
      <div className="battle-top">
        <HStack gap={3}>
          <Heading level={3}>{castle.name}</Heading>
          <Text hasTabularNumbers>{s ? `${Math.floor(s.t)}초 / ${castle.timeLimit}초` : ''}</Text>
          <div style={{ width: 200 }}><ProgressBar label="핵심 지점 점거" value={s ? Math.min(castle.holdSec, s.coreProg) : 0} max={castle.holdSec} /></div>
          <Button label={paused ? '계속' : '일시정지'} onClick={() => setPaused(!paused)} />
          <Button label={`×${speed}`} onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)} />
          <Button label="편성으로" variant="ghost" onClick={onExit} />
        </HStack>
      </div>
      <div className="battle-field"><canvas ref={canvasRef} /></div>
      <div className="battle-bottom">
        <div className="squad-hud">
          {s?.squads.map((q) => {
            const alive = s.units.filter((u) => u.side === 'ally' && u.squad === q.idx && u.alive).length;
            const leaderOk = !!q.leader?.alive;
            const active = !!cmdOf(s, q.idx).desc;
            return (
              <Card key={q.idx} padding={3}>
                <VStack gap={2}>
                <HStack gap={2}>
                  <VStack gap={0}>
                    <Text weight="bold">{q.idx + 1}부대 · {MON[q.plan.leader].name} ({LANE_NAMES[q.plan.lane]})</Text>
                    <Text size="sm" color="secondary">{!q.started ? `출발 대기 ${Math.max(0, Math.ceil(q.plan.delay - s.t))}초` : q.retreated ? '후퇴함' : `생존 ${alive} · 지휘 효과 ${active ? '켜짐' : leaderOk ? '-' : '꺼짐(부대장 쓰러짐)'}`}</Text>
                  </VStack>
                </HStack>
                <HStack gap={2}>
                  {q.skill && <Button size="sm" variant="primary" label={q.skillCd > 0 ? `${q.idx + 1} ${q.skill.name} ${Math.ceil(q.skillCd)}초` : `${q.idx + 1} ${q.skill.name}`}
                    isDisabled={!canCast(s, q.idx)} onClick={() => cast(s, q.idx)} />}
                  <Button size="sm" label={q.orders.advance ? '전진 중' : '정지 중'} onClick={() => setOrders(s, q.idx, { advance: !q.orders.advance })} />
                  {q.plan.lane === 1 && <Button size="sm" label={q.orders.gate === 'attack' ? '성문 공격' : '성문 대기'} isDisabled={s.gateHp <= 0} onClick={() => setOrders(s, q.idx, { gate: q.orders.gate === 'attack' ? 'wait' : 'attack' })} />}
                  <Button label="후퇴" size="sm" variant="destructive" isDisabled={!q.started || q.retreated || !alive || !!s.over} onClick={() => retreat(s, q.idx)} />
                </HStack>
                </VStack>
              </Card>
            );
          })}
        </div>
      </div>
      {s?.over && (
        <div className="result">
          <Card padding={6}>
            <VStack gap={3}>
              <Heading level={2}>{s.over.win ? '점령 성공' : '공성 실패'}</Heading>
              <Text>{s.over.reason} · {Math.floor(s.t)}초 · 쓰러진 아군 {s.stats.allyDead} · 쓰러뜨린 적 {s.stats.foeDead}</Text>
              {s.over.win && <Text weight="bold">{'★'.repeat(stars(s))}{'☆'.repeat(3 - stars(s))}  (★2 부대장 전원 생존, ★3 120초 안에)</Text>}
              <HStack gap={2}>
                <Button label="다시 하기" variant="primary" onClick={() => setRun(run + 1)} />
                <Button label="편성으로" onClick={onExit} />
              </HStack>
            </VStack>
          </Card>
        </div>
      )}
    </div>
  );
}
