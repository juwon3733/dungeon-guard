// 화면: 본부(지도·군단·던전·소환과 감옥) → 편성 → 공성전(Canvas) → 결과와 보상. 진행은 브라우저에 저장된다.
import { sfx, muted, setMuted } from './audio/sfx';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppShell } from '@astryxdesign/core/AppShell';
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { SelectableCard } from '@astryxdesign/core/SelectableCard';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Grid } from '@astryxdesign/core/Grid';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Banner } from '@astryxdesign/core/Banner';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { Map as MapIcon, Swords, Castle as CastleIcon, Sparkles, BedDouble, Coins, Gem, Star, Users, Skull, Hourglass, ChevronLeft, ChevronUp, ChevronDown, ChevronsRight, Square, Flag, Play, Pause, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Theme } from '@astryxdesign/core/theme';
import { gothicTheme } from '@astryxdesign/theme-gothic/built';
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
import { createSiege, step, stars, retreat, troopCap, cmdOf, cast, canCast, setOrders, autoDeploy, deploy, canDeploy, deployCost, CMD_MAX, GEARS, type Gear, type SquadPlan, type SiegeState } from './core/siege';
import { SQUAD_COL } from './render/view';
import { SiegeView, VW, VH } from './render/view';
import {
  load, save, fresh, REGIONS, FACILITIES, SUMMON_COST, capUsed, capMax, squadSlots, threat, unlocked, regionCastle,
  upgrade, summon, corrupt, checkPlans, applyResult, facValue, type Meta, type Region, type FacId,
  release, buyMana, EXCHANGE, CONTRACTS, contractState, signContract, PRISONERS, prisonerCount, type PrisonerType, namedCost, lvOf, awOf, trainCost, train, awaken, MAX_LV, MAX_AW, boostOf, squadBoostOf, people, gift, setAide, regionCaptain, corruptNamed,
} from './meta/campaign';
import { PEOPLE, giftCost, affinityBoost } from './data/characters';
import { autoForm } from './meta/autoform';
import { WorldMap } from './ui/WorldMap';
import { IconGold, IconMana, IconFame, IconArmy, IconThreat, RoomIcon } from './ui/icons';

const GRADE_ORDER: Grade[] = ['myth', 'legend', 'hero', 'rare', 'common'];
const GRADE_BADGE: Record<Grade, 'neutral' | 'blue' | 'purple' | 'orange' | 'red'> = { common: 'neutral', rare: 'blue', hero: 'purple', legend: 'orange', myth: 'red' };
const monLabel = (id: string) => { const m = MON[id]; return `${m.name} · ${GRADES[m.grade].label} ${ROLES[m.role].label}`; };

type Screen = { k: 'hub' } | { k: 'form'; region: Region } | { k: 'battle'; region: Region; castle: Castle; plans: SquadPlan[]; captain?: string };

export default function App() {
  const [meta, setMeta] = useState<Meta>(load);
  const [screen, setScreen] = useState<Screen>({ k: 'hub' });
  const [plans, setPlans] = useState<SquadPlan[]>([]);
  /** meta를 바꾸는 함수를 받아 복사본에 적용하고 저장한다 */
  const mutate = <T,>(f: (m: Meta) => T): T => { const m = structuredClone(meta); const r = f(m); setMeta(m); save(m); return r; };

  const openForm = (region: Region) => {
    // 이전 편성을 살리고 빈 자리는 알아서 채운다(src/meta/autoform.ts)
    const next = autoForm(meta, region, plans);
    setPlans(next);
    setScreen({ k: 'form', region });
  };

  return (
    <Theme theme={gothicTheme} mode="dark">
      {screen.k === 'hub' && <Hub meta={meta} mutate={mutate} onSortie={openForm} onReset={() => { const m = fresh(); setMeta(m); save(m); }} />}
      {screen.k === 'form' && (
        <Formation meta={meta} region={screen.region} plans={plans} setPlans={setPlans} onBack={() => setScreen({ k: 'hub' })}
          onStart={() => {
            const gearCost = plans.reduce((a, p) => a + (p.gear ? GEARS[p.gear].cost : 0), 0);
            if (gearCost) mutate((m) => { m.gold -= gearCost; });
            const castle = regionCastle(meta, screen.region);
            const ps = structuredClone(plans).map((p) => (p.lane === 2 && !castle.tunnel ? { ...p, lane: 1 as Lane } : p));
            setScreen({ k: 'battle', region: screen.region, castle, plans: ps, captain: regionCaptain(meta, screen.region) });
          }} />
      )}
      {screen.k === 'battle' && (
        <Battle plans={screen.plans} castle={screen.castle} captain={screen.captain}
          boost={(id) => boostOf(meta, id)} squadBoost={(id) => squadBoostOf(meta, id)}
          onFinish={(win, st, leaders, mvp, defeated) => mutate((m) => applyResult(m, screen.region, win, st, leaders, mvp, Math.random, defeated))}
          onExit={() => setScreen({ k: 'hub' })} onRetry={() => openForm(screen.region)} />
      )}
    </Theme>
  );
}

// ---------------- 본부 ----------------
const ROOMS: { k: string; name: string; icon: LucideIcon }[] = [
  { k: 'map', name: '전쟁 지도', icon: MapIcon }, { k: 'army', name: '군단 막사', icon: Swords }, { k: 'dungeon', name: '던전 시설', icon: CastleIcon },
  { k: 'summon', name: '소환진 · 감옥', icon: Sparkles }, { k: 'dorm', name: '숙소', icon: BedDouble },
];

/** 상단 자원 한 칸 */
const Res = ({ icon: I, v, sub, tip }: { icon: LucideIcon; v: number; sub?: string; tip: string }) => (
  <Tooltip content={tip}><HStack gap={1}><I size={16} /><Text weight="semibold">{v}</Text>{sub && <Text size="sm" color="secondary">{sub}</Text>}</HStack></Tooltip>
);

function Hub({ meta, mutate, onSortie, onReset }: { meta: Meta; mutate: <T>(f: (m: Meta) => T) => T; onSortie: (r: Region) => void; onReset: () => void }) {
  const [tab, setTab] = useState('map');
  const [msg, setMsg] = useState('');
  const aideLine = meta.aide && PEOPLE[meta.aide] ? PEOPLE[meta.aide].lines[(meta.affinity[meta.aide] ?? 0) >= 10 ? 10 : (meta.affinity[meta.aide] ?? 0) >= 5 ? 5 : 2] : null;
  const newPrison = meta.named.length > 0 || Object.values(meta.prisoners).some((n) => n > 0);
  return (
    <AppShell height="fill" variant="elevated" contentPadding={4}
      topNav={<TopNav label="본부" heading={<TopNavHeading heading="마계 진군" />}
        endContent={<HStack gap={5}>
          <Res icon={Coins} v={meta.gold} tip="금화" />
          <Res icon={Gem} v={meta.mana} tip="마석" />
          <Res icon={Star} v={meta.fame} tip="명성" />
          <Res icon={Users} v={capUsed(meta)} sub={`/${capMax(meta)}`} tip="군단 수용량" />
          <Res icon={Skull} v={threat(meta)} tip="위협도: 점령할수록 남은 성채가 강해진다" />
        </HStack>} />}
      sideNav={<SideNav
        footer={<VStack gap={3} padding={2}>
          {aideLine && <Card variant="muted" padding={3}><VStack gap={1}><Text size="sm" weight="semibold" color="accent">{MON[meta.aide!].name}</Text><Text size="sm" color="secondary">「{aideLine}」</Text></VStack></Card>}
          <Button label="처음부터 다시" variant="ghost" size="sm" onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) onReset(); }} />
        </VStack>}>
        <SideNavSection title="본부" isHeaderHidden>
          {ROOMS.map((r) => (
            <SideNavItem key={r.k} label={r.name} icon={r.icon} isSelected={tab === r.k} onClick={() => { setTab(r.k); setMsg(''); }}
              endContent={r.k === 'summon' && newPrison ? <Badge variant="error" label="포로" /> : undefined} />
          ))}
        </SideNavSection>
      </SideNav>}>
      <VStack gap={4}>
        {msg && <Banner key={msg} status="info" title={msg} isDismissable onDismiss={() => setMsg('')} />}
        {tab === 'map' && <WorldMap meta={meta} onSortie={onSortie} />}
        {tab === 'army' && <ArmyTab meta={meta} onTrain={(id) => setMsg(mutate((m) => train(m, id)) ?? `${MON[id].name} 레벨 ${lvOf(meta, id) + 1}`)}
          onRelease={(id) => { if (confirm(`${MON[id].name}을(를) ${MON[id].grade === 'common' ? '3마리' : '1마리'} 내보낼까요?`)) setMsg(mutate((m) => release(m, id)) ?? `${MON[id].name} 내보냄`); }}
          onAwaken={(id) => setMsg(mutate((m) => awaken(m, id)) ?? `${MON[id].name} 각성 ${awOf(meta, id) + 1}`)} />}
        {tab === 'dorm' && <DormTab meta={meta} setMsg={setMsg} mutate={mutate} />}
        {tab === 'dungeon' && <DungeonTab meta={meta} onUpgrade={(f) => setMsg(mutate((m) => upgrade(m, f)) ?? `${FACILITIES[f].name} ▲`)}
          onExchange={() => setMsg(mutate((m) => buyMana(m)) ?? `마석 +${EXCHANGE.mana}`)} />}
        {tab === 'summon' && <SummonTab meta={meta} setMsg={setMsg} mutate={mutate} />}
      </VStack>
    </AppShell>
  );
}

const glyphOf = (id: string) => (PEOPLE[id] ? MON[id].name.split(' ').pop()! : MON[id].name.split(' ')[0]).slice(0, 1);
/** 몬스터·시설 카드(그림이 오면 여기에 들어간다) */
function PickCard({ label, glyph, color, top, corner, sel, onPick, dim }: { label: string; glyph: string; color: string; top?: string; corner?: string; sel: boolean; onPick: () => void; dim?: boolean }) {
  return (
    <SelectableCard label={label} isSelected={sel} onChange={onPick} padding={2} isDisabled={dim}>
      <VStack gap={1}>
        <HStack gap={1}><Text size="2xs" color="secondary">{top ?? ''}</Text><div style={{ flex: 1 }} />{corner && <Text size="2xs" weight="bold">{corner}</Text>}</HStack>
        <div className="pick-glyph" style={{ color }}>{glyph}</div>
        <Text size="xsm" maxLines={1} justify="center">{label}</Text>
      </VStack>
    </SelectableCard>
  );
}

/** 왼쪽 목록 + 오른쪽 상세 */
function Split({ list, side }: { list: ReactNode; side: ReactNode }) {
  return (
    <div className="split">
      <VStack gap={4}>{list}</VStack>
      <Card padding={5} elevation="low"><VStack gap={3} height="100%">{side}</VStack></Card>
    </div>
  );
}
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <VStack gap={2}><Text type="label" color="secondary">{title}</Text><Grid columns={{ minWidth: 92, repeat: 'fill' }} gap={2}>{children}</Grid></VStack>
);

