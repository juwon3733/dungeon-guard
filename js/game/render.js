// 게임 세계 그리기. 상태를 읽기만 하고 바꾸지 않는다(UI 버튼 제외).
const HP_BAR_W = 60; // 머리 위 체력바 너비(세계 px, 화면 50px)
const HP_BAR_H = 6; // 체력바 높이(세계 px, 화면 5px)
const DECK_W = 132; // 다리 길 폭(세계 px, 화면 110px). 칸(96)보다 조금 넓다
const ISLAND_RECT = [-70, -36, 2060, 1500]; // 섬 그림을 그릴 화면 네모 [x, y, 너비, 높이]. 윗면이 0~12줄을 덮고 절벽은 하단 바 뒤로
const GROUND_DESAT = 0.6; // 배경 채도를 빼는 세기
const ROAD_DESAT = 0.35; // 길 채도를 빼는 세기
const THRONE_BACK = 180; // 왕좌 의자의 발끝을 왕좌 칸 가운데에서 위로 올린 거리(세계 px). 왕좌 둘레 뒷줄에 서서 등받이가 마왕 머리 위로 보인다

const Render = {
    mapLayer: null,

    // 바닥 층(지역마다 한 번 그린다): 어둡게 누른 우주 배경과 섬, 중간 명도의 다리 길과 왕좌 받침, 지역 색 비네트.
    // 소품과 입구 소용돌이 문은 world에서 그린다(문은 돌아가고, 소품은 y 순서로 캐릭터와 섞인다)
    mapZone: null,
    buildMap(zoneId) {
        const id = ZONES[zoneId] ? zoneId : DEFAULT_ZONE;
        const zone = ZONES[id];
        const c = document.createElement('canvas');
        c.width = Math.round(WORLD_WIDTH);
        c.height = Math.round(WORLD_HEIGHT);
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const space = Assets.get(`void_${id}`);
        if (space) g.drawImage(space, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        // Why: 섬 원본은 정사각형이라 윗면이 전장(0~12줄)을 덮도록 가로로 더 늘린다. 절벽은 하단 바 뒤로 이어진다
        const island = Assets.get(`island_${id}`);
        const [ix, iy, iw, ih] = zone.island || ISLAND_RECT;
        if (island) g.drawImage(island, ix / WORLD_ZOOM, iy / WORLD_ZOOM, iw / WORLD_ZOOM, ih / WORLD_ZOOM);
        // 명도 단계: 배경은 채도와 밝기를 낮춰 뒤로 물리고, 그 위에 길과 유닛을 원래 밝기로 올린다
        // Why: 지역 그림을 그대로 쓰면 용암이나 수정이 유닛보다 눈에 띈다. 파일 그림은 픽셀을 못 읽으니 합성으로 처리한다
        g.save();
        g.globalCompositeOperation = 'saturation';
        g.fillStyle = `rgba(128,128,128,${GROUND_DESAT})`;
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = zone.tone[0];
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        g.restore();
        // 길과 왕좌 받침은 중간 명도: 배경보다 밝고 유닛보다 어둡게 따로 그려 얹는다(눈길 같은 밝은 길이 유닛을 가리지 않게)
        const road = document.createElement('canvas');
        road.width = c.width;
        road.height = c.height;
        const rg = road.getContext('2d');
        rg.imageSmoothingEnabled = false;
        this.drawDeck(rg, id);
        this.drawThroneDais(rg, id);
        const shape = document.createElement('canvas');
        shape.width = c.width;
        shape.height = c.height;
        shape.getContext('2d').drawImage(road, 0, 0);
        rg.globalCompositeOperation = 'saturation';
        rg.fillStyle = `rgba(128,128,128,${ROAD_DESAT})`;
        rg.fillRect(0, 0, c.width, c.height);
        rg.globalCompositeOperation = 'multiply';
        rg.fillStyle = zone.tone[1];
        rg.fillRect(0, 0, c.width, c.height);
        rg.globalCompositeOperation = 'destination-in';
        rg.drawImage(shape, 0, 0);
        g.drawImage(road, 0, 0);
        // 비네트: 가장자리에 지역 색을 얹는다(검게 덮지 않는다)
        const [vr, vg, vb, va] = zone.vignette;
        const v = g.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT * 0.45, 760 / WORLD_ZOOM, WORLD_WIDTH / 2, WORLD_HEIGHT * 0.45, 1260 / WORLD_ZOOM);
        v.addColorStop(0, `rgba(${vr},${vg},${vb},0)`);
        v.addColorStop(1, `rgba(${vr},${vg},${vb},${va})`);
        g.fillStyle = v;
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.mapLayer = c;
        this.mapZone = id;
    },

    // 지금 보이는 맵의 지역: 판 중과 결과는 이번 판의 지역, 그 밖(타이틀, 시작 전 대화)은 고른 스테이지의 지역
    zoneNow() {
        const inRun = Game.inPlay() || Game.state === 'victory' || Game.state === 'defeat';
        return inRun ? Game.zone || DEFAULT_ZONE : zoneOf(UI.stageId);
    },

    // 입구 문 위치(세계 좌표): 길마다 첫 칸(맵 왼쪽 끝)
    gates() {
        return ROUTE_IDS.map(route => ({ route, x: tileX(0), y: tileY(ROUTES[route].tiles[0][1]) }));
    },

    // 다리 그림의 돌바닥 띠(난간 없이 가운데 60%)를 네모 (x, y, w, h)에 길과 같은 배율로 반복해 깐다
    deckFloor(g, deck, zone, x, y, w, h) {
        const [top, bottom] = zone.deck;
        const k = DECK_W / (bottom - top);
        const by = top + (bottom - top) * 0.2;
        const bh = (bottom - top) * 0.6;
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        for (let ty = y; ty < y + h; ty += bh * k - 1) {
            for (let tx = x; tx < x + w; tx += 400 * k - 1) g.drawImage(deck, 500, by, 400, bh, tx, ty, 400 * k, bh * k);
        }
        g.restore();
    },

    // 길: 지역 다리 그림에서 난간과 돌바닥을 잘라 경로를 따라 깐다. 폭은 칸보다 조금 넓다(DECK_W)
    drawDeck(g, id) {
        const deck = Assets.get(`bridgedeck_${id}`);
        if (!deck) return;
        const zone = ZONES[id];
        const [top, bottom] = zone.deck;
        const srcH = bottom - top;
        const unit = deck.width * DECK_W / srcH;
        const half = DECK_W / 2;
        // 두 길이 같이 지나는 구간(합류 뒤)은 한 번만 그린다(두 번 그리면 난간이 진해진다)
        const seen = new Map();
        for (const rid of ROUTE_IDS) {
            for (const s of ROUTES[rid].segments) {
                const key = [s.ax, s.ay, s.dx, s.dy, s.len].map(v => Math.round(v * 100)).join(',');
                if (!seen.has(key)) seen.set(key, s);
            }
        }
        // 구간 끝을 반 폭씩 늘려 꺾이는 곳의 바깥 난간이 ㄱ자로 맞물리게 한다
        for (const s of seen.values()) {
            g.save();
            g.translate(s.ax - s.dx * half, s.ay - s.dy * half);
            g.rotate(Math.atan2(s.dy, s.dx));
            const len = s.len + DECK_W;
            for (let x = 0; x < len; x += unit - 1) {
                const w = Math.min(unit, len - x);
                g.drawImage(deck, 0, top, deck.width * (w / unit), srcH, x, -half, w, DECK_W);
            }
            g.restore();
        }
        // 꺾이는 곳과 합류점(T자): 길이 이어지는 쪽은 난간을 지우고 돌바닥으로 잇는다. 네 귀퉁이에 기둥
        const rail = Math.round(DECK_W * 0.2);
        for (const { x, y, open } of this.deckCorners()) {
            const x0 = x - half + (open.has('-1,0') ? 0 : rail);
            const x1 = x + half - (open.has('1,0') ? 0 : rail);
            const y0 = y - half + (open.has('0,-1') ? 0 : rail);
            const y1 = y + half - (open.has('0,1') ? 0 : rail);
            this.deckFloor(g, deck, zone, x0, y0, x1 - x0, y1 - y0);
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.deckPost(g, zone, x + sx * (half - rail / 2), y + sy * (half - rail / 2));
        }
    },

    // 꺾이는 곳 목록: { x, y, open }. open은 길이 이어지는 방향('dx,dy')의 모음
    deckCorners() {
        const map = new Map();
        for (const rid of ROUTE_IDS) {
            const tiles = ROUTES[rid].tiles;
            for (let i = 1; i < tiles.length - 1; i++) {
                const [c, r] = tiles[i];
                const key = c + ',' + r;
                if (!map.has(key)) map.set(key, { x: tileX(c), y: tileY(r), open: new Set() });
                const e = map.get(key);
                for (const [oc, or] of [tiles[i - 1], tiles[i + 1]]) e.open.add(Math.sign(oc - c) + ',' + Math.sign(or - r));
            }
        }
        return [...map.values()];
    },

    // 다리 기둥 하나(지역 기둥 색): 진한 테, 몸, 위쪽 빛나는 보석
    deckPost(g, zone, cx, cy) {
        const [rim, body, glow] = zone.post;
        const x = Math.round(cx);
        const y = Math.round(cy);
        g.fillStyle = rim;
        g.fillRect(x - 14, y - 14, 28, 28);
        g.fillStyle = body;
        g.fillRect(x - 10, y - 12, 20, 20);
        g.fillStyle = glow;
        g.fillRect(x - 4, y - 7, 8, 8);
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(x - 4, y - 7, 4, 3);
    },

    // 왕좌 받침: 왕좌 둘레(3x4칸)에 지역 다리 돌바닥을 깔고, 지역 기둥 색 테와 금선, 네 귀퉁이 기둥
    drawThroneDais(g, id) {
        const deck = Assets.get(`bridgedeck_${id}`);
        const zone = ZONES[id];
        const x = (THRONE_TILE.col - 1) * TILE;
        const y = MAP_TOP + (THRONE_TILE.row - 2) * TILE;
        const w = TILE * 3;
        const h = TILE * 4;
        const [rim, body, glow] = zone.post;
        g.fillStyle = rim;
        g.fillRect(x - 14, y - 14, w + 28, h + 28);
        g.fillStyle = body;
        g.fillRect(x - 8, y - 8, w + 16, h + 16);
        if (deck) this.deckFloor(g, deck, zone, x, y, w, h);
        g.lineWidth = 4;
        g.strokeStyle = '#e9b949';
        g.strokeRect(x + 8, y + 8, w - 16, h - 16);
        g.save();
        g.globalAlpha = 0.7;
        g.lineWidth = 2;
        g.strokeStyle = glow;
        g.strokeRect(x + 16, y + 16, w - 32, h - 32);
        g.restore();
        for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.deckPost(g, zone, x - 6 + sx * (w + 12), y - 6 + sy * (h + 12));
    },

    // 입구 소용돌이 문(지역 색): 돌 테두리 타원 안에서 도트 나선이 돌고, 바닥에 룬 고리(pixelfx)가 돈다
    drawGate(ctx, gate, zone) {
        const t = Game.time;
        const [outer, inner, glow] = zone.gate;
        const [rim, body, gem] = zone.post;
        const cx = gate.x + 8;
        const cy = gate.y - 34;
        const rx = 54;
        const ry = 88;
        this.drawLoopSheet(ctx, 'fx_rune_attackSpeed', cx + 6, gate.y + 34, 210, gate.y, 0.55);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, ry * 1.7);
        halo.addColorStop(0, `rgba(${glow},0.5)`);
        halo.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(cx - ry * 1.7, cy - ry * 1.7, ry * 3.4, ry * 3.4);
        ctx.restore();
        // 테두리: 진한 테, 돌, 안쪽 테
        const ring = (r1, r2, color) => this.pixelDisc(ctx, cx, cy, r1, r2, color, { k: 2, hard: true });
        ring(rx + 20, ry + 20, rim);
        ring(rx + 14, ry + 14, body);
        ring(rx + 4, ry + 4, rim);
        ring(rx, ry, outer);
        // 나선: 세 갈래 팔을 작은 네모로 찍어 도트처럼 보이게 한다
        ctx.save();
        const dot = 2 * ART_SCALE;
        for (let arm = 0; arm < 3; arm++) {
            for (let i = 0; i < 46; i++) {
                const k = i / 46;
                const ang = t * 2.4 + arm * (Math.PI * 2 / 3) + k * 5.2;
                const px = cx + Math.cos(ang) * rx * (1 - k) * 0.98;
                const py = cy + Math.sin(ang) * ry * (1 - k) * 0.98;
                ctx.fillStyle = k > 0.55 ? '#ffffff' : (i % 3 ? inner : `rgb(${glow})`);
                ctx.fillRect(snapWorld(px), snapWorld(py), dot * (k > 0.7 ? 2 : 1), dot);
            }
        }
        ctx.globalCompositeOperation = 'lighter';
        const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx * 0.8);
        core.addColorStop(0, 'rgba(255,255,255,0.85)');
        core.addColorStop(0.4, `rgba(${glow},0.35)`);
        core.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = core;
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
        ctx.restore();
        // 테두리의 보석 넷
        for (const [gx, gy] of [[cx, cy - ry - 16], [cx - rx - 14, cy], [cx + rx + 14, cy], [cx, cy + ry + 16]]) {
            const x = Math.round(gx);
            const y = Math.round(gy);
            ctx.fillStyle = rim;
            ctx.fillRect(x - 12, y - 12, 24, 24);
            ctx.fillStyle = gem;
            ctx.fillRect(x - 8, y - 8, 16, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 8, y - 8, 6, 4);
        }
        // 빨려 드는 반짝이
        for (let i = 0; i < 10; i++) {
            const k = (t * 0.8 + i / 10) % 1;
            const ang = i * 2.4 + t;
            const r = (1 - k) * ry * 1.5;
            ctx.globalAlpha = k;
            ctx.fillStyle = i % 2 ? inner : '#ffffff';
            ctx.fillRect(Math.round(cx + Math.cos(ang) * r * 0.8), Math.round(cy + Math.sin(ang) * r), 6, 6);
        }
        ctx.globalAlpha = 1;
    },

    // 그림 한 장: 발끝(footPx, 캔버스 안 높이)을 footY에 맞춘다. 왼쪽 위 모서리를 화면 정수 픽셀에 맞춰 도트가 고르게 보인다
    sprite(ctx, img, x, footY, scale, footPx, flip) {
        if (!img) return;
        const s = scale || PIXEL_SCALE;
        const w = img.width * s;
        const h = img.height * s;
        const foot = (footPx === undefined ? img.height * 0.89 : footPx) * s;
        const left = snapWorld(x - w / 2);
        const top = snapWorld(footY - foot);
        ctx.imageSmoothingEnabled = false;
        if (flip) {
            ctx.save();
            ctx.translate(left + w, top);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(img, left, top, w, h);
        }
    },

    // 도트 도형: 매끈한 선과 타원 대신 k화면px 칸으로 찍는다(칸 = k * ART_SCALE 세계 px).
    //   칸 목록은 (가로 반지름, 세로 반지름, k, 두께)마다 한 번 만든다. [dx, dy, 각(위에서 시계 방향 0~1), 중심에서의 거리 0~1, 체크무늬]
    shapeCells(rx, ry, k, thick) {
        const key = `${Math.round(rx)}|${Math.round(ry)}|${k}|${thick}`;
        this.cellCache = this.cellCache || new Map();
        let cells = this.cellCache.get(key);
        if (cells) return cells;
        const c = k * ART_SCALE;
        const nx = Math.max(1, Math.round(rx / c));
        const ny = Math.max(1, Math.round(ry / c));
        const inside = (i, j) => (i * i) / (nx * nx) + (j * j) / (ny * ny) <= 1;
        cells = [];
        for (let j = -ny; j <= ny; j++) {
            for (let i = -nx; i <= nx; i++) {
                if (!inside(i, j)) continue;
                if (thick) {
                    let edge = false;
                    for (let n = 1; n <= thick && !edge; n++) edge = !inside(i + n, j) || !inside(i - n, j) || !inside(i, j + n) || !inside(i, j - n);
                    if (!edge) continue;
                }
                cells.push([i * c, j * c, ((Math.atan2(i, -j) / (Math.PI * 2)) + 1) % 1, Math.sqrt((i * i) / (nx * nx) + (j * j) / (ny * ny)), (i + j) & 1]);
            }
        }
        this.cellCache.set(key, cells);
        return cells;
    },

    // 도트 고리. o: k(칸 크기, 기본 3), thick(두께 칸 수), dash(한 바퀴의 점선 마디 수), offset(마디 밀기), upto(위에서 시계 방향으로 여기까지만)
    pixelRing(ctx, x, y, rx, ry, color, o = {}) {
        const k = o.k || 3;
        const c = k * ART_SCALE;
        const upto = o.upto === undefined ? 1 : o.upto;
        ctx.fillStyle = color;
        for (const [dx, dy, ang] of this.shapeCells(rx, ry, k, o.thick || 1)) {
            if (ang > upto) continue;
            if (o.dash && ((Math.floor(ang * o.dash * 2 + (o.offset || 0)) % 2) + 2) % 2) continue;
            ctx.fillRect(snapWorld(x + dx - c / 2), snapWorld(y + dy - c / 2), c, c);
        }
    },

    // 도트 원판. 가장자리는 두 계단으로 옅어진다(안 65%는 그대로, 85%까지 0.6, 끝까지 0.3). hard면 꽉 채운다
    //   한 번 그린 원판은 그림으로 남겨 다시 쓴다(큰 경고 범위도 매 프레임 칸을 찍지 않는다)
    pixelDisc(ctx, x, y, rx, ry, color, o = {}) {
        const k = o.k || 3;
        const c = k * ART_SCALE;
        const cells = this.shapeCells(rx, ry, k, 0);
        if (typeof document === 'undefined') {
            ctx.fillStyle = color;
            for (const [dx, dy] of cells) ctx.fillRect(snapWorld(x + dx - c / 2), snapWorld(y + dy - c / 2), c, c);
            return;
        }
        const nx = Math.max(1, Math.round(rx / c));
        const ny = Math.max(1, Math.round(ry / c));
        const key = `${nx}|${ny}|${k}|${o.hard ? 1 : 0}|${color}`;
        this.discCache = this.discCache || new Map();
        let img = this.discCache.get(key);
        if (!img) {
            if (this.discCache.size > 400) this.discCache.clear();
            img = document.createElement('canvas');
            img.width = (nx * 2 + 1) * k;
            img.height = (ny * 2 + 1) * k;
            const g = img.getContext('2d');
            g.fillStyle = color;
            for (const [dx, dy, , r] of cells) {
                g.globalAlpha = o.hard || r <= 0.65 ? 1 : (r <= 0.85 ? 0.6 : 0.3);
                g.fillRect(Math.round(dx / c + nx) * k, Math.round(dy / c + ny) * k, k, k);
            }
            this.discCache.set(key, img);
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, snapWorld(x - (nx + 0.5) * c), snapWorld(y - (ny + 0.5) * c), (nx * 2 + 1) * c, (ny * 2 + 1) * c);
    },

    // 도트 선: 굵기 w의 네모를 반 칸씩 겹쳐 찍는다
    pixelLine(ctx, ax, ay, bx, by, color, w) {
        const s = Math.max(2, Math.round(w * WORLD_ZOOM / 2) * 2) / WORLD_ZOOM;
        const len = Math.hypot(bx - ax, by - ay);
        const n = Math.max(1, Math.ceil(len / (s / 2)));
        ctx.fillStyle = color;
        for (let i = 0; i <= n; i++) {
            const k = i / n;
            ctx.fillRect(snapWorld(ax + (bx - ax) * k - s / 2), snapWorld(ay + (by - ay) * k - s / 2), s, s);
        }
    },

    shadow(ctx, x, y, rx, ry, alpha) {
        const px = 2 * ART_SCALE;
        ctx.fillStyle = `rgba(0,0,0,${alpha === undefined ? 0.35 : alpha})`;
        for (let dy = -ry; dy < ry; dy += px) {
            const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy + px / 2) * (dy + px / 2) / (ry * ry))) / px) * px;
            ctx.fillRect(snapWorld(x - half), snapWorld(y + dy), half * 2, px);
        }
    },

    // 공격 동작의 몇 번째 프레임인지: 남은 표시 시간(atkPose)을 처음 길이(atkPoseMax)로 나눠 계산한다
    attackFrame(atkPose, atkPoseMax, frames) {
        return clamp(Math.floor((1 - atkPose / (atkPoseMax || atkPose)) * frames), 0, frames - 1);
    },

    heroSpriteName(type, dir, anim, atkPose, atkPoseMax) {
        const def = HEROES[type];
        if (atkPose > 0) {
            const clip = def.anim.attack;
            return this.plFrame(def, clip, dir, this.attackFrame(atkPose, atkPoseMax, clip.frames));
        }
        return this.plFrame(def, def.anim.walk, dir, Math.floor(anim) % def.anim.walk.frames);
    },

    plFacing(dir) {
        return { down: 'south', up: 'north', left: 'west', right: 'east' }[dir] || 'south';
    },

    // 그 동작에 실제로 있는 방향을 고른다. 서쪽이 없으면 동쪽을 뒤집어 쓴다
    plPick(clip, dir) {
        const facing = this.plFacing(dir);
        if (!clip.dirs || clip.dirs.includes(facing)) return { facing, flip: false };
        if (facing === 'west' && clip.dirs.includes('east')) return { facing: 'east', flip: true };
        return { facing: clip.dirs[0], flip: false };
    },

    plFrame(def, clip, dir, i) {
        return `${def.sprite}/animations/${clip.folder}/${this.plPick(clip, dir).facing}/frame_${String(i).padStart(3, '0')}`;
    },

    // 이번 프레임의 동작 그림을 발 위치와 좌우 반전까지 맞춰 그린다
    plSprite(ctx, img, def, clip, dir, x, footY) {
        const pick = this.plPick(clip, dir);
        const foot = typeof clip.footPx === 'number' ? clip.footPx : clip.footPx[pick.facing];
        this.sprite(ctx, img, x, footY, def.scale, foot, pick.flip);
    },

    // 용사 그림 한 장을 그린다: 동작별 발 위치와 반전
    heroSprite(ctx, img, def, atkPose, dir, x, footY) {
        this.plSprite(ctx, img, def, atkPose > 0 ? def.anim.attack : def.anim.walk, dir, x, footY);
    },

    // 계약 조항 표시: 방패(가슴 앞 푸른 방패), 되살아나기(머리 위 금빛 고리). 칸으로 찍는다
    pactMarks(ctx, h, x, footY) {
        const u = 2 * ART_SCALE;
        if (h.shield) {
            const sx = x + (h.dir === 'left' ? -16 : 16);
            const sy = footY - 46;
            const rows = ['.###.', '#@@@#', '#@@@#', '#@@@#', '.#@#.', '..#..'];
            rows.forEach((row, r) => [...row].forEach((ch, k) => {
                if (ch === '.') return;
                ctx.fillStyle = ch === '#' ? '#1c2a44' : '#8fd0ff';
                ctx.fillRect(snapWorld(sx + (k - 2.5) * u), snapWorld(sy + r * u), u, u);
            }));
        }
        if (h.revive) {
            ctx.globalAlpha = 0.6 + Math.sin(Game.time * 4 + h.lane) * 0.3;
            this.pixelRing(ctx, x, footY - (HEROES[h.type].barY || 70) - 4, 12, 4, '#ffe08a', { k: 2 });
            ctx.globalAlpha = 1;
        }
    },

    // 서 있는 그림: 다음 파티 목록에 쓴다
    heroStandName(type) {
        return `${HEROES[type].sprite}/rotations/south`;
    },

    drawHero(ctx, h) {
        const p = heroWorld(h);
        if (h.waiting) return;
        if (h.boss) {
            this.drawArtBoss(ctx, h, p, BOSSES[h.bossKey].art);
        } else {
            const def = HEROES[h.type];
            // 막혀 싸우는 동안 공격 사이에는 걷기 대신 서 있는 그림(걷기 0번 프레임)을 쓴다
            const anim = h.blocker ? 0 : h.anim;
            const skin = h.skin;
            const name = skin ? this.plFrame(skin, skin.anim.walk, h.dir, Math.floor(anim) % skin.anim.walk.frames)
                : this.heroSpriteName(h.type, h.dir, anim, h.atkPose, h.atkPoseMax);
            if (h.elite) {
                this.shadow(ctx, p.x, p.y + 9, 46, 15);
                // 정예 표시: 몸 뒤에서 도는 Asteria 오라(그림 1px = 화면 1px). 검은 바탕 그림이라 빛을 더해 그린다
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                this.drawLoopSheet(ctx, `fx_aura_${h.type}`, p.x, p.y + 10 - def.barY * 0.45, 128 * ART_SCALE, h.lane * 0.13, 0.9);
                ctx.restore();
            } else {
                this.shadow(ctx, p.x, p.y + 6, 15, 5);
            }
            const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            // 맞으면 잠깐 밀리고, 일반 용사는 걸음마다 2px씩 들썩인다
            const push = h.kick > 0 ? h.kick / HERO_KICK_TIME * (h.elite ? 8 : 14) : 0;
            const hop = !h.elite && !h.stun && !h.blocker ? Math.round(Math.abs(Math.sin(h.anim * Math.PI / 3)) * 2) * ART_SCALE : 0;
            const bx = p.x + (h.kickX || 0) * push;
            const by = p.y + 10 + (h.kickY || 0) * push - hop;
            if (skin) this.plSprite(ctx, img, skin, skin.anim.walk, h.dir, bx, by);
            else this.heroSprite(ctx, img, def, h.atkPose, h.dir, bx, by);
            if (h.shield || h.revive) this.pactMarks(ctx, h, bx, by);
            // 일반 용사는 다쳤을 때만 작은 체력바를 그린다
            if (h.elite) this.healthBar(ctx, p.x, p.y - def.barY, h.hp / h.maxHp, HP_BAR_W, '#ff5a5a');
            else if (h.hp < h.maxHp) this.healthBar(ctx, p.x, p.y - def.barY, h.hp / h.maxHp, HP_BAR_W / 2, '#ff5a5a');
        }
        if (h.haste > 0) this.hasteNotes(ctx, p.x, p.y + 9, h.d * 0.01, h.boss || h.elite ? 2 : 1.5);
        const headY = p.y - (h.boss ? BOSSES[h.bossKey].starY : HEROES[h.type].barY + 12);
        // 기절은 머리 위를 도는 별과 새(pixelfx), 화상은 몸에 붙은 불꽃, 빙결은 몸에 덮인 서리 빛
        if (h.stun > 0) this.drawLoopSheet(ctx, 'fx_stunned', p.x, headY, h.boss ? 150 : 90, h.lane * 0.1);
        if (h.burn > 0) this.drawLoopSheet(ctx, 'fx_burning', p.x, p.y + 6, h.boss ? 195 : 105, h.lane * 0.07, Math.min(1, h.burn * 2));
        if (h.slow > 0) this.frostAura(ctx, p.x, p.y + 9, headY, Math.min(1, h.slow * 2));
        if (h.curse > 0) this.curseMark(ctx, p.x, headY - 45, h.curse);
    },

    // 빙결된 용사: 발밑 서리 바닥과 떨어지는 얼음 조각
    frostAura(ctx, x, footY, headY, a) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * a;
        this.pixelDisc(ctx, x, footY, 50, 16, '#78c8ff');
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
            const k = (Game.time * 0.8 + i / 4 + x * 0.003) % 1;
            ctx.fillStyle = `rgba(220,245,255,${(1 - k) * a})`;
            ctx.fillRect(snapWorld(x + Math.sin(i * 2.3 + x) * 33), snapWorld(headY + k * (footY - headY)), 4 * ART_SCALE, 4 * ART_SCALE);
        }
        ctx.restore();
    },

    // 보스(부대장, 대마도사, 토벌 보스): Asteria 그림. 경고(windup) 동안은 공격 동작(windupLoop면 반복, 아니면 첫 프레임에 멈춤),
    // 공격은 공격 동작을 한 번 재생한다. 돌진 중에는 뒤에 보라 잔상을 남긴다
    drawArtBoss(ctx, h, p, art) {
        let clip = art.anim.walk;
        let i = Math.floor(h.blocker ? 0 : h.anim) % clip.frames;
        if (h.windup > 0) {
            clip = art.anim.attack;
            i = art.windupLoop ? Math.floor(Game.time * 10) % clip.frames : 0;
        } else if (h.atkPose > 0) {
            clip = art.anim.attack;
            i = this.attackFrame(h.atkPose, h.atkPoseMax, clip.frames);
        }
        const name = this.plFrame(art, clip, h.dir, i);
        this.shadow(ctx, p.x, p.y + 10, 84, 26);
        // 걷는 그림이 한 장인 보스: 발끝을 기준으로 뒤뚱거린다
        const bob = art.bob && !h.windup;
        if (bob) {
            // 그림을 기울이거나 늘리지 않는다(도트가 일그러진다). 한 장을 통째로 들썩인다
            ctx.save();
            ctx.translate(0, -Math.round(Math.abs(Math.sin(h.anim * 0.9)) * 4) * ART_SCALE);
        }
        if (art.windupLoop) {
            // 발밑의 푸른 전류 고리: 경고 중에는 더 밝게 떤다
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const hot = h.windup > 0 ? 1 : 0;
            const pulse = 0.45 + Math.sin(Game.time * (hot ? 30 : 5)) * 0.15 + hot * 0.3;
            ctx.globalAlpha = pulse * 0.35;
            this.pixelDisc(ctx, p.x, p.y + 10, 96, 30, '#5ab4ff');
            ctx.globalAlpha = Math.min(1, pulse);
            this.pixelRing(ctx, p.x, p.y + 10, 96, 30, '#96dcff', { thick: 2, dash: hot ? 0 : 10, offset: Game.time * 3 });
            ctx.restore();
        }
        if (h.chargeTime > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.4;
            const back = pathAt(h.d - 54, h.route);
            this.plSprite(ctx, Assets.tinted(name, '#a56bff', 0.9), art, clip, h.dir, back.x, back.y + 10);
            ctx.restore();
        }
        const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
        this.plSprite(ctx, img, art, clip, h.dir, p.x, p.y + 10);
        if (bob) ctx.restore();
    },

    // 음유시인 가속 표시: 발밑에서 떠오르는 초록 음표. 상태 없이 시간만으로 계산한다
    hasteNotes(ctx, x, y, seed, size) {
        const t = Game.time + seed;
        const snap = v => Math.round(v / 2) * 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22;
        this.pixelDisc(ctx, x, y, 36 * size, 12 * size, '#78ffaa');
        ctx.restore();
        for (let i = 0; i < 3; i++) {
            const k = (t * 0.9 + i / 3) % 1;
            const nx = snap(x + Math.sin(i * 2.1 + seed * 5) * 26 * size + Math.sin(t * 3 + i) * 6);
            const ny = snap(y - 8 - k * 70 * size);
            const a = Math.min(1, (1 - k) * 2) * Math.min(1, k * 8);
            const s = 2 * Math.round(size * 1.5);
            ctx.fillStyle = `rgba(40,90,50,${a * 0.8})`; // 어두운 바닥에서 떨어져 보이게 1도트 그림자
            this.noteGlyph(ctx, nx + s / 2, ny + s / 2, s);
            ctx.fillStyle = i === 1 ? `rgba(255,240,150,${a})` : `rgba(140,255,180,${a})`;
            this.noteGlyph(ctx, nx, ny, s);
        }
    },

    // 도트 음표 한 개: 머리, 기둥, 꼬리. s는 도트 한 칸 크기
    noteGlyph(ctx, x, y, s) {
        ctx.fillRect(x - 2 * s, y - s, 3 * s, 2 * s);
        ctx.fillRect(x, y - 6 * s, s, 6 * s);
        ctx.fillRect(x + s, y - 6 * s, s, s);
        ctx.fillRect(x + 2 * s, y - 5 * s, s, 2 * s);
    },

    healthBar(ctx, x, y, ratio, w, color) {
        if (ratio >= 0.999) return;
        // 테두리 1.5(화면 1px)를 두르고 화면 정수 픽셀에 맞춘다
        const left = snapWorld(x - w / 2);
        const top = snapWorld(y);
        ctx.fillStyle = '#0a0812';
        ctx.fillRect(left - 3, top - 3, w + 6, HP_BAR_H + 6);
        ctx.fillStyle = color;
        ctx.fillRect(left, top, snapWorld(w * clamp(ratio, 0, 1)), HP_BAR_H);
    },

    stunStars(ctx, x, y) {
        const t = Game.time * 5;
        ctx.fillStyle = '#ffe36b';
        for (let i = 0; i < 3; i++) {
            const a = t + i * 2.1;
            ctx.fillRect(Math.round(x + Math.cos(a) * 40) - 4, Math.round(y + Math.sin(a) * 13) - 4, 8, 8);
        }
    },

    // 타락 유닛
    drawUnit(ctx, u) {
        const def = HEROES[u.heroType];
        // 타락 유닛은 시체 자리에 멈춰 싸우므로 공격 사이에는 서 있는 그림(걷기 0번 프레임)을 쓴다
        const name = this.heroSpriteName(u.heroType, u.dir || 'down', 0, u.atkPose, u.atkPoseMax);
        const risen = u.rise > 0 ? clamp(1 - u.rise / 0.5, 0, 1) : 1;
        this.shadow(ctx, u.x, u.y + 9, 30, 10, 0.6);
        this.drawCorruptAura(ctx, u.x, u.y + 9, risen, u.x * 0.013);
        this.drawCorruptSprite(ctx, name, def, u.atkPose, u.dir || 'down', u.x, u.y + 10, risen, u.flash > 0);
        this.healthBar(ctx, u.x, u.y - def.barY - 2, u.hp / u.maxHp, HP_BAR_W, '#c56bff');
        if (u.stun > 0) this.stunStars(ctx, u.x, u.y - def.barY - 16);
    },

    // 타락 표시: 발밑에서 도는 도트 룬 고리와 위로 떠오르는 입자. seed로 유닛마다 박자를 어긋낸다.
    // 일어나는 중(risen < 1)에는 고리가 안에서 밖으로 퍼진다. calm이면 입자 없이 고리만 그린다(타락 가능한 시체).
    drawCorruptAura(ctx, x, y, risen, seed, calm) {
        const t = Game.time + seed;
        const grow = 0.35 + 0.65 * risen;
        const rx = 34 * grow;
        const ry = 12 * grow;
        const snap = v => Math.round(v / 2) * 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 고리 안쪽의 은은한 빛
        const pulse = 0.22 + Math.sin(t * 4) * 0.06;
        ctx.globalAlpha = pulse + 0.1;
        this.pixelDisc(ctx, x, y, rx, ry, '#c846ff');
        ctx.globalAlpha = 1;
        // 도트 고리: 작은 점 사이사이에 십자 모양 룬 4개
        const spin = t * 0.9;
        for (let i = 0; i < 20; i++) {
            const a = spin + i / 20 * Math.PI * 2;
            const px = snap(x + Math.cos(a) * rx);
            const py = snap(y + Math.sin(a) * ry);
            const front = Math.sin(a) > 0; // 앞쪽 절반을 더 밝게 해 바닥에 누운 고리처럼 보이게 한다
            if (i % 5 === 0) {
                ctx.fillStyle = front ? '#ff9cf2' : 'rgba(230,110,255,0.7)';
                ctx.fillRect(px - 2, py - 6, 4, 12);
                ctx.fillRect(px - 6, py - 2, 12, 4);
            } else {
                ctx.fillStyle = front ? 'rgba(240,120,255,0.95)' : 'rgba(170,70,240,0.6)';
                ctx.fillRect(px - 2, py - 2, 4, 4);
            }
        }
        // 떠오르는 입자: 상태 없이 시간만으로 계산한다
        for (let i = 0; i < (calm ? 0 : 7); i++) {
            const k = (t * 0.7 + i / 7 + Math.sin(i * 12.9898 + seed) * 0.5 + 1) % 1;
            const px = snap(x + Math.sin(i * 2.4 + seed * 3) * rx * 0.8 + Math.sin(t * 2 + i) * 3);
            const py = snap(y - k * 90 * grow);
            const a = (1 - k) * (k < 0.1 ? k * 10 : 1);
            ctx.fillStyle = i % 3 === 0 ? `rgba(255,210,255,${a})` : `rgba(220,90,255,${a})`;
            const s = i % 3 === 0 ? 4 : 6;
            ctx.fillRect(px - s / 2, py - s / 2, s, s);
        }
        ctx.restore();
    },

    // 타락 그림: 본 그림은 살짝만 물들이고, 밝은 자주색 윤곽선으로 어두운 바닥에서 떼어 낸다.
    // 일어나는 중에는 발밑 아래를 잘라 땅속에서 솟아오르게 하고 윤곽선이 하얗게 달아올랐다 식는다.
    drawCorruptSprite(ctx, name, def, atkPose, dir, x, footY, risen, flash) {
        const ease = 1 - Math.pow(1 - risen, 3);
        const sink = (1 - ease) * 100;
        ctx.save();
        if (risen < 1) {
            // 땅에서 솟는 빛기둥: 시체 타락 연출의 빛줄기에서 이어져 다 일어나면 꺼진다
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const k = 1 - ease;
            const col = ctx.createLinearGradient(0, footY - 150, 0, footY);
            col.addColorStop(0, 'rgba(230,110,255,0)');
            col.addColorStop(1, `rgba(255,170,250,${0.75 * k})`);
            ctx.fillStyle = col;
            ctx.fillRect(x - 30, footY - 150, 60, 150);
            ctx.fillStyle = `rgba(255,235,255,${0.8 * k})`;
            ctx.fillRect(x - 40, footY - 4, 80, 6);
            ctx.restore();
            ctx.beginPath();
            ctx.rect(x - 120, footY - 260, 240, 262);
            ctx.clip();
        }
        const draw = (img, ox, oy) => this.heroSprite(ctx, img, def, atkPose, dir, x + ox, footY + sink + oy);
        this.corruptOutline(ctx, name, def.scale, draw, risen < 1 ? '#ffe6ff' : '#ff6be6', 1);
        draw(flash ? Assets.tinted(name, '#ffffff', 0.85) : Assets.tinted(name, '#7c2bd6', 0.22), 0, 0);
        ctx.restore();
    },

    // 상하좌우로 1도트 어긋난 밝은 실루엣과, 그 바깥 2도트의 보라 발광을 먼저 깐다. 위에 본 그림을 그리면 윤곽선만 남는다.
    // draw(img, ox, oy)는 그림을 제자리에서 (ox, oy)만큼 밀어 그리는 함수다.
    corruptOutline(ctx, name, dot, draw, color, strength) {
        const ring = (img, r) => {
            for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) draw(img, ox * dot, oy * dot);
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 * strength;
        ring(Assets.tinted(name, '#c040ff', 1), 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = strength;
        ring(Assets.tinted(name, color, 1), 1);
        ctx.restore();
    },

    // 몬스터의 지금 그림 이름: 공격 중이면 공격 동작을 한 번, 아니면 대기 동작을 천천히 반복한다(idleFps 0이면 첫 프레임)
    monsterFrame(def, m) {
        const art = def.art;
        if (m.atkPose > 0) {
            const clip = art.anim.attack;
            return { clip, name: this.plFrame(def, clip, m.dir, this.attackFrame(m.atkPose, m.atkPoseMax, clip.frames)) };
        }
        if (m.moving && art.anim.walk) {
            const walk = art.anim.walk;
            return { clip: walk, name: this.plFrame(def, walk, m.dir, Math.floor(m.anim * MONSTER_WALK_FPS) % walk.frames) };
        }
        const clip = art.anim.idle;
        const i = art.idleFps ? Math.floor(m.anim * art.idleFps) % clip.frames : 0;
        return { clip, name: this.plFrame(def, clip, m.dir, i) };
    },

    // 모든 몬스터 주변을 떠다니는 종족 효과(도트). 등급이 높을수록 조금 많다. 시간과 자리로만 정해 판 결과와 무관하다
    //   악마 불티는 빠르게 솟고, 언데드 혼불은 흔들리며 천천히 오르고, 정령은 제자리에서 반짝이고,
    //   야수는 발밑에서 풀잎과 흙먼지가 옆으로 날리고, 오크는 발밑에서 먼지가 피어오른다
    familyAmbient(ctx, m, def, footY, front) {
        const t = Game.time;
        const seed = (m.homeX || m.x) * 0.0137 + (m.homeY || m.y) * 0.0071;
        const [cw] = def.art.cells || [1, 1];
        const bodyW = def.art.hand ? def.art.hand.x / 0.3 : TILE * cw;
        const halfW = Math.max(TILE * 0.3, bodyW * 0.45);
        const bodyH = (def.art.barY || 120) * 0.85;
        const unit = ART_SCALE;
        const n = 5 + GRADE_ORDER.indexOf(def.grade) * 3;
        const fam = def.family;
        const pal = MONSTER_PALETTES[m.type] || ['#5a3a6a', '#9a6cff', '#e2b0ff', '#ffffff'];
        // 발밑의 종족 얼룩: 잡음으로 만든 불규칙한 도트 자국(원이 아니다). 몬스터 종류마다 모양이 다르고 한 번 만들어 둔다
        if (!front) this.drawGroundMark(ctx, m, def, footY, halfW);
        // 몸 둘레를 도는 종족 효과(뒤쪽 반은 몸 뒤, 앞쪽 반은 몸 앞)
        this.drawOrbiters(ctx, m, def, footY, halfW, bodyH, front);
        for (let i = 0; i < n; i++) {
            if ((i % 2 === 1) !== front) continue;
            const r1 = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
            const rnd = r1 - Math.floor(r1); // 이 불티만의 고정 값
            let x, y, size, color, alpha;
            if (fam === 'demon') {
                const k = ((t * (0.9 + rnd * 0.6) + rnd) % 1);
                x = m.x + (rnd - 0.5) * halfW * 1.6 + Math.sin(t * 5 + i) * 4;
                y = footY - k * bodyH * 1.1;
                size = (rnd > 0.6 ? 2 : 1) * unit * 2;
                color = [pal[2], pal[3], '#ffd23d'][i % 3];
                alpha = 1 - k;
            } else if (fam === 'undead') {
                const k = ((t * (0.25 + rnd * 0.15) + rnd) % 1);
                x = m.x + (rnd - 0.5) * halfW * 1.8 + Math.sin(t * 1.6 + i * 1.7) * 14;
                y = footY - 6 - k * bodyH;
                size = 2 * unit * 2;
                color = i % 3 === 0 ? pal[3] : pal[2];
                alpha = Math.sin(k * Math.PI);
            } else if (fam === 'spirit') {
                const ang = rnd * Math.PI * 2 + t * 0.4;
                x = m.x + Math.cos(ang) * halfW * (0.7 + rnd * 0.5);
                y = footY - bodyH * (0.25 + rnd * 0.65) + Math.sin(t * 2 + i) * 6;
                const blink = (Math.sin(t * (2.5 + rnd * 2) + i * 2.1) + 1) / 2;
                size = 2 * unit;
                color = [pal[2], '#ffffff', pal[3]][i % 3];
                alpha = blink;
                if (blink > 0.85) {
                    ctx.globalAlpha = blink;
                    ctx.fillStyle = color;
                    ctx.fillRect(snapWorld(x - size), snapWorld(y), size * 3, unit * 2);
                    ctx.fillRect(snapWorld(x + size / 2 - unit), snapWorld(y - size), unit * 2, size * 3);
                }
            } else if (fam === 'beast') {
                const k = ((t * (0.35 + rnd * 0.2) + rnd) % 1);
                const dir = rnd > 0.5 ? 1 : -1;
                x = m.x + dir * (k * halfW * 1.4) + (rnd - 0.5) * 20;
                y = footY - 4 - Math.sin(k * Math.PI) * 22 - rnd * 10;
                size = 2 * unit;
                color = i % 2 ? pal[2] : pal[1];
                alpha = Math.sin(k * Math.PI);
            } else {
                const k = ((t * (0.5 + rnd * 0.3) + rnd) % 1);
                x = m.x + (rnd - 0.5) * halfW * 1.6;
                y = footY - 2 - k * 30;
                size = (1 + Math.floor(k * 2)) * unit * 2;
                color = '#8a7a66';
                alpha = (1 - k) * 0.85;
            }
            ctx.globalAlpha = clamp(alpha, 0, 1);
            ctx.fillStyle = color;
            ctx.fillRect(snapWorld(x), snapWorld(y), size, size);
        }
        ctx.globalAlpha = 1;
    },

    // 발밑 자국: 종족별 색과 모양. 악마는 갈라진 불씨, 언데드는 번지는 독기, 정령은 흩어진 서리, 야수는 풀포기, 오크는 흙먼지
    drawGroundMark(ctx, m, def, footY, halfW) {
        const fam = def.family;
        const cell = 2 * ART_SCALE;
        const rx = Math.round(halfW * 1.15 / cell);
        const ry = Math.max(3, Math.round(rx * 0.36));
        const key = `mark|${m.type}|${rx}`;
        this.markCache = this.markCache || new Map();
        let mark = this.markCache.get(key);
        if (!mark) {
            mark = [];
            let s = hashSeed(key);
            const rand = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((s >>> 0) % 10000) / 10000; };
            // 거친 잡음 격자(4칸마다 값)를 겹쳐 얼룩 모양을 만든다
            const grid = [];
            for (let i = 0; i <= rx * 2 / 4 + 2; i++) { grid.push([]); for (let j = 0; j <= ry * 2 / 4 + 2; j++) grid[i].push(rand()); }
            const noise = (x, y) => {
                const gx = (x + rx) / 4, gy = (y + ry) / 4;
                const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
                const a = grid[i][j], b = grid[i + 1][j], c = grid[i][j + 1], d = grid[i + 1][j + 1];
                return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
            };
            for (let y = -ry; y <= ry; y++) {
                for (let x = -rx; x <= rx; x++) {
                    const r = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
                    if (r > 1.25) continue;
                    const v = noise(x, y) * 0.9 + (1 - r) * 0.75 + (rand() - 0.5) * 0.25;
                    if (v > 0.78) mark.push([x, y, v > 1.05 ? 2 : 1]);
                }
            }
            // 악마: 가운데에서 뻗는 갈라짐
            if (fam === 'demon') {
                for (let k = 0; k < 4; k++) {
                    let x = 0, y = 0;
                    const ang = rand() * Math.PI * 2;
                    for (let step = 0; step < rx * 0.9; step++) {
                        x += Math.cos(ang) + (rand() - 0.5) * 1.2;
                        y += Math.sin(ang) * 0.4 + (rand() - 0.5) * 0.6;
                        mark.push([Math.round(x), Math.round(y), 3]);
                    }
                }
            }
            this.markCache.set(key, mark);
        }
        const colors = {
            demon: ['#7a2a10', '#c8461a', '#ffb03d'], undead: ['#4a2e6a', '#7a4ec0', '#7dffb0'], spirit: ['#3e6a88', '#6fb8e0', '#e8fbff'],
            beast: ['#3e5a22', '#6a8c3a', '#b8e07a'], orc: ['#5a4632', '#8a6a46', '#d8b47a']
        }[fam] || ['#5a4632', '#8a6a46', '#d8b47a'];
        const glow = 0.55 + Math.sin(Game.time * 3 + m.x * 0.01) * 0.25;
        for (const [x, y, kind] of mark) {
            ctx.globalAlpha = kind === 3 ? glow : (kind === 2 ? 0.6 : 0.45);
            ctx.fillStyle = colors[kind - 1];
            ctx.fillRect(snapWorld(m.x + x * cell), snapWorld(footY + y * cell), cell, cell);
        }
        ctx.globalAlpha = 1;
    },

    // 몸 둘레를 도는 종족 오브젝트: 전설부터. 몬스터 그림에서 뽑은 색(MONSTER_PALETTES)으로 명암을 넣은 작은 도트 그림이고,
    // 몬스터와 같은 밀도(그림 1px = 화면 1px)다. 신화는 수가 많고 두 겹 궤도를 돌며 빛 꼬리를 남긴다
    orbiterImage(fam, pal) {
        const key = `orb|${fam}|${pal.join()}`;
        this.orbCache = this.orbCache || new Map();
        if (this.orbCache.has(key)) return this.orbCache.get(key);
        const art = ORBITER_ART[fam] || ORBITER_ART.spirit;
        const h = art.length;
        const w = art[0].length;
        if (typeof document === 'undefined') return null;
        const cv = document.createElement('canvas');
        cv.width = w + 2;
        cv.height = h + 2;
        const g = cv.getContext('2d');
        const tone = { d: pal[0], m: pal[1], l: pal[2], w: '#ffffff', a: pal[3] };
        const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && art[y][x] !== '.';
        // 테두리: 칠한 칸 둘레를 아주 어두운 색으로
        g.fillStyle = '#140c10';
        for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
            if (filled(x, y)) continue;
            if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const ch = art[y][x];
            if (ch === '.') continue;
            g.fillStyle = tone[ch];
            g.fillRect(x + 1, y + 1, 1, 1);
        }
        this.orbCache.set(key, cv);
        return cv;
    },

    drawOrbiters(ctx, m, def, footY, halfW, bodyH, front) {
        const fx = gradeInfo(def.grade, 'fx', 0);
        if (fx < 2) return; // 전설부터
        const pal = MONSTER_PALETTES[m.type] || ['#5a3a6a', '#9a6cff', '#e2b0ff', '#ffffff'];
        const img = Assets.get(`orb_${m.type}`) || this.orbiterImage(def.family, pal); // 몬스터 색으로 칠한 24px 그림(tools/import_orbiters.py)
        if (!img) return;
        const t = Game.time;
        const s = ART_SCALE;
        const seed = (m.homeX || m.x) * 0.013;
        const rings = fx >= 3 ? [{ n: 4, speed: 1.1, rx: 1.6, lift: 0.42 }, { n: 3, speed: -1.6, rx: 1.15, lift: 0.7 }] : [{ n: 3, speed: 1.2, rx: 1.5, lift: 0.45 }];
        for (const [ri, ring] of rings.entries()) {
            const rx = Math.max(halfW * ring.rx, TILE * 0.6);
            const ry = rx * 0.3;
            const cy = footY - bodyH * ring.lift;
            for (let i = 0; i < ring.n; i++) {
                const ang = t * ring.speed + i / ring.n * Math.PI * 2 + seed + ri;
                if ((Math.sin(ang) > 0) !== front) continue;
                const bob = Math.sin(t * 2.3 + i * 1.7 + ri) * 6;
                const at = a => ({ x: m.x + Math.cos(a) * rx, y: cy + Math.sin(a) * ry + bob });
                // 꼬리: 지나온 자리에 같은 그림을 점점 옅게(신화는 길게)
                const tail = fx >= 3 ? 5 : 3;
                for (let k = tail; k >= 1; k--) {
                    const q = at(ang - Math.sign(ring.speed) * k * 0.09);
                    ctx.globalAlpha = 0.5 * (1 - k / (tail + 1));
                    ctx.drawImage(img, snapWorld(q.x - img.width * s / 2), snapWorld(q.y - img.height * s / 2), img.width * s, img.height * s);
                }
                const p = at(ang);
                ctx.globalAlpha = 1;
                ctx.drawImage(img, snapWorld(p.x - img.width * s / 2), snapWorld(p.y - img.height * s / 2), img.width * s, img.height * s);
                // 신화: 가끔 하얀 반짝임
                if (fx >= 3 && Math.floor(t * 3 + i + ri) % 4 === 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(snapWorld(p.x - 3 * s), snapWorld(p.y - img.height * s / 2 - 2 * s), 7 * s, s);
                    ctx.fillRect(snapWorld(p.x), snapWorld(p.y - img.height * s / 2 - 5 * s), s, 7 * s);
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    // 영웅 이상 몬스터의 존재감: 등급 색 윤곽선, 피어오르는 도트 불티, 전설부터 발밑의 도는 점 고리.
    // 등급이 높을수록 많고 진하다(영웅 fx 1, 전설 2, 신화 3). front가 거짓이면 몸 뒤, 참이면 몸 앞을 그린다
    //   모두 시간과 몬스터 자리로 정해 판 결과와 무관하다
    gradePresence(ctx, m, def, footY, name, clip, fx, front) {
        const t = Game.time;
        const seed = (m.homeX || m.x) * 0.0137 + (m.homeY || m.y) * 0.0071;
        const grade = MONSTER_GRADES[def.grade];
        const rainbow = grade.rainbow;
        const colorAt = i => (rainbow ? rainbow[(i + Math.floor(t * 2)) % (rainbow.length - 1)] : grade.color);
        const [cw] = def.art.cells || [1, 1];
        const halfW = cw * TILE * 0.42;
        const bodyH = (def.art.barY || 120) * 0.85;
        const px = 2 * ART_SCALE;
        // 발밑의 도는 점 고리(전설부터): 뒤쪽 반은 몸 뒤, 앞쪽 반은 몸 앞에 그린다(그림자에 가리지 않게)
        if (fx >= 2) {
            {
                const rings = fx >= 3 ? 2 : 1;
                for (let k = 0; k < rings; k++) {
                    const rx = halfW * (1 + k * 0.25);
                    const ry = rx * 0.32;
                    const n = 18 + k * 6;
                    ctx.fillStyle = k ? colorAt(1) : grade.color;
                    ctx.globalAlpha = 0.9 - k * 0.2;
                    for (let i = 0; i < n; i++) {
                        if ((i + Math.floor(t * 6)) % 3 === 0) continue; // 점선이 돈다
                        const ang = i / n * Math.PI * 2 + t * (k ? -0.6 : 0.8);
                        if ((Math.sin(ang) > 0) !== front) continue;
                        ctx.fillRect(snapWorld(m.x + Math.cos(ang) * rx), snapWorld(footY + Math.sin(ang) * ry), px * 2, px * 2);
                    }
                }
                ctx.globalAlpha = 1;
            }
        }
        if (!front) {
            // 윤곽선: 몸 뒤에 등급 색 실루엣을 한 도트씩 밀어 그린다
            const pulse = 0.5 + Math.sin(t * 2.6 + seed * 9) * 0.5;
            const pose = this.monsterPose(def, m);
            const dot = (fx >= 2 ? 2 : 1) * ART_SCALE;
            ctx.save();
            ctx.globalAlpha = (fx >= 3 ? 1 : fx >= 2 ? 0.9 : 0.75) * (0.6 + pulse * 0.4);
            const glow = Assets.tinted(name, colorAt(0), 1);
            for (const [ox, oy] of [[-dot, 0], [dot, 0], [0, -dot], [0, dot]]) this.posedSprite(ctx, glow, def.art, clip, m.dir, m.x + ox, footY + oy, pose);
            ctx.restore();
        }
        // 피어오르는 도트 불티: 반은 몸 뒤, 반은 몸 앞
        const motes = [0, 0, 6, 12][fx];
        for (let i = 0; i < motes; i++) {
            if ((i % 2 === 1) !== front) continue;
            const k = ((t * (0.35 + (i % 3) * 0.08) + i / motes + seed) % 1 + 1) % 1;
            const x = m.x + Math.sin(i * 2.37 + seed * 5) * halfW + Math.sin(t * 1.7 + i) * 6;
            const y = footY - 10 - k * bodyH;
            const size = (i % 3 === 0 ? 6 : 4) * ART_SCALE;
            ctx.globalAlpha = Math.min(1, Math.sin(k * Math.PI) * 1.4);
            ctx.fillStyle = colorAt(i);
            ctx.fillRect(snapWorld(x), snapWorld(y), size, size);
            // 신화: 가끔 십자 반짝임
            if (fx >= 3 && i % 4 === 0 && k > 0.4 && k < 0.6) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(snapWorld(x - size), snapWorld(y + size / 2 - ART_SCALE), size * 3, 2 * ART_SCALE);
                ctx.fillRect(snapWorld(x + size / 2 - ART_SCALE), snapWorld(y - size), 2 * ART_SCALE, size * 3);
            }
        }
        ctx.globalAlpha = 1;
    },

    // 서 있는 몬스터 한 마리: 그림자와 그림. 건설 모드의 반투명 그림에도 쓴다
    monsterBody(ctx, def, m, img, clip) {
        const footY = m.y + MONSTER_FOOT;
        const w = def.art.cells ? def.art.cells[0] : 1;
        const pose = this.monsterPose(def, m);
        const bodyW = def.art.hand ? def.art.hand.x / 0.3 : TILE * w;
        const rx = Math.max(TILE * 0.3, bodyW * 0.42);
        const sx = m.x + pose.dx * 0.6;
        const lift = clamp(1 + Math.min(0, pose.dy) / 90, 0.7, 1); // 몸이 뜨면 그림자가 작아진다
        this.shadow(ctx, sx, footY - 2, rx * lift, rx * 0.3 * lift, 0.42);
        this.shadow(ctx, sx, footY - 2, rx * 0.55 * lift, rx * 0.16 * lift, 0.4); // 발이 닿는 곳은 더 진하다
        this.posedSprite(ctx, img, def.art, clip, m.dir, m.x, footY, pose);
    },

    // 프레임이 적은 Asteria 그림(art.breathe)의 자세. 배율을 바꾸지 않고 위치와 가로줄 밀기만 쓴다(도트가 일그러지지 않는다)
    //   dx, dy: 몸 전체 이동(세계 px), shear: 발에서 머리로 갈수록 그림 px당 밀리는 양(공격 때만)
    //   대기 때는 그림 한 장을 통째로 위아래로 움직인다(그림을 자르지 않아 이음선이 생기지 않는다). 나는 몬스터는 크게 떠오른다
    monsterPose(def, m) {
        const pose = { dx: 0, dy: 0, shear: 0 };
        if (!def.art.breathe) return pose;
        if (m.atkPose > 0) {
            const t = 1 - m.atkPose / (m.atkPoseMax || m.atkPose);
            const melee = MONSTER_ROLES[def.role].melee;
            const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[m.dir] || [0, 1];
            let k;
            if (melee) {
                // 뒤로 젖혔다가(준비) 빠르게 내지르고, 잠깐 멈췄다가 돌아온다
                if (t < 0.25) k = -Math.sin(t / 0.25 * Math.PI / 2) * 0.5;
                else if (t < 0.4) k = -0.5 + (t - 0.25) / 0.15 * 1.5;
                else if (t < 0.6) k = 1;
                else k = 1 - (t - 0.6) / 0.4;
            } else {
                // 원거리: 쏘는 순간 뒤로 조금 밀린다
                k = t < 0.15 ? t / 0.15 * 0.2 : -Math.sin((t - 0.15) / 0.85 * Math.PI) * 0.5;
            }
            const size = (melee ? 1 : 0.6) * (def.art.anim.attack.frames > 2 ? 0.4 : 1);
            pose.dx = dir[0] * k * 40 * size;
            pose.dy = dir[1] * k * 20 * size;
            pose.shear = dir[0] * k * 0.3 * size;
            return pose;
        }
        const phase = (m.homeX || m.x || 0) * 0.013 + (m.homeY || m.y || 0) * 0.007;
        if (m.moving) pose.dy = -Math.round(Math.abs(Math.sin(m.anim * 9)) * 3) * ART_SCALE;
        else {
            const amp = FLYING_MONSTERS.has(m.type) ? 6 : 2;
            pose.dy = -Math.round((Math.sin(Game.time * (FLYING_MONSTERS.has(m.type) ? 1.8 : 2.4) + phase) + 1) / 2 * amp) * ART_SCALE;
        }
        return pose;
    },

    // 자세대로 그린다. 그림을 4px 가로줄로 나눠 밀기 때문에 기울여도 도트 크기가 그대로다
    posedSprite(ctx, img, art, clip, dir, x, footY, pose) {
        if (!img) return;
        const pick = this.plPick(clip, dir);
        const footPx = typeof clip.footPx === 'number' ? clip.footPx : clip.footPx[pick.facing];
        if (!pose.shear) {
            this.sprite(ctx, img, x + pose.dx, footY + pose.dy, art.scale, footPx, pick.flip);
            return;
        }
        const s = art.scale;
        const iw = img.width;
        const ih = img.height;
        const left = snapWorld(x + pose.dx - iw * s / 2);
        const top = snapWorld(footY + pose.dy - footPx * s);
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (pick.flip) {
            ctx.translate(left + iw * s, top);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(left, top);
        }
        const band = 4;
        for (let sy = 0; sy < ih; sy += band) {
            const bh = Math.min(band, ih - sy);
            const shift = Math.round(pose.shear * Math.max(0, footPx - sy)) * (pick.flip ? -1 : 1);
            ctx.drawImage(img, 0, sy, iw, bh, shift * s, sy * s, iw * s, bh * s);
        }
        ctx.restore();
    },

    drawMonster(ctx, m) {
        const def = MONSTERS[m.type];
        const footY = m.y + MONSTER_FOOT;
        if (m.reveal > 0) return; // 합치기 결과: 빨려 들어가는 연출이 끝나면 나타난다
        // 끄는 중인 몬스터는 제자리에 흐리게 남긴다
        const dragged = UI.drag && UI.drag.src.monster === m;
        if (dragged) {
            ctx.save();
            ctx.globalAlpha = 0.3;
        }
        this.drawMonsterInner(ctx, m, def, footY);
        if (dragged) ctx.restore();
    },

    drawMonsterInner(ctx, m, def, footY) {
        if (m.down > 0) {
            this.drawRespawn(ctx, def, m);
            return;
        }
        const stunned = m.stun > 0;
        if (m.buffT > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.28 + Math.sin(Game.time * 6) * 0.08;
            this.pixelDisc(ctx, m.x, footY, 60, 20, '#ffd76e');
            ctx.restore();
        }
        this.drawAuraRunes(ctx, m, footY);
        const enraged = !!monsterEnrage(m);
        if (enraged) this.enrageAura(ctx, m.x, footY, m.x * 0.01);
        const { clip, name } = this.monsterFrame(def, m);
        let img = Assets.get(name);
        if (m.flash > 0) img = Assets.tinted(name, '#ffffff', 0.85);
        else if (stunned) img = Assets.tinted(name, '#7fc6ff', 0.55);
        const fx = gradeInfo(def.grade, 'fx', 0);
        this.familyAmbient(ctx, m, def, footY, false);
        if (fx) this.gradePresence(ctx, m, def, footY, name, clip, fx, false);
        this.monsterBody(ctx, def, m, img, clip);
        this.familyAmbient(ctx, m, def, footY, true);
        if (fx) this.gradePresence(ctx, m, def, footY, name, clip, fx, true);
        // 광폭화: 몸 위에 붉은 빛을 더한다(밝기는 맥박처럼 오르내린다)
        if (enraged && !(m.flash > 0)) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(Game.time * 9 + m.x) * 0.15;
            this.posedSprite(ctx, Assets.tinted(name, '#ff2a12', 1), def.art, clip, m.dir, m.x, footY, this.monsterPose(def, m));
            ctx.restore();
        }

        // 등급 표시: 발밑의 등급 색 마름모. 강화를 켜면 단계 표시도 함께 그린다
        this.gradeMark(ctx, m.x, footY + 16, def.grade);
        this.rankMark(ctx, m, footY);
        if (m.equip) this.equipMark(ctx, m.equip, m.x - 38, footY + 22);
        for (let i = 0; MONSTER_UPGRADE_ENABLED && i < m.tier; i++) {
            const sx = m.x - (m.tier - 1) * 11 + i * 22;
            const sy = footY + 44;
            ctx.fillStyle = '#1e120a';
            ctx.fillRect(sx - 8, sy - 8, 16, 16);
            ctx.fillStyle = m.tier >= 3 ? '#ffd76a' : '#c8a6ff';
            ctx.fillRect(sx - 5, sy - 5, 10, 10);
        }
        if (m.blocks) this.healthBar(ctx, m.x, footY - def.art.barY, m.hp / m.maxHp, HP_BAR_W, '#74d65a');
        if (stunned) {
            this.stunStars(ctx, m.x, footY - def.art.barY - 18);
            UIKit.text(ctx, '정지', m.x, footY - def.art.barY - 48, Math.round(22 / WORLD_ZOOM), '#9fdcff', 'center');
        }
    },

    // 광폭화 몬스터 발밑과 등 뒤의 붉은 빛, 위로 날리는 불티
    enrageAura(ctx, x, footY, seed) {
        const t = Game.time + seed;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.5 + Math.sin(t * 9) * 0.12;
        const back = ctx.createRadialGradient(x, footY - 66, 6, x, footY - 66, 120);
        back.addColorStop(0, `rgba(255,60,30,${pulse * 0.7})`);
        back.addColorStop(1, 'rgba(255,40,20,0)');
        ctx.fillStyle = back;
        ctx.fillRect(x - 120, footY - 186, 240, 240);
        ctx.globalAlpha = pulse * 0.5;
        this.pixelDisc(ctx, x, footY, 58, 19, '#ff4628');
        ctx.globalAlpha = 1;
        for (let i = 0; i < 5; i++) {
            const k = (t * 1.3 + i / 5) % 1;
            const ex = Math.round(x + Math.sin(i * 2.7 + seed * 3) * 38);
            const ey = Math.round(footY - 10 - k * 135);
            ctx.fillStyle = `rgba(255,${120 + i * 20},60,${(1 - k) * 0.9})`;
            ctx.fillRect(ex - 3, ey - 3, 6, 6);
        }
        ctx.restore();
    },

    // 저주 표식: 용사 머리 위에 떠 있는 보라 눈 문양. 남은 시간이 1초 아래면 깜빡인다
    curseMark(ctx, x, y, left) {
        if (left < 1 && Math.floor(Game.time * 8) % 2) return;
        const bob = Math.round(Math.sin(Game.time * 4 + x) * 3);
        const cy = y + bob;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, cy, 2, x, cy, 30);
        g.addColorStop(0, 'rgba(190,80,255,0.55)');
        g.addColorStop(1, 'rgba(190,80,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 30, cy - 30, 60, 60);
        ctx.restore();
        // 도트 문양: 어두운 테두리, 보라 마름모, 가운데 밝은 눈
        const s = 5;
        const diamond = (r, color) => {
            ctx.fillStyle = color;
            for (let i = -r; i <= r; i++) {
                const w = r - Math.abs(i);
                ctx.fillRect(x - (w + 1) * s + s / 2, cy + i * s - s / 2, (w * 2 + 1) * s, s);
            }
        };
        diamond(4, '#1a0726');
        diamond(3, '#a24bff');
        diamond(1, '#f2d4ff');
        ctx.fillStyle = '#3a0a52';
        ctx.fillRect(x - s / 2, cy - s / 2, s, s);
    },

    // 등급 마름모(도트): 진한 갈색 테두리에 등급 색.
    // 일반은 회백, 희귀 이상은 크고 바닥에 등급 빛. 등급 표 fx 2 이상(전설)은 더 큰 마름모에 반짝이는 테두리,
    // 신화(fx 3)는 가장 크고 붉은 무지개 빛
    gradeMark(ctx, x, y, grade) {
        const fx = gradeInfo(grade, 'fx', 0);
        const legend = fx >= 2;
        const s = grade === 'common' ? 6 : (fx >= 3 ? 11 : (legend ? 10 : 8));
        const color = UIKit.gradeFill(ctx, MONSTER_GRADES[grade].color, x - s, y - s, s * 2, s * 2);
        const px = 2 * ART_SCALE;
        const diamond = r => {
            const n = Math.ceil(r / px);
            for (let i = -n; i <= n; i++) {
                const half = (n - Math.abs(i)) * px;
                ctx.fillRect(snapWorld(x - half - px / 2), snapWorld(y + i * px - px / 2), half * 2 + px, px);
            }
        };
        ctx.save();
        ctx.fillStyle = '#1e120a';
        diamond(s + 3);
        ctx.fillStyle = color;
        diamond(s);
        // 전설 이상은 위쪽이 번쩍인다
        if (legend && Math.floor(Game.time * 3) % 2 === 0) {
            ctx.fillStyle = '#fff8d6';
            ctx.fillRect(snapWorld(x - px / 2), snapWorld(y - s), px, px * 2);
        }
        ctx.restore();
    },

    // 랭크 글자: 등급 마름모 오른쪽에 작게. D는 그리지 않아 몬스터가 많아도 맵이 어지럽지 않다. S는 금색으로 빛난다.
    // 랭크가 오른 직후(rankUp)에는 글자가 커졌다 돌아오고 머리 위에 "랭크 업"이 떠오른다
    rankMark(ctx, m, footY) {
        const rank = m.rank || 0;
        const r = MONSTER_RANKS[rank];
        const top = rank === MONSTER_RANKS.length - 1;
        const up = m.rankUp > 0 ? m.rankUp / 1.2 : 0;
        if (rank > 0) {
            const x = m.x + 22;
            const y = footY + 16;
            const size = Math.round((top ? 22 : 18) * (1 + up * 0.6));
            if (top) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(x, y, 2, x, y, 26);
                g.addColorStop(0, `rgba(255,200,60,${0.5 + Math.sin(Game.time * 5 + m.x) * 0.15})`);
                g.addColorStop(1, 'rgba(255,200,60,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - 26, y - 26, 52, 52);
                ctx.restore();
            }
            UIKit.text(ctx, r.name, x, y + 1, size, r.color, 'center', 'bold');
        }
        if (up > 0) {
            const lift = (1 - up) * 40;
            ctx.save();
            ctx.globalAlpha = Math.min(1, up * 2.5);
            const pop = up > 0.8 ? 1 + (up - 0.8) * 2.5 : 1;
            if (rank >= 3) UIKit.bigText(ctx, `랭크 ${r.name}!`, m.x, footY - MONSTERS[m.type].art.barY - 30 - lift, Math.round(34 * pop / WORLD_ZOOM), r.color, 'center', 'rgba(255,255,255,0.5)');
            ctx.restore();
        }
    },

    // 몬스터 곁의 작은 장비 그림(세계 좌표 cx, cy가 가운데). 화면에서 EQUIP_MAP_ICON px(48px의 절반)로,
    // 화면 픽셀 경계에 맞춰 최근접 표본으로 줄여 도트가 흐려지지 않게 한다
    equipMark(ctx, id, cx, cy) {
        const img = Assets.get(`equip_${id}`);
        if (!img) return;
        const s = EQUIP_MAP_ICON; // 화면 px
        const sx = Math.round(cx * WORLD_ZOOM - s / 2);
        const sy = Math.round(cy * WORLD_ZOOM - s / 2);
        const z = 1 / WORLD_ZOOM;
        ctx.save();
        ctx.fillStyle = 'rgba(30,18,10,0.85)';
        ctx.fillRect((sx - 2) * z, (sy - 2) * z, (s + 4) * z, (s + 4) * z);
        ctx.lineWidth = 2 * z;
        ctx.strokeStyle = MONSTER_GRADES[EQUIPMENT[id].grade].color;
        ctx.strokeRect((sx - 1) * z, (sy - 1) * z, (s + 2) * z, (s + 2) * z);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx * z, sy * z, s * z, s * z);
        ctx.restore();
    },

    // 장비를 얻은 자리에서 떠오르며 사라지는 장비 그림(원래 크기)과 빛
    drawDrops(ctx) {
        for (const d of Fx.drops) {
            const k = clamp(d.age / d.life, 0, 1);
            const a = k < 0.7 ? 1 : (1 - k) / 0.3;
            const y = d.y - 70 * (1 - (1 - k) * (1 - k));
            const rgb = MONSTER_GRADES[EQUIPMENT[d.id].grade].glow;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(d.x, y, 4, d.x, y, 70);
            g.addColorStop(0, `rgba(${rgb},0.7)`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(d.x - 70, y - 70, 140, 140);
            ctx.globalCompositeOperation = 'source-over';
            const img = Assets.get(`equip_${d.id}`);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                const s = 48 / WORLD_ZOOM; // 화면에서 48px(원래 크기)
                ctx.drawImage(img, d.x - s / 2, y - s / 2, s, s);
            }
            ctx.restore();
        }
    },

    // 합칠 수 있는 몬스터 발밑의 고리. hot이면 지금 놓으려는 대상이다
    mergeRing(ctx, x, y, color, hot) {
        const pulse = 0.8 + Math.sin(Game.time * 8) * 0.2;
        ctx.save();
        ctx.globalAlpha = hot ? 1 : pulse;
        const rx = hot ? 54 : 46;
        const ry = hot ? 19 : 16;
        if (hot) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.25;
            this.pixelDisc(ctx, x, y, rx, ry, color);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
        this.pixelRing(ctx, x, y, rx, ry, color, { thick: hot ? 2 : 1, dash: hot ? 0 : 10, offset: Game.time * 4 });
        ctx.restore();
    },

    // 소환·합치기 연출 한 개. pt(점)는 몬스터가 선 세계 좌표를 연출 중심(세계 좌표)으로 바꾼다
    //   합치기: delay 동안 두 몬스터가 하얗게 달아오르며 결과 자리로 빨려 들어가고, 그 뒤 빛이 터진다
    //   제물: 같은 방식으로 몬스터 하나가 왕좌로 빨려 들어가고 빛만 터진다(결과 그림과 이름 없음)
    //   터진 뒤: 등급 색 빛, 빛줄기(희귀 이상), 퍼지는 고리, 불꽃, 결과 이름. 등급이 높을수록 크고 길다
    drawPop(ctx, p, pt) {
        const g = GRADE_FX[p.grade] || GRADE_FX.common;
        const rgb = MONSTER_GRADES[p.grade].glow;
        const rainbow = gradeInfo(p.grade, 'rainbow', null); // 신화: 빛줄기와 불꽃을 무지개 색으로 돌린다
        const tint = i => (rainbow ? hexRgb(rainbow[i % (rainbow.length - 1)]) : rgb);
        const to = pt(p.to);
        ctx.imageSmoothingEnabled = false;
        if (p.delay > 0 && p.age < p.delay) {
            const k = p.age / p.delay;
            const e = k * k;
            p.from.forEach((f, i) => {
                const from = pt(f);
                const side = i ? 1 : -1;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy) || 1;
                const swirl = Math.sin(k * Math.PI) * Math.min(80, len * 0.3) * side;
                const x = from.x + dx * e - dy / len * swirl;
                const y = from.y + dy * e + dx / len * swirl;
                // 꼬리 불꽃
                ctx.fillStyle = `rgba(${rgb},${0.8 * k})`;
                for (let j = 1; j <= 4; j++) {
                    const kk = Math.max(0, k - j * 0.06);
                    const ee = kk * kk;
                    const sw = Math.sin(kk * Math.PI) * Math.min(80, len * 0.3) * side;
                    ctx.fillRect(Math.round(from.x + dx * ee - dy / len * sw) - 4, Math.round(from.y + dy * ee + dx / len * sw) - 4, 8, 8);
                }
                const name = `${MONSTERS[p.fromTypes[i]].sprite}/rotations/south`;
                const white = Math.round(Math.min(1, k * 1.6) * 4) / 4; // 색 입힌 사본 캐시가 늘지 않게 4단계로 끊는다
                const img = white > 0 ? Assets.tinted(name, '#ffffff', white) : Assets.get(name);
                this.sprite(ctx, img, x, y + 60 * (1 - 0.6 * e), MONSTERS[p.fromTypes[i]].art.scale * (1 - 0.6 * e));
            });
            return;
        }
        const t = p.age - p.delay;
        const T = g.pop;
        const k = clamp(t / T, 0, 1);
        const fade = 1 - k;
        const ease = 1 - Math.pow(1 - k, 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 불꽃: 상태 없이 시간과 번호로 위치를 정한다
        for (let i = 0; i < g.sparks; i++) {
            const ang = p.seed * 3 + i * 2.39996;
            const dist = (70 + (i % 7) * 26 + g.rays * 5) * ease;
            const x = to.x + Math.cos(ang) * dist;
            const y = to.y + Math.sin(ang) * dist * 0.8 + k * k * 90;
            const sz = i % 3 === 0 ? 10 : 6;
            ctx.fillStyle = i % 3 === 0 ? `rgba(255,255,255,${fade})` : `rgba(${tint(i)},${fade})`;
            ctx.fillRect(Math.round(x / 2) * 2 - sz / 2, Math.round(y / 2) * 2 - sz / 2, sz, sz);
        }
        ctx.restore();
        if (p.kind === 'sacrifice') return;
        // 결과 그림의 하얀 섬광: 커졌다가 줄며 사라진다
        if (t < 0.3) {
            const name = `${MONSTERS[p.type].sprite}/rotations/south`;
            ctx.save();
            ctx.globalAlpha = 1 - t / 0.3;
            this.sprite(ctx, Assets.tinted(name, '#ffffff', 1), to.x, to.y + 60, MONSTERS[p.type].art.scale * (1 + (1 - t / 0.3) * 0.15));
            ctx.restore();
        }
        // 결과 이름과 등급: 합치기는 언제나, 소환은 희귀 이상만
        if (p.kind === 'merge' || p.grade !== 'common') {
            const fx = gradeInfo(p.grade, 'fx', 0);
            const big = fx >= 1;
            const a = clamp(Math.min(t / 0.12, (T + 0.4 - t) / 0.3), 0, 1);
            const popK = t < 0.15 ? 1.5 - t / 0.15 * 0.5 : 1;
            const label = p.kind === 'summon' ? `${MONSTER_GRADES[p.grade].name} 등장!` : MONSTERS[p.type].name;
            const size = Math.round((fx >= 3 ? 80 : fx >= 2 ? 64 : big ? 52 : 38) * popK / WORLD_ZOOM);
            const ly = to.y - 200 - t * 30;
            const lx = clamp(to.x, 220, WORLD_WIDTH - 220);
            ctx.save();
            ctx.globalAlpha = a;
            UIKit.bigText(ctx, label, lx, ly, size, MONSTER_GRADES[p.grade].light, 'center', 'rgba(255,255,255,0.5)');
            if (p.kind === 'summon' || p.grade !== 'common') {
                const sub = p.kind === 'summon' ? MONSTERS[p.type].name : `${MONSTER_GRADES[p.grade].name}!`;
                UIKit.text(ctx, sub, lx, ly + size * 0.95, Math.round(26 / WORLD_ZOOM), '#ffffff', 'center', 'bold');
            }
            ctx.restore();
        }
    },

    // 막는 몬스터가 놓인 칸: 길로 나간 동안 칸이 비어 보이지 않게 바닥에 표식을 남긴다
    drawMonsterHome(ctx, m) {
        if (!m.blocks || m.down > 0 || m.reveal > 0) return;
        const x = m.homeX;
        const y = m.homeY + MONSTER_FOOT;
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(Game.time * 2 + x) * 0.08;
        this.pixelRing(ctx, x, y, 40, 14, '#ffb76b', { k: 2, dash: 9 });
        ctx.restore();
    },

    // 쓰러진 막는 몬스터: 놓은 칸에 흐린 그림과 다시 나올 때까지 남은 시간 고리
    drawRespawn(ctx, def, m) {
        const left = clamp(m.down / monsterStats(m).respawn, 0, 1);
        const x = m.homeX;
        const footY = m.homeY + MONSTER_FOOT;
        ctx.save();
        ctx.globalAlpha = 0.35;
        const name = this.plFrame(def, def.art.anim.idle, 'down', 0);
        this.plSprite(ctx, Assets.tinted(name, '#1b1030', 0.6), def.art, def.art.anim.idle, 'down', x, footY);
        ctx.restore();
        const cy = footY - 60;
        ctx.save();
        ctx.globalAlpha = 0.7;
        this.pixelDisc(ctx, x, cy, 30, 30, '#0a0614', { hard: true });
        ctx.globalAlpha = 1;
        this.pixelRing(ctx, x, cy, 29, 29, '#3a2f4c', { thick: 2 });
        this.pixelRing(ctx, x, cy, 29, 29, '#ffb76b', { thick: 2, upto: 1 - left });
        ctx.restore();
        UIKit.text(ctx, String(Math.ceil(m.down)), x, cy, Math.round(22 / WORLD_ZOOM), '#ffe0c0', 'center');
    },

    // 왕좌: 벽돌 바닥 위의 왕좌 의자(prop2_throne)와 그 앞에 선 마왕. 마왕의 발은 왕좌 칸 가운데 아래쪽이다
    drawThrone(ctx) {
        const x = tileX(THRONE_TILE.col);
        const y = tileY(THRONE_TILE.row);
        const hurt = Game.throneFlash > 0;
        const lord = Game.lordDef();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.14 + Math.sin(Game.time * 2) * 0.04;
        const g = ctx.createRadialGradient(x, y - 90, 10, x, y - 90, 260);
        g.addColorStop(0, `rgba(255,200,120,${pulse})`);
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 260, y - 350, 520, 520);
        ctx.restore();
        // 왕좌 의자는 마왕 바로 뒤(한 칸 위)에 세워 등받이가 마왕 어깨 뒤로 보이게 한다
        this.sprite(ctx, Assets.get('prop2_throne'), x, y - THRONE_BACK, PIXEL_SCALE, propFootPx('prop2_throne'));
        this.shadow(ctx, x, y + 30, 110, 30, 0.45);
        // 제물을 받으면 금빛으로 빛난다(빨려 든 몬스터가 닿은 뒤부터)
        const bless = Game.throneBless > 0 && Game.throneBless < 1.1 ? Game.throneBless / 1.1 : 0;
        if (bless > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const b = ctx.createRadialGradient(x, y - 90, 10, x, y - 90, 330);
            b.addColorStop(0, `rgba(255,225,140,${0.7 * bless})`);
            b.addColorStop(1, 'rgba(255,200,90,0)');
            ctx.fillStyle = b;
            ctx.fillRect(x - 330, y - 420, 660, 660);
            ctx.restore();
        }
        const img = hurt ? Assets.tinted(lord.sprite, '#ff4466', 0.7)
            : bless > 0 ? Assets.tinted(lord.sprite, '#ffe08a', Math.round(bless * 4) / 4 * 0.6) : Assets.get(lord.sprite);
        const bob = Math.round(Math.sin(Game.time * 1.6) * 2) * 1.5; // 화면 1~3px씩 움직인다
        this.throneFoot = y + 30 + bob; // 주문 빛(drawLordCast)이 같은 자리에 다시 그린다
        this.sprite(ctx, img, x, this.throneFoot, BOSS_SCALE, lord.footPx);
    },

    // 마왕의 주문 자세: 화면이 어두워진 위로 마왕을 빛과 함께 다시 그려 떠오르게 한다(번개를 쓰는 동안). 모든 마왕이 같다
    drawLordCast(ctx) {
        const lord = Game.lordDef();
        if (Fx.dim <= 0.3 || this.throneFoot === undefined) return;
        const x = tileX(THRONE_TILE.col);
        const y = this.throneFoot;
        const k = Math.min(1, Fx.dim / 0.75);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const c = ctx.createRadialGradient(x, y - 190, 10, x, y - 190, 330);
        c.addColorStop(0, `rgba(170,210,255,${0.55 * k})`);
        c.addColorStop(0.5, `rgba(150,110,255,${0.28 * k})`);
        c.addColorStop(1, 'rgba(150,110,255,0)');
        ctx.fillStyle = c;
        ctx.fillRect(x - 330, y - 520, 660, 660);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = k;
        this.sprite(ctx, Assets.tinted(lord.sprite, '#d8f3ff', 0.3), x, y, BOSS_SCALE, lord.footPx);
        ctx.restore();
    },

    // 끄는 동안 왕좌의 제물 표시: 발밑에 도는 금빛 고리. hot이면(왕좌 위) 더 밝고 크다
    sacrificeMark(ctx, hot) {
        const x = tileX(THRONE_TILE.col);
        const y = tileY(THRONE_TILE.row) + 30;
        const pulse = Math.sin(Game.time * 5) * 0.5 + 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = hot ? 190 : 150;
        const g = ctx.createRadialGradient(x, y - 50, 10, x, y - 50, r);
        g.addColorStop(0, `rgba(255,215,120,${hot ? 0.45 : 0.18 + pulse * 0.12})`);
        g.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - 50 - r, r * 2, r * 2);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = hot ? 1 : 0.6 + pulse * 0.4;
        this.pixelRing(ctx, x, y, hot ? 130 : 112, hot ? 46 : 40, hot ? '#fff1b0' : '#ffd76a', { thick: hot ? 2 : 1, dash: 14, offset: Game.time * 3 });
        ctx.restore();
    },

    drawCorpse(ctx, c) {
        const def = HEROES[c.type];
        if (c.skin) {
            const k = clamp(c.age / 0.22, 0, 1);
            const name = this.plFrame(c.skin, c.skin.anim.walk, c.dir, Math.floor(c.anim) % c.skin.anim.walk.frames);
            const fade = clamp((c.life - c.age) / 0.5, 0, 1);
            const img = Assets.tinted(name, '#1b1030', 0.25 + k * 0.45);
            if (!img) return;
            const footY = c.y + 10 + (c.kickY || 0) * 18 * k;
            const x = c.x + (c.kickX || 0) * 18 * k;
            ctx.save();
            ctx.globalAlpha = 0.9 * fade;
            ctx.translate(x, footY);
            ctx.scale(1, 1 - k * 0.72);
            ctx.translate(-x, -footY);
            this.plSprite(ctx, img, c.skin, c.skin.anim.walk, c.dir, x, footY);
            ctx.restore();
            return;
        }
        const fall = def.anim.death; // 쓰러지는 동작을 재생한 뒤 마지막 프레임을 유지한다
        const name = this.plFrame(def, fall, c.dir, Math.min(fall.frames - 1, Math.floor(c.age * CORPSE_FALL_FPS)));
        const left = 1 - c.age / c.life;
        // 타락이 꺼져 있으면 깜빡임 대신 마지막 CORPSE_FADE_TIME초 동안 서서히 사라진다
        const blink = !CORRUPTION_ENABLED ? 0.9 * Math.min(1, (c.life - c.age) / CORPSE_FADE_TIME)
            : left < 0.3 ? (Math.floor(Game.time * 8) % 2 === 0 ? 0.45 : 0.9) : 0.9;
        const hovered = UI.hoverCorpse === c;
        // 지금 클릭하면 바로 타락시킬 수 있는 시체만 고리와 윤곽선으로 부른다
        const ready = CORRUPTION_ENABLED && Game.gold >= c.cost && Game.units.filter(u => u.kind === 'corrupt').length < COMBAT_RULES.corruptMax;
        if (ready) this.drawCorruptAura(ctx, c.x, c.y + 10, hovered ? 1 : 0.8, c.x * 0.013, true);
        ctx.save();
        ctx.globalAlpha = blink;
        const img = hovered ? Assets.tinted(name, '#b56bff', 0.3) : Assets.tinted(name, '#1b1030', ready ? 0.2 : 0.4);
        if (img) {
            const draw = (im, ox, oy) => this.plSprite(ctx, im, def, fall, c.dir, c.x + ox, c.y + 10 + oy);
            if (ready) this.corruptOutline(ctx, name, def.scale, draw, hovered ? '#ffe6ff' : '#ff6be6', hovered ? 1 : 0.55 + Math.sin(Game.time * 6) * 0.25);
            draw(img, 0, 0);
        }
        ctx.restore();
        if (!CORRUPTION_ENABLED) return;

        // 남은 시간 고리
        ctx.save();
        this.pixelRing(ctx, c.x, c.y - 69, 14, 14, '#120a22', { k: 2, thick: 2 });
        this.pixelRing(ctx, c.x, c.y - 69, 14, 14, ready ? '#ff6be6' : '#6a5f7c', { k: 2, thick: 2, upto: left });
        ctx.restore();
        UIKit.text(ctx, `${c.cost}`, c.x, c.y - 100, Math.round((hovered ? 24 : 18) / WORLD_ZOOM), ready ? '#ffd6fb' : '#8f8599', 'center');
    },

    drawProjectile(ctx, p) {
        // 투사체 모양: 몬스터 표의 art.shot(시트 또는 'bolt'). 없으면 화살(무거운 화살은 2배)과 보라 마력 구체
        const shot = p.shot || (p.kind === 'arrow' ? (p.big ? 'fx_arrowBig' : 'fx_arrowPoison') : null);
        if (shot && FX_SHEETS[shot]) {
            const sheet = FX_SHEETS[shot];
            const frame = Math.floor(Game.time / sheet.life * sheet.frames) % sheet.frames;
            this.drawSheetFrame(ctx, shot, frame, p.x, p.y, (p.big ? 2 : 1) * sheet.fit / WORLD_ZOOM, p.angle || 0); // 화면 1배, 무거운 화살 2배
        } else {
            // 'bolt'은 몬스터 빛 색(glow)으로, 마력 구체는 보라로
            const rgb = shot === 'bolt' && p.glow ? p.glow : '180,100,255';
            const r = p.kind === 'arrow' ? 22 : 32;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
            g.addColorStop(0, 'rgba(255,245,255,1)');
            g.addColorStop(0.4, `rgba(${rgb},0.9)`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
            ctx.restore();
        }
    },

    // 맵 기믹 칸: 강화 제단과 저주받은 땅 그림(64px, 그림 1px = 화면 1px). 제단 룬은 천천히 달아오른다. 판 중에 늘 보인다
    drawMapTiles(ctx) {
        if (!Game.inPlay()) return;
        const map = MAPS[currentMap];
        const decal = (name, c, r) => {
            const img = Assets.get(name);
            if (!img) return;
            const s = img.width * ART_SCALE;
            ctx.drawImage(img, snapWorld(tileX(c) - s / 2), snapWorld(tileY(r) - s / 2), s, s);
        };
        for (const [c, r] of map.cursed) decal('decal_cursed', c, r);
        for (const [c, r] of map.altars) {
            decal('decal_altar', c, r);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.18 + Math.sin(Game.time * 2 + c) * 0.14;
            decal('decal_altar', c, r);
            ctx.restore();
        }
    },

    // 몬스터를 놓을 수 있는 길 옆 칸: 건설 모드에서는 밝게, 준비 시간에는 흐리게 보여 준다. 길 칸에는 놓을 수 없다
    drawBuildPads(ctx) {
        const placing = !!UI.drag;
        if (!placing && Game.state !== 'prep') return;
        const pulse = placing ? 0.42 + Math.sin(Game.time * 5) * 0.1 : 0.14 + Math.sin(Game.time * 3) * 0.05;
        const color = '255,238,180'; // 이끼 바닥 위에서 잘 보이는 연한 금색
        ctx.lineWidth = 3;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            const occupant = Game.monsterAt(c, r);
            if (occupant && !(UI.drag && UI.drag.src.monster === occupant)) continue;
            const x = c * TILE;
            const y = MAP_TOP + r * TILE;
            if (placing) {
                ctx.fillStyle = `rgba(${color},${pulse * 0.15})`;
                ctx.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
            }
            ctx.strokeStyle = `rgba(${color},${pulse})`;
            ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
        }
    },

    // 건설 모드에서 마우스가 있는 칸: 지을 수 있으면 금색, 없으면 빨간색
    drawHoverCell(ctx) {
        const cell = UI.drag && UI.hoverCell;
        if (!cell || Game.state === 'title') return;
        const ok = UI.canPlaceAt(cell.col, cell.row);
        // 큰 몬스터는 차지할 칸 전체를 보여 준다
        const [cw, ch] = monsterCells(UI.drag.type);
        const x = cell.col * TILE;
        const y = MAP_TOP + (cell.row - ch + 1) * TILE;
        ctx.lineWidth = 4;
        ctx.strokeStyle = ok ? '#ffe08a' : '#ff5a6e';
        ctx.strokeRect(x + 5, y + 5, TILE * cw - 10, TILE * ch - 10);
        ctx.fillStyle = ok ? 'rgba(255,224,138,0.18)' : 'rgba(255,60,80,0.3)';
        ctx.fillRect(x + 5, y + 5, TILE * cw - 10, TILE * ch - 10);
    },

    // 사거리: 천천히 도는 도트 점 고리. 안을 칠하지 않아 전장을 가리지 않는다
    rangeRing(ctx, x, y, radius, color) {
        const size = 3 * ART_SCALE;
        const n = Math.max(12, Math.round(radius * Math.PI * 2 / 28));
        const spin = Game.time * 0.25;
        ctx.fillStyle = color;
        for (let i = 0; i < n; i++) {
            const a = spin + i / n * Math.PI * 2;
            ctx.fillRect(snapWorld(x + Math.cos(a) * radius - size / 2), snapWorld(y + Math.sin(a) * radius - size / 2), size, size);
        }
    },

    // 화로 소품(prop2_brazier) 둘레의 따뜻한 빛. 불꽃은 그림에 있다
    drawTorches(ctx) {
        const t = Game.time;
        const zone = ZONES[this.mapZone] || ZONES[DEFAULT_ZONE];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [sprite, col, row] of zone.props) {
            if (isPathCell(col, row)) continue; // 이 맵의 길 위에 놓인 소품은 뺀다
            if (sprite !== 'prop2_brazier') continue;
            const x = tileX(col);
            const y = tileY(row) + PROP_FOOT_Y - 120;
            const flick = 0.82 + Math.sin(t * 9 + col) * 0.09 + Math.sin(t * 23 + row * 5) * 0.05;
            const radius = 220 * flick;
            const g = ctx.createRadialGradient(x, y, 8, x, y, radius);
            g.addColorStop(0, `rgba(255,170,80,${0.3 * flick})`);
            g.addColorStop(0.45, `rgba(200,100,40,${0.08 * flick})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
    },

    // pixelfx 시트 한 칸을 그린다: (x, y)에 기준점을 맞추고 angle만큼 돌린다. 배율은 drawSheetEffects와 같은 정수 배율
    drawSheetFrame(ctx, key, frame, x, y, size, angle, alpha) {
        const sheet = FX_SHEETS[key];
        const img = sheet && Assets.get(sheet.image);
        if (!img) return;
        const f = clamp(frame, 0, sheet.frames - 1);
        const s = Math.max(1, Math.round(size * WORLD_ZOOM / sheet.fit)) / WORLD_ZOOM;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (alpha !== undefined) ctx.globalAlpha *= alpha;
        if (angle) {
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.drawImage(img, (f % sheet.cols) * sheet.w, Math.floor(f / sheet.cols) * sheet.h, sheet.w, sheet.h,
                -sheet.pivotX * s, -sheet.pivotY * s, sheet.w * s, sheet.h * s);
        } else {
            const dx = Math.round((x - sheet.pivotX * s) * WORLD_ZOOM) / WORLD_ZOOM;
            const dy = Math.round((y - sheet.pivotY * s) * WORLD_ZOOM) / WORLD_ZOOM;
            ctx.drawImage(img, (f % sheet.cols) * sheet.w, Math.floor(f / sheet.cols) * sheet.h, sheet.w, sheet.h, dx, dy, sheet.w * s, sheet.h * s);
        }
        ctx.restore();
    },

    // 반복 시트(상태 표시, 장판, 오라 고리): Game.time과 seed로 프레임을 고른다
    drawLoopSheet(ctx, key, x, y, size, seed, alpha) {
        const sheet = FX_SHEETS[key];
        if (!sheet) return;
        const k = (((Game.time + (seed || 0)) / sheet.life) % 1 + 1) % 1;
        this.drawSheetFrame(ctx, key, Math.floor(k * sheet.frames), x, y, size, 0, alpha);
    },

    // 땅에 남은 장판(불 장판): 바닥 빛과 불꽃 고리. 사라지기 0.5초 전부터 흐려진다
    drawHazards(ctx) {
        for (const z of Game.hazards) {
            const a = clamp((z.life - z.age) / 0.5, 0, 1) * clamp(z.age / 0.15, 0, 1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.3 * a;
            this.pixelDisc(ctx, z.x, z.y, z.radius, z.radius * 0.55, '#ff6e1e', { k: 4 });
            ctx.restore();
            this.drawLoopSheet(ctx, 'fx_fire_ground', z.x, z.y, z.radius * 2, z.x * 0.01, a);
        }
    },

    // 지원 몬스터 발밑의 오라 고리(오라 종류 색). 작고 흐리게 그려 맵을 덮지 않는다. 범위 원은 고를 때만 UI가 그린다
    drawAuraRunes(ctx, m, footY) {
        for (const a of monsterAbilities(m.type, 'aura')) {
            this.drawLoopSheet(ctx, `fx_rune_${a.stat}`, m.x, footY + 4, 110, m.x * 0.013, 0.75);
        }
    },

    // pixelfx 시트 효과. 빛이 이미 색과 알파로 합쳐져 있어 lighter가 아니라 보통 합성으로 그린다.
    // 화면에서 정수 배율(1배, 큰 효과는 2배)이 되도록 1 / WORLD_ZOOM 단위로 키우고 화면 픽셀에 맞춘다
    drawSheetEffects(ctx) {
        ctx.imageSmoothingEnabled = false;
        for (const a of Fx.anims) {
            const sheet = FX_SHEETS[a.name];
            const img = sheet && Assets.get(sheet.image);
            if (!img) continue;
            const frame = Math.min(sheet.frames - 1, Math.floor(a.age / a.life * sheet.frames));
            const k = Math.max(1, Math.round(a.size * WORLD_ZOOM / sheet.fit));
            const s = k / WORLD_ZOOM;
            const x = Math.round((a.x - sheet.pivotX * s) * WORLD_ZOOM) / WORLD_ZOOM;
            const y = Math.round((a.y - sheet.pivotY * s) * WORLD_ZOOM) / WORLD_ZOOM;
            if (sheet.add) ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(img, (frame % sheet.cols) * sheet.w, Math.floor(frame / sheet.cols) * sheet.h, sheet.w, sheet.h,
                x, y, sheet.w * s, sheet.h * s);
            if (sheet.add) ctx.globalCompositeOperation = 'source-over';
        }
    },

    drawEffects(ctx) {
        ctx.save();
        this.drawSheetEffects(ctx);
        ctx.globalCompositeOperation = 'lighter';
        for (const g of Fx.glows) {
            const a = 1 - g.age / g.life;
            const grad = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, g.radius);
            grad.addColorStop(0, g.color.replace(',1)', `,${0.3 * a})`));
            grad.addColorStop(1, g.color.replace(',1)', ',0)'));
            ctx.fillStyle = grad;
            ctx.fillRect(g.x - g.radius, g.y - g.radius, g.radius * 2, g.radius * 2);
        }
        for (const p of Fx.particles) {
            ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1);
            ctx.fillStyle = p.color;
            const s = p.size;
            // 도트처럼 보이도록 2픽셀 격자에 맞춰 사각형으로 그린다
            ctx.fillRect(Math.round(p.x / 2) * 2 - s / 2, Math.round(p.y / 2) * 2 - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        for (const r of Fx.rings) {
            const t = r.age / r.life;
            ctx.globalAlpha = 1 - t;
            // 매끈한 선 대신 도트 점으로 퍼진다
            const radius = r.radius * (0.25 + 0.75 * Math.sqrt(t));
            const size = (t < 0.5 ? 4 : 2) * ART_SCALE;
            const n = Math.max(10, Math.round(radius * Math.PI * 2 / 20));
            ctx.fillStyle = r.color;
            for (let i = 0; i < n; i++) {
                const a = i / n * Math.PI * 2;
                ctx.fillRect(snapWorld(r.x + Math.cos(a) * radius), snapWorld(r.y + Math.sin(a) * radius), size, size);
            }
        }
        for (const b of Fx.beams) {
            const t = b.age / b.life;
            ctx.globalAlpha = 1 - t;
            this.pixelLine(ctx, b.ax, b.ay, b.bx, b.by, b.color, b.width * (1 - t * 0.6));
        }
        for (const b of Fx.bolts) {
            const t = b.age / b.life;
            ctx.globalAlpha = 1 - t;
            for (const [color, width] of [[b.color, 14], ['#ffffff', 5]]) {
                for (let i = 1; i < b.points.length; i++) this.pixelLine(ctx, b.points[i - 1][0], b.points[i - 1][1], b.points[i][0], b.points[i][1], color, width);
            }
        }
        ctx.restore();
    },

    drawNumbers(ctx) {
        for (const n of Fx.numbers) {
            // 처음 150ms는 크게 튀어나온다. 굵은 글자에 두꺼운 외곽선, 위쪽 반은 밝게(Asteria 피해 숫자처럼)
            const pop = n.age < 0.12 ? 1.35 - (n.age / 0.12) * 0.35 : 1;
            const size = Math.round((n.big ? 44 : 26) * pop / WORLD_ZOOM); // 글자는 세계와 함께 줄지 않게 한다
            ctx.save();
            ctx.globalAlpha = clamp((n.life - n.age) / 0.25, 0, 1);
            UIKit.bigText(ctx, String(n.amount), n.x, n.y, size, n.color, 'center');
            ctx.restore();
        }
    },

    drawSpeech(ctx) {
        for (const s of Fx.speech) {
            const a = clamp(Math.min(s.age / 0.1, (s.life - s.age) / 0.2), 0, 1);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = `${Math.round(24 / WORLD_ZOOM)}px ${UI_FONT}`;
            const w = ctx.measureText(s.text).width + 42;
            const x = clamp(s.x, w / 2 + 8, WORLD_WIDTH - w / 2 - 8);
            const y = s.y - (1 - a) * 8;
            // 마왕 대사는 남색 말풍선, 보스 대사는 빨간 말풍선
            UIKit.note(ctx, x - w / 2, y - 34, w, 64, { red: !!s.boss });
            ctx.fillStyle = s.boss ? UI_THEME.cream : UI_THEME.ink;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.text, x, y - 1);
            ctx.restore();
        }
    },

    drawCoins(ctx) {
        // 금화(화면 좌표): Asteria 금화 그림(그림 1px = 화면 1px). 굴러가듯 좌우로 뒤집히고 가끔 반짝인다
        const img = Assets.get('ast_coin');
        if (img) {
            ctx.imageSmoothingEnabled = false;
            for (const c of Fx.coins) {
                const x = Math.round(c.x - img.width / 2);
                const y = Math.round(c.y - img.height / 2);
                const flip = Math.floor(c.age * 10 + c.vx) % 2 === 0;
                ctx.save();
                if (flip) {
                    ctx.translate(x + img.width, y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0);
                } else {
                    ctx.drawImage(img, x, y);
                }
                ctx.restore();
                if (Math.floor(c.age * 6 + c.vy) % 3 === 0) {
                    ctx.fillStyle = '#fff8d8';
                    ctx.fillRect(x + 4, y + 3, 2, 1);
                    ctx.fillRect(x + 5, y + 2, 1, 3);
                }
            }
            return;
        }
        for (const c of Fx.coins) {
            const spin = Math.abs(Math.cos(c.age * 9 + c.vx));
            const w = Math.max(4, Math.round(12 * spin)) * 2;
            const x = Math.round(c.x - w / 2);
            const y = Math.round(c.y - 12);
            ctx.fillStyle = '#3a2004';
            ctx.fillRect(x - 2, y, w + 4, 24);
            ctx.fillRect(x, y - 2, w, 28);
            ctx.fillStyle = '#e8a020';
            ctx.fillRect(x, y, w, 24);
            ctx.fillStyle = '#ffd84d';
            ctx.fillRect(x + 2, y + 2, w - 4, 18);
            if (w > 12) {
                ctx.fillStyle = '#c47a10';
                ctx.fillRect(x + w / 2 - 2, y + 6, 4, 12);
            }
            ctx.fillStyle = '#fff6c8';
            ctx.fillRect(x + 2, y + 2, Math.max(2, w / 4), 6);
        }
    },

    world(ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (Fx.shake > 0.5) {
            ctx.translate(Math.round(randRange(-Fx.shake, Fx.shake)), Math.round(randRange(-Fx.shake, Fx.shake)));
        }
        ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
        const zoneId = this.zoneNow();
        if (zoneId !== this.mapZone || currentMap !== this.mapBuilt) { this.mapBuilt = currentMap; this.buildMap(zoneId); } // 판을 시작하면 이번 지역으로 다시 그린다
        if (this.mapLayer) ctx.drawImage(this.mapLayer, 0, 0);

        for (const d of Fx.decals) {
            const a = clamp((d.life - d.age) / 2, 0, 1) * 0.7;
            const g = ctx.createRadialGradient(d.x, d.y, 8, d.x, d.y, d.radius);
            g.addColorStop(0, `rgba(16,12,6,${a})`);
            g.addColorStop(0.7, `rgba(46,34,18,${a * 0.5})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(d.x - d.radius, d.y - d.radius, d.radius * 2, d.radius * 2);
        }

        this.drawMapTiles(ctx);
        this.drawBuildPads(ctx);
        this.drawHoverCell(ctx);
        UI.drawRanges(ctx);

        for (const t of Game.telegraphs) {
            const k = t.age / t.life;
            const rgb = t.color || '255,70,110'; // 감전 경고는 푸른색
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.18 * k;
            this.pixelDisc(ctx, t.x, t.y, t.radius, t.radius, `rgb(${rgb})`, { k: 4 });
            ctx.globalAlpha = 1;
            this.pixelRing(ctx, t.x, t.y, t.radius, t.radius, t.color ? `rgb(${rgb})` : '#ff5e7f', { k: 4 });
            // 차오르는 안쪽: 다 차면 터진다
            ctx.globalAlpha = 0.35;
            this.pixelDisc(ctx, t.x, t.y, Math.max(4, t.radius * k), Math.max(4, t.radius * k), t.color ? `rgb(${rgb})` : '#ff5a82', { k: 4, hard: true });
            ctx.restore();
        }

        if (UI.targeting) {
            const rule = COMBAT_RULES.lightning;
            this.rangeRing(ctx, UI.mouse.x / WORLD_ZOOM, UI.mouse.y / WORLD_ZOOM, Game.lightningRadius() * TILE, 'rgba(160,220,255,1)');
        }

        this.drawHazards(ctx);
        for (const c of Game.corpses) this.drawCorpse(ctx, c);

        // y 순서대로 그려 아래쪽이 앞에 보이게 한다
        const entities = [];
        const zone = ZONES[this.mapZone] || ZONES[DEFAULT_ZONE];
        for (const [sprite, col, row] of zone.props) {
            if (isPathCell(col, row)) continue; // 이 맵의 길 위에 놓인 소품은 뺀다
            const footY = tileY(row) + PROP_FOOT_Y;
            entities.push({ y: footY, draw: () => this.sprite(ctx, Assets.get(sprite), tileX(col), footY, PIXEL_SCALE, propFootPx(sprite)) });
        }
        for (const gate of this.gates()) entities.push({ y: gate.y + 40, draw: () => this.drawGate(ctx, gate, zone) });
        for (const m of Game.monsters) {
            if (m.blocks) entities.push({ y: m.homeY - TILE / 2, draw: () => this.drawMonsterHome(ctx, m) });
            const footY = (m.down > 0 ? m.homeY : m.y) + MONSTER_FOOT;
            entities.push({ y: footY, draw: () => this.drawMonster(ctx, m) });
        }
        for (const u of Game.units) entities.push({ y: u.y + 12, draw: () => this.drawUnit(ctx, u) });
        for (const h of Game.heroes) {
            if (h.waiting) continue;
            const w = heroWorld(h);
            entities.push({ y: w.y + 14, draw: () => this.drawHero(ctx, h) });
        }
        entities.push({ y: tileY(THRONE_TILE.row) + 30, draw: () => this.drawThrone(ctx) });
        entities.sort((a, b) => a.y - b.y);
        for (const e of entities) e.draw();

        this.drawTorches(ctx);

        if (Fx.dim > 0) {
            ctx.fillStyle = `rgba(0,0,0,${Fx.dim * 0.7})`;
            ctx.fillRect(-40, -40, WORLD_WIDTH + 80, WORLD_HEIGHT + 80);
            this.drawLordCast(ctx);
        }

        for (const p of Game.projectiles) this.drawProjectile(ctx, p);
        this.drawEffects(ctx);
        this.drawNumbers(ctx);
        this.drawDrops(ctx);
        this.drawSpeech(ctx);
        ctx.restore();
        this.drawCoins(ctx);
    }
};
