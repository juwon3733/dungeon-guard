// 맵 경로(모든 지역이 같다). 입구마다 왕좌까지 가는 꺾은선을 적고, 거리 계산은 아래에서 만든다.
// 합류형: 남쪽 길은 합류점에서 북쪽 길과 만나 그 뒤로는 같은 칸을 지난다(docs/MULTI_PATH.md 5절).
// 합류 뒤 구간은 두 길에서 좌표와 남은 거리(length - d)가 같으므로 길이 달라도 남은 거리로 비교할 수 있다.
// 맵 표. 한 줄을 더하면 새 맵이 생긴다. 길 칸과 설치 칸은 표에서 계산한다(setMap).
//   routes: 입구마다 왕좌까지 가는 꺾은선, merge: 두 길이 만나는 칸(이 뒤로는 같은 칸을 지난다)
//   altars: 강화 제단 칸(몬스터가 올라서면 MAP_RULES만큼 강해진다), cursed: 저주받은 땅(설치할 수 없다)
//   입구와 왕좌 자리는 모든 맵이 같다(북쪽 2줄, 남쪽 9줄, 왕좌 21,5)
const MAPS = {
    merge: {
        id: 'merge', name: '합류로', desc: '두 길이 일찍 만난다. 합류 뒤에 화력을 모은다', merge: [8, 6],
        routes: { north: [[0, 2], [4, 2], [4, 6], [8, 6], [8, 2], [12, 2], [12, 9], [15, 9], [15, 3], [18, 3], [18, 5], [21, 5]], south: [[0, 9], [8, 9], [8, 6], [8, 2], [12, 2], [12, 9], [15, 9], [15, 3], [18, 3], [18, 5], [21, 5]] },
        altars: [[10, 6], [17, 7]], cursed: [[6, 4], [14, 5], [19, 8]]
    },
    parallel: {
        id: 'parallel', name: '평행로', desc: '두 길이 끝까지 만나지 않는다. 가운데 줄이 명당이다', merge: [18, 5],
        routes: { north: [[0, 2], [3, 2], [3, 4], [7, 4], [7, 2], [11, 2], [11, 4], [15, 4], [15, 2], [18, 2], [18, 5], [21, 5]], south: [[0, 9], [3, 9], [3, 7], [7, 7], [7, 9], [11, 9], [11, 7], [15, 7], [15, 9], [18, 9], [18, 5], [21, 5]] },
        altars: [[9, 5], [15, 6]], cursed: [[5, 6], [12, 5], [8, 3], [8, 8]]
    },
    coil: {
        id: 'coil', name: '똬리길', desc: '길이 안으로 말려 들어간다. 가운데에서 여러 구간에 닿는다', merge: [2, 5],
        routes: { north: [[0, 2], [2, 2], [2, 5], [6, 5], [6, 3], [17, 3], [17, 9], [10, 9], [10, 5], [21, 5]], south: [[0, 9], [2, 9], [2, 5], [6, 5], [6, 3], [17, 3], [17, 9], [10, 9], [10, 5], [21, 5]] },
        altars: [[14, 4], [14, 6]], cursed: [[8, 7], [19, 3], [19, 8]]
    }
};
const MAP_IDS = Object.keys(MAPS);
const DEFAULT_MAP = 'merge';
// 강화 제단 위의 몬스터: 피해 +altarDamage, 사거리 +altarRange칸
const MAP_RULES = { altarDamage: 0.3, altarRange: 0.5 };
const ROUTE_IDS = ['north', 'south']; // 이 순서가 우선순위다(거리가 같으면 north)
const ROUTE_NAMES = { north: '북', south: '남' };
const MERGE_TILE = { col: 8, row: 6 }; // 지금 맵의 합류점(setMap이 바꾼다)
const THRONE_TILE = { col: 21, row: 5 };
const LORD_SAY_Y = 290; // 마왕 말풍선 높이(왕좌 칸 가운데에서 위로, 세계 px). 마왕 머리 위

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

const ROUTES = {}; // 지금 맵의 길(setMap이 내용을 바꾼다)
const PATH_CELLS = new Set(); // 모든 길 칸의 합집합

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
//   props: 소품 [그림, 열, 줄]. 전장을 가리지 않게 맵 가장자리(건설 칸 밖)에만 놓는다
//   tone: 명도 단계 [바닥에 곱하는 색, 길에 곱하는 색]. 바닥은 어둡게, 길은 중간으로(밝은 지역은 길도 누르고 어두운 지역은 그대로)
//   vignette: 가장자리에 지역 색을 얹는 세기(어둡게 덮지 않는다)
//   gate: 입구 소용돌이 문 색 [바깥, 가운데, 빛], post: 꺾이는 곳 기둥 색 [테, 몸, 빛]
const ZONES = {
    moonGarden: { name: '달빛 정원', deck: [288, 760], props: [['prop2_crystal', 23, 2], ['prop2_pillar', 23, 8], ['prop2_mushrooms', 0, 6]],
        tone: ['#6c6a78', '#c8c4cc'], vignette: [120, 110, 220, 0.16], gate: ['#3b5bd9', '#8fd0ff', '180,220,255'], post: ['#1b2440', '#6d7fb0', '#bfe3ff'] },
    coast: { name: '별모래 해안', deck: [272, 712], props: [['prop2_boulder', 23, 2], ['prop2_chest', 23, 8], ['prop2_boulder', 23, 10]],
        tone: ['#5e5a5e', '#b4acac'], vignette: [60, 190, 170, 0.14], gate: ['#17807a', '#7af0d8', '150,255,230'], post: ['#3a2814', '#a07a4a', '#ffe0a0'] },
    frost: { name: '서리 봉우리', deck: [272, 712], props: [['prop2_crystal', 23, 2], ['prop2_crystal', 23, 8], ['prop2_crystal', 23, 10]],
        tone: ['#5c5e6c', '#a8a8b4'], vignette: [90, 170, 255, 0.16], gate: ['#2a78d6', '#c8f0ff', '190,235,255'], post: ['#1c3350', '#8ab8e0', '#e8f8ff'] },
    skySea: { name: '하늘 바다', deck: [256, 728], props: [['prop2_crystal', 23, 2], ['prop2_boulder', 23, 8]],
        tone: ['#66707a', '#c0c0c8'], vignette: [60, 160, 255, 0.16], gate: ['#1d7fd0', '#8ff4ff', '150,240,255'], post: ['#1f3a3a', '#6fa8a0', '#c8fff0'] },
    sunForge: { name: '태양의 대장간', deck: [280, 744], props: [['prop2_brazier', 23, 2], ['prop2_brazier', 23, 8], ['prop2_cauldron', 23, 10]],
        tone: ['#6c6660', '#b4a8a4'], vignette: [255, 120, 40, 0.16], gate: ['#c2410c', '#ffd27a', '255,200,110'], post: ['#2a1608', '#8a5a2a', '#ffcc55'] },
    warTemple: { name: '전쟁 신전', deck: [256, 768], props: [['prop2_banner', 23, 2], ['prop2_obelisk', 23, 8], ['prop2_brazier', 0, 6]],
        tone: ['#6c666c', '#ffffff'], vignette: [220, 40, 50, 0.16], gate: ['#9b1c2c', '#ff9a7a', '255,140,120'], post: ['#1a1418', '#5a4a52', '#ff5a4a'] },
    starChoir: { name: '별의 성가대', deck: [256, 784], props: [['prop2_obelisk', 23, 2], ['prop2_crystal', 23, 8]],
        tone: ['#6c687c', '#c8c4d0'], vignette: [130, 90, 255, 0.18], gate: ['#5b3bd9', '#d8c8ff', '210,190,255'], post: ['#1e1a3a', '#6a5fb0', '#e0d0ff'] },
    ember: { name: '잿불 균열', deck: [232, 728], props: [['prop2_brazier', 23, 2], ['prop2_brazier', 23, 8], ['prop2_bones', 0, 6]],
        tone: ['#6c666c', '#ffffff'], vignette: [255, 80, 30, 0.16], gate: ['#b8320c', '#ffb050', '255,170,80'], post: ['#1a1010', '#4a3a3a', '#ff7a2a'] }
};
const ZONE_IDS = Object.keys(ZONES);
const DEFAULT_ZONE = 'ember'; // 스토리 없는 판(시험 도구)
// 판의 지역: 스테이지 표의 zone, 없으면 DEFAULT_ZONE
function zoneOf(stageId) {
    const st = typeof STAGES !== 'undefined' ? STAGES.find(s => s.id === stageId) : null;
    return st && ZONES[st.zone] ? st.zone : DEFAULT_ZONE;
}

