// 판 밖 목표(2026-11-11): 업적, 마왕 숙련도, 일일·주간 임무, 칭호.
// 보상은 판의 세기에 영향이 없는 것(칭호, 초상 테두리)만 준다. 랭킹 공정성을 지킨다.
// 기록은 Meta.data.progress에 남는다(Meta.sanitize가 progressSanitize로 다듬는다). 판이 끝나면 Game.finish가 Progress.recordRun을 부른다.

// 업적: stat은 Progress.statValue가 읽는 값, need 이상이면 달성. title이 있으면 칭호를 준다
const ACHIEVEMENTS = [
    { id: 'story1', name: '첫 출전', desc: '스토리 1스테이지를 깬다', stat: 'story', need: 1 },
    { id: 'storyAll', name: '이야기의 끝', desc: '스토리 6스테이지를 모두 깬다', stat: 'story', need: 6, title: '마왕군 사령관' },
    { id: 'abyss50', name: '심연 50층', desc: '끝없는 심연에서 50층까지 내려간다', stat: 'abyss', need: 50 },
    { id: 'abyss100', name: '심연 100층', desc: '끝없는 심연에서 100층까지 내려간다', stat: 'abyss', need: 100 },
    { id: 'abyss150', name: '심연 150층', desc: '끝없는 심연에서 150층까지 내려간다', stat: 'abyss', need: 150, title: '심연 순례자' },
    { id: 'abyss200', name: '심연 200층', desc: '끝없는 심연에서 200층까지 내려간다', stat: 'abyss', need: 200, title: '심연의 주인' },
    { id: 'abyssHard', name: '깊은 계약', desc: '하드 이상 난이도 심연에서 100층까지 내려간다', stat: 'abyssHard', need: 100, title: '계약자' },
    { id: 'kills10k', name: '용사 만 명', desc: '용사를 모두 1만 명 쓰러뜨린다', stat: 'kills', need: 10000 },
    { id: 'kills100k', name: '용사 십만 명', desc: '용사를 모두 10만 명 쓰러뜨린다', stat: 'kills', need: 100000, title: '용사 사냥꾼' },
    { id: 'kills1m', name: '용사 백만 명', desc: '용사를 모두 100만 명 쓰러뜨린다', stat: 'kills', need: 1000000, title: '재앙' },
    { id: 'altar1', name: '첫 제단', desc: '조합 제단으로 히든을 만든다', stat: 'altars', need: 1 },
    { id: 'altar50', name: '제단지기', desc: '조합 제단으로 히든을 50번 만든다', stat: 'altars', need: 50 },
    { id: 'hidden10', name: '숨은 조합 10개', desc: '서로 다른 히든 조합식을 10개 찾는다', stat: 'hidden', need: 10 },
    { id: 'hiddenAll', name: '숨은 조합 전부', desc: '히든 조합식을 모두 찾는다', stat: 'hidden', need: 30, title: '연금술사' },
    { id: 'mythic1', name: '신화의 탄생', desc: '신화 몬스터를 맵에 세운다', stat: 'mythics', need: 1 },
    { id: 'trans1', name: '초월', desc: '초월 몬스터를 만든다', stat: 'transcendents', need: 1, title: '초월자' },
    { id: 'transAll', name: '네 개의 초월', desc: '초월 몬스터 네 종을 모두 만든다', stat: 'transKinds', need: 4, title: '차원의 왕' },
    { id: 'splus1', name: '백분의 일', desc: '랭크 돌리기로 S+를 뽑는다', stat: 'splus', need: 1, title: '행운의 마왕' },
    { id: 'splus10', name: '거듭된 행운', desc: '랭크 돌리기로 S+를 10번 뽑는다', stat: 'splus', need: 10 },
    { id: 'rolls500', name: '주사위 중독', desc: '랭크를 500번 돌린다', stat: 'rankRolls', need: 500 },
    { id: 'lordsAll', name: '일곱 마왕', desc: '마왕 일곱 명으로 모두 판을 한다', stat: 'lords', need: 7 },
    { id: 'mastery10', name: '마왕의 경지', desc: '마왕 하나의 숙련도를 10레벨로 올린다', stat: 'masteryTop', need: 10, title: '경지에 이른 자' },
    { id: 'raid5', name: '토벌 5단계', desc: '주간 토벌전에서 5단계를 잡는다', stat: 'raid', need: 5 },
    { id: 'raid10', name: '토벌 10단계', desc: '주간 토벌전에서 10단계를 잡는다', stat: 'raid', need: 10, title: '보스 사냥꾼' },
    { id: 'daily10', name: '열흘의 도전', desc: '서로 다른 날 일일 도전을 10번 한다', stat: 'dailyDays', need: 10 },
    { id: 'runs100', name: '백 번의 판', desc: '판을 모두 100번 한다', stat: 'runs', need: 100 },
    { id: 'awaken10', name: '각성 열 번', desc: '한 판에서 마왕을 10번 각성시킨다', stat: 'awakenRun', need: 10 },
    { id: 'field36', name: '넓은 영토', desc: '한 판에서 맵을 36마리까지 넓힌다', stat: 'fieldRun', need: 36 }
];

