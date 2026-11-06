// 1지역 지하 감옥의 경로. 입구마다 왕좌까지 가는 꺾은선을 적고, 거리 계산은 아래에서 만든다.
// 합류형: 남쪽 길은 합류점(8,7)에서 북쪽 길과 만나 그 뒤로는 같은 칸을 지난다(docs/MULTI_PATH.md 5절).
// 합류 뒤 구간은 두 길에서 좌표와 남은 거리(length - d)가 같으므로 길이 달라도 남은 거리로 비교할 수 있다.
const ROUTE_COMMON = [[8, 3], [12, 3], [12, 8], [16, 8], [16, 4], [20, 4], [20, 10], [23, 10], [23, 7]];
const ROUTE_TILES = {
    north: [[0, 3], [4, 3], [4, 7], [8, 7], ...ROUTE_COMMON],
    south: [[0, 9], [8, 9], [8, 7], ...ROUTE_COMMON]
};
const ROUTE_IDS = ['north', 'south']; // 이 순서가 우선순위다(거리가 같으면 north)
const ROUTE_NAMES = { north: '북', south: '남' };
const MERGE_TILE = { col: 8, row: 7 };
const PATH_TILES = ROUTE_TILES.north; // 예전 이름(북쪽 길)
const THRONE_TILE = { col: 23, row: 7 };

// 꺾이는 칸 목록으로 길 하나를 만든다: 구간(segments), 전체 길이(length), 지나는 칸(cells)
function buildPath(tiles) {
    const points = tiles.map(([c, r]) => ({ x: tileX(c), y: tileY(r), c, r }));
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
    for (let i = 0; i < tiles.length - 1; i++) {
        let [c, r] = tiles[i];
        const [ec, er] = tiles[i + 1];
        while (c !== ec || r !== er) {
            cells.add(c + ',' + r);
            c += Math.sign(ec - c);
            r += Math.sign(er - r);
        }
        cells.add(ec + ',' + er);
    }
    return { tiles, segments, length: total, cells };
}

const ROUTES = {};
for (const id of ROUTE_IDS) ROUTES[id] = buildPath(ROUTE_TILES[id]);
const PATH = ROUTES.north; // 예전 이름. 새 코드는 ROUTES[route]를 쓴다
const PATH_CELLS = new Set(ROUTE_IDS.flatMap(id => [...ROUTES[id].cells])); // 모든 길 칸의 합집합

// 입구에서 합류점까지 거리. 이 거리부터는 두 길의 좌표가 같다
function mergeDistance(route) {
    const s = ROUTES[route].segments.find(seg => seg.ax === tileX(MERGE_TILE.col) && seg.ay === tileY(MERGE_TILE.row));
    return s ? s.start : 0;
}

// d: 입구로부터 이동한 거리(px). route가 없으면 북쪽 길
function pathAt(d, route) {
    const R = ROUTES[route || 'north'];
    const dist = clamp(d, 0, R.length);
    for (const s of R.segments) {
        if (dist <= s.start + s.len) {
            const t = dist - s.start;
            return { x: s.ax + s.dx * t, y: s.ay + s.dy * t, dx: s.dx, dy: s.dy };
        }
    }
    const last = R.segments[R.segments.length - 1];
    return { x: last.ax + last.dx * last.len, y: last.ay + last.dy * last.len, dx: last.dx, dy: last.dy };
}

// 모든 길 가운데 (x, y)에서 가장 가까운 점: { route, d, x, y, gap }. 거리가 같으면 ROUTE_IDS 앞쪽(north)
function nearestPathPoint(x, y) {
    let best = null;
    for (const route of ROUTE_IDS) {
        for (const s of ROUTES[route].segments) {
            const t = clamp((x - s.ax) * s.dx + (y - s.ay) * s.dy, 0, s.len);
            const px = s.ax + s.dx * t;
            const py = s.ay + s.dy * t;
            const gap = distance(x, y, px, py);
            if (!best || gap < best.gap - 1e-6) best = { route, d: s.start + t, x: px, y: py, gap };
        }
    }
    return best;
}

// 용사(또는 { route, d })가 왕좌까지 남은 거리(px)
function remainingDistance(h) { return ROUTES[h.route || 'north'].length - h.d; }

function isPathCell(col, row) { return PATH_CELLS.has(col + ',' + row); }

// 장식이 놓인 칸: 건설 불가. 수정 하나는 남쪽 길 난간에 걸쳐 보여 (2,10)에서 한 줄 아래 (2,11)로 옮겼다
const DECOR = [
    { sprite: 'prop_pillarShadow', col: 22, row: 5 },
    { sprite: 'prop_pillarShadow', col: 25, row: 9 },
    { sprite: 'prop_shard', col: 10, row: 10 },
    { sprite: 'prop_crystal', col: 2, row: 11 },
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

// 막는 몬스터가 놓인 칸에서 걸어 나가 설 길 지점: { route, d, x, y }.
// 합류 뒤 구간이면 어느 길이든 같은 좌표이고 route는 north다(nearestPathPoint)
function rallyPoint(col, row) {
    const p = nearestPathPoint(tileX(col), tileY(row));
    return { route: p.route, d: p.d, x: p.x, y: p.y };
}