// 소품 그림(64px 캔버스) 안의 발끝 높이: 그림의 맨 아래 줄. 칸 아래쪽(PROP_FOOT_Y)에 맞춘다
const PROP_FOOT = { banner: 62, bones: 51, boulder: 57, brazier: 61, cauldron: 60, chest: 58, crystal: 59, mushrooms: 59, obelisk: 62, pillar: 62, throne: 62 };
const PROP_FOOT_Y = 39; // 칸 가운데에서 소품 발끝까지 아래로 내린 거리(세계 px). 칸 아래 끝(48)보다 조금 위
function propFootPx(sprite) { return PROP_FOOT[sprite.replace('prop2_', '')]; }

const BUILD_REACH = 2; // 길에서 이 칸 수까지 지을 수 있다

// Why: 길에서 너무 먼 칸까지 열면 사거리 낭비만 늘고, 2칸까지는 가까이 지을지 물러날지 판단이 생긴다.
const BUILD_CELLS = new Set();
let currentMap = DEFAULT_MAP; // 지금 맵 id

function findBuildCells(map) {
    BUILD_CELLS.clear();
    const cursed = new Set(map.cursed.map(([c, r]) => c + ',' + r));
    for (let r = 2; r <= MAP_ROWS - 2; r++) { // 맨 위 두 줄은 머리가 화면 밖으로 나가고 맨 아래 줄은 섬 가장자리다(2~10줄)
        for (let c = 1; c <= MAP_COLS - 2; c++) {
            if (isPathCell(c, r) || cursed.has(c + ',' + r)) continue;
            if (isThroneArea(c, r)) continue;
            let near = false;
            for (let dy = -BUILD_REACH; dy <= BUILD_REACH; dy++) {
                for (let dx = -BUILD_REACH; dx <= BUILD_REACH; dx++) {
                    if (isPathCell(c + dx, r + dy)) near = true;
                }
            }
            if (near) BUILD_CELLS.add(c + ',' + r);
        }
    }
}

// 맵을 바꾼다: 길, 길 칸, 합류점, 설치 칸을 다시 만든다. 표에 없는 id는 기본 맵
function setMap(id) {
    const map = MAPS[id] || MAPS[DEFAULT_MAP];
    currentMap = map.id;
    for (const r of ROUTE_IDS) ROUTES[r] = buildPath(map.routes[r]);
    PATH_CELLS.clear();
    for (const r of ROUTE_IDS) for (const cell of ROUTES[r].cells) PATH_CELLS.add(cell);
    MERGE_TILE.col = map.merge[0];
    MERGE_TILE.row = map.merge[1];
    findBuildCells(map);
}
setMap(DEFAULT_MAP);

// 몬스터가 강화 제단 위에 서 있는지(몸 어느 칸이든)
function onAltar(type, col, row) {
    const [w, h] = monsterCells(type);
    return MAPS[currentMap].altars.some(([c, r]) => c >= col && c < col + w && r <= row && r > row - h);
}

function isBuildCell(col, row) { return BUILD_CELLS.has(col + ',' + row); }

// 막는 몬스터가 놓인 칸에서 걸어 나가 설 길 지점: { route, d, x, y }.
// 합류 뒤 구간이면 어느 길이든 같은 좌표이고 route는 north다(nearestPathPoint)
function rallyPoint(col, row) {
    const p = nearestPathPoint(tileX(col), tileY(row));
    return { route: p.route, d: p.d, x: p.x, y: p.y };
}