function ArmyTab({ meta, onTrain, onAwaken, onRelease }: { meta: Meta; onTrain: (id: string) => void; onAwaken: (id: string) => void; onRelease: (id: string) => void }) {
  const ids = Object.keys(meta.owned).filter((id) => meta.owned[id] > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(MON[a].grade) - GRADE_ORDER.indexOf(MON[b].grade) || lvOf(meta, b) - lvOf(meta, a));
  const [sel, setSel] = useState<string>(ids[0]);
  const cur = meta.owned[sel] ? sel : ids[0];
  const m = MON[cur], g = GRADES[m.grade];
  const groups: [string, string[]][] = [['지휘관', ids.filter((id) => MON[id].grade !== 'common')], ['병졸', ids.filter((id) => MON[id].grade === 'common')]];
  const maxed = lvOf(meta, cur) >= MAX_LV;
  return (
    <Split
      list={groups.map(([title, list]) => list.length > 0 && (
        <Group key={title} title={title}>
          {list.map((id) => <PickCard key={id} label={MON[id].name} glyph={glyphOf(id)} color={GRADES[MON[id].grade].color} sel={id === cur} onPick={() => setSel(id)}
            top={`Lv${lvOf(meta, id)}${awOf(meta, id) ? ` ✦${awOf(meta, id)}` : ''}`} corner={meta.owned[id] > 1 ? `×${meta.owned[id]}` : undefined} />)}
        </Group>
      ))}
      side={<>
        <Heading level={2}>{m.name}</Heading>
        <HStack gap={2}><Badge label={g.label} variant={GRADE_BADGE[m.grade]} /><Badge label={ROLES[m.role].label} /><Text size="sm" color="secondary">Lv {lvOf(meta, cur)}{awOf(meta, cur) ? ` · 각성 ${awOf(meta, cur)}` : ''} · {meta.owned[cur]}마리</Text></HStack>
        {PEOPLE[cur]?.human && <Text color="secondary">{PEOPLE[cur].human}이었다.</Text>}
        <MetadataList>
          {m.command && <MetadataListItem label="지휘">{m.command.desc}</MetadataListItem>}
          {SKILLS[cur] && <MetadataListItem label={SKILLS[cur].name}>{SKILLS[cur].desc}</MetadataListItem>}
          {!m.command && <MetadataListItem label="역할">부대장 밑에서 싸우는 병졸</MetadataListItem>}
        </MetadataList>
        <div style={{ flex: 1 }} />
        <Button label={maxed ? '단련 끝' : `단련 · 마석 ${trainCost(meta, cur)}`} variant="primary" width="100%" isDisabled={maxed || meta.mana < trainCost(meta, cur)} onClick={() => onTrain(cur)} />
        {m.grade !== 'common' && m.grade !== 'rare' && (
          <Button label={awOf(meta, cur) >= MAX_AW ? '각성 끝' : meta.owned[cur] < 2 ? '각성 · 같은 몬스터 하나 더 필요' : '각성 · 같은 몬스터 1'} width="100%"
            isDisabled={awOf(meta, cur) >= MAX_AW || meta.owned[cur] < 2} onClick={() => onAwaken(cur)} />
        )}
        <Button label={m.grade === 'common' ? '3마리 내보내기' : '내보내기'} variant="ghost" width="100%" onClick={() => onRelease(cur)} />
      </>} />
  );
}

const FAC_GLYPH: Record<string, string> = { nest: '巢', warroom: '戰', circle: '召', mine: '鑛', prison: '獄', forge: '冶' };
function DungeonTab({ meta, onUpgrade, onExchange }: { meta: Meta; onUpgrade: (f: FacId) => void; onExchange: () => void }) {
  const keys = Object.keys(FACILITIES) as FacId[];
  const [sel, setSel] = useState<FacId>('warroom');
  const F = FACILITIES[sel], lv = meta.fac[sel], next = F.costs[lv + 1];
  return (
    <Split
      list={<>
        <Group title="던전의 방">
          {keys.map((f) => <PickCard key={f} label={FACILITIES[f].name} glyph={FAC_GLYPH[f]} color="var(--color-text-accent)" sel={f === sel} onPick={() => setSel(f)}
            top={`${meta.fac[f] + 1}/${FACILITIES[f].costs.length}단계`} />)}
        </Group>
        <Card variant="muted" padding={4}>
          <HStack gap={3}><VStack gap={0.5}><Text weight="semibold">환전</Text><Text size="sm" color="secondary">금화 {EXCHANGE.gold} → 마석 {EXCHANGE.mana}</Text></VStack>
            <div style={{ flex: 1 }} /><Button label="바꾸기" isDisabled={meta.gold < EXCHANGE.gold} onClick={onExchange} /></HStack>
        </Card>
      </>}
      side={<>
        <Heading level={2}>{F.name}</Heading>
        <ProgressBar label="단계" value={lv + 1} max={F.costs.length} hasValueLabel formatValueLabel={(v, mx) => `${v}/${mx}단계`} />
        <Text color="secondary">{F.desc}</Text>
        <MetadataList>
          <MetadataListItem label="지금">{facValue(meta, sel)}{F.unit}</MetadataListItem>
          {next != null && <MetadataListItem label="다음">{F.values[lv + 1]}{F.unit}</MetadataListItem>}
        </MetadataList>
        <div style={{ flex: 1 }} />
        <Button label={next == null ? '더 넓힐 수 없다' : `증축 · 금화 ${next}`} variant="primary" width="100%" isDisabled={next == null || meta.gold < next} onClick={() => onUpgrade(sel)} />
      </>} />
  );
}

function DormTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  const ids = people(meta);
  const [sel, setSel] = useState<string>(ids[0]);
  if (!ids.length) return <EmptyState title="숙소가 비어 있다" description="적장을 사로잡아 타락시키거나 사람 모습의 마족을 얻으면 방이 생긴다." icon={<BedDouble size={32} />} />;
  const cur = ids.includes(sel) ? sel : ids[0];
  const P = PEOPLE[cur], a = meta.affinity[cur] ?? 0, m = MON[cur];
  const boost = Math.round((affinityBoost(a) - 1) * 100);
  return (
    <Split
      list={<Group title="숙소">
        {ids.map((id) => <PickCard key={id} label={MON[id].name.split(' ').pop()!} glyph={MON[id].name.split(' ').pop()!.slice(0, 1)} color={GRADES[MON[id].grade].color}
          sel={id === cur} onPick={() => setSel(id)} top={`♥ ${meta.affinity[id] ?? 0}`} corner={meta.aide === id ? '측근' : undefined} />)}
      </Group>}
      side={<>
        <Heading level={2}>{m.name}</Heading>
        <Text color="secondary">{P.human ? `${P.human} · ` : ''}{boost ? `이끄는 부대 +${boost}%` : '호감이 오르면 이끄는 부대가 강해진다'}</Text>
        <ProgressBar label="호감" value={a} max={10} hasValueLabel formatValueLabel={(v) => `♥ ${v}/10`} variant="error" />
        {([2, 5, 10] as const).map((lv) => (
          <Card key={lv} variant={a >= lv ? 'muted' : 'transparent'} padding={3}><Text size="sm" color={a >= lv ? 'primary' : 'disabled'}>{a >= lv ? `「${P.lines[lv]}」` : `호감 ${lv}에서 들을 수 있다`}</Text></Card>
        ))}
        <div style={{ flex: 1 }} />
        <MetadataList><MetadataListItem label="측근 효과">{P.aide.desc}</MetadataListItem></MetadataList>
        <Button label={a >= 10 ? '더 바랄 것 없다' : `선물 · 금화 ${giftCost(a)}`} variant="primary" width="100%" isDisabled={a >= 10 || meta.gold < giftCost(a)} onClick={() => setMsg(mutate((mm) => gift(mm, cur)) ?? `♥ ${m.name.split(' ').pop()}`)} />
        <Button label={meta.aide === cur ? '곁에 두고 있다' : a < 3 ? '곁에 두기 · 호감 3 필요' : '곁에 두기'} width="100%" isDisabled={meta.aide === cur || a < 3} onClick={() => setMsg(mutate((mm) => setAide(mm, cur)) ?? `${m.name.split(' ').pop()} 측근`)} />
      </>} />
  );
}

function SummonTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  const [last, setLast] = useState<{ id: string; n: number } | null>(null);
  const doSummon = () => {
    const r = mutate((m) => summon(m));
    if (typeof r === 'string') setMsg(r); else { setLast(r); setMsg(''); }
  };
  const Row = ({ badge, name, to, action }: { badge: ReactNode; name: string; to: string; action?: ReactNode }) => (
    <HStack gap={3}>{badge}<Text weight="semibold">{name}</Text><Text size="sm" color="secondary">{to}</Text><div style={{ flex: 1 }} />{action}</HStack>
  );
  return (
    <Split
      list={<>
        <Card padding={4}><VStack gap={3}>
          <HStack gap={2}><Heading level={4}>감옥</Heading><Text color="secondary">{prisonerCount(meta)}/{facValue(meta, 'prison')}</Text></HStack>
          {meta.named.map((id) => <Row key={id} badge={<Badge label="적장" variant="error" />} name={PEOPLE[id].human ?? MON[id].name} to={`→ ${MON[id].name}`}
            action={<Button size="sm" label={`타락 · 마석 ${namedCost(id)}`} isDisabled={meta.mana < namedCost(id)} onClick={() => setMsg(mutate((m) => corruptNamed(m, id)) ?? `${PEOPLE[id].human} 타락`)} />} />)}
          {(['captain', 'knight', 'archer', 'footman'] as PrisonerType[]).map((t) => {
            const P = PRISONERS[t], n = meta.prisoners[t] ?? 0;
            if (!n) return null;
            return <Row key={t} badge={<Badge label={`×${n}`} />} name={P.name} to={`→ ${P.to ? MON[P.to].name : '마족 하나(무작위)'}`}
              action={<Button size="sm" label={`타락 · 마석 ${P.cost}`} isDisabled={meta.mana < P.cost} onClick={() => { const r = mutate((m) => corrupt(m, t)); setMsg(typeof r === 'string' ? r : `${P.name} → ${MON[r.id].name}`); }} />} />;
          })}
          {!meta.named.length && !prisonerCount(meta) && <Text color="secondary" size="sm">비어 있다. 공성에서 쓰러뜨린 적 일부를 사로잡는다.</Text>}
        </VStack></Card>
        <Card padding={4}><VStack gap={3}>
          <HStack gap={2}><Heading level={4}>찾아온 자들</Heading><Text color="secondary">명성 {meta.fame}</Text></HStack>
          {CONTRACTS.map((c) => {
            const st = contractState(meta, c), m = MON[c.id];
            return <Row key={c.id} badge={<Badge label={GRADES[m.grade].label} variant={GRADE_BADGE[m.grade]} />} name={st === 'locked' ? '???' : m.name}
              to={st === 'locked' ? `명성 ${c.fame}${c.need?.circle ? ` · 소환진 ${c.need.circle}단계` : ''}${c.need?.region ? ' · 장 보스' : ''}` : st === 'done' ? '계약함' : c.desc}
              action={st === 'open' ? <Button size="sm" label={`계약 · 마석 ${c.mana}`} isDisabled={meta.mana < c.mana} onClick={() => setMsg(mutate((mm) => signContract(mm, c.id)) ?? `${m.name} 합류`)} /> : undefined} />;
          })}
        </VStack></Card>
      </>}
      side={<>
        <Heading level={2}>소환진</Heading>
        <Text color="secondary">{facValue(meta, 'circle')}단계 — 높을수록 강한 것이 응답한다</Text>
        <svg viewBox="0 0 200 200" className="circle-svg" aria-hidden="true">
          <circle cx="100" cy="100" r="86" fill="none" stroke="var(--color-border-purple)" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--color-icon-purple)" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M100 18 L127 155 L30 70 H170 L73 155 Z" fill="none" stroke="var(--color-icon-purple)" strokeWidth="1.5" />
          {last && <text x="100" y="112" textAnchor="middle" className="circle-glyph" fill={GRADES[MON[last.id].grade].color}>{MON[last.id].name.split(' ')[0].slice(0, 1)}</text>}
        </svg>
        {last && <Text justify="center"><b style={{ color: GRADES[MON[last.id].grade].color }}>{GRADES[MON[last.id].grade].label} {MON[last.id].name}</b>{last.n > 1 ? ` ×${last.n}` : ''}</Text>}
        <div style={{ flex: 1 }} />
        <Button label={`소환 · 마석 ${SUMMON_COST}`} variant="primary" size="lg" width="100%" isDisabled={meta.mana < SUMMON_COST} onClick={doSummon} />
      </>} />
  );
}

