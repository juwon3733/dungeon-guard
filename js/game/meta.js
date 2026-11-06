// 판을 넘어 남는 기록: 깬 스테이지, 본 몬스터, 찾은 조합식(히든 포함), 얻은 장비, 판 수, 승리 수, 최고 스테이지.
// 마왕, 유물, 유물 칸의 해금 여부는 저장하지 않고 깬 스테이지(js/data/story.js의 STAGES[].unlocks)에서 계산한다.
// 균열의 군주(DEFAULT_LORD)는 처음부터 쓰고 유물 칸은 0개로 시작한다.
// 저장은 localStorage의 META_KEY 한 칸에 버전 번호와 함께 JSON으로 둔다. 읽기와 쓰기는 모두 try/catch로 감싸,
// 저장소가 없거나(file://, tools/simulate.js, tools/smoke.js) 막히거나 값이 이상하면 초기값으로 그대로 돈다. 모르는 id는 버린다.
// 버전 1(영혼석으로 사던 때) 저장은 본 몬스터, 조합식, 판 수만 옮기고 산 항목과 영혼석은 버린다.
// 버전 2(12스테이지 스토리, 장비 기록 없음) 저장은 깬 스테이지와 최고 스테이지를 새 6스테이지 표로 옮긴다(옛 번호 N → 새 번호 ceil(N / 2)).
// 창을 열 때 main.js가 Meta.load()를 부른다. 부르지 않으면(시험 도구) 초기값에서 메모리로만 기록한다.
const META_KEY = 'dungeonGuard.meta';
const META_VERSION = 3;

// 0 이상의 정수(아니면 0)
function metaCount(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0; }

// 목록에서 ok인 것만, 겹치지 않게
function metaIds(list, ok) {
    const out = [];
    for (const id of Array.isArray(list) ? list : []) if (ok(id) && !out.includes(id)) out.push(id);
    return out;
}

// 예전(버전 2, 12스테이지) 스테이지 번호를 새 표의 번호로: ceil(N / 2). 표를 넘으면 마지막, 모르는 값은 0
function metaOldStageNo(n) {
    return n >= 1 && n <= STORY_OLD_STAGES ? Math.min(STAGES.length, Math.ceil(n / 2)) : 0;
}

// 예전 스테이지 id('s' + 옛 번호)를 새 표의 id로. 모르는 id는 null
function metaOldStageId(id) {
    const m = typeof id === 'string' ? /^s(\d+)$/.exec(id) : null;
    const st = m ? STAGES.find(s => s.no === metaOldStageNo(Number(m[1]))) : null;
    return st ? st.id : null;
}

