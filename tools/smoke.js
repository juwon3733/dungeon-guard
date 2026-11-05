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
const click = (x, y) => { UI.onMove(x, y); UI.onClick(x, y); };
const btn = id => { UI.update(0); const b = UI.buttons.find(b => b.id === id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const tick = s => { for (let i = 0; i < s * 30; i++) { UI.update(1 / 30); Game.update(1 / 30); } };

// 시작
assert.strictEqual(Game.state, 'title');
btn('start');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);

// 길 위와 벽은 지을 수 없다
click(tileX(2), tileY(3));
assert.strictEqual(UI.selectedCell, null, 'path cell must not open the menu');

// 궁수탑 건설
click(tileX(3), tileY(4));
assert(UI.selectedCell, 'build cell opens menu');
btn('build_archer');
assert.strictEqual(Game.facilities.length, 1);
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 50);
assert.strictEqual(UI.selectedCell, null);

// 돈이 모자라면 짓지 못한다
click(tileX(5), tileY(4));
btn('build_crystal');
assert.strictEqual(Game.facilities.length, 1);
UI.clearSelection();

// 강화와 판매
const f = Game.facilityAt(3, 4);
click(f.x, f.y);
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

// 번개
UI.onKey('KeyQ');
assert.strictEqual(UI.targeting, true);
click(tileX(4), tileY(5));
assert.strictEqual(UI.targeting, false);
assert.strictEqual(Game.skills.lightning, COMBAT_RULES.lightning.cooldown);
tick(0.5);

// 호통은 체력이 충분하면 막히고, 낮으면 쓸 수 있다
UI.onKey('KeyW');
assert.strictEqual(Game.skills.roar, 0);
Game.hp = 8;
UI.onKey('KeyW');
assert.strictEqual(Game.skills.roar, COMBAT_RULES.roar.cooldown);
Game.hp = 20;

// 타락: 비용 차감, 부하 생성, 최대 인원 제한
Game.corpses.push({ type: 'warrior', female: false, x: tileX(4), y: tileY(5), d: 800, dir: 'down', age: 0, life: 5, cost: 15 });
const goldBefore = Game.gold;
click(tileX(4), tileY(5) - 30);
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
