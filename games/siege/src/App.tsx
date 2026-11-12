// 화면: 본부(지도·군단·던전·소환과 감옥) → 편성 → 공성전(Canvas) → 결과와 보상. 진행은 브라우저에 저장된다.
import { useEffect, useRef, useState } from 'react';
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
import { MON, GRADES, ROLES, SKILLS, type Grade } from './data/monsters';
import { LANE_NAMES, type Lane, type Castle } from './data/castles';
import { createSiege, step, stars, retreat, troopCap, cmdOf, cast, canCast, setOrders, type SquadPlan, type SiegeState } from './core/siege';
import { SiegeView, VW, VH } from './render/view';
import {
  load, save, fresh, REGIONS, FACILITIES, SUMMON_COST, CORRUPT_COST, capUsed, capMax, squadSlots, threat, unlocked, regionCastle,
  upgrade, summon, corrupt, checkPlans, applyResult, facValue, type Meta, type Region, type FacId,
  lvOf, awOf, trainCost, train, awaken, MAX_LV, MAX_AW, boostOf, squadBoostOf, people, gift, setAide, regionCaptain, corruptNamed,
} from './meta/campaign';
import { PEOPLE, CORRUPT_NAMED_COST, giftCost, affinityBoost } from './data/characters';

const GRADE_ORDER: Grade[] = ['myth', 'legend', 'hero', 'rare', 'common'];
const monLabel = (id: string) => { const m = MON[id]; return `${m.name} · ${GRADES[m.grade].label} ${ROLES[m.role].label}`; };

type Screen = { k: 'hub' } | { k: 'form'; region: Region } | { k: 'battle'; region: Region; castle: Castle; plans: SquadPlan[]; captain?: string };

export default function App() {
  const [meta, setMeta] = useState<Meta>(load);
  const [screen, setScreen] = useState<Screen>({ k: 'hub' });
  const [plans, setPlans] = useState<SquadPlan[]>([]);
  /** meta를 바꾸는 함수를 받아 복사본에 적용하고 저장한다 */
  const mutate = <T,>(f: (m: Meta) => T): T => { const m = structuredClone(meta); const r = f(m); setMeta(m); save(m); return r; };

  const openForm = (region: Region) => {
    // 이전 편성을 부대 수와 보유 몬스터에 맞춰 다듬어 쓴다
    const slots = squadSlots(meta);
    // 기본 부대장: 높은 등급부터, 같은 등급이면 근접 하나 → 사격 하나 → 나머지 순으로 섞는다
    const ROLE_PICK = ['siege', 'shield', 'assault', 'ranged', 'support', 'flying'];
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
      next.push(plans[i] && meta.owned[plans[i].leader] ? structuredClone(plans[i]) : { leader: leaders[i], lane: laneFor(leaders[i]), delay: i * 3, troops: [] });
    }
    // 병력은 남은 일반 몬스터로 부대마다 수용량까지 자동으로 채운다(나중에 바꿀 수 있음)
    const left: Record<string, number> = {};
    for (const [id, n] of Object.entries(meta.owned)) if (MON[id].grade === 'common') left[id] = n;
    for (const p of next) for (const t of p.troops) if (left[t.id] != null) left[t.id] = Math.max(0, left[t.id] - t.count);
    for (const p of next) {
      if (p.troops.some((t) => t.count > 0)) continue;
      let need = troopCap(p.leader); p.troops = [];
      // 부대장 역할에 맞는 병력을 먼저(사격 → 사격, 비행 → 비행, 굴착 → 굴착, 돌격 → 돌격, 그 외 → 방패)
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
    setPlans(next);
    setScreen({ k: 'form', region });
  };

  return (
    <Theme theme={neutralTheme} mode="dark">
      {screen.k === 'hub' && <Hub meta={meta} mutate={mutate} onSortie={openForm} onReset={() => { const m = fresh(); setMeta(m); save(m); }} />}
      {screen.k === 'form' && (
        <Formation meta={meta} region={screen.region} plans={plans} setPlans={setPlans} onBack={() => setScreen({ k: 'hub' })}
          onStart={() => {
            const castle = regionCastle(meta, screen.region);
            const ps = structuredClone(plans).map((p) => (p.lane === 2 && !castle.tunnel ? { ...p, lane: 1 as Lane } : p));
            setScreen({ k: 'battle', region: screen.region, castle, plans: ps, captain: regionCaptain(meta, screen.region) });
          }} />
      )}
      {screen.k === 'battle' && (
        <Battle plans={screen.plans} castle={screen.castle} captain={screen.captain}
          boost={(id) => boostOf(meta, id)} squadBoost={(id) => squadBoostOf(meta, id)}
          onFinish={(win, st, leaders, mvp) => mutate((m) => applyResult(m, screen.region, win, st, leaders, mvp))}
          onExit={() => setScreen({ k: 'hub' })} onRetry={() => openForm(screen.region)} />
      )}
    </Theme>
  );
}

