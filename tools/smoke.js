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
    const owner = { x, y, rally: { d: nearestPathDistance(x, y) } };
    const u = createOrc(owner, 0, { unitHp: 9999, damage: 1, interval: 1, armor: 0 });
    Object.assign(u, { x, y, homeX: x, homeY: y });
    Game.units.push(u);
    return u;
};
const fakeFacility = (x, y) => { const f = { x, y, stun: 0 }; Game.facilities.push(f); return f; };
const clearBoard = () => { Game.heroes = []; Game.units = []; Game.facilities = []; Game.telegraphs = []; };
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
    // 뇌술사: 경고 원 0.5초 → 사거리 4 안 시설과 몬스터 전부 1.5초 정지. 경고 동안 걷지 않는다
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
    updateUnit(orc, 0.1);
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
        updateUnit(orc, 1 / 30);
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
assert.strictEqual(Game.facilities.length, 0);
assert.strictEqual(UI.tab, 'tower', 'retry starts on tower tab');
assert.strictEqual(Game.units.length, 0);

// 한 판 끝까지: 보스 패턴 포함, 예외 없이 승리 화면까지 간다
Game.gold = 6000;
[[3,4,'archer'],[5,5,'crystal'],[3,6,'barracks'],[7,6,'archer'],[9,5,'crystal'],[9,2,'archer'],[11,4,'barracks'],[13,5,'crystal'],[13,7,'crystal'],[15,7,'archer'],[11,6,'crystal'],[15,5,'crystal']].forEach(([c,r,t]) => Game.build(t,c,r));
for (const x of Game.facilities) { Game.upgrade(x); Game.upgrade(x, 'A'); }
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
assert.strictEqual(Game.state, 'victory');
assert(sawCharge && sawStomp, 'boss patterns fired');
assert.strictEqual(eliteWaves.size, WAVES.length - 2, 'elites appeared in waves 3..' + WAVES.length);
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });
