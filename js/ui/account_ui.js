// 계정 창(타이틀): 로그인·가입, 내 계정(닉네임, 로그아웃), 로그인 직후 기록 고르기(옮기기 또는 이 기기·서버)
// 글 입력은 캔버스 위에 띄운 HTML 입력 칸이다(창이 닫히면 숨긴다)
const ACCOUNT_PANEL = { w: 680, h: 640 };
const ACCOUNT_FIELD = { w: 520, h: 64 };

// 캔버스 위 입력 칸: 게임 좌표 네모에 맞춰 놓는다
const AccountInputs = {
    els: {},
    get(name, type, placeholder) {
        if (typeof document === 'undefined') return null;
        let el = this.els[name];
        if (!el) {
            el = document.createElement('input');
            el.type = type;
            el.placeholder = placeholder;
            el.autocomplete = type === 'password' ? 'current-password' : 'off';
            el.spellcheck = false;
            el.maxLength = type === 'password' ? 64 : 16;
            Object.assign(el.style, {
                position: 'fixed', zIndex: 5, boxSizing: 'border-box', padding: '0 0.6em', border: '3px solid #e2ad45',
                background: '#070d1d', color: '#ffffff', fontFamily: UI_FONT, outline: 'none', borderRadius: '0', display: 'none'
            });
            document.body.appendChild(el);
            this.els[name] = el;
        }
        return el;
    },
    // 이번 프레임에 보일 칸: { name: { type, placeholder, x, y, w, h } }
    show(list) {
        if (typeof document === 'undefined') return;
        const canvas = document.getElementById('game');
        const r = canvas.getBoundingClientRect();
        const k = r.width / GAME_WIDTH;
        for (const [name, f] of Object.entries(list)) {
            const el = this.get(name, f.type, f.placeholder);
            el.style.display = 'block';
            el.style.left = `${r.left + f.x * k}px`;
            el.style.top = `${r.top + f.y * k}px`;
            el.style.width = `${f.w * k}px`;
            el.style.height = `${f.h * k}px`;
            el.style.fontSize = `${26 * k}px`;
        }
        for (const [name, el] of Object.entries(this.els)) {
            if (!list[name] && el.style.display !== 'none') {
                el.style.display = 'none';
                el.blur();
            }
        }
    },
    value(name) { return this.els[name] ? this.els[name].value.trim() : ''; },
    set(name, v) { if (this.els[name]) this.els[name].value = v; },
    focused() { return typeof document !== 'undefined' && document.activeElement && document.activeElement.tagName === 'INPUT'; }
};

Object.assign(UI, {
    accountView: null, // null | 'signIn' | 'signUp' | 'me'
    accountForm: { id: '', pw: '', nick: '' }, // 입력 칸이 없는 곳(자동 시험)에서 쓰는 값

    openAccount() {
        Account.error = '';
        this.accountView = Account.status === 'user' ? 'me' : 'signIn';
        this.nickFilled = false;
    },

    closeAccount() {
        this.accountView = null;
        Account.error = '';
        AccountInputs.show({});
    },

    accountOpen() { return !!(this.accountView || Account.choice); },

    field(name) { return AccountInputs.value(name) || this.accountForm[name] || ''; },

    async submitAccount() {
        const v = this.accountView;
        if (v === 'signIn' || v === 'signUp') {
            const ok = await (v === 'signIn' ? Account.signIn(this.field('id'), this.field('pw')) : Account.signUp(this.field('id'), this.field('pw')));
            if (ok) {
                AccountInputs.set('pw', '');
                this.accountForm.pw = '';
                if (!Account.choice) this.closeAccount();
                else this.accountView = null;
                if (Account.status === 'user' && !Account.choice) this.showToast(`${Account.user.name} · 로그인`);
            }
        } else if (v === 'me') {
            if (await Account.setNickname(this.field('nick'))) this.showToast('닉네임 바꿈');
        }
    },

    panelRect() {
        const P = ACCOUNT_PANEL;
        return { x: GAME_WIDTH / 2 - P.w / 2, y: GAME_HEIGHT / 2 - P.h / 2, w: P.w, h: P.h };
    },

    fieldRect(i) {
        const R = this.panelRect();
        return { x: GAME_WIDTH / 2 - ACCOUNT_FIELD.w / 2, y: R.y + 170 + i * 92, w: ACCOUNT_FIELD.w, h: ACCOUNT_FIELD.h };
    },

    layoutAccount() {
        const R = this.panelRect();
        const cx = GAME_WIDTH / 2;
        const busy = Account.busy;
        if (Account.choice) {
            AccountInputs.show({});
            const c = Account.choice;
            const migrate = c.kind === 'migrate';
            this.button('acc_local', cx - 300, R.y + R.h - 120, 290, 84, { label: migrate ? '계정으로 옮기기' : '이 기기 것 쓰기', theme: 'gold', size: 26, disabled: busy, onClick: () => Account.pick('local') });
            this.button('acc_server', cx + 10, R.y + R.h - 120, 290, 84, { label: migrate ? '새로 시작' : '서버 것 쓰기', size: 26, disabled: busy, onClick: () => Account.pick('server') });
            return;
        }
        const v = this.accountView;
        if (v === 'signIn' || v === 'signUp') {
            const a = this.fieldRect(0);
            const b = this.fieldRect(1);
            AccountInputs.show({
                id: Object.assign({ type: 'text', placeholder: '아이디 · 영문·숫자·_ 4~16자' }, a),
                pw: Object.assign({ type: 'password', placeholder: `비밀번호 · ${ACCOUNT_PW_MIN}자 이상` }, b)
            });
            this.button('acc_tab_in', cx - 262, R.y + 86, 258, 60, { label: '로그인', size: 24, theme: v === 'signIn' ? 'gold' : undefined, onClick: () => { this.accountView = 'signIn'; Account.error = ''; } });
            this.button('acc_tab_up', cx + 4, R.y + 86, 258, 60, { label: '회원가입', size: 24, theme: v === 'signUp' ? 'gold' : undefined, onClick: () => { this.accountView = 'signUp'; Account.error = ''; } });
            this.button('acc_submit', cx - 260, R.y + 372, 520, 76, { label: busy ? '서버와 통신 중' : v === 'signIn' ? '로그인' : '가입하고 시작', theme: 'gold', size: 28, disabled: busy, onClick: () => this.submitAccount() });
            this.button('acc_google', cx - 260, R.y + 460, 254, 64, { label: 'Google', size: 24, disabled: busy || Account.testServer(), onClick: () => Account.signInGoogle() });
            this.button('acc_guest', cx + 6, R.y + 460, 254, 64, { label: '손님으로 계속', size: 24, disabled: busy, onClick: () => this.closeAccount() });
            return;
        }
        if (v === 'me') {
            const f = this.fieldRect(1);
            AccountInputs.show({ nick: Object.assign({ type: 'text', placeholder: '닉네임' }, f, { w: 360 }) });
            if (!this.nickFilled) { // 창을 열 때 한 번 지금 닉네임으로 채운다
                AccountInputs.set('nick', Account.user.name);
                this.accountForm.nick = Account.user.name;
                this.nickFilled = true;
            }
            this.button('acc_nick', f.x + 372, f.y, 148, 64, { label: '바꾸기', size: 24, disabled: busy, onClick: () => this.submitAccount() });
            this.button('acc_signout', cx - 260, R.y + 400, 254, 72, { label: '로그아웃', size: 26, theme: 'danger', disabled: busy, onClick: () => this.signOutAccount() });
            this.button('acc_close', cx + 6, R.y + 400, 254, 72, { label: '닫기', icon: 'close', size: 26, onClick: () => this.closeAccount() });
        }
    },

    async signOutAccount() {
        if (await Account.signOut()) {
            this.closeAccount();
            this.loadout = null;
            this.showToast('로그아웃 · 손님 기록');
        }
    },

    onAccountKey(code) {
        if (Account.choice) return;
        if (code === 'Escape') this.closeAccount();
        else if (code === 'Enter') this.submitAccount();
    },

    drawAccount(ctx) {
        const T = UI_THEME;
        const R = this.panelRect();
        const cx = GAME_WIDTH / 2;
        ctx.fillStyle = T.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        UIKit.panel(ctx, R.x, R.y, R.w, R.h);
        const c = Account.choice;
        if (c) {
            UIKit.text(ctx, c.kind === 'migrate' ? '손님 기록 옮기기' : '저장 고르기', cx, R.y + 64, 40, T.gold, 'center', 'bold');
            UIKit.text(ctx, c.kind === 'migrate' ? '이 기기의 손님 기록 → 이 계정' : '이 기기와 서버의 기록이 다름', cx, R.y + 112, 22, T.creamSoft, 'center');
            const cards = c.kind === 'migrate' ? [['손님 기록', c.local], ['새 계정', null]] : [['이 기기', c.local], ['서버', c.server]];
            cards.forEach(([title, d], i) => {
                const x = cx - 300 + i * 310;
                const y = R.y + 150;
                ctx.fillStyle = T.navyDark;
                ctx.fillRect(x, y, 290, 300);
                ctx.fillStyle = i === 0 ? T.goldLine : T.silverDark;
                ctx.fillRect(x, y, 290, 4);
                UIKit.text(ctx, title, x + 145, y + 40, 28, i === 0 ? T.gold : T.cream, 'center', 'bold');
                const lines = d ? Account.summary(d) : ['빈 기록에서'];
                lines.forEach((l, j) => UIKit.text(ctx, l, x + 145, y + 96 + j * 44, 22, T.cream, 'center'));
            });
            return;
        }
        const v = this.accountView;
        if (v === 'signIn' || v === 'signUp') {
            UIKit.text(ctx, '계정', cx, R.y + 52, 38, T.gold, 'center', 'bold');
            [0, 1].forEach(i => {
                const f = this.fieldRect(i);
                if (typeof document === 'undefined') { // 입력 칸이 없는 곳에서는 테두리만
                    ctx.fillStyle = T.navyDark;
                    ctx.fillRect(f.x, f.y, f.w, f.h);
                }
            });
        } else if (v === 'me') {
            const u = Account.user;
            UIKit.text(ctx, u.name, cx, R.y + 64, 40, T.gold, 'center', 'bold');
            UIKit.text(ctx, u.provider === 'google' ? 'Google 계정' : `아이디 ${u.login || ''}`, cx, R.y + 108, 22, T.creamSoft, 'center');
            const sync = { idle: '', waiting: '서버 저장 · 곧', saving: '서버 저장 중', saved: '서버 저장 · 끝', error: '서버 저장 실패 · 다시 시도' }[Account.sync];
            UIKit.text(ctx, sync, cx, R.y + 150, 22, Account.sync === 'error' ? T.bad : T.good, 'center');
            const f = this.fieldRect(1);
            UIKit.text(ctx, '닉네임 · 랭킹 이름', f.x, f.y - 14, 20, T.creamSoft, 'left');
        }
        if (Account.error) UIKit.text(ctx, Account.error, cx, R.y + R.h - 64, 22, T.bad, 'center', 'bold');
        if (Account.testServer()) UIKit.text(ctx, '테스트 서버 · 계정과 저장이 이 브라우저 안에만', cx, R.y + R.h - 28, 18, T.inkFaint, 'center');
    }
});
