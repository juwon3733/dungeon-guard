// 1지역 지하 정원의 경로. 입구마다 왕좌까지 가는 꺾은선을 적고, 거리 계산은 아래에서 만든다.
// 합류형: 남쪽 길은 합류점(10,8)에서 북쪽 길과 만나 그 뒤로는 같은 칸을 지난다(docs/MULTI_PATH.md 5절).
// 합류 뒤 구간은 두 길에서 좌표와 남은 거리(length - d)가 같으므로 길이 달라도 남은 거리로 비교할 수 있다.
// 길이는 북쪽 49칸, 남쪽 47칸이다(이전 맵과 같다)
const ROUTE_COMMON = [[10, 8], [10, 3], [15, 3], [15, 11], [21, 11], [21, 7], [27, 7]];
const ROUTE_TILES = {
    north: [[0, 3], [5, 3], [5, 8], ...ROUTE_COMMON],
    south: [[0, 11], [10, 11], ...ROUTE_COMMON]
};
const ROUTE_IDS = ['north', 'south']; // 이 순서가 우선순위다(거리가 같으면 north)
const ROUTE_NAMES = { north: '북', south: '남' };
const MERGE_TILE = { col: 10, row: 8 };
const PATH_TILES = ROUTE_TILES.north; // 예전 이름(북쪽 길)
const THRONE_TILE = { col: 27, row: 7 };
const LORD_SAY_Y = 360; // 마왕 말풍선 높이(왕좌 칸 가운데에서 위로, 세계 px). 마왕 머리 위

// 왕좌 둘레: 왕좌 칸의 좌우 1칸, 위 2칸, 아래 1칸. 몬스터를 여기로 끌어 놓으면 제물이다(Game.onThrone).
// 마왕 그림(화면 256px)이 이 칸들을 덮으므로 건설 칸에서 빼고, 바닥은 길과 같은 벽돌로 깐다
function isThroneArea(col, row) {
    return Math.abs(col - THRONE_TILE.col) <= 1 && row >= THRONE_TILE.row - 2 && row <= THRONE_TILE.row + 1;
}

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

// Wang 타일(tileset_path, tileset_water, 본부 바닥 tileset_hq 공통 배치). 열쇠는 꼭짓점 NW, NE, SW, SE가 upper면 1, lower면 0.
// tileset_hq는 그림에서 upper가 나무 바닥, lower가 붉은 카펫이다(js/ui/hq.js의 HQ_ROOM.carpet).
// 값은 타일셋 안의 bounding_box [x, y, 너비, 높이](32px)다. 두 타일셋의 lower(이끼 바닥)는 같은 그림이라 이어진다.
// upper는 tileset_path에서 벽돌 길, tileset_water에서 물가다
const WANG_TILES = {
    '1101': [0, 0, 32, 32],
    '1010': [32, 0, 32, 32],
    '0100': [64, 0, 32, 32],
    '1100': [96, 0, 32, 32],
    '0110': [0, 32, 32, 32],
    '1000': [32, 32, 32, 32],
    '0000': [64, 32, 32, 32],
    '0001': [96, 32, 32, 32],
    '1011': [0, 64, 32, 32],
    '0011': [32, 64, 32, 32],
    '0010': [64, 64, 32, 32],
    '0101': [96, 64, 32, 32],
    '1111': [0, 96, 32, 32],
    '1110': [32, 96, 32, 32],
    '1001': [64, 96, 32, 32],
    '0111': [96, 96, 32, 32]
};

// 물가: '~'가 물(tileset_water의 upper), 나머지는 이끼 바닥이다. 한 줄이 MAP_COLS칸, MAP_ROWS줄.
// 물은 건설 칸, 길, 왕좌 둘레에 들어가지 않고 길과 왕좌 둘레에 붙지도 않는다(한 타일에 길과 물이 함께 오면 이을 타일이 없다).
// 입구 쪽(왼쪽)과 왕좌 쪽(오른쪽)은 비워 둔다
const WATER_MAP = [
    '...~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '....~~~...~~~~~~~~~~~~~~~~....',
    '....................~~~~~.....',
    '.....................~~~......',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '...........................~~~',
    '..........................~~~~',
    '.........................~~~~~',
    '...~~~~~...~~~~~~~~~~~~~~~~~~~',
    '..~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
];
function isWaterCell(col, row) {
    const line = WATER_MAP[clamp(row, 0, MAP_ROWS - 1)];
    return line[clamp(col, 0, MAP_COLS - 1)] === '~';
}

// 소품(prop2_<이름>, 64px 그림을 화면 2배). 놓인 칸은 건설 불가다. 그림이 2x2칸쯤이라 건설 칸이 없는 빈 곳에만 놓는다.
// 입구 문(gate)은 길 첫 칸에 걸쳐 세우고, 왕좌(throne)는 drawThrone이 마왕 뒤에 그린다
const DECOR = [
    { sprite: 'prop2_gate', col: 0, row: 3 },
    { sprite: 'prop2_gate', col: 0, row: 11 },
    { sprite: 'prop2_tree', col: 1, row: 1 },
    { sprite: 'prop2_cauldron', col: 8, row: 1 },
    { sprite: 'prop2_crystal', col: 19, row: 3 },
    { sprite: 'prop2_boulder', col: 26, row: 1 },
    { sprite: 'prop2_stairs', col: 28, row: 2 },
    { sprite: 'prop2_chest', col: 29, row: 4 },
    { sprite: 'prop2_brazier', col: 29, row: 5 },
    { sprite: 'prop2_brazier', col: 29, row: 9 },
    { sprite: 'prop2_obelisk', col: 18, row: 6 },
    { sprite: 'prop2_pillar', col: 18, row: 8 },
    { sprite: 'prop2_banner', col: 0, row: 5 },
    { sprite: 'prop2_cage', col: 1, row: 7 },
    { sprite: 'prop2_mushrooms', col: 0, row: 9 },
    { sprite: 'prop2_tree', col: 25, row: 11 },
    { sprite: 'prop2_bones', col: 8, row: 13 },
    { sprite: 'prop2_spikes', col: 1, row: 14 }
];
// 소품 그림(64px 캔버스) 안의 발끝 높이: 그림의 맨 아래 줄. 칸 아래쪽(PROP_FOOT_Y)에 맞춘다
const PROP_FOOT = {
    banner: 62, bones: 51, boulder: 57, brazier: 61, cage: 63, cauldron: 60, chest: 58, crystal: 59,
    gate: 62, mushrooms: 59, obelisk: 62, pillar: 62, spikes: 59, stairs: 57, throne: 62, tree: 62
};
const PROP_FOOT_Y = 39; // 칸 가운데에서 소품 발끝까지 아래로 내린 거리(세계 px). 칸 아래 끝(48)보다 조금 위
function propFootPx(sprite) { return PROP_FOOT[sprite.replace('prop2_', '')]; }

const BUILD_REACH = 2; // 길에서 이 칸 수까지 지을 수 있다

// Why: 길에서 너무 먼 칸까지 열면 사거리 낭비만 늘고, 2칸까지는 가까이 지을지 물러날지 판단이 생긴다.
const BUILD_CELLS = (function findBuildCells() {
    const result = new Set();
    for (let r = 2; r <= MAP_ROWS - 3; r++) { // 맨 위 두 줄과 맨 아래 두 줄은 HUD와 물가 자리다(2~12줄)
        for (let c = 1; c <= MAP_COLS - 2; c++) {
            if (isPathCell(c, r)) continue;
            if (DECOR.some(p => p.col === c && p.row === r)) continue;
            if (isThroneArea(c, r)) continue;
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