function Formation({ meta, region, plans, setPlans, onBack, onStart }: {
  meta: Meta; region: Region; plans: SquadPlan[]; setPlans: (p: SquadPlan[]) => void; onBack: () => void; onStart: () => void;
}) {
  const castle = regionCastle(meta, region);
  const [estimate, setEstimate] = useState('');
  const update = (i: number, f: (p: SquadPlan) => SquadPlan) => { setPlans(plans.map((p, j) => (j === i ? f(structuredClone(p)) : p))); setEstimate(''); };
  const gearCost = plans.reduce((a, p) => a + (p.gear ? GEARS[p.gear].cost : 0), 0);
  const problem = plans.length === 0 ? '부대장을 맡을 희귀 이상 몬스터가 없습니다.' : checkPlans(meta, plans) ?? (gearCost > meta.gold ? `장비 금화 ${gearCost} 필요(보유 ${meta.gold})` : null);
  const leaders = Object.keys(meta.owned).filter((id) => MON[id].grade !== 'common' && meta.owned[id] > 0);
  const troops = Object.keys(meta.owned).filter((id) => (MON[id].grade === 'common' || MON[id].grade === 'rare') && meta.owned[id] > 0);
  const [cur, setCur] = useState(0);
  // 남은 수: 보유 - 모든 부대에서 쓰는 수
  const usedOf = (id: string) => plans.reduce((a, p) => a + (p.leader === id ? 1 : 0) + p.troops.filter((t) => t.id === id).reduce((x, t) => x + t.count, 0), 0);
  const left = (id: string) => (meta.owned[id] ?? 0) - usedOf(id);
  /** 몬스터 하나를 부대에: 희귀 이상이고 비어 있지 않으면 부대장 자리, 아니면 병력 한 칸 */
  const give = (i: number, id: string, asLeader?: boolean) => {
    if (left(id) <= 0 || !plans[i]) return;
    const isLeaderGrade = asLeader ?? (MON[id].grade !== 'common' && MON[id].grade !== 'rare');
    update(i, (p) => {
      if (isLeaderGrade) {
        p.leader = id; let room = troopCap(id); p.troops.forEach((t) => { t.count = Math.min(t.count, room); room -= t.count; }); p.troops = p.troops.filter((t) => t.count > 0);
        return p;
      }
      if (p.troops.reduce((a, t) => a + t.count, 0) >= troopCap(p.leader)) return p;
      const t = p.troops.find((x) => x.id === id); if (t) t.count++; else p.troops.push({ id, count: 1 });
      return p;
    });
  };
  const runEstimate = () => {
    let win = 0; const n = 20;
    for (let seed = 1; seed <= n; seed++) { const s = createSiege(castle, plans, { seed }); while (!s.over) { autoDeploy(s); step(s, 1 / 20); } if (s.over.win) win++; }
    setEstimate(`자동 진행 기준 예상 승률 ${Math.round((win / n) * 100)}% (스킬과 명령을 쓰면 달라집니다)`);
  };
  // 레인 안내: 성벽·들판·지형을 짧게
  const outs = (L: number) => [
    ...(castle.outworks ?? []).filter((o) => o.lane === L).map((o) => (o.kind === 'palisade' ? '목책' : '가시밭')),
    ...castle.towers.filter((t) => t.splash && t.lane === L).map(() => '투석기'),
    ...(castle.garrison.some((g) => g.outpost && g.lane === L) ? ['외곽 초소'] : []),
    ...(castle.terrain ?? []).filter((z) => z.lane === L).map((z) => (z.kind === 'forest' ? '숲(원거리 피해 -30%)' : '언덕(사거리 +25%)')),
  ].join(' · ');
  const laneInfo = [
    `망루 ${castle.towers.filter((t) => t.lane === 0 && !t.splash && !t.barrier).length}${castle.towers.some((t) => t.antiAir) ? ', 쇠뇌탑' : ''}. 날개나 사다리가 있어야 넘는다.${outs(0) ? ` 들판: ${outs(0)}` : ''}`,
    `성문${castle.moat ? '과 해자' : ''}. 망루 ${castle.towers.filter((t) => t.lane === 1 && !t.splash && !t.barrier).length}.${outs(1) ? ` 들판: ${outs(1)}` : ''}`,
    castle.tunnel ? '굴을 파야 열린다(굴착 고블린, 거대 쥐).' : '굴을 팔 수 없다.',
  ];

  const skulls = Math.max(1, Math.min(5, Math.round(castle.power * 2)));
  return (
    <AppShell height="fill" variant="elevated" contentPadding={4}
      topNav={<TopNav label="편성" heading={<HStack gap={3}><Button label="지도" variant="ghost" icon={<ChevronLeft size={16} />} onClick={onBack} /><TopNavHeading heading={region.name} /></HStack>}
        endContent={<HStack gap={5}>
          <Tooltip content="수비 강도"><HStack gap={0.5}>{Array.from({ length: 5 }, (_, k) => <Skull key={k} size={15} opacity={k < skulls ? 1 : 0.2} />)}</HStack></Tooltip>
          <Res icon={Coins} v={meta.gold} tip="금화" />
          <Res icon={Hourglass} v={castle.timeLimit} sub="초" tip="제한 시간" />
        </HStack>} />}>
      <VStack gap={4}>
        <Card padding={4}>
          <VStack gap={3}>
            <MetadataList label={{ width: 110 }}>
              {laneInfo.map((t, k) => <MetadataListItem key={k} label={`${['위', '가운데', '아래'][k]} · ${LANE_NAMES[k]}`}>{t}</MetadataListItem>)}
            </MetadataList>
            <Text size="sm" color="secondary">{castle.tip}</Text>
          </VStack>
        </Card>
        <Grid columns={{ minWidth: 280, repeat: 'fit' }} gap={3}>
          {plans.map((p, i) => <SquadCard key={i} idx={i} plan={p} meta={meta} on={i === cur} onPick={() => setCur(i)} onChange={(f) => update(i, f)} tunnel={castle.tunnel}
            onDropMon={(id) => give(i, id)} />)}
        </Grid>
        <Card padding={4}>
          <VStack gap={3}>
            <Text size="sm" color="secondary"><b>{cur + 1}부대</b>에 넣기 · 누르거나 부대로 끌어 놓는다. 부대 안 병사를 누르면 뺀다.</Text>
            <Text type="label" color="secondary">부대장</Text>
            <Grid columns={{ minWidth: 84, repeat: 'fill' }} gap={2}>{leaders.map((id) => <MonTile key={id} id={id} left={left(id)} onClick={() => give(cur, id, true)} />)}</Grid>
            <Text type="label" color="secondary">병력</Text>
            <Grid columns={{ minWidth: 84, repeat: 'fill' }} gap={2}>{troops.map((id) => <MonTile key={id} id={id} left={left(id)} onClick={() => give(cur, id, false)} />)}</Grid>
          </VStack>
        </Card>
        <HStack gap={3}>
          {problem ? <Text color="accent">{problem}</Text> : estimate ? <Text color="secondary">{estimate}</Text> : <Button label="이 편성으로 미리 겨뤄 보기" variant="ghost" onClick={runEstimate} />}
          <div style={{ flex: 1 }} />
          <Button label={gearCost ? `출격 · 장비 금화 ${gearCost}` : '출격'} variant="primary" size="lg" width={260} isDisabled={!!problem} onClick={onStart} />
        </HStack>
      </VStack>
    </AppShell>
  );
}