// ---------------- 본부 ----------------
function Hub({ meta, mutate, onSortie, onReset }: { meta: Meta; mutate: <T>(f: (m: Meta) => T) => T; onSortie: (r: Region) => void; onReset: () => void }) {
  const [tab, setTab] = useState('map');
  const [msg, setMsg] = useState('');
  return (
    <div className="page">
      <VStack gap={4}>
        <HStack gap={3}>
          <Heading level={1}>마계 진군</Heading>
          <Badge label={`금화 ${meta.gold}`} /><Badge label={`마석 ${meta.mana}`} /><Badge label={`명성 ${meta.fame}`} />
          <Badge label={`군단 ${capUsed(meta)}/${capMax(meta)}`} /><Badge label={`출전 ${squadSlots(meta)}부대`} /><Badge label={`위협도 ${threat(meta)}`} />
        </HStack>
        {meta.aide && PEOPLE[meta.aide] && (
          <Card padding={3}><HStack gap={2}><Badge label="측근" variant="warning" /><Text weight="bold">{MON[meta.aide].name}</Text>
            <Text color="secondary">「{PEOPLE[meta.aide].lines[(meta.affinity[meta.aide] ?? 0) >= 10 ? 10 : (meta.affinity[meta.aide] ?? 0) >= 5 ? 5 : 2]}」 · {PEOPLE[meta.aide].aide.desc}</Text></HStack></Card>
        )}
        <SegmentedControl label="본부" value={tab} onChange={(v) => { setTab(v); setMsg(''); }}>
          <SegmentedControlItem value="map" label="지도" />
          <SegmentedControlItem value="army" label="군단" />
          <SegmentedControlItem value="dungeon" label="던전 시설" />
          <SegmentedControlItem value="summon" label="소환 · 감옥" />
          <SegmentedControlItem value="dorm" label="숙소" />
        </SegmentedControl>
        {msg && <Text weight="bold">{msg}</Text>}
        {tab === 'map' && <MapTab meta={meta} onSortie={onSortie} />}
        {tab === 'army' && <ArmyTab meta={meta} onTrain={(id) => setMsg(mutate((m) => train(m, id)) ?? `${MON[id].name} 레벨 ${lvOf(meta, id) + 1}`)}
          onAwaken={(id) => setMsg(mutate((m) => awaken(m, id)) ?? `${MON[id].name} 각성 ${awOf(meta, id) + 1}`)} />}
        {tab === 'dorm' && <DormTab meta={meta} setMsg={setMsg} mutate={mutate} />}
        {tab === 'dungeon' && <DungeonTab meta={meta} onUpgrade={(f) => setMsg(mutate((m) => upgrade(m, f)) ?? `${FACILITIES[f].name}을(를) 올렸습니다.`)} />}
        {tab === 'summon' && <SummonTab meta={meta} setMsg={setMsg} mutate={mutate} />}
        <HStack gap={2}><Button size="sm" variant="ghost" label="진행 처음부터" onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) onReset(); }} /></HStack>
      </VStack>
    </div>
  );
}

