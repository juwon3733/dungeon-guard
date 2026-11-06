// 클릭 흐름 자동 시험: 화면 없이 실제 입력 함수를 호출해 한 판을 끝까지 진행한다. 실행: node tools/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/meta.js', 'js/game/game.js', 'js/ui/ui.js'];
const ctx = vm.createContext({ console, assert, Math, Set, Object, Array, Infinity, Number, String, JSON,
    Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

// 장비 그림 16종: 파일(48px PNG)이 있고 불러오기 목록(Assets.names)에 들어 있다
{
    const actx = vm.createContext({ console });
    for (const f of ['js/core/config.js', 'js/data/balance.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/fx_sheets.js', 'js/core/assets.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), actx, { filename: f });
    }
    const ids = vm.runInContext('Object.keys(EQUIPMENT)', actx);
    const names = vm.runInContext('Assets.names()', actx);
    assert.strictEqual(ids.length, 16, 'sixteen equipment');
    for (const id of ids) {
        const file = path.join(root, 'assets/sprites', `equip_${id}.png`);
        assert(fs.existsSync(file), 'missing picture ' + file);
        const png = fs.readFileSync(file);
        assert(png.readUInt32BE(16) === 48 && png.readUInt32BE(20) === 48, `equip_${id}.png is 48px`);
        assert(names.includes(`equip_${id}`), `equip_${id} in Assets.names()`);
    }
    // 마왕과 유물 그림: 표에 적은 그림 파일이 있고(마왕 128px, 유물 48px) 불러오기 목록에 들어 있다
    const pngSize = name => {
        const file = path.join(root, 'assets/sprites', `${name}.png`);
        assert(fs.existsSync(file), 'missing picture ' + file);
        const png = fs.readFileSync(file);
        return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    const lords = vm.runInContext('Object.values(DEMON_LORDS)', actx);
    assert.strictEqual(lords.length, 3, 'three lords');
    for (const lord of lords) {
        for (const name of [lord.sprite, lord.cast].filter(Boolean)) {
            assert.deepStrictEqual(pngSize(name), [128, 128], name + ' is 128px');
            assert(names.includes(name), name + ' in Assets.names()');
        }
        assert(names.includes(lord.portrait.sprite) && pngSize(lord.portrait.sprite), 'portrait ' + lord.portrait.sprite);
        if (lord.portrait.crop) {
            const [x, y, s] = lord.portrait.crop;
            assert(x >= 0 && y >= 0 && x + s <= 128 && y + s <= 128, 'portrait crop inside the picture');
        }
    }
    const relicIds = vm.runInContext('Object.keys(RELICS)', actx);
    assert.strictEqual(relicIds.length, 16, 'sixteen relics');
    for (const id of relicIds) {
        assert.deepStrictEqual(pngSize(`relic_${id}`), [48, 48], `relic_${id}.png is 48px`);
        assert(names.includes(`relic_${id}`), `relic_${id} in Assets.names()`);
    }
}
vm.runInContext(`
// 입력은 main.js와 같은 길로 넣는다: 누름(onDown) → 움직임(onMove) → 뗌(onUp). 마우스와 터치가 같은 pointer 이벤트다
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const worldClick = (x, y) => click(x * WORLD_ZOOM, y * WORLD_ZOOM);
const cellClick = (c, r) => worldClick(tileX(c), tileY(r));
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btn = id => { UI.update(0); const b = UI.buttons.find(b => b.id === id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const tick = s => { for (let i = 0; i < s * 30; i++) { UI.update(1 / 30); Game.update(1 / 30); } };
// 끌기: 누른 채로 몇 번에 나눠 움직인 뒤 뗀다
const dragTo = (from, to) => {
    UI.update(0);
    UI.onMove(from[0], from[1]);
    UI.onDown(from[0], from[1]);
    for (let i = 1; i <= 4; i++) UI.onMove(from[0] + (to[0] - from[0]) * i / 4, from[1] + (to[1] - from[1]) * i / 4);
    UI.onUp(to[0], to[1]);
};
const cellXY = (c, r) => [tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM];
const monXY = m => [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
// Math.random을 고정한다. 배열이면 부를 때마다 차례로 돌려주고, 다 쓰면 0을 돌려준다
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};

// 영구 수집은 저장소 없이 초기값에서 시작한다(시험끼리 기록이 이어지지 않게 블록마다 처음 상태로 둔다)
assert(typeof localStorage === 'undefined', 'smoke runs without storage');
Meta.data = Meta.fresh();
// 시작: 타이틀 → 선택 화면(기본 마왕 균열의 군주, 유물 없음) → 시작
assert.strictEqual(Game.state, 'title');
btn('start');
assert.strictEqual(Game.state, 'select');
assert.strictEqual(JSON.stringify(UI.loadout), '{"lord":"rift","relics":[]}', 'default loadout');
btn('begin');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.lord, 'rift');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
// 소환 비용: 25G에서 시작해 소환할 때마다 1G씩 올라 60G에서 멈춘다. 맵에는 24마리까지
assert.strictEqual(SUMMON_RULES.cost, 25);
assert.strictEqual(SUMMON_RULES.costStep, 1);
assert.strictEqual(SUMMON_RULES.maxCost, 60);
assert.strictEqual(SUMMON_RULES.maxField, 24);
assert.strictEqual(Game.summonCost(), 25);
assert(BUILD_CELLS.size > SUMMON_RULES.maxField, 'enough build cells for the cap');

// 몬스터 탭: 소환 버튼만 있다. 대기 칸과 예전 몬스터 슬롯, 스킬 슬롯은 없다
assert.strictEqual(UI.tab, 'monster');
assert(hasBtn('summon'));
assert(!UI.buttons.some(b => b.id.startsWith('bench')), 'no bench slots');
assert(!('bench' in Game) && !Game.deploy && !Game.sellBench, 'bench removed');
assert(!hasBtn('place_orc_guard'));
assert(!hasBtn('lightning') && !hasBtn('roar'));

// 탭 전환: 클릭과 Tab 키
btn('tab_demon');
assert.strictEqual(UI.tab, 'demon');
assert(hasBtn('lightning') && hasBtn('roar') && !hasBtn('summon'));
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');

// 빈 길 옆 칸을 누르면 소환하라는 안내만 뜬다
UI.toast = null;
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 0);
assert(UI.toast && UI.toast.text.includes('소환'), 'empty cell hint');

// 몬스터 표와 확률 데이터: 7종, 일반 70% 희귀 25% 영웅 5%. 전설(죽음의 군주)은 조합식으로만 나와 소환 후보가 비어 있다
assert.strictEqual(Object.keys(MONSTERS).join(), 'orc_guard,skeleton_archer,dark_mage,orc_berserker,curse_shooter,bone_knight,death_lord');
assert.strictEqual(SUMMON_RULES.odds.common, 0.70);
assert.strictEqual(SUMMON_RULES.odds.rare, 0.25);
assert.strictEqual(SUMMON_RULES.odds.epic, 0.05);
assert(!SUMMON_RULES.odds.legendary && gradePool('legendary').length === 0, 'legendary not summoned');
assert(MONSTERS.death_lord.summon === false && MONSTERS.death_lord.grade === 'legendary');
assert.strictEqual(nextGrade('epic'), null, 'epic stays top grade for grade merge');
for (let i = 0; i < 200; i++) assert.notStrictEqual(Game.rollSummon(), 'death_lord', 'death lord never summoned');
assert.strictEqual(gradePool('common').join(), 'orc_guard,skeleton_archer,dark_mage');
assert.strictEqual(gradePool('rare').join(), 'orc_berserker,curse_shooter');
assert.strictEqual(gradePool('epic').join(), 'bone_knight');
assert.strictEqual(MONSTERS.orc_berserker.role, 'melee');
assert.strictEqual(MONSTERS.bone_knight.stats.block, 5);
assert.strictEqual(MONSTERS.curse_shooter.stats.range, 4);
// 소환 확률: 첫 난수로 등급, 둘째 난수로 그 등급 안의 몬스터를 고른다
assert.strictEqual(withRandom([0, 0], () => Game.rollSummon()), 'orc_guard');
assert.strictEqual(withRandom([0.69, 0.99], () => Game.rollSummon()), 'dark_mage');
assert.strictEqual(withRandom([0.70, 0.1], () => Game.rollSummon()), 'orc_berserker');
assert.strictEqual(withRandom([0.94, 0.9], () => Game.rollSummon()), 'curse_shooter');
assert.strictEqual(withRandom([0.95, 0.5], () => Game.rollSummon()), 'bone_knight');
assert.strictEqual(withRandom([0.999, 0], () => Game.rollSummon()), 'bone_knight');

// 칸에서 길까지 거리(px)
const pathGap = (c, r) => nearestPathPoint(tileX(c), tileY(r)).gap; // 두 갈래 중 가까운 길까지

// 소환: 버튼을 누르면 25골드를 내고 맵의 빈 길 옆 칸에 바로 나온다. 길에 가장 가까운 칸(바로 옆)을 고른다
withRandom([0.1, 0.1], () => btn('summon'));
assert.strictEqual(Game.monsters.length, 1, 'summoned onto the map');
const s1 = Game.monsters[0];
assert.strictEqual(s1.type, 'orc_guard');
assert(isBuildCell(s1.col, s1.row) && Game.monsterAt(s1.col, s1.row) === s1, 'on a build cell');
assert(Math.abs(pathGap(s1.col, s1.row) - TILE) < 1, 'nearest cell to the path');
assert(s1.blocks && s1.rally, 'summoned blocker walks out');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 25);
assert.strictEqual(Game.stats.summoned, 1);
assert.strictEqual(Game.summonCost(), 26, 'cost +1');
assert(Fx.pops.some(p => p.kind === 'summon' && p.to.x === s1.x && p.to.y === s1.y && p.grade === 'common'), 'summon effect on the cell');
// S 키도 같다. 비용은 26, 27로 오른다
withRandom([0.5, 0.5], () => UI.onKey('KeyS'));
withRandom([0.1, 0.9], () => UI.onKey('KeyS'));
assert.strictEqual(Game.monsters.map(m => m.type).join(), 'orc_guard,skeleton_archer,dark_mage');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 25 - 26 - 27);
assert.strictEqual(Game.summonCost(), 28);
// 같은 거리의 칸에서는 무작위로 고른다: 칸을 고르는 난수가 다르면 다른 칸
{
    const a = withRandom(0, () => Game.pickSummonCell('skeleton_archer'));
    const b = withRandom(0.99, () => Game.pickSummonCell('skeleton_archer'));
    assert(a && b && (a.col !== b.col || a.row !== b.row), 'random among equally near cells');
}
// 소환 버튼과 하단 표시: 현재 비용과 맵 몬스터 수(현재 수/상한)
UI.update(0);
assert(!UI.buttons.find(b => b.id === 'summon').disabled);
// 골드가 모자라면 소환하지 않고 안내한다
Game.gold = 27;
UI.toast = null;
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').disabled, 'summon dimmed without gold');
UI.onKey('KeyS');
assert.strictEqual(Game.monsters.length, 3);
assert.strictEqual(Game.gold, 27);
assert(UI.toast && UI.toast.text.includes('28골드'), 'gold toast shows current cost');
// 희귀·영웅 소환 연출은 등급을 따른다
Game.gold = 1000;
withRandom([0.97, 0], () => UI.onKey('KeyS'));
const k1 = Game.monsters[3];
assert.strictEqual(k1.type, 'bone_knight');
assert(Fx.pops.some(p => p.kind === 'summon' && p.grade === 'epic' && p.to.x === k1.x), 'epic summon effect on the cell');
assert.strictEqual(Game.summonCost(), 29);

// 비용은 60G에서 멈춘다
Game.summonCount = 34;
assert.strictEqual(Game.summonCost(), 59);
Game.summonCount = 35;
assert.strictEqual(Game.summonCost(), 60);
Game.summonCount = 200;
assert.strictEqual(Game.summonCost(), 60, 'cost capped');

// 원거리 몬스터는 사거리 안에 길이 들어오는 칸에만 나온다.
// 남쪽 길이 생겨 모든 건설 칸이 어느 길에서든 2.5칸 안이라, 이 시험 동안만 암흑 마법사 사거리를 1.5칸으로 줄인다
assert(![...BUILD_CELLS].some(k => { const [c, r] = k.split(',').map(Number); return pathGap(c, r) > 2.5 * TILE; }), 'every build cell within 2.5 tiles of a path');
const mageRange = MONSTERS.dark_mage.stats.range;
MONSTERS.dark_mage.stats.range = 1.5;
const farCells = [...BUILD_CELLS].map(k => k.split(',').map(Number)).filter(([c, r]) => pathGap(c, r) > MONSTERS.dark_mage.stats.range * TILE);
assert(farCells.length > 0, 'test needs a cell out of dark mage range');
Game.monsters = [];
SUMMON_RULES.maxField = 999; // 빈 칸이 없는 경우를 상한과 따로 시험한다
for (const key of BUILD_CELLS) {
    const [c, r] = key.split(',').map(Number);
    if (!farCells.some(([fc, fr]) => fc === c && fr === r)) Game.place('skeleton_archer', c, r);
}
let g0 = Game.gold;
UI.toast = null;
withRandom([0.69, 0.99], () => UI.onKey('KeyS')); // 암흑 마법사: 남은 칸은 모두 사거리 밖
assert.strictEqual(Game.gold, g0, 'no cell in range: no gold spent');
assert(UI.toast && UI.toast.text.includes('합쳐서'), 'no cell toast');
assert(!Game.monsters.some(m => m.type === 'dark_mage'), 'dark mage not placed out of range');
MONSTERS.dark_mage.stats.range = mageRange;
withRandom([0.1, 0.1], () => UI.onKey('KeyS')); // 오크 경비병(막는 몬스터)은 사거리 조건 없이 남은 칸에 나온다
const farOrc = Game.monsters.find(m => m.type === 'orc_guard');
assert(farOrc && farCells.some(([c, r]) => c === farOrc.col && r === farOrc.row), 'blocker uses the far cell');
// 막는 몬스터 지점이 모두 겹쳐도 빈 칸이 있으면 그 칸을 쓴다. 빈 칸이 하나도 없으면 거부하고 골드를 쓰지 않는다
for (const [c, r] of farCells) Game.place('orc_guard', c, r);
Game.removeMonster(Game.monsterAt(3, 4));
withRandom([0, 0], () => UI.onKey('KeyS'));
assert.strictEqual(Game.monsterAt(3, 4).type, 'orc_guard', 'blocker falls back to any free cell');
g0 = Game.gold;
UI.toast = null;
withRandom([0, 0], () => UI.onKey('KeyS'));
assert.strictEqual(Game.gold, g0, 'no free cell: no gold spent');
assert(UI.toast && UI.toast.text.includes('합쳐서'));
SUMMON_RULES.maxField = 24;
// 원거리로 나온 몬스터는 모두 사거리 안에 길이 있다
Game.monsters = [];
Game.summonCount = 0;
Game.gold = 5000;
for (let i = 0; i < 20; i++) assert(Game.summon().ok);
for (const m of Game.monsters) {
    if (!m.blocks) assert(pathGap(m.col, m.row) <= MONSTERS[m.type].stats.range * TILE + 0.5, 'ranged in range ' + m.type);
}

// 막는 몬스터는 길 지점이 서로 1칸 안으로 겹치지 않게 퍼진다
Game.monsters = [];
for (let i = 0; i < 10; i++) assert(withRandom([0, 0, Math.random()], () => Game.summon()).ok);
{
    const orcs = Game.monsters.filter(m => m.type === 'orc_guard');
    assert.strictEqual(orcs.length, 10);
    for (let i = 0; i < orcs.length; i++) {
        for (let j = i + 1; j < orcs.length; j++) {
            const a = rallyPoint(orcs[i].col, orcs[i].row);
            const b = rallyPoint(orcs[j].col, orcs[j].row);
            assert(distance(a.x, a.y, b.x, b.y) > TILE * SUMMON_RULES.blockerSpacing, 'blocker rally points spread');
        }
    }
}

// 상한 24마리: 더 소환하면 거부하고 골드를 쓰지 않는다. 버튼은 "자리 없음"
Game.monsters = [];
Game.gold = 5000;
for (let i = 0; i < 30 && Game.monsters.length < 24; i++) Game.summon();
assert.strictEqual(Game.monsters.length, 24, 'filled to the cap');
assert.strictEqual(new Set(Game.monsters.map(m => m.col + ',' + m.row)).size, 24, 'one monster per cell');
assert(Game.monsters.every(m => isBuildCell(m.col, m.row)));
g0 = Game.gold;
UI.toast = null;
btn('summon');
assert.strictEqual(Game.monsters.length, 24, 'cap holds');
assert.strictEqual(Game.gold, g0, 'no gold spent at cap');
assert(UI.toast && UI.toast.text.includes('합쳐서 자리를 만드세요'), 'cap toast');
assert.strictEqual(Game.summon().reason, 'full');
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').full, 'summon button shows full');
// 합쳐서 자리가 나면 다시 소환할 수 있다
{
    let pair = null;
    for (const a of Game.monsters) for (const b of Game.monsters) {
        const plan = mergePlan(a.type, b.type);
        // 히든 조합식은 아래에서 처음 발견을 시험하므로 피한다
        if (!pair && a !== b && plan.kind !== 'none' && !(plan.recipe && plan.recipe.hidden)) pair = [a, b];
    }
    assert(pair, 'some pair can merge among 24');
    assert(Game.merge({ monster: pair[0] }, { monster: pair[1] }).ok);
}
assert.strictEqual(Game.monsters.length, 23, 'merge frees a spot');
g0 = Game.gold;
const costNow = Game.summonCost();
assert(Game.summon().ok, 'summon again after merge');
assert.strictEqual(Game.monsters.length, 24);
assert.strictEqual(Game.gold, g0 - costNow);
tick(1);

// 아래는 끌기·합치기 시험. 맵을 비우고 정한 칸에 몬스터를 놓는다
Game.monsters = [];
Fx.pops = [];
Game.gold = 1000;
Game.place('skeleton_archer', 3, 4);
Game.place('dark_mage', 7, 4);
Game.place('orc_guard', 9, 4);

// 맵의 몬스터를 누르면(끌지 않고 떼면) 정보 팝업: 공개 조합식과 판매가 나오고 강화 버튼은 없다
const mage0 = Game.monsterAt(7, 4);
click(...monXY(mage0));
assert.strictEqual(UI.selectedMonster, mage0);
UI.update(0);
assert(UI.popup && UI.popup.type === 'dark_mage');
assert.strictEqual(UI.popup.recipes.map(r => r.partner + '>' + r.result).join(), 'skeleton_archer>curse_shooter,orc_guard>orc_berserker');
assert(hasBtn('sell') && !hasBtn('up2') && !hasBtn('up3A'), 'sell only, upgrade hidden');
assert.strictEqual(MONSTER_UPGRADE_ENABLED, false);
// 고른 몬스터와 합칠 수 있는 대상: 조합식이면 결과, 같은 등급이면 다음 등급
assert.strictEqual(UI.shownPlan({ type: 'dark_mage' }, { type: 'skeleton_archer' }).result, 'curse_shooter');
assert.strictEqual(UI.shownPlan({ type: 'dark_mage' }, { type: 'dark_mage' }).grade, 'rare');
// 히든 조합식은 미리 보이지 않는다: 공개 목록에 없고, 화면에는 합칠 수 없는 쌍으로 보인다
assert(!publicRecipesFor('orc_berserker').some(r => r.partner === 'skeleton_archer'), 'hidden recipe not listed');
assert.notStrictEqual(UI.shownPlan({ type: 'orc_berserker' }, { type: 'skeleton_archer' }).kind, 'recipe');
assert.strictEqual(mergePlan('orc_berserker', 'skeleton_archer').kind, 'recipe');
// 서로 다른 일반 몬스터 중 조합식이 없는 쌍은 등급 합치기다
assert.strictEqual(mergePlan('orc_guard', 'skeleton_archer').kind, 'grade');
click(...monXY(mage0)); // 같은 몬스터를 다시 누르면 닫는다
assert.strictEqual(UI.selectedMonster, null);

// 끌기를 시작하면 놓을 칸 미리보기가 나온다. 길 칸은 빨간색, 길 옆 칸은 놓을 수 있다
const archer1 = Game.monsterAt(3, 4);
UI.onMove(...monXY(archer1));
UI.onDown(...monXY(archer1));
assert(!UI.drag, 'press alone is not a drag');
UI.onMove(monXY(archer1)[0] + 4, monXY(archer1)[1] - 4);
assert(!UI.drag, 'tiny move is not a drag');
UI.onMove(...cellXY(2, 3));
assert(UI.drag && UI.drag.type === 'skeleton_archer', 'dragging');
assert(UI.hoverCell && UI.hoverCell.col === 2 && UI.hoverCell.row === 3);
assert(!UI.canPlaceAt(2, 3), 'path cell is red');
UI.onMove(...cellXY(5, 4));
assert(UI.canPlaceAt(5, 4), 'build cell ok');
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'place');
// Esc로 끌기를 그만두면 제자리에 그대로 남는다
UI.onKey('Escape');
assert(!UI.drag);
UI.onUp(...cellXY(5, 4));
assert.strictEqual(Game.monsterAt(3, 4), archer1);
assert.strictEqual(Game.monsterAt(5, 4), null);

// 놓을 수 없는 곳에 놓으면 안내하고 제자리로 돌아간다: 길 칸, 건설 칸이 아닌 곳, 하단 바
UI.toast = null;
dragTo(monXY(archer1), cellXY(2, 3));
assert.strictEqual(Game.monsterAt(3, 4), archer1, 'not on path');
assert(UI.toast && UI.toast.text.includes('길'), 'path toast');
assert(UI.returning.length > 0, 'fly back effect');
UI.toast = null;
dragTo(monXY(archer1), cellXY(12, 12));
assert(!isBuildCell(12, 12) && Game.monsterAt(3, 4) === archer1);
assert(UI.toast && UI.toast.text.includes('길 옆'), 'not build cell toast');
dragTo(monXY(archer1), [BAR_SLOT_X + 20, GAME_HEIGHT - 40]);
assert.strictEqual(Game.monsterAt(3, 4), archer1, 'dropped on bar');
// 이미 몬스터가 있는 칸 위에 놓으면 합치기로 본다(일반끼리라 등급 합치기 미리보기)
const orc9 = Game.monsterAt(9, 4);
UI.onMove(...monXY(orc9));
UI.onDown(...monXY(orc9));
UI.onMove(...monXY(archer1));
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'merge');
UI.cancel();
UI.onUp(...monXY(archer1));
assert(Game.monsterAt(9, 4) === orc9 && Game.monsterAt(3, 4) === archer1);

// 끌어 옮기기: 맵의 몬스터를 다른 빈 길 옆 칸으로. 원래 칸은 빈다(비용 없음)
const goldBeforeMove = Game.gold;
dragTo(monXY(archer1), cellXY(5, 4));
assert.strictEqual(Game.monsterAt(5, 4), archer1, 'moved');
assert.strictEqual(Game.monsterAt(3, 4), null, 'old cell freed');
assert(archer1.x === tileX(5) && archer1.homeY === tileY(4));
assert.strictEqual(Game.gold, goldBeforeMove, 'move is free');
// 길로는 옮길 수 없고 제자리에 남는다
UI.toast = null;
dragTo(monXY(archer1), cellXY(6, 7));
assert.strictEqual(Game.monsterAt(5, 4), archer1, 'stays');
assert(UI.toast && UI.toast.text.includes('길'));
// 맵의 몬스터를 누르면 정보 팝업
click(...monXY(archer1));
assert.strictEqual(UI.selectedMonster, archer1);
UI.update(0);
assert(UI.popup && UI.popup.monster === archer1 && hasBtn('sell') && !hasBtn('up2'));
UI.clearSelection();

// 조합식: 암흑 마법사를 스켈레톤 궁수 위에 → 저주 사수가 궁수 자리에 남고 마법사 자리는 빈다
Fx.pops = [];
const mergedBefore = Game.stats.merged;
dragTo(monXY(mage0), monXY(archer1));
const shooter = Game.monsterAt(5, 4);
assert(shooter && shooter.type === 'curse_shooter', 'recipe result at target');
assert(archer1.removed && !Game.monsters.includes(archer1));
assert(mage0.removed && Game.monsterAt(7, 4) === null, 'source freed');
assert(shooter.reveal > 0, 'result appears after suck-in');
assert(Fx.pops.some(p => p.kind === 'merge' && p.type === 'curse_shooter' && p.grade === 'rare' && !p.hidden));
assert.strictEqual(Fx.discovery, null, 'public recipe: no discovery');
assert.strictEqual(Game.stats.merged, mergedBefore + 1);
tick(0.5);
assert(!(shooter.reveal > 0), 'revealed');
// 순서는 상관없다: 궁수를 마법사 위에 놓아도 같은 결과(마법사 자리에 남는다)
Game.place('dark_mage', 7, 4);
Game.place('skeleton_archer', 3, 4);
dragTo(monXY(Game.monsterAt(3, 4)), monXY(Game.monsterAt(7, 4)));
assert.strictEqual(Game.monsterAt(7, 4).type, 'curse_shooter', 'reverse order recipe');
assert.strictEqual(Game.monsterAt(3, 4), null, 'source freed');
const shooter2 = Game.monsterAt(7, 4);

// 히든 조합식: 오크 광전사 + 스켈레톤 궁수 → 해골 기사. 처음이면 "히든 조합 발견!"
Game.place('orc_berserker', 3, 2);
Game.place('skeleton_archer', 5, 3);
tick(0.1);
dragTo(monXY(Game.monsterAt(3, 2)), monXY(Game.monsterAt(5, 3)));
assert.strictEqual(Game.monsterAt(5, 3).type, 'bone_knight', 'hidden recipe result');
assert.strictEqual(Game.monsterAt(3, 2), null);
assert(Fx.discovery && Fx.discovery.type === 'bone_knight', 'hidden discovered');
assert(Meta.data.recipes.includes('orc_berserker+skeleton_archer') && Meta.hasSeen('bone_knight'), 'hidden recipe and result kept in the meta record');
assert(Fx.pops.some(p => p.kind === 'merge' && p.hidden && p.grade === 'epic'));
tick(4.2);
assert.strictEqual(Fx.discovery, null);
// 두 번째부터는 발견 연출이 없다
Game.place('skeleton_archer', 3, 2);
Game.place('orc_berserker', 7, 6);
tick(0.1);
dragTo(monXY(Game.monsterAt(7, 6)), monXY(Game.monsterAt(3, 2)));
assert.strictEqual(Game.monsterAt(3, 2).type, 'bone_knight');
assert.strictEqual(Fx.discovery, null, 'discovered only once');
assert.strictEqual(Meta.data.recipes.filter(k => k === 'orc_berserker+skeleton_archer').length, 1, 'recorded once');
tick(0.5);

// 영웅끼리는 합칠 수 없다: 안내하고 둘 다 그대로
const kA = Game.monsterAt(3, 2), kB = Game.monsterAt(5, 3);
UI.toast = null;
dragTo(monXY(kA), [kB.homeX * WORLD_ZOOM, (kB.homeY - 10) * WORLD_ZOOM]);
assert(Game.monsterAt(3, 2) === kA && Game.monsterAt(5, 3) === kB, 'epic + epic refused');
assert(UI.toast && UI.toast.text.includes('최고 등급'));
assert.strictEqual(mergePlan('bone_knight', 'bone_knight').reason, 'top');

// 합칠 수 없는 경우: 등급이 다르고 조합식도 없다
UI.toast = null;
Game.place('skeleton_archer', 7, 6);
dragTo(monXY(Game.monsterAt(7, 6)), [kB.homeX * WORLD_ZOOM, (kB.homeY - 10) * WORLD_ZOOM]);
assert(Game.monsterAt(7, 6).type === 'skeleton_archer' && Game.monsterAt(5, 3) === kB, 'mismatch refused');
assert(UI.toast && UI.toast.text.includes('합칠 수 없'));
assert.strictEqual(mergePlan('skeleton_archer', 'curse_shooter').reason, 'mismatch');
Game.removeMonster(Game.monsterAt(7, 6));

// 등급 합치기: 같은 등급 2마리(조합식 없음) → 상위 등급 중 무작위
Game.place('orc_guard', 3, 6);
Game.place('orc_guard', 9, 6);
const orcGuard = Game.monsterAt(3, 6);
withRandom(0.1, () => dragTo(monXY(Game.monsterAt(9, 6)), monXY(orcGuard)));
const berserker = Game.monsterAt(3, 6);
assert(berserker && berserker.type === 'orc_berserker', 'grade merge picks rare[0] with random 0.1');
assert(berserker.blocks && berserker.rally, 'berserker walks out to block');
assert.strictEqual(monsterStats(berserker).block, 2);
// 무작위 값이 크면 같은 등급의 다른 몬스터
Game.place('dark_mage', 9, 6);
Game.place('dark_mage', 9, 2);
withRandom(0.9, () => dragTo(monXY(Game.monsterAt(9, 6)), monXY(Game.monsterAt(9, 2))));
assert.strictEqual(Game.monsterAt(9, 2).type, 'curse_shooter');
tick(0.5);
// 희귀 2마리 → 영웅(해골 기사뿐). 조합식(오크 광전사 + 저주 사수)도 같은 결과다
dragTo(monXY(shooter), [berserker.homeX * WORLD_ZOOM, (berserker.homeY - 10) * WORLD_ZOOM]);
const knight = Game.monsterAt(3, 6);
assert(knight && knight.type === 'bone_knight', 'field + field recipe');
assert.strictEqual(Game.monsterAt(5, 4), null);
assert.strictEqual(monsterStats(knight).hp, 500);
// 희귀 2마리, 조합식 없음 → 영웅 등급 합치기
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').kind, 'grade');
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').grade, 'epic');
tick(0.5);

// 랭크 조건 조합식(히든, 전설): 해골 기사 A 이상 + 저주 사수 A 이상 → 죽음의 군주
{
    const freeCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
    const put = (type, rank) => {
        const [c, r] = freeCell();
        const m = Game.place(type, c, r);
        setMonsterRank(m, rankIndex(rank));
        return m;
    };
    const kA = { type: 'bone_knight', rank: rankIndex('A') }, kB = { type: 'bone_knight', rank: rankIndex('B') }, kS = { type: 'bone_knight', rank: rankIndex('S') };
    const sA = { type: 'curse_shooter', rank: rankIndex('A') }, sB = { type: 'curse_shooter', rank: rankIndex('B') };
    // 충족: 재료 순서를 바꿔도 같다. 더 높은 랭크도 된다
    assert.strictEqual(mergePlan(kA, sA).result, 'death_lord', 'rank condition met');
    assert.strictEqual(mergePlan(sA, kA).result, 'death_lord', 'reverse order');
    assert.strictEqual(mergePlan(kS, sA).result, 'death_lord', 'higher rank ok');
    // 미달: 조합식이 없는 것처럼 평소 규칙(영웅 + 희귀는 등급이 달라 합칠 수 없다). 랭크 없는 문자열은 D로 본다
    assert.strictEqual(mergePlan(kB, sA).reason, 'mismatch', 'a side below rank');
    assert.strictEqual(mergePlan(kS, sB).reason, 'mismatch', 'b side below rank');
    assert.strictEqual(mergePlan(sB, kS).reason, 'mismatch', 'reverse order below rank');
    assert.strictEqual(mergePlan('bone_knight', 'curse_shooter').reason, 'mismatch');
    // 조건 없는 조합식은 랭크와 관계없이 그대로
    assert.strictEqual(mergePlan({ type: 'skeleton_archer', rank: 4 }, { type: 'dark_mage', rank: 0 }).result, 'curse_shooter');
    assert.strictEqual(mergePlan({ type: 'orc_berserker', rank: 2 }, 'skeleton_archer').result, 'bone_knight');
    assert.strictEqual(mergePlan('orc_berserker', 'curse_shooter').result, 'bone_knight');
    // 히든은 미리 보여 주지 않는다: 공개 목록에 없고 화면에는 '???'(등급이 달라 등급 합치기도 아님)
    assert(!publicRecipesFor('bone_knight').some(r => r.result === 'death_lord') && !publicRecipesFor('curse_shooter').some(r => r.result === 'death_lord'));
    assert.strictEqual(UI.shownPlan(kA, sA).kind, 'unknown', 'hidden legend not shown');
    assert.strictEqual(UI.shownPlan(kB, sA).kind, 'none', 'below rank: cannot merge');

    // 끌어 합치기(맵): 저주 사수 A를 해골 기사 S 위에 → 죽음의 군주가 기사 자리에, 랭크는 낮은 쪽 A
    Fx.pops = [];
    const knight = put('bone_knight', 'S');
    const shooter = put('curse_shooter', 'A');
    // 끌기 미리보기도 같은 판단을 쓴다(합칠 수 있지만 히든이라 '???')
    UI.onMove(...monXY(shooter));
    UI.onDown(...monXY(shooter));
    UI.onMove(...monXY(knight));
    const act = UI.dropAction(UI.dropTarget);
    assert(act.action === 'merge' && act.plan.kind === 'unknown', 'drag preview hides legend');
    UI.cancel();
    UI.onUp(...monXY(knight));
    dragTo(monXY(shooter), monXY(knight));
    const lord = Game.monsterAt(knight.col, knight.row);
    assert(lord && lord.type === 'death_lord', 'legend merged');
    assert(shooter.removed && Game.monsterAt(shooter.col, shooter.row) === null);
    assert.strictEqual(lord.rank, rankIndex('A'), 'result inherits lower rank');
    assert.strictEqual(monsterStats(lord).hp, 900 * MONSTER_RANKS[rankIndex('A')].mul);
    assert.strictEqual(monsterStats(lord).block, 8);
    assert(lord.blocks, 'tank walks out');
    assert.strictEqual(monsterAbility('death_lord', 'deathStun').radius, 3);
    assert.strictEqual(monsterAbility('death_lord', 'deathStun').duration, 2);
    // 처음 발견: 히든 연출, 재료 줄에 랭크 조건, 전설은 더 길게
    const d = Fx.discovery;
    assert(d && d.type === 'death_lord' && d.grade === 'legendary', 'legend discovered');
    assert(d.a === 'bone_knight' && d.aRank === 'A' && d.b === 'curse_shooter' && d.bRank === 'A', 'discovery shows ranks');
    assert(d.life > 3.6, 'legend discovery is longer');
    assert(Meta.data.recipes.includes('bone_knight:A+curse_shooter:A') && Meta.hasSeen('death_lord'), 'legend recipe kept in the meta record');
    assert(Fx.pops.some(p => p.kind === 'merge' && p.hidden && p.grade === 'legendary'));
    tick(5.5);
    assert.strictEqual(Fx.discovery, null);

    // 전설은 맵에 1마리: 또 만들려 하면 막고 안내한다. 재료는 그대로
    const k2 = put('bone_knight', 'A');
    const s2 = put('curse_shooter', 'A');
    assert.strictEqual(Game.mergePlanFor(s2, k2).reason, 'unique');
    assert.strictEqual(mergePlan(s2, k2).result, 'death_lord', 'pure plan still matches');
    UI.toast = null;
    dragTo(monXY(s2), monXY(k2));
    assert(Game.monsterAt(k2.col, k2.row) === k2 && Game.monsterAt(s2.col, s2.row) === s2, 'second legend refused');
    assert(UI.toast && UI.toast.text.includes('1마리'), 'unique toast');
    assert.strictEqual(Game.merge({ monster: k2 }, { monster: s2 }).reason, 'unique');
    assert.strictEqual(Game.monsters.filter(m => m.type === 'death_lord').length, 1);
    // 군주가 사라지면 다시 만들 수 있다. 두 번째부터는 발견 연출이 없다
    Game.removeMonster(lord);
    dragTo(monXY(k2), monXY(s2));
    assert.strictEqual(Game.monsterAt(s2.col, s2.row).type, 'death_lord');
    assert.strictEqual(Fx.discovery, null, 'legend discovered only once');
    tick(0.5);
    Game.removeMonster(Game.monsterAt(s2.col, s2.row));
}

// 판매: 등급별 고정 환불(일반 20, 희귀 60, 영웅 150)
assert.strictEqual(SUMMON_RULES.refund.common, 20);
g0 = Game.gold;
click(...monXY(shooter2)); // 저주 사수(희귀)
btn('sell');
assert.strictEqual(Game.gold, g0 + 60);
assert.strictEqual(Game.monsterAt(7, 4), null);
g0 = Game.gold;
click(...monXY(kA)); // 해골 기사(영웅)
btn('sell');
assert.strictEqual(Game.gold, g0 + 150);
g0 = Game.gold;
const orc9b = Game.monsterAt(9, 4);
click(...monXY(orc9b)); // 오크 경비병(일반)
assert.strictEqual(UI.selectedMonster, orc9b);
btn('sell');
assert.strictEqual(Game.gold, g0 + 20);
Game.monsters = [];
UI.clearSelection();
Game.gold = 2000;

// 모든 몬스터는 길 칸에 놓을 수 없다
assert(!Game.canPlace('orc_guard', 30, 30) && !Game.canPlace('skeleton_archer', 0, 0), 'off map rejected');
for (const key of PATH_CELLS) {
    const [c, r] = key.split(',').map(Number);
    for (const t of Object.keys(MONSTERS)) assert(!Game.canPlace(t, c, r), 'no monster on path ' + key);
}

// 근접 몬스터를 길 옆에 놓으면 가장 가까운 길 지점으로 걸어 나간다
assert(Game.place('orc_guard', 3, 4));
const orc = Game.monsterAt(3, 4);
assert(orc && orc.blocks && orc.rally, 'orc placed beside path');
assert.strictEqual(orc.x, tileX(3));
assert.strictEqual(orc.rally.d, nearestPathPoint(tileX(3), tileY(4)).d);
assert.strictEqual(orc.rally.route, 'north');
assert(distance(orc.rally.x, orc.rally.y + MONSTER_FOOT - 10, pathAt(orc.rally.d).x, pathAt(orc.rally.d).y) < 1, 'rally on path');
tick(0.1);
assert(orc.moving, 'orc walks');
tick(1.5);
assert(!orc.moving && distance(orc.x, orc.y, orc.rally.x, orc.rally.y) <= 6, 'orc reached rally');
assert.strictEqual(Game.monsterAt(3, 4), orc, 'home cell stays taken');
assert(!Game.canPlace('skeleton_archer', 3, 4));
// 원거리 몬스터는 놓은 칸에 그대로 선다
Game.place('skeleton_archer', 5, 4);
Game.place('skeleton_archer', 5, 5);
Game.place('dark_mage', 3, 6);
tick(1);
const archer = Game.monsterAt(5, 4);
assert(!archer.blocks && archer.x === tileX(5) && archer.y === tileY(4), 'ranged stays on its cell');

// 정보 창: 놓은 칸을 눌러도, 길로 나간 몬스터를 눌러도 뜬다
UI.clearSelection();
cellClick(3, 4);
assert.strictEqual(UI.selectedMonster, orc, 'click home cell');
UI.clearSelection();
worldClick(orc.x, orc.y - 10);
assert.strictEqual(UI.selectedMonster, orc, 'click walked-out monster');
UI.update(0);
assert(UI.popup && UI.popup.monster === orc);
UI.clearSelection();
// 길로 나간 막는 몬스터도 끌어 옮길 수 있다: 새 칸에서 다시 걸어 나간다
dragTo([orc.x * WORLD_ZOOM, (orc.y - 10) * WORLD_ZOOM], cellXY(3, 2));
assert.strictEqual(Game.monsterAt(3, 2), orc, 'walked-out orc moved');
assert(orc.x === tileX(3) && orc.y === tileY(2) && orc.rally.d === nearestPathPoint(tileX(3), tileY(2)).d);
dragTo(monXY(orc), cellXY(3, 4));
assert.strictEqual(Game.monsterAt(3, 4), orc);
tick(1.6);

// 쓰러지면 8초 뒤 놓은 칸에서 다시 나와 길로 걸어간다
damageUnit(orc, 9999);
assert(orc.down > 0 && orc.hp === 0);
assert.strictEqual(orc.down, MONSTERS.orc_guard.stats.respawn);
assert(orc.x === orc.homeX && orc.y === orc.homeY, 'down at home cell');
tick(7.5);
assert(orc.down > 0, 'still waiting');
tick(0.6);
assert.strictEqual(orc.down, 0);
assert.strictEqual(orc.hp, orc.maxHp);
tick(0.1);
assert(orc.moving && distance(orc.x, orc.y, orc.homeX, orc.homeY) < 40, 'revived at home, walking out');
tick(1.5);
assert(distance(orc.x, orc.y, orc.rally.x, orc.rally.y) <= 6, 'back on rally');

// 다음 웨이브 시작
UI.onKey('Space');
assert.strictEqual(Game.state, 'wave');
tick(14);
assert(Game.stats.kills > 0 || Game.heroes.length > 0);

// 번개: Q는 몬스터 탭에서도 동작하고 마왕 탭으로 바꾼다. 끄던 몬스터는 제자리에 남는다
UI.onMove(...monXY(archer));
UI.onDown(...monXY(archer));
UI.onMove(...cellXY(7, 5));
assert(UI.drag && UI.tab === 'monster');
UI.onKey('KeyQ');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(UI.drag, null);
UI.onUp(...cellXY(7, 5));
assert.strictEqual(Game.monsterAt(5, 4), archer);
assert.strictEqual(Game.monsterAt(7, 5), null);
assert.strictEqual(UI.targeting, true);
UI.onKey('KeyQ');
assert.strictEqual(UI.targeting, false);
btn('lightning');
assert.strictEqual(UI.targeting, true);
worldClick(tileX(4), tileY(5));
assert.strictEqual(UI.targeting, false);
assert.strictEqual(Game.skills.lightning, COMBAT_RULES.lightning.cooldown * DEMON_LORDS.rift.effects.skillCooldown);
tick(0.5);

// 호통은 체력이 충분하면 막히고, 낮으면 쓸 수 있다. W도 마왕 탭으로 바꾼다
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');
UI.onKey('KeyW');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(Game.skills.roar, 0);
Game.hp = 8;
UI.onKey('KeyW');
assert.strictEqual(Game.skills.roar, COMBAT_RULES.roar.cooldown * DEMON_LORDS.rift.effects.skillCooldown);
Game.hp = 20;

// 타락은 꺼져 있다: 시체를 눌러도 아무 일이 없고, 시체는 쓰러지는 동작 뒤 1초쯤 사라지며, 몬스터 끌기를 가로막지 않는다
assert.strictEqual(CORRUPTION_ENABLED, false);
{
    Game.corpses.length = 0;
    const h = createHero('warrior', 0, 0, false);
    h.waiting = false;
    Game.heroes.push(h);
    const goldBefore = Game.gold;
    damageHero(h, 9999);
    assert.strictEqual(Game.gold, goldBefore + h.bounty, 'bounty unchanged');
    const c = Game.corpses[0];
    assert(c && Math.abs(c.life - (HEROES.warrior.anim.death.frames / CORPSE_FALL_FPS + CORPSE_FADE_TIME)) < 1e-9, 'corpse fades after fall');
    const gold = Game.gold, units = Game.units.length;
    worldClick(c.x, c.y - 20);
    assert.strictEqual(Game.gold, gold, 'corpse click ignored');
    assert.strictEqual(Game.units.length, units);
    assert.strictEqual(UI.corpseAt(c.x, c.y - 20), null);
    assert.strictEqual(corruptCorpse(c).reason, 'disabled');
    UI.clearSelection();
    // 시체를 몬스터 바로 위에 두어도 몬스터를 끌 수 있다
    const m = Game.monsters[0];
    assert(m, 'a monster to drag');
    const c2 = { ...c, x: m.x, y: m.y + 10, age: 0 };
    Game.corpses.push(c2);
    UI.update(0);
    UI.onMove(...monXY(m));
    UI.onDown(...monXY(m));
    assert(UI.press && UI.press.src.monster === m, 'corpse does not block monster press');
    UI.onMove(monXY(m)[0] + 200, monXY(m)[1]);
    assert(UI.drag, 'drag starts over corpse');
    UI.cancelDrag();
    UI.press = null;
    UI.update(0);
    tick(c.life + 0.2);
    assert(!Game.corpses.includes(c) && !Game.corpses.includes(c2), 'corpses fade out'); // 전투 중이라 새 시체는 생길 수 있다
}

// 타락: 비용 차감, 부하 생성, 최대 인원 제한. 꺼 둔 기능도 계속 검증하도록 잠시 켠다
CORRUPTION_ENABLED = true;
Game.corpses.length = 0; // 전투로 생긴 시체가 클릭 위치에 겹치면 그쪽이 먼저 선택된다
Game.corpses.push({ type: 'warrior', female: false, x: tileX(4), y: tileY(5), d: 800, dir: 'down', age: 0, life: 5, cost: 15 });
const goldBefore = Game.gold;
worldClick(tileX(4), tileY(5) - 30);
assert.strictEqual(Game.gold, goldBefore - 15);
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 1);
for (let i = 0; i < 2; i++) corruptCorpse({ type: 'rogue', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 18 });
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 3);
assert.strictEqual(corruptCorpse({ type: 'mage', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 24 }).reason, 'limit');
CORRUPTION_ENABLED = false;

// 정예: 같은 직업 기준 배율, 왕좌 피해 3, 시체와 타락
const ew = HEROES.elite_swordsman, et = HEROES.elite_tamer, es = HEROES.elite_stormcaller;
assert.strictEqual(ew.hp, HEROES.warrior.hp * 4);
assert.strictEqual(ew.armor, 4);
assert.strictEqual(et.speed, 1.3);
assert.strictEqual(es.stunEvery, 4);
assert.strictEqual(es.stunRange, 4);
assert.strictEqual(es.bounty, HEROES.mage.bounty * 3);
assert(!ew.anim && ew.sprite === 'swordsman', 'elite uses Asteria art');
assert.strictEqual(CORRUPTED.elite_tamer.hp, CORRUPTED.rogue.hp * 2);
assert.strictEqual(CORRUPTED.elite_tamer.damage, CORRUPTED.rogue.damage * 2);
assert(!WAVES[0].elites && !WAVES[1].elites && WAVES.slice(2).every(w => {
    const n = Object.values(w.elites || {}).reduce((a, b) => a + b, 0);
    return n >= 1 && n <= 3;
}), 'elites from wave 3, 1~3 each');
{
    const hpBefore = Game.hp;
    const e = createHero('elite_swordsman', 3, 0, false);
    e.waiting = false;
    e.d = PATH.length - 57;
    Game.heroes.push(e);
    updateHero(e, 0.1);
    assert(e.arrived, 'elite reached throne');
    assert.strictEqual(Game.hp, hpBefore - 3);
    Game.hp = 20;
    const k = createHero('elite_stormcaller', 4, 0, false);
    k.waiting = false;
    Game.heroes.push(k);
    CORRUPTION_ENABLED = true;
    const corpsesBefore = Game.corpses.length;
    damageHero(k, 9999);
    const corpse = Game.corpses[Game.corpses.length - 1];
    assert.strictEqual(Game.corpses.length, corpsesBefore + 1);
    assert.strictEqual(corpse.type, 'elite_stormcaller');
    Game.units = Game.units.filter(u => u.kind !== 'corrupt');
    Game.gold += corpse.cost;
    assert(corruptCorpse(corpse).ok);
    const cu = Game.units.find(u => u.heroType === 'elite_stormcaller');
    assert.strictEqual(cu.maxHp, CORRUPTED.mage.hp * 2);
    assert(cu.ranged);
    CORRUPTION_ENABLED = false;
}

// 정예 직업 능력. 아래 블록은 Game 목록을 직접 바꾸고, 다음 '다시 시작'에서 모두 초기화된다.
const er = HEROES.elite_rhapsodist;
assert(!er.anim && er.sprite === 'rhapsodist' && er.song && !er.stunEvery, 'rhapsodist: Asteria art, song, no stun');
assert(WAVES.some(w => w.elites && w.elites.elite_rhapsodist), 'rhapsodist appears in some wave');
// 용사 하나를 길 위 거리 d, 길 한가운데(lane 0)에 세운다
const place = (type, d, bossKey) => {
    const h = createHero(type, 0, 0, bossKey);
    Object.assign(h, { waiting: false, d, lane: 0, cast: 99, song: 99 });
    Game.heroes.push(h);
    return h;
};
const fakeOrc = (x, y) => {
    const u = createMonster('orc_guard', 1, 1);
    Object.assign(u, { x, y, homeX: x, homeY: y, rally: { route: nearestPathPoint(x, y).route, d: nearestPathPoint(x, y).d, x, y }, hp: 9999, maxHp: 9999 });
    Game.monsters.push(u);
    return u;
};
const fakeFacility = (x, y) => { const f = { x, y, stun: 0 }; Game.monsters.push(f); return f; };
const clearBoard = () => { Game.heroes = []; Game.units = []; Game.monsters = []; Game.telegraphs = []; };
{
    // 음유시인: 반경 3 안 용사(자신 포함) 가속 25%, 3초 뒤 풀린다. 반경 밖은 받지 않는다
    clearBoard();
    const bard = place('elite_rhapsodist', 300);
    const near = place('warrior', 300 + 2 * TILE);
    const far = place('warrior', 300 + 9 * TILE);
    const gap = (a, b) => distance(heroWorld(a).x, heroWorld(a).y, heroWorld(b).x, heroWorld(b).y) / TILE;
    assert(gap(bard, near) < er.song.radius && gap(bard, far) > er.song.radius + 0.5, 'test layout');
    bard.song = 0.01;
    updateHero(bard, 0.02);
    assert.strictEqual(near.haste, er.song.duration, 'near hero buffed');
    assert.strictEqual(near.hasteMul, er.song.speedMul);
    assert(bard.haste > 0, 'bard buffs itself');
    assert.strictEqual(far.haste, 0, 'far hero not buffed');
    let d0 = near.d;
    updateHero(near, 0.1);
    assert(Math.abs((near.d - d0) - near.speed * 1.25 * 0.1) < 1e-6, 'buffed speed x1.25');
    for (let i = 0; i < 31; i++) updateHero(near, 0.1);
    assert.strictEqual(near.haste, 0, 'buff expired');
    d0 = near.d;
    updateHero(near, 0.1);
    assert(Math.abs((near.d - d0) - near.speed * 0.1) < 1e-6, 'speed back to normal');
    // 혼자면 노래를 아낀다
    clearBoard();
    const alone = place('elite_rhapsodist', 300);
    alone.song = 0.01;
    updateHero(alone, 0.02);
    assert.strictEqual(alone.haste, 0, 'lonely bard waits');
}
{
    // 뇌술사: 경고 원 0.5초 → 사거리 4 안 몬스터 전부 1.5초 정지. 경고 동안 걷지 않는다
    clearBoard();
    const es = HEROES.elite_stormcaller;
    const k = place('elite_stormcaller', 600);
    const w = heroWorld(k);
    const f1 = fakeFacility(w.x + 2 * TILE, w.y);
    const f2 = fakeFacility(w.x, w.y + 3.5 * TILE);
    const fOut = fakeFacility(w.x + 4.5 * TILE, w.y);
    const orc = fakeOrc(w.x - TILE, w.y + TILE);
    assert.strictEqual(stunTargets(w.x, w.y, es.stunRange * TILE).length, 3, 'stunTargets: facilities and monsters in range');
    k.cast = 0.01;
    updateHero(k, 0.02);
    assert(k.windup > 0 && Game.telegraphs.length === 1, 'shock warning circle');
    assert.strictEqual(Game.telegraphs[0].radius, es.stunRange * TILE);
    assert(Game.telegraphs[0].color, 'shock warning is blue');
    assert(f1.stun === 0 && orc.stun === 0, 'not stunned during warning');
    const dWarn = k.d;
    for (let i = 0; i < 4; i++) updateHero(k, 0.1);
    assert.strictEqual(k.d, dWarn, 'caster stands still while warning');
    for (let i = 0; i < 2; i++) updateHero(k, 0.1);
    assert(f1.stun > 1 && f2.stun > 1 && orc.stun > 1, 'all in range stunned');
    assert(f1.stun <= es.stunTime && orc.stun <= es.stunTime);
    assert.strictEqual(fOut.stun, 0, 'out of range not stunned');
    // 정지한 몬스터는 때리지 않는다
    const atkBefore = orc.atk;
    updateMonster(orc, 0.1);
    assert.strictEqual(orc.atk, atkBefore, 'stunned orc idle');
    // 일반 마법사는 그대로 한 대상만 정지시킨다(대상 목록은 같은 함수에서 얻는다)
    clearBoard();
    const m = place('mage', 600);
    const mw = heroWorld(m);
    const a = fakeFacility(mw.x + TILE, mw.y);
    const b2 = fakeOrc(mw.x - 2 * TILE, mw.y);
    m.cast = 0.01;
    updateHero(m, 0.02);
    assert(a.stun > 0 && !(b2.stun > 0), 'mage stuns only the nearest');
}
{
    // 검사: 막힌 뒤 2초가 지나면 막은 유닛을 밀치고 지나간다
    clearBoard();
    const br = HEROES.elite_swordsman.breakthrough;
    const s = place('elite_swordsman', 600);
    const w = heroWorld(s);
    const orc = fakeOrc(w.x + 20, w.y + 30);
    s.blocker = orc;
    orc.target = s;
    updateHero(s, br.after - 0.1);
    assert.strictEqual(s.blocker, orc, 'still blocked before 2s');
    const ox = orc.x, oy = orc.y;
    updateHero(s, 0.2);
    assert.strictEqual(s.blocker, null, 'broke through');
    assert(distance(ox, oy, orc.x, orc.y) > br.push * TILE * 0.99, 'orc pushed aside');
    assert(orc.stun > 0 && s.slip > 0, 'orc stunned, swordsman slips');
    assert(!canBlockHero(orc, s), 'cannot re-block while slipping');
    const d0 = s.d;
    updateHero(s, 0.5);
    assert(s.d > d0, 'swordsman walks on');
    // 일반 전사는 돌파하지 않는다
    const wr = place('warrior', 600);
    wr.blocker = orc;
    updateHero(wr, 5);
    assert.strictEqual(wr.blocker, orc, 'warrior stays blocked');
}
{
    // 조련사: 오크에게 막히지 않고 지나간다. 타락 유닛에게는 막힌다
    clearBoard();
    const p = pathAt(900);
    const orc = fakeOrc(p.x, p.y);
    const tamer = place('elite_tamer', 900 - 2 * TILE);
    const rogue = place('rogue', 900 - 2 * TILE);
    assert(!canBlockHero(orc, tamer) && canBlockHero(orc, rogue));
    assert(canBlockHero({ kind: 'corrupt' }, tamer), 'corrupt units still block tamer');
    let tamerBlocked = false;
    for (let i = 0; i < 90; i++) {
        updateMonster(orc, 1 / 30);
        updateHero(tamer, 1 / 30);
        updateHero(rogue, 1 / 30);
        if (tamer.blocker) tamerBlocked = true;
    }
    assert(!tamerBlocked && tamer.d > 900 + TILE, 'tamer walked past orc');
    assert.strictEqual(rogue.blocker, orc, 'rogue blocked by orc');
}
{
    // 대마도사: 부대장과 같은 체력 체계, 50%에 범위 감전, 25%에 넓은 범위 감전(경고 표시)
    clearBoard();
    const def = BOSSES.archmage;
    const boss = place(null, 700, 'archmage');
    const knight = createHero(null, 0, 0, 'fallen_knight');
    assert(boss.boss && !boss.elite && boss.bossKey === 'archmage' && boss.name === def.name);
    assert.strictEqual(boss.maxHp, knight.maxHp * def.waveHpMul, 'fallen knight hp x waveHpMul');
    assert.strictEqual(boss.throneDamage, def.throneDamage);
    assert(def.art.sprite === 'stormcaller' && Math.abs(def.art.scale - 3 / WORLD_ZOOM) < 1e-9);
    const [p1, p2] = def.patterns;
    assert(p1.at === 0.5 && p1.kind === 'shock' && p2.at === 0.25 && p2.kind === 'shock' && p2.range > p1.range);
    const w = heroWorld(boss);
    const fNear = fakeFacility(w.x + (p1.range - 0.5) * TILE, w.y);
    const fWide = fakeFacility(w.x, w.y + (p2.range - 0.5) * TILE);
    const orc = fakeOrc(w.x - TILE, w.y);
    updateHero(boss, 0.1);
    assert.strictEqual(boss.windup, 0, 'no pattern at full hp');
    boss.hp = boss.maxHp * 0.49;
    updateHero(boss, 0.05);
    assert(boss.windup > 0 && Game.telegraphs.length === 1 && Game.telegraphs[0].radius === p1.range * TILE, 'first shock warning');
    for (let i = 0; i < Math.ceil(p1.windup / 0.1) + 1; i++) updateHero(boss, 0.1);
    assert(fNear.stun > 0 && orc.stun > 0, 'first shock hits near');
    assert.strictEqual(fWide.stun, 0, 'first shock does not reach wide');
    boss.hp = boss.maxHp * 0.24;
    updateHero(boss, 0.05);
    const t2 = Game.telegraphs[Game.telegraphs.length - 1];
    assert(boss.windup > 0 && t2.radius === p2.range * TILE && t2.color, 'second wide shock warning');
    for (let i = 0; i < Math.ceil(p2.windup / 0.1) + 1; i++) updateHero(boss, 0.1);
    assert(fWide.stun > 0, 'wide shock hits far');
    assert(boss.patternsDone[0] && boss.patternsDone[1]);
    // 웨이브 표의 boss 한 칸만 바꾸면 대마도사가 나온다. 이름 배너와 보스 체력바가 쓰는 값도 확인한다
    clearBoard();
    const last = WAVES[WAVES.length - 1];
    assert.strictEqual(last.boss, 'fallen_knight', 'boss wave keeps fallen knight');
    last.boss = 'archmage';
    Game.waveIndex = WAVES.length - 1;
    Game.state = 'prep';
    Game.startWave();
    const spawned = Game.heroes.find(h => h.boss);
    assert(spawned && spawned.bossKey === 'archmage' && spawned.name === def.name);
    assert.strictEqual(Fx.banner.name, def.name);
    assert.strictEqual(Fx.banner.portrait, def.portrait);
    last.boss = 'fallen_knight';
}

// 몬스터 능력: 표의 abilities(종류와 값)로 동작한다. 일반 3종은 능력이 없다
assert.strictEqual(gradePool('common').map(t => MONSTERS[t].abilities.length).join(), '0,0,0', 'common monsters have no ability');
for (const t of Object.keys(MONSTERS)) for (const a of MONSTERS[t].abilities) {
    assert(ABILITY_KINDS[a.kind], 'known ability kind ' + a.kind);
    assert(ABILITY_KINDS[a.kind].desc(a).length > 0, 'popup line for ' + a.kind);
}
assert.strictEqual(monsterAbility('orc_berserker', 'enrage').below, 0.5);
assert.strictEqual(monsterAbility('curse_shooter', 'curseShot').duration, 3);
assert.strictEqual(monsterAbility('bone_knight', 'deathStun').radius, 2);
// 몬스터 하나를 길 위 거리 d에 세운다(발끝이 길 선 위)
const putMonster = (type, d) => {
    const p = pathAt(d);
    const m = createMonster(type, 1, 1);
    const y = p.y - MONSTER_FOOT;
    Object.assign(m, { x: p.x, y, homeX: p.x, homeY: y, rally: m.blocks ? { d, x: p.x, y } : null });
    Game.monsters.push(m);
    return m;
};
const tough = h => { h.hp = h.maxHp = 9999; return h; };
{
    // 광폭화: 체력 50% 이하면 공격 간격 절반, 다시 나오면 풀린다
    clearBoard();
    const bz = putMonster('orc_berserker', 900);
    assert.strictEqual(monsterStats(bz).interval, 0.7);
    assert.strictEqual(monsterStats({ type: 'orc_berserker', tier: 1, branch: null }).interval, 0.7, 'popup preview not enraged');
    bz.hp = bz.maxHp * 0.51;
    assert(!monsterEnrage(bz) && monsterStats(bz).interval === 0.7, 'not enraged above half');
    bz.hp = bz.maxHp * 0.5;
    assert(monsterEnrage(bz), 'enraged at half');
    assert(Math.abs(monsterStats(bz).interval - 0.35) < 1e-9, 'interval halved');
    // 실제 공격 간격도 짧아진다
    const foe = tough(place('warrior', 900));
    bz.atk = 0;
    updateMonster(bz, 1 / 30);
    assert.strictEqual(foe.blocker, bz);
    assert(Math.abs(bz.atk - 0.35) < 1e-9, 'enraged attack timer ' + bz.atk);
    // 쓰러지면 풀리고, 다시 나오면(체력 가득) 원래 간격
    damageUnit(bz, 9999);
    assert(bz.down > 0 && !monsterEnrage(bz));
    assert.strictEqual(foe.stun, 0, 'berserker has no death stun');
    updateMonster(bz, MONSTERS.orc_berserker.stats.respawn + 0.1);
    assert(bz.hp === bz.maxHp && !monsterEnrage(bz) && monsterStats(bz).interval === 0.7, 'enrage released after revive');
}
{
    // 저주: 맞은 용사는 3초 동안 받는 피해 +25%. 다시 맞으면 겹치지 않고 시간만 3초로 돌아간다
    clearBoard();
    Game.projectiles = [];
    const cs = putMonster('curse_shooter', 700);
    const h = tough(place('warrior', 700 + TILE));
    assert(h.curse === 0 && h.curseMul === 1);
    const shoot = (m, target) => {
        fireMonsterShot(m, monsterStats(m), target);
        const p = Game.projectiles[Game.projectiles.length - 1];
        for (let i = 0; i < 120 && !p.done; i++) updateProjectile(p, 1 / 60);
        assert(p.done, 'arrow landed');
    };
    shoot(cs, h);
    assert.strictEqual(h.hp, 9999 - (22 - h.armor), 'cursing arrow itself is not amplified');
    assert.strictEqual(h.curse, 3);
    assert.strictEqual(h.curseMul, 1.25);
    let hp0 = h.hp;
    damageHero(h, 10);
    assert(Math.abs(hp0 - h.hp - (10 - h.armor) * 1.25) < 1e-9, 'cursed hero takes +25%');
    updateHero(h, 1);
    assert(Math.abs(h.curse - 2) < 1e-9, 'curse ticks down');
    shoot(cs, h);
    assert.strictEqual(h.curse, 3, 'refreshed to full duration');
    assert.strictEqual(h.curseMul, 1.25, 'does not stack');
    hp0 = h.hp;
    damageHero(h, 10);
    assert(Math.abs(hp0 - h.hp - (10 - h.armor) * 1.25) < 1e-9, 'still +25% after refresh, not +56%');
    for (let i = 0; i < 31; i++) updateHero(h, 0.1);
    assert.strictEqual(h.curse, 0, 'curse expired');
    hp0 = h.hp;
    damageHero(h, 10);
    assert.strictEqual(hp0 - h.hp, 10 - h.armor, 'normal damage after expiry');
    // 능력 없는 궁수의 화살과 암흑 마법사의 구체는 저주를 걸지 않는다
    const archer = putMonster('skeleton_archer', 700);
    const h2 = tough(place('warrior', 700 + TILE));
    shoot(archer, h2);
    assert.strictEqual(h2.curse, 0, 'plain arrow no curse');
    assert.strictEqual(h2.hp, 9999 - (MONSTERS.skeleton_archer.stats.damage - h2.armor), 'plain arrow damage unchanged');
    const mage = putMonster('dark_mage', 700);
    shoot(mage, h2);
    assert.strictEqual(h2.curse, 0, 'orb no curse');
}
{
    // 해골 기사가 쓰러지면 반경 2칸 안 용사 1.5초 기절. 보스와 반경 밖은 제외
    clearBoard();
    const bk = putMonster('bone_knight', 1200);
    const near = tough(place('warrior', 1200 + 1.2 * TILE));
    const far = tough(place('warrior', 1200 + 8 * TILE));
    const boss = place(null, 1200 + 0.5 * TILE, 'fallen_knight');
    const gap = h => distance(bk.x, bk.y + MONSTER_FOOT, heroWorld(h).x, heroWorld(h).y) / TILE;
    assert(gap(near) < 2 && gap(boss) < 2 && gap(far) > 2.5, 'test layout');
    damageUnit(bk, 9999);
    assert(bk.down > 0);
    assert.strictEqual(near.stun, 1.5, 'near hero stunned');
    assert.strictEqual(boss.stun, 0, 'boss not stunned');
    assert.strictEqual(far.stun, 0, 'far hero not stunned');
    const d0 = near.d;
    updateHero(near, 1.4);
    assert.strictEqual(near.d, d0, 'stunned hero stands');
    updateHero(near, 0.2);
    updateHero(near, 0.1);
    assert(near.d > d0, 'walks after stun');
    // 능력 없는 오크 경비병은 쓰러져도 기절시키지 않는다. 광폭화도 없다
    clearBoard();
    const og = putMonster('orc_guard', 1200);
    const h = tough(place('warrior', 1200 + 0.5 * TILE));
    og.hp = og.maxHp * 0.2;
    assert(!monsterEnrage(og) && monsterStats(og).interval === MONSTERS.orc_guard.stats.interval, 'orc guard no enrage');
    damageUnit(og, 9999);
    assert.strictEqual(h.stun, 0, 'orc guard no death stun');
}

// 랭크: D~S, 처치 경험치로만 오른다. 마지막 공격을 넣은 몬스터가 받는다(번개, 타락 유닛 제외)
assert.strictEqual(MONSTER_RANKS.map(r => r.name).join(), 'D,C,B,A,S');
assert.strictEqual(MONSTER_RANKS.map(r => r.xp).join(), '0,5,15,35,70');
assert.strictEqual(MONSTER_RANKS.map(r => r.mul).join(), '1,1.25,1.5,1.75,2');
assert.strictEqual(JSON.stringify(RANK_KILL_XP), '{"normal":1,"elite":3,"boss":10}');
{
    const frail = h => { h.hp = 1; h.armor = 0; return h; };
    const land = () => { for (let i = 0; i < 180 && Game.projectiles.some(p => !p.done); i++) for (const p of Game.projectiles) if (!p.done) updateProjectile(p, 1 / 60); };
    // 원거리 화살
    clearBoard();
    Game.projectiles = [];
    const archer = putMonster('skeleton_archer', 700);
    assert(archer.rank === 0 && archer.xp === 0, 'summoned at D');
    const h1 = frail(place('warrior', 700 + TILE));
    fireMonsterShot(archer, monsterStats(archer), h1);
    land();
    assert(h1.dead && archer.xp === 1, 'arrow kill credited');
    // 근접: 막는 몬스터가 붙잡고 때려 쓰러뜨린다
    clearBoard();
    const orc = putMonster('orc_guard', 900);
    const h2 = frail(place('warrior', 900 + 0.3 * TILE));
    for (let i = 0; i < 90 && !h2.dead; i++) updateMonster(orc, 1 / 30);
    assert(h2.dead && orc.xp === 1, 'melee kill credited');
    // 광역 구체: 맞아 쓰러진 용사마다 경험치
    clearBoard();
    Game.projectiles = [];
    const mage = putMonster('dark_mage', 1100);
    const group = [0, 0.2, 0.4].map(k => frail(place('warrior', 1100 + (1 + k) * TILE)));
    fireMonsterShot(mage, monsterStats(mage), group[0]);
    land();
    assert(group.every(h => h.dead) && mage.xp === 3, 'orb splash kills credited: ' + mage.xp);
    // 빔(관통 갈래)
    clearBoard();
    const beamer = putMonster('dark_mage', 1100);
    Object.assign(beamer, { tier: 3, branch: 'B' });
    const h3 = frail(place('warrior', 1100 + TILE));
    fireMonsterShot(beamer, monsterStats(beamer), h3);
    assert(h3.dead && beamer.xp === 1, 'beam kill credited');
    // 처치는 마지막 공격을 넣은 몬스터만 받는다
    clearBoard();
    const a1 = putMonster('skeleton_archer', 700);
    const a2 = putMonster('skeleton_archer', 700);
    const h4 = tough(place('warrior', 700 + TILE));
    h4.armor = 0;
    damageHero(h4, 9000, 0, 0, null, a1);
    damageHero(h4, 9000, 0, 0, null, a2);
    assert(h4.dead && a1.xp === 0 && a2.xp === 1, 'last hit only');
    // 정예 3, 보스 10
    const elite = tough(place('elite_swordsman', 700 + TILE));
    damageHero(elite, 99999, 0, 0, null, a1);
    assert(elite.dead && a1.xp === 3, 'elite counts 3');
    const boss = place(null, 700 + TILE, 'fallen_knight');
    damageHero(boss, 1e7, 0, 0, null, a1);
    assert(boss.dead && a1.xp === 13, 'boss counts 10');
    assert.strictEqual(a1.rank, 1, 'C at 13 xp');
    assert.strictEqual(monsterXpToNext(a1), 2, '2 kills to B');
    // 번개와 타락 유닛의 처치는 몬스터 경험치가 아니다. 사라진 몬스터의 투사체 처치도 아무도 받지 않는다
    clearBoard();
    Game.projectiles = [];
    Game.pendingStrikes = [];
    const watcher = putMonster('skeleton_archer', 700);
    const h5 = frail(place('warrior', 700 + TILE));
    const w5 = heroWorld(h5);
    resolveStrike({ x: w5.x, y: w5.y });
    const h6 = frail(place('warrior', 700 + TILE));
    damageHero(h6, 5, 0, 0, '#ffb76b'); // 타락 유닛은 공격자를 넘기지 않는다
    const h7 = frail(place('warrior', 700 + TILE));
    fireMonsterShot(watcher, monsterStats(watcher), h7);
    Game.removeMonster(watcher);
    land();
    assert(h5.dead && h6.dead && h7.dead && watcher.xp === 0, 'lightning, corrupt, removed shooter give no xp');
}
{
    // 랭크 상승과 수치: 랭크마다 체력과 피해 25%씩(S는 2배). 체력은 비율을 유지한다
    clearBoard();
    const og = putMonster('orc_guard', 900);
    const base = MONSTERS.orc_guard.stats;
    og.hp = og.maxHp * 0.5;
    og.xp = 4;
    const kill = (m, type, bossKey) => { const h = tough(place(type || 'warrior', 900 + TILE, bossKey)); damageHero(h, 1e7, 0, 0, null, m); };
    kill(og);
    assert.strictEqual(og.rank, 1, 'C at 5 kills');
    assert(og.rankUp > 0, 'rank up effect');
    assert(Math.abs(monsterStats(og).damage - base.damage * 1.25) < 1e-9 && og.maxHp === base.hp * 1.25, 'C stats +25%');
    assert(Math.abs(og.hp / og.maxHp - 0.5) < 1e-9, 'hp ratio kept on rank up');
    // 경험치가 넘치면 여러 단계를 한 번에 오른다. S에서 멈춘다
    og.xp = 30;
    kill(og, null, 'fallen_knight');
    assert.strictEqual(og.rank, 3, 'A at 40');
    og.xp = 69;
    kill(og);
    assert.strictEqual(og.rank, 4, 'S at 70');
    assert(Math.abs(monsterStats(og).damage - base.damage * 2) < 1e-9 && og.maxHp === base.hp * 2, 'S doubles');
    assert.strictEqual(monsterXpToNext(og), 0, 'S is top');
    kill(og, null, 'fallen_knight');
    assert.strictEqual(og.rank, 4, 'stays S');
    // 쓰러졌다 다시 나와도 랭크 유지, 체력은 랭크 기준 최대치로
    damageUnit(og, 1e6);
    assert(og.down > 0);
    for (let i = 0; i < 40 && og.down > 0; i++) updateMonster(og, 0.25);
    assert(og.down <= 0 && og.rank === 4 && og.hp === base.hp * 2, 'rank kept after respawn');
    // 합치면 재료 중 낮은 랭크, 경험치는 그 랭크의 시작값
    clearBoard();
    const m1 = Game.place('orc_guard', 3, 6);
    const m2 = Game.place('orc_guard', 3, 4) || Game.place('orc_guard', 5, 5);
    assert(m1 && m2, 'merge test cells');
    setMonsterRank(m1, 3);
    m1.xp = 50;
    setMonsterRank(m2, 1);
    m2.xp = 12;
    const res = Game.merge({ monster: m2 }, { monster: m1 });
    assert(res.ok, 'merged');
    assert.strictEqual(res.monster.rank, 1, 'lower rank inherited');
    assert.strictEqual(res.monster.xp, 5, 'xp at rank start');
    assert.strictEqual(res.monster.maxHp, MONSTERS[res.type].stats.hp * 1.25, 'inherited rank stats');
    // 옮겨도 유지
    const free = [[5, 5], [7, 6], [9, 5], [11, 4]].find(([c, r]) => Game.canPlace(res.type, c, r));
    assert(Game.moveMonster(res.monster, free[0], free[1]) && res.monster.rank === 1, 'rank kept after move');
    clearBoard();
}

{
    // 제물: 등급별 표(체력, 번개 감소)
    assert.deepStrictEqual(sacrificeGain('orc_guard'), { heal: 1, lightning: 2 }, 'common');
    assert.deepStrictEqual(sacrificeGain('curse_shooter'), { heal: 2, lightning: 5 }, 'rare');
    assert.deepStrictEqual(sacrificeGain('bone_knight'), { heal: 5, lightning: 10 }, 'epic');
    assert.deepStrictEqual(sacrificeGain('death_lord'), { heal: 10, lightning: 30 }, 'legendary');
    // 랭크 보정: 랭크마다 +25%, S는 2배. 체력은 내림
    assert.deepStrictEqual(sacrificeGain({ type: 'curse_shooter', rank: 1 }), { heal: 2, lightning: 6.25 }, 'rare C');
    assert.deepStrictEqual(sacrificeGain({ type: 'curse_shooter', rank: 2 }), { heal: 3, lightning: 7.5 }, 'rare B');
    assert.deepStrictEqual(sacrificeGain({ type: 'bone_knight', rank: 3 }), { heal: 8, lightning: 17.5 }, 'epic A');
    assert.deepStrictEqual(sacrificeGain({ type: 'orc_guard', rank: 4 }), { heal: 2, lightning: 4 }, 'common S');
    assert.deepStrictEqual(sacrificeGain({ type: 'death_lord', rank: 4 }), { heal: 20, lightning: 60 }, 'legendary S');
    assert.strictEqual(sacrificeText(sacrificeGain('curse_shooter')), '체력 +2, 번개 -5초');
    assert.strictEqual(sacrificeText({ heal: 2, lightning: 6.25 }), '체력 +2, 번개 -6.25초');

    clearBoard();
    Game.state = 'prep';
    Game.prepTimer = 999;
    // 직접 호출: 체력 회복, 번개 대기 감소, 칸이 빔
    const k = Game.place('bone_knight', 3, 6);
    setMonsterRank(k, 3);
    Game.hp = 5;
    Game.skills.lightning = 25;
    const r1 = Game.sacrifice(k);
    assert(r1.ok && Game.hp === 13 && Game.skills.lightning === 7.5, 'epic A sacrifice: hp ' + Game.hp + ' cd ' + Game.skills.lightning);
    assert(!Game.monsters.includes(k) && k.removed && !Game.monsterAt(3, 6), 'cell freed');
    assert(!Game.sacrifice(k).ok, 'cannot sacrifice twice');
    // 다시 소환(놓기) 가능
    assert(Game.canPlace('orc_guard', 3, 6), 'cell usable again');
    assert(withRandom([0, 0, 0], () => Game.summon()).ok, 'summon after sacrifice');
    // 체력 최대치를 넘지 않고, 번개 대기는 0 아래로 내려가지 않는다. 체력이 가득해도 바칠 수 있다
    clearBoard();
    const d1 = Game.place('death_lord', 3, 6);
    Game.hp = COMBAT_RULES.maxHp - 3;
    Game.skills.lightning = 4;
    const r2 = Game.sacrifice(d1);
    assert(r2.ok && r2.heal === 3 && Game.hp === COMBAT_RULES.maxHp && Game.skills.lightning === 0, 'clamped');
    const c1 = Game.place('orc_guard', 3, 6);
    Game.skills.lightning = 10;
    assert(Game.sacrifice(c1).ok && Game.hp === COMBAT_RULES.maxHp && Game.skills.lightning === 8, 'full hp still cuts lightning');
    // 판매 환불 없음
    const g0 = Game.gold;
    assert(Game.sacrifice(Game.place('skeleton_archer', 3, 4)).ok && Game.gold === g0, 'no gold from sacrifice');

    // 웨이브 중, 막고 있던 용사가 풀린다
    clearBoard();
    Game.state = 'wave';
    const blocker = putMonster('orc_guard', 900);
    const held = tough(place('warrior', 900 + 10));
    held.blocker = blocker;
    blocker.target = held;
    assert(Game.sacrifice(blocker).ok, 'sacrifice during wave');
    assert(held.blocker === null, 'blocked hero released');
    Game.update(1 / 30);
    assert(held.blocker !== blocker, 'not re-blocked by sacrificed monster');

    // 끌기로 바치기: 왕좌 위에 놓으면 제물, 왕좌 밖(길 등)에 놓으면 제물이 안 된다
    clearBoard();
    Game.state = 'prep';
    Game.hp = 10;
    Game.skills.lightning = 20;
    const throneXY = [tileX(THRONE_TILE.col) * WORLD_ZOOM, (tileY(THRONE_TILE.row) - 40) * WORLD_ZOOM];
    const a1 = Game.place('curse_shooter', 21, 5) || Game.place('curse_shooter', 19, 6);
    assert(a1, 'archer near throne');
    const sacBefore = Game.stats.sacrificed;
    // 끄는 중 미리보기 동작
    UI.update(0);
    UI.onMove(...monXY(a1));
    UI.onDown(...monXY(a1));
    for (let i = 1; i <= 4; i++) UI.onMove(monXY(a1)[0] + (throneXY[0] - monXY(a1)[0]) * i / 4, monXY(a1)[1] + (throneXY[1] - monXY(a1)[1]) * i / 4);
    assert(UI.dropTarget && UI.dropTarget.throne, 'throne is drop target');
    assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'sacrifice');
    UI.onUp(...throneXY);
    assert(!Game.monsters.includes(a1) && Game.hp === 12 && Game.skills.lightning === 15, 'drag sacrifice: hp ' + Game.hp);
    assert.strictEqual(Game.stats.sacrificed, sacBefore + 1, 'sacrifice count');
    // 왕좌 밖(왕좌에서 떨어진 길 칸)에 놓으면 그대로 남는다
    const a2 = Game.place('curse_shooter', 3, 4);
    const pathCell = [...Array(MAP_COLS).keys()].flatMap(c => [...Array(MAP_ROWS).keys()].map(r => [c, r]))
        .find(([c, r]) => isPathCell(c, r) && Math.abs(c - THRONE_TILE.col) > 3);
    dragTo(monXY(a2), cellXY(pathCell[0], pathCell[1]));
    assert(Game.monsters.includes(a2) && Game.hp === 12 && Game.skills.lightning === 15, 'off-throne drop is not a sacrifice');
    // 바로 옆 칸(왕좌 영역 밖)도 아니다
    assert(!Game.onThrone(tileX(THRONE_TILE.col - 2), tileY(THRONE_TILE.row)), 'two tiles left is off throne');
    assert(!Game.onThrone(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row + 2)), 'two tiles below is off throne');
    assert(Game.onThrone(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row)), 'throne tile');
    // 연출 진행 중 예외 없음
    tick(1.5);
    clearBoard();
    Game.hp = COMBAT_RULES.maxHp;
    Game.skills.lightning = 0;
}

// 중간 보스와 보스 보상 3택
{
    clearBoard();
    Game.hp = COMBAT_RULES.maxHp;
    // 5번째 웨이브: 기존 파티 그대로 대마도사가 나온다. 마지막 웨이브는 부대장 그대로
    const w5 = WAVES[4];
    assert.strictEqual(w5.boss, 'archmage');
    assert.strictEqual(w5.party, '견습 마법사와 친구들');
    assert.strictEqual(JSON.stringify(w5.members), '{"warrior":15,"mage":3}');
    assert.strictEqual(JSON.stringify(w5.elites), '{"elite_stormcaller":1}');
    assert.strictEqual(WAVES[WAVES.length - 1].boss, 'fallen_knight');
    assert.strictEqual(WAVES.filter(w => w.boss).length, 2, 'two boss waves');
    // 체력: 부대장과 같은 계산(전사 x 15 x 웨이브 배율)에 waveHpMul(초안 0.6)
    assert.strictEqual(BOSSES.archmage.waveHpMul, 0.6);
    assert(!BOSSES.fallen_knight.waveHpMul, 'fallen knight keeps full hp');
    assert(Math.abs(createHero(null, 4, 0, 'archmage').maxHp - createHero(null, 4, 0, 'fallen_knight').maxHp * 0.6) < 1e-9);
    // 발끝: 동작과 방향마다 값이 있다
    for (const pose of ['walk', 'cast', 'atk']) for (const dir of ['down', 'left', 'right', 'up']) {
        assert(typeof BOSSES.archmage.art.footPx[pose][dir] === 'number', 'archmage foot ' + pose + ' ' + dir);
    }

    // 보상 표: 몬스터 1장(희귀 또는 영웅, 영웅 40%), 장비 1장(희귀 또는 영웅, 영웅 40%), 골드 300G 1장
    assert.strictEqual(JSON.stringify(BOSS_REWARD_RULES), '{"monsterCards":1,"epicChance":0.4,"gold":300}');
    assert.strictEqual(EQUIP_RULES.rewardEpicChance, 0.4);
    const kinds = r => r.cards.map(c => c.kind === 'gold' ? 'gold' + c.gold : (c.kind === 'equip' ? c.id : c.type)).join();
    // 난수 순서: 몬스터 등급, 몬스터, 장비 등급, 장비
    assert.strictEqual(withRandom([0.39, 0, 0.39, 0], () => kinds(Game.rollBossReward())), 'bone_knight,gauntlet,gold300', 'epic under 40%');
    assert.strictEqual(withRandom([0.4, 0.99, 0.4, 0.99], () => kinds(Game.rollBossReward())), 'curse_shooter,tome,gold300', 'rare from 40%');
    const seenEquip = new Set();
    for (let i = 0; i < 300; i++) {
        const r = Game.rollBossReward();
        assert.strictEqual(r.cards.length, 3);
        const [a, e, g] = r.cards;
        assert(a.kind === 'monster', 'first card monster');
        const def = MONSTERS[a.type];
        assert((def.grade === 'rare' || def.grade === 'epic') && def.summon !== false, 'rare or epic only: ' + a.type);
        assert(e.kind === 'equip' && EQUIPMENT[e.id] && EQUIPMENT[e.id].grade !== 'common', 'second card rare or epic equipment: ' + e.id);
        seenEquip.add(EQUIPMENT[e.id].grade);
        assert(g.kind === 'gold' && g.gold === 300);
    }
    assert(seenEquip.has('rare') && seenEquip.has('epic'), 'both equipment grades appear');

    // 5번째 웨이브 시작: 대마도사가 파티 뒤에 나온다
    Game.state = 'prep';
    Game.waveIndex = 4;
    assert(Game.startWave());
    const mb = Game.heroes.find(h => h.boss);
    assert(mb && mb.bossKey === 'archmage', 'archmage in wave 5');
    assert.strictEqual(Game.heroes.length, 15 + 3 + 1 + 1);
    assert(Math.abs(mb.maxHp - HEROES.warrior.hp * 15 * (1 + COMBAT_RULES.hpPerWave * 4) * 0.6) < 1e-9, 'wave 5 archmage hp');
    // 보스를 처치해도 전투 중에는 카드를 띄우지 않는다
    const keep = Game.place('orc_guard', 3, 6);
    Game.heroes = [mb];
    mb.waiting = false;
    damageHero(mb, 1e9);
    assert(mb.dead && Game.bossDefeated && !Game.bossReward && Game.state === 'wave', 'no reward during battle');
    // 웨이브가 끝나 준비 단계에 들어가면 카드 3장
    Game.update(1 / 30);
    assert.strictEqual(Game.state, 'prep');
    assert.strictEqual(Game.waveIndex, 5);
    assert(Game.bossReward && Game.bossReward.cards.length === 3 && !Game.bossDefeated, 'reward after wave');
    UI.update(0);
    assert(['reward0', 'reward1', 'reward2'].every(id => UI.buttons.some(b => b.id === id && !b.disabled)), 'three cards');
    // 고르기 전: 준비 시간이 멈추고 다음 웨이브가 시작되지 않는다. 소환 버튼과 다음 웨이브 버튼도 없다
    const prep0 = Game.prepTimer;
    tick(COMBAT_RULES.prepTime + 2);
    assert.strictEqual(Game.state, 'prep', 'wave does not auto start');
    assert.strictEqual(Game.prepTimer, prep0, 'prep timer paused');
    assert(!Game.startWave(), 'startWave refused');
    UI.onKey('Space');
    assert.strictEqual(Game.state, 'prep');
    assert(!hasBtn('next') && !hasBtn('summon') && !hasBtn('tab_demon'), 'bar buttons hidden while choosing');
    // 맵을 바꾸는 입력은 막는다: 소환(S, 직접 호출), 끌어 옮기기, 몬스터 누르기
    const count0 = Game.monsters.length;
    UI.onKey('KeyS');
    assert(!Game.summon().ok && Game.monsters.length === count0, 'no summon while choosing');
    const home = [keep.col, keep.row];
    dragTo(monXY(keep), cellXY(5, 5));
    assert(keep.col === home[0] && keep.row === home[1] && !UI.drag, 'no drag while choosing');
    click(...monXY(keep));
    assert(!UI.selectedMonster && !UI.popup, 'no monster popup while choosing');
    // 1 키로 첫 카드(몬스터)를 고르면 맵의 빈 칸에 소환처럼 나온다. 소환 비용과 횟수는 그대로
    const pick = Game.bossReward.cards[0];
    const cost0 = Game.summonCost();
    const gold0 = Game.gold;
    UI.onKey('Digit1');
    assert(!Game.bossReward, 'reward closed');
    assert.strictEqual(Game.monsters.length, count0 + 1);
    const got = Game.monsters[Game.monsters.length - 1];
    assert(got.type === pick.type && isBuildCell(got.col, got.row) && Game.monsterAt(got.col, got.row) === got, 'reward monster on map');
    assert(Fx.pops.some(p => p.kind === 'summon' && p.type === pick.type && p.to.x === got.x), 'summon effect');
    assert(Game.summonCost() === cost0 && Game.gold === gold0, 'reward is free');
    // 고른 뒤에는 준비 시간이 다시 흐르고 입력이 돌아온다
    tick(1);
    assert(Game.prepTimer < prep0, 'prep timer resumes');
    assert(hasBtn('next') && hasBtn('tab_monster'), 'bar buttons back');
    // 골드 카드를 누르면 300G
    Game.bossReward = Game.rollBossReward();
    btn('reward2');
    assert(!Game.bossReward && Game.gold === gold0 + 300, 'gold card');
    // 상한(24마리)이 차 있으면 몬스터 카드가 꺼지고 골드만 고를 수 있다
    for (const key of BUILD_CELLS) {
        if (Game.fieldFull()) break;
        const [c, r] = key.split(',').map(Number);
        Game.place('skeleton_archer', c, r);
    }
    assert(Game.fieldFull());
    Game.bossReward = Game.rollBossReward();
    UI.update(0);
    const rb = id => UI.buttons.find(b => b.id === id);
    assert(rb('reward0').disabled && !rb('reward1').disabled && !rb('reward2').disabled, 'monster card dimmed at cap, equipment card stays');
    UI.toast = null;
    UI.onKey('Digit1');
    btn('reward0');
    assert(Game.bossReward && Game.monsters.length === SUMMON_RULES.maxField, 'monster card refused at cap');
    assert(UI.toast && UI.toast.text.includes('골드'), 'cap toast');
    UI.onKey('Digit3');
    assert(!Game.bossReward && Game.gold === gold0 + 600, 'gold at cap');
    // 마지막 보스는 보상 없이 승리
    clearBoard();
    Game.state = 'wave';
    Game.waveIndex = WAVES.length - 1;
    const lastBoss = place(null, 700, 'fallen_knight');
    damageHero(lastBoss, 1e9);
    Game.update(1 / 30);
    assert(Game.state === 'victory' && !Game.bossReward && !Game.bossDefeated, 'last boss: victory without reward');
    // 다시 시작하면 보상 상태도 처음으로
    btn('retry');
    btn('begin');
    Game.bossReward = Game.rollBossReward();
    Game.bossDefeated = true;
    Game.hp = 1;
    damageThrone(1);
    assert.strictEqual(Game.state, 'defeat');
    btn('retry');
    assert(Game.state === 'select', 'retry opens the select screen');
    btn('begin');
    assert(Game.state === 'prep' && !Game.bossReward && !Game.bossDefeated, 'reward state reset on retry');
    const t0 = Game.prepTimer;
    Game.update(0.1);
    assert(Game.prepTimer < t0, 'prep timer runs after retry');
}

// 장비: 표 16종, 보관함 6칸, 끼우기·빼기·맞바꾸기, 합치기 승계, 제물·판매 반환, 가득 차면 골드, 보상 카드, 정예 드롭
{
    assert.strictEqual(Game.state, 'prep');
    Game.monsters = [];
    Game.heroes = [];
    Game.equipBag = [];
    Game.gold = 1000;
    // 표: id, 이름, 등급, 효과
    const table = Object.values(EQUIPMENT).map(e => [e.id, e.name, e.grade, equipEffectText(e.id)].join('|')).join('\\n');
    assert.strictEqual(table, [
        'sword|저주받은 검|common|피해 +20%', 'bow|뼈 활|common|사거리 +15%', 'armor|강철 흉갑|common|체력 +30%',
        'ring|보랏빛 반지|common|공격 속도 +15%', 'boots|날개 장화|common|공격 속도 +10%, 사거리 +5%',
        'elixir|초록 비약|common|체력 +15%, 피해 +10%', 'axe|룬 전투 도끼|rare|피해 +40%', 'shield|해골 방패|rare|체력 +60%',
        'helmet|뿔 투구|rare|체력 +30%, 피해 +20%', 'amulet|핏빛 목걸이|rare|공격 속도 +30%', 'tome|고대 주문서|rare|피해 +15%, 사거리 +25%',
        'gauntlet|악마 손아귀|epic|피해 +60%, 공격 속도 +15%', 'staff|해골 지팡이|epic|피해 +40%, 사거리 +30%',
        'cape|어둠의 망토|epic|체력 +80%, 공격 속도 +15%', 'crystal|영혼 수정|epic|공격 속도 +30%, 처치 경험치 +100%',
        'crown|뼈 왕관|epic|체력 +40%, 피해 +40%, 처치 경험치 +50%'].join('\\n'));
    assert.strictEqual(JSON.stringify(EQUIP_RULES), '{"slots":6,"fullGold":30,"rewardEpicChance":0.4,"eliteDrop":0.25,"eliteRareChance":0.25}');
    // 하단 바: 보관함 6칸이 늘 있고(두 탭 모두), 소환 버튼·스킬 칸·다음 웨이브 버튼과 겹치지 않는다
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const tab of ['monster', 'demon']) {
        UI.setTab(tab);
        UI.update(0);
        const bags = UI.buttons.filter(b => b.bagSlot !== undefined);
        assert.strictEqual(bags.length, 6, 'six bag slots on ' + tab + ' tab');
        for (const b of bags) for (const o of UI.buttons.filter(o => o.bagSlot === undefined)) assert(!overlap(b, o), 'bag slot overlaps ' + o.id);
    }
    UI.setTab('monster');
    const bagXY = i => { const r = UI.bagRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; };
    const near = (a, b) => Math.abs(a - b) < 1e-9;

    // 끼우기: 보관함 칸을 몬스터 위로 끈다. 끄는 동안 몬스터 강조 대상과 놓을 몬스터가 잡힌다
    const archer = Game.place('skeleton_archer', 5, 4);
    const base = monsterStats(archer);
    Game.equipBag = ['sword'];
    UI.update(0);
    const [bx, by] = bagXY(0);
    UI.onMove(bx, by);
    UI.onDown(bx, by);
    const to = monXY(archer);
    for (let i = 1; i <= 4; i++) UI.onMove(bx + (to[0] - bx) * i / 4, by + (to[1] - by) * i / 4);
    assert(UI.equipDrag && UI.equipDrag.id === 'sword' && UI.equipTarget === archer, 'equip drag targets the monster');
    UI.onUp(to[0], to[1]);
    assert(!UI.equipDrag && archer.equip === 'sword' && Game.equipBag.length === 0, 'equipped from bag');
    assert(near(monsterStats(archer).damage, base.damage * 1.2), 'sword +20% damage');
    assert(near(monsterStats(archer).range, base.range) && near(monsterStats(archer).interval, base.interval), 'other stats unchanged');
    // 보관함 칸을 끌지 않고 누르면 안내만
    Game.equipBag = ['bow'];
    UI.toast = null;
    click(...bagXY(0));
    assert(Game.equipBag[0] === 'bow' && UI.toast && UI.toast.text.includes('끌어'), 'bag click hint');
    // 몬스터가 없는 곳에 놓으면 보관함에 그대로
    dragTo(bagXY(0), cellXY(13, 2));
    assert(Game.equipBag.join() === 'bow', 'dropped on nothing stays in bag');
    // 맞바꾸기: 끼고 있으면 원래 장비가 그 칸으로 돌아간다
    Game.equipBag = ['ring', 'bow'];
    dragTo(bagXY(1), monXY(archer));
    assert(archer.equip === 'bow' && Game.equipBag.join() === 'ring,sword', 'swap returns old equipment to the bag');
    assert(near(monsterStats(archer).range, base.range * 1.15) && near(monsterStats(archer).damage, base.damage), 'bow +15% range, sword gone');
    dragTo(bagXY(0), monXY(archer));
    assert(archer.equip === 'ring' && near(monsterStats(archer).interval, base.interval / 1.15), 'ring +15% attack speed');
    // 팝업: 장비 줄과 빼기 버튼. 빼면 수치가 그대로 돌아온다
    click(...monXY(archer));
    assert(UI.selectedMonster === archer && hasBtn('unequip'), 'unequip button in popup');
    btn('unequip');
    assert(!archer.equip && Game.equipBag.join() === 'bow,sword,ring', 'unequip back to bag');
    const after = monsterStats(archer);
    assert(after.damage === base.damage && after.range === base.range && after.interval === base.interval && after.hp === base.hp, 'stats restored');
    UI.clearSelection();
    // 보관함이 가득 차면 빼지 못한다
    setMonsterEquip(archer, 'sword');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    click(...monXY(archer));
    UI.toast = null;
    btn('unequip');
    assert(archer.equip === 'sword' && Game.equipBag.length === 6 && UI.toast.text.includes('가득'), 'unequip refused when bag full');
    UI.clearSelection();
    setMonsterEquip(archer, null);

    // 랭크 배율과 겹쳐도 곱해진다: 랭크 B(x1.5) + 뿔 투구(체력 +30%, 피해 +20%)
    const orc = Game.place('orc_guard', 3, 4);
    setMonsterRank(orc, 2);
    setMonsterEquip(orc, 'helmet');
    assert(near(orc.maxHp, 120 * 1.5 * 1.3) && near(monsterStats(orc).damage, 8 * 1.5 * 1.2), 'rank and equipment multiply');
    setMonsterEquip(orc, null);
    assert(near(orc.maxHp, 120 * 1.5) && near(monsterStats(orc).damage, 8 * 1.5), 'rank stays after unequip');
    // 체력 비율 유지: 절반 체력에서 강철 흉갑을 끼고 빼도 절반
    orc.hp = orc.maxHp / 2;
    Game.equipBag = ['armor'];
    dragTo(bagXY(0), monXY(orc));
    assert(orc.equip === 'armor' && near(orc.maxHp, 180 * 1.3) && near(orc.hp / orc.maxHp, 0.5), 'hp ratio kept on equip');
    assert(Game.unequipMonster(orc).ok && near(orc.maxHp, 180) && near(orc.hp, 90), 'hp ratio kept on unequip');
    // 웨이브 중에도 끼운다. 보상을 고르는 동안은 안 된다
    Game.state = 'wave';
    Game.equipBag = ['shield'];
    assert(Game.equipMonster(orc, 0).ok && orc.equip === 'shield', 'equip during wave');
    Game.state = 'prep';
    Game.bossReward = Game.rollBossReward();
    Game.equipBag = ['sword'];
    assert(!Game.equipMonster(archer, 0).ok && !archer.equip, 'no equip while choosing reward');
    Game.bossReward = null;
    // 처치 경험치: 영혼 수정 +100%, 뼈 왕관 +50%
    setMonsterRank(orc, 0);
    setMonsterEquip(orc, 'crystal');
    monsterKilledHero(orc, { boss: false, elite: false });
    assert.strictEqual(orc.xp, 2, 'crystal doubles kill xp');
    setMonsterEquip(orc, 'crown');
    monsterKilledHero(orc, { boss: false, elite: false });
    assert.strictEqual(orc.xp, 3.5, 'crown +50% xp');
    assert.strictEqual(monsterXpToNext(orc), 2, 'xp to next rounds up');
    setMonsterEquip(orc, null);

    // 합치기: 등급이 높은 쪽 장비 1개가 이어지고, 나머지는 보관함으로
    Game.equipBag = [];
    let mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(mage, 'sword');
    setMonsterEquip(archer, 'axe');
    assert.strictEqual(Game.mergeEquip(mage, archer).keep, 'axe', 'preview: higher grade');
    dragTo(monXY(mage), monXY(archer));
    let res = Game.monsterAt(5, 4);
    assert(res.type === 'curse_shooter' && res.equip === 'axe' && Game.equipBag.join() === 'sword', 'merge keeps higher grade, returns the other');
    assert(near(monsterStats(res).damage, MONSTERS.curse_shooter.stats.damage * 1.4), 'merged monster has the equipment effect');
    // 등급이 같으면 끌어온 쪽 것
    Game.monsters = [];
    Game.equipBag = [];
    let a = Game.place('skeleton_archer', 5, 4);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'bow');
    setMonsterEquip(mage, 'armor');
    assert.strictEqual(Game.mergeEquip(mage, a).keep, 'armor', 'preview: tie keeps dragged');
    dragTo(monXY(mage), monXY(a));
    res = Game.monsterAt(5, 4);
    assert(res.equip === 'armor' && Game.equipBag.join() === 'bow', 'tie: dragged monster equipment');
    // 한쪽만 있으면 그것이 이어진다
    a = Game.place('skeleton_archer', 3, 4);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'gauntlet');
    assert(Game.merge({ monster: mage }, { monster: a }).monster.equip === 'gauntlet', 'single equipment carried');
    // 보관함이 가득 차 있으면 나머지는 30G
    Game.monsters = [];
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    a = Game.place('skeleton_archer', 5, 4);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'crown');
    setMonsterEquip(mage, 'sword');
    let gold0 = Game.gold;
    Fx.notice = null;
    UI.toast = null;
    res = Game.merge({ monster: mage }, { monster: a });
    assert(res.ok && res.monster.equip === 'crown' && Game.equipBag.length === 6 && Game.gold === gold0 + 30, 'merge leftover becomes 30G when bag full');
    UI.update(0);
    assert(UI.toast && UI.toast.text.includes('30G') && UI.toast.text.includes('저주받은 검'), 'full bag notice');

    // 제물과 판매: 장비는 보관함으로, 자리가 없으면 30G
    Game.equipBag = [];
    const s1 = Game.monsterAt(5, 4);
    assert(Game.sacrifice(s1).ok && Game.equipBag.join() === 'crown', 'sacrifice returns equipment');
    const s2 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s2, 'axe');
    click(...monXY(s2));
    btn('sell');
    assert(!Game.monsters.includes(s2) && Game.equipBag.join() === 'crown,axe', 'sell returns equipment');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    const s3 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s3, 'axe');
    gold0 = Game.gold;
    Game.sell(s3);
    assert(Game.gold === gold0 + Game.sellValue('orc_guard') + 30 && Game.equipBag.length === 6, 'sell with full bag: 30G');
    const s4 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s4, 'axe');
    gold0 = Game.gold;
    assert(Game.sacrifice(s4).ok && Game.gold === gold0 + 30 && Game.equipBag.length === 6, 'sacrifice with full bag: 30G');

    // 보스 보상: 장비 카드를 고르면 보관함으로. 보관함이 가득 차면 장비 카드만 꺼진다
    Game.equipBag = [];
    const kinds2 = r => r.cards.map(c => c.kind === 'gold' ? 'gold' + c.gold : (c.kind === 'equip' ? c.id : c.type)).join();
    Game.bossReward = withRandom([0.5, 0, 0.1, 0], () => Game.rollBossReward());
    assert.strictEqual(kinds2(Game.bossReward), 'orc_berserker,gauntlet,gold300');
    UI.onKey('Digit2');
    assert(!Game.bossReward && Game.equipBag.join() === 'gauntlet', 'equipment card goes to the bag');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    Game.bossReward = Game.rollBossReward();
    UI.update(0);
    const rb = id => UI.buttons.find(b => b.id === id);
    assert(!rb('reward0').disabled && rb('reward1').disabled && !rb('reward2').disabled, 'equipment card dimmed when bag full');
    UI.toast = null;
    UI.onKey('Digit2');
    assert(Game.bossReward && Game.equipBag.length === 6 && UI.toast.text.includes('보관함'), 'equipment card refused when bag full');
    UI.onKey('Digit3');
    assert(!Game.bossReward);

    // 정예 드롭: 25% 확률, 일반 75% 희귀 25%. 난수 순서: 드롭, 등급, 장비
    Game.equipBag = [];
    assert(withRandom([0.25], () => Game.eliteDrop(0, 0)) === null && Game.equipBag.length === 0, 'no drop from 25%');
    assert(withRandom([0.24, 0.25, 0], () => Game.eliteDrop(0, 0)).id === 'sword', 'common drop');
    assert(withRandom([0, 0.24, 0.99], () => Game.eliteDrop(0, 0)).id === 'tome', 'rare drop');
    assert.strictEqual(Game.equipBag.join(), 'sword,tome');
    for (let i = 0; i < 200; i++) {
        Game.equipBag = [];
        const d = Game.eliteDrop(0, 0);
        assert(!d || EQUIPMENT[d.id].grade !== 'epic', 'elite never drops epic');
    }
    // 실제 처치: 정예를 쓰러뜨리면 떨어뜨리고 알린다. 일반 용사는 떨어뜨리지 않는다
    Game.state = 'wave';
    Game.equipBag = [];
    const elite = createHero('elite_swordsman', 2, 0, false);
    elite.waiting = false;
    Game.heroes = [elite];
    Fx.notice = null;
    withRandom(0, () => damageHero(elite, 1e9));
    assert(elite.dead && Game.equipBag.join() === 'axe' && Fx.drops.some(d => d.id === 'axe'), 'elite kill drops equipment');
    UI.update(0);
    assert(UI.toast && UI.toast.text.includes('룬 전투 도끼'), 'drop notice');
    const grunt = createHero('warrior', 2, 0, false);
    grunt.waiting = false;
    Game.heroes = [grunt];
    withRandom(0, () => damageHero(grunt, 1e9));
    assert.strictEqual(Game.equipBag.length, 1, 'normal hero drops nothing');
    // 보관함이 가득 차면 드롭은 30G로 바뀐다
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    const elite2 = createHero('elite_tamer', 2, 0, false);
    elite2.waiting = false;
    Game.heroes = [elite2];
    gold0 = Game.gold;
    withRandom(0, () => damageHero(elite2, 1e9));
    assert(Game.gold === gold0 + elite2.bounty + 30 && Game.equipBag.length === 6, 'full bag drop becomes 30G');
    UI.update(0);
    assert(UI.toast.text.includes('30G'), 'full bag drop notice');
    Game.heroes = [];
    Game.corpses = [];
    Game.state = 'prep';
    Game.monsters = [];
    Game.gold = COMBAT_RULES.startGold;
}

// ----- 두 입구(합류형, docs/MULTI_PATH.md) -----
// 준비 상태에서 준비 시간을 길게 두고 시험한다(웨이브 중이면 용사가 없을 때 웨이브가 끝난다)
{
    const savedWave = Game.waveIndex;
    const prep = () => { Game.state = 'prep'; Game.prepTimer = 9999; Game.bossReward = null; };
    const placeOn = (type, route, d) => {
        const h = createHero(type, 0, 0, false, route);
        Object.assign(h, { waiting: false, d, lane: 0, cast: 99, song: 99 });
        Game.heroes.push(h);
        return h;
    };
    // 시험 동안 서로 쓰러뜨리지 않는다
    const sturdy = h => { h.hp = h.maxHp = 1e6; h.damage = 0; return h; };
    const mN = mergeDistance('north');
    const mS = mergeDistance('south');
    clearBoard();
    prep();

    // 길: 합류점 (8,7)에서 만나고, 그 뒤로는 두 길의 좌표와 방향, 남은 거리가 같다. 남쪽이 2칸 짧다
    assert.strictEqual(mN - mS, 2 * TILE, 'south is two tiles shorter');
    assert.strictEqual(ROUTES.north.length - mN, ROUTES.south.length - mS, 'same distance after the merge');
    for (let t = 0; t <= ROUTES.north.length - mN; t += TILE / 4) {
        const a = pathAt(mN + t, 'north');
        const b = pathAt(mS + t, 'south');
        // 합류점 바로 그 점에서는 들어오던 방향이 달라 좌표만 본다
        assert(distance(a.x, a.y, b.x, b.y) < 1e-6 && (t === 0 || (a.dx === b.dx && a.dy === b.dy)), 'merged section coincides at ' + t);
    }
    const mp = pathAt(mS, 'south');
    assert(mp.x === tileX(MERGE_TILE.col) && mp.y === tileY(MERGE_TILE.row), 'merge at (8,7)');
    assert(pathAt(0, 'south').x < 0 && pathAt(0, 'south').y === tileY(9), 'south walks in from outside the gate');
    assert(pathAt(500).x === pathAt(500, 'north').x && pathAt(500).y === pathAt(500, 'north').y, 'route defaults to north');
    // 길 칸은 합집합: 남쪽 갈래 (0..8, 9), (8, 8)도 길이라 지을 수 없다
    for (let c = 0; c <= 8; c++) assert(isPathCell(c, 9) && !isBuildCell(c, 9), 'south path cell ' + c);
    assert(isPathCell(8, 8) && !Game.canPlace('orc_guard', 8, 8));
    for (const id of ROUTE_IDS) for (const k of ROUTES[id].cells) assert(PATH_CELLS.has(k), 'union has ' + k);
    // 남쪽 갈래 아래 줄 10은 새 건설 칸이다
    assert(isBuildCell(3, 10) && isBuildCell(2, 8), 'cells around the south branch');

    // 입구 배분: 일반과 정예를 비율대로 정확히 나눈다. 비율이 없으면 전부 북쪽
    for (const w of WAVES) {
        const c = Game.entryCounts(w);
        const total = [...Object.values(w.members), ...Object.values(w.elites || {})].reduce((a, b) => a + b, 0);
        assert.strictEqual(c.north + c.south, total, 'split adds up ' + w.party);
        if (!w.entry) assert.strictEqual(c.south, 0, 'no entry: all north ' + w.party);
        else assert(Math.abs(c.south - total * w.entry.south / (w.entry.north + w.entry.south)) <= 0.5 + 1e-9, 'split follows ratio ' + w.party);
    }
    assert(!WAVES[0].entry && !WAVES[1].entry && WAVES[2].entry.south === 0.3 && WAVES[4].entry.south === 0.4 && WAVES[7].entry.south === 0.5, 'entry table');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 10 }, entry: { north: 0.7, south: 0.3 } })), '{"north":7,"south":3}');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 9 }, entry: { north: 0.5, south: 0.5 } })), '{"north":5,"south":4}', 'tie goes north');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 6, rogue: 3 } })), '{"north":9,"south":0}', 'no ratio: all north');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 6 }, entry: { south: 1 } })), '{"north":0,"south":6}');

    // 웨이브 시작: 입구별 인원이 정확히 맞고, 직업 수는 그대로다. 출발 간격은 입구마다 따로 세고 남쪽은 절반 늦게 출발한다
    const gap = COMBAT_RULES.spawnGap;
    for (const wi of [0, 3, 8]) {
        clearBoard();
        prep();
        Game.waveIndex = wi;
        assert(Game.startWave());
        const w = WAVES[wi];
        const c = Game.entryCounts(w);
        const of = r => Game.heroes.filter(h => h.route === r && !h.boss);
        assert.strictEqual(of('north').length, c.north, 'north count wave ' + (wi + 1));
        assert.strictEqual(of('south').length, c.south, 'south count wave ' + (wi + 1));
        const types = {};
        for (const h of Game.heroes) types[h.type] = (types[h.type] || 0) + 1;
        for (const [t, n] of [...Object.entries(w.members), ...Object.entries(w.elites || {})]) assert.strictEqual(types[t], n, 'type count ' + t);
        const delays = r => of(r).map(h => h.delay).sort((a, b) => a - b);
        delays('north').forEach((d, i) => assert(Math.abs(d - i * gap) < 1e-9, 'north gap'));
        delays('south').forEach((d, i) => assert(Math.abs(d - (gap / 2 + i * gap)) < 1e-9, 'south gap, half offset'));
        if (wi === 0) assert(Game.heroes.every(h => h.route === 'north'), 'first wave all north');
    }
    // 보스는 북쪽 입구로, 모든 용사가 출발한 뒤에 온다. 예고 글자에 입구를 적는다. BOSSES의 entry를 바꾸면 그 입구로
    clearBoard();
    prep();
    Game.waveIndex = 4;
    Game.startWave();
    {
        const boss = Game.heroes.find(h => h.boss);
        assert(boss && boss.route === 'north', 'boss from the north gate');
        assert(Game.heroes.every(h => h === boss || h.delay < boss.delay), 'boss comes last');
        assert(Fx.banner.sub.includes('북쪽 입구'), 'boss banner names the gate');
        assert(Game.heroes.some(h => h.elite && h.route) && Game.heroes.filter(h => h.route === 'south').length === Game.entryCounts(WAVES[4]).south);
    }
    BOSSES.archmage.entry = 'south';
    clearBoard();
    prep();
    Game.startWave();
    assert.strictEqual(Game.heroes.find(h => h.boss).route, 'south', 'boss entry from the table');
    assert(Fx.banner.sub.includes('남쪽 입구'));
    BOSSES.archmage.entry = 'north';
    assert.strictEqual(Game.bossEntry('fallen_knight'), 'north');

    // 남쪽 용사는 남쪽 갈래를 지나 합류점에서 북쪽 길로 이어 걸어 왕좌에 닿는다(북쪽 갈래 칸은 지나지 않는다)
    clearBoard();
    prep();
    Game.hp = 20;
    {
        const h = placeOn('warrior', 'south', 0);
        h.speed = 12 * TILE;
        const cells = new Set();
        for (let i = 0; i < 300 && !h.dead; i++) {
            Game.update(1 / 30);
            const w = heroWorld(h);
            cells.add(Math.floor(w.x / TILE) + ',' + Math.floor((w.y - MAP_TOP) / TILE));
        }
        assert(h.dead && h.arrived, 'south hero reached the throne');
        assert.strictEqual(Game.hp, 19, 'south hero hits the throne');
        assert(cells.has('4,9') && cells.has('8,8') && cells.has('12,5') && cells.has('20,9'), 'walked the south branch and the shared path');
        assert(!cells.has('4,5') && !cells.has('2,3'), 'never on the north branch');
    }

    // 가장 앞선 용사: d가 아니라 왕좌까지 남은 거리로 비교한다
    clearBoard();
    prep();
    {
        const n = sturdy(placeOn('warrior', 'north', mN - TILE));
        const s = sturdy(placeOn('warrior', 'south', mS - 0.5 * TILE));
        assert(n.d > s.d && remainingDistance(s) < remainingDistance(n));
        assert.strictEqual(foremostHero(tileX(6), tileY(8), 5 * TILE), s, 'south hero is closer to the throne');
        s.d = mS - 1.5 * TILE;
        assert.strictEqual(foremostHero(tileX(6), tileY(8), 5 * TILE), n, 'north hero is closer now');
        // 낀 칸의 궁수도 같은 규칙으로 쏜다
        n.speed = s.speed = 0;
        s.d = mS - 0.5 * TILE;
        const archer = Game.place('skeleton_archer', 6, 8);
        archer.atk = 0;
        for (let i = 0; i < 20 && !Game.projectiles.length; i++) Game.update(1 / 30);
        assert(Game.projectiles.length && Game.projectiles[0].target === s, 'archer shoots the foremost (south) hero');
        Game.projectiles = [];
    }

    // 막기와 풀림: 북쪽 갈래, 남쪽 갈래 따로
    clearBoard();
    prep();
    {
        const oN = Game.place('orc_guard', 2, 2);
        const oS = Game.place('orc_guard', 3, 10);
        assert.strictEqual(oN.rally.route, 'north');
        assert.strictEqual(oS.rally.route, 'south', 'rally on the south branch');
        assert(Math.abs(oS.rally.y + MONSTER_FOOT - 10 - tileY(9)) < 1e-6 && oS.rally.x === tileX(3), 'south rally under the cell');
        for (const o of [oN, oS]) { o.hp = o.maxHp = 1e6; o.damage = 0; }
        tick(1.6);
        assert(!oN.moving && !oS.moving, 'both walked out');
        const hN = sturdy(placeOn('warrior', 'north', oN.rally.d - 1.5 * TILE));
        const hS = sturdy(placeOn('warrior', 'south', oS.rally.d - 1.5 * TILE));
        tick(2);
        assert.strictEqual(hN.blocker, oN, 'north branch blocked');
        assert.strictEqual(hS.blocker, oS, 'south branch blocked');
        const dS = hS.d;
        tick(0.5);
        assert.strictEqual(hS.d, dS, 'blocked hero stands');
        // 풀림: 남쪽 오크를 옮기면 놓아주고 다시 걷는다. 북쪽 오크가 쓰러져도 놓아준다
        assert(Game.moveMonster(oS, 3, 6));
        assert.strictEqual(oS.rally.route, 'north', 'moved orc rallies on the north branch');
        assert(!hS.blocker);
        knockDownMonster(oN);
        assert(!hN.blocker);
        tick(0.5);
        assert(hS.d > dS && hN.d > oN.rally.d - 1.5 * TILE, 'both walk on after release');
    }

    // 합류점 근처: (9,7)의 오크는 합류점에 서서 두 갈래에서 오는 용사를 모두 붙잡는다.
    // (9,8)의 오크는 남쪽 갈래 (8,8)에 서고 북쪽 용사는 붙잡지 않는다
    clearBoard();
    prep();
    {
        const o = Game.place('orc_guard', 9, 7);
        assert(o.rally.route === 'north' && o.rally.x === tileX(8) && Math.abs(o.rally.y + MONSTER_FOOT - 10 - tileY(7)) < 1e-6, 'rally on the merge point');
        o.hp = o.maxHp = 1e6;
        o.damage = 0;
        tick(1.6);
        const hN = sturdy(placeOn('warrior', 'north', mN - 1.5 * TILE));
        const hS = sturdy(placeOn('warrior', 'south', mS - 1.5 * TILE));
        tick(2);
        assert(hN.blocker === o && hS.blocker === o, 'merge orc holds both branches');
        Game.removeMonster(o);
        assert(!hN.blocker && !hS.blocker);
        clearBoard();
        const o2 = Game.place('orc_guard', 9, 8);
        assert(o2.rally.route === 'south' && o2.rally.d < mS, 'rally on the south branch before the merge');
        o2.hp = o2.maxHp = 1e6;
        o2.damage = 0;
        tick(1.6);
        const n2 = sturdy(placeOn('warrior', 'north', mN - 1.5 * TILE));
        const s2 = sturdy(placeOn('warrior', 'south', mS - 2 * TILE));
        tick(2);
        assert.strictEqual(s2.blocker, o2, 'south hero held at (8,8)');
        assert(n2.blocker !== o2 && n2.d > mN, 'north hero passes the merge');
    }

    // 낀 칸 (5..7, 8): 두 갈래에서 모두 1칸. 소환과 끌기로 놓을 수 있다
    clearBoard();
    prep();
    {
        const gapTo = (route, c, r) => Math.min(...ROUTES[route].segments.map(s => {
            const t = clamp((tileX(c) - s.ax) * s.dx + (tileY(r) - s.ay) * s.dy, 0, s.len);
            return distance(tileX(c), tileY(r), s.ax + s.dx * t, s.ay + s.dy * t);
        }));
        for (let c = 5; c <= 7; c++) {
            assert(isBuildCell(c, 8), 'between cell ' + c);
            assert(gapTo('north', c, 8) === TILE && gapTo('south', c, 8) === TILE, 'one tile from both branches ' + c);
        }
        // 다른 빈 칸을 모두 채우면 소환은 낀 칸에 나온다(오크 경비병, 암흑 마법사)
        SUMMON_RULES.maxField = 999;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            if (key !== '6,8') Game.place('skeleton_archer', c, r);
        }
        Game.gold = 5000;
        const r1 = withRandom([0.1, 0.1], () => Game.summon());
        assert(r1.ok && r1.type === 'orc_guard' && r1.monster.col === 6 && r1.monster.row === 8, 'blocker summoned into the between cell');
        assert(r1.monster.rally.route === 'north' && Math.abs(r1.monster.rally.y + MONSTER_FOOT - 10 - tileY(7)) < 1e-6, 'tie goes to the north branch');
        Game.removeMonster(r1.monster);
        const r2 = withRandom([0.69, 0.99], () => Game.summon());
        assert(r2.ok && r2.type === 'dark_mage' && r2.monster.col === 6 && r2.monster.row === 8, 'ranged summoned into the between cell');
        SUMMON_RULES.maxField = 24;
        // 끌기: 남쪽 갈래 아래 칸의 오크를 낀 칸으로 옮기면 집결 지점이 바뀐다
        Game.monsters = [];
        const o = Game.place('orc_guard', 3, 10);
        assert.strictEqual(o.rally.route, 'south');
        UI.clearSelection();
        dragTo(monXY(o), cellXY(7, 8));
        assert.strictEqual(Game.monsterAt(7, 8), o, 'dragged into the between cell');
        assert(o.rally.route === 'north' && o.rally.x === tileX(7), 'rally moved to the north branch');
        // 남쪽 길 칸으로는 끌어 놓지 못한다
        dragTo(monXY(o), cellXY(5, 9));
        assert.strictEqual(Game.monsterAt(7, 8), o, 'south path cell rejected');
    }

    // 시체와 타락 유닛에도 길을 남긴다(타락은 꺼 두었지만 켰을 때를 위해)
    clearBoard();
    prep();
    {
        Game.corpses = [];
        const h = placeOn('warrior', 'south', 3 * TILE);
        damageHero(h, 1e9);
        const corpse = Game.corpses[Game.corpses.length - 1];
        assert(corpse && corpse.route === 'south' && corpse.d === 3 * TILE, 'corpse keeps the route');
        const u = createCorruptUnit(corpse);
        assert(u.route === 'south' && u.d === corpse.d, 'corrupt unit keeps the route');
        Game.corpses = [];
    }

    clearBoard();
    Game.projectiles = [];
    Game.waveIndex = savedWave;
    prep();
    Game.prepTimer = COMBAT_RULES.prepTime;
    UI.clearSelection();
    UI.toast = null;
}

// 패배 후 다시 시작하면 모두 초기화(소환 비용도 처음으로)
assert(Game.summon().ok && Game.summonCost() > SUMMON_RULES.cost, 'cost rose before retry');
setMonsterRank(Game.monsters[0], 4);
setMonsterEquip(Game.monsters[0], 'crown');
Game.equipBag = ['sword', 'axe'];
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'select');
btn('begin');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.equipBag.length, 0, 'bag emptied on retry');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(UI.tab, 'monster', 'retry starts on monster tab');
assert(Game.summonCount === 0 && Game.summonCost() === SUMMON_RULES.cost, 'summon cost reset');
assert.strictEqual(Game.units.length, 0);
{
    // 랭크도 처음으로: 다시 소환한 몬스터는 D
    const r = Game.summon();
    assert(r.ok && r.monster.rank === 0 && r.monster.xp === 0 && !r.monster.equip, 'rank and equipment reset on retry');
    Game.removeMonster(r.monster);
    Game.gold = COMBAT_RULES.startGold;
    Game.summonCount = 0;
}

// 한 판 끝까지: 보스 패턴 포함, 예외 없이 승리 화면까지 간다
Game.gold = 6000;
[[3,4,'skeleton_archer'],[5,5,'dark_mage'],[3,6,'orc_guard'],[7,6,'skeleton_archer'],[9,5,'dark_mage'],[9,2,'skeleton_archer'],[11,4,'orc_guard'],[13,5,'dark_mage'],[13,7,'dark_mage'],[15,7,'skeleton_archer'],[11,6,'dark_mage'],[15,5,'dark_mage'],
    // 길 뒤쪽: 돌진하는 보스를 붙잡을 오크와 마무리 화력
    [17,6,'orc_guard'],[19,8,'orc_guard'],[21,8,'orc_guard'],[19,6,'skeleton_archer'],[18,7,'dark_mage'],[21,5,'skeleton_archer']].forEach(([c,r,t]) => assert(Game.place(t,c,r), 'place ' + t + ' ' + c + ',' + r));
for (const x of Game.monsters) { Game.upgrade(x); Game.upgrade(x, 'A'); }
let guard = 0, sawCharge = false, sawStomp = false, rewards = 0, sawArchmage = false, equipped = 0;
const eliteWaves = new Set();
while (Game.state !== 'victory' && Game.state !== 'defeat' && guard++ < 60000) {
    // 보스 보상: 둘째 카드(장비)를 고르고, 보관함이 가득 차면 골드
    if (Game.bossReward) {
        rewards++;
        assert(!Game.startWave(), 'no wave before reward');
        UI.onKey('Digit2');
        if (Game.bossReward) UI.onKey('Digit3');
        assert(!Game.bossReward);
    }
    // 보관함의 장비는 바로 맵의 몬스터에게 끼운다(웨이브 중에도)
    if (Game.equipBag.length && Game.inPlay()) {
        const free = Game.monsters.find(m => !m.equip);
        if (free && Game.equipMonster(free, 0).ok) equipped++;
    }
    if (Game.state === 'prep') Game.startWave();
    if (Game.waveIndex === 4 && Game.heroes.some(h => h.bossKey === 'archmage')) sawArchmage = true;
    UI.update(1 / 30);
    Game.update(1 / 30);
    if (Game.heroes.some(h => h.elite)) eliteWaves.add(Game.waveIndex);
    const b = Game.heroes.find(h => h.boss);
    if (b && b.chargeTime > 0) sawCharge = true;
    if (b && b.patternsDone[1]) sawStomp = true;
}
assert.strictEqual(Game.state, 'victory', 'wave ' + (Game.waveIndex + 1) + ' hp ' + Game.hp + ' heroes ' + Game.heroes.map(h => h.type + (h.boss ? 'B' : '') + ':' + Math.round(h.d)).join(' '));
assert(sawCharge && sawStomp, 'boss patterns fired');
assert(sawArchmage && rewards === 1, 'archmage in wave 5, one boss reward (rewards ' + rewards + ')');
assert.strictEqual(eliteWaves.size, WAVES.length - 2, 'elites appeared in waves 3..' + WAVES.length);
assert(equipped >= 1, 'boss reward equipment was equipped');
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });

// 마왕과 유물: 표, 선택 화면, 효과 키, 유물 칸 수, 다시 시작, 저장소. 위의 한 판 시험이 끝난 뒤 같은 환경에서 이어 돈다
vm.runInContext(`{ // 위 시험과 이름이 겹치지 않게 블록으로 감싼다
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, (msg || '') + ': ' + a + ' != ' + b);
// 저장소 흉내: 값을 담는 것, 읽기와 쓰기에서 예외를 내는 것
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
// 영구 수집 기록을 이 시험용으로: 모든 마왕과 유물을 해금하고 유물 칸 slots개(저장소는 건드리지 않는다)
const unlockAll = slots => { Meta.data = Meta.sanitize({ lords: Object.keys(DEMON_LORDS), relics: Object.keys(RELICS), slots }); };
unlockAll(1);

// ----- 표 -----
same(Object.keys(DEMON_LORDS), ['rift', 'bone_queen', 'gold_king'], 'three lords');
same(DEMON_LORDS.rift.effects, { lightningDamage: 1.25, skillCooldown: 0.9 }, 'rift');
same(DEMON_LORDS.bone_queen.effects, { respawn: 0.6, xp: 0.25, maxHp: -3 }, 'bone queen');
same(DEMON_LORDS.gold_king.effects, { startGold: 100, bounty: 1.2, maxHp: -5 }, 'gold king');
same(Object.keys(RELICS), ['pouch', 'chalice', 'hourglass', 'candle', 'tablet', 'handgem', 'drum', 'horn', 'key', 'heart', 'bottle', 'eye', 'banner', 'dice', 'shackles', 'mirror'], 'sixteen relics');
assert(typeof RELIC_RULES === 'undefined', 'relic slots come from Meta, not a fixed table');
for (const src of [...Object.values(DEMON_LORDS), ...Object.values(RELICS)]) {
    for (const key of Object.keys(src.effects)) assert(LORD_EFFECTS[key], 'known effect key ' + key + ' in ' + src.name);
}
// 설명 문구는 효과 표에서 만든다
same(effectLines(DEMON_LORDS.rift.effects), ['번개 피해 +25%', '스킬 재사용 ×0.9']);
same(effectLines(DEMON_LORDS.bone_queen.effects), ['부활 시간 ×0.6', '처치 경험치 +25%', '최대 체력 -3']);
same(effectLines(DEMON_LORDS.gold_king.effects), ['시작 골드 +100G', '처치 골드 ×1.2', '최대 체력 -5']);
same(Object.values(RELICS).map(r => effectLines(r.effects).join(', ')), ['시작 골드 +100G', '최대 체력 +5', '스킬 재사용 ×0.8', '용사 이동 속도 ×0.92',
    '몬스터 사거리 +10%', '소환 희귀 확률 +5%', '몬스터 공격 속도 +10%', '몬스터 피해 +10%', '정예 장비 드롭 +15%', '몬스터 체력 +15%',
    '번개 피해 +50%', '처치 경험치 +50%', '맵 몬스터 상한 +4', '소환 시작 비용 -5G', '부활 시간 ×0.7', '판매 환불 ×1.5, 제물 효과 ×1.5'], 'relic texts');
assert(effectGood('maxHp', -3) === false && effectGood('respawn', 0.6) && effectGood('skillCooldown', 0.9) && effectGood('startGold', 100), 'good/bad colors');
// 합치기: 더하는 키는 더하고 곱하는 키는 곱한다
{
    const m = buildMods('bone_queen', ['shackles']);
    near(m.respawn, 0.42, 'respawn multiplies');
    near(buildMods('rift', ['hourglass']).skillCooldown, 0.72, 'cooldown multiplies');
    near(buildMods('rift', ['bottle']).lightningDamage, 1.875, 'lightning multiplies');
    near(buildMods('bone_queen', ['eye']).xp, 0.75, 'xp ratios add');
    assert.strictEqual(buildMods('gold_king', ['chalice']).maxHp, 0, 'maxHp adds');
    assert.strictEqual(buildMods('gold_king', ['pouch']).startGold, 200, 'gold adds');
    same(buildMods('nobody', ['nothing', 'toString']), emptyMods(), 'unknown ids ignored');
}

// ----- 코드에 마왕이나 유물 이름별 분기가 없다(id 문자열은 데이터에만) -----
{
    const src = ${JSON.stringify(['js/game/game.js', 'js/game/combat.js', 'js/game/hero.js', 'js/game/monster.js', 'js/game/render.js', 'js/ui/ui.js', 'js/main.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'))};
    for (const id of [...Object.keys(DEMON_LORDS), ...Object.keys(RELICS)]) {
        assert(!new RegExp("['\\"\`]" + id + "['\\"\`]").test(src), 'no branch on id ' + id);
    }
}

// ----- 값이 없으면 지금과 같다: 효과 없는 시작(시험 도구와 tools/simulate.js) -----
Game.reset();
same(Game.mods, emptyMods(), 'no mods');
assert(Game.lord === null && Game.relics.length === 0 && Game.lordDef() === DEMON_LORDS.rift, 'default lord art');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert(Game.hp === COMBAT_RULES.maxHp && Game.maxHp() === COMBAT_RULES.maxHp, 'max hp');
assert(Game.skillCooldown('lightning') === COMBAT_RULES.lightning.cooldown && Game.skillCooldown('roar') === COMBAT_RULES.roar.cooldown, 'cooldowns');
assert.strictEqual(Game.lightningDamage(), COMBAT_RULES.lightning.damage);
assert.strictEqual(Game.maxField(), SUMMON_RULES.maxField);
same(Game.summonOdds(), SUMMON_RULES.odds, 'odds');
assert.strictEqual(Game.summonCost(), SUMMON_RULES.cost);
for (const t of Object.keys(MONSTERS)) {
    assert.strictEqual(Game.sellValue(t), SUMMON_RULES.refund[MONSTERS[t].grade], 'refund ' + t);
    for (let r = 0; r < MONSTER_RANKS.length; r++) same(Game.sacrificeGain({ type: t, rank: r }), sacrificeGain({ type: t, rank: r }), 'sacrifice ' + t);
}
// 몬스터 수치: 기본 수치 x 랭크 x 장비 그대로
{
    const m = createMonster('orc_guard', 3, 4);
    setMonsterRank(m, 2);
    setMonsterEquip(m, 'helmet');
    const s = monsterStats(m);
    const b = MONSTERS.orc_guard.stats;
    near(s.hp, b.hp * 1.5 * 1.3, 'hp');
    near(s.damage, b.damage * 1.5 * 1.2, 'damage');
    assert(s.interval === b.interval && s.range === b.range && s.respawn === b.respawn, 'interval, range, respawn');
}

// ----- 효과 키마다 적용 -----
// 효과 하나만 넣고 시작한다(다른 키는 기본값)
const only = (key, value) => { Game.reset(); Game.mods[key] = value; };
const firstEmptyCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
{
    // startGold, maxHp: 선택한 마왕과 유물로 시작
    Game.reset({ lord: 'gold_king', relics: ['pouch'] });
    assert(Game.gold === COMBAT_RULES.startGold + 200 && Game.hp === 15 && Game.maxHp() === 15, 'gold king + pouch: gold ' + Game.gold + ' hp ' + Game.hp);
    Game.reset({ lord: 'bone_queen', relics: ['chalice'] });
    assert(Game.hp === 22 && Game.maxHp() === 22, 'bone queen + chalice: hp 22');
    // 제물 회복도 늘어난 최대 체력까지
    Game.hp = 21;
    const r = Game.sacrifice(Game.place('bone_knight', ...firstEmptyCell()));
    assert(r.ok && r.heal === 1 && Game.hp === 22, 'sacrifice clamps at modded max hp');

    // skillCooldown, lightningDamage
    only('skillCooldown', 0.8);
    assert(castLightning(500, 500) && Game.skills.lightning === 24, 'lightning cooldown x0.8');
    Game.hp = 5;
    assert(castRoar() && Game.skills.roar === 48, 'roar cooldown x0.8');
    only('lightningDamage', 1.5);
    {
        const h = createHero('rogue', 0, 0, false);
        Object.assign(h, { waiting: false, d: 900, lane: 0 });
        Game.heroes.push(h);
        const p = heroWorld(h);
        const before = h.hp = 1000;
        resolveStrike({ x: p.x, y: p.y });
        assert.strictEqual(before - h.hp, 60, 'lightning damage x1.5');
    }

    // heroSpeed
    only('heroSpeed', 0.92);
    near(createHero('rogue', 0, 0, false).speed, HEROES.rogue.speed * TILE * 0.92, 'hero speed');
    near(createHero(null, 0, 0, 'archmage').speed, BOSSES.archmage.speed * TILE * 0.92, 'boss speed');

    // damage, hp, attackSpeed, range: 장비 다음에 곱한다
    only('damage', 0.1);
    Game.mods.hp = 0.15;
    Game.mods.attackSpeed = 0.1;
    Game.mods.range = 0.1;
    const m = createMonster('skeleton_archer', 3, 4);
    setMonsterEquip(m, 'bow');
    const s = monsterStats(m);
    const b = MONSTERS.skeleton_archer.stats;
    near(s.damage, b.damage * 1.1, 'damage +10%');
    near(s.hp, b.hp * 1.15, 'hp +15%');
    near(s.interval, b.interval / 1.1, 'attack speed +10%');
    near(s.range, b.range * 1.15 * 1.1, 'range after equipment');
    near(m.maxHp, b.hp * 1.15, 'max hp follows');

    // xp
    only('xp', 0.5);
    const killer = Game.place('skeleton_archer', ...firstEmptyCell());
    monsterKilledHero(killer, { elite: false, boss: false });
    near(killer.xp, 1.5, 'xp +50%');
    setMonsterEquip(killer, 'crystal');
    monsterKilledHero(killer, { elite: true, boss: false });
    near(killer.xp, 1.5 + 3 * 2 * 1.5, 'xp with equipment');

    // bounty
    only('bounty', 1.2);
    {
        const h = createHero('warrior', 0, 0, false);
        Object.assign(h, { waiting: false, d: 900, lane: 0 });
        Game.heroes.push(h);
        const g0 = Game.gold;
        damageHero(h, 1e9);
        assert.strictEqual(Game.gold - g0, Math.round(HEROES.warrior.bounty * 1.2), 'bounty x1.2');
    }

    // rareChance: 일반에서 희귀로 옮긴다
    only('rareChance', 0.05);
    const odds = Game.summonOdds();
    near(odds.common, 0.65, 'common');
    near(odds.rare, 0.30, 'rare');
    assert.strictEqual(odds.epic, 0.05);
    assert.strictEqual(SUMMON_RULES.odds.common, 0.70, 'table untouched');
    assert.strictEqual(MONSTERS[withRandom([0.66, 0], () => Game.rollSummon())].grade, 'rare', '0.66 is rare now');
    Game.mods.rareChance = 0;
    assert.strictEqual(MONSTERS[withRandom([0.66, 0], () => Game.rollSummon())].grade, 'common', '0.66 is common by default');

    // summonBase
    only('summonBase', -5);
    assert.strictEqual(Game.summonCost(), 20, 'start cost -5');
    Game.summonCount = 100;
    assert.strictEqual(Game.summonCost(), SUMMON_RULES.maxCost, 'max cost unchanged');

    // fieldMax
    only('fieldMax', 4);
    assert.strictEqual(Game.maxField(), 28);
    Game.gold = 99999;
    for (let i = 0; i < 24; i++) assert(Game.place('orc_guard', ...firstEmptyCell()), 'fill');
    assert(!Game.fieldFull() && Game.summon().ok, 'room beyond 24');
    for (let i = 0; i < 3; i++) Game.summon();
    assert(Game.monsters.length === 28 && Game.fieldFull() && Game.summon().reason === 'full', 'cap 28');

    // respawn
    only('respawn', 0.6);
    {
        const o = Game.place('orc_guard', ...firstEmptyCell());
        knockDownMonster(o);
        near(o.down, MONSTERS.orc_guard.stats.respawn * 0.6, 'respawn x0.6');
    }

    // eliteDrop
    only('eliteDrop', 0.15);
    assert(withRandom([0.3, 0, 0], () => Game.eliteDrop(0, 0)), 'drop at 0.3 with +15%');
    Game.mods.eliteDrop = 0;
    assert.strictEqual(withRandom([0.3, 0, 0], () => Game.eliteDrop(0, 0)), null, 'no drop at 0.3 by default');

    // refund
    only('refund', 1.5);
    assert(Game.sellValue('orc_guard') === 30 && Game.sellValue('bone_knight') === 225, 'refund x1.5');
    {
        const o = Game.place('orc_guard', ...firstEmptyCell());
        const g0 = Game.gold;
        Game.sell(o);
        assert.strictEqual(Game.gold - g0, 30, 'sell pays refund');
    }

    // sacrifice: 체력은 내림
    only('sacrifice', 1.5);
    same(Game.sacrificeGain('orc_guard'), { heal: 1, lightning: 3 }, 'common x1.5');
    same(Game.sacrificeGain('bone_knight'), { heal: 7, lightning: 15 }, 'epic x1.5');
    Game.hp = 1;
    Game.skills.lightning = 20;
    const r2 = Game.sacrifice(Game.place('bone_knight', ...firstEmptyCell()));
    assert(r2.ok && Game.hp === 8 && Game.skills.lightning === 5, 'sacrifice applied');
}

// ----- 선택 화면: 고르고 시작, 다시 시작, 저장소(모두 해금, 유물 칸 1개) -----
unlockAll(1);
globalThis.localStorage = memoryStorage();
UI.loadout = null; // 창을 새로 연 것처럼
Game.state = 'title';
btn('start');
assert.strictEqual(Game.state, 'select');
same(UI.loadout, { lord: 'rift', relics: [] }, 'empty storage: default');
// 마왕 카드 3장, 유물 16칸, 고른 칸 1개, 시작 버튼
assert(['lord_rift', 'lord_bone_queen', 'lord_gold_king', 'begin', 'picked0'].every(hasBtn) && !hasBtn('picked1'), 'select buttons');
assert.strictEqual(UI.buttons.filter(b => b.relicId).length, 16, 'relic grid');
// 유물 격자 칸은 48px 그림이 원래 크기로 들어간다
assert(UI.buttons.filter(b => b.relicId).every(b => b.w >= 48 && b.h >= 48), 'relic cell fits 48px');
btn('lord_bone_queen');
assert.strictEqual(UI.loadout.lord, 'bone_queen');
UI.onKey('Digit3');
assert.strictEqual(UI.loadout.lord, 'gold_king', 'key 3');
btn('lord_bone_queen');
// 유물: 눌러 넣고, 다른 것을 누르면 바꾸고(칸 1개), 다시 누르면 뺀다. 고른 칸을 눌러도 뺀다
btn('relic_pouch');
same(UI.loadout.relics, ['pouch']);
btn('relic_eye');
same(UI.loadout.relics, ['eye'], 'swap with one slot');
btn('relic_eye');
same(UI.loadout.relics, [], 'tap again removes');
btn('relic_eye');
btn('picked0');
same(UI.loadout.relics, [], 'picked slot removes');
btn('picked0');
same(UI.loadout.relics, [], 'empty picked slot does nothing');
btn('relic_eye');
// 마우스를 올리면(터치는 누른 곳) 설명이 나오는 버튼이다
{
    const b = btnOf('relic_eye');
    UI.onMove(b.x + 10, b.y + 10);
    assert(UI.hoverButton && UI.hoverButton.relicId === 'eye', 'hover shows relic');
}
btn('begin');
assert(Game.state === 'prep' && Game.lord === 'bone_queen' && Game.relics.join() === 'eye', 'started with choice');
near(Game.mods.xp, 0.75, 'mods from choice');
assert.strictEqual(Game.hp, 17, 'bone queen hp');
assert.strictEqual(Game.lordDef(), DEMON_LORDS.bone_queen, 'throne art');
same(JSON.parse(localStorage.data['dungeonGuard.loadout']), { lord: 'bone_queen', relics: ['eye'] }, 'saved');
// 판 중: 마왕 탭에 유물 칸, 스킬 칸과 겹치지 않는다
UI.setTab('demon');
UI.update(0);
{
    const r0 = btnOf('barRelic0');
    const roar = btnOf('roar');
    const bag = btnOf('bag0');
    assert(r0 && !hasBtn('barRelic1'), 'one relic slot in the demon tab');
    assert(roar.x + roar.w <= r0.x && r0.x + r0.w <= bag.x, 'relic slot between roar and bag');
    UI.onMove(r0.x + 10, r0.y + 10);
    assert(UI.hoverButton.id === 'barRelic0' && Game.relics[UI.hoverButton.barRelic] === 'eye', 'hover relic in bar');
    click(r0.x + 10, r0.y + 10); // 눌러도 아무 일 없다
    assert(Game.state === 'prep' && Game.relics.join() === 'eye');
}
// 다시 시작: 선택 화면으로, 직전 선택이 남아 있다
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'select');
same(UI.loadout, { lord: 'bone_queen', relics: ['eye'] }, 'kept on retry');
UI.onKey('Enter');
assert(Game.state === 'prep' && Game.lord === 'bone_queen' && Game.relics.join() === 'eye', 'Enter starts');
// 창을 새로 열어도 저장소에서 읽는다
UI.loadout = null;
Game.state = 'title';
UI.onKey('Space');
same(UI.loadout, { lord: 'bone_queen', relics: ['eye'] }, 'loaded from storage');

// 저장소를 못 읽거나 못 쓸 때: 기본 선택으로 동작하고 시작할 수 있다
globalThis.localStorage = brokenStorage;
UI.loadout = null;
Game.state = 'title';
btn('start');
same(UI.loadout, { lord: 'rift', relics: [] }, 'broken storage: default');
btn('relic_pouch');
btn('begin');
assert(Game.state === 'prep' && Game.relics.join() === 'pouch', 'starts without storage');
Game.hp = 1;
damageThrone(1);
btn('retry');
same(UI.loadout, { lord: 'rift', relics: ['pouch'] }, 'kept in memory without storage');
btn('begin');
// 저장소가 아예 없을 때(file:// 등)
delete globalThis.localStorage;
UI.loadout = null;
Game.state = 'title';
btn('start');
btn('begin');
assert(Game.state === 'prep' && Game.lord === 'rift', 'no storage at all');
// 저장된 값이 이상할 때: 고쳐 쓴다
for (const [raw, want] of [
    ['not json', { lord: 'rift', relics: [] }],
    ['null', { lord: 'rift', relics: [] }],
    ['"x"', { lord: 'rift', relics: [] }],
    ['{"lord":"toString","relics":"pouch"}', { lord: 'rift', relics: [] }],
    ['{"lord":"gold_king","relics":["nope","toString","dice","dice","eye"]}', { lord: 'gold_king', relics: ['dice'] }]
]) {
    globalThis.localStorage = memoryStorage();
    localStorage.data['dungeonGuard.loadout'] = raw;
    UI.loadout = null;
    Game.state = 'title';
    btn('start');
    same(UI.loadout, want, 'clean ' + raw);
}
delete globalThis.localStorage;

// ----- 유물 칸 3개: 화면과 게임이 동작한다 -----
Meta.data.slots = 3;
UI.loadout = { lord: 'rift', relics: [] };
Game.state = 'title';
btn('start');
assert(['picked0', 'picked1', 'picked2'].every(hasBtn) && !hasBtn('picked3'), 'three picked slots');
{
    const rects = ['picked0', 'picked1', 'picked2', 'begin'].map(btnOf);
    const grid = UI.buttons.filter(b => b.relicId);
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const r of rects) for (const g of grid) assert(!overlap(r, g), 'picked slots clear of the grid');
    assert(rects.every(r => r.x + r.w <= GAME_WIDTH && r.y + r.h <= GAME_HEIGHT), 'on screen');
}
btn('relic_pouch');
btn('relic_hourglass');
btn('relic_bottle');
UI.toast = null;
btn('relic_dice');
same(UI.loadout.relics, ['pouch', 'hourglass', 'bottle'], 'fourth refused');
assert(UI.toast && UI.toast.text.includes('가득'), 'full toast');
btn('relic_hourglass');
btn('relic_dice');
same(UI.loadout.relics, ['pouch', 'bottle', 'dice']);
btn('picked0');
same(UI.loadout.relics, ['bottle', 'dice'], 'picked slot removes');
btn('relic_pouch');
btn('begin');
assert(Game.relics.join() === 'bottle,dice,pouch' && Game.gold === COMBAT_RULES.startGold + 100 && Game.summonCost() === 20, 'three relics apply');
near(Game.lightningDamage(), COMBAT_RULES.lightning.damage * 1.25 * 1.5, 'rift + bottle');
UI.setTab('demon');
UI.update(0);
{
    const slots = ['barRelic0', 'barRelic1', 'barRelic2'].map(btnOf);
    const roar = btnOf('roar');
    const light = btnOf('lightning');
    const bag = btnOf('bag0');
    assert(slots.every(Boolean) && !hasBtn('barRelic3'), 'three relic slots in the bar');
    assert(light.x + light.w <= roar.x && slots.every(s => roar.x + roar.w <= s.x && s.x + s.w <= bag.x && s.y + s.h <= GAME_HEIGHT), 'bar layout fits');
    assert(light.w >= 180, 'skill buttons stay readable');
}
// 칸을 1개로 되돌리면 저장된 3개 중 앞의 1개만 쓴다
Meta.data.slots = 1;
Game.hp = 1;
damageThrone(1);
btn('retry');
same(UI.loadout.relics, ['bottle'], 'trimmed to one slot');
btn('begin');
assert(Game.relics.join() === 'bottle');

// 마왕 대사: 공통 대사에 고른 마왕의 대사가 더해진다
Game.reset({ lord: 'gold_king', relics: [] });
assert.strictEqual(withRandom(0.9999, () => lordLine('waveStart')), DEMON_LORDS.gold_king.speech.waveStart.slice(-1)[0], 'gold king line');
assert(SPEECH.waveStart.includes(withRandom(0, () => lordLine('waveStart'))), 'common lines stay');
for (const lord of Object.values(DEMON_LORDS)) {
    const n = Object.values(lord.speech).reduce((a, l) => a + l.length, 0);
    assert(n >= 2 && n <= 3, lord.name + ' has 2~3 own lines');
}
console.log('smoke ok: demon lords and relics');
}`, ctx, { filename: 'smoke-lords' });

// 영구 수집: 영혼석, 해금, 유물 칸, 저장과 다시 읽기, 망가진 값, 잠긴 직전 선택, 도감 기록, 기록 지우기.
// 블록마다 빈 저장소(memoryStorage)와 초기 기록에서 시작해 위 시험의 기록에 기대지 않는다
vm.runInContext(`{
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const stored = () => JSON.parse(localStorage.data['dungeonGuard.meta']);
// 창을 새로 연 것처럼: 기록과 직전 선택을 저장소(없으면 빈 저장소)에서 다시 읽는다
const freshWindow = storage => {
    globalThis.localStorage = storage || memoryStorage();
    Meta.load();
    UI.loadout = null;
    UI.collection = null;
    UI.unlockFocus = null;
    Game.state = 'title';
};
// 선택 화면에서 판을 시작해 막은 웨이브 수(waves)로 끝낸다
const playRun = (waves, victory) => {
    Game.state = 'title';
    btn('start');
    btn('begin');
    Game.waveIndex = victory ? WAVES.length - 1 : waves;
    if (victory) Game.finish(true);
    else { Game.hp = 1; damageThrone(1); }
    assert(Game.state === (victory ? 'victory' : 'defeat'));
    return Game.runResult;
};

// ----- 표 -----
same(META_RULES, { soulsPerWave: 2, winBonus: 15, relicSlots: { start: 1, prices: [30, 80] } }, 'meta rules');
same(Object.values(DEMON_LORDS).map(l => [l.id, l.unlock]), [['rift', 0], ['bone_queen', 20], ['gold_king', 20]], 'lord prices');
same(Object.fromEntries(Object.values(RELICS).map(r => [r.id, r.unlock])), {
    pouch: 0, chalice: 0, hourglass: 14, candle: 8, tablet: 8, handgem: 14, drum: 8, horn: 0,
    key: 14, heart: 0, bottle: 14, eye: 8, banner: 14, dice: 8, shackles: 14, mirror: 14 }, 'relic prices');
assert.strictEqual(DEMON_LORDS[DEFAULT_LORD].unlock, 0, 'default lord is free');
assert.strictEqual(Meta.maxSlots(), 3);

// ----- 첫 실행: 균열의 군주, 유물 pouch·chalice·horn·heart, 유물 칸 1개, 영혼석 0 -----
freshWindow();
same(Meta.data, Meta.fresh(), 'empty storage: fresh record');
same(Object.keys(DEMON_LORDS).filter(id => Meta.hasLord(id)), ['rift'], 'lords at start');
same(Object.keys(RELICS).filter(id => Meta.hasRelic(id)), ['pouch', 'chalice', 'horn', 'heart'], 'relics at start');
assert(Meta.relicSlots() === 1 && Meta.slotPrice() === 30 && Meta.data.souls === 0);
assert(!Meta.hasLord('nope') && !Meta.hasRelic('toString') && Meta.price('lord', 'toString') === null, 'unknown ids');
btn('start');
assert.strictEqual(Game.state, 'select');
assert(btnOf('lord_rift').locked === false && btnOf('lord_bone_queen').locked && btnOf('lord_gold_king').locked, 'locked lords');
assert.strictEqual(UI.buttons.filter(b => b.relicId && b.locked).length, 12, 'twelve locked relics');
// 잠긴 칸 자리: 2번째는 칸 사기 버튼(영혼석 30, 꺼짐), 3번째는 잠긴 칸
assert(hasBtn('picked0') && !hasBtn('picked1') && hasBtn('buy_slot') && hasBtn('slotLocked2'), 'slot buttons');
assert(btnOf('buy_slot').slotBuy === 30 && btnOf('buy_slot').disabled, 'slot buy disabled without souls');
assert(hasBtn('collection'), 'collection from select');

// ----- 모자랄 때 거절: 눌러도 바로 사지 않고 해금 버튼이 나온다. 꺼진 버튼을 눌러도 사지 않는다 -----
assert(!hasBtn('unlock'), 'no unlock button before tapping a locked card');
btn('lord_bone_queen');
assert.strictEqual(UI.loadout.lord, 'rift', 'locked lord not picked');
same(UI.unlockFocus, { kind: 'lord', id: 'bone_queen' });
{
    const u = btnOf('unlock');
    assert(u && u.disabled && u.sub.includes('20') && u.label.includes('20'), 'disabled unlock shows price and shortfall');
}
UI.toast = null;
btn('unlock');
assert(!Meta.hasLord('bone_queen') && Meta.data.souls === 0 && UI.toast.text.includes('20'), 'refused when short');
same(Meta.buy('relic', 'eye'), { ok: false, reason: 'souls', need: 8 });
same(Meta.buySlot(), { ok: false, reason: 'souls', need: 30 });
same(Meta.buy('relic', 'pouch'), { ok: false, reason: 'owned' });
same(Meta.buy('lord', 'nope'), { ok: false, reason: 'unknown' });
UI.onKey('Escape');
assert(UI.unlockFocus === null && !hasBtn('unlock'), 'Esc closes the unlock button');
// 잠긴 유물을 누르면 넣지 않고 해금 버튼을 띄운다
btn('relic_eye');
same(UI.loadout.relics, [], 'locked relic not picked');
assert(UI.unlockFocus.id === 'eye' && btnOf('unlock').disabled);
btn('relic_pouch');
assert(UI.unlockFocus === null && UI.loadout.relics.join() === 'pouch', 'unlocked relic still works');

// ----- 영혼석: 막은 웨이브 x2, 승리 +15. 결과 화면에 받은 양과 새 기록 -----
assert(Meta.soulsFor(0, false) === 0 && Meta.soulsFor(4, false) === 8 && Meta.soulsFor(WAVES.length, true) === WAVES.length * 2 + 15, 'souls formula');
{
    const r0 = playRun(0, false);
    same(r0, { souls: 0, total: 0, waves: 0, bestWave: false, firstWin: false }, 'no wave cleared');
    const r1 = playRun(4, false);
    same(r1, { souls: 8, total: 8, waves: 4, bestWave: true, firstWin: false }, 'four waves');
    const r2 = playRun(2, false);
    assert(r2.souls === 4 && r2.total === 12 && !r2.bestWave, 'not a new best');
    // 판이 끝난 뒤 다시 끝내도 한 번만 받는다
    Game.finish(false);
    damageThrone(1);
    assert.strictEqual(Meta.data.souls, 12, 'paid once per run');
    const r3 = playRun(0, true);
    same(r3, { souls: WAVES.length * 2 + 15, total: 12 + WAVES.length * 2 + 15, waves: WAVES.length, bestWave: true, firstWin: true }, 'victory');
    const r4 = playRun(0, true);
    assert(!r4.firstWin && !r4.bestWave, 'second win is not new');
    assert(Meta.data.runs === 5 && Meta.data.wins === 2 && Meta.data.bestWave === WAVES.length, 'run records');
    same(stored(), Meta.data, 'saved after each run');
    assert.strictEqual(stored().version, 1, 'version saved');
}
assert.strictEqual(Meta.data.souls, 82);

// ----- 해금과 잔액 차감 -----
btn('retry');
btn('lord_gold_king');
btn('unlock');
assert(Meta.hasLord('gold_king') && Meta.data.souls === 62 && UI.loadout.lord === 'gold_king' && UI.unlockFocus === null, 'lord bought and picked');
btn('relic_shackles');
btn('unlock');
assert(Meta.hasRelic('shackles') && Meta.data.souls === 48 && UI.loadout.relics.join() === 'shackles', 'relic bought and put in the only slot');
// 유물 칸 사기: 30 → 2칸, 다음 80은 모자라 꺼진다
btn('buy_slot');
assert(Meta.relicSlots() === 2 && Meta.data.souls === 18, 'second slot');
assert(hasBtn('picked1') && btnOf('buy_slot').slotBuy === 80 && btnOf('buy_slot').disabled && !hasBtn('slotLocked2'), 'third slot locked');
btn('buy_slot');
assert(Meta.relicSlots() === 2 && Meta.data.souls === 18, 'refused when short');
btn('relic_dice');
btn('unlock');
same(UI.loadout.relics, ['shackles', 'dice'], 'bought relic fills the free slot');
assert.strictEqual(Meta.data.souls, 10);
same(stored().lords, ['gold_king']);
same(stored().relics, ['shackles', 'dice']);
assert.strictEqual(stored().slots, 2);
// 산 것으로 시작하면 효과가 붙는다
btn('begin');
assert(Game.lord === 'gold_king' && Game.relics.join() === 'shackles,dice' && Game.summonCost() === 20, 'bought loadout applies');
// 칸 최대치: 3번째 칸까지 사면 더 살 수 없다
Meta.data.souls = 200;
assert(Meta.buySlot().ok && Meta.relicSlots() === 3 && Meta.data.souls === 120, 'third slot 80');
same(Meta.buySlot(), { ok: false, reason: 'max' }, 'max three slots');
assert(Meta.slotPrice() === null);
Game.hp = 1;
damageThrone(1);
btn('retry');
assert(['picked0', 'picked1', 'picked2'].every(hasBtn) && !hasBtn('buy_slot') && !UI.buttons.some(b => b.lockedSlot), 'three owned slots');

// ----- 저장과 다시 읽기: 창을 새로 열어도 그대로 -----
{
    const before = JSON.stringify(Meta.data);
    freshWindow(localStorage);
    assert.strictEqual(JSON.stringify(Meta.data), before, 'reloaded record');
    btn('start');
    same(UI.loadout, { lord: 'gold_king', relics: ['shackles', 'dice'] }, 'saved loadout with bought items');
}

// ----- 잠긴 직전 선택은 기본값으로: 기록이 없고 직전 선택만 남은 경우 -----
{
    const storage = memoryStorage();
    storage.data['dungeonGuard.loadout'] = JSON.stringify({ lord: 'bone_queen', relics: ['bottle', 'pouch', 'eye'] });
    freshWindow(storage);
    btn('start');
    same(UI.loadout, { lord: 'rift', relics: ['pouch'] }, 'locked lord and relics reset to defaults');
    btn('begin');
    assert(Game.lord === 'rift' && Game.relics.join() === 'pouch', 'game uses the cleaned loadout');
    // Game.reset에 잠긴 것을 바로 넘겨도 쓰지 않는다
    Game.reset({ lord: 'gold_king', relics: ['bottle'] });
    assert(Game.lord === 'rift' && Game.relics.length === 0, 'reset ignores locked items');
}

// ----- 망가진 값: 고쳐 쓰고 모르는 id는 버린다 -----
for (const [raw, want] of [
    ['not json', {}],
    ['null', {}],
    ['[1,2]', {}],
    ['"x"', {}],
    [JSON.stringify({ version: 1, souls: -5, lords: ['gold_king', 'nope', 'gold_king', 'toString'], relics: 'eye', slots: 99,
        seen: ['orc_guard', 'toString', 7], recipes: ['bad', 'orc_berserker+skeleton_archer', 'orc_berserker+skeleton_archer'],
        runs: '3', wins: 5, bestWave: 999, extra: 1 }),
        { lords: ['gold_king'], slots: 3, seen: ['orc_guard'], recipes: ['orc_berserker+skeleton_archer'], bestWave: WAVES.length }],
    [JSON.stringify({ souls: 12.7, slots: 0, runs: 4, wins: 2, bestWave: 3.5 }), { souls: 12, runs: 4, wins: 2, bestWave: 3 }],
    [JSON.stringify({ souls: Infinity, slots: 2, runs: 1, wins: 9 }), { slots: 2, runs: 1, wins: 1 }]
]) {
    const storage = memoryStorage();
    storage.data['dungeonGuard.meta'] = raw;
    freshWindow(storage);
    same(Meta.data, Object.assign(Meta.fresh(), want), 'clean ' + raw);
    btn('start');
    btn('begin');
    assert(Game.state === 'prep', 'plays with ' + raw);
}

// ----- 저장소 예외와 저장소가 없을 때(file://): 초기값으로 돌고, 이번 창에서는 기록이 남는다 -----
for (const storage of [brokenStorage, undefined]) {
    if (storage) globalThis.localStorage = storage;
    else delete globalThis.localStorage;
    Meta.load();
    same(Meta.data, Meta.fresh(), 'fresh without storage');
    UI.loadout = null;
    Game.state = 'title';
    btn('start');
    btn('begin');
    Game.waveIndex = WAVES.length - 1;
    Game.finish(true);
    assert(Game.runResult.souls === Meta.soulsFor(WAVES.length, true) && Meta.data.souls === Game.runResult.souls, 'souls kept in memory');
    assert(Meta.buy('lord', 'bone_queen').ok && Meta.hasLord('bone_queen'), 'buy works in memory');
    Meta.wipe();
    same(Meta.data, Meta.fresh(), 'wipe works without storage');
}

// ----- 몬스터와 히든 기록: 소환, 합치기, 보스 보상으로 본 몬스터와 찾은 조합식이 한 번씩 남는다 -----
freshWindow();
Game.reset();
Game.gold = 9999;
assert.strictEqual(withRandom([0, 0, 0], () => Game.summon()).type, 'orc_guard');
assert(Meta.hasSeen('orc_guard') && Meta.data.seen.length === 1, 'summon records');
withRandom([0, 0, 0], () => Game.summon());
assert.strictEqual(Meta.data.seen.length, 1, 'seen once');
// 시험 도구의 place는 기록하지 않는다
const freeCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
const a = Game.place('orc_berserker', ...freeCell());
const b = Game.place('skeleton_archer', ...freeCell());
assert(!Meta.hasSeen('orc_berserker') && !Meta.hasSeen('skeleton_archer'), 'place is not recorded');
let res = Game.merge({ monster: a }, { monster: b });
assert(res.ok && res.hidden && res.discovered && Meta.hasSeen('bone_knight'), 'hidden merge records');
same(Meta.data.recipes, ['orc_berserker+skeleton_archer']);
// 다시 찾아도 기록은 한 번, 발견 연출도 다시 나오지 않는다(지금 동작 그대로)
Fx.discovery = null;
res = Game.merge({ monster: Game.place('skeleton_archer', ...freeCell()) }, { monster: Game.place('orc_berserker', ...freeCell()) });
assert(res.ok && res.hidden && !res.discovered && Fx.discovery === null, 'second find: no fanfare');
same(Meta.data.recipes, ['orc_berserker+skeleton_archer'], 'recipe recorded once');
// 공개 조합식도 찾은 기록에 남는다(도감에서 전설 결과를 가리는 데 쓴다)
res = Game.merge({ monster: Game.place('skeleton_archer', ...freeCell()) }, { monster: Game.place('dark_mage', ...freeCell()) });
assert(res.ok && !res.hidden && Meta.hasRecipe(MONSTER_RECIPES[0]) && Meta.hasSeen('curse_shooter'), 'public recipe recorded');
// 보스 보상 몬스터
Game.bossReward = { cards: [{ kind: 'monster', type: 'dark_mage' }] };
assert(Game.pickBossReward(0).ok && Meta.hasSeen('dark_mage'), 'boss reward records');
same(stored().seen, ['orc_guard', 'bone_knight', 'curse_shooter', 'dark_mage'], 'seen saved');
// 다시 열어도 남는다
freshWindow(localStorage);
assert(Meta.hasSeen('bone_knight') && Meta.hasRecipe(MONSTER_RECIPES[3]), 'records survive reload');

// ----- 도감 화면: 타이틀과 선택 화면에서 연다. 탭 3개, 표를 읽어 칸을 만든다 -----
btn('collection');
assert(UI.collection && UI.collection.tab === 'monster' && Game.state === 'title', 'opened from title');
assert(['col_tab_monster', 'col_tab_recipe', 'col_tab_record', 'col_close'].every(hasBtn) && !hasBtn('start'), 'collection buttons');
assert.strictEqual(UI.collectionCells().length, Object.keys(MONSTERS).length, 'one cell per monster');
assert(!hasBtn('col_prev') && UI.collectionPages('monster') === 1, 'no paging while it fits');
UI.onKey('Space');
assert(Game.state === 'title' && UI.collection, 'Space does not start while the collection is open');
btn('col_tab_recipe');
assert.strictEqual(UI.collectionCells().length, MONSTER_RECIPES.length, 'one row per recipe');
UI.onKey('Digit3');
assert.strictEqual(UI.collection.tab, 'record', 'key 3');
assert(hasBtn('col_wipe'), 'wipe button on the record tab');
UI.onKey('Escape');
assert(UI.collection === null && hasBtn('start'), 'Esc closes');
// 쪽 넘김: 몬스터가 칸보다 많아지면 쪽이 생긴다(표에 줄을 더해 본다)
{
    const extra = [];
    for (let i = 0; i < 10; i++) {
        const id = 'test_mon_' + i;
        MONSTERS[id] = Object.assign({}, MONSTERS.orc_guard, { id, name: id });
        extra.push(id);
    }
    btn('collection');
    assert.strictEqual(UI.collectionPages('monster'), 2, 'two pages');
    assert(hasBtn('col_prev') && hasBtn('col_next') && btnOf('col_prev').disabled, 'page buttons');
    btn('col_next');
    assert(UI.collection.page === 1 && UI.collectionCells().length === Object.keys(MONSTERS).length - 12, 'second page');
    btn('col_next');
    assert.strictEqual(UI.collection.page, 1, 'stops at the last page');
    UI.onKey('ArrowLeft');
    assert.strictEqual(UI.collection.page, 0);
    for (const id of extra) delete MONSTERS[id];
    UI.closeCollection();
}

// ----- 기록 지우기: 두 번 눌러야 지우고, 지운 뒤 바로 처음 상태 -----
{
    Meta.data.souls = 50;
    assert(Meta.buy('lord', 'bone_queen').ok && Meta.buy('relic', 'eye').ok);
    Game.state = 'title';
    btn('start');
    btn('lord_bone_queen');
    btn('relic_eye');
    same(UI.loadout, { lord: 'bone_queen', relics: ['eye'] });
    btn('collection');
    assert(UI.collection && Game.state === 'select', 'opened from select');
    btn('col_tab_record');
    btn('col_wipe');
    assert(Meta.hasLord('bone_queen') && UI.wipeArmed > 0, 'first press only arms');
    // 시간이 지나면 다시 두 번 눌러야 한다
    UI.update(WIPE_ARM_TIME + 0.1);
    btn('col_wipe');
    assert(Meta.hasLord('bone_queen'), 'expired arm does not wipe');
    btn('col_wipe');
    same(Meta.data, Meta.fresh(), 'wiped');
    same(stored(), Meta.fresh(), 'wiped in storage');
    same(UI.loadout, { lord: 'rift', relics: [] }, 'loadout back to defaults');
    assert(UI.collection.tab === 'record' && UI.toast.text.includes('지웠'), 'stays on the record tab');
    UI.onKey('Escape');
    assert(btnOf('lord_bone_queen').locked && btnOf('buy_slot').slotBuy === 30, 'select screen back to the first state');
}

delete globalThis.localStorage;
Meta.data = Meta.fresh();
console.log('smoke ok: meta collection');
}`, ctx, { filename: 'smoke-meta' });
