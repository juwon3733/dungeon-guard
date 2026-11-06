// 화면 자동 캡처: 헤드리스 브라우저로 게임을 1920x1080에서 열고 정해 둔 장면을 captures/에 PNG로 저장한다.
// 실행: node tools/capture.js            (모든 장면)
//       node tools/capture.js combat     (장면 하나만, 여러 개는 공백으로 나열)
// 브라우저: 이 PC의 Edge를 먼저 쓰고 없으면 Chrome을 쓴다. CAPTURE_CHANNEL=chrome 처럼 정할 수도 있다.
// 콘솔 오류나 불러오지 못한 그림이 있으면 목록을 출력하고 종료 코드 1로 끝난다.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'captures');
const VIEWPORT = { width: 1920, height: 1080 };
const FPS_SECONDS = 2;

// 장면마다 페이지 안에서 실행할 준비 함수. 게임 코드는 바꾸지 않고 전역 객체만 만진다.
// 각 함수는 페이지에서 실행되므로 바깥 변수를 쓰지 못한다.
const SCENES = {
    // 타이틀은 열린 그대로 찍는다
    title: { setup: () => {}, freeze: false },

    // 시작 버튼을 눌러 준비 단계로 들어간 첫 화면: 빈 대기 칸 5개와 소환 버튼, 첫 안내 문구
    prep: {
        setup: () => { pressButton('start'); },
        // 건설 칸 테두리는 Game.time으로 깜빡인다. 가장 밝은 순간(sin = 1)에 멈춘다
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 소환: 대기 칸 넷을 채운 뒤 다섯째 칸에 영웅(해골 기사)이 나오는 순간. 소환 버튼에 마우스를 올려 확률 설명을 띄운다
    summon: {
        setup: () => {
            pressButton('start');
            Game.gold = 400;
            for (const r of [[0.1, 0.1], [0.5, 0.5], [0.1, 0.9], [0.8, 0.9]]) withRandom(r, () => pressButton('summon'));
            advance(1.5);
            withRandom([0.97, 0], () => pressButton('summon'));
            advance(0.22);
            const b = UI.buttons.find(x => x.id === 'summon');
            UI.onMove(b.x + 40, b.y + 40);
            freezeScene();
        }
    },

    // 끌기: 대기 칸의 암흑 마법사를 빈 길 옆 칸 위로 끄는 중. 칸 표시, 반투명 그림, 사거리와
    // 맵·대기 칸의 합칠 수 있는 몬스터 배지(조합식은 결과 그림, 같은 등급은 ?)가 보인다
    drag: {
        setup: () => {
            setupBoard();
            dragHold(benchCenter(0), cellCenter(9, 5));
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 끌어서 스켈레톤 궁수 위에 올린 순간: "합치기 → 저주 사수" 안내와 밝은 고리
    dragMerge: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(6, 4);
            dragHold(benchCenter(0), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 합치기 직전: 두 몬스터가 하얗게 달아오르며 결과 자리로 빨려 드는 중
    mergeSuck: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(6, 4);
            dragDrop(benchCenter(0), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(0.28);
            freezeScene();
        }
    },

    // 합치기 순간(희귀 결과, 맵): 빛이 터지고 저주 사수가 나온다
    merge: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(6, 4);
            dragDrop(benchCenter(0), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(MERGE_REVEAL + 0.12);
            freezeScene();
        }
    },

    // 영웅 합치기(대기 칸): 희귀 2마리가 해골 기사가 되는 순간. 가장 화려한 등급 연출
    mergeEpic: {
        setup: () => {
            setupBoard();
            Game.bench[3] = 'curse_shooter';
            Game.bench[4] = 'orc_berserker';
            dragDrop(benchCenter(4), benchCenter(3));
            advance(MERGE_REVEAL + 0.16);
            freezeScene();
        }
    },

    // 히든 조합 발견: 오크 경비병 + 스켈레톤 궁수 = 해골 기사
    hidden: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(6, 4);
            dragDrop(benchCenter(1), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(MERGE_REVEAL + 0.7);
            freezeScene();
        }
    },

    // 대기 칸 몬스터를 누른 정보 팝업: 이름, 등급, 역할, 수치, 함께 합칠 수 있는 몬스터, 판매
    popup: {
        setup: () => {
            setupBoard();
            const c = benchCenter(0);
            UI.onMove(c[0], c[1]);
            UI.onDown(c[0], c[1]);
            UI.onUp(c[0], c[1]);
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 맵 몬스터(해골 기사, 영웅)를 누른 정보 팝업. 최고 등급 안내
    popupField: {
        setup: () => {
            setupBoard();
            const [c, r] = [[10, 7], [11, 6], [9, 6], [7, 5]].find(([x, y]) => Game.canPlace('bone_knight', x, y));
            const m = Game.place('bone_knight', c, r);
            advance(1.5);
            // 길로 걸어 나간 해골 기사를 누른다(놓은 칸이 아니라 서 있는 곳)
            const p = [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
            UI.onMove(p[0], p[1]);
            UI.onDown(p[0], p[1]);
            UI.onUp(p[0], p[1]);
            if (UI.selectedMonster !== m) throw new Error('해골 기사를 고르지 못했습니다');
            freezeScene();
        }
    },

    // 몬스터 3종을 길 옆에 놓고 웨이브를 시작한 뒤, 오크가 길로 나가 용사를 붙잡을 때까지 시간을 빨리 돌린다
    combat: {
        setup: () => {
            pressButton('start');
            Game.gold = 2000; // 장면용: 세 몬스터를 모두 놓을 돈
            // 화면 가운데쯤(길이 ㄷ자로 꺾이는 곳)에 놓아 싸움이 입구 그림에 가리지 않게 한다
            Game.place('orc_guard', 6, 6);
            Game.place('skeleton_archer', 6, 4);
            Game.place('dark_mage', 10, 5);
            Fx.reset(); // 배치 효과를 지운다
            // Why: 첫 웨이브는 전사뿐이라 세 직업이 섞인 7번째 웨이브로 띄운다. 수치 확인용이 아니라 그림 확인용이다.
            Game.waveIndex = 6;
            Game.startWave();
            Fx.reset(); // 웨이브 시작 말풍선도 지운다
            const step = 1 / 30;
            for (let i = 0; i < 30 * 20; i++) {
                UI.update(step);
                Game.update(step);
                const walking = Game.heroes.filter(h => !h.waiting).length;
                if (walking >= 14 && Game.monsters.some(m => Game.heroes.some(h => h.blocker === m))) break;
            }
        },
        // 빨리 돌린 뒤에는 실제 속도로 조금 더 돌려 연출 효과가 자연스럽게 보이게 한다
        settleMs: 400
    },

    // 용사 3종과 몬스터 3종 x 4방향, 시체를 한 화면에 세운다
    units: {
        setup: () => {
            Game.reset();
            Game.state = 'wave'; // 건설 칸 표시를 끈다. update를 멈추므로 웨이브 종료 처리는 일어나지 않는다
            UI.corruptHintShown = true; // 시체가 있으면 뜨는 안내 문구가 줄을 가리지 않게 한다
            Game.update = () => {};
            const dirs = ['down', 'left', 'up', 'right'];
            const types = ['warrior', 'rogue', 'mage'];
            // 용사 그림 위치는 길 위 거리(d)와 길 폭 방향 어긋남(lane)으로 정해진다.
            // 3행 가로 구간(8,3)~(12,3)을 골라 d로 가로, lane으로 세로 위치를 맞춘다.
            const seg = PATH.segments.find(s => s.dy === 0 && s.dx > 0 && s.ax === tileX(8) && s.ay === tileY(3));
            // Why: d가 구간 양 끝과 같으면 이웃 구간(세로)으로 계산되어 lane이 가로로 붙는다. 양 끝을 비워 둔다.
            const margin = 48;
            const colX = i => seg.ax + margin + i * ((seg.len - margin * 2) / 3);
            const rowLane = j => 100 + j * 118; // 위쪽 HUD를 피해 길 아래 바닥에 세운다
            // 이름표 위치는 세계 좌표 [글자, x, 이름표 윗변 y]. 칸이 좁아 열 머리(방향)와 행 머리(직업)로 단다
            const labels = [];
            const footY = j => seg.ay + rowLane(j);
            dirs.forEach((dir, i) => labels.push([dir, colX(i), footY(0) - 130]));
            dirs.forEach((dir, i) => labels.push([dir, colX(i) + 900, footY(types.length) - 140]));
            types.forEach((type, j) => labels.push([HEROES[type].name, colX(0) - 105, footY(j) - 55]));
            // 몬스터 6종: 일반 3종은 용사 아래 줄에, 희귀·영웅 3종은 오른쪽 묶음에 둔다(화면 세로가 모자라다)
            const monsterTypes = Object.keys(MONSTERS);
            const RIGHT = 900;
            const monsterPos = j => (j < 3 ? { dx: 0, row: types.length + j } : { dx: RIGHT, row: types.length + j - 3 });
            monsterTypes.forEach((type, j) => {
                const p = monsterPos(j);
                labels.push([MONSTERS[type].name, colX(0) + p.dx - 105, footY(p.row) - 55]);
            });
            types.forEach((type, j) => {
                dirs.forEach((dir, i) => {
                    const h = createHero(type, 0, 0, false);
                    Object.assign(h, { waiting: false, female: false, dir, anim: 0, d: seg.start + (colX(i) - seg.ax), lane: rowLane(j) });
                    Game.heroes.push(h);
                });
            });
            // 몬스터: 네 방향 모두. 그림은 south/east/north만 있고 왼쪽은 동쪽을 뒤집어 그린다
            monsterTypes.forEach((type, j) => {
                const p = monsterPos(j);
                dirs.forEach((dir, i) => {
                    const m = createMonster(type, 0, 0);
                    // 발끝(y + MONSTER_FOOT)을 용사 줄과 같은 높이에 맞춘다
                    Object.assign(m, { x: colX(i) + p.dx, y: footY(p.row) - MONSTER_FOOT, dir, anim: 0 });
                    Game.monsters.push(m);
                });
            });
            // 시체: 쓰러지는 동작이 끝난 마지막 프레임
            types.forEach((type, j) => {
                const x = colX(3) + 260;
                const y = footY(j);
                Game.corpses.push({ type, female: false, x, y, d: 0, dir: 'down', age: 5, life: 60, cost: 15 });
                labels.push([`${HEROES[type].name} 시체`, x, y + 24]);
            });
            // 이름표: 캔버스 위에 DOM으로 얹는다(게임 화면 좌표 = 세계 좌표 x WORLD_ZOOM)
            const rect = document.getElementById('game').getBoundingClientRect();
            for (const [text, x, y] of labels) {
                const el = document.createElement('div');
                el.textContent = text;
                el.style.cssText = 'position:fixed;transform:translateX(-50%);font:bold 15px sans-serif;color:#fff;'
                    + 'background:rgba(0,0,0,.65);padding:1px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;';
                el.style.left = `${rect.left + x * WORLD_ZOOM * rect.width / GAME_WIDTH}px`;
                el.style.top = `${rect.top + y * WORLD_ZOOM * rect.height / GAME_HEIGHT}px`;
                document.body.appendChild(el);
            }
        }
    },

    // 정예 4종이 함께 걷는 장면: 음유시인 노래(음표), 뇌술사 범위 감전 경고 원, 오크에 막힌 검사, 오크를 지나는 조련사
    elites: {
        setup: () => {
            pressButton('start');
            Game.gold = 2000;
            Game.place('orc_guard', 6, 6);
            Game.place('skeleton_archer', 6, 4);
            Fx.reset();
            Game.waveIndex = 6;
            Game.startWave();
            const rally = Game.monsters.find(f => f.rally).rally.d;
            const put = (type, d, lane) => {
                const h = createHero(type, Game.waveIndex, 0, false);
                Object.assign(h, { waiting: false, d, lane, cast: 99, song: 99 });
                return h;
            };
            // 앞에서부터: 조련사(오크를 지나 앞서 감), 검사(오크에 막힘), 뇌술사, 음유시인과 일반 용사 무리
            const tamer = put('elite_tamer', rally - 0.2 * TILE, -25);
            const sword = put('elite_swordsman', rally - 0.6 * TILE, 10);
            const storm = put('elite_stormcaller', rally - 3.2 * TILE, 0);
            const bard = put('elite_rhapsodist', rally - 5.6 * TILE, 0);
            const crowd = [put('warrior', rally - 5 * TILE, 30), put('warrior', rally - 6.3 * TILE, -30), put('mage', rally - 6.6 * TILE, 25)];
            Fx.reset();
            const step = 1 / 30;
            // 오크가 길로 나올 때까지 돌린다(용사는 멈춰 둔다)
            Game.heroes = [];
            for (let i = 0; i < 90; i++) Game.update(step);
            Game.heroes = [tamer, sword, storm, bard, ...crowd];
            // 검사가 막히고 조련사가 지나가도록 잠깐 걷게 한다. 뇌술사는 아직 오크에 닿지 않는다
            for (let i = 0; i < 25; i++) { UI.update(step); Game.update(step); }
            bard.song = 0.01;
            storm.cast = 0.01;
            for (let i = 0; i < 6; i++) { UI.update(step); Game.update(step); }
            freezeScene(); // fps를 재는 2초 동안 경고 원이 사라지지 않게 바로 멈춘다
        }
    },

    // 대마도사 보스: 체력 25% 넓은 범위 감전 경고 중. 보스 체력바가 위에 나온다
    archmage: {
        setup: () => {
            pressButton('start');
            Game.gold = 2000;
            Game.place('orc_guard', 6, 6);
            Game.place('skeleton_archer', 6, 4);
            Game.place('dark_mage', 10, 5);
            Fx.reset();
            Game.waveIndex = 0;
            Game.startWave();
            const rally = Game.monsters.find(f => f.rally).rally.d;
            const boss = createHero(null, 0, 0, 'archmage');
            Object.assign(boss, { waiting: false, d: rally - 1.5 * TILE });
            Game.heroes = [boss];
            Fx.reset();
            const step = 1 / 30;
            boss.hp = boss.maxHp * 0.5;
            for (let i = 0; i < 60; i++) Game.update(step); // 50% 감전을 끝까지 쓴다
            boss.hp = boss.maxHp * 0.24;
            for (let i = 0; i < 20; i++) { UI.update(step); Game.update(step); }
            freezeScene(); // 넓은 감전 경고 원이 보이는 순간에 멈춘다
        }
    },

    // 대마도사 이름 배너(보스 웨이브 시작 연출)
    archmageIntro: {
        setup: () => {
            pressButton('start');
            WAVES[WAVES.length - 1].boss = 'archmage';
            Game.waveIndex = WAVES.length - 1;
            Game.startWave();
            for (let i = 0; i < 30; i++) { UI.update(1 / 30); Game.update(1 / 30); }
        }
    }
};

// 페이지 안에 넣는 도우미: 실제 입력 경로로 UI 버튼을 누른다(tools/smoke.js와 같은 방식)
const PAGE_HELPERS = () => {
    window.pressButton = id => {
        UI.update(0);
        const b = UI.buttons.find(x => x.id === id);
        if (!b) throw new Error(`버튼이 없습니다: ${id}`);
        UI.onMove(b.x + 5, b.y + 5);
        UI.onClick(b.x + 5, b.y + 5);
    };
    // Math.random 고정(배열이면 차례로). 소환 결과를 장면마다 같게 만든다
    window.withRandom = (v, fn) => {
        const old = Math.random;
        const list = Array.isArray(v) ? v.slice() : null;
        Math.random = () => (list ? list.shift() : v);
        try { return fn(); } finally { Math.random = old; }
    };
    window.advance = seconds => {
        for (let i = 0; i < Math.round(seconds * 60); i++) { UI.update(1 / 60); Game.update(1 / 60); }
    };
    window.benchCenter = i => { const r = UI.benchRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; };
    window.cellCenter = (c, r) => [tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM];
    // 끌기 장면 공통 판: 맵에 오크 경비병(6,6)·스켈레톤 궁수(6,4)·암흑 마법사(10,5), 대기 칸에 일반 셋과 희귀 하나
    window.setupBoard = () => {
        pressButton('start');
        Game.gold = 300;
        Game.place('orc_guard', 6, 6);
        Game.place('skeleton_archer', 6, 4);
        Game.place('dark_mage', 10, 5);
        Game.bench = ['dark_mage', 'orc_guard', 'skeleton_archer', 'curse_shooter', null];
        advance(1.6); // 오크가 길로 걸어 나가고 설치 효과가 사라진다
        Fx.reset();
    };
    // 실제 입력 경로로 누른 채 끈다(떼지 않음)
    window.dragHold = (from, to) => {
        UI.onMove(from[0], from[1]);
        UI.onDown(from[0], from[1]);
        for (let i = 1; i <= 6; i++) UI.onMove(from[0] + (to[0] - from[0]) * i / 6, from[1] + (to[1] - from[1]) * i / 6);
    };
    window.dragDrop = (from, to) => { dragHold(from, to); UI.onUp(to[0], to[1]); };
    // 장면 고정: 게임 진행을 멈추고, 남은 건설 효과 같은 연출은 그대로 둔 채 더 이상 움직이지 않게 한다
    window.freezeScene = () => { Game.update = () => {}; };
    // rAF 횟수로 실제 그리기 속도를 잰다
    window.measureFps = seconds => new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        const tick = now => {
            frames++;
            if (now - start < seconds * 1000) requestAnimationFrame(tick);
            else resolve(frames / ((now - start) / 1000));
        };
        requestAnimationFrame(tick);
    });
};

function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once('error', reject);
        s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

// tools/server.js를 빈 포트로 띄운다. 이미 8123에서 돌고 있는 서버와 부딪히지 않는다.
async function startServer() {
    const port = await freePort();
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('서버가 5초 안에 뜨지 않았습니다')), 5000);
        child.stdout.on('data', d => { if (String(d).includes('http://')) { clearTimeout(timer); resolve(); } });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`서버가 종료되었습니다(${code})`)); });
    });
    return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
}