function MapTab({ meta, onSortie }: { meta: Meta; onSortie: (r: Region) => void }) {
  return (
    <div className="squads">
      {REGIONS.map((r, i) => {
        const open = unlocked(meta, r), done = r.id in meta.conquered, c = regionCastle(meta, r);
        return (
          <Card key={r.id} padding={4}>
            <VStack gap={2}>
              <HStack gap={2}>
                <Heading level={3}>{i + 1}. {r.name}</Heading>
                {done ? <Badge label={`점령 ${'★'.repeat(meta.conquered[r.id])}`} variant="success" /> : open ? <Badge label="공략 가능" variant="info" /> : <Badge label="잠김" />}
              </HStack>
              <Text size="sm" color="secondary">{r.desc}</Text>
              <Text size="sm">수비 강도 {c.power} · 망루 {c.towers.length} · {c.tunnel ? '지하 길 있음' : '지하 길 없음'}{c.moat ? ' · 해자' : ''}</Text>
              <Text size="sm" color="secondary">보상 금화 {r.gold} · 마석 {r.mana}{done ? ' (다시 공략은 절반)' : ''} · 사는 몬스터: {r.wild.map((id) => MON[id].name).join(', ')}</Text>
              <Button label={done ? '다시 공략' : '출격'} variant={done ? 'secondary' : 'primary'} isDisabled={!open} onClick={() => onSortie(r)} />
            </VStack>
          </Card>
        );
      })}
    </div>
  );
}

function ArmyTab({ meta, onTrain, onAwaken }: { meta: Meta; onTrain: (id: string) => void; onAwaken: (id: string) => void }) {
  const ids = Object.keys(meta.owned).filter((id) => meta.owned[id] > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(MON[a].grade) - GRADE_ORDER.indexOf(MON[b].grade));
  return (
    <div className="squads">
      {ids.map((id) => {
        const m = MON[id], g = GRADES[m.grade];
        return (
          <Card key={id} padding={3}>
            <VStack gap={1}>
              <HStack gap={2}><span className="dot" style={{ background: g.color }} /><Text weight="bold">{m.name}</Text><Badge label={`${g.label} ${ROLES[m.role].label}`} /><Text>×{meta.owned[id]}</Text>
                <Badge label={`Lv ${lvOf(meta, id)}`} />{awOf(meta, id) > 0 && <Badge label={`각성 ${awOf(meta, id)}`} variant="warning" />}</HStack>
              <HStack gap={2}>
                <Button size="sm" label={lvOf(meta, id) >= MAX_LV ? '최고 레벨' : `훈련 · 금화 ${trainCost(meta, id)}`} isDisabled={lvOf(meta, id) >= MAX_LV || meta.gold < trainCost(meta, id)} onClick={() => onTrain(id)} />
                {(m.grade !== 'common' && m.grade !== 'rare') && <Button size="sm" label={awOf(meta, id) >= MAX_AW ? '최고 각성' : '각성 (같은 몬스터 1 소모)'} isDisabled={awOf(meta, id) >= MAX_AW || meta.owned[id] < 2} onClick={() => onAwaken(id)} />}
              </HStack>
              {m.command && <Text size="sm" color="secondary">지휘 효과: {m.command.desc}</Text>}
              {SKILLS[id] && <Text size="sm" color="secondary">스킬 「{SKILLS[id].name}」: {SKILLS[id].desc}</Text>}
              {!m.command && <Text size="sm" color="secondary">병력 전용</Text>}
            </VStack>
          </Card>
        );
      })}
    </div>
  );
}

