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

    // 시작 버튼을 눌러 준비 단계로 들어가고, 마우스를 건설 칸 위에 올려 둔다
    prep: {
        setup: () => {
            pressButton('start');
            const [c, r] = isBuildCell(6, 5) ? [6, 5] : [...BUILD_CELLS][0].split(',').map(Number);
            UI.onMove(tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM);
        },
        // 건설 칸 테두리는 Game.time으로 깜빡인다. 가장 밝은 순간(sin = 1)에 멈춘다
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 시설 3종을 짓고 웨이브를 시작한 뒤 용사가 시설 앞에 올 때까지 시간을 빨리 돌린다
    combat: {
        setup: () => {
            pressButton('start');
            Game.gold = 2000; // 장면용: 세 시설을 모두 지을 돈
            // 화면 가운데쯤(길이 ㄷ자로 꺾이는 곳)에 지어 싸움이 입구 그림에 가리지 않게 한다
            Game.build('barracks', 6, 6);
            Game.build('archer', 6, 4);
            Game.build('crystal', 10, 5);
            Fx.reset(); // 건설 효과를 지운다
            // Why: 첫 웨이브는 전사뿐이라 세 직업이 섞인 7번째 웨이브로 띄운다. 수치 확인용이 아니라 그림 확인용이다.
            Game.waveIndex = 6;
            Game.startWave();
            Fx.reset(); // 웨이브 시작 말풍선도 지운다
            const step = 1 / 30;
            for (let i = 0; i < 30 * 20; i++) {
                UI.update(step);
                Game.update(step);
                const walking = Game.heroes.filter(h => !h.waiting).length;
                if (walking >= 14 && Game.units.some(u => Game.heroes.some(h => h.blocker === u))) break;
            }
        },
        // 빨리 돌린 뒤에는 실제 속도로 조금 더 돌려 연출 효과가 자연스럽게 보이게 한다
        settleMs: 400
    },

    // 용사 3종 x 4방향, 오크, 시체를 한 화면에 세운다
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
            const rowLane = j => 110 + j * 135; // 위쪽 HUD를 피해 길 아래 바닥에 세운다
            // 이름표 위치는 세계 좌표 [글자, x, 이름표 윗변 y]. 칸이 좁아 열 머리(방향)와 행 머리(직업)로 단다
            const labels = [];
            const footY = j => seg.ay + rowLane(j);
            dirs.forEach((dir, i) => labels.push([dir, colX(i), footY(0) - 130]));
            ['warrior', 'rogue', 'mage', 'orc'].forEach((type, j) => labels.push([type === 'orc' ? '오크' : HEROES[type].name, colX(0) - 105, footY(j) - 55]));
            types.forEach((type, j) => {
                dirs.forEach((dir, i) => {
                    const h = createHero(type, 0, 0, false);
                    Object.assign(h, { waiting: false, female: false, dir, anim: 0, d: seg.start + (colX(i) - seg.ax), lane: rowLane(j) });
                    Game.heroes.push(h);
                });
            });
            // 오크: 네 방향 모두. 오크 그림은 south/east/north만 있고 왼쪽은 뒤집어 그린다
            dirs.forEach((dir, i) => {
                const x = colX(i);
                const y = footY(3);
                Game.units.push({ kind: 'orc', x, y, dir, hp: 1, maxHp: 1, atkPose: 0, flash: 0, anim: 0, moving: false });
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
