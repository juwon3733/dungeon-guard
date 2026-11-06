// 맵 경로(모든 지역이 같다). 입구마다 왕좌까지 가는 꺾은선을 적고, 거리 계산은 아래에서 만든다.
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

// 지역: 우주 배경(void_) 위에 떠 있는 섬(island_)과 다리 길(bridgedeck_). 판을 시작할 때 이번 지역으로 맵을 다시 그린다(Render.buildMap).
// 스테이지 표(STAGES)의 zone이 지역이고, 스토리 없는 판(시험 도구)은 DEFAULT_ZONE이다.
//   name: 표지판에 함께 보이는 지역 이름
//   deck: 다리 그림(1536x1024)에서 난간까지 포함한 세로 범위 [위, 아래](원본 px). 아래 매달린 장식은 자른다
//   props: 소품 [그림, 열, 줄]. 섬 그림에 장식이 있어 적게 쓰고, PROP_CELLS나 건설 칸 밖에만 놓는다
//   light: 섬 가운데를 밝히는 빛 [r, g, b, 세기], vignette: 가장자리에 지역 색을 얹는 세기(어둡게 덮지 않는다)
//   gate: 입구 소용돌이 문 색 [바깥, 가운데, 빛], post: 꺾이는 곳 기둥 색 [테, 몸, 빛]
const ZONES = {
    moonGarden: { name: '달빛 정원', deck: [288, 760], props: [['prop2_crystal', 18, 6], ['prop2_pillar', 18, 8], ['prop2_mushrooms', 1, 7]],
        light: [150, 190, 255, 0.16], vignette: [120, 110, 220, 0.16], gate: ['#3b5bd9', '#8fd0ff', '180,220,255'], post: ['#1b2440', '#6d7fb0', '#bfe3ff'] },
    coast: { name: '별모래 해안', deck: [272, 712], props: [['prop2_boulder', 18, 6], ['prop2_chest', 18, 8], ['prop2_boulder', 25, 11]],
        light: [255, 230, 170, 0.12], vignette: [60, 190, 170, 0.14], gate: ['#17807a', '#7af0d8', '150,255,230'], post: ['#3a2814', '#a07a4a', '#ffe0a0'] },
    frost: { name: '서리 봉우리', deck: [272, 712], props: [['prop2_crystal', 18, 6], ['prop2_crystal', 18, 8], ['prop2_crystal', 19, 3]],
        light: [200, 235, 255, 0.12], vignette: [90, 170, 255, 0.16], gate: ['#2a78d6', '#c8f0ff', '190,235,255'], post: ['#1c3350', '#8ab8e0', '#e8f8ff'] },
    skySea: { name: '하늘 바다', deck: [256, 728], props: [['prop2_crystal', 18, 6], ['prop2_boulder', 18, 8]],
        light: [150, 240, 230, 0.14], vignette: [60, 160, 255, 0.16], gate: ['#1d7fd0', '#8ff4ff', '150,240,255'], post: ['#1f3a3a', '#6fa8a0', '#c8fff0'] },
    sunForge: { name: '태양의 대장간', deck: [280, 744], props: [['prop2_brazier', 18, 6], ['prop2_brazier', 18, 8], ['prop2_cauldron', 19, 3]],
        light: [255, 170, 80, 0.16], vignette: [255, 120, 40, 0.16], gate: ['#c2410c', '#ffd27a', '255,200,110'], post: ['#2a1608', '#8a5a2a', '#ffcc55'] },
    warTemple: { name: '전쟁 신전', deck: [256, 768], props: [['prop2_banner', 18, 6], ['prop2_obelisk', 18, 8], ['prop2_brazier', 1, 7]],
        light: [255, 150, 120, 0.12], vignette: [220, 40, 50, 0.16], gate: ['#9b1c2c', '#ff9a7a', '255,140,120'], post: ['#1a1418', '#5a4a52', '#ff5a4a'] },
    starChoir: { name: '별의 성가대', deck: [256, 784], props: [['prop2_obelisk', 18, 6], ['prop2_crystal', 18, 8]],
        light: [180, 170, 255, 0.16], vignette: [130, 90, 255, 0.18], gate: ['#5b3bd9', '#d8c8ff', '210,190,255'], post: ['#1e1a3a', '#6a5fb0', '#e0d0ff'] },
    ember: { name: '잿불 균열', deck: [232, 728], props: [['prop2_brazier', 18, 6], ['prop2_brazier', 18, 8], ['prop2_bones', 1, 7]],
        light: [255, 140, 70, 0.14], vignette: [255, 80, 30, 0.16], gate: ['#b8320c', '#ffb050', '255,170,80'], post: ['#1a1010', '#4a3a3a', '#ff7a2a'] }
};
const ZONE_IDS = Object.keys(ZONES);
const DEFAULT_ZONE = 'ember'; // 스토리 없는 판(시험 도구)
// 판의 지역: 스테이지 표의 zone, 없으면 DEFAULT_ZONE
function zoneOf(stageId) {
    const st = typeof STAGES !== 'undefined' ? STAGES.find(s => s.id === stageId) : null;
    return st && ZONES[st.zone] ? st.zone : DEFAULT_ZONE;
}

// 소품 자리: 건설 칸에서 빼 두는 칸. 지역 소품은 이 칸이나 건설 칸 밖에 놓는다(지역이 바뀌어도 건설 칸은 같다)
const PROP_CELLS = [[19, 3], [28, 2], [18, 6], [18, 8], [1, 7], [25, 11]];
// 소품 그림(64px 캔버스) 안의 발끝 높이: 그림의 맨 아래 줄. 칸 아래쪽(PROP_FOOT_Y)에 맞춘다
const PROP_FOOT = { banner: 62, bones: 51, boulder: 57, brazier: 61, cauldron: 60, chest: 58, crystal: 59, mushrooms: 59, obelisk: 62, pillar: 62, throne: 62 };
const PROP_FOOT_Y = 39; // 칸 가운데에서 소품 발끝까지 아래로 내린 거리(세계 px). 칸 아래 끝(48)보다 조금 위
function propFootPx(sprite) { return PROP_FOOT[sprite.replace('prop2_', '')]; }

const BUILD_REACH = 2; // 길에서 이 칸 수까지 지을 수 있다

// Why: 길에서 너무 먼 칸까지 열면 사거리 낭비만 늘고, 2칸까지는 가까이 지을지 물러날지 판단이 생긴다.
const BUILD_CELLS = (function findBuildCells() {
    const result = new Set();
    for (let r = 2; r <= MAP_ROWS - 3; r++) { // 맨 위 두 줄과 맨 아래 두 줄은 HUD와 섬 가장자리 자리다(2~12줄)
        for (let c = 1; c <= MAP_COLS - 2; c++) {
            if (isPathCell(c, r)) continue;
            if (PROP_CELLS.some(([pc, pr]) => pc === c && pr === r)) continue;
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
