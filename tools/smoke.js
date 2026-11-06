// 클릭 흐름 자동 시험: 화면 없이 실제 입력 함수를 호출해 한 판을 끝까지 진행한다. 실행: node tools/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/monsters.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/game.js', 'js/ui/ui.js'];
const ctx = vm.createContext({ console, assert, Math, Set, Object, Array, Infinity, Number, String, JSON,
    Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
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
const benchXY = i => { const r = UI.benchRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; };
const cellXY = (c, r) => [tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM];
const monXY = m => [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
// Math.random을 고정한다. 배열이면 부를 때마다 차례로 돌려준다
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? list.shift() : v);
    try { return fn(); } finally { Math.random = old; }
};
const benchIs = (...types) => assert.strictEqual(Game.bench.map(t => t || '-').join(), types.join(), 'bench ' + Game.bench.join());

// 시작
assert.strictEqual(Game.state, 'title');
btn('start');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
// 시작 골드는 그대로(130)이고 소환(40G)을 세 번 할 수 있다
assert.strictEqual(SUMMON_RULES.cost, 40);
assert(Math.floor(COMBAT_RULES.startGold / SUMMON_RULES.cost) >= 3, 'start gold allows 3 summons');

// 몬스터 탭: 소환 버튼과 빈 대기 칸 5개. 예전 몬스터 슬롯과 스킬 슬롯은 없다
assert.strictEqual(UI.tab, 'monster');
assert(hasBtn('summon'));
for (let i = 0; i < 5; i++) assert(hasBtn('bench_' + i), 'bench slot ' + i);
assert(!hasBtn('bench_5') && !hasBtn('place_orc_guard'));
assert(!hasBtn('lightning') && !hasBtn('roar'));
benchIs('-', '-', '-', '-', '-');

// 탭 전환: 클릭과 Tab 키
btn('tab_demon');
assert.strictEqual(UI.tab, 'demon');
assert(hasBtn('lightning') && hasBtn('roar') && !hasBtn('summon') && !hasBtn('bench_0'));
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');

// 빈 길 옆 칸을 누르면 소환하라는 안내만 뜬다
UI.toast = null;
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 0);
assert(UI.toast && UI.toast.text.includes('소환'), 'empty cell hint');

// 몬스터 표와 확률 데이터: 6종, 일반 70% 희귀 25% 영웅 5%, 전설은 비어 있다
assert.strictEqual(Object.keys(MONSTERS).join(), 'orc_guard,skeleton_archer,dark_mage,orc_berserker,curse_shooter,bone_knight');
assert.strictEqual(SUMMON_RULES.odds.common, 0.70);
assert.strictEqual(SUMMON_RULES.odds.rare, 0.25);
assert.strictEqual(SUMMON_RULES.odds.epic, 0.05);
assert(!SUMMON_RULES.odds.legendary && gradePool('legendary').length === 0, 'no legendary yet');
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

// 소환: 버튼과 S 키. 40골드를 내고 빈 대기 칸 앞에서부터 채운다
withRandom([0.1, 0.1], () => btn('summon'));
benchIs('orc_guard', '-', '-', '-', '-');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 40);
assert.strictEqual(Game.stats.summoned, 1);
assert(Fx.pops.some(p => p.kind === 'summon' && p.to.bench === 0 && p.grade === 'common'), 'summon effect');
withRandom([0.5, 0.5], () => UI.onKey('KeyS'));
withRandom([0.1, 0.9], () => UI.onKey('KeyS'));
benchIs('orc_guard', 'skeleton_archer', 'dark_mage', '-', '-');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 120);
// 골드가 모자라면 소환하지 않고 안내한다
UI.toast = null;
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').disabled, 'summon dimmed without gold');
UI.onKey('KeyS');
benchIs('orc_guard', 'skeleton_archer', 'dark_mage', '-', '-');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 120);
assert(UI.toast && UI.toast.text.includes('골드'), 'gold toast');
// 대기 칸이 가득 차면 소환할 수 없다고 안내한다
Game.gold = 1000;
withRandom([0.1, 0.1], () => UI.onKey('KeyS'));
withRandom([0.5, 0.5], () => UI.onKey('KeyS'));
benchIs('orc_guard', 'skeleton_archer', 'dark_mage', 'orc_guard', 'skeleton_archer');
assert.strictEqual(Game.gold, 1000 - 80);
UI.toast = null;
btn('summon');
assert.strictEqual(Game.gold, 1000 - 80, 'no gold spent when full');
assert(UI.toast && UI.toast.text.includes('가득'), 'bench full toast');
assert.strictEqual(Game.summon().reason, 'full');
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').full, 'summon button shows full');
// 희귀·영웅 소환 연출은 등급을 따른다
Game.bench[4] = null;
withRandom([0.97, 0], () => UI.onKey('KeyS'));
assert.strictEqual(Game.bench[4], 'bone_knight');
assert(Fx.pops.some(p => p.kind === 'summon' && p.grade === 'epic'), 'epic summon effect');
Game.bench[4] = 'skeleton_archer';

// 대기 칸을 누르면(끌지 않고 떼면) 정보 팝업: 공개 조합식과 판매가 나오고 강화 버튼은 없다
click(...benchXY(2));
assert.strictEqual(UI.selectedBench, 2);
UI.update(0);
assert(UI.popup && UI.popup.type === 'dark_mage');
assert.strictEqual(UI.popup.recipes.map(r => r.partner + '>' + r.result).join(), 'skeleton_archer>curse_shooter,orc_guard>orc_berserker');
assert(hasBtn('sell') && !hasBtn('up2') && !hasBtn('up3A'), 'sell only, upgrade hidden');
assert.strictEqual(MONSTER_UPGRADE_ENABLED, false);
// 고른 몬스터와 합칠 수 있는 대상: 조합식이면 결과, 같은 등급이면 다음 등급
assert.strictEqual(UI.shownPlan('dark_mage', 'skeleton_archer').result, 'curse_shooter');
assert.strictEqual(UI.shownPlan('dark_mage', 'dark_mage').grade, 'rare');
// 히든 조합식은 미리 보이지 않는다: 공개 목록에 없고, 화면에는 등급 합치기로만 보인다
assert(!publicRecipesFor('orc_guard').some(r => r.partner === 'skeleton_archer'), 'hidden recipe not listed');
assert.strictEqual(UI.shownPlan('orc_guard', 'skeleton_archer').kind, 'grade');
assert.strictEqual(mergePlan('orc_guard', 'skeleton_archer').kind, 'recipe');
click(...benchXY(2)); // 같은 칸을 다시 누르면 닫는다
assert.strictEqual(UI.selectedBench, null);

// 끌기를 시작하면 놓을 칸 미리보기가 나온다. 길 칸은 빨간색, 길 옆 칸은 놓을 수 있다
UI.onMove(...benchXY(1));
UI.onDown(...benchXY(1));
assert(!UI.drag, 'press alone is not a drag');
UI.onMove(benchXY(1)[0] + 4, benchXY(1)[1] - 4);
assert(!UI.drag, 'tiny move is not a drag');
UI.onMove(...cellXY(2, 3));
assert(UI.drag && UI.drag.type === 'skeleton_archer', 'dragging');
assert(UI.hoverCell && UI.hoverCell.col === 2 && UI.hoverCell.row === 3);
assert(!UI.canPlaceAt(2, 3), 'path cell is red');
UI.onMove(...cellXY(3, 4));
assert(UI.canPlaceAt(3, 4), 'build cell ok');
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'place');
// Esc로 끌기를 그만두면 대기 칸에 그대로 남는다
UI.onKey('Escape');
assert(!UI.drag);
UI.onUp(...cellXY(3, 4));
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(Game.bench[1], 'skeleton_archer');

// 놓을 수 없는 곳에 놓으면 안내하고 대기 칸으로 돌아간다: 길 칸, 건설 칸이 아닌 곳, 하단 바
UI.toast = null;
dragTo(benchXY(1), cellXY(2, 3));
assert.strictEqual(Game.monsters.length, 0, 'not on path');
assert.strictEqual(Game.bench[1], 'skeleton_archer', 'back to bench');
assert(UI.toast && UI.toast.text.includes('길'), 'path toast');
assert(UI.returning.length > 0, 'fly back effect');
UI.toast = null;
dragTo(benchXY(1), cellXY(12, 12));
assert(!isBuildCell(12, 12) && Game.monsters.length === 0 && Game.bench[1] === 'skeleton_archer');
assert(UI.toast && UI.toast.text.includes('길 옆'), 'not build cell toast');
dragTo(benchXY(1), [BAR_SLOT_X + 20, GAME_HEIGHT - 40]);
assert.strictEqual(Game.bench[1], 'skeleton_archer', 'dropped on bar');

