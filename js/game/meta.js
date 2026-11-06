// 영구 수집: 판을 넘어 남는 기록. 판이 끝나면 뽑은 몬스터는 사라지고 영혼석, 해금한 마왕과 유물, 유물 칸 수,
// 본 몬스터, 찾은 조합식(히든 포함), 판 수, 승리 수, 최고 웨이브가 남는다. 가격과 영혼석 수치는 js/data/demonlords.js의
// META_RULES와 각 표의 unlock(수치 초안).
// 저장은 localStorage의 META_KEY 한 칸에 버전 번호와 함께 JSON으로 둔다. 읽기와 쓰기는 모두 try/catch로 감싸,
// 저장소가 없거나(file://, tools/simulate.js, tools/smoke.js) 막히거나 값이 이상하면 초기값으로 그대로 돈다. 모르는 id는 버린다.
// 창을 열 때 main.js가 Meta.load()를 부른다. 부르지 않으면(시험 도구) 초기값에서 메모리로만 기록한다.
const META_KEY = 'dungeonGuard.meta';
const META_VERSION = 1;

// 0 이상의 정수(아니면 0)
function metaCount(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0; }

// 목록에서 ok인 것만, 겹치지 않게
function metaIds(list, ok) {
    const out = [];
    for (const id of Array.isArray(list) ? list : []) if (ok(id) && !out.includes(id)) out.push(id);
    return out;
}

const Meta = {
    data: null, // 아래에서 fresh()로 채운다

    // 처음 상태: 영혼석 0, 해금은 unlock 0인 것만, 유물 칸 META_RULES.relicSlots.start개, 기록 없음
    fresh() {
        return { version: META_VERSION, souls: 0, lords: [], relics: [], slots: META_RULES.relicSlots.start,
            seen: [], recipes: [], runs: 0, wins: 0, bestWave: 0 };
    },

    maxSlots() { return META_RULES.relicSlots.start + META_RULES.relicSlots.prices.length; },

    // 저장된 값을 쓸 수 있는 값으로 고친다. 모르는 id, 겹친 id, 숫자가 아닌 값은 버리고 칸 수는 범위 안으로
    // (버전이 오르면 여기서 이전 형식을 옮긴다. 지금은 1뿐이다)
    sanitize(raw) {
        const d = this.fresh();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
        const keys = new Set(MONSTER_RECIPES.map(recipeKey));
        d.souls = metaCount(raw.souls);
        d.lords = metaIds(raw.lords, id => hasEntry(DEMON_LORDS, id));
        d.relics = metaIds(raw.relics, id => hasEntry(RELICS, id));
        d.slots = clamp(metaCount(raw.slots), META_RULES.relicSlots.start, this.maxSlots());
        d.seen = metaIds(raw.seen, id => hasEntry(MONSTERS, id));
        d.recipes = metaIds(raw.recipes, k => typeof k === 'string' && keys.has(k));
        d.runs = metaCount(raw.runs);
        d.wins = Math.min(metaCount(raw.wins), d.runs);
        d.bestWave = Math.min(metaCount(raw.bestWave), WAVES.length);
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

    // ----- 해금 -----

    // 해금 가격(영혼석). 0이면 처음부터 쓴다. 모르는 id는 null
    price(kind, id) {
        const table = kind === 'lord' ? DEMON_LORDS : RELICS;
        return hasEntry(table, id) ? (table[id].unlock || 0) : null;
    },

    owns(kind, id) {
        const price = this.price(kind, id);
        if (price === null) return false;
        return price === 0 || this.data[kind === 'lord' ? 'lords' : 'relics'].includes(id);
    },

    hasLord(id) { return this.owns('lord', id); },
    hasRelic(id) { return this.owns('relic', id); },

    // 마왕(kind 'lord')이나 유물('relic')을 영혼석으로 산다.
    // 실패하면 { ok: false, reason: 'unknown' | 'owned' | 'souls', need: 모자란 영혼석 }
    buy(kind, id) {
        const price = this.price(kind, id);
        if (price === null) return { ok: false, reason: 'unknown' };
        if (this.owns(kind, id)) return { ok: false, reason: 'owned' };
        if (this.data.souls < price) return { ok: false, reason: 'souls', need: price - this.data.souls };
        this.data.souls -= price;
        this.data[kind === 'lord' ? 'lords' : 'relics'].push(id);
        this.save();
        return { ok: true, price };
    },

    relicSlots() { return this.data.slots; },

    // 다음 유물 칸 가격. 최대면 null
    slotPrice() {
        const p = META_RULES.relicSlots.prices[this.data.slots - META_RULES.relicSlots.start];
        return p === undefined ? null : p;
    },

    // 유물 칸 하나를 산다. 실패하면 { ok: false, reason: 'max' | 'souls', need }
    buySlot() {
        const price = this.slotPrice();
        if (price === null) return { ok: false, reason: 'max' };
        if (this.data.souls < price) return { ok: false, reason: 'souls', need: price - this.data.souls };
        this.data.souls -= price;
        this.data.slots++;
        this.save();
        return { ok: true, price, slots: this.data.slots };
    },

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

    // ----- 판 결과 -----

    // 판 하나의 영혼석: 막은 웨이브 수 x soulsPerWave, 승리하면 winBonus를 더한다
    soulsFor(waves, victory) {
        return waves * META_RULES.soulsPerWave + (victory ? META_RULES.winBonus : 0);
    },

    // 판이 끝날 때 한 번 부른다. 영혼석을 주고 판 수, 승리 수, 최고 웨이브를 남긴다.
    // { souls: 받은 양, total: 보유량, waves, bestWave: 새 최고 기록인지, firstWin: 첫 승리인지 }
    finishRun(waves, victory) {
        const d = this.data;
        const souls = this.soulsFor(waves, victory);
        const bestWave = waves > d.bestWave;
        const firstWin = victory && d.wins === 0;
        d.souls += souls;
        d.runs++;
        if (victory) d.wins++;
        if (bestWave) d.bestWave = waves;
        this.save();
        return { souls, total: d.souls, waves, bestWave, firstWin };
    }
};
Meta.data = Meta.fresh();
