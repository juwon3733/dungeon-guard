// UI 재질: 깊은 남색 판에 가는 금선과 네 모서리 금장(창), 은청색 입체 버튼, 금테·은테 칸. 색과 잘라 쓸 좌표는 여기에만 둔다.
// 창, 버튼, 칸은 48px 원본(ui_window, ui_button, ui_buttonHover, ui_itemSlot, ui_skillSlot)을 9칸으로 잘라 정수 배율(기본 2배)로 그린다.
// 금색 버튼은 화면에서 가장 중요한 행동 하나에만, 빨간 버튼은 위험한 행동에만 쓴다(docs/ART_BIBLE.md)

// 색 역할. 바탕은 모두 남색 판이라 글자는 밝은 색이다. 이름은 이전 재질의 역할 이름을 그대로 쓴다(ink = 창 위 본문)
const UI_THEME = {
    ink: '#eef2ff', // 창 위 본문
    inkSoft: '#a9b5d6', // 창 위 보조 글
    inkFaint: '#6b7799', // 흐린 글(잠김, 빈 칸)
    inkGood: '#7cf07a', // 좋은 효과
    inkBad: '#ff7a6a', // 나쁜 효과, 모자람
    inkWax: '#ffd35a', // 강조(제목 숫자, 비용)
    cream: '#ffffff', // 큰 글자
    creamSoft: '#c3cce6', // 보조 글
    gold: '#ffd34d', // 골드와 강조 숫자
    good: '#8ef08a',
    bad: '#ff8a78',
    soul: '#d9b8ff',
    outline: '#060a16', // 글자 외곽선
    navy: '#0e1730', navyLight: '#1b2a4e', navyDark: '#070d1d', // 창 바탕
    goldLine: '#e2ad45', goldLight: '#ffe08a', goldDark: '#7a5414', // 금선과 금장
    silver: '#8ea6cf', silverLight: '#d6e4ff', silverDark: '#3a4d72', // 은청색 버튼
    wax: '#c8323c', waxLight: '#ff7a6a', waxDark: '#6e1018', // 빨강(위험, 보스)
    iron: '#4a5878', ironLight: '#9fb2d6', ironDark: '#141c30', // 은테 칸
    walnut: '#0e1730', walnutDark: '#070d1d', // 이전 이름: 판 바탕(그림이 없을 때)
    parchment: '#16244a', parchmentDark: '#33466e', // 이전 이름: 창 안 구분선
    dim: 'rgba(5,9,24,0.62)', // 창을 띄울 때 뒤를 가라앉힌다(맵 위 상시 효과로는 쓰지 않는다)
    dimLight: 'rgba(5,9,24,0.38)'
};

// 9칸 원본 좌표(48px 그림 안). l/t/r/b는 모서리 크기. fill이 있으면 가운데를 반복하지 않고 그 색으로 칠한다(원본 가운데 잡티를 피한다).
// stretch가 있으면 변과 가운데를 반복하지 않고 늘린다(버튼의 위아래 음영이 줄무늬로 되풀이되지 않게)
const UI_SLICES = {
    window: { img: 'ui_window', x: 5, y: 7, w: 41, h: 35, l: 9, t: 8, r: 9, b: 8, fill: UI_THEME.navy },
    button: { img: 'ui_button', x: 4, y: 17, w: 40, h: 18, l: 4, t: 4, r: 4, b: 4, stretch: true },
    buttonHover: { img: 'ui_buttonHover', x: 4, y: 17, w: 40, h: 18, l: 4, t: 4, r: 4, b: 4, stretch: true },
    itemSlot: { img: 'ui_itemSlot', x: 9, y: 6, w: 33, h: 32, l: 7, t: 7, r: 7, b: 7, fill: '#151c2c' },
    skillSlot: { img: 'ui_skillSlot', x: 7, y: 6, w: 33, h: 34, l: 8, t: 8, r: 8, b: 8, fill: '#161a2a' },
    close: { img: 'ui_closeButton', x: 14, y: 14, w: 20, h: 19, l: 4, t: 4, r: 4, b: 4 }
};

// 버튼 색 바꾸기: 은청색 원본의 밝기는 두고 색만 바꾼 뒤(color) soft-light로 밝기를 살린다. 검은 테는 그대로 남는다. 픽셀을 읽지 않는다
const UI_RECOLOR = {
    gold: { color: '#ffbf30', light: '#ffd868' },
    red: { color: '#e43232', light: '#ff6a58' },
    off: { color: '#5a6476', light: '#3a4252' },
    navy: { color: '#2c4378', light: '#1a2848' }
};

// 칠한 입체 버튼 색: body 몸, light 위 밝은 띠, hover 마우스를 올렸을 때 띠, shine 맨 위 줄, dark 아래 그림자와 테 안쪽
const UI_BEVEL = {
    gold: { body: '#e8a92c', light: '#ffcf4f', hover: '#ffe08a', shine: '#fff4c4', dark: '#8a5410' },
    red: { body: '#c42c34', light: '#e8474c', hover: '#ff6a66', shine: '#ffb4a8', dark: '#5e0e16' },
    off: { body: '#4a5268', light: '#5a6380', hover: '#5a6380', shine: '#7c86a0', dark: '#262c3c' }
};

// 덧칠 색: 상태마다 그림 위에만(source-atop) 덮는다
const UI_TINTS = {
    hover: 'rgba(200,225,255,0.16)',
    off: 'rgba(40,46,62,0.55)',
    danger: 'rgba(120,0,10,0.3)',
    shade: 'rgba(5,9,24,0.55)'
};

const UIKit = {
    cache: new Map(),

    img(name) { return typeof Assets !== 'undefined' ? Assets.get(name) : null; },

    canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        return { c, g };
    },

    remember(key, c) {
        if (this.cache.size > 500) this.cache.clear();
        this.cache.set(key, c);
        return c;
    },

    // 원본 그림을 색만 바꾼 사본(UI_RECOLOR). 원본이 없으면 null
    recolored(name, tone) {
        const key = `rc|${name}|${tone}`;
        if (this.cache.has(key)) return this.cache.get(key);
        const img = this.img(name);
        if (!img) return null;
        const r = UI_RECOLOR[tone];
        const { c, g } = this.canvas(img.width, img.height);
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'color';
        g.fillStyle = r.color;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'soft-light';
        g.fillStyle = r.light;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(img, 0, 0);
        return this.remember(key, c);
    },

    // 잘라 둔 원본을 w x h로 짜 맞춘 캔버스(크기·배율·색·덧칠별로 한 번만 만든다)
    built(name, w, h, k, tint, tone) {
        const key = `${name}|${w}|${h}|${k}|${tint || ''}|${tone || ''}`;
        let c = this.cache.get(key);
        if (c) return c;
        const s = UI_SLICES[name];
        const img = tone ? this.recolored(s.img, tone) : this.img(s.img);
        if (!img) return null;
        const made = this.canvas(w, h);
        c = made.c;
        const g = made.g;
        const L = s.l * k, T = s.t * k, R = s.r * k, B = s.b * k;
        const tile = (sx, sy, sw, sh, dx, dy, dw, dh) => {
            if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
            if (s.stretch) {
                g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
                return;
            }
            for (let ty = 0; ty < dh; ty += sh * k) {
                const ph = Math.min(sh * k, dh - ty);
                for (let tx = 0; tx < dw; tx += sw * k) {
                    const pw = Math.min(sw * k, dw - tx);
                    g.drawImage(img, sx, sy, pw / k, ph / k, dx + tx, dy + ty, pw, ph);
                }
            }
        };
        const midW = w - L - R;
        const midH = h - T - B;
        const mw = s.w - s.l - s.r;
        const mh = s.h - s.t - s.b;
        if (s.fill) {
            g.fillStyle = s.fill;
            g.fillRect(L - k, T - k, midW + 2 * k, midH + 2 * k);
        } else {
            tile(s.x + s.l, s.y + s.t, mw, mh, L, T, midW, midH);
        }
        tile(s.x + s.l, s.y, mw, s.t, L, 0, midW, T);
        tile(s.x + s.l, s.y + s.h - s.b, mw, s.b, L, h - B, midW, B);
        tile(s.x, s.y + s.t, s.l, mh, 0, T, L, midH);
        tile(s.x + s.w - s.r, s.y + s.t, s.r, mh, w - R, T, R, midH);
        g.drawImage(img, s.x, s.y, s.l, s.t, 0, 0, L, T);
        g.drawImage(img, s.x + s.w - s.r, s.y, s.r, s.t, w - R, 0, R, T);
        g.drawImage(img, s.x, s.y + s.h - s.b, s.l, s.b, 0, h - B, L, B);
        g.drawImage(img, s.x + s.w - s.r, s.y + s.h - s.b, s.r, s.b, w - R, h - B, R, B);
        if (tint) {
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = UI_TINTS[tint] || tint;
            g.fillRect(0, 0, w, h);
        }
        return this.remember(key, c);
    },

    // 9칸 그리기. k는 배율(기본 2, 모서리가 들어가지 않으면 1)
    nine(ctx, name, x, y, w, h, opts) {
        const o = opts || {};
        const s = UI_SLICES[name] || UI_SLICES.window;
        w = Math.round(w);
        h = Math.round(h);
        if (w <= 0 || h <= 0) return;
        let k = o.k || 2;
        while (k > 1 && ((s.l + s.r) * k > w || (s.t + s.b) * k > h)) k--;
        const c = this.built(UI_SLICES[name] ? name : 'window', w, h, k, o.tint, o.tone);
        if (!c) {
            this.flat(ctx, x, y, w, h);
            return;
        }
        ctx.drawImage(c, Math.round(x), Math.round(y));
    },

    // 그림을 못 불러왔을 때(불러오기 화면 등): 남색 판과 금선
    flat(ctx, x, y, w, h) {
        const T = UI_THEME;
        ctx.fillStyle = T.outline;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = T.navy;
        ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(x + 6, y + 6, w - 12, 2);
        ctx.fillRect(x + 6, y + h - 8, w - 12, 2);
    },

    // 창: 남색 판, 가는 금선, 네 모서리 금장(ui_window). 이전 옵션(seal, iron)은 모두 같은 창이다
    panel(ctx, x, y, w, h, opts) {
        const o = opts || {};
        this.nine(ctx, 'window', x, y, w, h, { tint: o.tint });
    },

    // 띠: 남색 판에 위아래 금선(하단 바 바깥, 표지판, 연출 띠). 모서리 금장 없이 길게 늘인다
    plank(ctx, x, y, w, h, opts) {
        const o = opts || {};
        const T = UI_THEME;
        x = Math.round(x);
        y = Math.round(y);
        w = Math.round(w);
        h = Math.round(h);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = T.navy;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = T.navyLight;
        ctx.fillRect(x + 2, y + 2, w - 4, Math.min(10, Math.round(h / 5)));
        ctx.fillStyle = T.goldDark;
        ctx.fillRect(x + 2, y + 4, w - 4, 4);
        ctx.fillRect(x + 2, y + h - 8, w - 4, 4);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(x + 2, y + 4, w - 4, 2);
        ctx.fillRect(x + 2, y + h - 8, w - 4, 2);
        if (o.tint) {
            ctx.fillStyle = UI_TINTS[o.tint] || o.tint;
            ctx.fillRect(x, y, w, h);
        }
    },

    // 칸. kind: 'iron'(은테) | 'light'(밝은 은테) | 'gold'(금테)
    slot(ctx, x, y, w, h, kind, tint) {
        if (kind === 'gold') this.nine(ctx, 'skillSlot', x, y, w, h, { tint, k: w >= 40 ? 2 : 1 });
        else this.nine(ctx, 'itemSlot', x, y, w, h, { tint: tint || (kind === 'light' ? 'rgba(200,225,255,0.08)' : null), k: w >= 40 ? 2 : 1 });
    },

    // 작은 창(설명, 말풍선, 쪽지): 남색 판과 가는 금테, 계단 모서리. red: 진한 빨강 판(보스, 위험)
    note(ctx, x, y, w, h, opts) {
        const o = opts || {};
        x = Math.round(x);
        y = Math.round(y);
        w = Math.round(w);
        h = Math.round(h);
        const T = UI_THEME;
        const key = `note|${w}|${h}|${o.tint || ''}|${o.red ? 1 : 0}`;
        let c = this.cache.get(key);
        if (!c && typeof document !== 'undefined') {
            const made = this.canvas(w, h);
            const g = made.g;
            const shape = (inset, color) => {
                g.fillStyle = color;
                g.fillRect(inset + 4, inset, w - inset * 2 - 8, h - inset * 2);
                g.fillRect(inset, inset + 4, w - inset * 2, h - inset * 2 - 8);
                g.fillRect(inset + 2, inset + 2, w - inset * 2 - 4, h - inset * 2 - 4);
            };
            shape(0, T.outline);
            shape(2, o.red ? '#e8a23a' : T.goldLine);
            shape(4, o.red ? '#5a0c16' : T.navy);
            g.fillStyle = o.red ? 'rgba(255,120,110,0.18)' : 'rgba(120,160,255,0.10)';
            g.fillRect(6, 6, w - 12, Math.max(2, Math.round((h - 12) / 3)));
            if (o.tint) {
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = UI_TINTS[o.tint] || o.tint;
                g.fillRect(0, 0, w, h);
            }
            c = this.remember(key, made.c);
        }
        if (c) ctx.drawImage(c, x, y);
        else this.flat(ctx, x, y, w, h);
        if (o.pin) this.nail(ctx, x + w / 2, y + 2);
    },

    // 금장 하나(가운데 cx, cy): 진한 테와 금 마름모
    nail(ctx, cx, cy) {
        const T = UI_THEME;
        const x = Math.round(cx);
        const y = Math.round(cy);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x - 6, y - 4, 12, 8);
        ctx.fillRect(x - 4, y - 6, 8, 12);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(x - 4, y - 2, 8, 4);
        ctx.fillRect(x - 2, y - 4, 4, 8);
        ctx.fillStyle = T.goldLight;
        ctx.fillRect(x - 2, y - 2, 2, 2);
    },

    // 금 사슬(이름판을 매다는 줄): (x, y0)에서 (x, y1)까지
    chain(ctx, x, y0, y1) {
        const T = UI_THEME;
        x = Math.round(x);
        for (let y = Math.round(y0), i = 0; y < y1; y += 8, i++) {
            const h = Math.min(8, y1 - y);
            ctx.fillStyle = T.outline;
            ctx.fillRect(x - 4, y, 8, h);
            ctx.fillStyle = i % 2 ? T.goldDark : T.goldLine;
            ctx.fillRect(x - 2, y, 4, h);
        }
    },

    // 초상 액자: 금테 네모(이전 이름 waxFrame). 안쪽 그림 자리는 (x+8, y+8)부터 size-16
    waxFrame(ctx, x, y, size, color) {
        const T = UI_THEME;
        x = Math.round(x);
        y = Math.round(y);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = color || T.goldLine;
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.fillStyle = T.goldLight;
        ctx.fillRect(x + 4, y + 2, size - 8, 2);
        ctx.fillStyle = T.goldDark;
        ctx.fillRect(x + 4, y + size - 4, size - 8, 2);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
        ctx.fillStyle = '#1c2848';
        ctx.fillRect(x + 8, y + 8, size - 16, size - 16);
        for (const [cx, cy] of [[x + 3, y + 3], [x + size - 3, y + 3], [x + 3, y + size - 3], [x + size - 3, y + size - 3]]) this.nail(ctx, cx, cy);
    },

    // 등급 테두리: 굵고 밝은 등급 색 띠와 바깥 진한 선, 안쪽 위 밝은 줄. color는 MONSTER_GRADES[..].color
    gradeFrame(ctx, x, y, w, h, color, thick) {
        const t = thick || 4;
        x = Math.round(x);
        y = Math.round(y);
        ctx.fillStyle = UI_THEME.outline;
        ctx.fillRect(x - 2, y - 2, w + 4, 2);
        ctx.fillRect(x - 2, y + h, w + 4, 2);
        ctx.fillRect(x - 2, y, 2, h);
        ctx.fillRect(x + w, y, 2, h);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, t);
        ctx.fillRect(x, y + h - t, w, t);
        ctx.fillRect(x, y, t, h);
        ctx.fillRect(x + w - t, y, t, h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + t, y + t, w - t * 2, 2);
    },

    // 48px 아이콘(uiicon_<name>)을 정수 배율로
    icon(ctx, name, x, y, scale) {
        const img = this.img(`uiicon_${name}`);
        if (!img) return;
        const s = 48 * (scale || 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), s, s);
    },

    // 버튼 바탕. kind: 'primary'(금색, 화면에서 가장 중요한 행동) | 'silver'(은청색 보통 버튼) | 'tab'(켜진 탭) |
    // 'tabOff'(꺼진 탭) | 'danger'(빨강) | 'off'(누를 수 없음). 누른 동안은 2px 내려앉는다. 내용에 더할 dy를 돌려준다
    button(ctx, x, y, w, h, kind, state) {
        const st = state || {};
        const dy = st.pressed ? 2 : 0;
        const hover = st.hover && !st.pressed;
        const k = h >= 40 ? 2 : 1;
        if (kind === 'primary') {
            this.bevel(ctx, x, y + dy, w, h, UI_BEVEL.gold, hover);
        } else if (kind === 'danger') {
            this.bevel(ctx, x, y + dy, w, h, UI_BEVEL.red, hover);
        } else if (kind === 'off') {
            this.bevel(ctx, x, y, w, h, UI_BEVEL.off, false);
        } else if (kind === 'tab') {
            this.nine(ctx, 'buttonHover', x, y + dy, w, h, { k });
            this.gradeFrame(ctx, x + 2, y + dy + 2, w - 4, h - 4, UI_THEME.goldLine, 2);
        } else if (kind === 'tabOff') {
            this.nine(ctx, 'button', x, y + dy, w, h, { tone: 'navy', tint: hover ? 'hover' : null, k });
        } else {
            this.nine(ctx, hover ? 'buttonHover' : 'button', x, y + dy, w, h, { k });
        }
        return dy;
    },

    // 칠한 입체 버튼(금색, 빨강, 누를 수 없음): ui_button과 같은 모양(진한 테, 깎은 모서리)에 위 밝은 띠, 아래 그림자 띠
    bevel(ctx, x, y, w, h, c, hover) {
        x = Math.round(x);
        y = Math.round(y);
        w = Math.round(w);
        h = Math.round(h);
        const key = `bevel|${w}|${h}|${c.body}|${hover ? 1 : 0}`;
        let cv = this.cache.get(key);
        if (!cv) {
            const { c: canvas, g } = this.canvas(w, h);
            const n = 4; // 깎은 모서리
            const shape = (inset, color, x0, y0, x1, y1) => {
                g.fillStyle = color;
                const l = (x0 === undefined ? 0 : x0) + inset;
                const t = (y0 === undefined ? 0 : y0) + inset;
                const r = (x1 === undefined ? w : x1) - inset;
                const b = (y1 === undefined ? h : y1) - inset;
                g.fillRect(l + n, t, r - l - n * 2, b - t);
                g.fillRect(l, t + n, r - l, b - t - n * 2);
                g.fillRect(l + n / 2, t + n / 2, r - l - n, b - t - n);
            };
            shape(0, UI_THEME.outline);
            shape(2, c.dark);
            shape(2, c.body, 0, 0, w, h - 6);
            g.fillStyle = hover ? c.hover : c.light;
            g.fillRect(8, 6, w - 16, Math.max(4, Math.round((h - 12) * 0.38)));
            g.fillStyle = c.shine;
            g.fillRect(6, 4, w - 12, 2);
            g.fillRect(4, 6, 2, h - 18);
            g.fillStyle = c.dark;
            g.fillRect(w - 6, 8, 2, h - 18);
            cv = this.remember(key, canvas);
        }
        ctx.drawImage(cv, x, y);
    },

    // 버튼 위 글자 색
    buttonInk(kind) {
        if (kind === 'off' || kind === 'tabOff') return '#b4bdd2';
        if (kind === 'primary') return '#fffaf0';
        return UI_THEME.cream;
    },

    // 체력 막대: 진한 테, 빈 칸 남색, 찬 칸 빨강(위쪽 밝은 줄). 높이 24. glow는 제물로 차오를 때 막대 빛
    hpBar(ctx, x, y, w, ratio, glow) {
        const h = 24;
        this.bar(ctx, x, y, w, h, ratio, '#e2384a');
        if (glow > 0) {
            ctx.save();
            ctx.globalAlpha = glow * 0.55;
            ctx.fillStyle = '#ffe2a0';
            ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), h);
            ctx.restore();
        }
    },

    // 어떤 바탕에서도 읽히도록 진한 남색 외곽선을 두른 글자
    text(ctx, str, x, y, size, color, align, weight) {
        ctx.font = `${weight || ''} ${size}px ${UI_FONT}`.trim();
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(4, size / 5);
        ctx.strokeStyle = UI_THEME.outline;
        ctx.strokeText(str, x, y);
        ctx.fillStyle = color || UI_THEME.cream;
        ctx.fillText(str, x, y);
    },

    // 창 위 글자(외곽선 없음, 기본 밝은 색)
    ink(ctx, str, x, y, size, color, align, weight) {
        ctx.font = `${weight || ''} ${size}px ${UI_FONT}`.trim();
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color || UI_THEME.ink;
        ctx.fillText(str, x, y);
    },

    plain(ctx, str, x, y, size, color, align) {
        this.ink(ctx, str, x, y, size, color || UI_THEME.ink, align);
    },

    // 화려한 숫자(데미지, 처치, 골드): 굵은 글자에 두꺼운 외곽선, 아래쪽 그림자, 위쪽 반을 밝게
    bigText(ctx, str, x, y, size, color, align, light) {
        ctx.font = `bold ${size}px ${UI_FONT}`;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        const lw = Math.max(5, size / 4);
        ctx.lineWidth = lw;
        ctx.strokeStyle = UI_THEME.outline;
        ctx.strokeText(str, x, y + Math.max(2, size / 14));
        ctx.strokeText(str, x, y);
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
        if (light) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x - size * str.length, y - size, size * str.length * 2, size * 0.92);
            ctx.clip();
            ctx.fillStyle = light;
            ctx.fillText(str, x, y);
            ctx.restore();
        }
    },

    // 단순 막대: 진한 테, 빈 칸, 찬 칸 한 색과 위쪽 밝은 줄
    bar(ctx, x, y, w, h, ratio, color) {
        const T = UI_THEME;
        ctx.fillStyle = T.outline;
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = '#1a2440';
        ctx.fillRect(x, y, w, h);
        const fill = Math.round(w * clamp(ratio, 0, 1));
        ctx.fillStyle = color || T.wax;
        ctx.fillRect(x, y, fill, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y, fill, Math.max(2, Math.round(h / 4)));
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + h - Math.max(2, Math.round(h / 5)), fill, Math.max(2, Math.round(h / 5)));
    },

    // 이전 이름(테마별 틀)을 새 재질로 옮긴다. 새 코드는 panel, plank, slot, note, button을 직접 쓴다
    frame(ctx, x, y, w, h, themeName) {
        if (themeName === 'danger') this.note(ctx, x, y, w, h, { red: true });
        else if (themeName === 'dark') this.slot(ctx, x, y, w, h);
        else if (themeName === 'gold') this.slot(ctx, x, y, w, h, 'gold');
        else if (themeName === 'speech') this.note(ctx, x, y, w, h);
        else this.panel(ctx, x, y, w, h);
    }
};
