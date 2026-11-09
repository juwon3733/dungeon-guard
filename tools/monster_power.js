// 몬스터 세기 비교: 몬스터 한 마리를 길 옆 같은 자리에 두고, 죽지 않는 용사를 길 위 한 곳에 묶어 둔 채 60초 동안 준 피해를 잰다.
// 무리(용사 6명이 붙어 있음)와 단일(용사 1명) 두 가지. 마왕·유물·권능 없이 기본 랭크. 같은 등급끼리 비교한다.
// 실행: node tools/monster_power.js [초, 기본 60] [등급 거르기, 예: epic]
// 지원 몬스터는 자기 피해가 낮게 나오는 것이 정상이다(옆 몬스터를 돕는 값은 재지 않는다).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/asteria_heroes.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/story.js', 'js/data/asteria_bosses.js', 'js/data/challenge.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/relics.js', 'js/game/meta.js', 'js/game/game.js'];
const context = vm.createContext({ console, Math, Set, Map, Object, Array, Infinity, JSON, Sfx: { play() {} } });
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });

const SECONDS = +process.argv[2] || 60;
const onlyGrade = process.argv[3];

vm.runInContext(`
// 길 위 한 점(북쪽 길 45%)과 그 점에 가장 가까운, 몬스터가 들어가는 칸
function powerSpot(type) {
    const route = ROUTES.north;
    const probe = createHero('warrior', 0, 0, false, 'north');
    probe.d = route.length * 0.45;
    const p = heroWorld(probe);
    let best = null;
    for (const k of BUILD_CELLS) {
        const [c, r] = k.split(',').map(Number);
        if (!Game.canPlace(type, c, r)) continue;
        const d = distance(tileX(c), tileY(r), p.x, p.y);
        if (!best || d < best.d) best = { c, r, d };
    }
    return { cell: best, at: probe.d };
}
function measurePower(type, crowd, seconds) {
    Game.reset();
    Game.state = 'wave';
    Game.gold = 1e9;
    Game.heroes.length = 0;
    const spot = powerSpot(type);
    if (!spot.cell) return null;
    const placed = Game.place(type, spot.cell.c, spot.cell.r);
    const m = placed && placed.monster ? placed.monster : (placed && placed.x !== undefined ? placed : Game.monsters[0]);
    // 용사는 몬스터에 가장 가까운 길 위치에 묶는다(큰 몬스터는 칸 중심이 길에서 멀다)
    const probe = createHero('warrior', 0, 0, false, 'north');
    let at = spot.at, bestD = Infinity;
    for (let d = 0; d < ROUTES.north.length; d += 4) {
        probe.d = d;
        const p = heroWorld(probe);
        const dd = distance(m.x, m.y, p.x, p.y);
        if (dd < bestD) { bestD = dd; at = d; }
    }
    spot.at = at;
    const HP = 1e9;
    const heroes = [];
    for (let i = 0; i < (crowd ? 6 : 1); i++) {
        const h = createHero('warrior', 0, 0, false, 'north');
        Object.assign(h, { waiting: false, delay: 0, hp: HP, maxHp: HP, armor: 0, d: spot.at + (i - 2.5) * 10 });
        h.pin = h.d;
        heroes.push(h);
        Game.heroes.push(h);
    }
    const DT = 1 / 30;
    for (let t = 0; t < seconds; t += DT) {
        for (const h of heroes) { h.d = h.pin; h.hp = Math.max(h.hp, 1); h.dead = false; h.attackCd = 99; }
        Game.roundTimer = 999;
        Game.update(DT);
        if (Game.state !== 'wave') Game.state = 'wave';
    }
    return heroes.reduce((s, h) => s + (HP - h.hp), 0) / seconds;
}
`, context);

const MONSTERS = vm.runInContext('MONSTERS', context);
const GRADES = vm.runInContext('GRADE_ORDER', context);
const rows = [];
for (const [id, m] of Object.entries(MONSTERS)) {
    if (onlyGrade && m.grade !== onlyGrade) continue;
    const crowd = vm.runInContext(`measurePower('${id}', true, ${SECONDS})`, context);
    const single = vm.runInContext(`measurePower('${id}', false, ${SECONDS})`, context);
    rows.push({ id, name: m.name, grade: m.grade, family: m.family, role: m.role, crowd, single });
}
for (const g of GRADES) {
    const list = rows.filter(r => r.grade === g);
    if (!list.length) continue;
    const mid = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 1; };
    const mc = mid(list.map(r => r.crowd || 0));
    const ms = mid(list.map(r => r.single || 0));
    console.log(`\n== ${g} (가운데 값 무리 ${Math.round(mc)}, 단일 ${Math.round(ms)} 초당 피해)`);
    list.sort((a, b) => (b.crowd / mc + b.single / ms) - (a.crowd / mc + a.single / ms));
    for (const r of list) console.log(`${r.id} ${r.name} [${r.family} ${r.role}] | 무리 ${Math.round(r.crowd)} (${Math.round(r.crowd / mc * 100)}%) | 단일 ${Math.round(r.single)} (${Math.round(r.single / ms * 100)}%)`);
}
