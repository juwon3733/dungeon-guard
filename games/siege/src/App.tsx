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
import { createSiege, step, stars, retreat, troopCap, cmdOf, cast, canCast, setOrders, fallBack, AIM, GEARS, type Gear, type SquadPlan, type SiegeState } from './core/siege';
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
    <Theme theme={neutralTheme} mode="dark">
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
const ROOMS: { k: string; name: string }[] = [
  { k: 'map', name: '전쟁 지도' }, { k: 'army', name: '군단 막사' }, { k: 'dungeon', name: '던전 시설' },
  { k: 'summon', name: '소환진 · 감옥' }, { k: 'dorm', name: '숙소' },
];

function Hub({ meta, mutate, onSortie, onReset }: { meta: Meta; mutate: <T>(f: (m: Meta) => T) => T; onSortie: (r: Region) => void; onReset: () => void }) {
  const [tab, setTab] = useState('map');
  const [msg, setMsg] = useState('');
  const aideLine = meta.aide && PEOPLE[meta.aide] ? PEOPLE[meta.aide].lines[(meta.affinity[meta.aide] ?? 0) >= 10 ? 10 : (meta.affinity[meta.aide] ?? 0) >= 5 ? 5 : 2] : null;
  const newPrison = meta.named.length > 0 || Object.values(meta.prisoners).some((n) => n > 0);
  return (
    <div className="hub">
      <header className="hub-top">
        <div className="hub-title">마계 진군</div>
        <span className="res" title="금화"><IconGold /> {meta.gold}</span>
        <span className="res" title="마석"><IconMana /> {meta.mana}</span>
        <span className="res" title="명성"><IconFame /> {meta.fame}</span>
        <span className="res" title="군단 수용량"><IconArmy /> {capUsed(meta)}<small>/{capMax(meta)}</small></span>
        <span className="res" title="위협도: 점령할수록 남은 성채가 강해진다"><IconThreat /> {threat(meta)}</span>
      </header>
      <div className="hub-body">
        <nav className="rooms" aria-label="본부">
          {ROOMS.map((r) => (
            <button key={r.k} className={`room${tab === r.k ? ' on' : ''}`} onClick={() => { setTab(r.k); setMsg(''); }}>
              <RoomIcon k={r.k === 'summon' ? 'summon' : r.k} />{r.name}{r.k === 'summon' && newPrison && <span className="dot-new" />}
            </button>
          ))}
          {aideLine && <div className="aide"><b>{MON[meta.aide!].name}</b>「{aideLine}」</div>}
          <button className="reset-link" onClick={() => { if (confirm('저장을 지우고 처음부터 시작할까요?')) onReset(); }}>처음부터 다시</button>
        </nav>
        <main>
          {msg && <div className="toast">{msg}</div>}
          {tab === 'map' && <WorldMap meta={meta} onSortie={onSortie} />}
          {tab === 'army' && <ArmyTab meta={meta} onTrain={(id) => setMsg(mutate((m) => train(m, id)) ?? `${MON[id].name} 레벨 ${lvOf(meta, id) + 1}`)}
            onRelease={(id) => { if (confirm(`${MON[id].name}을(를) ${MON[id].grade === 'common' ? '3마리' : '1마리'} 내보낼까요?`)) setMsg(mutate((m) => release(m, id)) ?? `${MON[id].name}을(를) 내보냈습니다.`); }}
            onAwaken={(id) => setMsg(mutate((m) => awaken(m, id)) ?? `${MON[id].name} 각성 ${awOf(meta, id) + 1}`)} />}
          {tab === 'dorm' && <DormTab meta={meta} setMsg={setMsg} mutate={mutate} />}
          {tab === 'dungeon' && <DungeonTab meta={meta} onUpgrade={(f) => setMsg(mutate((m) => upgrade(m, f)) ?? `${FACILITIES[f].name}을(를) 올렸습니다.`)}
            onExchange={() => setMsg(mutate((m) => buyMana(m)) ?? `마석 ${EXCHANGE.mana}을(를) 얻었습니다.`)} />}
          {tab === 'summon' && <SummonTab meta={meta} setMsg={setMsg} mutate={mutate} />}
        </main>
      </div>
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
                <Heading level={3}>{i < 7 ? '1장' : i < 11 ? '2장' : '3장'} · {i + 1}. {r.name}</Heading>
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

function ArmyTab({ meta, onTrain, onAwaken, onRelease }: { meta: Meta; onTrain: (id: string) => void; onAwaken: (id: string) => void; onRelease: (id: string) => void }) {
  const ids = Object.keys(meta.owned).filter((id) => meta.owned[id] > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(MON[a].grade) - GRADE_ORDER.indexOf(MON[b].grade) || lvOf(meta, b) - lvOf(meta, a));
  const [sel, setSel] = useState<string>(ids[0]);
  const cur = meta.owned[sel] ? sel : ids[0];
  const m = MON[cur], g = GRADES[m.grade];
  const groups: [string, string[]][] = [['지휘관', ids.filter((id) => MON[id].grade !== 'common')], ['병졸', ids.filter((id) => MON[id].grade === 'common')]];
  return (
    <div className="ledger">
      <div className="ledger-list">
        {groups.map(([title, list]) => list.length > 0 && (
          <div key={title}>
            <div className="ledger-group">{title}</div>
            <div className="tiles">
              {list.map((id) => {
                const mm = MON[id];
                return (
                  <button key={id} className={`tile${id === cur ? ' on' : ''}`} style={{ ['--g' as string]: GRADES[mm.grade].color }} onClick={() => setSel(id)} title={mm.name}>
                    <span className="lv">Lv{lvOf(meta, id)}{awOf(meta, id) ? ` ✦${awOf(meta, id)}` : ''}</span>
                    {meta.owned[id] > 1 && <span className="cnt">×{meta.owned[id]}</span>}
                    <span className="glyph">{(PEOPLE[id] ? mm.name.split(' ').pop()! : mm.name.split(' ')[0]).slice(0, 1)}</span>
                    <span className="nm">{mm.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <aside className="ledger-side" style={{ ['--g' as string]: g.color }}>
        <div className="side-title">{m.name}</div>
        <div className="side-sub">{g.label} {ROLES[m.role].label} · Lv {lvOf(meta, cur)}{awOf(meta, cur) ? ` · 각성 ${awOf(meta, cur)}` : ''} · {meta.owned[cur]}마리</div>
        {PEOPLE[cur]?.human && <div className="side-text">{PEOPLE[cur].human}이었다.</div>}
        {m.command && <div className="side-text"><b>지휘</b> {m.command.desc}</div>}
        {SKILLS[cur] && <div className="side-text"><b>「{SKILLS[cur].name}」</b> {SKILLS[cur].desc}</div>}
        {!m.command && <div className="side-text">부대장 밑에서 싸우는 병졸.</div>}
        <div style={{ flex: 1 }} />
        <button className="btn-plain" disabled={lvOf(meta, cur) >= MAX_LV || meta.mana < trainCost(meta, cur)} onClick={() => onTrain(cur)}>
          <span>{lvOf(meta, cur) >= MAX_LV ? '더 단련할 수 없다' : '단련'}</span>{lvOf(meta, cur) < MAX_LV && <span className="cost"><IconMana size={15} />{trainCost(meta, cur)}</span>}
        </button>
        {m.grade !== 'common' && m.grade !== 'rare' && (
          <button className="btn-plain" disabled={awOf(meta, cur) >= MAX_AW || meta.owned[cur] < 2} onClick={() => onAwaken(cur)}>
            <span>각성</span><span className="cost">{awOf(meta, cur) >= MAX_AW ? '끝' : meta.owned[cur] < 2 ? '같은 몬스터 하나 더' : '같은 몬스터 1'}</span>
          </button>
        )}
        <button className="btn-ghost" onClick={() => onRelease(cur)}>{m.grade === 'common' ? '3마리 내보내기' : '내보내기'}</button>
      </aside>
    </div>
  );
}

const FAC_GLYPH: Record<string, string> = { nest: '巢', warroom: '戰', circle: '召', mine: '鑛', prison: '獄', forge: '冶' };
function DungeonTab({ meta, onUpgrade, onExchange }: { meta: Meta; onUpgrade: (f: FacId) => void; onExchange: () => void }) {
  const keys = Object.keys(FACILITIES) as FacId[];
  const [sel, setSel] = useState<FacId>('warroom');
  const F = FACILITIES[sel], lv = meta.fac[sel], next = F.costs[lv + 1];
  return (
    <div className="ledger">
      <div className="ledger-list">
        <div className="ledger-group">던전의 방</div>
        <div className="tiles">
          {keys.map((f) => {
            const L = meta.fac[f], max = FACILITIES[f].costs.length;
            return (
              <button key={f} className={`tile${f === sel ? ' on' : ''}`} style={{ ['--g' as string]: '#c8963e' }} onClick={() => setSel(f)}>
                <span className="glyph">{FAC_GLYPH[f]}</span>
                <span className="lv">{Array.from({ length: max }, (_, k) => (k <= L ? '◆' : '◇')).join('')}</span>
                <span className="nm">{FACILITIES[f].name}</span>
              </button>
            );
          })}
        </div>
        <div className="ledger-group">환전</div>
        <button className="btn-plain" style={{ maxWidth: 320 }} disabled={meta.gold < EXCHANGE.gold} onClick={onExchange}>
          <span>금화를 마석으로</span><span className="cost"><IconGold size={15} />{EXCHANGE.gold} → <IconMana size={15} />{EXCHANGE.mana}</span>
        </button>
      </div>
      <aside className="ledger-side">
        <div className="side-title">{F.name}</div>
        <div className="side-sub">{lv + 1}단계 / {F.costs.length}</div>
        <div className="side-text">{F.desc}</div>
        <div className="side-text"><b>지금</b> {facValue(meta, sel)}{F.unit}{next != null && <> &nbsp;→&nbsp; <b>다음</b> {F.values[lv + 1]}{F.unit}</>}</div>
        <div style={{ flex: 1 }} />
        <button className="btn-plain" disabled={next == null || meta.gold < next} onClick={() => onUpgrade(sel)}>
          <span>{next == null ? '더 넓힐 수 없다' : '증축'}</span>{next != null && <span className="cost"><IconGold size={15} />{next}</span>}
        </button>
      </aside>
    </div>
  );
}

function DormTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  const ids = people(meta);
  const [sel, setSel] = useState<string>(ids[0]);
  if (!ids.length) return <div className="ledger"><div className="ledger-list"><div className="side-text" style={{ padding: 20 }}>숙소가 비어 있다. 적장을 사로잡아 타락시키거나, 사람 모습의 마족을 얻으면 방이 생긴다.</div></div></div>;
  const cur = ids.includes(sel) ? sel : ids[0];
  const P = PEOPLE[cur], a = meta.affinity[cur] ?? 0, m = MON[cur], g = GRADES[m.grade];
  const boost = Math.round((affinityBoost(a) - 1) * 100);
  return (
    <div className="ledger">
      <div className="ledger-list">
        <div className="ledger-group">숙소</div>
        <div className="tiles">
          {ids.map((id) => {
            const mm = MON[id], aa = meta.affinity[id] ?? 0;
            return (
              <button key={id} className={`tile${id === cur ? ' on' : ''}`} style={{ ['--g' as string]: GRADES[mm.grade].color }} onClick={() => setSel(id)} title={mm.name}>
                <span className="lv" style={{ color: '#e88' }}>{'♥'.repeat(Math.ceil(aa / 2))}</span>
                {meta.aide === id && <span className="cnt">측근</span>}
                <span className="glyph">{mm.name.split(' ').pop()!.slice(0, 1)}</span>
                <span className="nm">{mm.name.split(' ').pop()}</span>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="ledger-side" style={{ ['--g' as string]: g.color }}>
        <div className="side-title">{m.name}</div>
        <div className="side-sub">{P.human ? `${P.human} · ` : ''}호감 {a}/10{boost ? ` · 이끄는 부대 +${boost}%` : ''}</div>
        <div className="hearts">{Array.from({ length: 10 }, (_, k) => <span key={k} className={k < a ? 'on' : ''}>♥</span>)}</div>
        {([2, 5, 10] as const).map((lv) => (
          a >= lv ? <div key={lv} className="speech">{P.lines[lv]}</div> : <div key={lv} className="speech locked">호감 {lv}에서 들을 수 있다</div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="side-text"><b>측근이 되면</b> {P.aide.desc}</div>
        <button className="btn-plain" disabled={a >= 10 || meta.gold < giftCost(a)} onClick={() => setMsg(mutate((mm) => gift(mm, cur)) ?? `${m.name.split(' ').pop()}의 호감이 올랐다.`)}>
          <span>{a >= 10 ? '더 바랄 것 없다' : '선물'}</span>{a < 10 && <span className="cost"><IconGold size={15} />{giftCost(a)}</span>}
        </button>
        <button className="btn-plain" disabled={meta.aide === cur || a < 3} onClick={() => setMsg(mutate((mm) => setAide(mm, cur)) ?? `${m.name.split(' ').pop()}을(를) 곁에 두었다.`)}>
          <span>{meta.aide === cur ? '곁에 두고 있다' : '곁에 두기'}</span><span className="cost">{a < 3 ? '호감 3 필요' : ''}</span>
        </button>
      </aside>
    </div>
  );
}

function SummonTab({ meta, setMsg, mutate }: { meta: Meta; setMsg: (s: string) => void; mutate: <T>(f: (m: Meta) => T) => T }) {
  const [last, setLast] = useState<{ id: string; n: number } | null>(null);
  const doSummon = () => {
    const r = mutate((m) => summon(m));
    if (typeof r === 'string') setMsg(r); else { setLast(r); setMsg(''); }
  };
  return (
    <div className="ledger">
      <div className="ledger-list">
        <div className="ledger-group">감옥 · {prisonerCount(meta)}/{facValue(meta, 'prison')}</div>
        {meta.named.map((id) => (
          <div className="row-line" key={id}>
            <span className="chip red">적장</span><span className="row-name">{PEOPLE[id].human}</span>
            <span className="row-to">→ {MON[id].name}</span>
            <button className="btn-plain sm" disabled={meta.mana < namedCost(id)} onClick={() => setMsg(mutate((m) => corruptNamed(m, id)) ?? `${PEOPLE[id].human}이(가) 타락했다. 숙소에 방이 생겼다.`)}>
              <span>타락</span><span className="cost"><IconMana size={14} />{namedCost(id)}</span>
            </button>
          </div>
        ))}
        {(['captain', 'knight', 'archer', 'footman'] as PrisonerType[]).map((t) => {
          const P = PRISONERS[t], n = meta.prisoners[t] ?? 0;
          if (!n) return null;
          return (
            <div className="row-line" key={t}>
              <span className="chip">{P.name} ×{n}</span>
              <span className="row-to">→ {P.to ? MON[P.to].name : '마족 하나(무작위)'}</span>
              <button className="btn-plain sm" disabled={meta.mana < P.cost} onClick={() => {
                const r = mutate((m) => corrupt(m, t));
                setMsg(typeof r === 'string' ? r : `${P.name} 포로가 ${MON[r.id].name}이(가) 되었다.`);
              }}><span>타락</span><span className="cost"><IconMana size={14} />{P.cost}</span></button>
            </div>
          );
        })}
        {!meta.named.length && !prisonerCount(meta) && <div className="side-text faint">비어 있다. 공성에서 쓰러뜨린 적 일부를 사로잡는다.</div>}
        <div className="ledger-group" style={{ marginTop: 20 }}>찾아온 자들 · 명성 {meta.fame}</div>
        {CONTRACTS.map((c) => {
          const st = contractState(meta, c), m = MON[c.id];
          return (
            <div className={`row-line${st === 'locked' ? ' dim' : ''}`} key={c.id}>
              <span className="chip" style={{ borderColor: GRADES[m.grade].color, color: GRADES[m.grade].color }}>{GRADES[m.grade].label}</span>
              <span className="row-name">{st === 'locked' ? '???' : m.name}</span>
              <span className="row-to">{st === 'locked' ? `명성 ${c.fame}${c.need?.circle ? ` · 소환진 ${c.need.circle}단계` : ''}${c.need?.region ? ' · 장 보스' : ''}` : st === 'done' ? '계약함' : c.desc}</span>
              {st === 'open' && <button className="btn-plain sm" disabled={meta.mana < c.mana} onClick={() => setMsg(mutate((mm) => signContract(mm, c.id)) ?? `${m.name}이(가) 군단에 들어왔다.`)}>
                <span>계약</span><span className="cost"><IconMana size={14} />{c.mana}</span></button>}
            </div>
          );
        })}
      </div>
      <aside className="ledger-side summon-side">
        <div className="side-title">소환진</div>
        <div className="side-sub">{facValue(meta, 'circle')}단계 — 높을수록 강한 것이 응답한다</div>
        <svg viewBox="0 0 200 200" className="circle-svg" aria-hidden="true">
          <circle cx="100" cy="100" r="86" fill="none" stroke="#7d4ad8" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#b38cff" strokeWidth="1" strokeDasharray="4 6" />
          <path d="M100 18 L127 155 L30 70 H170 L73 155 Z" fill="none" stroke="#b38cff" strokeWidth="1.5" />
          {last && <text x="100" y="112" textAnchor="middle" className="circle-glyph" fill={GRADES[MON[last.id].grade].color}>{MON[last.id].name.split(' ')[0].slice(0, 1)}</text>}
        </svg>
        {last && <div className="side-text" style={{ textAlign: 'center' }}><b style={{ color: GRADES[MON[last.id].grade].color }}>{GRADES[MON[last.id].grade].label} {MON[last.id].name}</b>{last.n > 1 ? ` ×${last.n}` : ''}이(가) 응답했다</div>}
        <div style={{ flex: 1 }} />
        <button className="btn-war" disabled={meta.mana < SUMMON_COST} onClick={doSummon}>소환 <span style={{ fontSize: 13, letterSpacing: 0 }}>· 마석 {SUMMON_COST}</span></button>
      </aside>
    </div>
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
  const runEstimate = () => {
    let win = 0; const n = 20;
    for (let seed = 1; seed <= n; seed++) { const s = createSiege(castle, plans, { seed }); while (!s.over) step(s, 1 / 20); if (s.over.win) win++; }
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

  return (
    <div className="hub">
      <header className="hub-top">
        <button className="room" style={{ padding: '4px 8px' }} onClick={onBack}>← 지도</button>
        <div className="hub-title" style={{ marginRight: 0 }}>{region.name}</div>
        <span className="pips" title="수비 강도">{Array.from({ length: 5 }, (_, k) => <span key={k} style={{ opacity: k < Math.max(1, Math.min(5, Math.round(castle.power * 2))) ? 1 : 0.2 }}><IconThreat size={16} /></span>)}</span>
        <span className="res" style={{ marginLeft: 'auto' }}><IconGold /> {meta.gold}</span>
        <span className="res" title="제한 시간">⌛ {castle.timeLimit}<small>초</small></span>
      </header>
      <div className="lane-strip">
        {laneInfo.map((t, k) => (
          <div className="lane-row" key={k}><span className="lane-tag">{['위', '가운데', '아래'][k]} · {LANE_NAMES[k]}</span><span>{t}</span></div>
        ))}
        <div className="lane-tip">{castle.tip}</div>
      </div>
      <div className="squads" style={{ marginTop: 14 }}>
        {plans.map((p, i) => <SquadCard key={i} idx={i} plan={p} leaders={leaders} troops={troops} meta={meta} onChange={(f) => update(i, f)} tunnel={castle.tunnel} />)}
      </div>
      <div className="form-foot">
        {problem ? <span className="warn-text">{problem}</span> : estimate ? <span className="faint">{estimate}</span> : <button className="btn-ghost" onClick={runEstimate}>이 편성으로 미리 겨뤄 보기</button>}
        <button className="btn-war" style={{ minWidth: 260 }} disabled={!!problem} onClick={onStart}>출격{gearCost ? <span style={{ fontSize: 13, letterSpacing: 0 }}> · 장비 금화 {gearCost}</span> : null}</button>
      </div>
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
    <div className="squad-panel" style={{ ['--c' as string]: SQUAD_COL[idx % SQUAD_COL.length] }}>
      <VStack gap={3}>
        <div className="squad-head"><span>{idx + 1}부대</span><small style={{ color: g.color }}>{g.label}</small><small className="faint">병력 {used}/{cap}</small></div>
        <Selector label="부대장" value={plan.leader} options={Array.from(new Set([...leaders, plan.leader])).map((id) => ({ value: id, label: `${monLabel(id)} (보유 ${meta.owned[id] ?? 0})` }))}
          onChange={(v) => onChange((p) => { p.leader = v; let left = troopCap(v); p.troops.forEach((t) => { t.count = Math.min(t.count, left); left -= t.count; }); return p; })} />
        {leader.command && <div className="side-text"><b>지휘</b> {leader.command.desc}</div>}
        {SKILLS[plan.leader] && <div className="side-text"><b>「{SKILLS[plan.leader].name}」</b> {SKILLS[plan.leader].desc}</div>}
        {plan.troops.map((t, k) => (
          <HStack gap={2} key={k}>
            <Selector label={`병력 ${k + 1}`} value={t.id} options={troopOpts} onChange={(v) => setTroop(k, { id: v })} />
            <NumberInput label="수" value={t.count} min={0} max={cap} onChange={(v) => setTroop(k, { count: Math.max(0, Math.floor(v ?? 0)) })} />
          </HStack>
        ))}
        <SegmentedControl label="레인" value={String(plan.lane)} onChange={(v) => onChange((p) => { p.lane = Number(v) as Lane; return p; })}>
          {LANE_NAMES.map((n, i) => <SegmentedControlItem key={i} value={String(i)} label={n} isDisabled={i === 2 && !tunnel} />)}
        </SegmentedControl>
        <Selector label={`공성 장비 (대장간 ${facValue(meta, 'forge')}단계)`} value={plan.gear ?? 'none'}
          options={[{ value: 'none', label: '없음' }, ...(Object.keys(GEARS) as Gear[]).filter((k) => GEARS[k].forge <= facValue(meta, 'forge'))
            .map((k) => ({ value: k, label: `${GEARS[k].name} · 금화 ${GEARS[k].cost} — ${GEARS[k].desc}` }))]}
          onChange={(v) => onChange((p) => { p.gear = v === 'none' ? undefined : (v as Gear); return p; })} />
        <SegmentedControl label="출발" value={String(plan.delay)} onChange={(v) => onChange((p) => { p.delay = Number(v); return p; })}>
          {[0, 3, 6, 10, 20].map((d) => <SegmentedControlItem key={d} value={String(d)} label={d ? `${d}초 뒤` : '바로'} />)}
        </SegmentedControl>
      </VStack>
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
  const [aim, setAim] = useState<number | null>(null);
  const ctl = useRef({ paused, speed, aim });
  ctl.current = { paused, speed, aim };
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
    (window as unknown as { __siege?: SiegeState }).__siege = s;   // 시험용
    let last = performance.now(), raf = 0, hud = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (view!.updateCutin(dt)) { /* 연출 중에는 전투를 멈춘다 */ }
      else if (!ctl.current.paused) {
        // 조준하는 동안은 느리게
        let rem = dt * ctl.current.speed * (ctl.current.aim != null ? 0.15 : 1);
        while (rem > 1e-6) { const d = Math.min(1 / 30, rem); step(s, d); rem -= d; }
        view!.update(dt * ctl.current.speed * (ctl.current.aim != null ? 0.15 : 1));
      }
      view!.draw();
      if (s.over && !finished.current) {
        finished.current = true;
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
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= s.squads.length) { if (e.shiftKey) fallBack(s, n - 1); else useSkill(n - 1); }
      const dodge = ['q', 'w', 'e', 'r'].indexOf(e.key.toLowerCase());
      if (dodge >= 0 && dodge < s.squads.length) fallBack(s, dodge);
      if (e.key === 'Escape') setAim(null);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, [plans, castle]);

  /** 스킬 버튼: 땅을 찍는 스킬이면 조준, 아니면 바로 */
  function useSkill(i: number) {
    const st = ref.current?.s; if (!st || !canCast(st, i)) return;
    if (AIM[st.squads[i].skill!.kind]) setAim((a) => (a === i ? null : i)); else cast(st, i);
  }
  useEffect(() => { if (ref.current) ref.current.view.aim = aim == null ? null : { squad: aim, x: ref.current.view.aim?.x ?? 0, y: ref.current.view.aim?.y ?? 0 }; }, [aim]);
  const onMove = (e: React.PointerEvent) => {
    const v = ref.current?.view; if (!v?.aim) return;
    const w = v.toWorld(e.clientX, e.clientY); v.aim.x = w.x; v.aim.y = w.y;
  };
  const onField = (e: React.MouseEvent) => {
    const r = ref.current; if (!r || aim == null) return;
    const w = r.view.toWorld(e.clientX, e.clientY);
    cast(r.s, aim, { x: w.x, lane: w.lane });
    setAim(null);
  };
  const s = ref.current?.s;
  const glyph = (id: string) => (PEOPLE[id] ? MON[id].name.split(' ').pop()! : MON[id].name.split(' ')[0]).slice(0, 1);
  return (
    <div className="battle">
      <div className="bt-top">
        <span className="bt-name">{castle.name}</span>
        <span className="bt-time">{s ? Math.max(0, Math.ceil(castle.timeLimit - s.t)) : castle.timeLimit}<small>초</small></span>
        <div className="bt-core" title="본관 점거"><div style={{ width: `${s ? Math.min(100, (s.coreProg / castle.holdSec) * 100) : 0}%` }} /><span>본관 점거</span></div>
        <div className="bt-ctrl">
          <button onClick={() => setPaused(!paused)} title="일시정지(스페이스)">{paused ? '▶' : '❚❚'}</button>
          <button onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)} title="배속">×{speed}</button>
          <button onClick={onExit} title="포기하고 돌아가기">⚑</button>
        </div>
      </div>
      <div className={`battle-field${aim != null ? ' aiming' : ''}`}><canvas ref={canvasRef} onPointerMove={onMove} onClick={onField} onContextMenu={(e) => { e.preventDefault(); setAim(null); }} /></div>
      <div className="bt-help">{aim != null ? '땅을 눌러 스킬을 쓴다 · 오른쪽 클릭이나 Esc로 취소' : '1~4 스킬(땅을 찍어 조준) · Q W E R 회피 · 붉은 원이 뜨면 피하고, 보라 기둥은 끊어라'}</div>
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
            <div key={q.idx} className={`plate${!leaderOk && q.started ? ' down' : ''}`} style={{ ['--c' as string]: col, ['--g' as string]: GRADES[lm.grade].color }}>
              <div className="plate-face">{glyph(q.plan.leader)}<span>{q.idx + 1}</span></div>
              <div className="plate-mid">
                <div className="plate-name">{lm.name}<small>{LANE_NAMES[q.plan.lane]}{q.plan.gear ? ` · ${GEARS[q.plan.gear].name}` : ''}</small></div>
                <div className="plate-bar"><div style={{ width: `${q.started ? (alive / total) * 100 : 100}%` }} /></div>
                <div className="plate-tools">
                  <button title="위 레인으로" disabled={q.plan.lane === 0 || !q.started || !!s.over} onClick={() => setOrders(s, q.idx, { lane: (q.plan.lane - 1) as Lane })}>▲</button>
                  <button title="아래 레인으로" disabled={q.plan.lane === 2 || (q.plan.lane === 1 && !castle.tunnel) || !q.started || !!s.over} onClick={() => setOrders(s, q.idx, { lane: (q.plan.lane + 1) as Lane })}>▼</button>
                  <button title={q.orders.advance ? '정지' : '전진'} className={q.orders.advance ? '' : 'off'} onClick={() => setOrders(s, q.idx, { advance: !q.orders.advance })}>{q.orders.advance ? '➜' : '■'}</button>
                  {q.plan.lane === 1 && <button title={q.orders.gate === 'attack' ? '성문 공격 멈추기' : '성문 공격'} className={q.orders.gate === 'attack' ? '' : 'off'} disabled={s.gateHp <= 0} onClick={() => setOrders(s, q.idx, { gate: q.orders.gate === 'attack' ? 'wait' : 'attack' })}>⚔</button>}
                  <button title="회피: 위험한 곳에서 뒤로 뛴다" disabled={!q.started || q.retreated || !alive || !!s.over} onClick={() => fallBack(s, q.idx)}>↶</button>
                  <button title="후퇴" className="warn" disabled={!q.started || q.retreated || !alive || !!s.over} onClick={() => retreat(s, q.idx)}>⚑</button>
                </div>
              </div>
              {q.skill && (
                <button className={`plate-skill${canCast(s, q.idx) ? ' ready' : ''}${aim === q.idx ? ' aiming' : ''}`} style={{ ['--p' as string]: cdP }} disabled={!canCast(s, q.idx)} onClick={() => useSkill(q.idx)} title={`${q.skill.name}: ${q.skill.desc}`}>
                  <span>{q.skill.name}</span>{q.skillCd > 0 && <b>{Math.ceil(q.skillCd)}</b>}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {s?.over && (
        <div className="result">
          <div className="result-card">
            <div className={`result-title${s.over.win ? '' : ' lose'}`}>{s.over.win ? '함락' : '퇴각'}</div>
            {s.over.win && <div className="result-stars">{Array.from({ length: 3 }, (_, k) => <span key={k} className={k < stars(s) ? 'on' : ''}>★</span>)}</div>}
            <div className="result-sub">{s.over.win ? `${Math.floor(s.t)}초 만에 본관을 차지했다` : s.over.reason === '시간 초과' ? '시간 안에 성을 무너뜨리지 못했다' : '군단이 무너졌다'}</div>
            {mvp && (
              <div className="result-mvp" style={{ ['--g' as string]: GRADES[MON[mvp].grade].color }}>
                <div className="plate-face big">{glyph(mvp)}</div>
                <div><div className="mvp-name">{MON[mvp].name}</div><div className="speech">{PEOPLE[mvp]?.mvp ?? '이 정도는 식은 죽 먹기지.'}</div></div>
              </div>
            )}
            <ul className="result-list">{reward?.map((line, k) => <li key={k}>{line}</li>)}</ul>
            <div className="result-btns">
              <button className="btn-war" onClick={onExit}>돌아가기</button>
              <button className="btn-plain" onClick={onRetry}><span>편성 바꿔 다시</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
