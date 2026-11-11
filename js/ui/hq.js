// 본부(마왕의 방): 타이틀 다음 화면. 정면에서 본 방에 시설을 놓고, 시설을 눌러(숫자 키 1~6, 터치) 들어간다.
// 방 구성은 HQ_ROOM, 시설은 HQ_FACILITIES, 도전의 문 콘텐츠는 HQ_CONTENTS, 고블린 비서 대사는 HQ_GOBLIN_LINES 표만 읽는다.
// 그림은 assets/sprites/hq_<이름>.png(64px)와 tileset_hq.png(32px Wang 타일. 그림에서는 upper가 나무 바닥, lower가 붉은 카펫).
// 게임 규칙(전투, 해금, 저장)은 건드리지 않는다. 시설의 느낌표(새로 볼 것)는 본 값만 localStorage(HQ_SEEN_KEY)에 따로 둔다.

// 본부 바닥 타일셋(tileset_hq)의 Wang 타일. 열쇠는 꼭짓점 NW, NE, SW, SE가 upper(나무 바닥)면 1, lower(붉은 카펫)면 0.
// 값은 타일셋 안의 bounding_box [x, y, 너비, 높이](32px)다
const WANG_TILES = {
    '1101': [0, 0, 32, 32], '1010': [32, 0, 32, 32], '0100': [64, 0, 32, 32], '1100': [96, 0, 32, 32],
    '0110': [0, 32, 32, 32], '1000': [32, 32, 32, 32], '0000': [64, 32, 32, 32], '0001': [96, 32, 32, 32],
    '1011': [0, 64, 32, 32], '0011': [32, 64, 32, 32], '0010': [64, 64, 32, 32], '0101': [96, 64, 32, 32],
    '1111': [0, 96, 32, 32], '1110': [32, 96, 32, 32], '1001': [64, 96, 32, 32], '0111': [96, 96, 32, 32]
};

const HQ_SEEN_KEY = 'dungeonGuard.hqSeen'; // 시설마다 마지막으로 들어갔을 때 본 "새 소식" 값
const HQ_TILE = 64; // 바닥 타일(32px)을 2배로
const HQ_WALL_H = 192; // 위쪽 벽 세 줄(타일 64px x 3)
const HQ_PLATE_H = 46; // 시설 이름표 높이
const HQ_HOVER_GROW = 1.06; // 마우스를 올린 시설은 이만큼 커진다

// 방 구성. 좌표는 화면 px(그림 네모의 왼쪽 위). scale은 그림 배율(물건 2배, 시설 3~4배)
//   wall: 위쪽 벽(왼쪽부터, 3배로 이어 붙인다), wallColor: 벽 그림 사이 빈 곳의 벽돌 색
//   carpet: 붉은 카펫(타일 꼭짓점 좌표 [x0, y0, x1, y1], 끝 포함). 꼭짓점 (cx, cy)는 화면 (cx * 64, 192 + cy * 64)
//   throne: 왕좌, lord: 지금 고른 마왕이 서는 자리(발끝 화면 좌표, 2배)
//   decor: 장식. unlockStage가 있으면 그 스테이지를 깬 뒤에 놓인다(해금이 늘면 방이 꾸며진다)
const HQ_ROOM = {
    wall: ['hq_wall_banner', 'hq_window', 'hq_wall_banner', 'hq_window', 'hq_wall_banner', 'hq_wall_banner', 'hq_window', 'hq_wall_banner', 'hq_window', 'hq_wall_banner'],
    wallColor: '#3a2620',
    carpet: [[13, 0, 17, 15], [11, 0, 19, 3], [4, 9, 26, 10]],
    throne: { sprite: 'hq_throne', x: 770, y: 176, scale: 3 },
    lord: { x: 1030, foot: 384 },
    decor: [
        { sprite: 'hq_notice_board', x: 1640, y: 84, scale: 2 },
        { sprite: 'hq_plant', x: 636, y: 214, scale: 2 },
        { sprite: 'hq_crates', x: 70, y: 880, scale: 2 },
        { sprite: 'hq_tea_table', x: 560, y: 880, scale: 2 },
        { sprite: 'hq_fireplace', x: 150, y: 100, scale: 2, unlockStage: 2 },
        { sprite: 'hq_dummy', x: 1720, y: 480, scale: 2, unlockStage: 4 },
        { sprite: 'hq_vault', x: 90, y: 590, scale: 2, unlockStage: 6 },
        // 2026-11-11 품질: 빈 바닥을 채우는 소품(맵 소품 그림)과 빛을 내는 화로
        { sprite: 'prop2_brazier', x: 676, y: 548, scale: 2, light: '255,150,60' },
        { sprite: 'prop2_brazier', x: 1116, y: 548, scale: 2, light: '255,150,60' },
        { sprite: 'prop2_brazier', x: 676, y: 196, scale: 2, light: '255,150,60' },
        { sprite: 'prop2_brazier', x: 1200, y: 196, scale: 2, light: '255,150,60' },
        { sprite: 'prop2_pillar', x: 20, y: 250, scale: 2 },
        { sprite: 'prop2_pillar', x: 1772, y: 250, scale: 2 },
        { sprite: 'prop2_obelisk', x: 150, y: 400, scale: 2, light: '170,110,255' },
        { sprite: 'prop2_chest', x: 1210, y: 880, scale: 2 },
        { sprite: 'prop2_cauldron', x: 1730, y: 860, scale: 2, light: '120,255,140' },
        { sprite: 'prop2_bones', x: 820, y: 900, scale: 2 },
        { sprite: 'prop2_mushrooms', x: 330, y: 930, scale: 2 },
        { sprite: 'prop2_crystal', x: 1760, y: 560, scale: 2, light: '120,220,255' }
    ]
};

// 시설: 누르면 들어간다. 숫자 키는 표 순서(1부터).
//   action: UI의 여는 함수 이름(스토리 지도, 도감) 또는 view: 본부 안 화면(hq.js가 그린다)
//   news: 새로 볼 것이 있으면 그 값(문자열), 없으면 null. 들어갈 때 본 값과 다르면 붉은 느낌표
// 설정 창: 위쪽 끝과 음량 줄(Sfx.volume 열쇠, 이름)
const HQ_SETTINGS_Y = 150;
const HQ_VOLUME_ROWS = [['master', '전체'], ['sfx', '효과음'], ['bgm', '배경음악']];

const HQ_FACILITIES = [
    { id: 'wartable', sprite: 'hq_wartable', name: '작전 테이블', desc: '스토리 지도 · 다음 스테이지 출전', x: 330, y: 470, scale: 3, action: 'openStoryMap',
        news: () => { const st = hqNextStage(); return st ? st.id : null; } },
    { id: 'bookshelf', sprite: 'hq_bookshelf', name: '서재', desc: '도감 · 본 몬스터와 조합식', x: 400, y: 140, scale: 3, action: 'openCollection',
        news: () => (Meta.data.seen.length + Meta.data.recipes.length ? `${Meta.data.seen.length}/${Meta.data.recipes.length}` : null) },
    { id: 'relic_case', sprite: 'hq_relic_case', name: '보물 진열장', desc: '마왕과 유물 목록 · 효과와 해금', x: 1330, y: 140, scale: 3, view: 'relics',
        news: () => { const n = Meta.unlocked().filter(u => u.kind !== 'ending').length; return n ? String(n) : null; } },
    { id: 'weapon_rack', sprite: 'hq_weapon_rack', name: '무기고', desc: '장비 16종 · 등급, 효과, 얻는 법', x: 1420, y: 450, scale: 3, view: 'armory',
        news: () => (Meta.data.equips.length ? String(Meta.data.equips.length) : null) },
    { id: 'goblin_desk', sprite: 'hq_goblin_desk', name: '고블린 비서', desc: '기록 장부 · 기록 지우기', x: 1450, y: 780, scale: 3, view: 'record',
        news: () => null },
    { id: 'portal', sprite: 'hq_portal', name: '도전의 문', desc: '도전 콘텐츠', x: 800, y: 396, scale: 5, view: 'portal', main: true,
        news: () => { const open = HQ_CONTENTS.filter(hqContentOpen); return open.length ? open.map(c => c.id).join() : null; } }
];

// 도전의 문 콘텐츠. 스토리를 다 깨지 않아도 문에는 처음부터 들어간다. 콘텐츠마다 unlockStage(스테이지 번호)를 깨면 열리고,
// 없으면 처음부터 열려 있다. 항목: { id, name, desc, unlockStage?, enter?() }. 지금은 비어 있어 "준비 중" 안내만 보인다
// 도전의 문 아래 칸(콘텐츠 설명과 심연 계약서)
const HQ_PORTAL_PANEL = { x: 1920 / 2 - 560, y: 320, w: 1120, h: 540 };

const HQ_CONTENTS = [
    { id: 'daily', name: '일일 도전', desc: '오늘은 모두 같은 판', panel: 'drawDailyPanel', enter: () => UI.startDaily() },
    { id: 'abyss', name: '끝없는 심연', desc: '금단의 계약에 서명하고 끝없이', panel: 'drawAbyssPanel', enter: () => { UI.portalPick = 'abyss'; } },
    { id: 'raid', name: '주간 토벌전', desc: '이번 주 보스를 잡아라', panel: 'drawRaidPanel', enter: () => UI.startRaid() }
];

// 고블린 비서의 말풍선: 깬 스테이지 수가 cleared 이상인 마지막 줄. {no}, {name}은 다음 스테이지 번호와 이름
const HQ_GOBLIN_LINES = [
    { cleared: 0, text: '사장님, 첫 손님이 문 앞에 와 있어요! 작전 테이블로 가요.' },
    { cleared: 1, text: '사장님, {no}번 스테이지 손님이 기다려요. 차는 제가 낼게요.' },
    { cleared: 2, text: '황금 마왕님이 장부를 펴셨어요. {no}번 {name}, 가 보시죠.' },
    { cleared: 3, text: '여왕님이 월세를 뼈로 냈어요. 다음은 {no}번이에요, 사장님.' },
    { cleared: 4, text: '철거반이 온대요. {no}번에서 막아 주세요!' },
    { cleared: 5, text: '마지막 손님 부대장님이에요! {no}번만 깨면 이야기 끝!' },
    { cleared: 6, text: '이야기는 끝! 이제 도전의 문이 진짜 장사예요, 사장님.' }
];

// 다음에 할 스토리 스테이지(열렸고 아직 안 깬 첫 스테이지). 다 깼으면 null
function hqNextStage() {
    return STAGES.find(st => Meta.isOpen(st.id) && !Meta.isCleared(st.id)) || null;
}

// 도전의 문 콘텐츠가 열렸는지: unlockStage가 없으면 처음부터, 있으면 그 번호의 스테이지를 깼을 때
function hqContentOpen(c) {
    if (!c.unlockStage) return true;
    const st = STAGES.find(s => s.no === c.unlockStage);
    return !!st && Meta.isCleared(st.id);
}

// 고블린 비서의 지금 대사
function hqGoblinLine() {
    const n = Meta.data.cleared.length;
    let line = HQ_GOBLIN_LINES[0];
    for (const l of HQ_GOBLIN_LINES) if (n >= l.cleared) line = l;
    const next = hqNextStage();
    return line.text.replace('{no}', next ? next.no : '').replace('{name}', next ? next.name : '');
}

// 장비 얻는 법: 정예 드롭은 일반과 희귀, 보스 보상 카드는 희귀와 영웅(EQUIP_RULES와 game.js의 뽑기 규칙)
function equipSources(grade) {
    return { common: '재료 · 정예 처치', rare: '조합 · 보스 보상', epic: '조합 · 보스 보상(드물게)' }[grade];
}

// 본부 안 화면의 칸 격자(진열장 유물, 무기고 장비): 8열 2줄, 등급 색 테두리 칸. 오른쪽은 금테 상세 창(HQ_DETAIL)
const HQ_GRID = { cols: 8, w: 132, h: 150, gapX: 18, gapY: 18, x: 70, y: 560 };
const HQ_RELIC_GRID = { cols: 15, w: 74, h: 74, gapX: 6, gapY: 6, x: 70, y: 450 }; // 유물 47개: 한 줄에 15칸, 그림만(이름은 상세 창)
const HQ_LORD_CARD = { w: 164, h: 230, gap: 10, x: 70, y: 150 }; // 마왕 7명이 한 줄에
const HQ_DETAIL = { x: 1300, y: 150, w: 560, h: 740 };

Object.assign(UI, {
    hqView: null, // 본부 안 화면: null(방) | 'relics' | 'armory' | 'record' | 'portal'
    hqSettings: false, // 본부 설정 창이 열려 있는지
    hqSeen: null, // 시설마다 본 "새 소식" 값(HQ_SEEN_KEY에서 읽는다)

    // 본부로: 타이틀의 시작, 스토리 지도·도감·결과 화면의 닫기와 Esc가 여기로 온다
    openHQ() {
        this.collection = null;
        this.dialogue = null;
        this.unlockCards = null;
        this.afterRun = null;
        this.hqView = null;
        this.hqSettings = false;
        this.battleMenu = false;
        this.titleSince = null; // 다음에 타이틀로 오면 다시 밝아진다
        this.wipeArmed = 0;
        this.cancel();
        this.returning = [];
        Game.clearField();
        Game.state = 'hq';
        Game.paused = false;
        this.loadout = cleanLoadout(this.loadout || this.loadLoadout());
    },

    // ----- 느낌표(새로 볼 것) -----

    loadHqSeen() {
        if (this.hqSeen) return this.hqSeen;
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(HQ_SEEN_KEY) || 'null');
        } catch (e) { /* 처음 상태 */ }
        this.hqSeen = {};
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            for (const f of HQ_FACILITIES) if (typeof raw[f.id] === 'string') this.hqSeen[f.id] = raw[f.id];
        }
        return this.hqSeen;
    },

    // 시설에 새로 볼 것이 있는지(느낌표)
    hqHasNews(f) {
        const v = f.news();
        return v !== null && v !== undefined && this.loadHqSeen()[f.id] !== v;
    },

    markHqSeen(f) {
        const v = f.news();
        const seen = this.loadHqSeen();
        if (v === null || v === undefined) delete seen[f.id];
        else seen[f.id] = v;
        try {
            localStorage.setItem(HQ_SEEN_KEY, JSON.stringify(seen));
        } catch (e) { /* 저장을 못 해도 이번 창에서는 사라진다 */ }
    },

    // ----- 시설 -----

    // 시설 그림 네모와 이름표(누르는 자리는 둘을 합친 네모)
    hqFacilityRect(f) {
        const size = 64 * f.scale;
        return { x: f.x, y: f.y, w: size, h: size + 4 + HQ_PLATE_H };
    },

    enterFacility(f) {
        this.markHqSeen(f);
        this.hqSettings = false;
        if (f.view) {
            this.hqView = f.view;
            this.wipeArmed = 0;
        } else {
            this[f.action]();
        }
    },

    closeHqView() {
        this.hqView = null;
        this.wipeArmed = 0;
    },

    // 설정 창(본부와 타이틀이 함께 쓴다). 타이틀에서는 "타이틀로"가 없다
    layoutSettings() {
        const x = GAME_WIDTH / 2 - 260;
        // 음량 세 줄: − 와 + 로 10씩
        HQ_VOLUME_ROWS.forEach(([kind], i) => {
            const y = HQ_SETTINGS_Y + 110 + i * 84;
            const step = d => () => { Sfx.setVolume(kind, Sfx.volume[kind] + d); saveSettings(); Sfx.play('click'); };
            this.button(`vol_${kind}_down`, x + 250, y, 76, 64, { label: '−', size: 34, disabled: Sfx.volume[kind] <= 0, onClick: step(-10) });
            this.button(`vol_${kind}_up`, x + 404, y, 76, 64, { label: '+', size: 34, disabled: Sfx.volume[kind] >= 100, onClick: step(10) });
        });
        const by = HQ_SETTINGS_Y + 370;
        this.settingsRows().forEach((row, i, rows) => {
            const y = by + i * 86 + (i === rows.length - 1 ? 12 : 0); // 닫기는 조금 띄운다
            this.button(row.id, x + 40, y, 440, 72, Object.assign({ size: 28 }, row));
        });
    },

    // 설정 창의 줄: 소리, 효과, 튜토리얼 다시 보기(전투 밖), 타이틀로(본부), 닫기
    settingsRows() {
        const rows = [
            { id: 'set_sound', label: Sfx.muted ? '소리 켜기' : '소리 끄기', icon: 'sound', onClick: () => { Sfx.setMuted(!Sfx.muted); saveSettings(); } },
            { id: 'set_fx', label: Fx.reduce ? '효과 원래대로' : '효과 줄이기', icon: 'gear', onClick: () => { Fx.reduce = !Fx.reduce; saveSettings(); } },
            { id: 'set_numbers', label: Fx.noNumbers ? '피해 숫자 켜기' : '피해 숫자 끄기', icon: 'attack', onClick: () => { Fx.noNumbers = !Fx.noNumbers; saveSettings(); } }
        ];
        if (!Game.inPlay()) rows.push({ id: 'set_tutorial', label: '튜토리얼 다시 보기', icon: 'book', onClick: () => this.replayTutorial() }); // js/ui/tutorial.js
        if (Game.state === 'hq') rows.push({ id: 'set_title', label: '타이틀로', icon: 'retry', onClick: () => { this.hqSettings = false; Game.state = 'title'; } });
        rows.push({ id: 'set_close', label: '닫기', icon: 'close', onClick: () => { this.hqSettings = false; } });
        return rows;
    },

    layoutHQ() {
        if (this.hqSettings) {
            this.layoutSettings();
            return;
        }
        if (this.hqView) {
            this.layoutHqView();
            return;
        }
        HQ_FACILITIES.forEach((f, i) => {
            const r = this.hqFacilityRect(f);
            this.button(`hq_${f.id}`, r.x, r.y, r.w, r.h, { facility: f, key: i + 1, onClick: () => this.enterFacility(f) });
        });
        const bx = GAME_WIDTH - TOP_BTN - 12;
        const save = Game.readRunSave();
        if (save) {
            this.button('hq_resume', GAME_WIDTH / 2 - 220, 12, 440, 76, { label: `이어하기 · 라운드 ${save.waveIndex + 1}`, icon: 'retry', size: 28, onClick: () => { if (!this.resumeRun()) { this.openHQ(); this.showToast('불러오기 실패'); } } });
        }
        this.button('hq_settings', bx, 12, TOP_BTN, TOP_BTN, { icon: 'gear', iconOnly: true, tip: '설정', onClick: () => { this.hqSettings = true; } });
        this.button('mute', bx - TOP_BTN - 6, 12, TOP_BTN, TOP_BTN, {
            icon: 'sound', iconOnly: true, on: Sfx.muted, slash: Sfx.muted, tip: Sfx.muted ? '소리 켜기 (M)' : '소리 끄기 (M)',
            onClick: () => { Sfx.setMuted(!Sfx.muted); saveSettings(); }
        });
    },

    // 본부 안 화면: 닫기 버튼과 화면별 버튼(기록 지우기, 콘텐츠)
    layoutHqView() {
        this.button('hq_close', GAME_WIDTH - 230, 28, 180, 68, { label: '닫기', icon: 'close', size: 26, onClick: () => this.closeHqView() });
        if (this.hqView === 'record') {
            const armed = this.wipeArmed > 0;
            this.button('col_wipe', GAME_WIDTH / 2 - 270, 930, 540, 88, {
                label: armed ? '정말 지울까요? 한 번 더!' : '기록 지우기', icon: 'close',
                sub: armed ? '스테이지 진행, 해금, 도감이 모두 처음으로' : null,
                theme: 'danger', size: armed ? 26 : 30, onClick: () => this.pressWipe()
            });
        }
        if (this.hqView === 'portal') {
            HQ_CONTENTS.forEach((c, i) => {
                const r = this.hqContentRect(i);
                const open = hqContentOpen(c);
                this.button(`content_${c.id}`, r.x, r.y, r.w, r.h, { content: c, locked: !open, onClick: () => this.pickContent(c) });
            });
            // 심연을 고르고 있으면 계약서: 난이도 열 줄과 서명 버튼
            if ((this.portalPick || HQ_CONTENTS[0].id) === 'abyss') {
                ABYSS_LEVELS.forEach(L => {
                    const r = this.abyssLevelRect(L.id);
                    this.button(`abyss_lv_${L.id}`, r.x, r.y, r.w, r.h, { abyssLevel: L.id, onClick: () => { this.abyssLevel = L.id; saveSettings(); Sfx.play('click'); } });
                });
                const P = HQ_PORTAL_PANEL;
                this.button('abyss_sign', P.x + P.w - 300, P.y + P.h - 92, 270, 70, { label: '서명하고 입장', icon: 'retry', theme: 'gold', size: 28, onClick: () => this.openAbyss() });
            }
        }
    },

    // 계약서 왼쪽의 난이도 줄(아래가 쉬움이 아니라 위에서부터 베이직 → 헬)
    abyssLevelRect(i) {
        const P = HQ_PORTAL_PANEL;
        return { x: P.x + 28, y: P.y + 26 + i * 49, w: 290, h: 44 };
    },

    hqContentRect(i) {
        return { x: GAME_WIDTH / 2 - 560 + i * 380, y: 110, w: 360, h: 190 };
    },

    // 콘텐츠를 누른다: 잠겼으면 열리는 스테이지, 열렸으면 그 콘텐츠의 enter(아직 없으면 준비 중)
    pickContent(c) {
        if (!hqContentOpen(c)) {
            this.showToast(`${c.name}: 스테이지 ${c.unlockStage} 먼저`);
            Sfx.play('mergeFail');
            return;
        }
        if (c.enter) c.enter();
        else this.showToast(`${c.name}: 준비 중`);
    },

    // 본부 키: 1~6 시설, Esc 닫기(안 화면 → 방 → 타이틀)
    onHqKey(code) {
        if (this.hqSettings) {
            if (code === 'Escape') this.hqSettings = false;
            return;
        }
        if (this.hqView) {
            if (code === 'Escape') this.closeHqView();
            return;
        }
        const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
        const f = m && HQ_FACILITIES[Number(m[1]) - 1];
        if (f) {
            Sfx.play('click');
            this.enterFacility(f);
        } else if (code === 'Escape') {
            Game.state = 'title';
        }
    },

    // ----- 그리기 -----

    drawHQ(ctx) {
        if (this.hqView) {
            this.drawTable(ctx);
            this[{ relics: 'drawHqRelics', armory: 'drawHqArmory', record: 'drawHqRecord', portal: 'drawHqPortal' }[this.hqView]](ctx);
            return;
        }
        this.drawHqRoom(ctx);
        // 위쪽 왼쪽 이름판: 본부 이름과 스토리 진행
        const T = UI_THEME;
        this.drawHexPlate(ctx, 40, 22, 460, 66);
        UIKit.text(ctx, '마왕군 본부', 80, 56, 32, T.cream, 'left', 'bold');
        UIKit.text(ctx, `스토리 ${Meta.data.cleared.length}/${STAGES.length}`, 464, 57, 24, T.gold, 'right', 'bold');
        this.drawGoblinBubble(ctx);
        if (this.hqSettings) this.drawHqSettings(ctx);
    },

    // 방: 벽, 바닥(카펫), 그리고 뒤에서 앞으로(바닥 높이 순) 장식, 왕좌, 마왕, 시설
    drawHqRoom(ctx) {
        ctx.drawImage(this.hqBackground(), 0, 0);
        const items = [];
        const R = HQ_ROOM;
        for (const d of R.decor) {
            const st = d.unlockStage && STAGES.find(s => s.no === d.unlockStage);
            if (d.unlockStage && !(st && Meta.isCleared(st.id))) continue;
            items.push({ foot: d.y + 64 * d.scale, draw: () => this.drawHqSprite(ctx, d.sprite, d.x, d.y, d.scale) });
        }
        items.push({ foot: R.throne.y + 64 * R.throne.scale, draw: () => this.drawHqSprite(ctx, R.throne.sprite, R.throne.x, R.throne.y, R.throne.scale) });
        const lord = DEMON_LORDS[(this.loadout || cleanLoadout(null)).lord] || DEMON_LORDS[DEFAULT_LORD];
        items.push({ foot: R.lord.foot, draw: () => {
            const img = Assets.get(lord.sprite);
            if (!img) return;
            const bob = Math.round(Math.sin(Game.time * 2) * 1) * 2;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, Math.round(R.lord.x - img.width), Math.round(R.lord.foot - lord.footPx * 2 + bob), img.width * 2, img.height * 2);
        } });
        for (const b of this.buttons) {
            if (!b.facility) continue;
            const f = b.facility;
            items.push({ foot: f.y + 64 * f.scale, draw: () => this.drawFacility(ctx, b) });
        }
        // 빛 웅덩이: 화로·수정 둘레 바닥이 숨 쉬듯 밝아진다(도트 타원 세 겹, 더하기 섞기)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const d of R.decor) {
            if (!d.light) continue;
            const st = d.unlockStage && STAGES.find(s => s.no === d.unlockStage);
            if (d.unlockStage && !(st && Meta.isCleared(st.id))) continue;
            const cx = d.x + 64 * d.scale / 2;
            const cy = d.y + 64 * d.scale - 10;
            const a = 0.07 + Math.sin(Game.time * 2.4 + d.x * 0.01) * 0.02;
            for (const [k, al] of [[1, a], [0.66, a * 1.3], [0.36, a * 1.6]]) {
                ctx.fillStyle = `rgba(${d.light},${al})`;
                UIKit.pixelEllipse(ctx, cx, cy, 190 * k, 70 * k, 6);
            }
        }
        ctx.restore();
        items.sort((a, b) => a.foot - b.foot);
        for (const it of items) it.draw();
        // 이름표와 느낌표, 설명은 물건 위에
        for (const b of this.buttons) if (b.facility) this.drawFacilityPlate(ctx, b);
        const hover = this.hoverButton && this.hoverButton.facility ? this.hoverButton : null;
        if (hover) this.drawFacilityTip(ctx, hover);
    },

    // 벽과 바닥은 그림이 다 불러와진 뒤 한 번 그려 둔다
    hqBackground() {
        if (this.hqBg) return this.hqBg;
        const c = document.createElement('canvas');
        c.width = GAME_WIDTH;
        c.height = GAME_HEIGHT;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        // 바닥: 타일 표는 WANG_TILES. 그림에서 upper(1)는 나무 바닥, lower(0)는 붉은 카펫이라 카펫 꼭짓점이 0이다
        const tiles = Assets.get('tileset_hq');
        const carpet = (cx, cy) => HQ_ROOM.carpet.some(([x0, y0, x1, y1]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);
        const cols = Math.ceil(GAME_WIDTH / HQ_TILE);
        const rows = Math.ceil((GAME_HEIGHT - HQ_WALL_H) / HQ_TILE);
        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                const key = [carpet(col, r), carpet(col + 1, r), carpet(col, r + 1), carpet(col + 1, r + 1)].map(v => (v ? '0' : '1')).join('');
                const [bx, by, bw, bh] = WANG_TILES[key];
                if (tiles) g.drawImage(tiles, bx, by, bw, bh, col * HQ_TILE, HQ_WALL_H + r * HQ_TILE, HQ_TILE, HQ_TILE);
            }
        }
        // 벽: 벽돌 색을 깔고 벽 그림을 3배로 이어 붙인다. 아래에 굽도리 판
        g.fillStyle = HQ_ROOM.wallColor;
        g.fillRect(0, 0, GAME_WIDTH, HQ_WALL_H);
        const seg = GAME_WIDTH / HQ_ROOM.wall.length;
        HQ_ROOM.wall.forEach((name, i) => {
            const img = Assets.get(name);
            if (img) g.drawImage(img, Math.round(i * seg + (seg - 192) / 2), 0, 192, 192);
        });
        g.fillStyle = UI_THEME.walnutDark;
        g.fillRect(0, HQ_WALL_H - 10, GAME_WIDTH, 14);
        g.fillStyle = 'rgba(20,10,4,0.35)';
        g.fillRect(0, HQ_WALL_H + 4, GAME_WIDTH, 10);
        // 바닥과 벽의 채도와 밝기를 눌러 시설과 글자가 앞으로 나오게 한다
        g.globalCompositeOperation = 'saturation';
        g.fillStyle = 'rgba(128,128,128,0.35)';
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = '#8a7a80'; // 2026-11-11: 너무 어두워 방이 비어 보였다(#5e5258에서 밝힘)
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        g.globalCompositeOperation = 'source-over';
        if (tiles && Assets.get(HQ_ROOM.wall[0])) this.hqBg = c; // 그림이 모두 있을 때만 남겨 둔다
        return c;
    },

    drawHqSprite(ctx, name, x, y, scale) {
        const img = Assets.get(name);
        if (!img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale);
    },

    // 시설 그림: 발밑 그림자, 마우스를 올리면 살짝 커지고 밝아진다(누르면 2px 내려앉는다). 도전의 문은 은은한 빛
    drawFacility(ctx, b) {
        const f = b.facility;
        const img = Assets.get(f.sprite);
        const st = this.btnState(b);
        const size = 64 * f.scale;
        const cx = f.x + size / 2;
        const foot = f.y + size;
        ctx.save();
        ctx.fillStyle = 'rgba(10,6,4,0.3)';
        UIKit.pixelEllipse(ctx, cx, foot - 8, size * 0.4, 14, 4);
        if (f.main) {
            // 도전의 문: 문 안쪽에서 새는 붉은 빛(숨쉬듯)
            const a = 0.22 + Math.sin(Game.time * 2.2) * 0.08;
            ctx.fillStyle = `rgba(255,120,60,${a})`;
            UIKit.pixelEllipse(ctx, cx, foot - 10, size * 0.5, 30, 4);
        }
        ctx.restore();
        if (!img) return;
        const k = st.hover ? HQ_HOVER_GROW : 1;
        const w = Math.round(size * k);
        const x = Math.round(cx - w / 2);
        const y = Math.round(foot - w + (st.pressed ? 2 : 0));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, y, w, w);
        if (st.hover) {
            const lit = Assets.tinted(f.sprite, '#fff1d6', 0.22);
            if (lit) ctx.drawImage(lit, x, y, w, w);
        }
    },

    // 이름표(남색 판, 금선, 번호 키)와 새 소식 느낌표. 도전의 문은 금색 글자
    drawFacilityPlate(ctx, b) {
        const T = UI_THEME;
        const f = b.facility;
        const size = 64 * f.scale;
        const hover = this.hoverButton === b;
        const fs = f.main ? 30 : 24;
        ctx.font = `bold ${fs}px ${UI_FONT}`;
        const w = Math.ceil(ctx.measureText(f.name).width) + 52;
        const x = Math.round(f.x + size / 2 - w / 2);
        const y = f.y + size + 4;
        UIKit.note(ctx, x, y, w, HQ_PLATE_H, { tint: hover ? 'hover' : null });
        UIKit.text(ctx, f.name, x + w / 2, y + HQ_PLATE_H / 2 + 1, fs, f.main ? T.gold : T.cream, 'center', 'bold');
        // 새 소식 표시는 첫 시설 하나에만(여러 개를 동시에 재촉하지 않는다)
        const first = this.buttons.find(x => x.facility && this.hqHasNews(x.facility));
        if (first === b) {
            const bob = Math.round(Math.sin(Game.time * 4) * 3);
            const sx = f.x + size - 34;
            const sy = f.y + 28 + bob;
            this.powerGem(ctx, sx, sy, 22, '#0c0814');
            this.powerGem(ctx, sx, sy, 16, '#ff9a4d');
        }
    },

    // 마우스를 올린 시설의 짧은 설명(그림 위 남색 작은 창)
    drawFacilityTip(ctx, b) {
        const f = b.facility;
        ctx.font = `21px ${UI_FONT}`;
        const w = Math.ceil((ctx.measureText(f.desc).width + 44) / 4) * 4;
        const x = clamp(f.x + 32 * f.scale - w / 2, 8, GAME_WIDTH - w - 8);
        const y = Math.max(104, f.y - 34);
        UIKit.note(ctx, x, y, w, 44, { pin: true });
        UIKit.ink(ctx, f.desc, x + w / 2, y + 24, 21, UI_THEME.ink, 'center');
    },

    // 고블린 비서의 말풍선: 책상 왼쪽 남색 작은 창과 금색 꼬리
    drawGoblinBubble(ctx) {
        const f = HQ_FACILITIES.find(x => x.view === 'record');
        if (!f) return;
        const text = hqGoblinLine();
        ctx.font = `22px ${UI_FONT}`;
        const lines = this.wrapLines(ctx, text, 460);
        const w = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)) + 56);
        const h = 30 + lines.length * 30;
        const x = f.x - w - 14;
        const y = f.y + 70 - h / 2;
        UIKit.note(ctx, x, y, w, h);
        ctx.fillStyle = UI_THEME.goldLine;
        ctx.beginPath();
        ctx.moveTo(x + w - 2, y + h / 2 - 12);
        ctx.lineTo(x + w + 18, y + h / 2 + 4);
        ctx.lineTo(x + w - 2, y + h / 2 + 12);
        ctx.fill();
        ctx.fillStyle = UI_THEME.navy;
        ctx.beginPath();
        ctx.moveTo(x + w - 4, y + h / 2 - 7);
        ctx.lineTo(x + w + 10, y + h / 2 + 4);
        ctx.lineTo(x + w - 4, y + h / 2 + 7);
        ctx.fill();
        lines.forEach((l, i) => UIKit.ink(ctx, l, x + 28, y + 30 + i * 30, 22, UI_THEME.ink));
    },

    drawHqSettings(ctx) {
        const T = UI_THEME;
        ctx.fillStyle = T.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        UIKit.panel(ctx, GAME_WIDTH / 2 - 260, HQ_SETTINGS_Y, 520, 482 + (this.settingsRows().length - 1) * 86); // 줄 수에 맞춘다
        UIKit.text(ctx, '설정', GAME_WIDTH / 2, HQ_SETTINGS_Y + 66, 44, T.gold, 'center', 'bold');
        const x = GAME_WIDTH / 2 - 260;
        HQ_VOLUME_ROWS.forEach(([kind, label], i) => {
            const y = HQ_SETTINGS_Y + 110 + i * 84;
            UIKit.text(ctx, label, x + 44, y + 32, 28, T.cream, 'left', 'bold');
            UIKit.text(ctx, String(Sfx.volume[kind]), x + 365, y + 32, 28, Sfx.muted ? T.creamSoft : T.gold, 'center', 'bold');
        });
    },

    // 안 화면 제목(왼쪽 위): 시설 그림과 큰 제목, 보조 글
    drawHqTitle(ctx, sprite, title, sub) {
        const T = UI_THEME;
        this.drawHqSprite(ctx, sprite, 40, 14, 1);
        UIKit.text(ctx, title, 118, 52, 44, T.cream, 'left', 'bold');
        if (sub) UIKit.text(ctx, sub, 118, 96, 21, T.creamSoft);
    },

    // 카드 격자 i번 자리(진열장 유물, 무기고 장비)
    hqGridRect(i, grid) {
        const G = grid || HQ_GRID;
        return { x: G.x + (i % G.cols) * (G.w + G.gapX), y: G.y + Math.floor(i / G.cols) * (G.h + G.gapY), w: G.w, h: G.h };
    },

    // 그림자(못 얻은 것): 그림 모양만 진한 남색
    drawShadowIcon(ctx, name, x, y, size) {
        const img = Assets.get(name);
        if (!img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.silhouette(img), Math.round(x), Math.round(y), size, size);
    },

    // 마우스 아래 칸(격자 rect 목록 중). 없으면 null
    hqHotCell(rects) {
        const m = this.mouse;
        return rects.find(r => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) || null;
    },

    // 격자 칸 하나: 은테 칸에 그림(96px), 얻은 것은 등급 색 테두리와 오른쪽 아래 작은 등급 이름, 아래에 이름
    drawHqCell(ctx, r, opts) {
        const T = UI_THEME;
        UIKit.slot(ctx, r.x, r.y, r.w, r.h, 'iron', opts.hot ? 'hover' : null);
        const ix = r.x + (r.w - 96) / 2;
        const iy = r.y + 12;
        if (opts.owned) opts.draw(ix, iy);
        else opts.shadow(ix, iy);
        if (opts.owned) {
            UIKit.gradeFrame(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, opts.color, opts.hot ? 5 : 3);
            if (opts.gradeName) UIKit.text(ctx, opts.gradeName, r.x + r.w - 10, r.y + 102, 15, opts.light, 'right', 'bold');
        } else if (opts.stage) {
            this.drawStageBadge(ctx, opts.stage, r.x + r.w - 20, r.y + 22, 14);
        }
        ctx.font = `bold 18px ${UI_FONT}`;
        let fs = 18;
        const name = opts.owned ? opts.name : '???';
        while (fs > 13 && ctx.measureText(name).width > r.w - 12) ctx.font = `bold ${--fs}px ${UI_FONT}`;
        UIKit.text(ctx, name, r.x + r.w / 2, r.y + r.h - 22, fs, opts.owned ? opts.light : T.inkFaint, 'center', 'bold');
    },

    // 보물 진열장: 위쪽 마왕 7명(1배 그림), 아래 유물 47개(그림 칸), 오른쪽 금테 상세 창(마우스를 올린 것). 잠긴 것은 그림자와 해금 스테이지
    drawHqRelics(ctx) {
        const T = UI_THEME;
        const relicIds = Object.keys(RELICS);
        this.drawHqTitle(ctx, 'hq_relic_case', '보물 진열장', `마왕 ${Meta.lordsOwned().length}/${Object.keys(DEMON_LORDS).length} · 유물 ${Meta.relicsOwned().length}/${relicIds.length} · 유물 칸 ${Meta.relicSlots()}/${Meta.maxSlots()}`);
        const L = HQ_LORD_CARD;
        const lordIds = Object.keys(DEMON_LORDS);
        const lordRects = lordIds.map((id, i) => ({ id, x: L.x + i * (L.w + L.gap), y: L.y, w: L.w, h: L.h }));
        const relicRects = relicIds.map((id, i) => Object.assign({ id }, this.hqGridRect(i, HQ_RELIC_GRID)));
        const hot = this.hqHotCell([...lordRects, ...relicRects]);
        for (const r of lordRects) {
            const lord = DEMON_LORDS[r.id];
            const owned = Meta.hasLord(r.id);
            const on = hot === r;
            UIKit.slot(ctx, r.x, r.y, r.w, r.h, owned ? 'gold' : 'iron', on ? 'hover' : null);
            const img = Assets.get(lord.sprite);
            if (img) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                const dx = Math.round(r.x + r.w / 2 - img.width / 2);
                const dy = Math.round(r.y + 172 - lord.footPx);
                if (owned) ctx.drawImage(img, dx, dy, img.width, img.height);
                else ctx.drawImage(this.silhouette(img), dx, dy, img.width, img.height);
                ctx.restore();
            }
            if (on) UIKit.gradeFrame(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, T.goldLight, 4);
            UIKit.text(ctx, owned ? lord.name : '???', r.x + r.w / 2, r.y + r.h - 28, 20, owned ? T.gold : T.inkFaint, 'center', 'bold');
            if (!owned) {
                const st = unlockStage('lord', r.id);
                if (st) this.drawStageBadge(ctx, st.no, r.x + r.w - 28, r.y + 28, 18);
            }
        }
        UIKit.text(ctx, '유물', HQ_RELIC_GRID.x, HQ_RELIC_GRID.y - 28, 30, T.cream, 'left', 'bold');
        for (const r of relicRects) {
            // 칸에는 그림만(이름과 효과는 상세 창). 잠긴 것은 그림자와 해금 스테이지
            const owned = Meta.hasRelic(r.id);
            const st = unlockStage('relic', r.id);
            UIKit.slot(ctx, r.x, r.y, r.w, r.h, owned ? 'gold' : 'iron', hot === r ? 'hover' : null);
            if (owned) this.drawRelicIcon(ctx, r.id, r.x + (r.w - 48) / 2, r.y + (r.h - 48) / 2);
            else {
                this.drawShadowIcon(ctx, `relic_${r.id}`, r.x + (r.w - 48) / 2, r.y + (r.h - 48) / 2, 48);
                if (st) this.drawStageBadge(ctx, st.no, r.x + r.w - 14, r.y + r.h - 14, 12);
            }
            if (hot === r) UIKit.gradeFrame(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, T.goldLight, 3);
        }
        // 상세 창: 마우스를 올린 것, 없으면 첫 마왕
        const D = HQ_DETAIL;
        this.drawDetailFrame(ctx, D.x, D.y, D.w, D.h);
        const pick = hot || lordRects[0];
        const lordPick = lordIds.includes(pick.id) && !RELICS[pick.id];
        const x = D.x + 32;
        let y = D.y + 40;
        if (lordPick) {
            const lord = DEMON_LORDS[pick.id];
            const owned = Meta.hasLord(pick.id);
            UIKit.ink(ctx, '마왕', x, y, 20, T.inkSoft);
            UIKit.bigText(ctx, owned ? lord.name : '???', x, y + 44, 40, owned ? T.gold : T.inkFaint, 'left');
            UIKit.waxFrame(ctx, x, y + 84, 168);
            if (owned) this.drawLordPortrait(ctx, lord, x + 8, y + 92, 152);
            y += 290;
            if (owned) {
                UIKit.ink(ctx, lord.desc, x, y, 22, T.inkSoft, 'left', 'bold');
                UIKit.ink(ctx, `패시브 · ${lord.passive.name}`, x, y + 40, 22, T.inkWax, 'left', 'bold');
                ctx.font = `20px ${UI_FONT}`;
                const passive = this.wrapLines(ctx, lord.passive.desc, D.w - 64).slice(0, 4);
                passive.forEach((t, j) => UIKit.ink(ctx, t, x, y + 74 + j * 28, 20, T.ink));
                UIKit.ink(ctx, lordSkillLine(lord), x, y + 86 + passive.length * 28, 20, T.inkWax, 'left', 'bold'); // 마왕마다 다른 Q, W
            } else {
                const st = unlockStage('lord', pick.id);
                UIKit.text(ctx, st ? `스테이지 ${st.no}에서 해금` : '처음부터', x, y, 26, T.creamSoft, 'left', 'bold');
            }
        } else {
            const relic = RELICS[pick.id];
            const owned = Meta.hasRelic(pick.id);
            UIKit.ink(ctx, '유물', x, y, 20, T.inkSoft);
            UIKit.bigText(ctx, owned ? relic.name : '???', x, y + 44, 40, owned ? T.gold : T.inkFaint, 'left');
            UIKit.slot(ctx, x, y + 84, 168, 168, owned ? 'gold' : 'iron');
            if (owned) this.drawUnlockIcon(ctx, { kind: 'relic', id: pick.id }, x + 12, y + 96, 144);
            else this.drawShadowIcon(ctx, `relic_${pick.id}`, x + 36, y + 120, 96);
            y += 290;
            if (owned) {
                // 유물 효과는 설명 글(desc) 그대로
                ctx.font = `22px ${UI_FONT}`;
                this.wrapLines(ctx, relic.desc, D.w - 64).slice(0, 6).forEach((t, j) => UIKit.ink(ctx, t, x, y + j * 32, 22, T.inkGood));
            } else {
                const st = unlockStage('relic', pick.id);
                UIKit.text(ctx, st ? `스테이지 ${st.no}에서 해금` : '처음부터', x, y, 26, T.creamSoft, 'left', 'bold');
            }
        }
        const nextSlot = Meta.relicSlots() < Meta.maxSlots() ? unlockStage('slot', Meta.relicSlots() + 1) : null;
        UIKit.text(ctx, `유물 칸 ${Meta.relicSlots()} / ${Meta.maxSlots()}${nextSlot ? ` · 다음 칸은 스테이지 ${nextSlot.no}에서 해금` : ''}`, 70, 960, 24, T.gold, 'left', 'bold');
        UIKit.text(ctx, '', 70, 1000, 19, T.creamSoft);
    },

    // 유물 그림(48px)을 2배로
    drawRelicIcon2x(ctx, id, x, y) {
        const img = Assets.get(`relic_${id}`);
        if (!img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), 96, 96);
    },

    // 무기고: 재료 6종의 조합표(가로세로 재료, 칸은 완성 장비)와 오른쪽 상세 창. 얻은 적 없는 것은 그림자와 ???
    drawHqArmory(ctx) {
        const T = UI_THEME;
        const ids = Object.keys(EQUIPMENT);
        this.drawHqTitle(ctx, 'hq_weapon_rack', '무기고', `얻은 장비 ${ids.filter(id => Meta.hasEquip(id)).length} / ${ids.length}`);
        const size = 118;
        const gap = 8;
        const x0 = 70;
        const y0 = 130;
        UIKit.panel(ctx, x0 - 16, y0 - 16, (size + gap) * 7 + 24, (size + gap) * 7 + 24);
        const cell = (col, row) => ({ x: x0 + col * (size + gap), y: y0 + row * (size + gap), w: size, h: size });
        const rects = [];
        EQUIP_BASES.forEach((b, i) => {
            rects.push(Object.assign({ id: b, base: true }, cell(i + 1, 0)));
            rects.push(Object.assign({ id: b, base: true }, cell(0, i + 1)));
            EQUIP_BASES.forEach((c, j) => { if (j >= i) rects.push(Object.assign({ id: craftResult(b, c) }, cell(j + 1, i + 1))); });
        });
        const hot = this.hqHotCell(rects);
        for (const r of rects) {
            const owned = r.base || Meta.hasEquip(r.id);
            UIKit.slot(ctx, r.x, r.y, r.w, r.h, r.base ? 'gold' : 'iron', hot === r ? 'hover' : null);
            if (owned) this.drawEquipIcon(ctx, r.id, r.x + (size - 96) / 2, r.y + (size - 96) / 2, 2);
            else this.drawShadowIcon(ctx, `equip_${r.id}`, r.x + (size - 96) / 2, r.y + (size - 96) / 2, 96);
        }
        const D = HQ_DETAIL;
        this.drawDetailFrame(ctx, D.x, D.y, D.w, D.h);
        const pick = hot || rects.find(r => Meta.hasEquip(r.id)) || rects[0];
        const def = EQUIPMENT[pick.id];
        const grade = MONSTER_GRADES[def.grade];
        const known = pick.base || Meta.hasEquip(pick.id);
        const x = D.x + 32;
        let y = D.y + 40;
        UIKit.ink(ctx, '장비', x, y, 20, T.inkSoft);
        UIKit.bigText(ctx, known ? def.name : '???', x, y + 44, 40, known ? grade.light : T.inkFaint, 'left');
        const cw = this.drawGradeChip(ctx, def.grade, x, y + 92, 20);
        UIKit.ink(ctx, equipSources(def.grade), x + cw + 10, y + 93, 19, T.inkSoft, 'left', 'bold');
        UIKit.slot(ctx, x, y + 124, 168, 168, 'iron');
        if (known) {
            this.drawEquipIcon(ctx, pick.id, x + 12, y + 136, 3);
            UIKit.gradeFrame(ctx, x + 2, y + 126, 164, 164, grade.color, 5);
        } else {
            this.drawShadowIcon(ctx, `equip_${pick.id}`, x + 36, y + 160, 96);
        }
        y += 340;
        if (known) {
            for (const part of equipEffectText(pick.id).split(', ')) {
                UIKit.text(ctx, part, x, y, 28, T.good, 'left', 'bold');
                y += 40;
            }
        } else {
            UIKit.text(ctx, '', x, y, 24, T.creamSoft, 'left', 'bold');
        }
    },

    // 고블린 비서의 장부: 판 수, 승리 수, 진행 스테이지, 도감 진행률. 기록 지우기 버튼은 layoutHqView가 놓는다
    drawHqRecord(ctx) {
        const T = UI_THEME;
        const d = Meta.data;
        const cx = GAME_WIDTH / 2;
        this.drawHqTitle(ctx, 'hq_goblin_desk', '고블린 비서의 장부', '"사장님 기록은 제가 다 적어 두었습니다."');
        const hidden = MONSTER_RECIPES.filter(r => r.hidden);
        const pct = (a, b) => `${a} / ${b} (${b ? Math.floor(a / b * 100) : 0}%)`;
        const next = hqNextStage();
        UIKit.panel(ctx, cx - 460, 150, 920, 740);
        const rows = [
            ['판 수', `${d.runs}판`],
            ['승리 수', `${d.wins}번`],
            ['진행 스테이지', `${d.cleared.length} / ${STAGES.length}`],
            ['다음 스테이지', next ? `${next.no}. ${next.name}` : '모두 깸'],
            ['마왕 · 유물 · 유물 칸', `${Meta.lordsOwned().length} · ${Meta.relicsOwned().length} · ${Meta.relicSlots()}`],
            ['본 몬스터', pct(d.seen.length, Object.keys(MONSTERS).length)],
            ['찾은 조합식', pct(d.recipes.length, MONSTER_RECIPES.length)],
            ['찾은 히든 조합식', `${hidden.filter(r => Meta.hasRecipe(r)).length} / ${hidden.length}`],
            ['얻은 장비', pct(d.equips.length, Object.keys(EQUIPMENT).length)]
        ];
        rows.forEach(([k, v], i) => {
            const y = 230 + i * 70;
            UIKit.ink(ctx, k, cx - 390, y, 28, T.inkSoft);
            UIKit.ink(ctx, v, cx + 390, y, 32, T.ink, 'right', 'bold');
        });
    },

    // 이번 주 토벌전: 보스, 조건, 내 최고 기록
    drawRaidPanel(ctx) {
        const T = UI_THEME;
        const week = abyssWeek();
        const c = raidChallenge(week);
        const boss = BOSSES[c.boss];
        const x = GAME_WIDTH / 2 - 560;
        const y = 320;
        UIKit.panel(ctx, x, y, 1120, 540);
        UIKit.ink(ctx, `이번 주 토벌 · ${boss.name} · ${MAPS[c.map].name}`, x + 40, y + 50, 30, T.gold, 'left', 'bold');
        const a = Meta.raidBest(week);
        UIKit.ink(ctx, a.bestScore ? `이번 주 최고 ${a.bestTier}단계 · ${a.bestScore.toLocaleString()}점` : '이번 주 기록 없음', x + 1080, y + 50, 24, a.bestScore ? T.ink : T.inkSoft, 'right', 'bold');
        const img = Assets.get(`${boss.art.sprite}/rotations/south`);
        if (img) {
            const k = Math.min(1.5, 400 / img.height, 300 / img.width);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, x + 180 - img.width * k / 2, y + 490 - img.height * k, img.width * k, img.height * k);
        }
        const lx = x + 370;
        UIKit.ink(ctx, boss.note, lx, y + 110, 22, '#ffb49a');
        UIKit.ink(ctx, `${RAID_RULES.tierEvery}라운드마다 등장, 처치마다 체력 x${RAID_RULES.tierHpGrowth}`, lx, y + 146, 20, T.ink);
        const lord = DEMON_LORDS[c.lord];
        UIKit.ink(ctx, '마왕', lx, y + 200, 22, T.inkSoft, 'left', 'bold');
        UIKit.ink(ctx, lord.name, lx + 76, y + 200, 24, T.ink, 'left', 'bold');
        c.relics.forEach((id, i) => {
            const ry = y + 226 + i * 70;
            UIKit.ink(ctx, '유물', lx, ry + 34, 22, T.inkSoft, 'left', 'bold');
            UIKit.slot(ctx, lx + 76, ry, 64, 64, 'iron');
            this.drawRelicIcon(ctx, id, lx + 84, ry + 8);
            UIKit.ink(ctx, RELICS[id].name, lx + 150, ry + 22, 22, T.ink, 'left', 'bold');
            UIKit.ink(ctx, RELICS[id].desc, lx + 150, ry + 48, 18, T.inkGood);
        });
        c.cards.forEach((id, i) => {
            const card = RULE_CARDS[id];
            const ry = y + 396 + i * 42;
            UIKit.ink(ctx, '규칙', lx, ry, 22, T.inkSoft, 'left', 'bold');
            UIKit.ink(ctx, card.name, lx + 76, ry, 22, T.ink, 'left', 'bold');
            UIKit.ink(ctx, effectLines(card.effects).join(', '), lx + 260, ry, 19, T.inkBad);
        });
    },

    // 끝없는 심연의 금단의 계약서: 왼쪽은 난이도 열 줄(이번 주 최고 층), 오른쪽은 고른 난이도의 조항
    drawAbyssPanel(ctx) {
        const T = UI_THEME;
        const P = HQ_PORTAL_PANEL;
        UIKit.panel(ctx, P.x, P.y, P.w, P.h);
        const week = abyssWeek();
        const level = abyssLevelOf(this.abyssLevel);
        // 난이도 줄: 고른 줄은 금 칸, 위로 갈수록 붉다
        for (const b of this.buttons) {
            if (b.abyssLevel === undefined) continue;
            const L = ABYSS_LEVELS[b.abyssLevel];
            const picked = L.id === level.id;
            const hover = this.hoverButton === b;
            UIKit.slot(ctx, b.x, b.y, b.w, b.h, picked ? 'gold' : 'iron', hover ? 'hover' : null);
            const hot = L.id / (ABYSS_LEVELS.length - 1);
            const color = picked ? T.gold : (hot > 0.75 ? '#ff9a8a' : (hot > 0.4 ? T.cream : T.creamSoft));
            UIKit.text(ctx, L.name, b.x + 18, b.y + b.h / 2 + 1, 22, color, 'left', 'bold');
            const best = Meta.abyssBest(week, L.id);
            UIKit.text(ctx, best.floor ? `${best.floor}층` : '-', b.x + b.w - 16, b.y + b.h / 2 + 1, 20, best.floor ? T.cream : T.creamSoft, 'right', 'bold');
        }
        const x = P.x + 352;
        const map = MAPS[abyssChallenge(week, DEFAULT_LORD, [], level.id).map].name;
        UIKit.ink(ctx, `금단의 계약서 · ${level.name}`, x, P.y + 50, 32, level.id >= 7 ? T.inkWax : T.gold, 'left', 'bold');
        const best = Meta.abyssBest(week, level.id);
        UIKit.ink(ctx, best.floor ? `이번 주 최고 ${best.floor}층` : '이번 주 기록 없음', P.x + P.w - 36, P.y + 50, 24, best.floor ? T.ink : T.inkSoft, 'right', 'bold');
        UIKit.ink(ctx, `이번 주 심연 · ${map} · ${ABYSS_RULES.mutateEvery}층마다 변이`, x, P.y + 92, 20, T.inkSoft);
        // 기본 배율: 용사 체력과 이동 속도(노말 100%)
        const pct = v => `${Math.round(v * 100)}%`;
        UIKit.ink(ctx, '기본', x, P.y + 132, 18, T.inkSoft, 'left', 'bold');
        UIKit.ink(ctx, `용사 체력 ${pct(level.hp)} · 이동 속도 ${pct(level.speed)}`, x + 70, P.y + 132, 21, level.hp > 1 ? T.inkBad : (level.hp < 1 ? T.inkGood : T.ink), 'left', 'bold');
        if (!level.cards.length) UIKit.ink(ctx, '조항 없음', x, P.y + 172, 22, T.inkSoft, 'left', 'bold');
        level.cards.forEach((id, i) => {
            const card = RULE_CARDS[id];
            const y = P.y + 166 + i * 30;
            const boon = card.kind === 'boon';
            UIKit.ink(ctx, `${boon ? '혜택' : `제${i + 1}조`}`, x, y, 18, T.inkSoft, 'left', 'bold');
            UIKit.ink(ctx, card.name, x + 70, y, 21, T.ink, 'left', 'bold');
            UIKit.ink(ctx, effectLines(card.effects).join(', '), x + 250, y, 18, boon ? T.inkGood : T.inkBad);
        });
    },

    // 오늘의 일일 도전 조건과 내 최고 기록
    drawDailyPanel(ctx) {
        const T = UI_THEME;
        const c = dailyChallenge(kstDate());
        const x = GAME_WIDTH / 2 - 560;
        const y = 320;
        UIKit.panel(ctx, x, y, 1120, 540);
        UIKit.ink(ctx, `오늘의 판 · ${MAPS[c.map].name} · 무한 라운드`, x + 40, y + 50, 30, T.gold, 'left', 'bold');
        const best = Meta.data.daily[c.date];
        UIKit.ink(ctx, best ? `오늘 최고 ${best.score.toLocaleString()}점 · ${best.rounds}라운드` : '오늘 기록 없음', x + 1080, y + 50, 24, best ? T.ink : T.inkSoft, 'right', 'bold');
        const lord = DEMON_LORDS[c.lord];
        UIKit.ink(ctx, '마왕', x + 40, y + 110, 22, T.inkSoft, 'left', 'bold');
        UIKit.ink(ctx, lord.name, x + 120, y + 110, 26, T.ink, 'left', 'bold');
        UIKit.ink(ctx, `패시브 · ${lord.passive.name}: ${lord.passive.desc}`, x + 40, y + 500, 19, T.inkWax);
        c.relics.forEach((id, i) => {
            const ry = y + 148 + i * 72;
            UIKit.ink(ctx, '유물', x + 40, ry + 34, 22, T.inkSoft, 'left', 'bold');
            UIKit.slot(ctx, x + 120, ry, 64, 64, 'iron');
            this.drawRelicIcon(ctx, id, x + 128, ry + 8);
            UIKit.ink(ctx, RELICS[id].name, x + 200, ry + 34, 24, T.ink, 'left', 'bold');
            UIKit.ink(ctx, RELICS[id].desc, x + 460, ry + 34, 20, T.inkGood);
        });
        c.cards.forEach((id, i) => {
            const card = RULE_CARDS[id];
            const ry = y + 330 + i * 52;
            UIKit.ink(ctx, card.kind === 'hard' ? '규칙' : '혜택', x + 40, ry, 22, T.inkSoft, 'left', 'bold');
            UIKit.ink(ctx, card.name, x + 120, ry, 24, T.ink, 'left', 'bold');
            UIKit.ink(ctx, effectLines(card.effects).join(', '), x + 340, ry, 20, card.kind === 'hard' ? T.inkBad : T.inkGood);
        });
    },

    // 도전의 문: 콘텐츠 목록. 비어 있으면 준비 중 안내
    drawHqPortal(ctx) {
        const T = UI_THEME;
        const cx = GAME_WIDTH / 2;
        this.drawHqTitle(ctx, 'hq_portal', '도전의 문', '');
        if (!HQ_CONTENTS.length) {
            UIKit.panel(ctx, cx - 520, 260, 1040, 520);
            this.drawHqSprite(ctx, 'hq_portal', cx - 128, 300, 4);
            UIKit.bigText(ctx, '새로운 도전 준비 중', cx, 610, 52, T.gold, 'center', '#fff4c0');
            UIKit.ink(ctx, '문 너머에서 공사 소리가 납니다. 곧 열립니다!', cx, 672, 24, T.inkSoft, 'center');
            UIKit.ink(ctx, '"사장님, 랭킹 게시판도 걸어 둘게요." - 고블린 비서', cx, 720, 21, T.inkFaint, 'center');
            return;
        }
        // 아래 칸: 마우스를 올린 콘텐츠의 설명(없으면 고른 것, 처음은 첫 콘텐츠)
        const hot = this.hoverButton && this.hoverButton.content;
        if (hot) this.portalPick = hot.id;
        const shown = HQ_CONTENTS.find(c => c.id === this.portalPick) || HQ_CONTENTS[0];
        if (shown.panel) this[shown.panel](ctx);
        for (const b of this.buttons) {
            if (!b.content) continue;
            const c = b.content;
            const hover = this.hoverButton === b;
            const picked = this.portalPick === c.id || (!this.portalPick && c === HQ_CONTENTS[0]);
            // 카드: 일러스트를 잘라 깔고 아래에 이름. 고른 카드만 밝다
            const img = Assets.get(`ill_${c.id}`);
            UIKit.hudFrame(ctx, 'hud_slot', b.x, b.y, b.w, b.h, 14);
            if (img) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                const iw = b.w - 20;
                const ih = b.h - 20;
                ctx.drawImage(img, Math.round((img.width - iw) / 2), Math.round((img.height - ih) / 2), iw, ih, b.x + 10, b.y + 10, iw, ih);
                ctx.fillStyle = b.locked ? 'rgba(6,4,12,0.72)' : (picked || hover ? 'rgba(6,4,12,0.08)' : 'rgba(6,4,12,0.45)');
                ctx.fillRect(b.x + 10, b.y + 10, iw, ih);
                ctx.fillStyle = 'rgba(6,4,12,0.78)';
                ctx.fillRect(b.x + 10, b.y + b.h - 62, iw, 52);
                ctx.restore();
            }
            UIKit.text(ctx, c.name, b.x + 26, b.y + b.h - 36, 26, b.locked ? T.creamSoft : (picked ? T.gold : T.cream), 'left', 'bold');
            if (b.locked) UIKit.text(ctx, `스테이지 ${c.unlockStage} 필요`, b.x + b.w - 26, b.y + b.h - 36, 16, T.creamSoft, 'right', 'bold');
        }
    }
});