function DungeonTab({ meta, onUpgrade }: { meta: Meta; onUpgrade: (f: FacId) => void }) {
  return (
    <div className="squads">
      {(Object.keys(FACILITIES) as FacId[]).map((f) => {
        const F = FACILITIES[f], lv = meta.fac[f], next = F.costs[lv + 1];
        return (
          <Card key={f} padding={4}>
            <VStack gap={2}>
              <HStack gap={2}><Heading level={3}>{F.name}</Heading><Badge label={`${lv + 1}단계`} /></HStack>
              <Text size="sm" color="secondary">{F.desc}</Text>
              <Text>지금: {facValue(meta, f)}{F.unit}{next != null ? ` → 다음: ${F.values[lv + 1]}${F.unit}` : ''}</Text>
              {next != null
                ? <Button label={`올리기 · 금화 ${next}`} isDisabled={meta.gold < next} onClick={() => onUpgrade(f)} />
                : <Badge label="최고 단계" />}
            </VStack>
          </Card>
        );
      })}
    </div>
  );
}

function DormTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  const ids = people(meta);
  if (!ids.length) return <Card padding={4}><Text color="secondary">아직 숙소에 사는 동료가 없습니다. 적장을 사로잡아 타락시키거나, 포로를 타락시키거나, 서큐버스·박쥐 여왕·해마녀 같은 사람 모습 몬스터를 얻으면 방이 생깁니다.</Text></Card>;
  return (
    <div className="squads">
      {ids.map((id) => {
        const P = PEOPLE[id], a = meta.affinity[id] ?? 0, m = MON[id], g = GRADES[m.grade];
        const boost = Math.round((affinityBoost(a) - 1) * 100);
        return (
          <Card key={id} padding={4}>
            <VStack gap={2}>
              <HStack gap={2}><span className="dot" style={{ background: g.color }} /><Heading level={3}>{m.name}</Heading>{meta.aide === id && <Badge label="측근" variant="warning" />}</HStack>
              {P.human && <Text size="sm" color="secondary">타락 전: {P.human}</Text>}
              <ProgressBar label={`호감도 ${a}/10${boost ? ` · 이끄는 부대 능력 +${boost}%` : ''}`} value={a} max={10} />
              {([2, 5, 10] as const).map((lv) => (
                <Text key={lv} size="sm" color={a >= lv ? undefined : 'secondary'}>{a >= lv ? `「${P.lines[lv]}」` : `🔒 호감도 ${lv}에서 열리는 이야기`}</Text>
              ))}
              <Text size="sm" color="secondary">측근 효과: {P.aide.desc}</Text>
              <HStack gap={2}>
                <Button size="sm" label={a >= 10 ? '호감도 최대' : `선물 · 금화 ${giftCost(a)}`} isDisabled={a >= 10 || meta.gold < giftCost(a)} onClick={() => setMsg(mutate((mm) => gift(mm, id)) ?? `${m.name} 호감도 ${a + 1}`)} />
                <Button size="sm" variant={meta.aide === id ? 'primary' : 'secondary'} label={meta.aide === id ? '측근' : '측근으로'} isDisabled={meta.aide === id || a < 3} onClick={() => setMsg(mutate((mm) => setAide(mm, id)) ?? `${m.name}을(를) 측근으로 두었습니다.`)} />
              </HStack>
            </VStack>
          </Card>
        );
      })}
    </div>
  );
}

function SummonTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  return (
    <div className="squads">
      <Card padding={4}>
        <VStack gap={2}>
          <Heading level={3}>소환진</Heading>
          <Text size="sm" color="secondary">마석 {SUMMON_COST}개로 마계에서 몬스터를 부른다. 일반은 3마리씩 온다. 소환진 단계가 높을수록 높은 등급이 나온다(지금 {facValue(meta, 'circle')}단계).</Text>
          <Button label={`소환 · 마석 ${SUMMON_COST}`} variant="primary" isDisabled={meta.mana < SUMMON_COST} onClick={() => {
            const r = mutate((m) => summon(m));
            setMsg(typeof r === 'string' ? r : `소환: ${GRADES[MON[r.id].grade].label} ${MON[r.id].name}${r.n > 1 ? ` ×${r.n}` : ''}`);
          }} />
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={2}>
          <Heading level={3}>감옥</Heading>
          <Text size="sm" color="secondary">공성에서 사로잡은 포로를 타락 의식(마석 {CORRUPT_COST})으로 마족으로 만든다. 서큐버스, 타락 기사, 늪의 마녀, 드물게 흡혈 군주.</Text>
          <Text>포로 {meta.captives} / {facValue(meta, 'prison')}</Text>
          {meta.named.map((id) => (
            <HStack gap={2} key={id}>
              <Badge label="사로잡은 적장" variant="error" /><Text weight="bold">{PEOPLE[id].human}</Text>
              <Button size="sm" variant="primary" label={`타락 의식 · 마석 ${CORRUPT_NAMED_COST}`} isDisabled={meta.mana < CORRUPT_NAMED_COST} onClick={() => {
                const r = mutate((m) => corruptNamed(m, id));
                setMsg(r ?? `「${PEOPLE[id].human}」 → 「${MON[id].name}」(${GRADES[MON[id].grade].label}). 숙소에 방이 생겼습니다.`);
              }} />
            </HStack>
          ))}
          <Button label={`타락 의식 · 마석 ${CORRUPT_COST}`} isDisabled={meta.captives <= 0 || meta.mana < CORRUPT_COST} onClick={() => {
            const r = mutate((m) => corrupt(m));
            setMsg(typeof r === 'string' ? r : `타락: ${GRADES[MON[r.id].grade].label} ${MON[r.id].name}이(가) 군단에 합류했습니다.`);
          }} />
        </VStack>
      </Card>
    </div>
  );
}

// ---------------- 편성 ----------------
function Formation({ meta, region, plans, setPlans, onBack, onStart }: {
  meta: Meta; region: Region; plans: SquadPlan[]; setPlans: (p: SquadPlan[]) => void; onBack: () => void; onStart: () => void;
}) {
  const castle = regionCastle(meta, region);
  const [estimate, setEstimate] = useState('');
  const update = (i: number, f: (p: SquadPlan) => SquadPlan) => { setPlans(plans.map((p, j) => (j === i ? f(structuredClone(p)) : p))); setEstimate(''); };
  const problem = plans.length === 0 ? '부대장을 맡을 희귀 이상 몬스터가 없습니다.' : checkPlans(meta, plans);
  const leaders = Object.keys(meta.owned).filter((id) => MON[id].grade !== 'common' && meta.owned[id] > 0);
  const troops = Object.keys(meta.owned).filter((id) => (MON[id].grade === 'common' || MON[id].grade === 'rare') && meta.owned[id] > 0);
  const runEstimate = () => {
    let win = 0; const n = 20;
    for (let seed = 1; seed <= n; seed++) { const s = createSiege(castle, plans, { seed }); while (!s.over) step(s, 1 / 20); if (s.over.win) win++; }
    setEstimate(`자동 진행 기준 예상 승률 ${Math.round((win / n) * 100)}% (스킬과 명령을 쓰면 달라집니다)`);
  };
  const laneInfo = [
    `망루 ${castle.towers.filter((t) => t.lane === 0).length}${castle.towers.some((t) => t.antiAir) ? ' (쇠뇌탑 있음: 비행에 강함)' : ''}, 성벽 궁수. 비행이나 성벽 진입 지휘 효과가 있어야 넘는다.`,
    `해자${castle.moat ? ' 있음' : ' 없음'}, 성문 체력 ${Math.round(castle.gateHp * castle.power)}, 망루 ${castle.towers.filter((t) => t.lane === 1).length}, 정문 수비대.`,
    castle.tunnel ? '굴을 파야 열린다(굴착 몬스터: 굴착 고블린, 거대 쥐). 지하 수비대.' : '지하 길 없음.',
  ];
  return (
    <div className="page">
      <VStack gap={4}>
        <HStack gap={3}><Button label="← 본부" variant="ghost" onClick={onBack} /><Heading level={1}>{region.name} 공성 편성</Heading><Badge label={`수비 강도 ${castle.power}`} /><Badge label={`제한 ${castle.timeLimit}초`} /></HStack>
        <Card padding={4}>
          <VStack gap={2}>
            <Text color="secondary">{castle.tip}</Text>
            <div className="lanes">
              {laneInfo.map((t, i) => (
                <div className="lane-box" key={i}><Text weight="bold">{['위', '가운데', '아래'][i]} · {LANE_NAMES[i]}</Text><br /><Text size="sm" color="secondary">{t}</Text></div>
              ))}
            </div>
          </VStack>
        </Card>
        <div className="squads">
          {plans.map((p, i) => <SquadCard key={i} idx={i} plan={p} leaders={leaders} troops={troops} meta={meta} onChange={(f) => update(i, f)} tunnel={castle.tunnel} />)}
        </div>
        <HStack gap={3}>
          <Button label="공성 시작" variant="primary" size="lg" isDisabled={!!problem} onClick={onStart} />
          <Button label="예상 승률 계산" isDisabled={!!problem} onClick={runEstimate} />
          {problem ? <Text weight="bold">편성 문제: {problem}</Text> : estimate && <Text color="secondary">{estimate}</Text>}
        </HStack>
      </VStack>
    </div>
  );
}

