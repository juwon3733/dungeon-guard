// 1지역 지하 감옥의 경로. 꺾이는 지점만 적고, 거리 계산은 아래에서 만든다.
const PATH_TILES = [[0, 3], [4, 3], [4, 7], [8, 7], [8, 3], [12, 3], [12, 8], [16, 8], [16, 5], [18, 5]];
const THRONE_TILE = { col: 18, row: 5 };

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
    { sprite: 'prop_pillarShadow', col: 17, row: 3 },
    { sprite: 'prop_pillarShadow', col: 17, row: 7 },
    { sprite: 'prop_shard', col: 10, row: 8 },
    { sprite: 'prop_crystal', col: 2, row: 8 },
    { sprite: 'prop_shard', col: 6, row: 1 },
    { sprite: 'prop_crystal', col: 14, row: 1 }
];

// 섬 위에 세운 화로 위치(길에서 떨어진 칸)
const TORCHES = [[1, 1], [10, 1], [13, 1], [1, 9], [6, 9], [10, 9]];

// Why: 경로에 붙은 칸에만 지을 수 있어야 사거리 낭비 없이 배치 판단에 집중할 수 있다.
const BUILD_CELLS = (function findBuildCells() {
    const result = new Set();
    for (let r = 1; r <= 9; r++) {
        for (let c = 1; c <= 18; c++) {
            if (isPathCell(c, r)) continue;
            if (DECOR.some(p => p.col === c && p.row === r)) continue;
            if (Math.abs(c - THRONE_TILE.col) <= 1 && Math.abs(r - THRONE_TILE.row) <= 1) continue;
            let near = false;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (isPathCell(c + dx, r + dy)) near = true;
                }
            }
            if (near) result.add(c + ',' + r);
        }
    }
    return result;
})();

function isBuildCell(col, row) { return BUILD_CELLS.has(col + ',' + row); }
