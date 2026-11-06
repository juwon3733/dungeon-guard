// 화면 없이 게임 로직을 돌려 규칙과 밸런스를 확인한다. 실행: node tools/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/meta.js', 'js/game/game.js'];
const context = vm.createContext({ console, Math, Set, Object, Array, Infinity, Sfx: { play() {} } });
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });

const scenario = `
function run(plan, options) {
    options = options || {};
    Game.reset();
    const DT = 1 / 30;
    let guard = 0;
    while ((Game.state === 'prep' || Game.state === 'wave') && guard++ < 200000) {
        plan(Game, options);
        if (Game.bossReward) Game.pickBossReward(Game.bossReward.cards.length - 1); // 보스 보상은 골드를 고른다
        if (Game.state === 'prep' && options.skipPrep) Game.startWave();
        Game.update(DT);
    }
    return { state: Game.state, wave: Game.waveIndex + 1, hp: Game.hp, gold: Game.gold, kills: Game.stats.kills,
        built: Game.monsters.length, corrupted: Game.stats.corrupted, time: Math.round(Game.stats.time) };
}

// 경로 순서대로 배치 후보를 정렬한다
const CANDIDATES = [[3,4],[5,5],[3,6],[5,3],[7,6],[9,4],[9,6],[7,4],[11,4],[13,5],[11,6],[13,7],[15,7],[17,6],[15,5],[11,8],[13,4],[3,2],[6,8],[9,2]];

// Why: 게임은 이제 무작위 소환과 합치기로 몬스터를 얻는다. 이 시험은 그 전처럼 원하는 몬스터를 고정 가격(cost)에 사서 놓는
// 전략만 비교한다. 소환·합치기 판의 밸런스는 아직 재지 않는다(수치가 초안이다).
function buy(G, type, c, r) {
    if (G.gold < MONSTERS[type].cost) return false;
    if (!G.place(type, c, r)) return false;
    G.gold -= MONSTERS[type].cost;
    return true;
}

function nextCell(G, offset) {
    for (const [c, r] of CANDIDATES.slice(offset || 0)) if (isBuildCell(c, r) && !G.monsterAt(c, r)) return [c, r];
    return null;
}

const plans = {
    nothing() {},
    archersOnly(G) {
        const cell = nextCell(G);
        if (cell) buy(G, 'skeleton_archer', cell[0], cell[1]);
    },
    balanced(G) {
        const n = G.monsters.length;
        const want = n === 0 ? 'skeleton_archer' : (n % 4 === 1 ? 'orc_guard' : (n % 4 === 3 ? 'dark_mage' : 'skeleton_archer'));
        const upgradable = G.monsters.find(f => f.tier < 2);
        if (n >= 5 && upgradable && G.gold >= upgradeCost(upgradable.type, 2)) {
            G.upgrade(upgradable);
            return;
        }
        const t3 = G.monsters.find(f => f.tier === 2);
        if (n >= 7 && t3 && G.gold >= upgradeCost(t3.type, 3)) {
            G.upgrade(t3, 'A');
            return;
        }
        const cell = nextCell(G);
        if (cell) buy(G, want, cell[0], cell[1]);
    },
    skilled(G, o) {
        plans.balanced(G, o);
        // 번개는 가장 앞선 무리에, 쓰러진 용사는 여유 있으면 타락
        if (G.skills.lightning === 0 && G.state === 'wave') {
            const h = G.heroes.filter(x => !x.waiting).sort((a, b) => b.d - a.d)[0];
            if (h && h.d > PATH.length * 0.45) { const p = heroWorld(h); castLightning(p.x, p.y); }
        }
        if (G.corpses.length && G.gold > 90) corruptCorpse(G.corpses[0]);
    }
};

const out = {};
for (const name of Object.keys(plans)) {
    const results = [];
    for (let i = 0; i < 12; i++) results.push(run(plans[name]));
    const wins = results.filter(r => r.state === 'victory').length;
    const avg = key => Math.round(results.reduce((s, r) => s + r[key], 0) / results.length * 10) / 10;
    out[name] = { wins: wins + '/12', wave: avg('wave'), hp: avg('hp'), built: avg('built'), corrupted: avg('corrupted'), time: avg('time') };
}
console.log(JSON.stringify(out, null, 1));
console.log('build cells', BUILD_CELLS.size, 'path px', Math.round(PATH.length));
`;
vm.runInContext(scenario, context, { filename: 'scenario' });
