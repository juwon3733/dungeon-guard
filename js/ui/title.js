// 타이틀 화면과 불러오기 화면: 도트 로고, 떠오르는 불씨, 시작·계정·도감·설정·전체 화면 버튼
// 로고는 작은 글자를 픽셀로 굳힌 뒤(반투명 없음) 정수 배로 키운다: 외곽선, 위 밝은 줄, 색 띠, 아래 그림자
const TITLE_LOGO = {
    font: 22, // 작게 그리는 글자 크기(Galmuri11의 2배)
    k: 6, // 키우는 배율
    x: 104, y: 120,
    lines: [
        { text: '던전', bands: ['#fff6dc', '#f3e6c4', '#e2cf9f', '#c9b07a'] },
        { text: '수호대', bands: ['#ffe9a8', '#ffc65a', '#ff9a3c', '#f06a2a', '#c8441f'] }
    ],
    outline: '#120a18',
    shadow: '#2a1236',
    shine: '#fffbea'
};
const TITLE_START = { x: 110, y: 566, w: 440, h: 104 };
const TITLE_SMALL_W = 196; // 오른쪽 아래 작은 버튼 너비
const TITLE_ART_PX = 5; // ill_title 1px가 화면 5px(불씨도 이 칸에 맞춘다)
const TITLE_EMBERS = 90;
const LOADING_TIPS = ['같은 몬스터 둘 → 한 등급 위', '왕좌로 끌면 제물 · 마왕 체력 회복', '번개(Q) · 급한 자리부터', '종족 강화(G) · 골드가 남을 때', '심연 · 난이도별 최고 층', '보스 처치 · 유물 하나'];

// 0~1 사이의 고정 난수(불씨 i의 성질 j)
function titleHash(i, j) {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

Object.assign(UI, {
    titleSince: null, // 타이틀을 처음 그린 Game.time(들어올 때마다 다시 밝아진다)
    titleLogoCache: null,

    layoutTitle() {
        if (this.hqSettings) {
            this.layoutSettings(); // js/ui/hq.js
            return;
        }
        const label = Meta.data.cleared.length || Meta.data.runs ? '이어하기' : '시작하기';
        const S = TITLE_START;
        this.button('start', S.x, S.y, S.w, S.h, { label, icon: 'lord', theme: 'gold', size: 40, onClick: () => this.openHQ() });
        this.button('title_account', GAME_WIDTH - 392, 28, 360, 68, { label: '계정: 손님', size: 26, onClick: () => this.showToast('로그인 · 준비 중') });
        const y = GAME_HEIGHT - 118;
        const row = [
            ['title_full', '전체 화면', 'fast', () => this.toggleFullscreen()],
            ['title_settings', '설정', 'gear', () => { this.hqSettings = true; }],
            ['title_book', '도감', 'book', () => this.openCollection()]
        ];
        row.forEach(([id, label, icon, onClick], i) => {
            this.button(id, GAME_WIDTH - 32 - (i + 1) * TITLE_SMALL_W - i * 14, y, TITLE_SMALL_W, 68, { label, icon, size: 24, onClick });
        });
    },

    onTitleKey(code) {
        if (this.hqSettings) {
            if (code === 'Escape') this.hqSettings = false;
            return;
        }
        if (code === 'Space' || code === 'Enter') this.openHQ();
    },

    toggleFullscreen() {
        if (typeof document === 'undefined') return;
        const el = document.documentElement;
        try {
            if (document.fullscreenElement) document.exitFullscreen();
            else if (el.requestFullscreen) el.requestFullscreen();
        } catch (e) { /* 막힌 브라우저에서는 그대로 */ }
    },

    // ----- 그리기 -----

    drawTitle(ctx) {
        const T = UI_THEME;
        if (this.titleSince === null) this.titleSince = Game.time;
        const age = Game.time - this.titleSince;
        this.drawIllust(ctx, 'ill_title', 0.08);
        this.drawTitleEmbers(ctx, Game.time);
        // 왼쪽에 어둠을 계단으로 깔아 로고와 버튼이 그림 위에서 읽히게 한다
        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = `rgba(6,4,12,${0.055 * (12 - i) / 2})`;
            ctx.fillRect(0, 0, 940 - i * 40, GAME_HEIGHT);
        }
        // 로고: 처음 0.6초 동안 위에서 내려앉는다(로고 1px 단위로)
        const drop = Math.max(0, 1 - Math.max(0, age - 0.3) / 0.6);
        const logo = this.titleLogo();
        if (logo) {
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1 - drop;
            ctx.drawImage(logo, TITLE_LOGO.x, TITLE_LOGO.y - Math.round(drop * 6) * TITLE_LOGO.k);
            ctx.globalAlpha = 1;
        }
        this.drawTitleRule(ctx, TITLE_LOGO.x + 12, 452, 560);
        UIKit.text(ctx, '마왕군 랜덤 디펜스', TITLE_LOGO.x + 292, 494, 26, T.creamSoft, 'center', 'bold');
        UIKit.text(ctx, `스토리 ${Meta.data.cleared.length} / ${STAGES.length}`, TITLE_START.x + TITLE_START.w / 2, TITLE_START.y + TITLE_START.h + 38, 22, T.creamSoft, 'center');
        UIKit.text(ctx, '© 2026 던전 수호대', 28, GAME_HEIGHT - 26, 18, 'rgba(195,204,230,0.6)', 'left');
        UIKit.text(ctx, `빌드 V${GAME_VERSION}`, GAME_WIDTH - 32, GAME_HEIGHT - 26, 18, 'rgba(195,204,230,0.6)', 'right');
        if (this.hqSettings) this.drawHqSettings(ctx);
    },

    // 들어올 때 검은 화면에서 밝아진다(0.8초, 6단계). 버튼까지 덮도록 버튼 다음에 그린다
    drawTitleFade(ctx) {
        const fade = Math.max(0, 1 - (Game.time - (this.titleSince || 0)) / 0.8);
        if (fade <= 0) return;
        ctx.fillStyle = `rgba(0,0,0,${Math.ceil(fade * 6) / 6})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    },

    // 로고 아래 금줄: 가운데 마름모와 양끝 작은 마름모(도트 계단)
    drawTitleRule(ctx, x, y, w) {
        const P = 4;
        ctx.fillStyle = '#120a18';
        ctx.fillRect(x - P, y - P, w + P * 2, P * 3);
        ctx.fillStyle = UI_THEME.goldLine;
        ctx.fillRect(x, y, w, P);
        const dia = (cx, r, color) => {
            for (let i = -r; i <= r; i++) {
                const h = (r - Math.abs(i)) * P;
                ctx.fillStyle = '#120a18';
                ctx.fillRect(cx + i * P - P, y - h - P, P * 3, h * 2 + P * 3);
            }
            for (let i = -r; i <= r; i++) {
                const h = (r - Math.abs(i)) * P;
                ctx.fillStyle = color;
                ctx.fillRect(cx + i * P, y - h, P, h * 2 + P);
            }
        };
        dia(x, 2, UI_THEME.goldLight);
        dia(x + w, 2, UI_THEME.goldLight);
        dia(x + w / 2, 4, '#ff9a3c');
    },

    // 불씨: 그림 1px(5px) 칸에 맞춰 아래에서 위로 떠오르며 흔들린다. 주황과 보라가 섞인다
    drawTitleEmbers(ctx, t) {
        if (Fx.reduce) return;
        const P = TITLE_ART_PX;
        const colors = ['#ffb04a', '#ff7a2a', '#ffe08a', '#b98aff', '#e2c8ff'];
        for (let i = 0; i < TITLE_EMBERS; i++) {
            const speed = 22 + titleHash(i, 1) * 40;
            const span = GAME_HEIGHT + 120;
            const prog = ((t * speed + titleHash(i, 2) * span) % span) / span; // 0 아래 → 1 위
            const y = GAME_HEIGHT + 20 - prog * span;
            const x = titleHash(i, 0) * GAME_WIDTH + Math.sin(t * (0.6 + titleHash(i, 3)) + i) * 18;
            const life = prog < 0.15 ? prog / 0.15 : prog > 0.6 ? Math.max(0, (1 - prog) / 0.4) : 1;
            const flicker = Math.sin(t * 9 + i * 3) > 0.7 ? 0.55 : 1;
            const alpha = Math.round(life * flicker * 4) / 4;
            // 그림 아래쪽(불길이 있는 곳)에서 많이 보인다
            if (alpha <= 0) continue;
            const size = titleHash(i, 4) > 0.55 ? P * 2 : P;
            ctx.globalAlpha = alpha * 0.85;
            ctx.fillStyle = colors[Math.floor(titleHash(i, 5) * colors.length)];
            ctx.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, size, size);
        }
        ctx.globalAlpha = 1;
    },

    // 로고 그림(한 번 만들어 둔다). 글꼴이 아직 안 왔으면 만들지 않고 기다린다
    titleLogo() {
        if (this.titleLogoCache) return this.titleLogoCache;
        if (typeof document === 'undefined') return null;
        const L = TITLE_LOGO;
        const font = `bold ${L.font}px ${UI_FONT}`;
        if (document.fonts && !document.fonts.check(font, '던전 수호대')) return null;
        // 1) 글자를 작게 그려 알파 128 이상만 남긴다(줄마다 따로)
        const lineH = L.font + 4;
        const W = 6 + Math.max(...L.lines.map(l => l.text.length)) * (L.font + 2);
        const H = 6 + L.lines.length * lineH + 2;
        const src = document.createElement('canvas');
        src.width = W;
        src.height = H;
        const sc = src.getContext('2d');
        sc.font = font;
        sc.textBaseline = 'top';
        sc.fillStyle = '#fff';
        L.lines.forEach((l, i) => sc.fillText(l.text, 3, 3 + i * lineH));
        const a = sc.getImageData(0, 0, W, H).data;
        const ink = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] >= 128;
        // 2) 칸마다 색: 외곽선, 그림자, 위 밝은 줄, 줄 안의 색 띠
        const out = sc.createImageData(W, H);
        const put = (x, y, hex) => {
            const o = (y * W + x) * 4;
            out.data[o] = parseInt(hex.slice(1, 3), 16);
            out.data[o + 1] = parseInt(hex.slice(3, 5), 16);
            out.data[o + 2] = parseInt(hex.slice(5, 7), 16);
            out.data[o + 3] = 255;
        };
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (ink(x, y)) {
                    const li = clamp(Math.floor((y - 3) / lineH), 0, L.lines.length - 1);
                    const bands = L.lines[li].bands;
                    const rel = clamp(((y - 3 - li * lineH) / L.font), 0, 0.999);
                    put(x, y, !ink(x, y - 1) ? L.shine : bands[Math.floor(rel * bands.length)]);
                } else if (ink(x - 1, y - 1) || ink(x, y - 2) || ink(x - 1, y - 2)) {
                    put(x, y, L.shadow); // 아래 오른쪽으로 떨어지는 그림자
                } else {
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                        if (ink(x + dx, y + dy)) { put(x, y, L.outline); break; }
                    }
                }
            }
        }
        // 그림자 위에 외곽선이 덮이도록 외곽선을 한 번 더
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (ink(x, y)) continue;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    if (ink(x + dx, y + dy)) { put(x, y, L.outline); break; }
                }
            }
        }
        sc.clearRect(0, 0, W, H);
        sc.putImageData(out, 0, 0);
        const big = document.createElement('canvas');
        big.width = W * L.k;
        big.height = H * L.k;
        const bc = big.getContext('2d');
        bc.imageSmoothingEnabled = false;
        bc.drawImage(src, 0, 0, W * L.k, H * L.k);
        this.titleLogoCache = big;
        return big;
    },

    // 불러오기 화면: 타이틀 그림이 먼저 오면 어둡게 깔고, 로고, 도트 막대, 바뀌는 한 줄 팁
    drawLoading(ctx, ratio, t) {
        const T = UI_THEME;
        ctx.fillStyle = '#05030b';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (Assets.get('ill_title')) this.drawIllust(ctx, 'ill_title', 0.72);
        const logo = this.titleLogo();
        const cx = GAME_WIDTH / 2;
        if (logo) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(logo, Math.round(cx - logo.width / 2), 250);
        } else {
            UIKit.text(ctx, '던전 수호대', cx, 420, 80, T.cream, 'center', 'bold');
        }
        // 막대: 24칸 도트 블록
        const n = 24;
        const bw = 26;
        const gap = 6;
        const w = n * bw + (n - 1) * gap;
        const x0 = Math.round(cx - w / 2);
        const y = 700;
        ctx.fillStyle = '#120a18';
        ctx.fillRect(x0 - 10, y - 10, w + 20, 46);
        const lit = Math.floor(ratio * n);
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i < lit ? (i === lit - 1 ? '#ffe08a' : '#ff9a3c') : '#2a1d36';
            ctx.fillRect(x0 + i * (bw + gap), y, bw, 26);
            if (i < lit) {
                ctx.fillStyle = '#ffd27a';
                ctx.fillRect(x0 + i * (bw + gap), y, bw, 4);
            }
        }
        UIKit.text(ctx, `${Math.floor(ratio * 100)}%`, cx, y + 76, 26, T.gold, 'center', 'bold');
        const tip = LOADING_TIPS[Math.floor(t / 2.6) % LOADING_TIPS.length];
        UIKit.text(ctx, tip, cx, y + 150, 26, T.creamSoft, 'center');
    }
});
