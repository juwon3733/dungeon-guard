// 지금 맵 표 시험: 길이 이어지고, 설치 칸과 큰 몬스터 자리가 충분하고, 소품과 기믹이 맞는 자리에 있는지 본다. 실행: node tools/smoke_maps.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, JSON, Number });
for (const f of ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/map.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
assert.strictEqual(TILE * WORLD_ZOOM, 80, 'cell is 80px on screen');
assert.strictEqual(ART_SCALE * WORLD_ZOOM, 1, 'art 1px = screen 1px');
assert.strictEqual(PIXEL_SCALE * WORLD_ZOOM, 2, 'pixel scale is 2x');
const report = [];
for (const id of MAP_IDS) {
    setMap(id);
    const map = MAPS[id];
    for (const rid of ROUTE_IDS) {
        const tiles = map.routes[rid];
        for (let i = 0; i < tiles.length - 1; i++) assert(tiles[i][0] === tiles[i + 1][0] || tiles[i][1] === tiles[i + 1][1], id + ' straight segments');
        assert.deepStrictEqual(tiles[tiles.length - 1], [THRONE_TILE.col, THRONE_TILE.row], id + ' ends at the throne');
        assert.strictEqual(tiles[0][0], 0, id + ' starts at the left edge');
        for (const [c, r] of tiles) assert(c >= 0 && c < MAP_COLS && r >= 1 && r < MAP_ROWS - 1, id + ' route inside the map');
    }
    assert(ROUTE_IDS.every(rid => map.routes[rid].some(([c, r]) => c === map.merge[0] && r === map.merge[1])), id + ' merge on both routes');
    for (const [c, r] of [...map.altars, ...map.cursed]) assert(!isPathCell(c, r) && !isThroneArea(c, r), id + ' gimmick on free land ' + c + ',' + r);
    for (const [c, r] of map.altars) assert(isBuildCell(c, r), id + ' altar is buildable');
    for (const [c, r] of map.cursed) assert(!isBuildCell(c, r), id + ' cursed is not buildable');
    // 큰 몬스터가 설 자리: 왼쪽 아래 칸 기준으로 모든 칸이 설치 칸인 곳의 수
    const spots = (w, h) => [...BUILD_CELLS].filter(k => {
        const [c, r] = k.split(',').map(Number);
        for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (!isBuildCell(c + x, r - y)) return false;
        return true;
    }).length;
    const s = { cells: BUILD_CELLS.size, s2x3: spots(2, 3), s3x2: spots(3, 2), s3x3: spots(3, 3) };
    assert(s.cells >= 90, id + ' build cells ' + s.cells);
    assert(s.s3x3 >= 4 && s.s3x2 >= 6 && s.s2x3 >= 6, id + ' room for big monsters ' + JSON.stringify(s));
    report.push(id + ' ' + JSON.stringify(s) + ' len ' + ROUTE_IDS.map(r => Math.round(ROUTES[r].length / TILE)).join('/'));
}
setMap(DEFAULT_MAP);
for (const id of ZONE_IDS) for (const [sprite, c, r] of ZONES[id].props) {
    for (const m of MAP_IDS) { setMap(m); assert(!isBuildCell(c, r) && !isPathCell(c, r) && !isThroneArea(c, r), id + ' prop off the field ' + sprite); }
    assert(c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS, id + ' prop inside the map');
}
setMap(DEFAULT_MAP);
console.log('smoke maps ok: ' + report.join(', '));
`, ctx);