function SquadCard({ idx, plan, leaders, troops, meta, onChange, tunnel }: {
  idx: number; plan: SquadPlan; leaders: string[]; troops: string[]; meta: Meta; onChange: (f: (p: SquadPlan) => SquadPlan) => void; tunnel: boolean;
}) {
  const leader = MON[plan.leader];
  const cap = troopCap(plan.leader);
  const used = plan.troops.reduce((a, t) => a + t.count, 0);
  const g = GRADES[leader.grade];
  const setTroop = (k: number, patch: Partial<{ id: string; count: number }>) => onChange((p) => {
    p.troops[k] = { ...p.troops[k], ...patch };
    let over = p.troops.reduce((a, t) => a + t.count, 0) - troopCap(p.leader);
    for (let j = p.troops.length - 1; j >= 0 && over > 0; j--) { if (j === k) continue; const cut = Math.min(over, p.troops[j].count); p.troops[j].count -= cut; over -= cut; }
    if (over > 0) p.troops[k].count -= over;
    return p;
  });
  const troopOpts = Array.from(new Set([...troops, ...plan.troops.map((t) => t.id)])).map((id) => ({ value: id, label: `${monLabel(id)} (보유 ${meta.owned[id] ?? 0})` }));
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2}><Heading level={3}>{idx + 1}부대</Heading><Badge label={`${g.label} 부대장 · 병력 ${used}/${cap}`} /></HStack>
        <Selector label="부대장" value={plan.leader} options={Array.from(new Set([...leaders, plan.leader])).map((id) => ({ value: id, label: `${monLabel(id)} (보유 ${meta.owned[id] ?? 0})` }))}
          onChange={(v) => onChange((p) => { p.leader = v; let left = troopCap(v); p.troops.forEach((t) => { t.count = Math.min(t.count, left); left -= t.count; }); return p; })} />
        <Text size="sm" color="secondary"><span className="dot" style={{ background: g.color }} />지휘 효과: {leader.command?.desc ?? '없음'}</Text>
        {SKILLS[plan.leader] && <Text size="sm" color="secondary">스킬 「{SKILLS[plan.leader].name}」({SKILLS[plan.leader].cd}초): {SKILLS[plan.leader].desc}</Text>}
        {plan.troops.map((t, k) => (
          <HStack gap={2} key={k}>
            <Selector label={`병력 ${k + 1}`} value={t.id} options={troopOpts} onChange={(v) => setTroop(k, { id: v })} />
            <NumberInput label="수" value={t.count} min={0} max={cap} onChange={(v) => setTroop(k, { count: Math.max(0, Math.floor(v ?? 0)) })} />
          </HStack>
        ))}
        <SegmentedControl label="레인" value={String(plan.lane)} onChange={(v) => onChange((p) => { p.lane = Number(v) as Lane; return p; })}>
          {LANE_NAMES.map((n, i) => <SegmentedControlItem key={i} value={String(i)} label={n} isDisabled={i === 2 && !tunnel} />)}
        </SegmentedControl>
        <SegmentedControl label="출발" value={String(plan.delay)} onChange={(v) => onChange((p) => { p.delay = Number(v); return p; })}>
          {[0, 3, 6, 10, 20].map((d) => <SegmentedControlItem key={d} value={String(d)} label={d ? `${d}초 뒤` : '바로'} />)}
        </SegmentedControl>
      </VStack>
    </Card>
  );
}

// ---------------- 공성전 ----------------
function Battle({ plans, castle, captain, boost, squadBoost, onFinish, onExit, onRetry }: {
  plans: SquadPlan[]; castle: Castle; captain?: string; boost: (id: string) => number; squadBoost: (id: string) => number;
  onFinish: (win: boolean, stars: number, leaders: string[], mvp: string | null) => string[]; onExit: () => void; onRetry: () => void;
}) {
  const [mvp, setMvp] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, force] = useState(0);
  const [reward, setReward] = useState<string[] | null>(null);
  const ref = useRef<{ s: SiegeState; view: SiegeView } | null>(null);
  const ctl = useRef({ paused, speed });
  ctl.current = { paused, speed };
  const finished = useRef(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = VW * 1.5; canvas.height = VH * 1.5;
    let view: SiegeView | null = null;
    const s = createSiege(castle, plans, { emit: (e) => view?.onEvent(e), boost, squadBoost, captainName: captain });
    view = new SiegeView(canvas, s);
    ref.current = { s, view };
    let last = performance.now(), raf = 0, hud = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (view!.updateCutin(dt)) { /* 연출 중에는 전투를 멈춘다 */ }
      else if (!ctl.current.paused) {
        let rem = dt * ctl.current.speed;
        while (rem > 1e-6) { const d = Math.min(1 / 30, rem); step(s, d); rem -= d; }
        view!.update(dt * ctl.current.speed);
      }
      view!.draw();
      if (s.over && !finished.current) {
        finished.current = true;
        // MVP: 적에게 가장 많은 피해를 준 부대의 부대장
        let best = -1, bi = -1;
        s.dmgBy.forEach((d, i) => { if (d > best) { best = d; bi = i; } });
        const mv = s.over.win && bi >= 0 ? plans[bi].leader : null;
        setMvp(mv);
        setReward(finishRef.current(s.over.win, stars(s), plans.map((p) => p.leader), mv));
      }
      if ((hud += dt) > 0.2) { hud = 0; force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= s.squads.length) cast(s, n - 1); if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, [plans, castle]);

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
          <Button label="포기하고 본부로" variant="ghost" onClick={onExit} />
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
                  <VStack gap={0}>
                    <Text weight="bold">{q.idx + 1}부대 · {MON[q.plan.leader].name} ({LANE_NAMES[q.plan.lane]})</Text>
                    <Text size="sm" color="secondary">{!q.started ? `출발 대기 ${Math.max(0, Math.ceil(q.plan.delay - s.t))}초` : q.retreated ? '후퇴함' : `생존 ${alive} · 지휘 효과 ${active ? '켜짐' : leaderOk ? '-' : '꺼짐(부대장 쓰러짐)'}`}</Text>
                  </VStack>
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
              {mvp && (
                <Card padding={3}><HStack gap={2}><Badge label="MVP" variant="warning" /><Text weight="bold">{MON[mvp].name}</Text>
                  <Text color="secondary">「{PEOPLE[mvp]?.mvp ?? '이 정도는 식은 죽 먹기지.'}」</Text></HStack></Card>
              )}
              {reward?.map((line, i) => <Text key={i}>{line}</Text>)}
              <HStack gap={2}>
                <Button label="본부로" variant="primary" onClick={onExit} />
                <Button label="편성 바꿔 다시" onClick={onRetry} />
              </HStack>
            </VStack>
          </Card>
        </div>
      )}
    </div>
  );
}