// 끌어 설치: 비용 없이 놓이고 대기 칸이 빈다
const goldBeforeDeploy = Game.gold;
dragTo(benchXY(1), cellXY(3, 4));
const archer1 = Game.monsterAt(3, 4);
assert(archer1 && archer1.type === 'skeleton_archer', 'deployed');
assert.strictEqual(Game.bench[1], null);
assert.strictEqual(Game.gold, goldBeforeDeploy, 'deploy is free');
// 이미 몬스터가 있는 칸 위에 놓으면 합치기로 본다(일반끼리라 등급 합치기 미리보기)
UI.onMove(...benchXY(4));
UI.onDown(...benchXY(4));
UI.onMove(...monXY(archer1));
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'merge');
UI.cancel();
UI.onUp(...monXY(archer1));
// 대기 칸끼리 옮기기: 빈 칸으로
dragTo(benchXY(4), benchXY(1));
benchIs('orc_guard', 'skeleton_archer', 'dark_mage', 'orc_guard', '-');

// 끌어 옮기기: 맵의 몬스터를 다른 빈 길 옆 칸으로. 원래 칸은 빈다
dragTo(monXY(archer1), cellXY(5, 4));
assert.strictEqual(Game.monsterAt(5, 4), archer1, 'moved');
assert.strictEqual(Game.monsterAt(3, 4), null, 'old cell freed');
assert(archer1.x === tileX(5) && archer1.homeY === tileY(4));
// 길로는 옮길 수 없고 제자리에 남는다
UI.toast = null;
dragTo(monXY(archer1), cellXY(6, 7));
assert.strictEqual(Game.monsterAt(5, 4), archer1, 'stays');
assert(UI.toast && UI.toast.text.includes('길'));
// 맵의 몬스터는 대기 칸으로 돌아가지 않는다
dragTo(monXY(archer1), benchXY(4));
assert(Game.monsterAt(5, 4) === archer1 && Game.bench[4] === null, 'field to bench refused');
// 맵의 몬스터를 누르면 정보 팝업
click(...monXY(archer1));
assert.strictEqual(UI.selectedMonster, archer1);
UI.update(0);
assert(UI.popup && UI.popup.monster === archer1 && hasBtn('sell') && !hasBtn('up2'));
UI.clearSelection();

// 조합식: 대기 칸의 암흑 마법사를 맵의 스켈레톤 궁수 위에 → 저주 사수가 궁수 자리에 남고 대기 칸이 빈다
Fx.pops = [];
dragTo(benchXY(2), monXY(archer1));
const shooter = Game.monsterAt(5, 4);
assert(shooter && shooter.type === 'curse_shooter', 'recipe result at target');
assert(archer1.removed && !Game.monsters.includes(archer1));
assert.strictEqual(Game.bench[2], null, 'source freed');
assert(shooter.reveal > 0, 'result appears after suck-in');
assert(Fx.pops.some(p => p.kind === 'merge' && p.type === 'curse_shooter' && p.grade === 'rare' && !p.hidden));
assert.strictEqual(Fx.discovery, null, 'public recipe: no discovery');
assert.strictEqual(Game.stats.merged, 1);
tick(0.5);
assert(!(shooter.reveal > 0), 'revealed');
// 순서는 상관없다: 맵 → 대기 칸 방향도 같은 결과(대기 칸에 남는다)
Game.bench[2] = 'dark_mage';
Game.place('skeleton_archer', 3, 4);
dragTo(monXY(Game.monsterAt(3, 4)), benchXY(2));
assert.strictEqual(Game.bench[2], 'curse_shooter', 'reverse order recipe into bench');
assert.strictEqual(Game.monsterAt(3, 4), null, 'field source freed');

// 히든 조합식: 오크 경비병 + 스켈레톤 궁수 → 해골 기사. 처음이면 "히든 조합 발견!"
Game.bench[1] = 'skeleton_archer';
dragTo(benchXY(0), benchXY(1));
assert.strictEqual(Game.bench[1], 'bone_knight', 'hidden recipe result');
assert.strictEqual(Game.bench[0], null);
assert(Fx.discovery && Fx.discovery.type === 'bone_knight', 'hidden discovered');
assert(Game.discovered.has('orc_guard+skeleton_archer'));
assert(Fx.pops.some(p => p.kind === 'merge' && p.hidden && p.grade === 'epic'));
tick(4.2);
assert.strictEqual(Fx.discovery, null);
// 두 번째부터는 발견 연출이 없다
Game.bench[0] = 'skeleton_archer';
Game.bench[4] = 'orc_guard';
dragTo(benchXY(4), benchXY(0));
assert.strictEqual(Game.bench[0], 'bone_knight');
assert.strictEqual(Fx.discovery, null, 'discovered only once');

// 영웅끼리는 합칠 수 없다: 안내하고 둘 다 그대로
UI.toast = null;
dragTo(benchXY(0), benchXY(1));
assert(Game.bench[0] === 'bone_knight' && Game.bench[1] === 'bone_knight', 'epic + epic refused');
assert(UI.toast && UI.toast.text.includes('최고 등급'));
assert.strictEqual(mergePlan('bone_knight', 'bone_knight').reason, 'top');