// 마왕 숙련도: 그 마왕으로 한 판의 라운드(층) 수만큼 경험치. 레벨 n이 되는 누적 경험치
const MASTERY_XP = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200];
// 초상 테두리: 숙련도 레벨 구간마다 색(1~2 쇠, 3~4 구리, 5~6 은, 7~8 금, 9 루비, 10 무지개)
const MASTERY_FRAMES = [
    { from: 1, name: '쇠', color: '#8a8f99' }, { from: 3, name: '구리', color: '#c8794a' }, { from: 5, name: '은', color: '#d6e4ff' },
    { from: 7, name: '금', color: '#ffd25a' }, { from: 9, name: '루비', color: '#ff4a6a' }, { from: 10, name: '무지개', color: '#ffffff', rainbow: true }
];

// 임무: 날짜(일일)와 주차(주간) 시드로 골라 하루 3개, 한 주 3개. stat은 이번 판 결과 값, 기간 동안 더해 need에 닿으면 달성.
// max가 있으면 한 판의 값이 need 이상이면 달성(누적하지 않는다). 달성하면 그 판의 마왕에게 숙련도 경험치를 준다
const MISSION_POOL = [
    { id: 'm_runs', text: '판 {n}번 하기', stat: 'runs', daily: 3, weekly: 15 },
    { id: 'm_kills', text: '용사 {n}명 쓰러뜨리기', stat: 'kills', daily: 3000, weekly: 20000 },
    { id: 'm_altar', text: '조합 제단으로 히든 {n}번', stat: 'altars', daily: 3, weekly: 15 },
    { id: 'm_rolls', text: '랭크 {n}번 돌리기', stat: 'rankRolls', daily: 20, weekly: 120 },
    { id: 'm_abyss', text: '심연에서 한 판에 {n}층', stat: 'abyss', daily: 50, weekly: 100, max: true },
    { id: 'm_daily', text: '일일 도전 {n}번', stat: 'daily', daily: 1, weekly: 4 },
    { id: 'm_mythic', text: '신화 몬스터 {n}번 세우기', stat: 'mythics', daily: 1, weekly: 5 },
    { id: 'm_field', text: '한 판에 맵 {n}마리까지 넓히기', stat: 'fieldRun', daily: 28, weekly: 34, max: true }
];
const MISSION_RULES = { dailyCount: 3, weeklyCount: 3, dailyXp: 150, weeklyXp: 500 };

// 날짜·주차 시드로 임무 고르기(같은 날이면 모두 같은 임무)
function pickMissions(seed, count) {
    let st = 0;
    for (let i = 0; i < seed.length; i++) st = (st * 31 + seed.charCodeAt(i)) | 0;
    const pool = MISSION_POOL.slice();
    const out = [];
    while (out.length < count && pool.length) {
        st = (st * 1103515245 + 12345) | 0;
        out.push(pool.splice(Math.abs(st) % pool.length, 1)[0]);
    }
    return out;
}

function progressFresh() {
    return { stats: {}, done: [], mastery: {}, title: '', missions: { day: '', daily: {}, week: '', weekly: {}, claimed: [] } };
}

// 저장된 progress 다듬기: 모르는 업적·마왕은 버리고 숫자는 0 이상 정수로
function progressSanitize(raw) {
    const d = progressFresh();
    if (!raw || typeof raw !== 'object') return d;
    const num = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    if (raw.stats && typeof raw.stats === 'object') {
        for (const [k, v] of Object.entries(raw.stats)) {
            if (Array.isArray(v)) d.stats[k] = v.filter(x => typeof x === 'string').slice(0, 400);
            else d.stats[k] = num(v);
        }
    }
    d.done = Array.isArray(raw.done) ? raw.done.filter(id => ACHIEVEMENTS.some(a => a.id === id)) : [];
    if (raw.mastery && typeof raw.mastery === 'object') for (const id of Object.keys(DEMON_LORDS)) if (num(raw.mastery[id])) d.mastery[id] = num(raw.mastery[id]);
    d.title = typeof raw.title === 'string' && ACHIEVEMENTS.some(a => a.title === raw.title && d.done.includes(a.id)) ? raw.title : '';
    const m = raw.missions && typeof raw.missions === 'object' ? raw.missions : {};
    d.missions.day = typeof m.day === 'string' ? m.day : '';
    d.missions.week = typeof m.week === 'string' ? m.week : '';
    for (const k of ['daily', 'weekly']) if (m[k] && typeof m[k] === 'object') for (const [id, v] of Object.entries(m[k])) if (MISSION_POOL.some(p => p.id === id)) d.missions[k][id] = num(v);
    d.missions.claimed = Array.isArray(m.claimed) ? m.claimed.filter(x => typeof x === 'string').slice(0, 20) : [];
    return d;
}