function MonTile({ id, left, onClick, small }: { id: string; left?: number; onClick?: () => void; small?: boolean }) {
  const m = MON[id], empty = left != null && left <= 0;
  return (
    <div draggable={!empty} onDragStart={(e) => e.dataTransfer.setData('text/mon', id)}>
      {small
        ? <Tooltip content={`${m.name} · 눌러서 빼기`}><button className="slot-mon" style={{ color: GRADES[m.grade].color }} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>{glyphOf(id)}</button></Tooltip>
        : <PickCard label={m.name} glyph={glyphOf(id)} color={GRADES[m.grade].color} sel={false} onPick={() => onClick?.()} dim={empty} top={GRADES[m.grade].label} corner={left != null ? `${left}` : undefined} />}
    </div>
  );
}

function SquadCard({ idx, plan, meta, on, onPick, onChange, tunnel, onDropMon }: {
  idx: number; plan: SquadPlan; meta: Meta; on: boolean; onPick: () => void; onChange: (f: (p: SquadPlan) => SquadPlan) => void; tunnel: boolean; onDropMon: (id: string) => void;
}) {
  const leader = MON[plan.leader];
  const cap = troopCap(plan.leader);
  const g = GRADES[leader.grade];
  const slots: string[] = plan.troops.flatMap((t) => Array.from({ length: t.count }, () => t.id));
  const take = (id: string) => onChange((p) => { const t = p.troops.find((x) => x.id === id)!; t.count--; p.troops = p.troops.filter((x) => x.count > 0); return p; });
  const forge = facValue(meta, 'forge');
  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onPick(); const id = e.dataTransfer.getData('text/mon'); if (id) onDropMon(id); }} style={{ ['--c' as string]: SQUAD_COL[idx % SQUAD_COL.length] }}>
      <SelectableCard label={`${idx + 1}부대`} isSelected={on} onChange={onPick} padding={4}>
        <VStack gap={3}>
          <HStack gap={3}>
            <div className="sq-leader" style={{ color: g.color }}>{glyphOf(plan.leader)}<span className="sq-no">{idx + 1}</span></div>
            <VStack gap={1}>
              <HStack gap={2}><Text weight="bold">{leader.name}</Text><Badge label={g.label} variant={GRADE_BADGE[leader.grade]} /></HStack>
              {leader.command && <Text size="sm" color="secondary">지휘 · {leader.command.desc}</Text>}
              {SKILLS[plan.leader] && <Text size="sm" color="secondary">{SKILLS[plan.leader].name} · {SKILLS[plan.leader].desc}</Text>}
            </VStack>
          </HStack>
          <div className="sq-slots">
            {Array.from({ length: cap }, (_, k) => slots[k] ? <MonTile key={k} id={slots[k]} small onClick={() => take(slots[k])} /> : <div key={k} className="slot-empty" />)}
          </div>
          <SegmentedControl label="레인" size="sm" value={String(plan.lane)} onChange={(v) => onChange((p) => { p.lane = Number(v) as Lane; return p; })}>
            {LANE_NAMES.map((n, i) => <SegmentedControlItem key={i} value={String(i)} label={n} isDisabled={i === 2 && !tunnel} />)}
          </SegmentedControl>
          <SegmentedControl label="장비" size="sm" value={plan.gear ?? 'none'} onChange={(v) => onChange((p) => { p.gear = v === 'none' ? undefined : (v as Gear); return p; })}>
            {[<SegmentedControlItem key="none" value="none" label="없음" />, ...(Object.keys(GEARS) as Gear[]).filter((k) => GEARS[k].forge <= forge).map((k) => <SegmentedControlItem key={k} value={k} label={GEARS[k].name} />)]}
          </SegmentedControl>
        </VStack>
      </SelectableCard>
    </div>
  );
}