// 합칠 수 없는 경우: 등급이 다르고 조합식도 없다
UI.toast = null;
Game.bench[4] = 'skeleton_archer';
dragTo(benchXY(4), benchXY(0));
assert(Game.bench[4] === 'skeleton_archer' && Game.bench[0] === 'bone_knight', 'mismatch refused');
assert(UI.toast && UI.toast.text.includes('합칠 수 없'));
assert.strictEqual(mergePlan('skeleton_archer', 'curse_shooter').reason, 'mismatch');

// 등급 합치기: 같은 등급 2마리(조합식 없음) → 상위 등급 중 무작위. 대기 칸 → 맵
Game.bench[4] = 'orc_guard';
Game.bench[3] = 'orc_guard';
dragTo(benchXY(3), cellXY(3, 6));
const orcGuard = Game.monsterAt(3, 6);
assert(orcGuard && orcGuard.type === 'orc_guard');
withRandom(0.1, () => dragTo(benchXY(4), monXY(orcGuard)));
const berserker = Game.monsterAt(3, 6);
assert(berserker && berserker.type === 'orc_berserker', 'grade merge picks rare[0] with random 0.1');
assert(berserker.blocks && berserker.rally, 'berserker walks out to block');
assert.strictEqual(monsterStats(berserker).block, 2);
// 무작위 값이 크면 같은 등급의 다른 몬스터
Game.bench[3] = 'dark_mage';
Game.bench[4] = 'dark_mage';
withRandom(0.9, () => dragTo(benchXY(4), benchXY(3)));
assert.strictEqual(Game.bench[3], 'curse_shooter');
// 희귀 2마리 → 영웅(해골 기사뿐). 조합식(오크 광전사 + 저주 사수)도 같은 결과다. 맵끼리 합치기
dragTo(monXY(shooter), monXY(berserker));
const knight = Game.monsterAt(3, 6);
assert(knight && knight.type === 'bone_knight', 'field + field recipe');
assert.strictEqual(Game.monsterAt(5, 4), null);
assert.strictEqual(monsterStats(knight).hp, 500);
// 희귀 2마리, 조합식 없음 → 영웅 등급 합치기
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').kind, 'grade');
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').grade, 'epic');

// 판매: 등급별 고정 환불(일반 20, 희귀 60, 영웅 150). 대기 칸과 맵 모두
assert.strictEqual(SUMMON_RULES.refund.common, 20);
let g0 = Game.gold;
click(...benchXY(3)); // 저주 사수(희귀)
btn('sell');
assert.strictEqual(Game.gold, g0 + 60);
assert.strictEqual(Game.bench[3], null);
g0 = Game.gold;
click(...benchXY(0)); // 해골 기사(영웅)
btn('sell');
assert.strictEqual(Game.gold, g0 + 150);
g0 = Game.gold;
click(...monXY(knight));
assert.strictEqual(UI.selectedMonster, knight);
btn('sell');
assert.strictEqual(Game.gold, g0 + 150);
assert.strictEqual(Game.monsters.length, 0);
g0 = Game.gold;
Game.bench[3] = 'orc_guard';
click(...benchXY(3));
btn('sell');
assert.strictEqual(Game.gold, g0 + 20);
Game.bench.fill(null);
Game.gold = 2000;

// 모든 몬스터는 길 칸에 놓을 수 없다
assert(!Game.canPlace('orc_guard', 30, 30) && !Game.canPlace('skeleton_archer', 0, 0), 'off map rejected');
for (const key of PATH.cells) {
    const [c, r] = key.split(',').map(Number);
    for (const t of Object.keys(MONSTERS)) assert(!Game.canPlace(t, c, r), 'no monster on path ' + key);
}

