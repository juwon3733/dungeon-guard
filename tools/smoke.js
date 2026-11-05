// 클릭 흐름 자동 시험: 화면 없이 실제 입력 함수를 호출해 한 판을 끝까지 진행한다. 실행: node tools/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/facility.js', 'js/game/unit.js', 'js/game/game.js', 'js/ui/ui.js'];
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

// 시작은 타워 탭: 시설 슬롯 3개, 스킬 슬롯은 없다
assert.strictEqual(UI.tab, 'tower');
assert(hasBtn('build_archer') && hasBtn('build_crystal') && hasBtn('build_barracks'));
assert(!hasBtn('lightning') && !hasBtn('roar'));

// 탭 전환: 클릭과 Tab 키
btn('tab_demon');
assert.strictEqual(UI.tab, 'demon');
assert(hasBtn('lightning') && hasBtn('roar') && !hasBtn('build_archer'));
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'tower');
assert(hasBtn('build_archer'));

// 슬롯 없이 빈 칸을 눌러도 건설 팝업은 뜨지 않는다
cellClick(3, 4);
assert.strictEqual(Game.facilities.length, 0);
assert.strictEqual(UI.placing, null);

// 건설 모드 취소: 같은 슬롯 다시 클릭, Esc, 우클릭(cancel), 마왕 탭 전환
btn('build_archer');
assert.strictEqual(UI.placing, 'archer');
btn('build_archer');
assert.strictEqual(UI.placing, null, 'same slot cancels');
UI.onKey('Digit1');
assert.strictEqual(UI.placing, 'archer');
UI.onKey('Escape');
assert.strictEqual(UI.placing, null, 'Esc cancels');
btn('build_archer');
UI.cancel(); // main.js의 우클릭 처리
assert.strictEqual(UI.placing, null, 'right click cancels');
btn('build_archer');
UI.onKey('Tab');
assert.strictEqual(UI.placing, null, 'leaving tower tab cancels');
UI.onKey('Tab');

// 길 위와 벽은 지을 수 없고, 건설 모드는 이어진다
btn('build_archer');
cellClick(2, 3);
assert.strictEqual(Game.facilities.length, 0, 'path cell must not build');
assert.strictEqual(UI.placing, 'archer');
UI.onMove(tileX(2) * WORLD_ZOOM, tileY(3) * WORLD_ZOOM);
assert(UI.hoverCell && !UI.canPlaceAt(UI.hoverCell.col, UI.hoverCell.row), 'invalid hover cell');

// 궁수탑 건설: 지으면 건설 모드가 끝난다
cellClick(3, 4);
assert.strictEqual(Game.facilities.length, 1);
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 50);
assert.strictEqual(UI.placing, null);

// 이미 지은 칸에는 못 짓는다
UI.onKey('Digit1');
cellClick(3, 4);
assert.strictEqual(Game.facilities.length, 1);
assert.strictEqual(UI.placing, 'archer');
UI.onKey('Escape');

// 돈이 모자라면 슬롯이 꺼져 있고 건설 모드가 되지 않는다
assert(Game.gold < FACILITIES.crystal.cost);
UI.update(0);
assert(UI.buttons.find(b => b.id === 'build_crystal').disabled, 'crystal slot dimmed');
btn('build_crystal');
assert.strictEqual(UI.placing, null);
UI.onKey('Digit2');
assert.strictEqual(UI.placing, null);
assert(UI.toast, 'gold toast');

// Shift를 누른 채 지으면 이어서 짓는다
Game.gold = 200;
UI.onKey('Digit3');
assert.strictEqual(UI.placing, 'barracks');
cellClick(5, 4, true);
assert.strictEqual(UI.placing, 'barracks', 'shift keeps build mode');
cellClick(5, 5, true);
assert.strictEqual(Game.facilities.length, 3);
assert.strictEqual(Game.gold, 200 - 140);
// 이어 짓다가 돈이 떨어지면 건설 모드가 끝난다
cellClick(3, 6, true);
assert.strictEqual(Game.facilities.length, 3);
assert.strictEqual(UI.placing, null);
for (const x of Game.facilities.slice(1)) Game.sell(x);
Game.gold = COMBAT_RULES.startGold - 50;

// 강화와 판매
const f = Game.facilityAt(3, 4);
worldClick(f.x, f.y);
assert.strictEqual(UI.selectedFacility, f);
Game.gold = 500;
btn('up2');
assert.strictEqual(f.tier, 2);
btn('up3B');
assert.strictEqual(f.tier, 3);
assert.strictEqual(f.branch, 'B');
assert.strictEqual(facilityStats(f).range, 5);
assert.strictEqual(facilityStats(f).damage, 8 * 1.5 * 3);
const before = Game.gold;
btn('sell');
assert.strictEqual(Game.gold, before + Math.floor((50 + 40 + 75) * 0.7));
assert.strictEqual(Game.facilities.length, 0);

// 오크 초소가 오크를 내보내고 길을 막는다
Game.gold = 2000;
Game.build('barracks', 3, 4);
Game.build('archer', 5, 4);
Game.build('archer', 5, 5);
Game.build('crystal', 3, 6);
tick(1);
assert.strictEqual(Game.units.filter(u => u.kind === 'orc').length, 2, 'orcs spawned');

// 다음 웨이브 시작
UI.onKey('Space');
assert.strictEqual(Game.state, 'wave');
tick(14);
assert(Game.stats.kills > 0 || Game.heroes.length > 0);

// 번개: Q는 타워 탭에서도 동작하고 마왕 탭으로 바꾼다. 건설 모드는 끝난다
UI.onKey('Digit1');
assert.strictEqual(UI.tab, 'tower');
assert.strictEqual(UI.placing, 'archer');
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
assert.strictEqual(UI.tab, 'tower');
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

// 패배 후 다시 시작하면 모두 초기화
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert.strictEqual(Game.facilities.length, 0);
assert.strictEqual(UI.tab, 'tower', 'retry starts on tower tab');
assert.strictEqual(Game.units.length, 0);

// 한 판 끝까지: 보스 패턴 포함, 예외 없이 승리 화면까지 간다
Game.gold = 6000;
[[3,4,'archer'],[5,5,'crystal'],[3,6,'barracks'],[7,6,'archer'],[9,5,'crystal'],[9,2,'archer'],[11,4,'barracks'],[13,5,'crystal'],[13,7,'crystal'],[15,7,'archer'],[11,6,'crystal'],[15,5,'crystal']].forEach(([c,r,t]) => Game.build(t,c,r));
for (const x of Game.facilities) { Game.upgrade(x); Game.upgrade(x, 'A'); }
let guard = 0, sawCharge = false, sawStomp = false;
while (Game.state !== 'victory' && Game.state !== 'defeat' && guard++ < 60000) {
    if (Game.state === 'prep') Game.startWave();
    UI.update(1 / 30);
    Game.update(1 / 30);
    const b = Game.heroes.find(h => h.boss);
    if (b && b.chargeTime > 0) sawCharge = true;
    if (b && b.stomped) sawStomp = true;
}
assert.strictEqual(Game.state, 'victory');
assert(sawCharge && sawStomp, 'boss patterns fired');
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });
