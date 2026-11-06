// 1지역 지하 감옥의 경로. 꺾이는 지점만 적고, 거리 계산은 아래에서 만든다.
const PATH_TILES = [[0, 3], [4, 3], [4, 7], [8, 7], [8, 3], [12, 3], [12, 8], [16, 8], [16, 4], [20, 4], [20, 10], [23, 10], [23, 7]];
const THRONE_TILE = { col: 23, row: 7 };

const PATH = (function buildPath() {
    const points = PATH_TILES.map(([c, r]) => ({ x: tileX(c), y: tileY(r), c, r }));
    points[0].x = -60; // 문 밖에서 걸어 들어오게 한다
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const len = distance(a.x, a.y, b.x, b.y);
        segments.push({ ax: a.x, ay: a.y, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, len, start: total });
        total += len;
    }
    const cells = new Set();
    for (let i = 0; i < PATH_TILES.length - 1; i++) {
        let [c, r] = PATH_TILES[i];
        const [ec, er] = PATH_TILES[i + 1];
        while (c !== ec || r !== er) {
            cells.add(c + ',' + r);
            c += Math.sign(ec - c);
            r += Math.sign(er - r);
        }
        cells.add(ec + ',' + er);
    }
    return { segments, length: total, cells };
})();

// d: 입구로부터 이동한 거리(px)
function pathAt(d) {
    const dist = clamp(d, 0, PATH.length);
    for (const s of PATH.segments) {
        if (dist <= s.start + s.len) {
            const t = dist - s.start;
            return { x: s.ax + s.dx * t, y: s.ay + s.dy * t, dx: s.dx, dy: s.dy };
        }
    }
    const last = PATH.segments[PATH.segments.length - 1];
    return { x: last.ax + last.dx * last.len, y: last.ay + last.dy * last.len, dx: last.dx, dy: last.dy };
}

function nearestPathDistance(x, y) {
    let best = 0;
    let bestDist = Infinity;
    for (const s of PATH.segments) {
        const t = clamp((x - s.ax) * s.dx + (y - s.ay) * s.dy, 0, s.len);
        const dd = distance(x, y, s.ax + s.dx * t, s.ay + s.dy * t);
        if (dd < bestDist) { bestDist = dd; best = s.start + t; }
    }
    return best;
}

function isPathCell(col, row) { return PATH.cells.has(col + ',' + row); }

// 장식이 놓인 칸: 건설 불가
const DECOR = [
    { sprite: 'prop_pillarShadow', col: 22, row: 5 },
    { sprite: 'prop_pillarShadow', col: 25, row: 9 },
    { sprite: 'prop_shard', col: 10, row: 10 },
    { sprite: 'prop_crystal', col: 2, row: 10 },
    { sprite: 'prop_shard', col: 6, row: 1 },
    { sprite: 'prop_crystal', col: 14, row: 1 },
    { sprite: 'prop_crystal', col: 15, row: 10 },
    { sprite: 'prop_shard', col: 18, row: 1 }
];

// 섬 위에 세운 화로 위치(길에서 떨어진 칸)
const TORCHES = [[1, 1], [10, 1], [13, 1], [1, 10], [6, 10], [12, 10], [18, 10], [17, 1]];

const BUILD_REACH = 2; // 길에서 이 칸 수까지 지을 수 있다

// Why: 길에서 너무 먼 칸까지 열면 사거리 낭비만 늘고, 2칸까지는 가까이 지을지 물러날지 판단이 생긴다.
const BUILD_CELLS = (function findBuildCells() {
    const result = new Set();
    for (let r = 2; r <= MAP_ROWS - 5; r++) { // 맨 위는 상단 HUD, 아래 네 줄은 절벽과 하단 HUD 자리다
        for (let c = 1; c <= MAP_COLS - 2; c++) {
            if (isPathCell(c, r)) continue;
            if (DECOR.some(p => p.col === c && p.row === r)) continue;
            if (TORCHES.some(([tc, tr]) => tc === c && tr === r)) continue;
            if (c >= 21 && r <= 3) continue; // 오른쪽 위 파티 정보 창에 가린다
            if (Math.abs(c - THRONE_TILE.col) <= 1 && Math.abs(r - THRONE_TILE.row) <= 1) continue;
            let near = false;
            for (let dy = -BUILD_REACH; dy <= BUILD_REACH; dy++) {
                for (let dx = -BUILD_REACH; dx <= BUILD_REACH; dx++) {
                    if (isPathCell(c + dx, r + dy)) near = true;
                }
            }
            if (near) result.add(c + ',' + r);
        }
    }
    return result;
})();

function isBuildCell(col, row) { return BUILD_CELLS.has(col + ',' + row); }

// 근접 몬스터를 놓는 길 칸. 입구 칸과 왕좌 단상(왕좌 바로 앞 칸 포함)은 뺀다.
// Why: 입구에 세우면 용사가 들어오자마자 붙잡혀 길 전체를 쓰지 않고, 왕좌 앞은 마지막 방어선이라 설치를 막는다.
const PATH_SLOT_CELLS = (function findPathSlots() {
    const result = new Set();
    const [ec, er] = PATH_TILES[0];
    for (const key of PATH.cells) {
        const [c, r] = key.split(',').map(Number);
        if (c === ec && r === er) continue;
        if (Math.abs(c - THRONE_TILE.col) <= 1 && Math.abs(r - THRONE_TILE.row) <= 1) continue;
        result.add(key);
    }
    return result;
})();

function isPathSlot(col, row) { return PATH_SLOT_CELLS.has(col + ',' + row); }
