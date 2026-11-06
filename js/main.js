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
    if (!Game.inPlay()) { // 타이틀, 스토리 지도, 선택 화면, 결과: 연출 시간만 흐른다
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
    ctx.fillStyle = UI_THEME.walnutDark;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const ratio = Assets.total ? Assets.loaded / Assets.total : 0;
    UIKit.text(ctx, '던전 수호대', GAME_WIDTH / 2, 470, 80, UI_THEME.cream, 'center');
    UIKit.bar(ctx, GAME_WIDTH / 2 - 300, 560, 600, 24, ratio, UI_THEME.wax);
}

window.addEventListener('resize', fitCanvas);
// 마우스와 터치를 pointer 이벤트 하나로 받는다. 누른 손가락(포인터)만 끌기에 쓰고, 두 번째 손가락은 무시한다.
// 누르는 동안 캔버스 밖으로 나가도 이어지도록 포인터를 붙잡는다(setPointerCapture)
let activePointer = null;
canvas.addEventListener('pointermove', e => {
    if (activePointer !== null && e.pointerId !== activePointer) return;
    const p = toVirtual(e);
    UI.onMove(p.x, p.y);
});
canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!ready) return;
    if (activePointer !== null) return;
    const p = toVirtual(e);
    if (e.button === 2) { UI.onMove(p.x, p.y); UI.cancel(); return; } // 우클릭은 끌기와 조준을 취소한다
    activePointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 붙잡지 못해도 동작한다 */ }
    UI.onDown(p.x, p.y, e.shiftKey);
});
const endPointer = (e, cancelled) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    const p = toVirtual(e);
    if (cancelled) { UI.cancelDrag(); UI.cancelEquipDrag(); }
    else UI.onUp(p.x, p.y);
};
canvas.addEventListener('pointerup', e => endPointer(e, false));
canvas.addEventListener('pointercancel', e => endPointer(e, true));
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
Meta.load(); // 영구 수집 기록(못 읽으면 초기값)
Assets.loadAll(() => {
    Render.buildMap();
    ready = true;
});
requestAnimationFrame(frame);
