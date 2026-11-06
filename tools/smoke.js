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
const click = (x, y, shift) => { UI.onMove(x, y); UI.onClick(x, y, shift); };
const worldClick = (x, y, shift) => click(x * WORLD_ZOOM, y * WORLD_ZOOM, shift);
const cellClick = (c, r, shift) => worldClick(tileX(c), tileY(r), shift);
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btn = id => { UI.update(0); const b = UI.buttons.find(b => b.id === id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const tick = s => { for (let i = 0; i < s * 30; i++) { UI.update(1 / 30); Game.update(1 / 30); } };

// 시작
assert.strictEqual(Game.state, 'title');
btn('start');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);

// 시작은 몬스터 탭: 몬스터 슬롯 3개, 스킬 슬롯은 없다
assert.strictEqual(UI.tab, 'monster');
assert.strictEqual(MONSTER_SLOTS.join(), 'orc_guard,skeleton_archer,dark_mage');
assert(hasBtn('place_orc_guard') && hasBtn('place_skeleton_archer') && hasBtn('place_dark_mage'));
assert(!hasBtn('lightning') && !hasBtn('roar'));

// 탭 전환: 클릭과 Tab 키
btn('tab_demon');
assert.strictEqual(UI.tab, 'demon');
assert(hasBtn('lightning') && hasBtn('roar') && !hasBtn('place_skeleton_archer'));
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');
assert(hasBtn('place_skeleton_archer'));

// 슬롯 없이 빈 칸을 눌러도 건설 팝업은 뜨지 않는다
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(UI.placing, null);

// 건설 모드 취소: 같은 슬롯 다시 클릭, Esc, 우클릭(cancel), 마왕 탭 전환
btn('place_skeleton_archer');
assert.strictEqual(UI.placing, 'skeleton_archer');
btn('place_skeleton_archer');
assert.strictEqual(UI.placing, null, 'same slot cancels');
UI.onKey('Digit2');
assert.strictEqual(UI.placing, 'skeleton_archer');
UI.onKey('Escape');
assert.strictEqual(UI.placing, null, 'Esc cancels');
btn('place_skeleton_archer');
UI.cancel(); // main.js의 우클릭 처리
assert.strictEqual(UI.placing, null, 'right click cancels');
btn('place_skeleton_archer');
UI.onKey('Tab');
assert.strictEqual(UI.placing, null, 'leaving monster tab cancels');
UI.onKey('Tab');

// 길 칸에는 원거리 몬스터를 놓을 수 없고, 건설 모드는 이어진다
btn('place_skeleton_archer');
cellClick(2, 3);
assert.strictEqual(Game.monsters.length, 0, 'path cell must not place');
assert.strictEqual(UI.placing, 'skeleton_archer');
UI.onMove(tileX(2) * WORLD_ZOOM, tileY(3) * WORLD_ZOOM);
assert(UI.hoverCell && !UI.canPlaceAt(UI.hoverCell.col, UI.hoverCell.row), 'invalid hover cell');

// 스켈레톤 궁수를 길 옆에 놓는다: 놓으면 건설 모드가 끝난다
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 1);
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 50);
assert.strictEqual(UI.placing, null);

// 이미 몬스터가 있는 칸에는 못 놓는다
UI.onKey('Digit2');
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 1);
assert.strictEqual(UI.placing, 'skeleton_archer');
UI.onKey('Escape');

// 돈이 모자라면 슬롯이 꺼져 있고 건설 모드가 되지 않는다
assert(Game.gold < MONSTERS.dark_mage.cost);
UI.update(0);
assert(UI.buttons.find(b => b.id === 'place_dark_mage').disabled, 'crystal slot dimmed');
btn('place_dark_mage');
assert.strictEqual(UI.placing, null);
UI.onKey('Digit3');
assert.strictEqual(UI.placing, null);
assert(UI.toast, 'gold toast');