const Meta = {
    data: null, // 아래에서 fresh()로 채운다

    // 처음 상태: 깬 스테이지 없음, 기록 없음
    fresh() {
        return { version: META_VERSION, cleared: [], seen: [], recipes: [], equips: [], runs: 0, wins: 0, bestStage: 0 };
    },

    // 저장된 값을 쓸 수 있는 값으로 고친다. 모르는 id, 겹친 id, 숫자가 아닌 값은 버린다.
    // 버전 2는 깬 스테이지와 최고 스테이지를 새 표로 옮긴다(장비 기록은 없다). 그 밖의 버전(1이나 버전 없는 값)은
    // 본 몬스터, 조합식, 판 수만 옮긴다
    sanitize(raw) {
        const d = this.fresh();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
        const keys = new Set(MONSTER_RECIPES.map(recipeKey));
        d.seen = metaIds(raw.seen, id => hasEntry(MONSTERS, id));
        d.recipes = metaIds(raw.recipes, k => typeof k === 'string' && keys.has(k));
        d.runs = metaCount(raw.runs);
        const old = raw.version === 2;
        if (raw.version !== META_VERSION && !old) return d;
        const cleared = old ? (Array.isArray(raw.cleared) ? raw.cleared : []).map(metaOldStageId) : raw.cleared;
        d.cleared = metaIds(cleared, hasStage);
        if (!old) d.equips = metaIds(raw.equips, id => hasEntry(EQUIPMENT, id));
        d.wins = Math.min(metaCount(raw.wins), d.runs);
        const top = Math.max(0, ...d.cleared.map(id => stageDef(id).no));
        const best = old ? metaOldStageNo(metaCount(raw.bestStage)) || (metaCount(raw.bestStage) > STORY_OLD_STAGES ? STAGES.length : 0) : metaCount(raw.bestStage);
        d.bestStage = clamp(best, top, STAGES.length);
        return d;
    },

    // 저장소에서 읽는다. 못 읽으면 초기값
    load() {
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(META_KEY) || 'null');
        } catch (e) { /* 초기값 사용 */ }
        this.data = this.sanitize(raw);
        return this.data;
    },

    save() {
        try {
            localStorage.setItem(META_KEY, JSON.stringify(this.data));
        } catch (e) { /* 저장을 못 해도 이번 창에서는 기록이 남는다 */ }
    },

    // 기록 지우기: 초기 상태로 되돌리고 저장한다
    wipe() {
        this.data = this.fresh();
        this.save();
    },

    // ----- 스테이지 -----

    isCleared(id) { return this.data.cleared.includes(id); },

    // 첫 스테이지는 처음부터, 다음 스테이지는 이전 스테이지를 깨면 열린다
    isOpen(id) {
        const i = STAGES.findIndex(s => s.id === id);
        return i === 0 || (i > 0 && this.isCleared(STAGES[i - 1].id));
    },

    // 깬 스테이지에서 풀린 것 목록
    unlocked() {
        const out = [];
        for (const s of STAGES) if (this.isCleared(s.id)) out.push(...s.unlocks);
        return out;
    },

    // ----- 해금(깬 스테이지에서 계산) -----

    hasLord(id) {
        if (!hasEntry(DEMON_LORDS, id)) return false;
        return id === DEFAULT_LORD || this.unlocked().some(u => u.kind === 'lord' && u.id === id);
    },

    hasRelic(id) {
        return hasEntry(RELICS, id) && this.unlocked().some(u => u.kind === 'relic' && u.id === id);
    },

    // 지금 쓸 수 있는 유물 칸 수(0부터)
    relicSlots() { return this.unlocked().filter(u => u.kind === 'slot').length; },

    // 스토리를 다 깨면 열리는 칸 수
    maxSlots() { return STAGES.reduce((n, s) => n + s.unlocks.filter(u => u.kind === 'slot').length, 0); },

    lordsOwned() { return Object.keys(DEMON_LORDS).filter(id => this.hasLord(id)); },
    relicsOwned() { return Object.keys(RELICS).filter(id => this.hasRelic(id)); },

    // ----- 도감 기록 -----

    hasSeen(type) { return this.data.seen.includes(type); },
    hasRecipe(r) { return this.data.recipes.includes(recipeKey(r)); },

    // 소환, 합치기, 보스 보상으로 맵에 나온 몬스터. 처음 본 것이면 true
    seeMonster(type) {
        if (!hasEntry(MONSTERS, type) || this.hasSeen(type)) return false;
        this.data.seen.push(type);
        this.save();
        return true;
    },

    // 합치기로 만든 조합식(공개와 히든 모두). 처음 찾은 것이면 true. 다시 찾아도 기록은 한 번만 남는다
    findRecipe(r) {
        if (!r || this.hasRecipe(r)) return false;
        this.data.recipes.push(recipeKey(r));
        this.save();
        return true;
    },

    // ----- 장비 기록(무기고) -----

    hasEquip(id) { return this.data.equips.includes(id); },

    // 판에서 얻은 장비(정예 드롭, 보스 보상, 보관함이 가득 차 골드로 바뀐 것 포함). 처음 얻은 것이면 true
    seeEquip(id) {
        if (!hasEntry(EQUIPMENT, id) || this.hasEquip(id)) return false;
        this.data.equips.push(id);
        this.save();
        return true;
    },

    // ----- 판 결과 -----

    // 판이 끝날 때 한 번 부른다. 판 수와 승리 수를 남기고, 스테이지(stageId, 없으면 시험 도구의 판)를 처음 깼으면
    // 깬 목록에 넣는다. 해금은 처음 깰 때만 준다.
    // { stage, victory, waves: 막은 웨이브 수, firstClear, unlocks: 이번에 풀린 것(처음 깰 때만), bestStage: 새 최고 기록인지 }
    finishRun(stageId, victory, waves) {
        const d = this.data;
        const stage = hasStage(stageId) ? stageDef(stageId) : null;
        d.runs++;
        if (victory) d.wins++;
        const firstClear = !!(victory && stage && !this.isCleared(stage.id));
        if (firstClear) d.cleared.push(stage.id);
        const bestStage = !!(victory && stage && stage.no > d.bestStage);
        if (bestStage) d.bestStage = stage.no;
        this.save();
        return { stage: stage ? stage.id : null, victory, waves, firstClear, unlocks: firstClear ? stage.unlocks.slice() : [], bestStage };
    }
};
Meta.data = Meta.fresh();
