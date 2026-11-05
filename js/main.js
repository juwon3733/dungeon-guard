// 시작점: 캔버스 크기 맞춤, 입력 연결, 게임 루프.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let ready = false;
let lastTime = 0;

function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    canvas.style.width = `${Math.floor(GAME_WIDTH * scale)}px`;
    canvas.style.height = `${Math.floor(GAME_HEIGHT * scale)}px`;
    canvas.width = Math.floor(GAME_WIDTH * scale * dpr);
    canvas.height = Math.floor(GAME_HEIGHT * scale * dpr);
}

// 브라우저 좌표를 1920x1080 가상 좌표로 바꾼다
function toVirtual(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) / rect.width * GAME_WIDTH,
        y: (event.clientY - rect.top) / rect.height * GAME_HEIGHT
    };
}

function saveSettings() {
    try {
        localStorage.setItem('dungeonGuard.settings', JSON.stringify({ muted: Sfx.muted, reduce: Fx.reduce }));
    } catch (e) { /* 저장을 못 해도 게임은 그대로 돈다 */ }
}

function loadSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem('dungeonGuard.settings') || '{}');
        Sfx.muted = !!raw.muted;
        Fx.reduce = !!raw.reduce;
    } catch (e) { /* 기본값 사용 */ }
}

function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;

    ctx.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0);
    if (!ready) {
        drawLoading();
        requestAnimationFrame(frame);
        return;
    }

    UI.update(dt);
    if (Game.state === 'title') {
        Game.update(dt);
    } else if (!Game.paused) {
        // Why: 2배속도 한 번에 큰 시간을 넘기지 않아야 충돌과 조준이 어긋나지 않는다.
        for (let i = 0; i < Game.speed; i++) Game.update(dt);
    }

    Render.world(ctx);
    UI.draw(ctx);
    requestAnimationFrame(frame);
}

function drawLoading() {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const ratio = Assets.total ? Assets.loaded / Assets.total : 0;
    UIKit.text(ctx, '던전 수호대', GAME_WIDTH / 2, 470, 80, '#ffc95a', 'center');
    UIKit.bar(ctx, GAME_WIDTH / 2 - 300, 560, 600, 24, ratio, '#a56bff', '#5a2fb0');
}

window.addEventListener('resize', fitCanvas);
canvas.addEventListener('pointermove', e => { const p = toVirtual(e); UI.onMove(p.x, p.y); });
canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toVirtual(e);
    UI.onMove(p.x, p.y);
    if (!ready) return;
    if (e.button === 2) UI.cancel(); // 우클릭은 건설 모드와 조준을 취소한다
    else UI.onClick(p.x, p.y, e.shiftKey);
});
canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    UI.cancel();
});
window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (e.repeat || !ready) return;
    Sfx.unlock();
    UI.onKey(e.code);
});

fitCanvas();
loadSettings();
Assets.loadAll(() => {
    Render.buildMap();
    ready = true;
});
requestAnimationFrame(frame);
