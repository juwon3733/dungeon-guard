// 마왕군 작전 테이블 UI 재질: 양피지, 나무판, 쇠 장식, 붉은 밀랍. 색과 잘라 쓸 좌표는 여기에만 둔다.
// 창과 버튼은 ui_kit.png, ui_buttons.png를 9칸으로 잘라 정수 배율(기본 2배)로 그린다. 모서리는 배율 그대로, 변과 가운데는 반복한다.
// 그라디언트로 입체를 내지 않는다. 밝기 차이는 도트 재질과 덧칠(source-atop)로만 낸다.

// 색 역할. 글자 색은 바탕 재질로 고른다: 양피지 위는 ink, 나무·지도 위는 cream(진한 갈색 외곽선)
const UI_THEME = {
    ink: '#3a2414', // 양피지 위 본문
    inkSoft: '#6b4a2e', // 양피지 위 보조 글
    inkFaint: '#8f7354', // 양피지 위 흐린 글(잠김, 빈 칸)
    inkGood: '#2f6b1f', // 양피지 위 좋은 효과
    inkBad: '#a3221e', // 양피지 위 나쁜 효과, 모자람
    inkWax: '#8f1d1d', // 양피지 위 강조(제목 숫자, 비용)
    cream: '#fff1d6', // 나무·지도 위 글
    creamSoft: '#e8d3ad', // 나무 위 보조 글
    gold: '#ffd25a', // 나무 위 골드와 강조 숫자
    good: '#a8e68a', // 나무·지도 위 좋은 효과
    bad: '#ff9a84', // 나무·지도 위 나쁜 효과, 모자람
    soul: '#d9b8ff', // 영혼석 수(나무 위)
    outline: '#1e120a', // 글자 외곽선
    wax: '#a8242c', waxLight: '#d4574c', waxDark: '#5e1016', // 붉은 밀랍
    iron: '#4a464e', ironLight: '#9a968c', ironDark: '#1c1a20', // 쇠 장식
    walnut: '#3b2416', walnutDark: '#24150c', // 호두나무 판(그림이 없을 때 대신 칠하는 색)
    parchment: '#ecd3a2', parchmentDark: '#c9a66c', // 양피지(그림이 없을 때)
    dim: 'rgba(28,16,8,0.62)', // 화면을 덮는 따뜻한 어둠(보상, 결과)
    dimLight: 'rgba(28,16,8,0.38)'
};

// 잘라 쓸 좌표(원본 px). l/t/r/b는 모서리 크기, mx/mw·my/mh는 변에서 반복할 띠, cx/cy/cw/ch는 가운데에서 반복할 칸
const UI_SLICES = {
    // ui_kit.png 왼쪽 위: 나무 테 양피지 창(위 판자 머리, 오른쪽 아래 붉은 밀랍 도장)
    parchment: { img: 'ui_kit', x: 14, y: 14, w: 79, h: 59, l: 22, t: 18, r: 22, b: 19, mx: 40, mw: 24, my: 36, mh: 12, cx: 36, cy: 33, cw: 34, ch: 20 },
    // ui_kit.png 가운데 왼쪽: 쇠 테 양피지 창(팝업용)
    parchmentIron: { img: 'ui_kit', x: 14, y: 82, w: 79, h: 57, l: 22, t: 18, r: 22, b: 19, mx: 40, mw: 24, my: 104, mh: 12, cx: 36, cy: 101, cw: 34, ch: 18 },
    // ui_kit.png 쇠테 칸(어두운 쇠, 밝은 쇠, 금)
    slot: { img: 'ui_kit', x: 101, y: 145, w: 16, h: 16, l: 3, t: 3, r: 3, b: 3, mx: 104, mw: 8, my: 150, mh: 4 },
    slotLight: { img: 'ui_kit', x: 101, y: 164, w: 16, h: 16, l: 4, t: 4, r: 4, b: 4, mx: 105, mw: 6, my: 170, mh: 4 },
    slotGold: { img: 'ui_kit', x: 101, y: 183, w: 16, h: 16, l: 3, t: 3, r: 3, b: 4, mx: 105, mw: 6, my: 187, mh: 4 },
    // ui_buttons.png: 쇠 못을 박은 호두나무 판(하단 바, 표지판), 나무 버튼, 붉은 옻칠 버튼(가운데 글자는 비켜서 자른다)
    woodBar: { img: 'ui_buttons', x: 14, y: 81, w: 228, h: 64, l: 14, t: 14, r: 14, b: 13, mx: 40, mw: 160, my: 95, mh: 36 },
    wood: { img: 'ui_buttons', x: 96, y: 151, w: 64, h: 36, l: 9, t: 15, r: 9, b: 13, mx: 112, mw: 8, my: 166, mh: 6 },
    lacquer: { img: 'ui_buttons', x: 32, y: 32, w: 81, h: 33, l: 12, t: 11, r: 12, b: 10, mx: 42, mw: 4, my: 46, mh: 4 }
};
// 체력 막대(ui_kit.png 왼쪽 아래): 하트 구슬, 막대 왼끝, 찬 칸, 빈 칸, 오른끝(모두 높이 10)
const UI_HP_BAR = {
    heart: [13, 204, 14, 14],
    left: [27, 206, 4, 10],
    full: [45, 206, 4, 10],
    empty: [56, 222, 4, 10],
    right: [64, 222, 4, 10]
};

// 덧칠 색: 상태마다 그림 위에만(source-atop) 덮는다
const UI_TINTS = {
    hover: 'rgba(255,236,200,0.16)',
    off: 'rgba(146,134,118,0.66)', // 빛바랜 회갈색
    danger: 'rgba(52,0,6,0.42)', // 진한 빨강
    shade: 'rgba(28,16,8,0.45)'
};

const UIKit = {
    cache: new Map(),

    img(name) { return typeof Assets !== 'undefined' ? Assets.get(name) : null; },

    // 잘라 둔 창을 w x h로 짜 맞춘 캔버스(크기·배율·덧칠별로 한 번만 만든다)
    built(name, w, h, k, tint, flip) {
        const key = `${name}|${w}|${h}|${k}|${tint || ''}|${flip ? 1 : 0}`;
        let c = this.cache.get(key);
        if (c) return c;
        const s = UI_SLICES[name];
        const img = this.img(s.img);
        if (!img) return null;
        if (this.cache.size > 400) this.cache.clear();
        c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const mx = s.mx !== undefined ? s.mx : s.x + s.l;
        const mw = s.mw !== undefined ? s.mw : s.w - s.l - s.r;
        const my = s.my !== undefined ? s.my : s.y + s.t;
        const mh = s.mh !== undefined ? s.mh : s.h - s.t - s.b;
        const cx = s.cx !== undefined ? s.cx : mx;
        const cy = s.cy !== undefined ? s.cy : my;
        const cw = s.cw !== undefined ? s.cw : mw;
        const ch = s.ch !== undefined ? s.ch : mh;
        const L = s.l * k, T = s.t * k, R = s.r * k, B = s.b * k;
        // 원본 칸(sx, sy, sw, sh)을 대상 칸(dx, dy, dw, dh)에 배율 k로 반복해 깐다. 끝은 잘라서
        const tile = (sx, sy, sw, sh, dx, dy, dw, dh) => {
            if (dw <= 0 || dh <= 0) return;
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
        tile(cx, cy, cw, ch, L, T, midW, midH);
        tile(mx, s.y, mw, s.t, L, 0, midW, T);
        tile(mx, s.y + s.h - s.b, mw, s.b, L, h - B, midW, B);
        tile(s.x, my, s.l, mh, 0, T, L, midH);
        tile(s.x + s.w - s.r, my, s.r, mh, w - R, T, R, midH);
        g.drawImage(img, s.x, s.y, s.l, s.t, 0, 0, L, T);
        g.drawImage(img, s.x + s.w - s.r, s.y, s.r, s.t, w - R, 0, R, T);
        g.drawImage(img, s.x, s.y + s.h - s.b, s.l, s.b, 0, h - B, L, B);
        if (flip) {
            // 밀랍 도장 없는 창: 오른쪽 아래 모서리를 왼쪽 아래 모서리의 좌우 반전으로
            g.save();
            g.translate(w, 0);
            g.scale(-1, 1);
            g.drawImage(img, s.x, s.y + s.h - s.b, s.l, s.b, 0, h - B, L, B);
            g.restore();
        } else {
            g.drawImage(img, s.x + s.w - s.r, s.y + s.h - s.b, s.r, s.b, w - R, h - B, R, B);
        }
        if (tint) {
            g.globalCompositeOperation = 'source-atop';
            g.fillStyle = UI_TINTS[tint] || tint;
            g.fillRect(0, 0, w, h);
        }
        this.cache.set(key, c);
        return c;
    },

    // 9칸 창 그리기. k는 배율(기본 2, 모서리가 들어가지 않으면 1)
    nine(ctx, name, x, y, w, h, opts) {
        const o = opts || {};
        const s = UI_SLICES[name];
        w = Math.round(w);
        h = Math.round(h);
        let k = o.k || 2;
        while (k > 1 && ((s.l + s.r) * k > w || (s.t + s.b) * k > h)) k--;
        const c = this.built(name, w, h, k, o.tint, o.flip);
        if (!c) {
            this.flat(ctx, x, y, w, h, name);
            return;
        }
        ctx.drawImage(c, Math.round(x), Math.round(y));
    },

    // 그림을 못 불러왔을 때(불러오기 화면 등) 재질 색으로만 칠한다
    flat(ctx, x, y, w, h, name) {
        const T = UI_THEME;
        const fill = name.startsWith('parchment') ? T.parchment : (name === 'lacquer' ? T.wax : (name.startsWith('slot') ? T.iron : T.walnut));
        ctx.fillStyle = T.outline;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = fill;
        ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    },

    // 양피지 창. seal: 오른쪽 아래 붉은 밀랍 도장, iron: 쇠 테
    panel(ctx, x, y, w, h, opts) {
        const o = opts || {};
        this.nine(ctx, o.iron ? 'parchmentIron' : 'parchment', x, y, w, h, { flip: !o.iron && !o.seal, tint: o.tint });
    },

    // 나무판(쇠 못). 하단 바, 표지판, 띠
    plank(ctx, x, y, w, h, opts) {
        this.nine(ctx, 'woodBar', x, y, w, h, opts);
    },

    // 쇠테 칸. kind: 'iron' | 'light' | 'gold'
    slot(ctx, x, y, w, h, kind, tint) {
        this.nine(ctx, kind === 'gold' ? 'slotGold' : (kind === 'light' ? 'slotLight' : 'slot'), x, y, w, h, { tint });
    },

    // 양피지 쪽지(작은 창, 말풍선, 켜진 탭): 양피지 무늬를 깔고 진한 갈색 테두리, 계단 모서리. pin: 위에 쇠 못
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
            c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            // 계단 모서리(4px) 모양
            const shape = (inset, color) => {
                g.fillStyle = color;
                g.fillRect(inset + 4, inset, w - inset * 2 - 8, h - inset * 2);
                g.fillRect(inset, inset + 4, w - inset * 2, h - inset * 2 - 8);
                g.fillRect(inset + 2, inset + 2, w - inset * 2 - 4, h - inset * 2 - 4);
            };
            shape(0, T.outline);
            const kit = this.img('ui_kit');
            if (o.red) {
                shape(2, T.wax);
                g.fillStyle = T.waxDark;
                g.fillRect(4, h - 6, w - 8, 3);
                g.fillStyle = T.waxLight;
                g.fillRect(6, 4, w - 12, 2);
            } else {
                shape(2, T.parchment);
                if (kit) {
                    // 양피지 무늬(ui_kit 가운데)를 2배로 반복해 깐다
                    g.save();
                    g.beginPath();
                    g.rect(4, 4, w - 8, h - 8);
                    g.clip();
                    for (let ty = 2; ty < h; ty += 40) for (let tx = 2; tx < w; tx += 68) g.drawImage(kit, 36, 33, 34, 20, tx, ty, 68, 40);
                    g.restore();
                }
                // 아래와 오른쪽은 그을린 가장자리
                g.fillStyle = T.parchmentDark;
                g.fillRect(4, h - 6, w - 8, 3);
                g.fillRect(w - 6, 4, 3, h - 8);
            }
            if (o.tint) {
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = UI_TINTS[o.tint] || o.tint;
                g.fillRect(0, 0, w, h);
            }
            if (this.cache.size > 400) this.cache.clear();
            this.cache.set(key, c);
        }
        if (c) ctx.drawImage(c, x, y);
        else this.flat(ctx, x, y, w, h, 'parchment');
        if (o.pin) this.nail(ctx, x + w / 2, y + 6);
    },

    // 쇠 못 하나(가운데 cx, cy)
    nail(ctx, cx, cy) {
        const T = UI_THEME;
        const x = Math.round(cx) - 4;
        const y = Math.round(cy) - 4;
        ctx.fillStyle = T.ironDark;
        ctx.fillRect(x - 2, y - 2, 12, 12);
        ctx.fillStyle = T.iron;
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = T.ironLight;
        ctx.fillRect(x, y, 4, 4);
    },

    // 쇠사슬: (x, y0)에서 (x, y1)까지 세운 고리와 옆으로 누운 고리를 번갈아
    chain(ctx, x, y0, y1) {
        const T = UI_THEME;
        x = Math.round(x);
        for (let y = Math.round(y0), i = 0; y < y1; y += 10, i++) {
            const h = Math.min(12, y1 - y);
            if (i % 2 === 0) {
                ctx.fillStyle = T.ironDark;
                ctx.fillRect(x - 6, y, 12, h);
                ctx.fillStyle = T.iron;
                ctx.fillRect(x - 4, y, 8, h);
                ctx.fillStyle = T.ironDark;
                ctx.fillRect(x - 2, y + 2, 4, Math.max(0, h - 4));
                ctx.fillStyle = T.ironLight;
                ctx.fillRect(x - 4, y, 2, Math.min(4, h));
            } else {
                ctx.fillStyle = T.ironDark;
                ctx.fillRect(x - 2, y, 4, h);
                ctx.fillStyle = T.ironLight;
                ctx.fillRect(x - 1, y, 2, h);
            }
        }
    },

    // 붉은 밀랍 테두리(초상 액자). 안쪽 그림 자리는 (x+8, y+8)부터 size-16
    waxFrame(ctx, x, y, size) {
        const T = UI_THEME;
        x = Math.round(x);
        y = Math.round(y);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = T.wax;
        ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
        ctx.fillStyle = T.waxLight;
        ctx.fillRect(x + 4, y + 2, size - 10, 2);
        ctx.fillRect(x + 2, y + 4, 2, size - 10);
        ctx.fillStyle = T.waxDark;
        ctx.fillRect(x + 6, y + size - 4, size - 8, 2);
        ctx.fillRect(x + size - 4, y + 6, 2, size - 10);
        // 아래로 흘러내린 밀랍 방울
        for (const [dx, len] of [[0.22, 8], [0.6, 12], [0.82, 6]]) {
            const px = x + Math.round(size * dx);
            ctx.fillStyle = T.outline;
            ctx.fillRect(px - 2, y + size - 2, 8, len + 2);
            ctx.fillStyle = T.wax;
            ctx.fillRect(px, y + size - 2, 4, len);
            ctx.fillStyle = T.waxDark;
            ctx.fillRect(px + 2, y + size - 2, 2, len);
        }
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
    },

    // 등급 테두리: 굵고 밝은 등급 색 띠와 바깥 진한 선. color는 MONSTER_GRADES[..].color
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
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
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

    // 버튼 바탕. kind: 'primary'(붉은 옻칠) | 'wood' | 'tab'(켜진 탭, 양피지) | 'danger'(진한 빨강 쇠테) | 'off'(빛바랜).
    // 누른 동안은 2px 내려앉는다. 내용을 그릴 때 더할 dy를 돌려준다
    button(ctx, x, y, w, h, kind, state) {
        const st = state || {};
        const dy = st.pressed ? 2 : 0;
        const tint = st.hover && !st.pressed ? 'hover' : null;
        if (kind === 'tab') this.note(ctx, x, y + dy, w, h, { tint });
        else if (kind === 'primary') this.nine(ctx, 'lacquer', x, y + dy, w, h, { tint });
        else if (kind === 'danger') this.nine(ctx, 'lacquer', x, y + dy, w, h, { tint: 'danger' });
        else if (kind === 'off') this.nine(ctx, 'wood', x, y, w, h, { tint: 'off' });
        else this.nine(ctx, 'wood', x, y + dy, w, h, { tint });
        if (kind === 'danger' && st.hover) this.nine(ctx, 'lacquer', x, y + dy, w, h, { tint: 'rgba(52,0,6,0.25)' });
        return dy;
    },

    // 버튼 위 글자 색
    buttonInk(kind) {
        if (kind === 'tab') return UI_THEME.ink;
        if (kind === 'off') return '#e4dacb';
        return UI_THEME.cream;
    },

    // 체력 막대: 하트 구슬과 빨간 막대(ui_kit). 높이는 20(2배). glow는 제물로 차오를 때 막대 빛
    hpBar(ctx, x, y, w, ratio, glow) {
        const img = this.img('ui_kit');
        const k = 2;
        const H = UI_HP_BAR;
        const bx = x + 22;
        const by = y + 4;
        const bw = w - 22;
        if (!img) {
            this.bar(ctx, bx, by, bw, 20, ratio, UI_THEME.wax);
            return;
        }
        ctx.imageSmoothingEnabled = false;
        const part = (p, dx, dy) => ctx.drawImage(img, p[0], p[1], p[2], p[3], dx, dy, p[2] * k, p[3] * k);
        // 원본 띠 p를 dx부터 dw만큼 배율 k로 반복해 깐다(끝은 잘라서)
        const run = (p, dx, dy, dw) => {
            for (let tx = 0; tx < dw; tx += p[2] * k) {
                const pw = Math.min(p[2] * k, dw - tx);
                ctx.drawImage(img, p[0], p[1], pw / k, p[3], dx + tx, dy, pw, p[3] * k);
            }
        };
        part(H.left, bx, by);
        const inner = bw - (H.left[2] + H.right[2]) * k;
        run(H.empty, bx + H.left[2] * k, by, inner);
        part(H.right, bx + bw - H.right[2] * k, by);
        const fill = Math.round(inner * clamp(ratio, 0, 1));
        run(H.full, bx + H.left[2] * k, by, fill);
        if (glow > 0) {
            ctx.save();
            ctx.globalAlpha = glow * 0.55;
            ctx.fillStyle = '#ffe2a0';
            ctx.fillRect(bx + H.left[2] * k, by + 4, fill, 12);
            ctx.restore();
        }
        part(H.heart, x, y);
    },

    // 어떤 바탕에서도 읽히도록 진한 갈색 외곽선을 두른 글자(나무, 지도, 밀랍 위)
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

    // 양피지 위 글자(외곽선 없음, 기본 진한 갈색)
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

    // 단순 막대(불러오기 화면, 보스 체력): 진한 테, 빈 칸, 찬 칸 한 색과 위쪽 밝은 줄
    bar(ctx, x, y, w, h, ratio, color) {
        const T = UI_THEME;
        ctx.fillStyle = T.outline;
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(x, y, w, h);
        const fill = Math.round(w * clamp(ratio, 0, 1));
        ctx.fillStyle = color || T.wax;
        ctx.fillRect(x, y, fill, h);
        ctx.fillStyle = 'rgba(255,236,200,0.35)';
        ctx.fillRect(x, y, fill, Math.max(2, Math.round(h / 5)));
    },

    // 이전 이름(테마별 틀)을 새 재질로 옮긴다. 새 코드는 panel, plank, slot, note, button을 직접 쓴다
    frame(ctx, x, y, w, h, themeName) {
        if (themeName === 'speech') this.note(ctx, x, y, w, h);
        else if (themeName === 'danger') this.note(ctx, x, y, w, h, { red: true });
        else if (themeName === 'dark') this.slot(ctx, x, y, w, h);
        else if (themeName === 'gold') this.slot(ctx, x, y, w, h, 'gold');
        else if (themeName === 'panel') this.panel(ctx, x, y, w, h);
        else this.nine(ctx, 'wood', x, y, w, h);
    }
};