async function launchBrowser() {
    const channels = process.env.CAPTURE_CHANNEL ? [process.env.CAPTURE_CHANNEL] : ['msedge', 'chrome'];
    let lastError;
    for (const channel of channels) {
        try {
            const browser = await chromium.launch({ channel, headless: true });
            return { browser, channel };
        } catch (e) { lastError = e; }
    }
    throw new Error(`브라우저를 열지 못했습니다(${channels.join(', ')}): ${lastError && lastError.message.split('\n')[0]}`);
}

async function captureScene(browser, url, name, problems) {
    const scene = SCENES[name];
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const report = text => problems.push(`[${name}] ${text}`);
    page.on('console', msg => {
        const text = msg.text();
        const where = msg.location().url || '';
        // 브라우저가 알아서 찾는 favicon은 게임 자원이 아니다
        if (msg.type() === 'error' && /\/favicon\.ico$/.test(where)) return;
        if (msg.type() === 'error') report(`콘솔 오류: ${text}${where ? ` (${where})` : ''}`);
        else if (text.includes('그림을 찾지 못했습니다')) report(`그림 없음: ${text}`);
    });
    page.on('pageerror', err => report(`페이지 예외: ${err.message}`));
    page.on('requestfailed', req => report(`요청 실패: ${req.url()} (${req.failure() && req.failure().errorText})`));
    page.on('response', res => { if (res.status() >= 400) report(`HTTP ${res.status()}: ${res.url()}`); });

    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* 무시 */ } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof ready !== 'undefined' && ready === true, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(PAGE_HELPERS);
    await page.evaluate(scene.setup);
    const fps = await page.evaluate(s => measureFps(s), FPS_SECONDS);
    if (scene.settleMs) await page.waitForTimeout(scene.settleMs);
    if (scene.freeze !== false) await page.evaluate(() => freezeScene());
    if (scene.afterFreeze) await page.evaluate(scene.afterFreeze);
    // 고정한 상태가 한 번 이상 그려지도록 두 프레임 기다린다
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    await page.close();
    return { file, fps };
}

async function main() {
    const wanted = process.argv.slice(2);
    const unknown = wanted.filter(n => !SCENES[n]);
    if (unknown.length) {
        console.error(`모르는 장면: ${unknown.join(', ')} (가능: ${Object.keys(SCENES).join(', ')})`);
        process.exit(2);
    }
    const names = wanted.length ? wanted : Object.keys(SCENES);
    fs.mkdirSync(outDir, { recursive: true });

    const server = await startServer();
    const problems = [];
    const fpsList = [];
    let browser;
    try {
        const launched = await launchBrowser();
        browser = launched.browser;
        console.log(`브라우저: ${launched.channel} ${browser.version()}, 화면 ${VIEWPORT.width}x${VIEWPORT.height}`);
        for (const name of names) {
            const { file, fps } = await captureScene(browser, server.url, name, problems);
            fpsList.push(fps);
            console.log(`${name.padEnd(7)} ${fps.toFixed(1).padStart(5)} fps  ${path.relative(root, file)}`);
        }
    } finally {
        if (browser) await browser.close();
        server.stop();
    }
    const avg = fpsList.reduce((a, b) => a + b, 0) / fpsList.length;
    console.log(`평균 FPS: ${avg.toFixed(1)} (장면마다 ${FPS_SECONDS}초 측정)`);
    if (problems.length) {
        console.error(`\n문제 ${problems.length}건:`);
        for (const p of problems) console.error(`  ${p}`);
        process.exit(1);
    }
}

main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