// Shift를 누른 채 놓으면 이어서 놓는다
Game.gold = 200;
UI.onKey('Digit1');
assert.strictEqual(UI.placing, 'orc_guard');
cellClick(5, 4, true);
assert.strictEqual(UI.placing, 'orc_guard', 'shift keeps build mode');
cellClick(5, 5, true);
assert.strictEqual(Game.monsters.length, 3);
assert.strictEqual(Game.gold, 200 - 140);
// 이어 놓다가 돈이 떨어지면 건설 모드가 끝난다
cellClick(3, 6, true);
assert.strictEqual(Game.monsters.length, 3);
assert.strictEqual(UI.placing, null);
for (const x of Game.monsters.slice(1)) Game.sell(x);
Game.gold = COMBAT_RULES.startGold - 50;

// 강화와 판매
const f = Game.monsterAt(3, 4);
worldClick(f.x, f.y);
assert.strictEqual(UI.selectedMonster, f);
Game.gold = 500;
btn('up2');
assert.strictEqual(f.tier, 2);
btn('up3B');
assert.strictEqual(f.tier, 3);
assert.strictEqual(f.branch, 'B');
assert.strictEqual(monsterStats(f).range, 5);
assert.strictEqual(monsterStats(f).damage, 8 * 1.5 * 3);
const before = Game.gold;
btn('sell');
assert.strictEqual(Game.gold, before + Math.floor((50 + 40 + 75) * 0.7));
assert.strictEqual(Game.monsters.length, 0);

// 근접 몬스터도 길 칸에는 놓을 수 없다: 칸이 빨갛게 표시되고 거부 안내가 뜬다
Game.gold = 2000;
UI.onKey('Digit1');
assert.strictEqual(UI.placing, 'orc_guard');
for (const [c, r] of [[2, 3], [4, 5], [6, 7]]) {
    assert(isPathCell(c, r));
    UI.toast = null;
    cellClick(c, r, true);
    assert.strictEqual(Game.monsters.length, 0, 'melee must not stand on path cell ' + c + ',' + r);
    assert(UI.toast && UI.toast.text.includes('길'), 'path reject toast');
    UI.onMove(tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM);
    assert(!UI.canPlaceAt(UI.hoverCell.col, UI.hoverCell.row), 'path cell hover is red');
}
assert(!Game.canPlace('orc_guard', 30, 30) && !Game.canPlace('skeleton_archer', 0, 0), 'off map rejected');
for (const key of PATH.cells) {
    const [c, r] = key.split(',').map(Number);
    for (const t of MONSTER_SLOTS) assert(!Game.canPlace(t, c, r), 'no monster on path ' + key);
}

// 근접 몬스터를 길 옆에 놓으면 가장 가까운 길 지점으로 걸어 나간다
cellClick(3, 4);
assert.strictEqual(UI.placing, null);
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

// 강화·판매 창: 놓은 칸을 눌러도, 길로 나간 몬스터를 눌러도 뜬다
UI.clearSelection();
cellClick(3, 4);
assert.strictEqual(UI.selectedMonster, orc, 'click home cell');
UI.clearSelection();
worldClick(orc.x, orc.y - 10);
assert.strictEqual(UI.selectedMonster, orc, 'click walked-out monster');
UI.update(0);
assert(UI.popup && UI.popup.monster === orc);
UI.clearSelection();

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

// 번개: Q는 몬스터 탭에서도 동작하고 마왕 탭으로 바꾼다. 건설 모드는 끝난다
UI.onKey('Digit2');
assert.strictEqual(UI.tab, 'monster');
assert.strictEqual(UI.placing, 'skeleton_archer');
UI.onKey('KeyQ');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(UI.placing, null);
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

// 패배 후 다시 시작하면 모두 초기화
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(UI.tab, 'monster', 'retry starts on monster tab');
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
    if (b && b.stomped) sawStomp = true;
}
assert.strictEqual(Game.state, 'victory', 'wave ' + (Game.waveIndex + 1) + ' hp ' + Game.hp + ' heroes ' + Game.heroes.map(h => h.type + (h.boss ? 'B' : '') + ':' + Math.round(h.d)).join(' '));
assert(sawCharge && sawStomp, 'boss patterns fired');
assert.strictEqual(eliteWaves.size, WAVES.length - 2, 'elites appeared in waves 3..' + WAVES.length);
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });
