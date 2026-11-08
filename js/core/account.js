// 계정과 서버 저장. 손님은 이 기기에만, 로그인하면 서버(Supabase)에 기록을 올린다.
// SERVER_CONFIG(js/core/server_config.js)가 비어 있으면 "테스트 서버": 계정과 저장이 이 브라우저 안에만 있다(실제 서버 연결 전 흐름 확인용).
// 아이디 로그인은 아이디를 가짜 이메일(아이디@ACCOUNT_EMAIL_DOMAIN)로 바꿔 Supabase 이메일 로그인에 넣는다. 공개 키만 쓴다.
const ACCOUNT_ID_RE = /^[a-zA-Z0-9_]{4,16}$/;
const ACCOUNT_NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
const ACCOUNT_PW_MIN = 6;
const ACCOUNT_EMAIL_DOMAIN = 'id.dungeonguard.game';
const ACCOUNT_MOCK_KEY = 'dungeonGuard.testServer'; // 테스트 서버의 계정과 저장
const ACCOUNT_UPLOAD_DELAY = 2; // 저장하고 이만큼(초) 뒤에 한 번에 올린다
const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const ACCOUNT_ERRORS = {
    invalidId: '아이디: 영문·숫자·_ 4~16자',
    weakPassword: `비밀번호: ${ACCOUNT_PW_MIN}자 이상`,
    invalidNick: '닉네임: 한글·영문·숫자 2~12자',
    idTaken: '이미 쓰는 아이디',
    noUser: '가입하지 않은 아이디',
    wrongPassword: '아이디 또는 비밀번호가 틀림',
    nameTaken: '이미 쓰는 닉네임',
    googleOff: 'Google 로그인 · 서버 연결 뒤',
    confirm: '서버 설정 확인: 이메일 확인 끄기',
    rateLimited: '요청이 많음 · 잠시 뒤 다시',
    network: '서버에 연결할 수 없음',
    server: '서버 오류 · 잠시 뒤 다시'
};

function accountError(code) {
    const e = new Error(code);
    e.code = code;
    return e;
}

// 테스트 서버 비밀번호 보관용 해시(실제 보안이 아니라 평문을 남기지 않으려는 것)
function accountHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h.toString(16);
}

// ----- 테스트 서버: localStorage 한 칸 -----
const MockServer = {
    kind: 'test',
    read() {
        try {
            const d = JSON.parse(localStorage.getItem(ACCOUNT_MOCK_KEY) || 'null');
            if (d && d.users) return d;
        } catch (e) { /* 처음 상태 */ }
        return { users: {}, session: null };
    },
    write(d) {
        try {
            localStorage.setItem(ACCOUNT_MOCK_KEY, JSON.stringify(d));
        } catch (e) { /* 저장을 못 하면 이번 창에서만 */ }
    },
    userOf(key, u) { return { id: 'test-' + key, key, name: u.nickname, login: u.login, provider: 'id' }; },
    async session() {
        const d = this.read();
        const u = d.session && d.users[d.session];
        return u ? this.userOf(d.session, u) : null;
    },
    async signUp(id, pw) {
        const d = this.read();
        const key = id.toLowerCase();
        if (d.users[key]) throw accountError('idTaken');
        if (Object.values(d.users).some(u => u.nickname.toLowerCase() === key)) throw accountError('nameTaken');
        d.users[key] = { login: id, pw: accountHash(key + ':' + pw), nickname: id, save: null };
        d.session = key;
        this.write(d);
        return this.userOf(key, d.users[key]);
    },
    async signIn(id, pw) {
        const d = this.read();
        const key = id.toLowerCase();
        const u = d.users[key];
        if (!u) throw accountError('noUser');
        if (u.pw !== accountHash(key + ':' + pw)) throw accountError('wrongPassword');
        d.session = key;
        this.write(d);
        return this.userOf(key, u);
    },
    async signInGoogle() { throw accountError('googleOff'); },
    async signOut() {
        const d = this.read();
        d.session = null;
        this.write(d);
    },
    async loadSave(user) {
        const u = this.read().users[user.key];
        return u && u.save ? u.save : null;
    },
    async writeSave(user, data) {
        const d = this.read();
        if (!d.users[user.key]) throw accountError('server');
        d.users[user.key].save = JSON.parse(JSON.stringify(data));
        this.write(d);
    },
    async setNickname(user, name) {
        const d = this.read();
        const taken = Object.entries(d.users).some(([k, u]) => k !== user.key && u.nickname.toLowerCase() === name.toLowerCase());
        if (taken) throw accountError('nameTaken');
        d.users[user.key].nickname = name;
        this.write(d);
    }
};

// ----- 실제 서버: Supabase(표와 보안 규칙은 docs/SUPABASE.md) -----
const SupabaseServer = {
    kind: 'supabase',
    client: null,
    loading: null,
    async ready() {
        if (this.client) return this.client;
        if (!this.loading) {
            this.loading = new Promise((resolve, reject) => {
                if (typeof supabase !== 'undefined') return resolve();
                const s = document.createElement('script');
                s.src = SUPABASE_JS_URL;
                s.onload = () => resolve();
                s.onerror = () => reject(accountError('network'));
                document.head.appendChild(s);
            });
        }
        await this.loading;
        this.client = supabase.createClient(SERVER_CONFIG.url, SERVER_CONFIG.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
        return this.client;
    },
    fail(error) {
        if (!error) return accountError('server');
        const msg = String(error.message || '');
        if (error.status === 429) return accountError('rateLimited');
        if (/Invalid login credentials/i.test(msg)) return accountError('wrongPassword');
        if (/already registered|already exists/i.test(msg)) return accountError('idTaken');
        if (error.code === '23505') return accountError('nameTaken');
        if (/fetch|network/i.test(msg)) return accountError('network');
        return accountError('server');
    },
    async userOf(u) {
        const c = await this.ready();
        const { data } = await c.from('profiles').select('nickname').eq('user_id', u.id).maybeSingle();
        const login = (u.email || '').endsWith('@' + ACCOUNT_EMAIL_DOMAIN) ? u.email.split('@')[0] : '';
        const google = u.app_metadata && u.app_metadata.provider === 'google';
        return { id: u.id, key: u.id, name: data ? data.nickname : (login || '모험가'), login, provider: google ? 'google' : 'id', noProfile: !data };
    },
    async session() {
        const c = await this.ready();
        const { data } = await c.auth.getSession();
        return data.session ? this.userOf(data.session.user) : null;
    },
    async signUp(id, pw) {
        const c = await this.ready();
        const { data, error } = await c.auth.signUp({ email: `${id.toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`, password: pw });
        if (error) throw this.fail(error);
        if (!data.session) throw accountError('confirm');
        const { error: nickErr } = await c.from('profiles').insert({ user_id: data.user.id, nickname: id });
        if (nickErr && nickErr.code !== '23505') throw this.fail(nickErr);
        return this.userOf(data.user);
    },
    async signIn(id, pw) {
        const c = await this.ready();
        const { data, error } = await c.auth.signInWithPassword({ email: `${id.toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`, password: pw });
        if (error) throw this.fail(error);
        return this.userOf(data.user);
    },
    // Google: 구글 화면으로 갔다가 돌아오면 session()이 이어받는다
    async signInGoogle() {
        const c = await this.ready();
        const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } });
        if (error) throw this.fail(error);
        return null;
    },
    async signOut() {
        const c = await this.ready();
        await c.auth.signOut();
    },
    async loadSave(user) {
        const c = await this.ready();
        const { data, error } = await c.from('saves').select('data').eq('user_id', user.id).maybeSingle();
        if (error) throw this.fail(error);
        return data ? data.data : null;
    },
    async writeSave(user, d) {
        const c = await this.ready();
        const { error } = await c.from('saves').upsert({ user_id: user.id, data: d, updated_at: new Date().toISOString() });
        if (error) throw this.fail(error);
    },
    async setNickname(user, name) {
        const c = await this.ready();
        const { error } = await c.from('profiles').upsert({ user_id: user.id, nickname: name });
        if (error) throw this.fail(error);
    }
};

// ----- 계정 상태와 저장 맞추기 -----
const Account = {
    server: null,
    status: 'guest', // guest | checking | user
    user: null,
    busy: false,
    error: '',
    choice: null, // 로그인 직후 고를 것: { kind: 'migrate' | 'conflict', local, server }
    sync: 'idle', // idle | waiting | saving | saved | error
    uploadIn: 0, // 남은 올리기 대기(초)

    testServer() { return typeof SERVER_CONFIG === 'undefined' || !SERVER_CONFIG.url || !SERVER_CONFIG.anonKey; },
    guestKey() { return META_KEY; },
    userKey(user) { return `${META_KEY}@${user.key}`; },

    // 시작할 때: 남은 로그인이 있으면 이어받는다(그 계정의 이 기기 기록과 서버 기록 중 새 것)
    init() {
        this.server = this.testServer() ? MockServer : SupabaseServer;
        Meta.onSave = () => this.onMetaSave();
        this.status = 'checking';
        return this.server.session().then(u => {
            if (u) return this.enter(u, true);
            this.status = 'guest';
        }).catch(() => { this.status = 'guest'; });
    },

    // 버튼 하나의 작업: 바쁜 표시, 오류 글
    async run(job) {
        if (this.busy) return false;
        this.busy = true;
        this.error = '';
        try {
            await job();
            return true;
        } catch (e) {
            this.error = ACCOUNT_ERRORS[e && e.code] || ACCOUNT_ERRORS.server;
            return false;
        } finally {
            this.busy = false;
        }
    },

    checkId(id, pw) {
        if (!ACCOUNT_ID_RE.test(id || '')) throw accountError('invalidId');
        if ((pw || '').length < ACCOUNT_PW_MIN) throw accountError('weakPassword');
    },

    signIn(id, pw) { return this.run(async () => { this.checkId(id, pw); await this.enter(await this.server.signIn(id, pw), false); }); },
    signUp(id, pw) { return this.run(async () => { this.checkId(id, pw); await this.enter(await this.server.signUp(id, pw), false); }); },
    signInGoogle() { return this.run(async () => { const u = await this.server.signInGoogle(); if (u) await this.enter(u, false); }); },

    signOut() {
        return this.run(async () => {
            await this.flush();
            await this.server.signOut();
            this.user = null;
            this.status = 'guest';
            this.choice = null;
            this.sync = 'idle';
            Meta.key = this.guestKey();
            Meta.load();
        });
    },

    setNickname(name) {
        return this.run(async () => {
            if (!ACCOUNT_NICK_RE.test(name || '')) throw accountError('invalidNick');
            await this.server.setNickname(this.user, name);
            this.user.name = name;
        });
    },

    // 로그인한 뒤: 어느 기록을 쓸지 정한다
    //   이어받기(resumed): 그 계정의 이 기기 기록과 서버 기록 중 새 것(묻지 않는다)
    //   새 로그인: 서버 기록이 없고 손님 기록이 있으면 옮길지, 둘 다 있고 다르면 어느 쪽을 쓸지 묻는다
    async enter(user, resumed) {
        this.user = user;
        this.status = 'user';
        const remoteRaw = await this.server.loadSave(user);
        const remote = remoteRaw ? Meta.sanitize(remoteRaw) : null;
        if (resumed) {
            const cache = Meta.peek(this.userKey(user));
            const pick = !remote || (cache && cache.savedAt > remote.savedAt) ? cache : remote;
            this.use(pick || Meta.fresh(), !remote || pick === cache);
            return;
        }
        const guest = Meta.peek(this.guestKey());
        const guestHas = Meta.hasProgress(guest);
        if (!remote && guestHas) this.choice = { kind: 'migrate', local: guest, server: null };
        else if (remote && guestHas && JSON.stringify(Meta.sanitize(Object.assign({}, guest, { savedAt: 0 }))) !== JSON.stringify(Meta.sanitize(Object.assign({}, remote, { savedAt: 0 })))) {
            this.choice = { kind: 'conflict', local: guest, server: remote };
        } else this.use(remote || Meta.fresh(), !remote);
    },

    // 고르기 창의 답: 'local'(이 기기 것, 옮기기) | 'server'(서버 것, 새로 시작)
    pick(which) {
        const c = this.choice;
        if (!c) return;
        this.choice = null;
        if (c.kind === 'migrate') {
            if (which === 'local') {
                this.use(c.local, true);
                // 옮긴 손님 기록은 비운다(다른 계정에서 또 묻지 않게)
                try { localStorage.removeItem(this.guestKey()); } catch (e) { /* 그대로 둔다 */ }
            } else this.use(Meta.fresh(), true);
        } else {
            this.use(which === 'local' ? c.local : c.server, which === 'local');
        }
    },

    // 이 기록으로 계정 칸을 채운다. upload면 서버에도 바로 올린다
    use(data, upload) {
        Meta.key = this.userKey(this.user);
        Meta.data = Meta.sanitize(JSON.parse(JSON.stringify(data)));
        const onSave = Meta.onSave;
        Meta.onSave = null;
        Meta.save(); // 이 기기 칸에 남긴다(올리기는 아래에서)
        Meta.onSave = onSave;
        if (upload) this.flush();
        else this.sync = 'saved';
    },

    onMetaSave() {
        if (this.status !== 'user' || this.choice) return;
        this.sync = 'waiting';
        this.uploadIn = ACCOUNT_UPLOAD_DELAY;
    },

    // 매 프레임(js/main.js): 올리기 대기가 끝나면 올린다
    tick(dt) {
        if (this.sync !== 'waiting') return;
        this.uploadIn -= dt;
        if (this.uploadIn <= 0) this.flush();
    },

    async flush() {
        if (this.status !== 'user' || !this.user) return;
        this.sync = 'saving';
        try {
            await this.server.writeSave(this.user, Meta.data);
            if (this.sync === 'saving') this.sync = 'saved';
        } catch (e) {
            this.sync = 'error';
        }
    },

    // 고르기 창의 한 줄 요약
    summary(d) {
        if (!d) return ['기록 없음'];
        const abyss = Math.max(0, ...Object.values(d.abyss.levels || {}).map(v => v.floor || 0));
        const lines = [`스토리 ${d.cleared.length} / ${STAGES.length}`, `판 ${d.runs} · 도감 ${d.seen.length}`];
        if (abyss) lines.push(`심연 최고 ${abyss}층`);
        if (d.savedAt) {
            const t = new Date(d.savedAt);
            lines.push(`저장 ${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
        }
        return lines;
    },

    label() {
        if (this.status === 'checking') return '계정: 확인 중';
        if (this.status === 'user') return `계정: ${this.user.name}`;
        return '계정: 손님';
    }
};