const Progress = {
    get data() {
        if (!Meta.data.progress) Meta.data.progress = progressFresh();
        return Meta.data.progress;
    },

    // 오늘·이번 주 임무로 바꾼다(날이 바뀌면 진행을 지운다)
    refreshMissions(now) {
        const m = this.data.missions;
        const day = kstDate(now);
        const week = abyssWeek(now);
        if (m.day !== day) { m.day = day; m.daily = {}; m.claimed = m.claimed.filter(x => !x.startsWith('d:')); }
        if (m.week !== week) { m.week = week; m.weekly = {}; m.claimed = m.claimed.filter(x => !x.startsWith('w:')); }
        return { daily: pickMissions(`daily-${day}`, MISSION_RULES.dailyCount), weekly: pickMissions(`weekly-${week}`, MISSION_RULES.weeklyCount) };
    },

    masteryLevel(lord) {
        const xp = this.data.mastery[lord] || 0;
        let lv = 1;
        for (let i = 0; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]) lv = i + 1;
        return Math.min(lv, MASTERY_XP.length);
    },
    masteryFrame(lord) {
        const lv = this.masteryLevel(lord);
        return MASTERY_FRAMES.filter(f => lv >= f.from).pop();
    },

    // 업적 진행 값
    statValue(stat) {
        const s = this.data.stats;
        if (stat === 'story') return Meta.data.cleared.length;
        if (stat === 'hidden') return MONSTER_RECIPES.filter(r => r.hidden && Meta.hasRecipe(r)).length;
        if (stat === 'lords') return (s.lords || []).length;
        if (stat === 'transKinds') return (s.transKinds || []).length;
        if (stat === 'dailyDays') return (s.dailyDays || []).length;
        if (stat === 'masteryTop') return Math.max(1, ...Object.keys(DEMON_LORDS).map(id => this.masteryLevel(id)));
        return s[stat] || 0;
    },

    titles() { return ACHIEVEMENTS.filter(a => a.title && this.data.done.includes(a.id)).map(a => a.title); },
    setTitle(t) { if (t === '' || this.titles().includes(t)) { this.data.title = t; Meta.save(); } },

    // 판 하나의 결과를 쌓는다. run: { kind, lord, rounds, kills, altars, rankRolls, splus, mythics, transcendents, transKinds, abyssLevel, fieldRun, awakenRun, raidTier }
    // 새로 이룬 업적과 임무를 돌려준다 { achievements: [...], missions: [...], levelUp }
    recordRun(run, now) {
        const d = this.data;
        const s = d.stats;
        const add = (k, v) => { s[k] = (s[k] || 0) + (v || 0); };
        const best = (k, v) => { s[k] = Math.max(s[k] || 0, v || 0); };
        const addSet = (k, v) => { s[k] = s[k] || []; if (v && !s[k].includes(v)) s[k].push(v); };
        add('runs', 1);
        add('kills', run.kills);
        add('altars', run.altars);
        add('rankRolls', run.rankRolls);
        add('splus', run.splus);
        add('mythics', run.mythics);
        add('transcendents', run.transcendents);
        for (const t of run.transKinds || []) addSet('transKinds', t);
        addSet('lords', run.lord);
        if (run.kind === 'abyss') {
            best('abyss', run.rounds);
            if (run.abyssLevel >= 4) best('abyssHard', run.rounds); // 하드(4) 이상
        }
        if (run.kind === 'raid') best('raid', run.raidTier);
        if (run.kind === 'daily') addSet('dailyDays', kstDate(now));
        best('awakenRun', run.awakenRun);
        best('fieldRun', run.fieldRun);
        // 숙련도: 라운드(층)만큼
        const before = this.masteryLevel(run.lord);
        if (run.lord) d.mastery[run.lord] = (d.mastery[run.lord] || 0) + Math.max(0, run.rounds || 0);
        // 임무
        const list = this.refreshMissions(now);
        const doneMissions = [];
        const step = (kind, picks, store, xp) => {
            for (const p of picks) {
                const need = p[kind];
                const v = p.stat === 'runs' ? 1 : p.stat === 'daily' ? (run.kind === 'daily' ? 1 : 0) : (p.stat === 'abyss' ? (run.kind === 'abyss' ? run.rounds : 0) : (run[p.stat] || 0));
                store[p.id] = p.max ? Math.max(store[p.id] || 0, v) : (store[p.id] || 0) + v;
                const key = `${kind === 'daily' ? 'd' : 'w'}:${p.id}`;
                if (store[p.id] >= need && !d.missions.claimed.includes(key)) {
                    d.missions.claimed.push(key);
                    if (run.lord) d.mastery[run.lord] = (d.mastery[run.lord] || 0) + xp;
                    doneMissions.push(p.text.replace('{n}', need.toLocaleString()));
                }
            }
        };
        step('daily', list.daily, d.missions.daily, MISSION_RULES.dailyXp);
        step('weekly', list.weekly, d.missions.weekly, MISSION_RULES.weeklyXp);
        // 업적
        const newAch = [];
        for (const a of ACHIEVEMENTS) {
            if (d.done.includes(a.id)) continue;
            if (this.statValue(a.stat) >= a.need) { d.done.push(a.id); newAch.push(a); }
        }
        Meta.save();
        return { achievements: newAch, missions: doneMissions, levelUp: run.lord && this.masteryLevel(run.lord) > before ? this.masteryLevel(run.lord) : 0 };
    }
};