// ---------------- 공성전 ----------------
function Battle({ plans, castle, captain, boost, squadBoost, onFinish, onExit, onRetry }: {
  plans: SquadPlan[]; castle: Castle; captain?: string; boost: (id: string) => number; squadBoost: (id: string) => number;
  onFinish: (win: boolean, stars: number, leaders: string[], mvp: string | null, defeated: Partial<Record<PrisonerType, number>>) => string[]; onExit: () => void; onRetry: () => void;
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
      else if (view!.hitstop > 0) { view!.hitstop -= dt; }   // 타격 정지: 잠깐 멈춰 무게를 준다
      else if (!ctl.current.paused) {
        let rem = dt * ctl.current.speed;
        while (rem > 1e-6) { const d = Math.min(1 / 30, rem); step(s, d); rem -= d; }
        view!.update(dt * ctl.current.speed);
      }
      view!.draw();
      if (s.over && !finished.current) {
        finished.current = true;
        sfx(s.over.win ? 'win' : 'lose');
        // MVP: 적에게 가장 많은 피해를 준 부대의 부대장
        let best = -1, bi = -1;
        s.dmgBy.forEach((d, i) => { if (d > best) { best = d; bi = i; } });
        const mv = s.over.win && bi >= 0 ? plans[bi].leader : null;
        setMvp(mv);
        const defeated: Partial<Record<PrisonerType, number>> = {};
        for (const u of s.units) if (u.side === 'foe' && !u.alive && u.foeType) defeated[u.foeType] = (defeated[u.foeType] ?? 0) + 1;
        setReward(finishRef.current(s.over.win, stars(s), plans.map((p) => p.leader), mv, defeated));
      }
      if ((hud += dt) > 0.2) { hud = 0; force((x) => x + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= s.squads.length) { const q = s.squads[n - 1]; if (q.started) cast(s, n - 1); else deploy(s, n - 1, q.plan.lane); } if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, [plans, castle]);

  const s = ref.current?.s;
  const glyph = (id: string) => (PEOPLE[id] ? MON[id].name.split(' ').pop()! : MON[id].name.split(' ')[0]).slice(0, 1);
  return (
    <div className="battle">
      <HStack gap={4} paddingInline={4} paddingBlock={2}>
        <Heading level={3}>{castle.name}</Heading>
        <Text size="xl" weight="bold">{s ? Math.max(0, Math.ceil(castle.timeLimit - s.t)) : castle.timeLimit}<Text size="sm" color="secondary">초</Text></Text>
        <div style={{ width: 200 }}><ProgressBar label="본관 점거" value={s ? Math.min(100, (s.coreProg / castle.holdSec) * 100) : 0} variant="warning" /></div>
        <div style={{ flex: 1 }} />
        <Tooltip content="지휘력: 예비 부대를 투입한다"><HStack gap={2}><Text size="sm" color="secondary">지휘력</Text>
          <div className="cmd-pips">{Array.from({ length: CMD_MAX }, (_, i) => <i key={i} className={s && i < Math.floor(s.cmdPts) ? 'on' : s && i < s.cmdPts ? 'part' : ''} />)}</div>
          <Text weight="bold" color="accent">{s ? Math.floor(s.cmdPts) : 0}</Text></HStack></Tooltip>
        <HStack gap={1}>
          <IconButton label={paused ? '계속(스페이스)' : '일시정지(스페이스)'} icon={paused ? <Play size={16} /> : <Pause size={16} />} onClick={() => setPaused(!paused)} />
          <Button label={`×${speed}`} onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)} tooltip="배속" />
          <IconButton label="소리" icon={muted ? <VolumeX size={16} /> : <Volume2 size={16} />} onClick={() => { setMuted(!muted); force((x) => x + 1); }} />
          <IconButton label="포기하고 돌아가기" icon={<Flag size={16} />} variant="ghost" onClick={onExit} />
        </HStack>
      </HStack>
      <div className="battle-field"><canvas ref={canvasRef} /></div>
      <div className="bt-help"><Text size="xsm" color="secondary">지휘력이 차면 예비 부대를 원하는 레인에 투입(숫자키는 기본 레인) · 외곽 초소를 정리한 레인은 더 앞에서 나온다</Text></div>
      <div className="bt-bottom">
        {s?.squads.map((q) => {
          const units = s.units.filter((u) => u.side === 'ally' && u.squad === q.idx);
          const alive = units.filter((u) => u.alive).length;
          const total = Math.max(1, units.length || 1);
          const col = SQUAD_COL[q.idx % SQUAD_COL.length];
          const leaderOk = !!q.leader?.alive;
          const cdP = q.skill ? 1 - q.skillCd / q.skill.cd : 0;
          const lm = MON[q.plan.leader];
          return (
            <Card key={q.idx} padding={3} variant={!q.started && s.cmdPts < deployCost(q.plan.leader) ? 'muted' : 'default'}>
              <div className="plate" style={{ ['--c' as string]: col }}>
                <div className="plate-face" style={{ color: GRADES[lm.grade].color, opacity: !leaderOk && q.started ? 0.35 : 1 }}>{glyph(q.plan.leader)}<span>{q.idx + 1}</span></div>
                <VStack gap={1.5}>
                  <HStack gap={2}><Text weight="semibold" maxLines={1}>{lm.name}</Text>
                    {!q.started ? <Badge label={`지휘력 ${deployCost(q.plan.leader)}`} variant={s.cmdPts >= deployCost(q.plan.leader) ? 'warning' : 'neutral'} />
                      : !leaderOk ? <Badge label="쓰러짐" variant="error" /> : <Badge label={LANE_NAMES[q.plan.lane]} />}</HStack>
                  {!q.started ? (
                    <HStack gap={1}>{LANE_NAMES.map((n, L) => <Button key={L} size="sm" label={n} variant={L === q.plan.lane ? 'primary' : 'secondary'} isDisabled={!canDeploy(s, q.idx, L as Lane)} onClick={() => deploy(s, q.idx, L as Lane)} />)}</HStack>
                  ) : (<>
                    <ProgressBar label="병력" isLabelHidden value={(alive / total) * 100} variant={alive / total < 0.35 ? 'error' : 'success'} />
                    <HStack gap={1}>
                      <IconButton size="sm" label="위 레인으로" icon={<ChevronUp size={14} />} isDisabled={q.plan.lane === 0 || !!s.over} onClick={() => setOrders(s, q.idx, { lane: (q.plan.lane - 1) as Lane })} />
                      <IconButton size="sm" label="아래 레인으로" icon={<ChevronDown size={14} />} isDisabled={q.plan.lane === 2 || (q.plan.lane === 1 && !castle.tunnel) || !!s.over} onClick={() => setOrders(s, q.idx, { lane: (q.plan.lane + 1) as Lane })} />
                      <IconButton size="sm" label={q.orders.advance ? '정지' : '전진'} icon={q.orders.advance ? <ChevronsRight size={14} /> : <Square size={14} />} variant={q.orders.advance ? 'secondary' : 'primary'} onClick={() => setOrders(s, q.idx, { advance: !q.orders.advance })} />
                      {q.plan.lane === 1 && <IconButton size="sm" label={q.orders.gate === 'attack' ? '성문 공격 멈추기' : '성문 공격'} icon={<Swords size={14} />} variant={q.orders.gate === 'attack' ? 'secondary' : 'primary'} isDisabled={s.gateHp <= 0} onClick={() => setOrders(s, q.idx, { gate: q.orders.gate === 'attack' ? 'wait' : 'attack' })} />}
                      <IconButton size="sm" label="후퇴" icon={<Flag size={14} />} variant="destructive" isDisabled={q.retreated || !alive || !!s.over} onClick={() => retreat(s, q.idx)} />
                    </HStack>
                  </>)}
                </VStack>
                {q.skill && q.started && (
                  <button className={`plate-skill${canCast(s, q.idx) ? ' ready' : ''}`} style={{ ['--p' as string]: cdP }} disabled={!canCast(s, q.idx)} onClick={() => cast(s, q.idx)} title={`${q.skill.name}: ${q.skill.desc}`}>
                    <span>{q.skill.name}</span>{q.skillCd > 0 && <b>{Math.ceil(q.skillCd)}</b>}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {s?.over && (
        <div className="result">
          <Card padding={6} elevation="high" width={440}>
            <VStack gap={4}>
              <Heading level={1} type="display-2" color={s.over.win ? 'accent' : 'secondary'} justify="center">{s.over.win ? '함락' : '퇴각'}</Heading>
              {s.over.win && <div className="result-stars">{Array.from({ length: 3 }, (_, k) => <span key={k} className={k < stars(s) ? 'on' : ''}>★</span>)}</div>}
              <Text color="secondary" justify="center">{s.over.win ? `${Math.floor(s.t)}초` : s.over.reason === '시간 초과' ? '시간 초과' : '전멸'}</Text>
              {mvp && (
                <Card variant="muted" padding={3}><HStack gap={3}>
                  <div className="plate-face big" style={{ color: GRADES[MON[mvp].grade].color }}>{glyph(mvp)}</div>
                  <VStack gap={1}><HStack gap={2}><Badge label="MVP" variant="warning" /><Text weight="bold">{MON[mvp].name}</Text></HStack><Text size="sm" color="secondary">「{PEOPLE[mvp]?.mvp ?? '이 정도는 식은 죽 먹기지.'}」</Text></VStack>
                </HStack></Card>
              )}
              {!!reward?.length && <VStack gap={1}>{reward.map((line, k) => <Text key={k} size="sm">{line}</Text>)}</VStack>}
              <HStack gap={2}><Button label="돌아가기" variant="primary" width="100%" onClick={onExit} /><Button label="편성 바꿔 다시" width="100%" onClick={onRetry} /></HStack>
            </VStack>
          </Card>
        </div>
      )}
    </div>
  );
}