// 근접 몬스터를 길 옆에 놓으면 가장 가까운 길 지점으로 걸어 나간다
Game.bench[0] = 'orc_guard';
dragTo(benchXY(0), cellXY(3, 4));
const orc = Game.monsterAt(3, 4);
assert(orc && orc.blocks && orc.rally, 'orc placed beside path');
assert.strictEqual(orc.x, tileX(3));
assert.strictEqual(orc.rally.d, nearestPathDistance(tileX(3), tileY(4)));
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
assert(orc.x === tileX(3) && orc.y === tileY(2) && orc.rally.d === nearestPathDistance(tileX(3), tileY(2)));
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
Game.bench[0] = 'skeleton_archer';
UI.onMove(...benchXY(0));
UI.onDown(...benchXY(0));
UI.onMove(...cellXY(7, 5));
assert(UI.drag && UI.tab === 'monster');
UI.onKey('KeyQ');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(UI.drag, null);
UI.onUp(...cellXY(7, 5));
assert.strictEqual(Game.bench[0], 'skeleton_archer');
assert.strictEqual(UI.targeting, true);
UI.onKey('KeyQ');
assert.strictEqual(UI.targeting, false);
btn('lightning');
assert.strictEqual(UI.targeting, true);
worldClick(tileX(4), tileY(5));
assert.strictEqual(UI.targeting, false);
assert.strictEqual(Game.skills.lightning, COMBAT_RULES.lightning.cooldown);
tick(0.5);

// 호통은 체력이 충분하면 막히고, 낮으면 쓸 수 있다. W도 마왕 탭으로 바꾼다
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');
UI.onKey('KeyW');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(Game.skills.roar, 0);
Game.hp = 8;
UI.onKey('KeyW');
assert.strictEqual(Game.skills.roar, COMBAT_RULES.roar.cooldown);
Game.hp = 20;

// 타락: 비용 차감, 부하 생성, 최대 인원 제한
Game.corpses.length = 0; // 전투로 생긴 시체가 클릭 위치에 겹치면 그쪽이 먼저 선택된다
Game.corpses.push({ type: 'warrior', female: false, x: tileX(4), y: tileY(5), d: 800, dir: 'down', age: 0, life: 5, cost: 15 });
const goldBefore = Game.gold;
worldClick(tileX(4), tileY(5) - 30);
assert.strictEqual(Game.gold, goldBefore - 15);
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 1);
for (let i = 0; i < 2; i++) corruptCorpse({ type: 'rogue', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 18 });
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 3);
assert.strictEqual(corruptCorpse({ type: 'mage', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 24 }).reason, 'limit');

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
    Object.assign(u, { x, y, homeX: x, homeY: y, rally: { d: nearestPathDistance(x, y), x, y }, hp: 9999, maxHp: 9999 });
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
    assert.strictEqual(boss.maxHp, knight.maxHp, 'same hp as fallen knight');
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

// 패배 후 다시 시작하면 모두 초기화
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(UI.tab, 'monster', 'retry starts on monster tab');
assert(Game.bench.length === SUMMON_RULES.benchSize && Game.bench.every(t => t === null), 'bench cleared');
assert.strictEqual(Game.units.length, 0);

// 한 판 끝까지: 보스 패턴 포함, 예외 없이 승리 화면까지 간다
Game.gold = 6000;
[[3,4,'skeleton_archer'],[5,5,'dark_mage'],[3,6,'orc_guard'],[7,6,'skeleton_archer'],[9,5,'dark_mage'],[9,2,'skeleton_archer'],[11,4,'orc_guard'],[13,5,'dark_mage'],[13,7,'dark_mage'],[15,7,'skeleton_archer'],[11,6,'dark_mage'],[15,5,'dark_mage'],
    // 길 뒤쪽: 돌진하는 보스를 붙잡을 오크와 마무리 화력
    [17,6,'orc_guard'],[19,8,'orc_guard'],[21,8,'orc_guard'],[19,6,'skeleton_archer'],[18,7,'dark_mage'],[21,5,'skeleton_archer']].forEach(([c,r,t]) => assert(Game.place(t,c,r), 'place ' + t + ' ' + c + ',' + r));
for (const x of Game.monsters) { Game.upgrade(x); Game.upgrade(x, 'A'); }
let guard = 0, sawCharge = false, sawStomp = false;
const eliteWaves = new Set();
while (Game.state !== 'victory' && Game.state !== 'defeat' && guard++ < 60000) {
    if (Game.state === 'prep') Game.startWave();
    UI.update(1 / 30);
    Game.update(1 / 30);
    if (Game.heroes.some(h => h.elite)) eliteWaves.add(Game.waveIndex);
    const b = Game.heroes.find(h => h.boss);
    if (b && b.chargeTime > 0) sawCharge = true;
    if (b && b.patternsDone[1]) sawStomp = true;
}
assert.strictEqual(Game.state, 'victory', 'wave ' + (Game.waveIndex + 1) + ' hp ' + Game.hp + ' heroes ' + Game.heroes.map(h => h.type + (h.boss ? 'B' : '') + ':' + Math.round(h.d)).join(' '));
assert(sawCharge && sawStomp, 'boss patterns fired');
assert.strictEqual(eliteWaves.size, WAVES.length - 2, 'elites appeared in waves 3..' + WAVES.length);
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });
