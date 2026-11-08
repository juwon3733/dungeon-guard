// 튜토리얼: 본부 첫 안내(시설 다섯 곳을 차례로 짚는다)와 첫 판 따라 하기(소환 → 합치기 → 라운드 시작 → 번개)
// 화면을 어둡게 하고 눌러야 할 곳만 밝힌다. 그 단계의 버튼과 키만 받고, 건너뛰기는 언제나 된다.
// 본 기록은 Meta.data.tutorial에 남는다(기록 지우기와 설정의 "튜토리얼 다시 보기"로 처음부터)
const TUTORIAL_HQ_STEPS = [
    { facility: 'wartable', text: '작전 테이블 · 스토리 출전' },
    { facility: 'portal', text: '도전의 문 · 일일 · 심연 · 토벌' },
    { facility: 'bookshelf', text: '서재 · 도감과 조합식' },
    { facility: 'relic_case', text: '보물 진열장 · 마왕과 유물' },
    { facility: 'weapon_rack', text: '무기고 · 장비' },
    { facility: 'wartable', text: '첫 출전은 여기서' }
];
// 첫 판 단계: target(목표 네모들), done(끝났는지), allow(누를 수 있는 버튼 id), keys(받는 키)
const TUTORIAL_BATTLE_STEPS = ['summon', 'merge', 'start', 'lightning', 'aim', 'end'];
const TUTORIAL_END_TIME = 2.6; // 마지막 쪽지가 떠 있는 시간
const TUTORIAL_PAD = 10; // 밝힌 자리 둘레 여백

function tutorialSeen(kind) {
    const t = Meta.data.tutorial;
    return !!(t && t[kind]);
}

Object.assign(UI, {
    tutorialOff: false, // 자동 시험이 끈다(시험마다 첫 판을 따라 하지 않게)
    tut: null, // { kind: 'hq' | 'battle', step, age }

    // 매 프레임(layout 끝): 시작할 때인지, 단계가 끝났는지 보고 건너뛰기 버튼을 얹는다
    layoutTutorial() {
        this.updateTutorial();
        const t = this.tut;
        if (!t) return;
        if (t.kind === 'battle' && this.tutStep() === 'end') return;
        this.button('tut_skip', GAME_WIDTH / 2 - 150, 14, 300, 60, { label: '튜토리얼 건너뛰기', size: 22, onClick: () => this.finishTutorial() });
    },

    updateTutorial() {
        if (this.tutorialOff) return;
        const G = Game;
        const calm = !this.dialogue && !this.unlockCards && !this.collection;
        if (!this.tut) {
            if (G.state === 'hq' && !this.hqView && !this.hqSettings && calm && !tutorialSeen('hq')) this.tut = { kind: 'hq', step: 0, age: 0 };
            else if (G.state === 'prep' && G.waveIndex === 0 && !G.challenge && calm && !G.bossReward && !tutorialSeen('battle') && G.monsters.length === 0) {
                this.tut = { kind: 'battle', step: 0, age: 0 };
                G.tutorialCommons = MERGE_RULES.gradeCount; // 처음 소환 셋은 같은 등급
            }
            if (!this.tut) return;
        }
        const t = this.tut;
        if (t.kind === 'hq') {
            // 본부를 떠나거나 시설에 들어가면 그만둔다(본 것으로 친다)
            if (G.state !== 'hq' || this.hqView || this.collection) this.finishTutorial();
            return;
        }
        // 판이 끝났거나 판을 떠났으면 멈춘다(다음 판에서 처음부터)
        if (!G.inPlay()) {
            this.tut = null;
            G.holdPrep = false;
            return;
        }
        // 라운드 시작 전 단계에서는 준비 시간이 흐르지 않는다
        G.holdPrep = G.state === 'prep' && t.step <= TUTORIAL_BATTLE_STEPS.indexOf('start');
        // 조준을 취소하면 번개 버튼으로 돌아간다
        if (this.tutStep() === 'aim' && !this.targeting && G.skills.lightning <= 0) t.step = TUTORIAL_BATTLE_STEPS.indexOf('lightning');
        let guard = 0;
        while (this.tut && this.tutDone() && guard++ < 6) {
            t.step++;
            t.age = 0;
            if (t.step >= TUTORIAL_BATTLE_STEPS.length) this.finishTutorial();
        }
    },

    tutStep() {
        const t = this.tut;
        if (!t) return null;
        return t.kind === 'hq' ? 'hq' : TUTORIAL_BATTLE_STEPS[t.step];
    },

    // 첫 판 단계가 끝났는지. 할 수 없는 단계(골드가 모자라 합칠 수 없음 등)는 넘긴다
    tutDone() {
        const G = Game;
        switch (this.tutStep()) {
            case 'summon': return !!this.tutMergeable() || G.stats.merged > 0 || !G.canPaySummon() || G.fieldFull() || G.state !== 'prep';
            case 'merge': return G.stats.merged > 0 || !this.tutMergeable() || G.state !== 'prep';
            case 'start': return G.state !== 'prep' && G.heroes.some(h => !h.dead && !h.waiting);
            case 'lightning': return this.targeting || G.skills.lightning > 0;
            case 'aim': return G.skills.lightning > 0;
            case 'end': return this.tut.age > TUTORIAL_END_TIME;
        }
        return false;
    },

    // 합칠 수 있는 몬스터(m)와 끌 재료(src), 함께 쓰일 나머지 재료(extra)
    tutMergeable() {
        for (const m of Game.monsters) {
            const plan = Game.quickMergePlan(m);
            if (plan.kind !== 'none') return { m, src: plan.src, extra: (plan.extra || []).filter(e => e && e.x !== undefined) };
        }
        return null;
    },

    // 본 것으로 남기고 끝낸다(건너뛰기도 같다)
    finishTutorial() {
        const t = this.tut;
        this.tut = null;
        Game.holdPrep = false;
        Game.tutorialCommons = 0;
        if (!t) return;
        if (!Meta.data.tutorial) Meta.data.tutorial = { hq: false, battle: false };
        Meta.data.tutorial[t.kind] = true;
        Meta.save();
    },

    // 설정의 "튜토리얼 다시 보기": 본부 안내부터 다시
    replayTutorial() {
        Meta.data.tutorial = { hq: false, battle: false };
        Meta.save();
        this.tut = null;
        this.hqSettings = false;
        this.showToast('튜토리얼 다시 보기');
    },

    // 단계의 버튼만 받는다. 참이면 이 누르기를 버린다
    tutorialBlocks(b) {
        const t = this.tut;
        if (!t) return false;
        if (b && b.id === 'tut_skip') return false;
        if (t.kind === 'hq') {
            // 어디를 눌러도 다음 시설로
            t.step++;
            t.age = 0;
            if (t.step >= TUTORIAL_HQ_STEPS.length) this.finishTutorial();
            Sfx.play('click');
            return true;
        }
        const step = this.tutStep();
        if (step === 'end') {
            this.finishTutorial();
            return true;
        }
        if (!b) return !(step === 'merge' || step === 'aim'); // 맵 누르기는 합치기와 번개 조준에서만
        const allow = {
            summon: ['summon'],
            merge: id => id !== 'next' && id !== 'summon' && id !== 'summonUp',
            start: Game.state === 'prep' ? ['next'] : [],
            lightning: ['tab_demon', 'lightning'],
            aim: ['lightning']
        }[step];
        if (!allow) return true;
        return typeof allow === 'function' ? !allow(b.id) : !allow.includes(b.id);
    },

    // 단계의 키만 받는다. 참이면 이 키를 버린다
    tutorialBlocksKey(code) {
        const t = this.tut;
        if (!t) return false;
        if (t.kind === 'hq') {
            if (code === 'Escape') this.finishTutorial();
            else if (code === 'Space' || code === 'Enter') this.tutorialBlocks(null);
            return true;
        }
        const step = this.tutStep();
        if (step === 'end') {
            if (code === 'Space' || code === 'Enter' || code === 'Escape') this.finishTutorial();
            return true;
        }
        const keys = { summon: ['KeyS'], merge: ['KeyA'], start: Game.state === 'prep' ? ['Space'] : [], lightning: ['KeyQ', 'Tab'], aim: ['Escape'] }[step] || [];
        return !keys.includes(code);
    },

    // ----- 그리기 -----

    // 밝힐 네모들과 쪽지 글
    tutTargets() {
        const t = this.tut;
        const btn = id => this.buttons.find(b => b.id === id);
        const Z = WORLD_ZOOM;
        const cellRect = (x, y) => {
            const s = TILE * Z;
            return { x: x * Z - s * 0.65, y: y * Z - s * 1.05, w: s * 1.3, h: s * 1.4 };
        };
        if (t.kind === 'hq') {
            const s = TUTORIAL_HQ_STEPS[t.step];
            const f = HQ_FACILITIES.find(f => f.id === s.facility);
            return { rects: f ? [this.hqFacilityRect(f)] : [], text: s.text, count: `${t.step + 1}/${TUTORIAL_HQ_STEPS.length}`, sub: '누르기 · 다음' };
        }
        const G = Game;
        switch (this.tutStep()) {
            case 'summon': {
                const b = btn('summon');
                return { rects: b ? [b] : [], text: `소환 (S) · ${G.summonCost()}G`, sub: `같은 등급 ${MERGE_RULES.gradeCount}마리까지` };
            }
            case 'merge': {
                const pair = this.tutMergeable();
                const rects = pair ? [pair.src, pair.m, ...pair.extra].map(e => cellRect(e.x, e.y)) : []; // 끌 재료, 받는 몬스터, 함께 쓰일 재료
                return { rects, text: '끌어서 겹치기', sub: `같은 등급 ${MERGE_RULES.gradeCount} → 한 등급 위`, arrow: pair ? [pair.src, pair.m] : null };
            }
            case 'start': {
                const b = btn('next');
                return { rects: b ? [b] : [], text: '첫 라운드 시작', sub: 'Space' };
            }
            case 'lightning': {
                const b = btn(this.tab === 'demon' ? 'lightning' : 'tab_demon');
                return { rects: b ? [b] : [], text: this.tab === 'demon' ? '번개 (Q)' : '마왕 탭', sub: '용사가 몰릴 때' };
            }
            case 'aim': {
                const h = G.heroes.find(h => !h.dead && !h.waiting);
                const p = h && heroWorld(h);
                return { rects: p ? [cellRect(p.x, p.y)] : [], text: '용사 위 누르기', sub: '번개 · 둘레 피해' };
            }
            case 'end':
                return { rects: [], text: '준비 끝', sub: '소환 · 합치기 · 번개 되풀이' };
        }
        return { rects: [], text: '' };
    },

    drawTutorial(ctx) {
        const t = this.tut;
        if (!t) return;
        const T = UI_THEME;
        const info = this.tutTargets();
        const pad = TUTORIAL_PAD;
        const holes = info.rects.map(r => ({ x: Math.round(r.x - pad), y: Math.round(r.y - pad), w: Math.round(r.w + pad * 2), h: Math.round(r.h + pad * 2) }));
        const skip = this.buttons.find(b => b.id === 'tut_skip');
        if (skip) holes.push({ x: skip.x - 4, y: skip.y - 4, w: skip.w + 8, h: skip.h + 8 });
        // 1) 어둠: 구멍만 남기고 덮는다
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        for (const h of holes) ctx.rect(h.x + h.w, h.y, -h.w, h.h); // 거꾸로 돌아 구멍이 된다
        ctx.fillStyle = 'rgba(4,3,10,0.66)';
        ctx.fill('nonzero');
        ctx.restore();
        // 2) 구멍 테두리: 금색 도트 테가 두 박자로 깜박인다
        const blink = Math.floor(t.age * 2.5) % 2 === 0;
        holes.slice(0, info.rects.length).forEach(h => this.drawTutFrame(ctx, h, blink ? T.goldLight : T.goldLine));
        // 3) 화살표: 첫 구멍 위(위에 자리가 없으면 아래)에서 위아래로 통통 튄다
        const bob = Math.floor(t.age * 4) % 2 * 6;
        let note = null;
        if (info.rects.length > 1) {
            // 여럿(합치기 재료와 받는 몬스터): 쪽지를 묶음 옆에 둔다(가리지 않게)
            const hs = holes.slice(0, info.rects.length);
            const right = Math.max(...hs.map(h => h.x + h.w));
            const left = Math.min(...hs.map(h => h.x));
            const mid = (Math.min(...hs.map(h => h.y)) + Math.max(...hs.map(h => h.y + h.h))) / 2;
            note = { cx: right + 40 + 260 <= GAME_WIDTH - 16 ? right + 40 + 260 : left - 40 - 260, y: mid - 46 };
        } else if (holes.length && info.rects.length) {
            const h = holes[0];
            const up = h.y > 220;
            const ax = h.x + h.w / 2;
            const ay = up ? h.y - 16 - bob : h.y + h.h + 16 + bob;
            this.drawTutArrow(ctx, ax, ay, up);
            note = { cx: ax, y: up ? ay - 70 - 92 : ay + 70 };
        }
        // 합치기: 재료에서 받는 몬스터로 점선
        if (info.arrow) {
            const [a, b] = info.arrow;
            const Z = WORLD_ZOOM;
            const n = 10;
            for (let i = 1; i < n; i++) {
                if ((i + Math.floor(t.age * 6)) % 2) continue;
                const x = a.x * Z + (b.x - a.x) * Z * i / n;
                const y = (a.y - TILE * 0.35) * Z + (b.y - a.y) * Z * i / n;
                ctx.fillStyle = T.goldLight;
                ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
            }
        }
        // 4) 쪽지: 큰 글 한 줄과 작은 글 한 줄
        const w = 520;
        const h = 92;
        let x = note ? note.cx - w / 2 : GAME_WIDTH / 2 - w / 2;
        let y = note ? note.y : GAME_HEIGHT / 2 - h / 2;
        x = clamp(Math.round(x), 16, GAME_WIDTH - w - 16);
        y = clamp(Math.round(y), 90, GAME_HEIGHT - h - 16);
        ctx.fillStyle = '#120a18';
        ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
        ctx.fillStyle = T.navy;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(x, y, w, 4);
        ctx.fillRect(x, y + h - 4, w, 4);
        UIKit.text(ctx, info.text, x + w / 2, y + 36, 30, T.cream, 'center', 'bold');
        if (info.sub) UIKit.text(ctx, info.sub, x + w / 2, y + 70, 21, T.creamSoft, 'center');
        if (info.count) UIKit.text(ctx, info.count, x + w - 16, y + 24, 18, T.gold, 'right', 'bold');
    },

    // 두께 4px 도트 테(모서리는 한 칸 깎는다)
    drawTutFrame(ctx, r, color) {
        const P = 4;
        ctx.fillStyle = '#120a18';
        ctx.fillRect(r.x - P * 2, r.y - P, r.w + P * 4, P);
        ctx.fillStyle = color;
        ctx.fillRect(r.x, r.y - P * 2, r.w, P);
        ctx.fillRect(r.x, r.y + r.h + P, r.w, P);
        ctx.fillRect(r.x - P * 2, r.y, P, r.h);
        ctx.fillRect(r.x + r.w + P, r.y, P, r.h);
        ctx.fillRect(r.x - P, r.y - P, P, P);
        ctx.fillRect(r.x + r.w, r.y - P, P, P);
        ctx.fillRect(r.x - P, r.y + r.h, P, P);
        ctx.fillRect(r.x + r.w, r.y + r.h, P, P);
    },

    // 도트 화살표: down이면 아래를 가리킨다(끝이 (x, y))
    drawTutArrow(ctx, x, y, down) {
        const P = 6;
        const dir = down ? -1 : 1; // 끝에서 몸통 쪽으로
        const rows = [[0, 1], [-1, 3], [-2, 5], [-3, 7], [-1, 3], [-1, 3], [-1, 3]];
        rows.forEach(([off, n], i) => {
            const yy = y + dir * i * P - (down ? P : 0);
            ctx.fillStyle = '#120a18';
            ctx.fillRect(Math.round(x + off * P - P / 2 - 3), yy - 3, n * P + 6, P + 6);
        });
        rows.forEach(([off, n], i) => {
            const yy = y + dir * i * P - (down ? P : 0);
            ctx.fillStyle = i === 0 ? '#fff6dc' : UI_THEME.gold;
            ctx.fillRect(Math.round(x + off * P - P / 2), yy, n * P, P);
        });
    }
});
