// 화면 UI: 버튼 배치와 입력 처리, HUD 그리기. 재질과 색은 js/ui/uikit.js(UI_THEME, UI_SLICES)
// 하단 바: 왼쪽 체력 구슬과 마왕 이름, 가운데 금장 틀의 슬롯 줄(탭, 소환 또는 마왕 스킬과 유물, 보관함), 오른쪽 골드
const BAR_H = 124; // 하단 바가 차지하는 높이(누를 수 있는 칸은 이 안에). 구슬과 금장 틀은 이 위로 조금 솟는다
const BAR_STRIP_Y = GAME_HEIGHT - 96; // 남색 띠가 시작하는 높이
const BAR_ORB = { x: 112, y: 990, r: 78 }; // 체력 구슬 가운데와 반지름
const BAR_NAME_X = 206; // 구슬 오른쪽 마왕 이름
const BAR_FRAME = { x: 470, w: 966, top: GAME_HEIGHT - BAR_H - 6 }; // 가운데 금장 틀
const BAR_TAB_X = 486; // 틀 왼쪽의 탭 둘(위아래)
const BAR_TAB_W = 138;
const BAR_SLOT_X = 640; // 소환 칸과 스킬 칸이 시작하는 곳
const SUMMON_BTN_W = 240; // 몬스터 탭의 소환 칸(금테, 틀에서 가장 크다)
const UPGRADE_BTN_W = 150; // 소환 강화 칸
const FIELD_COUNT_X = BAR_SLOT_X + SUMMON_BTN_W + 10 + UPGRADE_BTN_W + 12; // 맵 몬스터 수 표시(현재 수/상한)
const NEXT_BTN_X = 1560; // 다음 라운드 버튼(금색): 하단 바 오른쪽 위, 건설 칸이 없는 섬 아래 가장자리
const NEXT_BTN_W = 340;
const NEXT_BTN_Y = GAME_HEIGHT - BAR_H - 104;
const TOP_BTN = 60; // 오른쪽 위 아이콘 버튼
const ABILITY_INK = '#e8a6ff'; // 능력 이름 글자(남색 창 위)
const HINT_SHOWS = 3; // 화면 가운데 안내 쪽지는 종류마다 이만큼만 나온다(이번 창에서)
const POPUP_TOP = 16; // 팝업 창 위쪽 판자 머리 높이(내용은 그 아래부터)
const POPUP_ABILITY_H = 30; // 팝업의 능력 한 줄 높이
const POPUP_SKILL_H = 56; // 팝업의 특수 스킬 한 칸 높이(이름과 설명 두 줄)
const SKILL_INK = '#ffd25a';
const POPUP_RANK_H = 30; // 팝업의 랭크 줄 높이
const POPUP_SACRIFICE_H = 30; // 팝업의 제물 안내 줄 높이
const POPUP_MERGE_H = 60; // 팝업의 합치기 버튼 줄 높이
const DRAG_START = 10; // 이만큼(화면 px) 움직여야 끌기로 본다. 덜 움직이고 떼면 누르기(선택)다
const REWARD_CARD_W = 380; // 보스 보상 카드
const REWARD_CARD_H = 540;
const REWARD_CARD_GAP = 44;
const REWARD_CARD_Y = 290;
// 하단 바의 장비 보관함(3칸 x 2줄). 마왕 탭(DEMON_TAB_END까지)과 다음 라운드 버튼(NEXT_BTN_X) 사이라 탭과 관계없이 늘 보인다
const BAG_X = 1250; // 첫 칸. 왼쪽에 가방 아이콘(48px)과 칸 수
const DEMON_TAB_END = BAG_X - 74; // 마왕 탭의 스킬 칸과 유물 칸이 들어가는 오른쪽 끝(가방 아이콘 왼쪽)
const BAG_COLS = 3;
const BAG_SLOT = 52; // 칸 크기. 48px 장비 그림을 원래 크기로 넣는다
const BAG_GAP = 6;
const POPUP_EQUIP_H = 70; // 팝업의 장비 줄 높이
const EQUIP_MAP_ICON = 24;
const PARTY_X = 1290; // 다음 파티 창 왼쪽(너비 PARTY_W). 오른쪽 위 아이콘 버튼(x 1650부터) 왼쪽
const PARTY_W = 350;
const PARTY_ROW = 34; // 파티 목록 한 줄 높이
const PLATE = { w: 620, h: 58, y: 12 }; // 위쪽 가운데 이름판(지역 이름, 스테이지, 라운드)
// 선택 화면: 위쪽 마왕 카드, 아래쪽 유물 격자(48px 원래 크기)와 고른 유물 칸, 오른쪽 아래 시작 버튼
const LORD_CARD_W = 500;
const LORD_CARD_H = 470;
const LORD_CARD_GAP = 40;
const LORD_CARD_Y = 104;
const RELIC_CELL = 64;
const RELIC_GAP = 6;
const RELIC_COLS = 10;
const RELIC_GRID_X = 150;
const RELIC_GRID_Y = 676;
const PICKED_X = 860; // 고른 유물 칸
const LOADOUT_KEY = 'dungeonGuard.loadout'; // 직전 선택 저장(localStorage)

// 스토리 지도: 남색 창에 메달과 점선 길, 아래쪽 창에 고른 스테이지 설명
const STORY_MAP = { x: 60, y: 110, w: 1800, h: 660 };
const STORY_INFO = { x: 60, y: 790, w: 1800, h: 250 };
const STAMP_R = 46; // 도장 반지름
// 대화: 맵 위를 얇게 가라앉히고 아래쪽에 남색 대화창, 왼쪽에 초상과 이름표. 글자는 한 글자씩 나온다
const DIALOGUE_BOX = { x: 140, y: 730, w: 1640, h: 300 };
const DIALOGUE_CPS = 40; // 초당 글자 수
// 해금 카드
const UNLOCK_CARD = { w: 600, h: 620, y: 190 };
// 도감: 탭 3개(몬스터, 조합식, 기록). 스크롤 없이 칸으로 나누고 넘치면 쪽을 넘긴다. 표(MONSTERS, MONSTER_RECIPES)를 읽어 그린다
const COL_TABS = [{ key: 'monster', label: '몬스터', icon: 'summon' }, { key: 'recipe', label: '조합식', icon: 'book' }]; // 기록은 본부의 고블린 비서(js/ui/hq.js)
const COL_TOP = 206; // 내용이 시작하는 높이
const COL_MON = { cols: 4, rows: 3, w: 196, h: 206, gap: 20, x: 76 }; // 몬스터 칸(오른쪽은 상세 창)
const COL_DETAIL = { x: 960, y: 196, w: 890, h: 690 }; // 도감 상세 창(마우스를 올린 몬스터)
const COL_RECIPE = { cols: 2, rows: 6, w: 860, h: 100, gap: 16 }; // 조합식 줄
const WIPE_ARM_TIME = 4; // 기록 지우기를 한 번 누른 뒤 두 번째 누름을 기다리는 시간(초)

const UI = {
    mouse: { x: 0, y: 0 },
    buttons: [],
    hoverCell: null,
    selectedMonster: null,
    tab: 'monster', // 하단 바 탭: 'monster' 소환과 맵 몬스터 수, 'demon' 마왕 스킬
    press: null, // 몬스터를 누른 순간: { src, x, y }. DRAG_START 넘게 움직이면 drag가 된다
    drag: null, // 끄는 중: { src, type, x, y }. src는 { monster }
    dropTarget: null, // 끄는 동안 손가락 아래 놓을 곳(미리보기용)
    returning: [], // 놓지 못해 제자리로 날아가는 그림
    equipPress: null, // 보관함 칸을 누른 순간: { index, id, x, y }. DRAG_START 넘게 움직이면 equipDrag가 된다
    equipDrag: null, // 장비를 끄는 중: { index, id, x, y }
    equipTarget: null, // 장비를 끄는 동안 손가락 아래 몬스터
    popupEquipRect: null, // 팝업의 장비 칸(마우스를 올리면 설명)
    hoverCorpse: null,
    hoverButton: null,
    hpShown: null, // 왼쪽 아래 체력 막대에 보이는 체력. 제물로 오를 때는 천천히 차오르고, 깎일 때는 바로 줄어든다
    targeting: false,
    toast: null,
    corruptHintShown: false,
    pressed: null,
    mouseDown: false, // 누르고 있는 동안: 손가락 아래 버튼이 2px 내려앉는다
    hintKey: null, // 지금 보이는 안내 쪽지 종류
    hintCounts: {}, // 안내 쪽지 종류별로 나온 횟수(HINT_SHOWS까지만 보인다)
    loadout: null, // 선택 화면의 { lord, relics }. 처음 열 때 저장소에서 읽고, 다시 시작해도 남는다
    collection: null, // 열린 도감: { tab: 'monster' | 'recipe', page }. 본부 서재, 스토리 지도, 선택 화면에서 연다
    stageId: null, // 고르기 화면과 이번 판의 스토리 스테이지(STAGES id). null이면 스토리 없는 판(시험 도구)
    storyPick: null, // 스토리 지도에서 고른 스테이지 id
    dialogue: null, // 진행 중인 대화: { lines: [[인물, 대사]], index, chars, title, onDone }
    unlockCards: null, // 승리 뒤 해금 카드: { list: STAGES[].unlocks 항목들, index }
    afterRun: null, // 'pending'이면 스테이지 승리 뒤 승리 대화와 해금 카드를 아직 안 띄웠다
    wipeArmed: 0, // 기록 지우기를 한 번 누른 뒤 남은 시간. 0보다 크면 다음 누름에 지운다

    button(id, x, y, w, h, opts) {
        this.buttons.push(Object.assign({ id, x, y, w, h }, opts));
    },

    showToast(text, life) { this.toast = { text, age: 0, life: life || 1.6 }; },

    // 보관함 i번 칸의 화면 자리
    bagRect(i) {
        const col = i % BAG_COLS;
        const row = Math.floor(i / BAG_COLS);
        return { x: BAG_X + col * (BAG_SLOT + BAG_GAP), y: GAME_HEIGHT - BAR_H + 8 + row * (BAG_SLOT + BAG_GAP), w: BAG_SLOT, h: BAG_SLOT };
    },

    // 매 프레임 지금 눌릴 수 있는 버튼 목록을 다시 만든다
    layout() {
        this.buttons = [];
        const G = Game;
        if (this.dialogue) {
            this.button('dlg_skip', GAME_WIDTH - 260, 22, 220, 64, { label: '건너뛰기', icon: 'fast', size: 24, onClick: () => this.endDialogue() });
            return;
        }
        if (this.unlockCards) {
            const last = this.unlockCards.index >= this.unlockCards.list.length - 1;
            this.button('unlock_ok', GAME_WIDTH / 2 - 190, UNLOCK_CARD.y + UNLOCK_CARD.h + 40, 380, 96, {
                label: last ? '확인' : '다음', icon: 'lord', theme: 'gold', size: 34, onClick: () => this.nextUnlockCard()
            });
            return;
        }
        if (this.menuState() && this.collection) {
            this.layoutCollection();
            return;
        }
        if (G.state === 'title') {
            const label = Meta.data.cleared.length || Meta.data.runs ? '이어하기' : '시작하기';
            this.button('start', GAME_WIDTH / 2 - 210, 640, 420, 100, { label, icon: 'lord', theme: 'gold', size: 38, onClick: () => this.openHQ() });
            return;
        }
        if (G.state === 'hq') {
            this.layoutHQ(); // js/ui/hq.js
            return;
        }
        if (G.state === 'story') {
            this.layoutStoryMap();
            return;
        }
        if (G.state === 'select') {
            this.layoutSelect();
            return;
        }
        if (G.state === 'victory' || G.state === 'defeat') {
            this.layoutResult();
            return;
        }

        // 오른쪽 위 아이콘 버튼: 소리, 효과 줄이기, 일시정지, 배속. 켜진 쪽(소리 끔, 효과 줄임, 멈춤, 2배)은 밝은 은청색에 금테
        let bx = GAME_WIDTH - TOP_BTN - 12;
        const small = (id, icon, on, onClick, opts) => {
            this.button(id, bx, 12, TOP_BTN, TOP_BTN, Object.assign({ icon, iconOnly: true, on, onClick }, opts));
            bx -= TOP_BTN + 6;
        };
        small('mute', 'sound', Sfx.muted, () => { Sfx.setMuted(!Sfx.muted); saveSettings(); }, { slash: Sfx.muted, tip: Sfx.muted ? '소리 켜기 (M)' : '소리 끄기 (M)' });
        small('fx', 'gear', Fx.reduce, () => { Fx.reduce = !Fx.reduce; saveSettings(); }, { tip: Fx.reduce ? '효과 줄임 켜짐' : '효과 줄이기' });
        small('pause', 'pause', G.paused, () => { G.paused = !G.paused; }, { tip: G.paused ? '계속 (P)' : '일시정지 (P)' });
        small('speed', 'fast', G.speed > 1, () => { G.speed = G.speed % 3 + 1; }, { corner: `${G.speed}x`, tip: `배속 ${G.speed}x (F)` });

        // 보스 보상 3택: 카드만 누를 수 있다(소환, 끌기, 탭, 다음 라운드는 고른 뒤에)
        if (G.bossReward) {
            this.layoutBossReward();
            return;
        }

        // 하단 바: 탭 두 개, 탭에 따라 소환 버튼과 맵 몬스터 수나 마왕 스킬 슬롯, 다음 라운드
        const barY = GAME_HEIGHT - BAR_H;
        this.button('tab_monster', BAR_TAB_X, barY + 8, BAR_TAB_W, 52, { tab: 'monster', label: '몬스터', icon: 'summon', onClick: () => this.setTab('monster') });
        this.button('tab_demon', BAR_TAB_X, barY + 64, BAR_TAB_W, 52, { tab: 'demon', label: '마왕', icon: 'lord', onClick: () => this.setTab('demon') });
        const slotY = barY + 12;
        if (this.tab === 'monster') {
            const full = G.fieldFull();
            this.button('summon', BAR_SLOT_X, slotY, SUMMON_BTN_W, 104, {
                summonBtn: true, disabled: full || !G.canPaySummon(), full,
                onClick: () => this.doSummon()
            });
            const upCost = G.summonUpgradeCost();
            this.button('summonUp', BAR_SLOT_X + SUMMON_BTN_W + 10, slotY, UPGRADE_BTN_W, 104, {
                upgradeBtn: true, disabled: upCost === null || G.gold < upCost,
                onClick: () => this.doSummonUpgrade()
            });
        } else {
            // 스킬 칸 둘과 오른쪽의 유물 칸(2줄). 유물 칸이 늘면 스킬 칸이 좁아진다
            const relicW = this.barRelicWidth();
            const skillW = Math.floor((DEMON_TAB_END - BAR_SLOT_X - relicW - 20) / 2);
            this.button('lightning', BAR_SLOT_X, slotY, skillW, 104, { skill: 'lightning', onClick: () => this.toggleLightning() });
            this.button('roar', BAR_SLOT_X + skillW + 10, slotY, skillW, 104, { skill: 'roar', onClick: () => this.useRoar() });
            for (let i = 0; i < Meta.relicSlots(); i++) {
                const r = this.barRelicRect(i);
                this.button(`barRelic${i}`, r.x, r.y, r.w, r.h, { barRelic: i });
            }
        }
        // 보관함 칸: 누르고 끌면 장비 끌기(onDown). 그림은 drawBag이 하단 바와 함께 그린다
        for (let i = 0; i < EQUIP_RULES.slots; i++) {
            const r = this.bagRect(i);
            this.button(`bag${i}`, r.x, r.y, r.w, r.h, { bagSlot: i });
        }
        if (G.state === 'prep') {
            const bonus = G.waveIndex > 0 ? Math.floor(Math.max(0, G.prepTimer)) : 0;
            this.button('next', NEXT_BTN_X, NEXT_BTN_Y, NEXT_BTN_W, 92, {
                label: G.waveIndex === 0 ? '첫 라운드' : '다음 라운드', icon: 'wave', theme: 'gold', size: 30,
                sub: `${bonus > 0 ? `+${bonus}G · ` : ''}${Math.ceil(Math.max(0, G.prepTimer))}초 뒤 자동`,
                onClick: () => { G.startWave(); this.clearSelection(); }
            });
        } else if (G.state === 'wave' && G.waveIndex + 1 < G.waves.length) {
            // 라운드 중에도 다음 라운드를 불러 남은 시간만큼 골드를 받는다
            this.button('next', NEXT_BTN_X, NEXT_BTN_Y, NEXT_BTN_W, 92, {
                label: '다음 라운드', icon: 'wave', size: 30,
                sub: `+${Math.floor(G.roundTimer * COMBAT_RULES.earlyGoldPerSecond)}G · ${Math.ceil(G.roundTimer)}초 뒤 자동`,
                onClick: () => { G.nextRound(); }
            });
        }

        if (this.selectedMonster) this.layoutMonsterMenu();
    },

    // 마왕 탭의 유물 칸: 2줄로 쌓고 칸 수에 따라 열이 는다(보관함과 같은 52px 칸)
    barRelicWidth() {
        const cols = Math.ceil(Meta.relicSlots() / 2);
        return cols ? cols * BAG_SLOT + (cols - 1) * BAG_GAP : 0; // 칸이 없으면 스킬 칸이 넓어진다
    },

    barRelicRect(i) {
        const x0 = DEMON_TAB_END - this.barRelicWidth();
        const col = Math.floor(i / 2);
        const row = i % 2;
        // 1줄이면 스킬 칸(높이 104) 가운데에 맞춘다
        const rows = Math.min(2, Meta.relicSlots());
        const y0 = GAME_HEIGHT - BAR_H + Math.max(8, 12 + (104 - rows * BAG_SLOT - (rows - 1) * BAG_GAP) / 2);
        return { x: x0 + col * (BAG_SLOT + BAG_GAP), y: y0 + row * (BAG_SLOT + BAG_GAP), w: BAG_SLOT, h: BAG_SLOT };
    },

    // ----- 선택 화면 -----

    // 직전 선택을 저장소에서 읽는다. 읽지 못하거나(file://, 막힌 저장소) 값이 이상하면 기본 선택
    loadLoadout() {
        let raw = null;
        try {
            raw = JSON.parse(localStorage.getItem(LOADOUT_KEY) || 'null');
        } catch (e) { /* 기본 선택 사용 */ }
        return cleanLoadout(raw);
    },

    saveLoadout() {
        try {
            localStorage.setItem(LOADOUT_KEY, JSON.stringify(this.loadout));
        } catch (e) { /* 저장을 못 해도 이번 창에서는 선택이 남는다 */ }
    },

    // 도감을 열 수 있는 메뉴 화면(타이틀, 본부, 스토리 지도, 선택 화면)
    menuState() { return Game.state === 'title' || Game.state === 'hq' || Game.state === 'story' || Game.state === 'select'; },

    // 고르기 화면. stageId는 이번에 할 스토리 스테이지(없으면 스토리 없는 판). 직전 선택이 남아 있다(잠긴 마왕과 유물은 기본값으로)
    openSelect(stageId) {
        this.stageId = hasStage(stageId) ? stageId : null;
        this.loadout = cleanLoadout(this.loadout || this.loadLoadout());
        this.collection = null;
        this.cancel();
        this.returning = [];
        Game.state = 'select';
        Game.paused = false;
    },

    // ----- 스토리 -----

    // 스토리 지도. 고른 도장은 아직 안 깬 첫 열린 스테이지(다 깼으면 방금 한 스테이지나 마지막 스테이지)
    openStoryMap() {
        this.collection = null;
        this.dialogue = null;
        this.unlockCards = null;
        this.afterRun = null;
        this.cancel();
        this.returning = [];
        Game.clearField();
        Game.state = 'story';
        Game.paused = false;
        const fresh = STAGES.find(st => Meta.isOpen(st.id) && !Meta.isCleared(st.id));
        this.storyPick = (fresh || stageDef(this.stageId) || STAGES[STAGES.length - 1]).id;
    },

    stampRect(stage) {
        return { x: stage.map[0] - STAMP_R - 6, y: stage.map[1] - STAMP_R - 6, w: STAMP_R * 2 + 12, h: STAMP_R * 2 + 12 };
    },

    layoutStoryMap() {
        this.button('collection', 60, 22, 200, 68, { label: '도감', icon: 'book', size: 28, onClick: () => this.openCollection() });
        this.button('map_close', GAME_WIDTH - 260, 22, 200, 68, { label: '본부로', icon: 'close', size: 26, onClick: () => this.openHQ() });
        for (const st of STAGES) {
            const r = this.stampRect(st);
            this.button(`stage_${st.id}`, r.x, r.y, r.w, r.h, { stamp: st.id, onClick: () => this.pickStage(st.id) });
        }
        const pick = stageDef(this.storyPick);
        const I = STORY_INFO;
        const again = pick && Meta.isCleared(pick.id);
        this.button('stage_go', I.x + I.w - 400, I.y + 66, 360, 120, {
            label: again ? '다시 하기' : '출전', icon: 'attack', theme: 'gold', size: 40, disabled: !pick || !Meta.isOpen(pick.id),
            sub: again ? '해금은 처음 깰 때만' : null, onClick: () => this.goStage()
        });
    },

    // 지도에서 도장을 누른다. 잠긴 스테이지는 열리는 조건을 알린다
    pickStage(id) {
        if (!Meta.isOpen(id)) {
            const i = STAGES.findIndex(st => st.id === id);
            this.showToast(`스테이지 ${STAGES[i - 1].no}을(를) 깨면 열립니다.`);
            Sfx.play('mergeFail');
            return;
        }
        this.storyPick = id;
    },

    // 지도에서 열린 스테이지를 하나씩 옮겨 고른다(좌우 화살표)
    stepStagePick(step) {
        const open = STAGES.filter(st => Meta.isOpen(st.id));
        const i = open.findIndex(st => st.id === this.storyPick);
        const next = open[clamp(i + step, 0, open.length - 1)];
        if (next) this.storyPick = next.id;
    },

    goStage() {
        if (this.storyPick && Meta.isOpen(this.storyPick)) this.enterStage(this.storyPick);
    },

    // 스테이지 시작: 시작 전 대화 → 고르기(고를 것이 없으면 건너뛰고 바로 판)
    enterStage(id) {
        const st = stageDef(id);
        if (!st || !Meta.isOpen(id)) return false;
        this.stageId = id;
        this.storyPick = id;
        this.collection = null;
        this.unlockCards = null;
        this.afterRun = null;
        this.cancel();
        Game.clearField();
        Game.state = 'story';
        Game.paused = false;
        this.startDialogue(st.intro, `${st.no}. ${st.name}`, () => this.prepareStage(id));
        return true;
    },

    // 고르기 화면을 건너뛸지: 쓸 수 있는 마왕이 하나이고 고를 유물이 없으면(칸이 0이거나 풀린 유물이 없으면)
    canSkipSelect() {
        return Meta.lordsOwned().length <= 1 && (Meta.relicSlots() === 0 || Meta.relicsOwned().length === 0);
    },

    // 대화가 끝난 뒤나 다시 도전: 고르기 화면, 또는 고를 것이 없으면 바로 판을 시작한다
    prepareStage(id) {
        if (this.canSkipSelect()) {
            this.stageId = id;
            this.loadout = cleanLoadout(this.loadout || this.loadLoadout());
            this.startGame();
        } else {
            this.openSelect(id);
        }
    },

    // 대화 시작. lines: [[인물, 대사]]. 끝나거나 건너뛰면 onDone
    startDialogue(lines, title, onDone) {
        this.dialogue = { lines: lines || [], index: 0, chars: 0, title: title || '', onDone };
        if (!this.dialogue.lines.length) this.endDialogue();
    },

    // 클릭이나 Space: 글자가 다 나오지 않았으면 끝까지, 다 나왔으면 다음 줄. 마지막 줄 뒤에는 끝낸다
    advanceDialogue() {
        const D = this.dialogue;
        if (!D) return;
        const text = D.lines[D.index][1];
        if (D.chars < text.length) {
            D.chars = text.length;
            return;
        }
        D.index++;
        D.chars = 0;
        if (D.index >= D.lines.length) this.endDialogue();
    },

    // 대화 끝(Esc 건너뛰기도 여기로)
    endDialogue() {
        const D = this.dialogue;
        this.dialogue = null;
        if (D && D.onDone) D.onDone();
    },

    // 스테이지 승리 뒤: 승리 대화 → 처음 깼으면 해금 카드 → 결과 화면
    startOutro() {
        this.afterRun = null;
        const st = stageDef(Game.stage);
        this.cancel();
        this.startDialogue(st ? st.outro : [], st ? `${st.no}. ${st.name}` : '', () => this.showUnlocks());
    },

    showUnlocks() {
        const res = Game.runResult;
        this.unlockCards = res && res.firstClear && res.unlocks.length ? { list: res.unlocks.slice(), index: 0 } : null;
        if (this.unlockCards) Sfx.play('hidden');
    },

    nextUnlockCard() {
        const C = this.unlockCards;
        if (!C) return;
        C.index++;
        if (C.index >= C.list.length) this.unlockCards = null;
        else Sfx.play('upgrade');
    },

    // 결과 화면: 스테이지 승리는 다음 스테이지와 본부, 패배는 다시 도전과 본부. 스토리 없는 판은 다시 시작(고르기 화면)
    layoutResult() {
        const G = Game;
        const cx = GAME_WIDTH / 2;
        const win = G.state === 'victory';
        if (!G.stage) {
            this.button('retry', cx - 210, 770, 420, 90, {
                label: win ? '다시 도전' : '첫 라운드부터 다시', icon: 'retry', theme: 'gold', size: 30, onClick: () => this.openSelect(null)
            });
            return;
        }
        const next = nextStage(G.stage);
        const hasNext = win && next && Meta.isOpen(next.id);
        if (hasNext) {
            this.button('next_stage', cx - 420, 770, 410, 90, { label: '다음 스테이지', icon: 'attack', theme: 'gold', size: 30, sub: `${next.no}. ${next.name}`, onClick: () => this.enterStage(next.id) });
        } else if (!win) {
            this.button('retry', cx - 420, 770, 410, 90, { label: '다시 도전', icon: 'retry', theme: 'gold', size: 30, onClick: () => this.prepareStage(G.stage) });
        }
        const solo = win && !hasNext;
        this.button('to_hq', solo ? cx - 205 : cx + 10, 770, 410, 90, { label: '본부로', icon: 'lord', theme: solo ? 'gold' : null, size: 30, onClick: () => this.openHQ() });
    },

    // 결과 화면의 Space·Enter: 주요 버튼(다음 스테이지, 다시 도전, 본부)
    resultPrimary() {
        this.layout();
        const b = ['next_stage', 'retry', 'to_hq'].map(id => this.buttons.find(x => x.id === id)).find(Boolean);
        if (b) b.onClick();
    },

    // 마왕 카드 i번의 자리와 유물 격자 칸
    lordCardRect(i) {
        const n = Object.keys(DEMON_LORDS).length;
        const x0 = (GAME_WIDTH - (n * LORD_CARD_W + (n - 1) * LORD_CARD_GAP)) / 2;
        return { x: x0 + i * (LORD_CARD_W + LORD_CARD_GAP), y: LORD_CARD_Y, w: LORD_CARD_W, h: LORD_CARD_H };
    },

    relicCellRect(i) {
        const col = i % RELIC_COLS;
        const row = Math.floor(i / RELIC_COLS);
        return { x: RELIC_GRID_X + col * (RELIC_CELL + RELIC_GAP), y: RELIC_GRID_Y + row * (RELIC_CELL + RELIC_GAP), w: RELIC_CELL, h: RELIC_CELL };
    },

    pickedRect(i) {
        return { x: PICKED_X + i * (RELIC_CELL + RELIC_GAP), y: RELIC_GRID_Y, w: RELIC_CELL, h: RELIC_CELL };
    },

    layoutSelect() {
        this.button('collection', 60, 22, 200, 68, { label: '도감', icon: 'book', size: 28, onClick: () => this.openCollection() });
        if (this.stageId) this.button('select_back', 280, 22, 200, 68, { label: '지도로', icon: 'close', size: 26, onClick: () => this.openStoryMap() });
        Object.keys(DEMON_LORDS).forEach((id, i) => {
            const r = this.lordCardRect(i);
            this.button(`lord_${id}`, r.x, r.y, r.w, r.h, { lordCard: id, locked: !Meta.hasLord(id), onClick: () => this.pickLord(id) });
        });
        Object.keys(RELICS).forEach((id, i) => {
            const r = this.relicCellRect(i);
            this.button(`relic_${id}`, r.x, r.y, r.w, r.h, { relicId: id, locked: !Meta.hasRelic(id), onClick: () => this.toggleRelic(id) });
        });
        // 고른 유물 칸: 풀린 칸, 그 뒤는 잠긴 칸(풀리는 스테이지 번호). 모두 Meta.maxSlots()칸
        for (let i = 0; i < Meta.maxSlots(); i++) {
            const r = this.pickedRect(i);
            if (i < Meta.relicSlots()) {
                const id = this.loadout.relics[i];
                this.button(`picked${i}`, r.x, r.y, r.w, r.h, { pickedSlot: i, onClick: () => { if (id) this.toggleRelic(id); } });
            } else {
                this.button(`slotLocked${i}`, r.x, r.y, r.w, r.h, { lockedSlot: i + 1, onClick: () => this.showToast(`유물 칸 ${i + 1}번째: ${this.unlockText('slot', i + 1)}`) });
            }
        }
        const st = stageDef(this.stageId);
        this.button('begin', GAME_WIDTH - 440, GAME_HEIGHT - 150, 380, 100, {
            label: '시작', icon: 'lord', sub: st ? `${st.no}. ${st.name}` : DEMON_LORDS[this.loadout.lord].name, theme: 'gold', size: 40, onClick: () => this.beginRun()
        });
    },

    // 잠긴 항목이 풀리는 스테이지 글: "스테이지 N에서 해금"
    unlockText(kind, id) {
        const st = unlockStage(kind, id);
        return st ? `스테이지 ${st.no}에서 해금` : '잠김';
    },

    // 마왕 카드를 누른다. 잠긴 마왕은 풀리는 스테이지를 알린다
    pickLord(id) {
        if (!DEMON_LORDS[id]) return;
        if (!Meta.hasLord(id)) {
            this.showToast(`${DEMON_LORDS[id].name}: ${this.unlockText('lord', id)}`);
            Sfx.play('mergeFail');
            return;
        }
        this.loadout.lord = id;
    },

    // 유물을 누르면 넣고, 고른 유물을 다시 누르면 뺀다. 칸이 1개면 다른 유물로 바꾸고, 여러 칸이 다 차면 알린다.
    // 잠긴 유물과 칸이 없을 때는 풀리는 스테이지를 알린다
    toggleRelic(id) {
        if (!Meta.hasRelic(id)) {
            this.showToast(`${RELICS[id].name}: ${this.unlockText('relic', id)}`);
            Sfx.play('mergeFail');
            return;
        }
        const list = this.loadout.relics;
        const slots = Meta.relicSlots();
        const at = list.indexOf(id);
        if (at >= 0) list.splice(at, 1);
        else if (list.length < slots) list.push(id);
        else if (slots === 1) list.splice(0, 1, id);
        else if (slots === 0) {
            this.showToast(`유물 칸은 ${this.unlockText('slot', 1)}됩니다.`);
            Sfx.play('mergeFail');
        } else {
            this.showToast('유물 칸이 가득 찼습니다. 고른 유물을 다시 눌러 빼세요.');
            Sfx.play('mergeFail');
        }
    },

    // ----- 도감 -----

    openCollection() {
        this.collection = { tab: 'monster', page: 0 };
        this.wipeArmed = 0;
    },

    closeCollection() {
        this.collection = null;
        this.wipeArmed = 0;
    },

    setCollectionTab(tab) {
        this.collection = { tab, page: 0 };
        this.wipeArmed = 0;
    },

    // 탭의 쪽 수(칸에 다 들어가면 1)
    collectionPages(tab) {
        if (tab === 'monster') return Math.max(1, Math.ceil(Object.keys(MONSTERS).length / (COL_MON.cols * COL_MON.rows)));
        if (tab === 'recipe') return Math.max(1, Math.ceil(MONSTER_RECIPES.length / (COL_RECIPE.cols * COL_RECIPE.rows)));
        return 1;
    },

    turnCollectionPage(step) {
        const C = this.collection;
        C.page = clamp(C.page + step, 0, this.collectionPages(C.tab) - 1);
    },

    // 이번 쪽에 보일 항목과 칸 자리: [{ item, x, y, w, h }]. item은 몬스터 id 또는 조합식
    collectionCells() {
        const C = this.collection;
        const grid = C.tab === 'monster' ? COL_MON : COL_RECIPE;
        const list = C.tab === 'monster' ? Object.keys(MONSTERS) : MONSTER_RECIPES;
        const per = grid.cols * grid.rows;
        const x0 = grid.x !== undefined ? grid.x : (GAME_WIDTH - (grid.cols * grid.w + (grid.cols - 1) * grid.gap)) / 2;
        return list.slice(C.page * per, C.page * per + per).map((item, i) => ({
            item,
            x: x0 + (i % grid.cols) * (grid.w + grid.gap),
            y: COL_TOP + Math.floor(i / grid.cols) * (grid.h + grid.gap),
            w: grid.w, h: grid.h
        }));
    },

    layoutCollection() {
        const C = this.collection;
        COL_TABS.forEach((t, i) => {
            this.button(`col_tab_${t.key}`, GAME_WIDTH / 2 - 340 + i * 230, 30, 220, 64, {
                tab: 'collection', on: C.tab === t.key, label: t.label, icon: t.icon, onClick: () => this.setCollectionTab(t.key)
            });
        });
        this.button('col_close', GAME_WIDTH - 230, 28, 180, 68, { label: '닫기', icon: 'close', size: 26, onClick: () => this.closeCollection() });
        const pages = this.collectionPages(C.tab);
        if (pages > 1) {
            this.button('col_prev', GAME_WIDTH / 2 - 194, GAME_HEIGHT - 98, 64, 68, { arrow: 'left', disabled: C.page === 0, onClick: () => this.turnCollectionPage(-1) });
            this.button('col_next', GAME_WIDTH / 2 + 130, GAME_HEIGHT - 98, 64, 68, { arrow: 'right', disabled: C.page >= pages - 1, onClick: () => this.turnCollectionPage(1) });
        }
    },

    // 기록 지우기(본부 고블린 비서의 장부): 한 번 누르면 확인을 기다리고, WIPE_ARM_TIME 안에 한 번 더 누르면 지운다. 지운 뒤 바로 처음 상태로
    pressWipe() {
        if (this.wipeArmed <= 0) {
            this.wipeArmed = WIPE_ARM_TIME;
            return;
        }
        this.wipeArmed = 0;
        Meta.wipe();
        if (this.loadout) this.loadout = cleanLoadout(this.loadout);
        // 지도와 고르기 화면은 처음 상태에 맞춘다(고른 스테이지가 잠기면 첫 스테이지로)
        if (this.storyPick && !Meta.isOpen(this.storyPick)) this.storyPick = STAGES[0].id;
        if (this.stageId && !Meta.isOpen(this.stageId)) this.stageId = STAGES[0].id;
        this.showToast('기록을 지웠습니다. 처음 상태로 돌아갔습니다.', 2.4);
    },

    // 시작 버튼: 선택을 저장하고 그 마왕과 유물로 판을 시작한다
    beginRun() {
        this.loadout = cleanLoadout(this.loadout);
        this.saveLoadout();
        this.startGame();
    },

    popupOrigin(worldX, worldY, w, h) {
        const cx = worldX * WORLD_ZOOM;
        const cy = worldY * WORLD_ZOOM;
        // 칸 오른쪽을 우선으로, 화면 밖으로 나가면 왼쪽에 연다
        let x = cx + 64;
        if (x + w > GAME_WIDTH - 12) x = cx - 64 - w;
        const y = clamp(cy - h / 2, 80, GAME_HEIGHT - 130 - h);
        return { x, y };
    },

    // 지금 고른 몬스터: { type, loc }. 끄는 중이면 끄는 몬스터다
    focus() {
        if (this.drag) return { type: this.drag.type, loc: this.drag.src };
        if (this.selectedMonster) return { type: this.selectedMonster.type, loc: { monster: this.selectedMonster } };
        return null;
    },

    // 화면에 보여 줄 합치기 결과. a, b는 맵의 몬스터 개체(랭크 조건을 함께 판단한다).
    // 히든 조합식은 드러내지 않는다(등급 합치기가 되면 그것으로, 아니면 '???').
    // picked는 등급 합치기의 나머지 재료로 고른 몬스터(끄는 중이면 drag.extra)
    shownPlan(a, b, picked) {
        const plan = Game.mergePlanFor(a, b, picked);
        if (plan.kind !== 'recipe' || !plan.recipe.hidden) return plan;
        const grade = Game.mergePlanFor(a, b, picked, true);
        return grade.kind === 'grade' ? grade : { kind: 'unknown' };
    },

    // 합칠 수 없는 까닭의 안내 글. plan은 Game.mergePlanFor의 { kind: 'none', reason, grade, ... }, type은 끄는 몬스터
    mergeFailText(plan, type) {
        const g = MONSTER_GRADES[MONSTERS[type].grade];
        const target = plan.grade ? MONSTER_GRADES[plan.grade] : null;
        if (plan.reason === 'top') return `${g.name}은 최고 등급이라 더 합칠 수 없습니다.`;
        if (plan.reason === 'mismatch') return '등급이 다르고 조합식도 없어 합칠 수 없습니다.';
        if (plan.reason === 'count') return `같은 ${g.name} ${plan.count}마리가 있어야 합칩니다(지금 ${plan.have}마리).`;
        if (plan.reason === 'unique' && plan.sameKind) return '같은 신화는 맵에 1마리만 둘 수 있습니다.';
        if (plan.reason === 'unique' && target) return `${target.name} 몬스터는 맵에 ${target.fieldMax}마리만 둘 수 있습니다.`;
        return null;
    },

    // 끄는 동안 등급 합치기 나머지 재료 고르기: 끌기를 시작할 때 자동으로 정하고(랭크 낮음, 장비 없음, 가까움),
    // 같은 등급 몬스터 위로 올렸다가 다른 몬스터로 옮기면 먼저 올렸던 몬스터가 재료가 된다. 올린 몬스터가 재료였으면 다른 몬스터로 바꾼다
    updateMergePick() {
        const d = this.drag;
        const t = this.dropTarget && this.dropTarget.monster;
        if (!d || !t || t === d.src.monster || t === d.lastPick) return;
        const src = d.src.monster;
        if (MONSTERS[t.type].grade !== MONSTERS[src.type].grade) return;
        const need = MERGE_RULES.gradeCount - 2;
        let extra = d.extra.filter(m => m !== t && !m.removed);
        if (d.lastPick && !d.lastPick.removed && !extra.includes(d.lastPick)) extra.unshift(d.lastPick);
        extra = extra.slice(0, need);
        if (extra.length < need) extra = extra.concat(Game.mergeCandidates(src, [t, ...extra]).slice(0, need - extra.length));
        d.extra = extra;
        d.lastPick = t;
    },

    // 팝업 줄: 이름과 수치, 함께 합칠 수 있는 몬스터, 판매. 강화는 MONSTER_UPGRADE_ENABLED일 때만
    layoutMonsterMenu() {
        const f = this.selectedMonster;
        const type = f.type;
        const def = MONSTERS[type];
        const recipes = publicRecipesFor(type);
        const upgrades = MONSTER_UPGRADE_ENABLED && def.branches ? (f.tier === 1 ? 1 : (f.tier === 2 ? 2 : 0)) : 0;
        const w = 460;
        // 재료가 모이면 S랭크 전설의 창에만 뜨는 히든 조합 버튼. 찾기 전에는 이름을 숨긴다
        const full = Game.fullRecipePlan(f);
        const showFull = full.kind === 'recipe' || full.reason === 'unique';
        const h = (showFull ? POPUP_MERGE_H : 0) + POPUP_TOP + 166 + POPUP_RANK_H + POPUP_EQUIP_H + def.abilities.length * POPUP_ABILITY_H + (def.skills || []).length * POPUP_SKILL_H + 34 + recipes.length * 50 + 40 + POPUP_SACRIFICE_H + upgrades * 88 + POPUP_MERGE_H + 64;
        const o = this.popupOrigin(f.x, f.y, w, h);
        this.popup = { x: o.x, y: o.y, w, h, type, monster: f, recipes };
        // 장비 줄의 빼기 버튼(낀 장비가 있을 때). 자리는 drawPopup의 장비 줄과 같다
        if (f.equip) {
            this.button('unequip', o.x + w - 120, o.y + POPUP_TOP + 166 + POPUP_RANK_H + 8, 104, 56, {
                label: '빼기', icon: 'bag', size: 20,
                onClick: () => {
                    const res = Game.unequipMonster(f);
                    if (!res.ok && res.reason === 'full') this.showToast('보관함이 가득 차 뺄 수 없습니다.');
                }
            });
        }
        let y = o.y + h - 64 - POPUP_MERGE_H - upgrades * 88 - (showFull ? POPUP_MERGE_H : 0);
        if (upgrades === 1) {
            const cost = upgradeCost(f.type, 2);
            this.button('up2', o.x + 12, y, w - 24, 80, {
                upgrade: { name: '2단계 강화', desc: f.blocks ? '피해·체력 +50%' : '피해 +50%', cost },
                disabled: Game.gold < cost,
                onClick: () => { if (!Game.upgrade(f)) this.showToast('골드가 부족합니다.'); }
            });
            y += 88;
        } else if (upgrades === 2) {
            const cost = upgradeCost(f.type, 3);
            for (const key of ['A', 'B']) {
                const b = def.branches[key];
                this.button(`up3${key}`, o.x + 12, y, w - 24, 80, {
                    upgrade: { name: b.name, desc: b.desc, cost }, disabled: Game.gold < cost,
                    onClick: () => { if (!Game.upgrade(f, key)) this.showToast('골드가 부족합니다.'); }
                });
                y += 88;
            }
        }
        if (showFull) {
            const known = Meta.hasRecipe(full.recipe);
            this.button('fullRecipe', o.x + 12, y, w - 24, 52, {
                label: known ? `합치기 · ${MONSTERS[full.recipe.result].name}` : '??? 합치기', theme: 'gold', size: 24,
                onClick: () => {
                    const res = Game.act({ kind: 'fullRecipe', monster: f });
                    if (res.ok) { this.clearSelection(); return; }
                    this.showToast((res.plan && this.mergeFailText(res.plan, f.type)) || '합칠 수 없습니다.');
                    Sfx.play('mergeFail');
                }
            });
            y += POPUP_MERGE_H;
        }
        // 합치기: 같은 등급 gradeCount마리를 끌기와 같은 판단으로 골라 이 몬스터 칸에서 합친다(조합식은 보지 않는다)
        const quick = Game.quickMergePlan(f);
        const next = nextGrade(def.grade);
        this.button('quickMerge', o.x + 12, y, w - 24, 52, {
            label: next ? `합치기 · ${MONSTER_GRADES[def.grade].name} ${MERGE_RULES.gradeCount}마리 → ${MONSTER_GRADES[next].name}` : '합치기 · 최고 등급',
            size: 22, disabled: quick.kind === 'none',
            onClick: () => {
                const res = Game.act({ kind: 'quickMerge', monster: f });
                if (res.ok) { this.clearSelection(); return; }
                this.showToast((res.plan && this.mergeFailText(res.plan, f.type)) || '합칠 수 없습니다.');
                Sfx.play('mergeFail');
            }
        });
        y += POPUP_MERGE_H;
        this.button('sell', o.x + 12, y, w - 24, 52, {
            label: `판매 +${Game.sellValue(type)}`, icon: 'gold', theme: 'danger', size: 24,
            onClick: () => {
                Game.act({ kind: 'sell', monster: f });
                this.clearSelection();
            }
        });
    },

    // 보스 보상 카드 3장을 가운데에 나란히 놓는다. 맵에 세울 수 없는 몬스터 카드는 꺼 둔다
    layoutBossReward() {
        const cards = Game.bossReward.cards;
        const total = cards.length * REWARD_CARD_W + (cards.length - 1) * REWARD_CARD_GAP;
        const x0 = (GAME_WIDTH - total) / 2;
        cards.forEach((card, i) => {
            const disabled = !Game.canTakeReward(card);
            this.button(`reward${i}`, x0 + i * (REWARD_CARD_W + REWARD_CARD_GAP), REWARD_CARD_Y, REWARD_CARD_W, REWARD_CARD_H, {
                reward: card, index: i, disabled, onClick: () => this.pickReward(i)
            });
        });
    },

    // 카드 클릭과 1, 2, 3 키
    pickReward(i) {
        const res = Game.pickBossReward(i);
        if (res.ok) return res;
        if (res.reason === 'full') this.showToast('몬스터를 놓을 자리가 없습니다. 골드를 고르세요.');
        else if (res.reason === 'bagFull') this.showToast('보관함이 가득 찼습니다. 다른 카드를 고르세요.');
        Sfx.play('mergeFail');
        return res;
    },

    clearSelection() {
        this.selectedMonster = null;
        this.popup = null;
        this.popupEquipRect = null;
    },

    // 우클릭과 Esc: 끌기, 번개 조준, 몬스터 선택을 모두 끈다
    cancel() {
        this.clearSelection();
        this.cancelDrag();
        this.cancelEquipDrag();
        this.targeting = false;
    },

    cancelEquipDrag() {
        this.equipPress = null;
        this.equipDrag = null;
        this.equipTarget = null;
    },

    // 장비를 놓을 몬스터: 놓은 칸 또는 길로 나간 곳. 하단 바와 버튼 위는 없음
    equipTargetAt(x, y) {
        if (y > GAME_HEIGHT - BAR_H || this.buttonAt(x, y)) return null;
        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        return Game.monsterAt(Math.floor(wx / TILE), Math.floor((wy - MAP_TOP) / TILE)) || Game.monsterNear(wx, wy);
    },

    // 끈 장비를 놓는다: 몬스터 위면 끼우고(끼고 있으면 맞바꾼다), 아니면 보관함에 그대로 남는다
    dropEquip(x, y) {
        const d = this.equipDrag;
        const m = this.equipTargetAt(x, y);
        if (!m) {
            if (y <= GAME_HEIGHT - BAR_H) {
                this.showToast('장비는 맵의 몬스터 위에 놓아야 끼웁니다.');
                Sfx.play('mergeFail');
            }
            return null;
        }
        const res = Game.equipMonster(m, d.index);
        if (res.ok && res.swapped) this.showToast(`맞바꿨습니다. ${EQUIPMENT[res.swapped].name}은(는) 보관함으로 돌아갔습니다.`, 2.2);
        return res;
    },

    cancelDrag() {
        this.press = null;
        this.drag = null;
        this.dropTarget = null;
        this.hoverCell = null;
    },

    // 저장한 판 이어하기(본부 버튼)
    resumeRun() {
        const d = Game.readRunSave();
        if (!d) return false;
        this.stageId = d.stage || null;
        this.loadout = { lord: d.lord, relics: d.relics || [] };
        this.startGame(true);
        return Game.loadRun(d);
    },

    startGame(keepSave) {
        if (!keepSave) Game.clearRunSave();
        Game.reset(this.loadout || cleanLoadout(null), this.stageId);
        this.afterRun = Game.stage ? 'pending' : null; // 스테이지를 이기면 승리 대화와 해금 카드
        this.dialogue = null;
        this.unlockCards = null;
        Game.speed = 1;
        this.cancel();
        this.returning = [];
        this.tab = 'monster';
        this.hpShown = null; // 체력 막대는 고른 마왕의 최대 체력으로 바로 찬다
        this.hintKey = null;
    },

    setTab(tab) {
        if (this.tab === tab) return;
        this.tab = tab;
        if (tab !== 'monster') this.cancelDrag();
        if (tab !== 'demon') this.targeting = false;
    },

    // 소환 버튼과 S 키
    doSummonUpgrade() {
        const res = Game.act({ kind: 'upgradeSummon' });
        if (!res.ok) {
            if (res.reason === 'gold') this.showToast(`소환 강화에 ${Game.summonUpgradeCost()}G가 필요합니다.`);
            else if (res.reason === 'max') this.showToast('소환 강화가 최고 단계입니다.');
            Sfx.play('mergeFail');
        }
        return res;
    },

    doSummon() {
        this.setTab('monster');
        const res = Game.summon();
        if (res.ok) {
            this.targeting = false;
            return res;
        }
        if (res.reason === 'full') this.showToast('몬스터를 더 놓을 자리가 없습니다. 합쳐서 자리를 만드세요.');
        else if (res.reason === 'gold') this.showToast(`소환에는 ${Game.summonCost()}골드가 필요합니다.`);
        Sfx.play('mergeFail');
        return res;
    },

    // 끄는 몬스터를 (col, row) 칸에 놓을 수 있는지. 맵의 몬스터는 자기 칸으로 돌아가는 것도 된다(아무 일 없음)
    canPlaceAt(col, row) {
        if (!this.drag) return false;
        const src = this.drag.src;
        if (src.monster && src.monster.col === col && src.monster.row === row) return true;
        return Game.canPlace(this.drag.type, col, row, src.monster ? [src.monster] : null);
    },

    // 화면 좌표 아래 놓을 곳: { throne } | { monster } | { cell: {col, row} } | null(하단 바 등)
    dropAt(x, y) {
        const b = this.buttonAt(x, y);
        if (b || y > GAME_HEIGHT - BAR_H) return null;
        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        if (Game.onThrone(wx, wy)) return { throne: true };
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        const m = Game.monsterAt(col, row) || Game.monsterNear(wx, wy);
        // 큰 몬스터를 자기 칸 위로 조금 옮길 때는 자기 자신이 아니라 칸에 놓는 것이다
        const self = this.drag && this.drag.src.monster === m;
        if (m && !self) return { monster: m };
        return { cell: { col, row } };
    },

    // 놓으면 일어날 일(미리보기와 실제 처리가 같이 쓴다)
    //   sacrifice: 왕좌에 바치기 / merge: 합치기(plan은 화면용) / place: 칸으로 옮기기 / back: 제자리 / invalid: 놓을 수 없음(reason)
    dropAction(t) {
        const d = this.drag;
        if (!d || !t) return { action: 'back' };
        const src = d.src;
        if (t.throne) return { action: 'sacrifice', gain: Game.sacrificeGain(src.monster) };
        if (t.monster) {
            const loc = { monster: t.monster };
            if (Game.sameLoc(src, loc)) return { action: 'back' };
            const plan = this.shownPlan(src.monster, loc.monster, d.extra);
            const real = Game.mergePlanFor(src.monster, loc.monster, d.extra);
            if (real.kind === 'none') return { action: 'invalid', loc, reason: real.reason, plan, real };
            // materials: 사라지는 재료 전부(끄는 몬스터, 놓는 몬스터, 등급 합치기의 나머지)
            return { action: 'merge', loc, plan, real, materials: [src.monster, loc.monster, ...(real.extra || [])] };
        }
        const { col, row } = t.cell;
        if (src.monster.col === col && src.monster.row === row) return { action: 'back' };
        if (Game.canPlace(d.type, col, row, [src.monster])) return { action: 'place', col, row };
        let reason = 'cell';
        if (isPathCell(col, row)) reason = 'path';
        return { action: 'invalid', reason, col, row };
    },

    // 맵의 몬스터를 누른다. 떼는 순간 끌기인지 누르기인지 나눈다(onUp). 다른 곳은 바로 클릭으로 처리한다
    onDown(x, y, shift) {
        Sfx.unlock();
        this.mouseDown = true;
        this.onMove(x, y);
        this.layout();
        this.press = null;
        this.cancelEquipDrag();
        const b = this.buttonAt(x, y);
        const inGame = Game.inPlay() && !Game.bossReward && !this.dialogue && !this.unlockCards; // 보상을 고르는 동안 맵의 몬스터를 누르거나 끌지 않는다
        if (b && b.bagSlot !== undefined) {
            // 보관함 칸: 장비가 있으면 끌 준비(떼는 순간 끌기인지 누르기인지 나눈다)
            const id = Game.equipBag[b.bagSlot];
            if (id && inGame) {
                this.equipPress = { index: b.bagSlot, id, x, y };
                this.targeting = false;
            }
            return;
        }
        if (!b && inGame && !this.targeting) {
            const wx = x / WORLD_ZOOM;
            const wy = y / WORLD_ZOOM;
            const col = Math.floor(wx / TILE);
            const row = Math.floor((wy - MAP_TOP) / TILE);
            if (!this.corpseAt(wx, wy)) {
                const m = Game.monsterAt(col, row) || Game.monsterNear(wx, wy);
                if (m) {
                    this.press = { src: { monster: m }, x, y };
                    return;
                }
            }
        }
        this.onClick(x, y, shift);
    },

    onUp(x, y) {
        this.mouseDown = false;
        this.onMove(x, y);
        const press = this.press;
        const drag = this.drag;
        this.press = null;
        if (this.equipDrag) {
            this.dropEquip(x, y);
            this.cancelEquipDrag();
            return;
        }
        if (this.equipPress) {
            // 끌지 않고 뗐다: 끼우는 법을 알려 준다
            this.cancelEquipDrag();
            Sfx.play('click');
            this.showToast('장비를 맵의 몬스터 위로 끌어 놓으면 끼웁니다.');
            return;
        }
        if (drag) {
            this.drop(this.dropAt(x, y), x, y);
            this.cancelDrag();
            return;
        }
        if (!press) return;
        // 끌지 않고 뗐다: 누른 몬스터를 고른다. 같은 몬스터를 다시 누르면 닫는다
        Sfx.play('click');
        const m = press.src.monster;
        const again = this.selectedMonster === m;
        this.clearSelection();
        if (!again) this.selectedMonster = m;
    },

    drop(t, x, y) {
        const d = this.drag;
        const act = this.dropAction(t);
        if (act.action === 'sacrifice' && Game.act({ kind: 'sacrifice', monster: d.src.monster }).ok) return;
        if (act.action === 'merge') {
            const res = Game.act({ kind: 'merge', src: d.src.monster, dst: act.loc.monster, extra: d.extra });
            if (res.ok) return;
            act.action = 'invalid';
            act.reason = res.reason;
            act.real = res.plan;
        }
        if (act.action === 'place') {
            if (Game.act({ kind: 'move', monster: d.src.monster, col: act.col, row: act.row }).ok) return;
            act.action = 'invalid';
            act.reason = 'cell';
        }
        // 놓지 못했다: 안내하고 제자리로 날아간다
        if (act.action === 'invalid') {
            const msg = (act.real && this.mergeFailText(act.real, d.type)) || {
                path: '길에는 놓을 수 없습니다. 근접 몬스터도 길 옆에 놓으면 길로 걸어 나갑니다.',
                cell: '몬스터는 빛나는 길 옆 칸에만 놓을 수 있습니다.'
            }[act.reason] || '여기에는 놓을 수 없습니다.';
            this.showToast(msg);
            Sfx.play('mergeFail');
        }
        this.returning.push({ type: d.type, x, y, to: this.locScreen(d.src), age: 0, life: 0.22 });
    },

    // 자리의 화면 좌표(발끝): 놓은 칸
    locScreen(loc) {
        return { x: loc.monster.homeX * WORLD_ZOOM, y: (loc.monster.homeY + MONSTER_FOOT) * WORLD_ZOOM };
    },

    toggleLightning() {
        this.setTab('demon');
        if (Game.skills.lightning > 0) {
            this.showToast(`번개 재사용까지 ${Math.ceil(Game.skills.lightning)}초`);
            return;
        }
        this.targeting = !this.targeting;
        this.clearSelection();
    },

    useRoar() {
        this.setTab('demon');
        if (Game.roarLocked()) {
            this.showToast(`마왕 체력 ${COMBAT_RULES.roar.unlockHp} 이하에서 쓸 수 있습니다.`);
            return;
        }
        if (!castRoar()) this.showToast(`호통 재사용까지 ${Math.ceil(Game.skills.roar)}초`);
    },

    // 타락이 꺼져 있으면 시체는 누를 수 없는 장식이라 클릭과 끌기를 가로막지 않는다
    corpseAt(x, y) {
        if (!CORRUPTION_ENABLED) return null;
        for (const c of Game.corpses) {
            if (distance(x, y, c.x, c.y - 20) < 52) return c;
        }
        return null;
    },

    buttonAt(x, y) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
            const b = this.buttons[i];
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
        }
        return null;
    },

    onMove(x, y) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.hoverButton = this.buttonAt(x, y);
        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        this.hoverCorpse = this.hoverButton || this.drag ? null : this.corpseAt(wx, wy);
        if (this.press && !this.drag && distance(x, y, this.press.x, this.press.y) > DRAG_START) {
            const type = Game.typeAt(this.press.src);
            if (type && Game.inPlay()) {
                // extra: 등급 합치기의 나머지 재료(끌기를 시작할 때 자동으로 정해 강조한다. 놓을 몬스터까지 채울 수 없으면 비운다),
                // lastPick: 마지막으로 올린 같은 등급 몬스터
                const src = this.press.src.monster;
                const need = MERGE_RULES.gradeCount - 2;
                const cands = Game.mergeCandidates(src, []);
                this.drag = { src: this.press.src, type, extra: cands.length > need ? cands.slice(0, need) : [], lastPick: null };
                this.clearSelection();
                this.targeting = false;
                Sfx.play('pickup');
            }
            this.press = null;
        }
        const ep = this.equipPress;
        if (ep && !this.equipDrag && distance(x, y, ep.x, ep.y) > DRAG_START) {
            if (Game.inPlay() && !Game.bossReward && Game.equipBag[ep.index] === ep.id) {
                this.equipDrag = { index: ep.index, id: ep.id };
                this.clearSelection();
                this.targeting = false;
                Sfx.play('pickup');
            }
            this.equipPress = null;
        }
        if (this.equipDrag) {
            this.equipDrag.x = x;
            this.equipDrag.y = y;
            this.equipTarget = this.equipTargetAt(x, y);
        }
        if (!this.drag) { this.hoverCell = null; this.dropTarget = null; return; }
        if (!Game.inPlay()) { this.cancelDrag(); return; }
        this.drag.x = x;
        this.drag.y = y;
        this.dropTarget = this.dropAt(x, y);
        this.updateMergePick();
        this.hoverCell =this.dropTarget && this.dropTarget.cell && this.dropTarget.cell.col >= 0 && this.dropTarget.cell.row >= 0 ? this.dropTarget.cell : null;
    },

    // 버튼, 번개 조준, 타락, 빈 곳 누르기. 몬스터를 누르고 끄는 것은 onDown과 onUp이 맡는다
    onClick(x, y) {
        Sfx.unlock();
        this.layout();
        const b = this.buttonAt(x, y);
        if (b) {
            if (b.onClick) b.onClick();
            Sfx.play('click');
            return;
        }
        if (this.dialogue) { this.advanceDialogue(); return; } // 대화는 아무 곳이나 눌러 넘긴다
        const G = Game;
        if (!G.inPlay() || G.bossReward || this.unlockCards) return;

        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        if (this.targeting) {
            if (castLightning(wx, wy)) this.targeting = false;
            return;
        }
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        const corpse = this.corpseAt(wx, wy);
        if (corpse) {
            const res = corruptCorpse(corpse);
            if (!res.ok) this.showToast(res.reason === 'gold' ? `타락에는 ${corpse.cost}골드가 필요합니다.` : `타락 유닛은 층당 ${COMBAT_RULES.corruptMax}명까지입니다.`);
            this.corruptHintShown = true;
            return;
        }
        if (isBuildCell(col, row) && !G.monsterAt(col, row)) {
            this.clearSelection();
            this.setTab('monster');
            this.showToast(G.monsters.length ? '맵의 몬스터를 이 칸으로 끌어 옮길 수 있습니다.' : `소환(S, ${G.summonCost()}G)하면 몬스터가 길 옆 칸에 바로 나옵니다.`);
            return;
        }
        this.clearSelection();
    },

    onKey(code) {
        const G = Game;
        if (code === 'KeyM') { Sfx.setMuted(!Sfx.muted); saveSettings(); return; }
        if (this.dialogue) {
            // 대화: Space·Enter 다음(글자가 다 안 나왔으면 끝까지), Esc 건너뛰기
            if (code === 'Space' || code === 'Enter') this.advanceDialogue();
            else if (code === 'Escape') this.endDialogue();
            return;
        }
        if (this.unlockCards) {
            // 해금 카드: Space·Enter 다음, Esc 모두 넘기기
            if (code === 'Space' || code === 'Enter') this.nextUnlockCard();
            else if (code === 'Escape') this.unlockCards = null;
            return;
        }
        if (this.collection && this.menuState()) {
            // 도감: Esc 닫기(연 화면으로), 좌우 화살표로 쪽 넘기기, 1·2 탭
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
            const tab = m && COL_TABS[Number(m[1]) - 1];
            if (code === 'Escape') this.closeCollection();
            else if (code === 'ArrowLeft') this.turnCollectionPage(-1);
            else if (code === 'ArrowRight') this.turnCollectionPage(1);
            else if (tab) this.setCollectionTab(tab.key);
            return;
        }
        if (G.state === 'title') {
            if (code === 'Space' || code === 'Enter') this.openHQ();
            return;
        }
        if (G.state === 'hq') {
            this.onHqKey(code); // js/ui/hq.js
            return;
        }
        if (G.state === 'victory' || G.state === 'defeat') {
            if (code === 'Space' || code === 'Enter') this.resultPrimary();
            else if (code === 'Escape' && G.stage) this.openHQ();
            return;
        }
        if (G.state === 'story') {
            // 좌우 화살표로 열린 스테이지를 고르고 Space·Enter로 출전, Esc는 본부
            if (code === 'ArrowLeft') this.stepStagePick(-1);
            else if (code === 'ArrowRight') this.stepStagePick(1);
            else if (code === 'Space' || code === 'Enter') this.goStage();
            else if (code === 'Escape') this.openHQ();
            return;
        }
        if (G.state === 'select') {
            // 1, 2, 3으로 마왕을 고르고 Space나 Enter로 시작한다. Esc는 스토리 지도로
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
            const id = m && Object.keys(DEMON_LORDS)[Number(m[1]) - 1];
            if (id) this.pickLord(id);
            else if (code === 'Space' || code === 'Enter') this.beginRun();
            else if (code === 'Escape' && this.stageId) this.openStoryMap();
            return;
        }
        if (G.bossReward) {
            // 보상을 고르는 동안은 1, 2, 3(숫자 패드 포함)과 배속, 일시정지만 받는다
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
            if (m) this.pickReward(Number(m[1]) - 1);
            else if (code === 'KeyF') G.speed = G.speed % 3 + 1;
            else if (code === 'KeyP') G.paused = !G.paused;
            return;
        }
        if (code === 'Space') { if (G.state === 'wave') G.nextRound(); else G.startWave(); this.clearSelection(); }
        else if (code === 'KeyS') this.doSummon();
        else if (code === 'KeyU') this.doSummonUpgrade();
        else if (code === 'KeyQ') this.toggleLightning();
        else if (code === 'KeyW') this.useRoar();
        else if (code === 'Tab') this.setTab(this.tab === 'monster' ? 'demon' : 'monster');
        else if (code === 'KeyF') G.speed = G.speed % 3 + 1;
        else if (code === 'KeyP') G.paused = !G.paused;
        else if (code === 'Escape') this.cancel();
    },

    update(dt) {
        this.wipeArmed = Math.max(0, this.wipeArmed - dt);
        if (this.dialogue) {
            const D = this.dialogue;
            D.chars = Math.min(D.lines[D.index][1].length, D.chars + dt * DIALOGUE_CPS);
        }
        // 스테이지를 이겼다: 승리 대화 → 해금 카드(처음 깼을 때) → 결과 화면. 지면 다시 도전이나 지도
        if (this.afterRun === 'pending' && Game.state === 'victory') this.startOutro();
        else if (this.afterRun === 'pending' && Game.state === 'defeat') this.afterRun = null;
        if (this.toast) {
            this.toast.age += dt;
            if (this.toast.age > this.toast.life) this.toast = null;
        }
        // 장비 획득과 보관함 가득 알림(게임 쪽이 Fx.notice에 남긴다)
        if (Fx.notice) {
            this.showToast(Fx.notice, 2.4);
            Fx.notice = null;
        }
        if (this.selectedMonster && !Game.monsters.includes(this.selectedMonster)) this.clearSelection();
        // 보상 카드가 뜨면 끌기, 선택, 번개 조준을 끈다
        if (Game.bossReward && (this.drag || this.press || this.equipDrag || this.equipPress || this.selectedMonster || this.targeting)) this.cancel();
        // 끄는 장비가 보관함에서 사라지거나 판이 끝나면 끌기를 그만둔다
        const ed = this.equipDrag || this.equipPress;
        if (ed && (!Game.inPlay() || Game.equipBag[ed.index] !== ed.id)) this.cancelEquipDrag();
        // 끄는 몬스터가 맵에서 사라지면(판 종료 등) 끌기를 그만둔다
        if (this.drag && (!Game.inPlay() || !Game.typeAt(this.drag.src))) this.cancelDrag();
        // 체력 막대: 오를 때는 초당 6씩 차오르고, 깎이면 바로 맞춘다
        if (this.hpShown === null || Game.hp < this.hpShown || !Game.inPlay()) this.hpShown = Game.hp;
        else this.hpShown = Math.min(Game.hp, this.hpShown + dt * 6);
        this.updateHint();
        for (const r of this.returning) r.age += dt;
        this.returning = this.returning.filter(r => r.age < r.life);
        this.layout();
        this.hoverButton = this.buttonAt(this.mouse.x, this.mouse.y);
    },

    // 끄는 동안 등급 합치기 재료 표시(세계 좌표): 나머지 재료에 진한 고리, 재료끼리 결과 칸(놓을 몬스터, 없으면 손가락)으로 잇는 선.
    // 놓을 몬스터가 조합식이면 나머지 재료는 쓰지 않으니 그리지 않는다
    drawMergeMaterials(ctx) {
        const d = this.drag;
        const act = this.dropTarget ? this.dropAction(this.dropTarget) : null;
        if (act && act.action === 'merge' && act.real.kind === 'recipe') return;
        const target = act && act.loc && act.real && act.real.kind === 'grade' ? act.loc.monster : null;
        const extra = target ? act.real.extra : d.extra;
        const src = d.src.monster;
        const next = nextGrade(MONSTERS[src.type].grade);
        if (!extra.length || !next) return;
        const color = MONSTER_GRADES[next].color;
        const foot = m => (m.down > 0 || m === src ? { x: m.homeX, y: m.homeY + MONSTER_FOOT } : { x: m.x, y: m.y + MONSTER_FOOT });
        const end = target ? foot(target) : (d.x !== undefined ? { x: d.x / WORLD_ZOOM, y: d.y / WORLD_ZOOM + 30 } : foot(src));
        ctx.save();
        ctx.lineWidth = 5;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -Game.time * 60;
        for (const m of [src, ...extra]) {
            const p = foot(m);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        ctx.restore();
        for (const m of extra) {
            const p = foot(m);
            Render.mergeRing(ctx, p.x, p.y, color, true);
            Render.mergeRing(ctx, p.x, p.y, '#ffffff', false);
        }
        // 끌기 시작한 칸에도 재료 고리
        Render.mergeRing(ctx, src.homeX, src.homeY + MONSTER_FOOT, color, false);
    },

    // 세계 위에 깔리는 표시: 끄는 동안 놓을 칸 미리보기(반투명 그림, 사거리, 나갈 지점), 합칠 수 있는 몬스터 발밑 고리,
    // 고른 몬스터의 사거리
    drawRanges(ctx) {
        // 장비를 끄는 동안: 끼울 수 있는 몬스터 발밑을 살짝 밝히고, 놓으려는 몬스터는 진하게
        if (this.equipDrag) {
            const color = MONSTER_GRADES[EQUIPMENT[this.equipDrag.id].grade].light;
            for (const m of Game.monsters) {
                if (m.reveal > 0) continue;
                const down = m.down > 0;
                Render.mergeRing(ctx, down ? m.homeX : m.x, (down ? m.homeY : m.y) + MONSTER_FOOT, color, this.equipTarget === m);
            }
        }
        // 끄는 동안 왕좌에 제물 표시
        if (this.drag) Render.sacrificeMark(ctx, !!(this.dropTarget && this.dropTarget.throne));
        const cell = this.drag && this.hoverCell;
        if (cell) {
            const ok = this.canPlaceAt(cell.col, cell.row);
            const type = this.drag.type;
            const def = MONSTERS[type];
            const ghost = { x: tileX(cell.col), y: tileY(cell.row), dir: 'down', atkPose: 0, anim: 0 };
            const color = ok ? 'rgba(255,224,138,1)' : 'rgba(255,90,110,1)';
            if (monsterBlocks(type)) {
                // 막는 몬스터는 걸어 나가 설 길 지점과 그곳의 붙잡는 범위를 보여 준다
                const r = rallyPoint(cell.col, cell.row);
                if (ok) this.drawRallyPath(ctx, ghost.x, ghost.y + MONSTER_FOOT, r.x, r.y + 10);
                Render.rangeRing(ctx, r.x, r.y + 10, def.stats.range * TILE, color);
            } else {
                Render.rangeRing(ctx, ghost.x, ghost.y, def.stats.range * TILE, color);
            }
            if (ok) this.drawAuraRanges(ctx, type, ghost.x, ghost.y);
            const { clip, name } = Render.monsterFrame(def, ghost);
            ctx.save();
            ctx.globalAlpha = ok ? 0.6 : 0.3;
            Render.monsterBody(ctx, def, ghost, Assets.get(name), clip); // drawMonster와 같은 위치와 배율
            ctx.restore();
        }
        const focus = this.focus();
        if (focus) {
            // 합칠 수 있는 맵의 몬스터: 발밑에 고리. 놓으려는 대상은 더 밝게
            const target = this.drag && this.dropTarget && this.dropTarget.monster;
            const picked = this.drag ? this.drag.extra : null;
            for (const m of Game.monsters) {
                if (focus.loc.monster === m || m.reveal > 0) continue;
                const plan = this.shownPlan(focus.loc.monster, m, picked);
                if (plan.kind === 'none' || plan.kind === 'unknown') continue;
                Render.mergeRing(ctx, m.homeX, m.homeY + MONSTER_FOOT, plan.kind === 'recipe' ? '#ffd76a' : MONSTER_GRADES[plan.grade].color, target === m);
                // 길로 걸어 나간 몬스터도 서 있는 곳에 고리를 그린다
                if (m.blocks && distance(m.x, m.y, m.homeX, m.homeY) > 20 && m.down <= 0) {
                    Render.mergeRing(ctx, m.x, m.y + MONSTER_FOOT, plan.kind === 'recipe' ? '#ffd76a' : MONSTER_GRADES[plan.grade].color, target === m);
                }
            }
            if (this.drag) this.drawMergeMaterials(ctx);
        }
        const f = this.selectedMonster;
        if (f) {
            if (f.blocks) {
                this.drawRallyPath(ctx, f.homeX, f.homeY + MONSTER_FOOT, f.rally.x, f.rally.y + MONSTER_FOOT);
                Render.rangeRing(ctx, f.rally.x, f.rally.y + MONSTER_FOOT, monsterStats(f).range * TILE, 'rgba(255,224,138,1)');
            } else {
                Render.rangeRing(ctx, f.x, f.y, monsterStats(f).range * TILE, 'rgba(255,224,138,1)');
            }
            this.drawAuraRanges(ctx, f.type, f.x, f.y);
        }
    },

    // 오라 범위: 고른 몬스터(또는 끄는 몬스터)에만 오라 종류 색의 원을 그린다
    drawAuraRanges(ctx, type, x, y) {
        const colors = { heal: 'rgba(120,255,150,1)', damage: 'rgba(255,110,90,1)', attackSpeed: 'rgba(255,220,90,1)' };
        for (const a of monsterAbilities(type, 'aura')) Render.rangeRing(ctx, x, y, a.radius * TILE, colors[a.stat]);
    },

    // 놓은 칸에서 걸어 나갈 길 지점까지 점선과, 그 지점의 깃발 표시
    drawRallyPath(ctx, x0, y0, x1, y1) {
        ctx.save();
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -Game.time * 40;
        ctx.strokeStyle = 'rgba(255,183,107,0.9)';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,183,107,0.35)';
        ctx.beginPath();
        ctx.ellipse(x1, y1, 26, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb76b';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#3a2214';
        ctx.fillRect(x1 - 2, y1 - 40, 4, 40);
        ctx.fillStyle = '#ffb76b';
        ctx.beginPath();
        ctx.moveTo(x1 + 2, y1 - 40);
        ctx.lineTo(x1 + 24, y1 - 32);
        ctx.lineTo(x1 + 2, y1 - 24);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    // 버튼 상태: 마우스를 올림, 누르는 중(2px 내려앉는다)
    btnState(b) {
        const hover = this.hoverButton === b && !b.disabled;
        return { hover, pressed: hover && this.mouseDown };
    },

    // 체력 막대에 보이는 비율(제물로 차오를 때는 천천히)
    hpRatio() {
        const shown = this.hpShown === null ? Game.hp : this.hpShown;
        return clamp(shown / Game.maxHp(), 0, 1);
    },

    draw(ctx) {
        const G = Game;
        if (this.dialogue && !G.inPlay() && G.state !== 'victory') {
            // 시작 전 대화: 비운 맵 위에 대화만
            this.drawDialogue(ctx);
            this.drawButtons(ctx);
            return;
        }
        if (this.menuState() && this.collection) {
            this.drawCollection(ctx);
            this.drawButtons(ctx);
            this.drawToast(ctx);
            return;
        }
        if (G.state === 'story') {
            this.drawStoryMap(ctx);
            this.drawButtons(ctx);
            this.drawToast(ctx);
            return;
        }
        if (G.state === 'title') {
            this.drawTitle(ctx);
            this.drawButtons(ctx);
            return;
        }
        if (G.state === 'hq') {
            // 본부: 방(시설은 drawHQ가 그린다) 또는 안 화면, 그 위에 버튼과 쪽지
            this.drawHQ(ctx);
            this.drawButtons(ctx);
            this.drawTopTip(ctx);
            this.drawToast(ctx);
            return;
        }
        if (G.state === 'select') {
            this.drawSelect(ctx);
            this.drawButtons(ctx);
            this.drawSelectTip(ctx);
            this.drawToast(ctx);
            return;
        }
        this.drawBottomBar(ctx);
        this.drawTopBar(ctx);
        this.drawParty(ctx);
        this.drawGateCounts(ctx);
        this.drawBossBar(ctx);
        this.drawStreak(ctx);
        this.drawMergeBadges(ctx); // 맵 위 배지는 팝업 아래에 깔린다
        if (this.popup) this.drawPopup(ctx);
        this.drawButtons(ctx);
        this.drawEquipTips(ctx);
        if (!G.bossReward) {
            this.drawHints(ctx);
            this.drawBanner(ctx);
        }
        this.drawPops(ctx);
        this.drawDragged(ctx);
        this.drawDiscovery(ctx);
        if (G.bossReward) this.drawBossReward(ctx);
        this.drawPartyTip(ctx);
        this.drawTopTip(ctx);
        this.drawToast(ctx);
        if (this.dialogue) {
            // 승리 대화: 전투가 끝난 맵 위에
            this.drawDialogue(ctx);
            this.drawButtons(ctx);
        } else if (this.unlockCards) {
            this.drawUnlockCard(ctx);
            this.drawButtons(ctx);
        } else if (G.state === 'victory' || G.state === 'defeat') {
            this.drawResult(ctx);
            this.drawButtons(ctx);
        } else if (G.paused) {
            this.drawPause(ctx);
        }
    },

    // 알림: 하단 바 위 남색 창 한 줄
    drawToast(ctx) {
        if (!this.toast) return;
        const a = clamp((this.toast.life - this.toast.age) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `24px ${UI_FONT}`;
        const w = Math.min(GAME_WIDTH - 80, Math.ceil((ctx.measureText(this.toast.text).width + 64) / 8) * 8);
        const y = GAME_HEIGHT - BAR_H - 84;
        UIKit.note(ctx, GAME_WIDTH / 2 - w / 2, y, w, 56, { pin: true });
        UIKit.ink(ctx, this.toast.text, GAME_WIDTH / 2, y + 30, 24, UI_THEME.ink, 'center');
        ctx.restore();
    },

    // 일시정지: 위쪽에 남색 창 하나와 단축키. 멈춘 채로도 하단 바는 쓸 수 있다
    drawPause(ctx) {
        const T = UI_THEME;
        ctx.fillStyle = T.dimLight;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - BAR_H);
        const cx = GAME_WIDTH / 2;
        const w = 820;
        const h = 352;
        const x = cx - w / 2;
        const y = 140;
        UIKit.panel(ctx, x, y, w, h);
        UIKit.icon(ctx, 'pause', cx - 150, y + 36);
        UIKit.text(ctx, '일시정지', cx + 24, y + 62, 52, T.gold, 'center', 'bold');
        UIKit.ink(ctx, `멈춘 채로도 소환, 배치, 합치기${CORRUPTION_ENABLED ? ', 타락' : ''}를 할 수 있습니다.`, cx, y + 114, 21, T.inkSoft, 'center');
        const keys = [['S', '소환'], ['Tab', '탭 바꾸기'], ['Space', '다음 라운드'], ['Q', '번개'], ['W', '호통'], ['F', '배속'],
            ['P', '일시정지'], ['M', '소리'], ['Esc', '취소']];
        keys.forEach(([key, label], i) => {
            const kx = x + 60 + (i % 3) * 246;
            const ky = y + 150 + Math.floor(i / 3) * 56;
            const kw = this.drawKeyCap(ctx, key, kx, ky + 2, 22);
            UIKit.ink(ctx, label, kx + kw + 12, ky + 21, 21, T.ink);
        });
    },

    // 단축키 표시: 진한 남색 작은 판에 은테, 흰 글자(Asteria 스킬 칸 왼쪽 위 글자처럼). 너비를 돌려준다
    drawKeyCap(ctx, key, x, y, size) {
        const fs = size || 18;
        ctx.font = `bold ${fs}px ${UI_FONT}`;
        const w = Math.max(fs + 12, Math.ceil(ctx.measureText(key).width) + 14);
        const h = fs + 12;
        x = Math.round(x);
        y = Math.round(y);
        ctx.fillStyle = UI_THEME.outline;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#26365c';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#3a5288';
        ctx.fillRect(x + 2, y + 2, w - 4, 3);
        UIKit.text(ctx, key, x + w / 2, y + h / 2 + 1, fs, '#ffffff', 'center', 'bold');
        return w;
    },

    // 마왕 초상
    drawLordPortrait(ctx, lord, x, y, size) {
        this.drawPortrait(ctx, lord.portrait, x, y, size);
    },

    // 초상 { sprite, crop: [x, y, 크기] }을 size 네모에 그린다. 도트가 흐려지지 않게 정수 배율 k(size / 크기의 내림, 최소 1)로
    // 그리고, 그 배율에서 네모를 채우도록 crop의 가운데를 기준으로 잘라 낸다(그림 밖으로 나가면 안쪽으로 민다)
    drawPortrait(ctx, portrait, x, y, size) {
        const img = Assets.get(portrait.sprite);
        if (!img) return;
        const crop = portrait.crop || [0, 0, img.width];
        const k = Math.max(1, Math.floor(size / crop[2]));
        const src = Math.min(size / k, img.width, img.height);
        const sx = clamp(crop[0] + crop[2] / 2 - src / 2, 0, img.width - src);
        const sy = clamp(crop[1] + crop[2] / 2 - src / 2, 0, img.height - src);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(sx), Math.round(sy), src, src, Math.round(x), Math.round(y), src * k, src * k);
    },

    // 유물 그림(48px)을 원래 크기로
    drawRelicIcon(ctx, id, x, y) {
        const img = Assets.get(`relic_${id}`);
        if (!img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), 48, 48);
    },

    // 효과 줄(남색 창 위): 좋은 효과는 초록, 나쁜 효과는 빨강. 다음 줄 y를 돌려준다
    drawEffectLines(ctx, effects, x, y, size, step, align) {
        for (const key of Object.keys(effects).filter(k => LORD_EFFECTS[k])) {
            UIKit.ink(ctx, effectText(key, effects[key]), x, y, size, effectGood(key, effects[key]) ? UI_THEME.inkGood : UI_THEME.inkBad, align || 'left', 'bold');
            y += step;
        }
        return y;
    },

    // 메뉴 바탕(선택 화면, 도감, 스토리 지도, 본부 안 화면): 고른 스테이지 지역의 우주 배경 위에 남색을 얇게 덮는다
    drawTable(ctx) {
        const img = Assets.get(`void_${zoneOf(this.stageId)}`);
        if (img) ctx.drawImage(img, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        else {
            ctx.fillStyle = UI_THEME.navyDark;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
        ctx.fillStyle = 'rgba(8,14,36,0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    },

    // 육각 이름판: 양끝이 뾰족한 남색 판에 진한 테와 가는 금선, 양끝 금 마름모(위쪽 이름판, 대화 제목, 표지)
    drawHexPlate(ctx, x, y, w, h, opts) {
        const o = opts || {};
        const T = UI_THEME;
        x = Math.round(x);
        y = Math.round(y);
        const shape = (inset, color) => {
            const d = h / 2 - inset;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x + inset + d, y + inset);
            ctx.lineTo(x + w - inset - d, y + inset);
            ctx.lineTo(x + w - inset, y + h / 2);
            ctx.lineTo(x + w - inset - d, y + h - inset);
            ctx.lineTo(x + inset + d, y + h - inset);
            ctx.lineTo(x + inset, y + h / 2);
            ctx.closePath();
            ctx.fill();
        };
        shape(0, T.outline);
        shape(3, o.red ? '#e8a23a' : T.goldLine);
        shape(5, o.red ? '#4a0c16' : '#121d3a');
        shape(9, o.red ? '#5c1420' : T.navy);
        ctx.fillStyle = 'rgba(140,170,255,0.08)';
        ctx.fillRect(x + h / 2, y + 9, w - h, Math.round(h / 3) - 6);
        for (const tx of [x - 4, x + w + 4]) {
            ctx.fillStyle = T.outline;
            ctx.beginPath();
            ctx.moveTo(tx, y + h / 2 - 9);
            ctx.lineTo(tx + 9, y + h / 2);
            ctx.lineTo(tx, y + h / 2 + 9);
            ctx.lineTo(tx - 9, y + h / 2);
            ctx.fill();
            ctx.fillStyle = T.goldLight;
            ctx.beginPath();
            ctx.moveTo(tx, y + h / 2 - 5);
            ctx.lineTo(tx + 5, y + h / 2);
            ctx.lineTo(tx, y + h / 2 + 5);
            ctx.lineTo(tx - 5, y + h / 2);
            ctx.fill();
        }
    },

    // 카드 위 가운데 금장(이전에는 거는 끈과 못)
    drawHanger(ctx, x, y, w) {
        UIKit.nail(ctx, x + w / 2, y + 2);
    },

    // 선택 화면: 남색 마왕 카드 3장, 아래쪽 유물 격자(은테 칸)와 고른 유물 칸, 이번 판 효과. 시작 버튼은 drawButtons가 그린다
    drawSelect(ctx) {
        const T = UI_THEME;
        const L = this.loadout;
        this.drawTable(ctx);
        UIKit.bigText(ctx, '마왕과 유물 고르기', GAME_WIDTH / 2, 50, 44, T.cream, 'center');
        const st = stageDef(this.stageId);
        if (st) {
            ctx.font = `26px ${UI_FONT}`;
            const label = `스테이지 ${st.no} · ${st.name}`;
            const w = Math.ceil(ctx.measureText(label).width) + 110;
            this.drawHexPlate(ctx, GAME_WIDTH - 60 - w, 22, w, 64);
            UIKit.text(ctx, label, GAME_WIDTH - 60 - w / 2, 55, 26, T.cream, 'center', 'bold');
        }

        // 마왕 카드: 그림(128px를 2배), 이름, 효과, 설명. 고른 카드는 금테
        for (const b of this.buttons.filter(x => x.lordCard)) {
            const lord = DEMON_LORDS[b.lordCard];
            const on = L.lord === b.lordCard;
            const hover = this.hoverButton === b;
            this.drawHanger(ctx, b.x, b.y, b.w);
            if (b.locked) {
                this.drawLockedLord(ctx, b, lord, hover);
                continue;
            }
            const cx = b.x + b.w / 2;
            UIKit.panel(ctx, b.x, b.y, b.w, b.h, { tint: hover && !on ? 'hover' : null });
            if (on) UIKit.gradeFrame(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, T.goldLine, 5);
            const img = Assets.get(lord.sprite);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, Math.round(cx - img.width), Math.round(b.y + 268 - lord.footPx * 2), img.width * 2, img.height * 2);
            }
            const index = Object.keys(DEMON_LORDS).indexOf(b.lordCard) + 1;
            UIKit.text(ctx, String(index), cx, b.y + 12, 20, T.cream, 'center');
            UIKit.ink(ctx, lord.name, cx, b.y + 296, 36, on ? T.inkWax : T.ink, 'center', 'bold');
            const y = this.drawEffectLines(ctx, lord.effects, cx, b.y + 336, 22, 29, 'center');
            ctx.font = `18px ${UI_FONT}`;
            this.wrapLines(ctx, lord.desc, b.w - 80).slice(0, 3).forEach((line, i) => UIKit.ink(ctx, line, cx, y + 6 + i * 24, 18, T.inkSoft, 'center'));
        }

        // 유물 격자: 은테 칸. 고른 유물은 금테 칸, 잠긴 유물은 흐린 그림 위에 자물쇠와 풀리는 스테이지 번호(도장)
        UIKit.text(ctx, '유물', RELIC_GRID_X, 636, 32, T.cream);
        UIKit.text(ctx, '스토리를 깨면 풀립니다 · 판 중에는 얻지 않습니다', RELIC_GRID_X + 84, 638, 19, T.creamSoft);
        for (const b of this.buttons.filter(x => x.relicId)) {
            const picked = L.relics.includes(b.relicId);
            const hover = this.hoverButton === b;
            UIKit.slot(ctx, b.x, b.y, b.w, b.h, picked ? 'gold' : 'iron', hover ? 'hover' : null);
            if (b.locked) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                this.drawRelicIcon(ctx, b.relicId, b.x + 8, b.y + 8);
                ctx.restore();
                UIKit.icon(ctx, 'lock', b.x + 8, b.y + 2);
                const st = unlockStage('relic', b.relicId);
                if (st) this.drawStageBadge(ctx, st.no, b.x + b.w - 14, b.y + b.h - 14);
                continue;
            }
            this.drawRelicIcon(ctx, b.relicId, b.x + 8, b.y + 8);
        }
        UIKit.text(ctx, '누르면 넣고 다시 누르면 뺍니다 · 붉은 도장은 풀리는 스테이지', RELIC_GRID_X, 862, 19, T.creamSoft);
        UIKit.text(ctx, '1·2·3 마왕 · Enter 시작', RELIC_GRID_X, 892, 19, T.creamSoft);

        // 고른 유물 칸과 이름·효과
        UIKit.text(ctx, `고른 유물 ${L.relics.length}/${Meta.relicSlots()}`, PICKED_X, 636, 28, T.cream);
        // 잠긴 칸: 자물쇠와 풀리는 스테이지 번호
        for (const b of this.buttons.filter(x => x.lockedSlot)) {
            UIKit.slot(ctx, b.x, b.y, b.w, b.h, 'iron', 'off');
            ctx.save();
            ctx.globalAlpha = 0.5;
            UIKit.icon(ctx, 'lock', b.x + 8, b.y + 4);
            ctx.restore();
            const st = unlockStage('slot', b.lockedSlot);
            if (st) this.drawStageBadge(ctx, st.no, b.x + b.w - 14, b.y + b.h - 14);
        }
        for (const b of this.buttons.filter(x => x.pickedSlot !== undefined)) {
            const id = L.relics[b.pickedSlot];
            UIKit.slot(ctx, b.x, b.y, b.w, b.h, id ? 'gold' : 'iron', id && this.hoverButton === b ? 'hover' : null);
            if (id) this.drawRelicIcon(ctx, id, b.x + 8, b.y + 8);
            else UIKit.text(ctx, '빈 칸', b.x + b.w / 2, b.y + b.h / 2, 16, T.creamSoft, 'center');
        }
        let ly = RELIC_GRID_Y + RELIC_CELL + 30;
        if (!Meta.relicSlots()) UIKit.text(ctx, `유물 칸은 ${this.unlockText('slot', 1)}됩니다`, PICKED_X, ly, 19, T.creamSoft);
        else if (!L.relics.length) UIKit.text(ctx, '유물 없이도 시작할 수 있습니다', PICKED_X, ly, 19, T.creamSoft);
        for (const id of L.relics) {
            // 이름과 효과 두 줄(효과 글이 길어 한 줄에 함께 두면 오른쪽 창에 가린다)
            UIKit.text(ctx, RELICS[id].name, PICKED_X, ly, 20, T.cream);
            UIKit.text(ctx, effectLines(RELICS[id].effects).join(', '), PICKED_X, ly + 24, 18, T.good);
            ly += 52;
        }

        // 이번 판 효과: 마왕과 유물을 합친 값(같은 키는 합쳐 한 줄). 금테 상세 창
        const px = 1330;
        const py = 600;
        this.drawDetailFrame(ctx, px, py, 530, 316);
        UIKit.ink(ctx, '이번 판 효과', px + 36, py + 56, 28, T.ink, 'left', 'bold');
        let ey = py + 100;
        for (const { key, value } of modsChanged(buildMods(L.lord, L.relics))) {
            UIKit.ink(ctx, effectText(key, value), px + 40, ey, 21, effectGood(key, value) ? T.inkGood : T.inkBad, 'left', 'bold');
            ey += 28;
        }
    },

    // 선택 화면의 유물 설명: 격자나 고른 칸 위에 마우스를 올렸을 때(터치는 누른 곳)
    drawSelectTip(ctx) {
        const b = this.hoverButton;
        if (!b) return;
        const id = b.relicId || (b.pickedSlot !== undefined ? this.loadout.relics[b.pickedSlot] : null);
        if (!id) return;
        // 유물 격자와 고른 칸을 가리지 않게 격자 아래(안내 문구 자리)에 띄운다. 잠긴 유물은 이름 뒤에 풀리는 스테이지
        const y = RELIC_GRID_Y + 2 * (RELIC_CELL + RELIC_GAP) + 4;
        const title = RELICS[id].name + (Meta.hasRelic(id) ? '' : `  (${this.unlockText('relic', id)})`);
        this.drawTooltip(ctx, clamp(b.x - 183, 12, 1330 - 442), y, title, effectLines(RELICS[id].effects).join(', '));
    },

    // 잠긴 마왕 카드: 가라앉힌 창, 흐린 그림 위에 큰 자물쇠와 "스테이지 N에서 해금"
    drawLockedLord(ctx, b, lord, hover) {
        const T = UI_THEME;
        const cx = b.x + b.w / 2;
        UIKit.panel(ctx, b.x, b.y, b.w, b.h, { tint: hover ? 'rgba(5,9,24,0.35)' : 'shade' });
        const img = Assets.get(lord.sprite);
        if (img) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, Math.round(cx - img.width), Math.round(b.y + 268 - lord.footPx * 2), img.width * 2, img.height * 2);
            ctx.restore();
        }
        UIKit.icon(ctx, 'lock', cx - 48, b.y + 64, 2);
        const st = unlockStage('lord', b.lordCard);
        if (st) {
            this.drawStageBadge(ctx, st.no, cx, b.y + 196, 30);
            UIKit.text(ctx, `스테이지 ${st.no}에서 해금`, cx, b.y + 248, 22, T.creamSoft, 'center', 'bold');
        }
        const index = Object.keys(DEMON_LORDS).indexOf(b.lordCard) + 1;
        UIKit.text(ctx, String(index), cx, b.y + 12, 20, T.creamSoft, 'center');
        UIKit.ink(ctx, lord.name, cx, b.y + 296, 36, T.inkSoft, 'center', 'bold');
        ctx.save();
        ctx.globalAlpha = 0.6;
        const y = this.drawEffectLines(ctx, lord.effects, cx, b.y + 336, 22, 29, 'center');
        ctx.font = `18px ${UI_FONT}`;
        this.wrapLines(ctx, lord.desc, b.w - 80).slice(0, 3).forEach((line, i) => UIKit.ink(ctx, line, cx, y + 6 + i * 24, 18, T.inkSoft, 'center'));
        ctx.restore();
    },

    // 메달에 스테이지 번호(가운데 cx, cy, 반지름 r)
    drawStageBadge(ctx, no, cx, cy, r) {
        r = r || 14;
        this.drawWaxSeal(ctx, cx, cy, r);
        UIKit.text(ctx, String(no), cx, cy + 1, Math.round(r * 1.1), UI_THEME.cream, 'center');
    },

    // 둥근 메달(스테이지 번호 표지, 깬 도장): 진한 테, 금 고리, 진한 빨강 보석, 위쪽 밝은 띠
    drawWaxSeal(ctx, cx, cy, r) {
        const T = UI_THEME;
        const disc = (rad, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(Math.round(cx), Math.round(cy), rad, 0, Math.PI * 2);
            ctx.fill();
        };
        disc(r + 3, T.outline);
        disc(r + 1, T.goldLine);
        disc(r - Math.max(2, Math.round(r / 7)), T.waxDark);
        ctx.save();
        ctx.beginPath();
        ctx.arc(Math.round(cx), Math.round(cy) - 2, r - Math.max(3, Math.round(r / 6)), 0, Math.PI * 2);
        ctx.clip();
        disc(r, T.wax);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,220,200,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.round(cx), Math.round(cy), r * 0.66, Math.PI * 1.1, Math.PI * 1.6);
        ctx.stroke();
    },

    // 마왕 탭의 유물 칸(고른 유물은 금 칸, 빈 칸은 쇠 칸)
    drawBarRelics(ctx) {
        for (const b of this.buttons) {
            if (b.barRelic === undefined) continue;
            const id = Game.relics[b.barRelic];
            UIKit.slot(ctx, b.x, b.y, b.w, b.h, id ? 'gold' : 'iron', id && this.hoverButton === b ? 'hover' : null);
            if (id) this.drawRelicIcon(ctx, id, b.x + 2, b.y + 2);
        }
    },

    // 위쪽 이름판: 금테 육각 판에 지역 이름, 스테이지, 라운드(Asteria 던전 이름판처럼)
    drawTopBar(ctx) {
        const G = Game;
        const T = UI_THEME;
        const x = GAME_WIDTH / 2 - PLATE.w / 2;
        const y = PLATE.y;
        const h = PLATE.h;
        const cy = y + h / 2 + 1;
        this.drawHexPlate(ctx, x, y, PLATE.w, h);
        const zone = ZONES[G.zone] || ZONES[DEFAULT_ZONE];
        UIKit.text(ctx, zone.name, x + 46, cy, 19, T.creamSoft);
        const st = stageDef(G.stage);
        UIKit.text(ctx, st ? `${st.no}. ${st.name}` : '시험 판', x + PLATE.w / 2 - 6, cy, 27, T.cream, 'center', 'bold');
        // 라운드 남은 시간 막대(이름판 아래)
        if (G.state === 'wave') {
            const full = G.currentWave().boss ? COMBAT_RULES.bossRoundTime : COMBAT_RULES.roundTime;
            const w = PLATE.w - 120, bx = x + 60, by = y + h + 2;
            ctx.fillStyle = 'rgba(8,12,28,0.85)';
            ctx.fillRect(bx, by, w, 10);
            ctx.fillStyle = G.roundTimer < 6 ? T.bad : T.gold;
            ctx.fillRect(bx + 2, by + 2, Math.round((w - 4) * clamp(G.roundTimer / full, 0, 1)), 6);
        }
        const n = String(Math.min(G.waveIndex + 1, G.waves.length));
        const total = ` / ${G.waves.length}`;
        ctx.font = `20px ${UI_FONT}`;
        const tw = ctx.measureText(total).width;
        UIKit.text(ctx, total, x + PLATE.w - 44, cy + 3, 20, T.creamSoft, 'right');
        UIKit.text(ctx, n, x + PLATE.w - 46 - tw, cy, 32, T.gold, 'right', 'bold');
        ctx.font = `bold 32px ${UI_FONT}`;
        const nw = ctx.measureText(n).width;
        UIKit.text(ctx, '라운드', x + PLATE.w - 54 - tw - nw, cy + 1, 19, T.creamSoft, 'right');
        if (CORRUPTION_ENABLED) {
            const corrupt = G.units.filter(u => u.kind === 'corrupt').length;
            UIKit.text(ctx, `타락 ${corrupt}/${COMBAT_RULES.corruptMax}`, 22, 40, 26, '#d7a8ff');
        }
    },

    // 하단 바: 남색 띠(위쪽 금선), 왼쪽 체력 구슬과 마왕 이름, 가운데 금장 틀(슬롯 줄), 오른쪽 골드
    drawBottomBar(ctx) {
        const G = Game;
        const T = UI_THEME;
        const y = BAR_STRIP_Y;
        ctx.fillStyle = T.outline;
        ctx.fillRect(0, y - 6, GAME_WIDTH, GAME_HEIGHT - y + 6);
        ctx.fillStyle = '#0a1226';
        ctx.fillRect(0, y, GAME_WIDTH, GAME_HEIGHT - y);
        ctx.fillStyle = '#14214a';
        ctx.fillRect(0, y, GAME_WIDTH, 8);
        ctx.fillStyle = T.goldDark;
        ctx.fillRect(0, y - 2, GAME_WIDTH, 2);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(0, y - 4, GAME_WIDTH, 2);
        this.drawBarFrame(ctx);
        this.drawHp(ctx);
        // 마왕 이름과 이번 판 처치 수
        const lord = G.lordDef();
        UIKit.text(ctx, lord.name, BAR_NAME_X, y + 30, 27, T.cream, 'left', 'bold');
        UIKit.icon(ctx, 'attack', BAR_NAME_X - 6, y + 46, 0.75);
        UIKit.text(ctx, '처치', BAR_NAME_X + 34, y + 66, 18, T.creamSoft);
        UIKit.bigText(ctx, String(G.stats.kills), BAR_NAME_X + 82, y + 64, 32, T.gold, 'left', '#fff2b8');
        // 골드: 코인이 도착하면 잠깐 커진다
        const pulse = 1 + Fx.goldPulse * 0.2;
        UIKit.icon(ctx, 'gold', HUD_GOLD.x - 24, HUD_GOLD.y - 26);
        UIKit.bigText(ctx, G.gold.toLocaleString('en-US'), HUD_GOLD.x + 34, HUD_GOLD.y, Math.round(48 * pulse), T.gold, 'left', '#fff4c0');
        UIKit.text(ctx, `소환 ${G.summonCost()}G`, HUD_GOLD.x + 36, HUD_GOLD.y + 46, 18, T.creamSoft);
        this.drawBag(ctx);
        this.drawBarRelics(ctx);
        // 라운드 중에는 바 위 오른쪽에 단축키 안내(준비 중에는 그 자리에 다음 라운드 버튼)
        if (G.state === 'wave') UIKit.text(ctx, 'S 소환 · Tab 탭 · Q 번개 · F 배속 · P 일시정지', GAME_WIDTH - 24, y - 30, 18, T.creamSoft, 'right');
    },

    // 가운데 금장 틀: 바 위로 솟은 남색 판, 위쪽 비스듬한 금선, 네 귀퉁이 금장
    drawBarFrame(ctx) {
        const T = UI_THEME;
        const F = BAR_FRAME;
        const x = F.x;
        const w = F.w;
        const top = F.top;
        const base = BAR_STRIP_Y;
        const slope = 22;
        const shape = (inset, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x + inset, GAME_HEIGHT);
            ctx.lineTo(x + inset, base);
            ctx.lineTo(x + slope + inset, top + inset);
            ctx.lineTo(x + w - slope - inset, top + inset);
            ctx.lineTo(x + w - inset, base);
            ctx.lineTo(x + w - inset, GAME_HEIGHT);
            ctx.closePath();
            ctx.fill();
        };
        shape(0, T.outline);
        shape(3, T.goldLine);
        shape(5, T.goldDark);
        shape(7, '#0d1630');
        ctx.fillStyle = '#16244a';
        ctx.fillRect(x + slope + 7, top + 7, w - slope * 2 - 14, 6);
        for (const [nx, ny] of [[x + slope, top + 3], [x + w - slope, top + 3], [x + 4, base + 2], [x + w - 4, base + 2]]) UIKit.nail(ctx, nx, ny);
    },

    // 왼쪽 아래 체력 구슬: 금 고리 안의 붉은 물이 체력만큼 차고, 가운데 큰 숫자. 제물로 차오를 때 구슬이 빛난다
    drawHp(ctx) {
        const G = Game;
        const T = UI_THEME;
        const O = BAR_ORB;
        const shown = this.hpShown === null ? G.hp : this.hpShown;
        const ratio = this.hpRatio();
        const low = shown <= G.maxHp() * 0.3;
        const disc = (r, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(O.x, O.y, r, 0, Math.PI * 2);
            ctx.fill();
        };
        if (Fx.hpGlow > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(O.x, O.y, O.r * 0.6, O.x, O.y, O.r * 1.7);
            g.addColorStop(0, `rgba(255,220,130,${0.6 * Fx.hpGlow})`);
            g.addColorStop(1, 'rgba(255,220,130,0)');
            ctx.fillStyle = g;
            ctx.fillRect(O.x - O.r * 2, O.y - O.r * 2, O.r * 4, O.r * 4);
            ctx.restore();
        }
        disc(O.r + 12, T.outline);
        disc(O.r + 10, T.goldDark);
        disc(O.r + 8, T.goldLine);
        disc(O.r + 4, T.outline);
        disc(O.r, '#1c0810');
        // 붉은 물: 아래부터 체력만큼, 윗면은 살짝 일렁인다
        ctx.save();
        ctx.beginPath();
        ctx.arc(O.x, O.y, O.r, 0, Math.PI * 2);
        ctx.clip();
        const level = O.y + O.r - O.r * 2 * ratio;
        const liquid = ctx.createLinearGradient(0, O.y - O.r, 0, O.y + O.r);
        liquid.addColorStop(0, low ? '#ff6a5a' : '#ff4d63');
        liquid.addColorStop(1, '#7a0a22');
        ctx.fillStyle = liquid;
        ctx.beginPath();
        ctx.moveTo(O.x - O.r, O.y + O.r);
        for (let i = 0; i <= 16; i++) {
            const px = O.x - O.r + i * O.r / 8;
            ctx.lineTo(px, level + Math.sin(Game.time * 3 + i * 0.8) * (ratio > 0 && ratio < 1 ? 3 : 0));
        }
        ctx.lineTo(O.x + O.r, O.y + O.r);
        ctx.closePath();
        ctx.fill();
        if (low) {
            ctx.fillStyle = `rgba(255,80,80,${0.12 + 0.12 * Math.sin(Game.time * 6)})`;
            ctx.fillRect(O.x - O.r, O.y - O.r, O.r * 2, O.r * 2);
        }
        // 유리 광택
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(O.x - O.r * 0.3, O.y - O.r * 0.45, O.r * 0.45, O.r * 0.24, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 고리의 금장 넷
        for (let i = 0; i < 4; i++) {
            const a = Math.PI / 4 + i * Math.PI / 2;
            UIKit.nail(ctx, O.x + Math.cos(a) * (O.r + 7), O.y + Math.sin(a) * (O.r + 7));
        }
        UIKit.bigText(ctx, String(Math.floor(shown)), O.x, O.y - 10, 42, low ? '#ffd0c8' : '#ffffff', 'center');
        UIKit.text(ctx, `/ ${G.maxHp()}`, O.x, O.y + 26, 20, T.creamSoft, 'center');
    },

    // 장비 그림(48px)을 (x, y)에 scale배로 그린다. 정수 배율이거나 절반이라 도트가 흐려지지 않는다
    drawEquipIcon(ctx, id, x, y, scale) {
        const img = Assets.get(`equip_${id}`);
        if (!img) return;
        const s = 48 * (scale || 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), s, s);
    },

    // 장비 칸 하나: 은테 칸, 장비가 있으면 굵은 등급 테두리와 그림
    drawEquipSlot(ctx, id, x, y, size, hot, faded) {
        UIKit.slot(ctx, x, y, size, size, 'iron', hot ? 'hover' : null);
        if (!id) return;
        ctx.save();
        if (faded) ctx.globalAlpha = 0.3;
        this.drawEquipIcon(ctx, id, x + (size - 48) / 2, y + (size - 48) / 2, 1);
        UIKit.gradeFrame(ctx, x + 2, y + 2, size - 4, size - 4, MONSTER_GRADES[EQUIPMENT[id].grade].color, 3);
        ctx.restore();
    },

    // 하단 바의 보관함: 가방 아이콘과 칸 수, 은테 3x2칸. 보상을 고르는 동안에도 보인다
    drawBag(ctx) {
        const G = Game;
        for (let i = 0; i < EQUIP_RULES.slots; i++) {
            const r = this.bagRect(i);
            const id = G.equipBag[i];
            const hot = id && this.hoverButton && this.hoverButton.bagSlot === i && !this.equipDrag && !G.bossReward;
            const dragging = this.equipDrag && this.equipDrag.index === i;
            this.drawEquipSlot(ctx, id, r.x, r.y, r.w, hot, dragging);
        }
        const y = GAME_HEIGHT - BAR_H;
        const ix = BAG_X - 62;
        UIKit.slot(ctx, ix - 4, y + 10, 56, 56, 'light');
        UIKit.icon(ctx, 'bag', ix, y + 14);
        UIKit.text(ctx, `${G.equipBag.length}/${EQUIP_RULES.slots}`, ix + 24, y + 92, 22, G.bagFull() ? UI_THEME.bad : UI_THEME.cream, 'center', 'bold');
    },

    // 장비 설명: 보관함 칸이나 팝업의 장비 칸 위에 마우스를 올렸을 때
    drawEquipTips(ctx) {
        if (this.equipDrag || Game.bossReward) return;
        const tip = (id, x, y) => {
            const def = EQUIPMENT[id];
            const grade = MONSTER_GRADES[def.grade];
            this.drawTooltip(ctx, clamp(x, 12, GAME_WIDTH - 442), y, `${def.name} · ${grade.name}`, equipEffectText(id), grade.ink);
        };
        const b = this.hoverButton;
        if (b && b.bagSlot !== undefined && Game.equipBag[b.bagSlot]) {
            tip(Game.equipBag[b.bagSlot], b.x - 120, GAME_HEIGHT - BAR_H - 92);
        }
        // 마왕 탭의 유물 칸
        const relic = b && b.barRelic !== undefined ? Game.relics[b.barRelic] : null;
        if (relic) {
            this.drawTooltip(ctx, clamp(b.x - 190, 12, GAME_WIDTH - 442), GAME_HEIGHT - BAR_H - 92, `유물 · ${RELICS[relic].name}`, effectLines(RELICS[relic].effects).join(', '));
        }
        const r = this.popupEquipRect;
        const f = this.selectedMonster;
        const m = this.mouse;
        if (r && f && f.equip && this.popup && m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
            // 팝업 글자를 가리지 않게 팝업 옆(왼쪽, 자리가 없으면 오른쪽)에 띄운다
            const p = this.popup;
            tip(f.equip, p.x - 442 >= 12 ? p.x - 442 : p.x + p.w + 12, r.y - 13);
        }
    },

    // 다음 파티 목록 줄: 일반과 정예는 한 종류에 한 줄, 보스는 맨 아래 줄. drawParty와 drawPartyTip이 같이 쓴다
    partyCells() {
        const G = Game;
        const wave = G.currentWave();
        const top = 8 + 88;
        const cells = [];
        const list = [...Object.entries(wave.members).map(([t, n]) => [t, n, false]), ...Object.entries(wave.elites || {}).map(([t, n]) => [t, n, true])];
        list.forEach(([type, count, elite], i) => {
            const def = HEROES[type];
            cells.push({ x: PARTY_X + 14, y: top + i * PARTY_ROW, w: PARTY_W - 28, h: PARTY_ROW - 2, portrait: this.heroPortrait(type), name: def.name, note: def.counter, count, elite });
        });
        if (wave.boss) {
            const def = BOSSES[wave.boss];
            cells.push({ x: PARTY_X + 14, y: top + list.length * PARTY_ROW, w: PARTY_W - 28, h: PARTY_ROW - 2, portrait: def.portrait, name: def.name, note: `${def.note} · ${ROUTE_NAMES[G.bossEntry(wave.boss)]}쪽 입구`, count: 1, boss: true });
        }
        return cells;
    },

    // 다음 파티: 남색 창 목록. 파티 이름, 입구별 인원, 종류마다 얼굴과 이름, 수(정예는 금색, 보스는 빨강). 설명은 마우스를 올릴 때(drawPartyTip)
    drawParty(ctx) {
        const G = Game;
        const T = UI_THEME;
        const wave = G.currentWave();
        // Why: 맵이 화면 위쪽까지 차서 오른쪽 위 버튼 왼쪽, 건설 칸이 없는 곳(18~29열, 0~4줄) 위에 둔다.
        // 아래로 왕좌의 마왕과 5줄의 건설 칸을 가리지 않게 y 320 위에서 끝난다
        const x = PARTY_X;
        const y = 8;
        const cells = this.partyCells();
        const last = cells.length ? cells[cells.length - 1] : { y: y + 88, h: 0 };
        const h = last.y + last.h + 16 - y;
        UIKit.panel(ctx, x, y, PARTY_W, h);
        UIKit.text(ctx, G.state === 'wave' ? '이번 파티' : '다음 파티', x + 24, y + 26, 18, T.gold, 'left', 'bold');
        const counts = G.entryCounts(wave);
        UIKit.text(ctx, ROUTE_IDS.map(id => `${ROUTE_NAMES[id]} ${counts[id]}`).join(' · '), x + PARTY_W - 24, y + 26, 18, T.creamSoft, 'right');
        UIKit.text(ctx, wave.party, x + 24, y + 62, 26, T.cream, 'left', 'bold');
        ctx.fillStyle = T.parchmentDark;
        ctx.fillRect(x + 16, y + 84, PARTY_W - 32, 2);
        for (const c of cells) {
            const box = c.h - 2;
            if (c.boss) {
                ctx.fillStyle = 'rgba(200,40,60,0.25)';
                ctx.fillRect(c.x - 4, c.y, c.w + 8, c.h);
            }
            UIKit.slot(ctx, c.x, c.y + 1, box, box, c.elite ? 'gold' : 'iron');
            this.drawPortrait(ctx, c.portrait, c.x + 3, c.y + 4, box - 6);
            UIKit.text(ctx, c.name, c.x + box + 10, c.y + c.h / 2 + 1, 19, c.boss ? '#ff9a8a' : (c.elite ? T.gold : T.cream), 'left', c.boss ? 'bold' : '');
            const label = c.boss ? `${ROUTE_NAMES[G.bossEntry(wave.boss)]}쪽 · 보스` : `x${c.count}`;
            UIKit.text(ctx, label, c.x + c.w, c.y + c.h / 2 + 1, c.boss ? 17 : 24, c.boss ? T.creamSoft : (c.elite ? T.gold : '#ffffff'), 'right', 'bold');
        }
    },

    // 수배서의 얼굴 칸에 마우스를 올리면 이름과 상대법
    drawPartyTip(ctx) {
        if (!Game.inPlay() || Game.bossReward) return;
        const m = this.mouse;
        const c = this.partyCells().find(c => m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h);
        if (c) this.drawTooltip(ctx, clamp(c.x - 200, 12, GAME_WIDTH - 442), c.y + c.h + 8, `${c.name}${c.elite ? ' · 정예' : ''}${c.boss ? '' : ` x${c.count}`}`, c.note);
    },

    // 용사 초상: 서 있는 그림(정예 64px, 일반 48px)의 머리 쪽. 그림 위쪽 가운데에서 잘라 쓴다
    heroPortrait(type) {
        const img = Assets.get(Render.heroStandName(type));
        const w = img ? img.width : 48;
        return { sprite: Render.heroStandName(type), crop: [w / 2 - 12, w > 48 ? 6 : 2, 24] };
    },

    // 준비 시간: 각 입구 문 위에 이번에 올 인원을 작은 남색 표지로 띄운다(보스가 오는 입구는 빨강)
    drawGateCounts(ctx) {
        const G = Game;
        if (G.state !== 'prep' || G.bossReward) return;
        const wave = G.currentWave();
        const counts = G.entryCounts(wave);
        const bossRoute = wave.boss ? G.bossEntry(wave.boss) : null;
        for (const gate of Render.gates()) {
            const n = counts[gate.route];
            const boss = bossRoute === gate.route;
            if (!n && !boss) continue;
            // 북쪽 입구는 문 위 두 칸(1줄), 남쪽 입구는 문 아래 두 칸(13줄): 건설 칸(2~12줄)과 길을 가리지 않는다
            const above = gate.y < WORLD_HEIGHT / 2;
            const cx = Math.round((gate.x + 18) * WORLD_ZOOM);
            const cy = Math.round((gate.y + (above ? -2 : 2) * TILE) * WORLD_ZOOM);
            const label = `${ROUTE_NAMES[gate.route]} ${n}명${boss ? ' +보스' : ''}`;
            ctx.font = `bold 20px ${UI_FONT}`;
            const w = Math.ceil((ctx.measureText(label).width + 36) / 4) * 4;
            const bx = Math.max(8, cx - w / 2);
            UIKit.note(ctx, bx, cy - 19, w, 38, { red: boss });
            UIKit.text(ctx, label, bx + w / 2, cy + 1, 20, UI_THEME.cream, 'center', 'bold');
        }
    },

    // 보스 체력: 이름판 바로 아래 남색 띠에 초상, 이름, 굵은 빨간 막대와 % . 건설 칸(2줄, y 128부터)을 덮지 않게 y 128 위에서 끝난다
    drawBossBar(ctx) {
        const boss = Game.heroes.find(h => h.boss && !h.waiting);
        if (!boss) return;
        const T = UI_THEME;
        const cx = GAME_WIDTH / 2;
        const x = cx - 330;
        const y = 76;
        UIKit.note(ctx, x, y, 660, 48, { red: true });
        UIKit.slot(ctx, x + 6, y + 4, 40, 40, 'gold');
        this.drawPortrait(ctx, BOSSES[boss.bossKey].portrait, x + 8, y + 6, 36);
        UIKit.text(ctx, boss.name, x + 58, y + 24, 20, T.cream, 'left', 'bold');
        ctx.font = `bold 20px ${UI_FONT}`;
        const bx = x + 74 + ctx.measureText(boss.name).width;
        const bw = x + 600 - bx;
        UIKit.bar(ctx, bx, y + 14, bw, 20, boss.hp / boss.maxHp, '#e2384a');
        UIKit.text(ctx, `${Math.ceil(boss.hp / boss.maxHp * 100)}%`, x + 646, y + 24, 18, T.cream, 'right', 'bold');
    },

    // 연속 처치: 체력 구슬 오른쪽 위 금테 남색 알약에 큰 숫자(Asteria 연격 표시처럼). 많이 이을수록 크고 뜨거운 색
    drawStreak(ctx) {
        const G = Game;
        if (G.streak < 2) return;
        const T = UI_THEME;
        const pop = G.streakPop;
        const color = G.streak >= 10 ? '#ff7a5c' : (G.streak >= 5 ? '#ffc65c' : '#ffe9a8');
        const size = Math.round(34 + pop * 16 + Math.min(G.streak, 20) * 0.6);
        ctx.save();
        ctx.globalAlpha = clamp(G.streakTimer / 0.5, 0, 1);
        const x = BAR_NAME_X;
        const y = BAR_STRIP_Y - 74;
        const label = `${G.streak}`;
        ctx.font = `bold ${size}px ${UI_FONT}`;
        const nw = ctx.measureText(label).width;
        const w = Math.round(nw + 170);
        UIKit.note(ctx, x, y - 26, w, 52);
        // 별 장식
        ctx.fillStyle = T.goldLight;
        ctx.fillRect(x + 16, y - 2, 12, 4);
        ctx.fillRect(x + 20, y - 6, 4, 12);
        UIKit.bigText(ctx, label, x + 38, y, size, color, 'left', '#ffffff');
        UIKit.text(ctx, '연속 처치', x + 46 + nw, y + 2, 22, T.cream, 'left', 'bold');
        ctx.restore();
    },

    // 초상 그림 한 장: PixelLab은 도트 격자가 깨지지 않게 정수 배율로(가운데가 몸통), Asteria 그림은 크기가 제각각이라 전체가 들어가게 맞춘다
    drawIconImage(ctx, img, def, x, y, size) {
        if (def.art.breathe) {
            const k = Math.min(size * 0.94 / img.width, size * 0.94 / img.height);
            const w = img.width * k;
            const h = img.height * k;
            ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
            return;
        }
        const s = img.width * Math.max(1, Math.floor(size / img.width));
        ctx.drawImage(img, x + (size - s) / 2, y + (size - s) / 2, s, s);
    },

    // 몬스터의 rotations/south 그림을 size 크기 네모 안에 그리고, 굵은 등급 테두리를 두른다
    drawMonsterIcon(ctx, type, x, y, size, noFrame) {
        const def = MONSTERS[type];
        if (!noFrame) {
            ctx.fillStyle = '#1e2a4c';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#16203c';
            ctx.fillRect(x, y + Math.round(size * 0.66), size, size - Math.round(size * 0.66));
        }
        const img = Assets.get(`${def.sprite}/rotations/south`);
        if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, size, size);
            ctx.clip();
            ctx.imageSmoothingEnabled = false;
            this.drawIconImage(ctx, img, def, x, y, size);
            ctx.restore();
        }
        if (noFrame) return;
        UIKit.gradeFrame(ctx, x, y, size, size, MONSTER_GRADES[def.grade].color, size >= 120 ? 6 : 4);
    },

    // 하트(체력 표시): 진한 테 안의 빨간 하트 도트
    drawHeart(ctx, x, y, size) {
        const k = Math.max(2, Math.round(size / 9));
        const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
        const ox = Math.round(x + (size - 7 * k) / 2);
        const oy = Math.round(y + (size - 6 * k) / 2);
        ctx.fillStyle = UI_THEME.outline;
        rows.forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') ctx.fillRect(ox + i * k - 2, oy + r * k - 2, k + 4, k + 4); }));
        ctx.fillStyle = '#ff4d63';
        rows.forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') ctx.fillRect(ox + i * k, oy + r * k, k, k); }));
        ctx.fillStyle = '#ffb3be';
        ctx.fillRect(ox + k, oy + k, k, k);
    },

    // 등급 표: 등급 색 작은 판에 등급 이름
    drawGradeChip(ctx, grade, x, y, size) {
        const g = MONSTER_GRADES[grade];
        const fs = size || 17;
        ctx.font = `bold ${fs}px ${UI_FONT}`;
        const w = Math.ceil(ctx.measureText(g.name).width) + 16;
        ctx.fillStyle = UI_THEME.outline;
        ctx.fillRect(Math.round(x), Math.round(y - fs / 2 - 5), w + 4, fs + 10);
        ctx.fillStyle = g.color;
        ctx.fillRect(Math.round(x) + 2, Math.round(y - fs / 2 - 3), w, fs + 6);
        UIKit.ink(ctx, g.name, x + 2 + w / 2, y + 1, fs, UI_THEME.outline, 'center', 'bold');
        return w + 4;
    },

    // 고른 몬스터 정보: 남색 창. 이름, 등급, 수치(아이콘과 숫자), 장비, 능력, 함께 합칠 수 있는 몬스터. 판매 버튼은 layoutMonsterMenu가 놓는다
    drawPopup(ctx) {
        const T = UI_THEME;
        const p = this.popup;
        const f = p.monster;
        const def = MONSTERS[p.type];
        const grade = MONSTER_GRADES[def.grade];
        UIKit.panel(ctx, p.x, p.y, p.w, p.h, { iron: true });
        const top = p.y + POPUP_TOP;
        this.drawMonsterIcon(ctx, p.type, p.x + 20, top + 12, 64);
        UIKit.ink(ctx, def.name, p.x + 100, top + 32, 30, grade.ink, 'left', 'bold');
        const cw = this.drawGradeChip(ctx, def.grade, p.x + 100, top + 68, 16);
        UIKit.ink(ctx, `${MONSTER_ROLES[def.role].name} · ${MONSTER_FAMILIES[def.family]}`, p.x + 110 + cw, top + 69, 18, T.inkSoft);
        const stats = monsterStats(f);
        const num = v => Math.round(v * 100) / 100; // 장비로 0.8695...처럼 되는 값을 소수 둘째 자리까지
        // 랭크: 글자는 랭크 색(외곽선), 옆에 다음 랭크까지 남은 처치 수(정예 3, 보스 10으로 센다)
        const rank = f.rank || 0;
        const rankDef = MONSTER_RANKS[rank];
        const nextRank = MONSTER_RANKS[rank + 1];
        UIKit.ink(ctx, '랭크', p.x + 22, top + 108, 18, T.inkSoft);
        UIKit.text(ctx, rankDef.name, p.x + 72, top + 108, 26, rankDef.color, 'left', 'bold');
        UIKit.ink(ctx, nextRank ? `다음 ${nextRank.name}까지 ${monsterXpToNext(f)}처치` : '최고 랭크', p.x + 104, top + 109, 17, nextRank ? T.ink : T.inkWax);
        // 수치: 공격 아이콘과 피해, 막는 몬스터는 하트와 체력, 공격 간격과 사거리
        const sy = top + 108 + POPUP_RANK_H + 10;
        UIKit.icon(ctx, 'attack', p.x + 16, sy - 24);
        UIKit.ink(ctx, String(Math.round(stats.damage)), p.x + 68, sy + 2, 30, T.ink, 'left', 'bold');
        let sx = p.x + 136;
        if (monsterBlocks(p.type)) {
            this.drawHeart(ctx, sx, sy - 14, 28);
            const hp = f.down > 0 ? `${Math.ceil(f.down)}초 뒤` : `${Math.ceil(f.hp)}/${Math.round(stats.hp)}`;
            UIKit.ink(ctx, hp, sx + 34, sy + 2, 24, f.down > 0 ? T.inkBad : T.ink, 'left', 'bold');
            sx += 150;
        } else {
            UIKit.ink(ctx, `사거리 ${num(stats.range)}`, sx, sy + 2, 22, T.ink, 'left', 'bold');
            sx += 130;
        }
        UIKit.ink(ctx, `${num(stats.interval)}초마다`, sx, sy + 2, 20, T.inkSoft);
        const line2 = monsterBlocks(p.type) ? `막기 ${stats.block}명 · 쓰러지면 ${stats.respawn}초 뒤 다시 나옴`
            : (stats.splash ? `광역 반경 ${stats.splash} · 무리를 함께 공격` : '가장 앞선 용사 하나를 노림');
        UIKit.ink(ctx, line2, p.x + 22, top + 138 + POPUP_RANK_H + 14, 17, T.inkSoft);

        // 장비 줄: 칸(마우스를 올리면 설명), 이름과 등급, 효과. 빼기 버튼은 layoutMonsterMenu가 놓는다
        let y = top + 166 + POPUP_RANK_H;
        ctx.fillStyle = T.parchmentDark;
        ctx.fillRect(p.x + 20, y - 4, p.w - 40, 2);
        this.popupEquipRect = { x: p.x + 20, y: y + 6, w: 56, h: 56 };
        this.drawEquipSlot(ctx, f.equip, p.x + 20, y + 6, 56, false, false);
        if (f.equip) {
            const eq = EQUIPMENT[f.equip];
            const eg = MONSTER_GRADES[eq.grade];
            UIKit.ink(ctx, eq.name, p.x + 90, y + 22, 21, eg.ink, 'left', 'bold');
            // 효과 글은 빼기 버튼 왼쪽까지만(길면 글자를 줄인다)
            const fx = equipEffectText(f.equip);
            let fs = 17;
            ctx.font = `bold ${fs}px ${UI_FONT}`;
            while (fs > 12 && ctx.measureText(fx).width > p.w - 90 - 130) ctx.font = `bold ${--fs}px ${UI_FONT}`;
            UIKit.ink(ctx, fx, p.x + 90, y + 50, fs, T.inkGood, 'left', 'bold');
        } else {
            UIKit.ink(ctx, '장비 없음', p.x + 90, y + 22, 20, T.inkFaint, 'left', 'bold');
            UIKit.ink(ctx, '보관함에서 끌어 놓아 끼웁니다', p.x + 90, y + 50, 16, T.inkSoft);
        }
        y += POPUP_EQUIP_H;

        // 능력: 한 줄에 하나. 이름과 설명은 ABILITY_KINDS에서 온다
        for (const a of def.abilities) {
            const kind = ABILITY_KINDS[a.kind];
            UIKit.ink(ctx, kind.name, p.x + 22, y + 12, 18, ABILITY_INK, 'left', 'bold');
            const nameW = ctx.measureText(kind.name).width;
            UIKit.ink(ctx, kind.desc(a), p.x + 34 + nameW, y + 12, 17, T.ink);
            y += POPUP_ABILITY_H;
        }
        // 특수 스킬: 이름(남은 대기)과 설명 두 줄
        (def.skills || []).forEach((s, i) => {
            const cd = f.skillCd ? Math.ceil(f.skillCd[i]) : 0;
            UIKit.ink(ctx, `특수 스킬 · ${s.name}`, p.x + 22, y + 12, 18, SKILL_INK, 'left', 'bold');
            if (cd > 0) UIKit.ink(ctx, `${cd}초`, p.x + p.w - 22, y + 12, 16, T.inkSoft, 'right');
            UIKit.ink(ctx, skillDesc(s), p.x + 22, y + 36, 15, T.ink);
            y += POPUP_SKILL_H;
        });

        // 함께 합칠 수 있는 몬스터
        ctx.fillStyle = T.parchmentDark;
        ctx.fillRect(p.x + 20, y, p.w - 40, 2);
        UIKit.ink(ctx, '함께 합치면', p.x + 22, y + 18, 18, T.inkSoft, 'left', 'bold');
        y += 34;
        for (const r of p.recipes) {
            const res = MONSTERS[r.result];
            this.drawMonsterIcon(ctx, r.partner, p.x + 22, y + 2, 44);
            // 랭크 조건이 있으면 이름 뒤에 적는다(예: 해골 기사 A+)
            UIKit.ink(ctx, MONSTERS[r.partner].name + (r.partnerRank ? ` ${r.partnerRank}+` : ''), p.x + 76, y + 24, 19, T.ink);
            UIKit.ink(ctx, '→', p.x + 226, y + 24, 24, T.inkWax, 'center', 'bold');
            this.drawMonsterIcon(ctx, r.result, p.x + 250, y + 2, 44);
            UIKit.ink(ctx, res.name, p.x + 304, y + 24, 19, MONSTER_GRADES[res.grade].ink, 'left', 'bold');
            y += 50;
        }
        const next = nextGrade(def.grade);
        const gradeLine = next ? `같은 ${grade.name} 아무 ${MERGE_RULES.gradeCount}마리 → ${MONSTER_GRADES[next].name} 무작위 1마리`
            : `${grade.name}은 최고 등급이라 등급 합치기를 할 수 없습니다`;
        UIKit.ink(ctx, gradeLine, p.x + 22, y + 18, 17, next ? MONSTER_GRADES[next].ink : T.inkFaint, 'left', 'bold');
        // 제물: 이 몬스터(랭크 포함)를 바치면 얻는 것
        UIKit.ink(ctx, `왕좌에 바치면 ${sacrificeText(Game.sacrificeGain(f))}`, p.x + 22, y + 18 + POPUP_SACRIFICE_H, 17, T.inkWax);
    },

    drawButtons(ctx) {
        for (const b of this.buttons) {
            if (b.reward) continue; // 보상 카드는 어둡게 깐 화면 위에 drawBossReward가 그린다
            if (b.bagSlot !== undefined) continue; // 보관함 칸은 drawBag이 그린다
            if (b.barRelic !== undefined) continue; // 마왕 탭 유물 칸은 drawBarRelics가 그린다
            if (b.lordCard || b.relicId || b.pickedSlot !== undefined) continue; // 선택 화면 칸은 drawSelect가 그린다
            if (b.lockedSlot) continue; // 잠긴 유물 칸도 drawSelect가 그린다
            if (b.stamp) continue; // 스토리 지도의 도장은 drawStoryMap이 그린다
            if (b.facility || b.content) continue; // 본부 시설과 도전의 문 콘텐츠는 drawHQ가 그린다
            const st = this.btnState(b);
            if (b.skill) this.drawSkillButton(ctx, b, st);
            else if (b.summonBtn) this.drawSummonButton(ctx, b, st);
            else if (b.upgradeBtn) this.drawSummonUpgrade(ctx, b, st);
            else if (b.tab) this.drawTabButton(ctx, b, st);
            else if (b.upgrade) this.drawUpgradeButton(ctx, b, st);
            else if (b.arrow) this.drawArrowButton(ctx, b, st);
            else if (b.iconOnly) this.drawIconButton(ctx, b, st);
            else {
                const kind = b.disabled ? 'off' : (b.theme === 'gold' ? 'primary' : (b.theme === 'danger' ? 'danger' : 'silver'));
                const dy = UIKit.button(ctx, b.x, b.y, b.w, b.h, kind, st);
                const size = b.size || 24;
                ctx.font = `${size}px ${UI_FONT}`;
                const lw = ctx.measureText(b.label).width;
                const iw = b.icon ? 48 + 10 : 0;
                const lx = b.x + b.w / 2 - (lw + iw) / 2;
                const ly = b.y + b.h / 2 + dy - (b.sub ? 12 : 0);
                if (b.icon) {
                    ctx.save();
                    if (b.disabled) ctx.globalAlpha = 0.55;
                    UIKit.icon(ctx, b.icon, lx, b.y + b.h / 2 - 24 + dy);
                    ctx.restore();
                }
                UIKit.text(ctx, b.label, lx + iw, ly + 1, size, UIKit.buttonInk(kind));
                if (b.sub) UIKit.text(ctx, b.sub, lx + iw, ly + 30, 18, b.disabled ? UI_THEME.bad : UI_THEME.creamSoft);
            }
        }
    },

    // 오른쪽 위 금속 아이콘 버튼: 켜진 쪽은 밝은 은청색에 금테, 소리를 끄면 빨간 사선, 배속은 작은 숫자를 곁들인다
    drawIconButton(ctx, b, st) {
        const kind = b.on ? 'tab' : 'silver';
        const dy = UIKit.button(ctx, b.x, b.y, b.w, b.h, kind, st);
        const ix = b.x + (b.w - 48) / 2;
        const iy = b.y + (b.h - 48) / 2 + dy;
        UIKit.icon(ctx, b.icon, ix, iy);
        if (b.slash) {
            ctx.save();
            ctx.strokeStyle = UI_THEME.outline;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(ix + 6, iy + 42);
            ctx.lineTo(ix + 42, iy + 6);
            ctx.stroke();
            ctx.strokeStyle = UI_THEME.wax;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }
        if (b.corner) UIKit.text(ctx, b.corner, b.x + b.w - 5, b.y + b.h - 11 + dy, 16, UI_THEME.gold, 'right', 'bold');
    },

    // 쪽 넘김: 은청색 네모 버튼에 흰 삼각형(누를 수 없으면 흐리게)
    drawArrowButton(ctx, b, st) {
        const kind = b.disabled ? 'off' : 'silver';
        const dy = UIKit.button(ctx, b.x, b.y, b.w, b.h, kind, st);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2 + dy;
        const s = b.arrow === 'left' ? -1 : 1;
        ctx.fillStyle = UI_THEME.outline;
        ctx.beginPath();
        ctx.moveTo(cx + s * 16, cy);
        ctx.lineTo(cx - s * 12, cy - 18);
        ctx.lineTo(cx - s * 12, cy + 18);
        ctx.fill();
        ctx.fillStyle = b.disabled ? '#9aa4b8' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx + s * 11, cy);
        ctx.lineTo(cx - s * 8, cy - 12);
        ctx.lineTo(cx - s * 8, cy + 12);
        ctx.fill();
    },

    // 오른쪽 위 버튼 설명(버튼 아래 작은 쪽지)
    drawTopTip(ctx) {
        const b = this.hoverButton;
        if (!b || !b.tip) return;
        ctx.font = `19px ${UI_FONT}`;
        const w = Math.ceil((ctx.measureText(b.tip).width + 36) / 4) * 4;
        const x = Math.min(b.x + b.w - w, GAME_WIDTH - w - 8);
        UIKit.note(ctx, x, b.y + b.h + 6, w, 40);
        UIKit.ink(ctx, b.tip, x + w / 2, b.y + b.h + 27, 19, UI_THEME.ink, 'center');
    },

    // 글자를 maxW 안에 들어가게 띄어쓰기 단위로 나눈다(글꼴은 미리 맞춰 둔다)
    wrapLines(ctx, text, maxW) {
        const lines = [];
        let line = '';
        for (const word of text.split(' ')) {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > maxW) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        if (line) lines.push(line);
        return lines;
    },

    // 보스 보상 3택: 뒤를 가라앉히고 제목, 반듯한 남색 카드 3장(등급 색 테두리). 누르는 자리는 버튼 네모 그대로
    drawBossReward(ctx) {
        ctx.fillStyle = UI_THEME.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        UIKit.bigText(ctx, '보스 처치 보상', cx, REWARD_CARD_Y - 118, 68, UI_THEME.gold, 'center', '#fff2b8');
        UIKit.text(ctx, '하나를 고르세요 · 1, 2, 3', cx, REWARD_CARD_Y - 60, 26, UI_THEME.creamSoft, 'center');
        for (const b of this.buttons) if (b.reward) this.drawRewardCard(ctx, b, this.hoverButton === b && !b.disabled);
    },

    // 수치 칩: 아이콘(48)과 큰 숫자, 작은 이름. 다음 x를 돌려준다
    drawStatChip(ctx, icon, value, label, x, y) {
        if (icon === 'hpHeart') this.drawHeart(ctx, x + 6, y - 18, 36);
        else if (icon) UIKit.icon(ctx, icon, x, y - 24);
        const tx = icon ? x + 50 : x;
        UIKit.text(ctx, value, tx, y - 6, 28, UI_THEME.cream, 'left', 'bold');
        UIKit.ink(ctx, label, tx, y + 20, 15, UI_THEME.inkSoft);
        ctx.font = `bold 28px ${UI_FONT}`;
        return tx + Math.max(ctx.measureText(value).width, 40) + 16;
    },

    drawRewardCard(ctx, b, hover) {
        const T = UI_THEME;
        const card = b.reward;
        const w = b.w;
        const h = b.h;
        const def = card.kind === 'monster' ? MONSTERS[card.type] : null;
        const eq = card.kind === 'equip' ? EQUIPMENT[card.id] : null;
        const grade = def || eq ? MONSTER_GRADES[(def || eq).grade] : null;
        // 반듯한 남색 카드(기울이지 않는다). 마우스를 올리면 조금 떠오른다. 안쪽 좌표는 (0, 0)부터 그린다
        ctx.save();
        ctx.translate(b.x, b.y - (hover ? 10 : 0));
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(8, 12, w, h);
        UIKit.panel(ctx, 0, 0, w, h);
        UIKit.gradeFrame(ctx, -6, -6, w + 12, h + 12, grade ? grade.color : UI_THEME.goldLine, 6);
        if (grade) UIKit.text(ctx, grade.name, w - 20, 26, 18, grade.light, 'right', 'bold');
        const cx = w / 2;
        // 고르는 키
        this.drawKeyCap(ctx, String(b.index + 1), 14, 12, 18);
        if (def) {
            const size = 168;
            this.drawMonsterIcon(ctx, card.type, cx - size / 2, 46, size);
            UIKit.ink(ctx, def.name, cx, 246, 34, grade.ink, 'center', 'bold');
            ctx.font = `bold 17px ${UI_FONT}`;
            const chipW = ctx.measureText(grade.name).width + 20;
            ctx.font = `19px ${UI_FONT}`;
            const role = MONSTER_ROLES[def.role].name;
            const rw = ctx.measureText(role).width;
            const x0 = cx - (chipW + 10 + rw) / 2;
            this.drawGradeChip(ctx, def.grade, x0, 284, 17);
            UIKit.ink(ctx, role, x0 + chipW + 10, 285, 19, T.inkSoft);
            // 수치: 공격과 체력(막는 몬스터) 또는 사거리
            const st = def.stats;
            let sx = 40;
            sx = this.drawStatChip(ctx, 'attack', String(st.damage), '피해', sx, 338);
            if (monsterBlocks(card.type)) this.drawStatChip(ctx, 'hpHeart', String(st.hp), '체력', sx, 338);
            else this.drawStatChip(ctx, null, String(st.range), '사거리', sx, 338);
            let ly = 392;
            for (const a of def.abilities) {
                const kind = ABILITY_KINDS[a.kind];
                UIKit.ink(ctx, kind.name, cx, ly, 20, ABILITY_INK, 'center', 'bold');
                ly += 26;
                ctx.font = `17px ${UI_FONT}`;
                for (const line of this.wrapLines(ctx, kind.desc(a), w - 80).slice(0, 2)) {
                    UIKit.ink(ctx, line, cx, ly, 17, T.ink, 'center');
                    ly += 22;
                }
                ly += 4;
            }
        } else if (eq) {
            // 장비 카드: 48px 그림을 3배(정수 배율)로, 굵은 등급 테두리
            const size = 168;
            ctx.fillStyle = '#1e2a4c';
            ctx.fillRect(cx - size / 2, 46, size, size);
            this.drawEquipIcon(ctx, card.id, cx - 72, 46 + (size - 144) / 2, 3);
            UIKit.gradeFrame(ctx, cx - size / 2, 46, size, size, grade.color, 6);
            UIKit.ink(ctx, eq.name, cx, 246, 34, grade.ink, 'center', 'bold');
            ctx.font = `bold 17px ${UI_FONT}`;
            const chipW = ctx.measureText(grade.name).width + 20;
            this.drawGradeChip(ctx, eq.grade, cx - (chipW + 60) / 2, 284, 17);
            UIKit.ink(ctx, '장비', cx - (chipW + 60) / 2 + chipW + 10, 285, 19, T.inkSoft);
            let ly = 340;
            for (const part of equipEffectText(card.id).split(', ')) {
                UIKit.ink(ctx, part, cx, ly, 28, T.inkGood, 'center', 'bold');
                ly += 38;
            }
            UIKit.icon(ctx, 'bag', cx - 62, h - 136);
            UIKit.ink(ctx, `${Game.equipBag.length}/${EQUIP_RULES.slots}`, cx - 6, h - 111, 26, T.ink, 'left', 'bold');
        } else {
            // 골드 카드: 금화 더미 아이콘을 3배로, 큰 숫자
            UIKit.icon(ctx, 'gold', cx - 72, 52, 3);
            UIKit.bigText(ctx, `+${card.gold}`, cx, 250, 60, T.gold, 'center', '#fff4c0');
            UIKit.ink(ctx, '골드 · 바로 받습니다', cx, 296, 20, T.inkSoft, 'center');
            UIKit.icon(ctx, 'summon', cx - 92, 336);
            UIKit.ink(ctx, `소환 ${Game.summonCost()}G`, cx - 36, 361, 24, T.ink, 'left', 'bold');
        }
        // 아래 고르기 버튼: 마우스를 올린 카드만 금색(카드 확정)
        if (!b.disabled) {
            UIKit.button(ctx, 50, h - 84, w - 100, 58, hover ? 'primary' : 'silver', { pressed: hover && this.mouseDown });
            UIKit.text(ctx, `고르기 [${b.index + 1}]`, cx, h - 54 + (hover && this.mouseDown ? 2 : 0), 24, T.cream, 'center', 'bold');
        } else {
            ctx.fillStyle = 'rgba(5,9,24,0.55)';
            ctx.fillRect(4, 4, w - 8, h - 8);
            UIKit.note(ctx, 40, h / 2 - 50, w - 80, 100, { red: true });
            UIKit.text(ctx, eq ? '보관함 가득' : '자리 없음', cx, h / 2 - 16, 34, T.cream, 'center');
            const note = eq ? `보관함 ${Game.equipBag.length}/${EQUIP_RULES.slots}` : `맵 몬스터 ${Game.monsters.length}/${Game.maxField()}`;
            UIKit.text(ctx, note, cx, h / 2 + 24, 20, T.creamSoft, 'center');
        }
        ctx.restore();
    },

    // 소환 칸: 가운데 금장 틀에서 가장 큰 금테 칸(왼쪽 위 단축키 S, 아이콘, 값). 오른쪽에 맵 몬스터 수(현재 수/상한)
    drawSummonButton(ctx, b, st) {
        const G = Game;
        const T = UI_THEME;
        const cost = G.summonCost();
        const dy = st.pressed ? 2 : 0;
        UIKit.slot(ctx, b.x, b.y + dy, b.w, b.h, b.disabled ? 'iron' : 'gold', st.hover && !st.pressed ? 'hover' : null);
        if (!b.disabled) {
            // 칸 안쪽 보랏빛 마법진 빛
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(b.x + 68, b.y + b.h / 2 + dy, 6, b.x + 68, b.y + b.h / 2 + dy, 70);
            g.addColorStop(0, `rgba(190,110,255,${0.32 + Math.sin(G.time * 3) * 0.08})`);
            g.addColorStop(1, 'rgba(190,110,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(b.x + 8, b.y + 8 + dy, b.w - 16, b.h - 16);
            ctx.restore();
        }
        const pulse = !b.disabled && G.monsters.length === 0 ? Math.sin(G.time * 5) * 0.5 + 0.5 : 0;
        if (pulse > 0) {
            ctx.save();
            ctx.globalAlpha = pulse * 0.8;
            UIKit.gradeFrame(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, '#ffe08a', 4);
            ctx.restore();
        }
        ctx.save();
        if (b.disabled) ctx.globalAlpha = 0.55;
        UIKit.icon(ctx, 'summon', b.x + 18, b.y + (b.h - 96) / 2 + dy, 2);
        ctx.restore();
        this.drawKeyCap(ctx, 'S', b.x + 6, b.y + 6 + dy, 16);
        const tx = b.x + 126;
        UIKit.text(ctx, '소환', tx, b.y + 34 + dy, 34, b.disabled ? '#b4bdd2' : T.cream, 'left', 'bold');
        if (b.full) {
            UIKit.text(ctx, '자리 없음', tx, b.y + 76 + dy, 24, T.bad, 'left', 'bold');
        } else {
            UIKit.bigText(ctx, `${cost}G`, tx, b.y + 76 + dy, 32, G.gold < cost ? T.bad : T.gold, 'left', G.gold < cost ? null : '#fff4c0');
        }
        // 맵 몬스터 수: 상한에 닿으면 빨갛게
        const n = G.monsters.length;
        UIKit.text(ctx, '맵 몬스터', FIELD_COUNT_X, b.y + 24, 19, T.creamSoft);
        UIKit.bigText(ctx, `${n}/${G.maxField()}`, FIELD_COUNT_X, b.y + 70, 38, b.full ? T.bad : T.cream, 'left');
        if (st.hover) {
            const o = G.summonOdds();
            const odds = GRADE_ORDER.filter(g => o[g] > 0).map(g => `${MONSTER_GRADES[g].name} ${Math.round(o[g] * 100)}%`).join(' · ');
            this.drawTooltip(ctx, b.x, b.y - 100, `몬스터 소환 · ${cost}G`, odds);
        }
    },

    // 소환 강화 칸: 지금 단계, 다음 비용. 마우스를 올리면 지금과 다음 확률
    drawSummonUpgrade(ctx, b, st) {
        const G = Game;
        const T = UI_THEME;
        const dy = st.pressed ? 2 : 0;
        const cost = G.summonUpgradeCost();
        UIKit.slot(ctx, b.x, b.y + dy, b.w, b.h, 'iron', st.hover && !st.pressed ? 'hover' : null);
        this.drawKeyCap(ctx, 'U', b.x + 6, b.y + 6 + dy, 16);
        UIKit.text(ctx, '소환 강화', b.x + b.w / 2 + 8, b.y + 24 + dy, 19, T.creamSoft, 'center', 'bold');
        UIKit.bigText(ctx, `${G.summonLevel + 1}단계`, b.x + b.w / 2, b.y + 56 + dy, 30, T.cream, 'center');
        if (cost === null) UIKit.text(ctx, '최고 단계', b.x + b.w / 2, b.y + 86 + dy, 20, T.gold, 'center', 'bold');
        else UIKit.text(ctx, `${cost}G`, b.x + b.w / 2, b.y + 86 + dy, 24, G.gold < cost ? T.bad : T.gold, 'center', 'bold');
        if (st.hover) {
            const line = odds => GRADE_ORDER.filter(g => odds[g] > 0).map(g => `${MONSTER_GRADES[g].name} ${Math.round(odds[g] * 100)}%`).join(' · ');
            const next = SUMMON_LEVELS[G.summonLevel + 1];
            this.drawTooltip(ctx, b.x, b.y - 100, `지금: ${line(SUMMON_LEVELS[G.summonLevel].odds)}`, next ? `다음: ${line(next.odds)}` : '최고 단계입니다');
        }
    },

    // 마왕 탭 스킬 칸: 금테 네모 칸(번개 아이콘 또는 마왕 초상, 왼쪽 위 단축키, 재사용 대기는 아래에서 차오르는 어둠과 큰 숫자),
    // 오른쪽에 이름과 상태. 조준 중이면 칸 둘레가 빛난다
    drawSkillButton(ctx, b, st) {
        const T = UI_THEME;
        const lightning = b.skill === 'lightning';
        const cd = Game.skills[b.skill];
        const max = Game.skillCooldown(b.skill);
        const locked = !lightning && Game.roarLocked();
        const active = lightning && this.targeting;
        const dy = st.pressed ? 2 : 0;
        const ss = b.h;
        const sx = b.x;
        const sy = b.y + dy;
        if (active) {
            ctx.save();
            ctx.globalAlpha = 0.6 + Math.sin(Game.time * 8) * 0.3;
            UIKit.gradeFrame(ctx, sx - 6, sy - 6, ss + 12, ss + 12, '#9fe0ff', 4);
            ctx.restore();
        }
        UIKit.slot(ctx, sx, sy, ss, ss, cd > 0 || locked ? 'iron' : 'gold', st.hover && !st.pressed ? 'hover' : null);
        if (lightning) UIKit.icon(ctx, 'bolt', sx + (ss - 96) / 2, sy + (ss - 96) / 2, 2);
        else this.drawLordPortrait(ctx, Game.lordDef(), sx + 10, sy + 10, ss - 20);
        if (cd > 0 || locked) {
            const ratio = locked ? 1 : cd / max;
            ctx.fillStyle = 'rgba(5,9,24,0.7)';
            ctx.fillRect(sx + 8, sy + 8 + (ss - 16) * (1 - ratio), ss - 16, (ss - 16) * ratio);
            if (locked) UIKit.icon(ctx, 'lock', sx + (ss - 48) / 2, sy + (ss - 48) / 2);
            else UIKit.bigText(ctx, String(Math.ceil(cd)), sx + ss / 2, sy + ss / 2, 40, '#ffffff', 'center');
        }
        this.drawKeyCap(ctx, lightning ? 'Q' : 'W', sx + 6, sy + 6, 16);
        const tx = sx + ss + 14;
        const name = lightning ? '번개' : '호통';
        UIKit.text(ctx, name, tx, b.y + 34 + dy, 26, locked ? T.creamSoft : T.cream, 'left', 'bold');
        let status = '준비됨';
        let color = T.good;
        if (active) { status = '조준 중'; color = '#9fe0ff'; }
        else if (locked) { status = `체력 ${COMBAT_RULES.roar.unlockHp} 이하`; color = T.creamSoft; }
        else if (cd > 0) { status = `${Math.ceil(cd)}초`; color = T.bad; }
        UIKit.text(ctx, status, tx, b.y + 74 + dy, 20, color, 'left', 'bold');
        if (st.hover) {
            const title = lightning ? '마왕의 번개' : '마왕의 호통';
            const desc = lightning ? `범위 피해 ${Math.round(Game.lightningDamage())}, 재사용 ${Math.round(max * 10) / 10}초`
                : `모든 용사 ${COMBAT_RULES.roar.duration}초 정지, 체력 ${COMBAT_RULES.roar.unlockHp} 이하, 재사용 ${Math.round(max * 10) / 10}초`;
            this.drawTooltip(ctx, b.x, b.y - 100, title, desc);
        }
    },

    // 설명 창(남색, 금테): 제목과 설명 한 줄. titleColor는 제목 색
    drawTooltip(ctx, x, y, title, desc, titleColor) {
        UIKit.note(ctx, x, y, 430, 82);
        UIKit.ink(ctx, title, x + 20, y + 26, 22, titleColor || UI_THEME.gold, 'left', 'bold');
        UIKit.ink(ctx, desc, x + 20, y + 56, 18, UI_THEME.ink);
    },

    // 탭: 켜진 탭은 밝은 은청색에 금테와 흰 굵은 글자, 꺼진 탭은 어두운 남색에 흐린 글자. 아이콘이 있으면 왼쪽에
    drawTabButton(ctx, b, st) {
        const on = b.on !== undefined ? b.on : this.tab === b.tab; // 도감 탭은 on을 함께 넘긴다
        const kind = on ? 'tab' : 'tabOff';
        const dy = UIKit.button(ctx, b.x, b.y, b.w, b.h, kind, st);
        const size = b.tab === 'collection' ? 28 : 22;
        ctx.font = `bold ${size}px ${UI_FONT}`;
        const lw = ctx.measureText(b.label).width;
        const iw = b.icon ? 46 : 0;
        const lx = b.x + b.w / 2 - (lw + iw) / 2;
        ctx.save();
        if (!on) ctx.globalAlpha = 0.6;
        if (b.icon) UIKit.icon(ctx, b.icon, lx - 6, b.y + (b.h - 48) / 2 + dy + 1);
        ctx.restore();
        UIKit.text(ctx, b.label, lx + iw, b.y + b.h / 2 + 1 + dy, size, on ? '#ffffff' : '#9aa6c4', 'left', 'bold');
    },

    drawUpgradeButton(ctx, b, st) {
        const kind = b.disabled ? 'off' : 'silver';
        const dy = UIKit.button(ctx, b.x, b.y, b.w, b.h, kind, st);
        UIKit.text(ctx, b.upgrade.name, b.x + 18, b.y + 26 + dy, 23, UIKit.buttonInk(kind));
        UIKit.text(ctx, b.upgrade.desc, b.x + 18, b.y + 56 + dy, 18, UI_THEME.creamSoft);
        UIKit.text(ctx, `${b.upgrade.cost}G`, b.x + b.w - 16, b.y + 26 + dy, 23, b.disabled ? UI_THEME.bad : UI_THEME.gold, 'right');
    },

    // 지금 보여 줄 안내: { key, text } 또는 null. 문장은 한 줄로 짧게
    currentHint() {
        const G = Game;
        if (G.bossReward) return null;
        if (this.targeting) return { key: 'target', text: '번개 떨어뜨릴 곳을 누르세요 · Esc 취소' };
        if (this.drag) return { key: 'drag', text: '빈 칸으로 옮기거나 몬스터 위에 놓아 합치기 · 왕좌는 제물' };
        if (this.equipDrag) return { key: 'equipDrag', text: '몬스터 위에 놓으면 끼웁니다' };
        if (G.equipBag.length && G.monsters.length && !G.monsters.some(m => m.equip)) return { key: 'bag', text: '보관함의 장비를 몬스터 위로 끌어 끼우세요' };
        if (G.waveIndex === 0 && G.state === 'prep' && G.monsters.length === 0) return { key: 'summon', text: `소환(S)하면 길 옆에 몬스터가 나옵니다 · ${G.summonCost()}G` };
        if (G.waveIndex === 0 && G.state === 'prep' && G.stats.merged === 0 && G.monsters.length >= 2) return { key: 'merge', text: `같은 등급 몬스터 위에 놓으면 ${MERGE_RULES.gradeCount}마리가 합쳐집니다 · 조합식은 2마리` };
        if (G.state === 'prep' && G.hp < G.maxHp() && G.stats.sacrificed === 0 && G.monsters.length > 0) return { key: 'sacrifice', text: '몬스터를 왕좌로 끌어 바치면 체력을 회복합니다' };
        if (G.state === 'wave' && G.waveIndex === 0 && G.skills.lightning <= 0) return { key: 'lightning', text: '마왕 탭의 번개(Q)로 용사를 직접 때리세요' };
        if (CORRUPTION_ENABLED && G.corpses.length > 0 && !this.corruptHintShown) return { key: 'corrupt', text: '쓰러진 용사를 5초 안에 누르면 부하가 됩니다!' };
        return null;
    },

    // 안내 쪽지가 새로 나타날 때마다 종류별로 센다. HINT_SHOWS번 넘게 나온 안내는 더 보이지 않는다
    updateHint() {
        const h = Game.inPlay() ? this.currentHint() : null;
        const key = h ? h.key : null;
        if (key !== this.hintKey && key) this.hintCounts[key] = (this.hintCounts[key] || 0) + 1;
        this.hintKey = key;
    },

    // 화면 위쪽 가운데 안내: 남색 창 한 줄(처음 몇 번만)
    drawHints(ctx) {
        const h = this.currentHint();
        if (!h || (this.hintCounts[h.key] || 0) > HINT_SHOWS) return;
        ctx.font = `24px ${UI_FONT}`;
        const w = Math.ceil((ctx.measureText(h.text).width + 64) / 8) * 8;
        const bob = Math.round(Math.sin(Game.time * 3) * 2);
        const y = 150 + bob;
        UIKit.note(ctx, GAME_WIDTH / 2 - w / 2, y, w, 56, { pin: true });
        UIKit.ink(ctx, h.text, GAME_WIDTH / 2, y + 30, 24, UI_THEME.ink, 'center');
    },

    // 화면 좌표: 맵 몬스터 머리 위(배지 자리)
    monsterTopScreen(m) {
        return { x: m.x * WORLD_ZOOM, y: (m.y + MONSTER_FOOT - MONSTERS[m.type].art.barY - 26) * WORLD_ZOOM };
    },

    // 고르거나 끄는 동안 합칠 수 있는 몬스터 위의 배지: 공개 조합식은 결과 그림(금 칸), 등급 합치기는 다음 등급 '?'
    drawMergeBadges(ctx) {
        const focus = this.focus();
        if (!focus || !Game.inPlay()) return;
        const badge = (x, y, plan, hot) => {
            const s = hot ? 56 : 44;
            const bx = Math.round(x - s / 2);
            const by = Math.round(y - s);
            const bob = Math.round(Math.sin(Game.time * 4 + x) * 2);
            if (plan.kind === 'recipe') {
                UIKit.slot(ctx, bx - 6, by - 6 + bob, s + 12, s + 12, 'gold');
                this.drawMonsterIcon(ctx, plan.result, bx, by + bob, s);
            } else {
                const color = MONSTER_GRADES[plan.grade].color;
                UIKit.slot(ctx, bx - 4, by - 4 + bob, s + 8, s + 8, 'iron');
                UIKit.gradeFrame(ctx, bx, by + bob, s, s, color, 4);
                UIKit.text(ctx, '?', x, by + s / 2 + bob, hot ? 34 : 28, color, 'center');
            }
        };
        const hotMonster = this.drag && this.dropTarget && this.dropTarget.monster;
        for (const m of Game.monsters) {
            if (focus.loc.monster === m || m.reveal > 0) continue;
            const plan = this.shownPlan(focus.loc.monster, m, this.drag ? this.drag.extra : null);
            if (plan.kind !== 'recipe' && plan.kind !== 'grade') continue;
            const p = this.monsterTopScreen(m.down > 0 ? { ...m, x: m.homeX, y: m.homeY } : m);
            badge(p.x, p.y, plan, hotMonster === m);
        }
        // 끄는 중 놓을 곳 설명: 합치면 무엇이 되는지, 왜 안 되는지. 남색 작은 창에
        if (!this.drag || !this.dropTarget) return;
        const act = this.dropAction(this.dropTarget);
        let text = null;
        let color = UI_THEME.ink;
        if (act.action === 'sacrifice') {
            // 실제로 얻는 효과(체력은 최대치까지만)
            const room = Math.max(0, Game.maxHp() - Game.hp);
            const heal = Math.min(act.gain.heal, room);
            text = `제물: ${sacrificeText({ heal, lightning: act.gain.lightning })}${room === 0 ? ' (체력 가득)' : ''}`;
            color = UI_THEME.inkWax;
        } else if (act.action === 'merge') {
            const n = act.materials.length;
            text = act.plan.kind === 'recipe' ? `합치기 → ${MONSTERS[act.plan.result].name}`
                : (act.plan.kind === 'grade' ? `${n}마리 합치기 → ${MONSTER_GRADES[act.plan.grade].name} 무작위` : '합치기 → ???');
            color = act.plan.kind === 'grade' ? MONSTER_GRADES[act.plan.grade].ink : UI_THEME.ink;
        } else if (act.action === 'invalid' && act.real) {
            const r = act.real;
            const g = r.grade ? MONSTER_GRADES[r.grade] : null;
            text = {
                top: '합칠 수 없음 · 최고 등급', mismatch: '합칠 수 없음',
                count: `합칠 수 없음 · 같은 등급 ${r.count}마리 필요(${r.have}마리)`,
                unique: g ? `합칠 수 없음 · ${g.name}은 맵에 ${g.fieldMax}마리` : '합칠 수 없음'
            }[r.reason] || null;
            color = UI_THEME.inkBad;
        }
        if (text) {
            // 손가락 아래쪽에 띄운다. 하단 바 근처에서는 위쪽에 띄운다
            const keep = act.action === 'merge' ? Game.mergeEquipAll(act.materials).keep : null;
            ctx.font = `bold 26px ${UI_FONT}`;
            const tw = ctx.measureText(text).width;
            const w = Math.ceil((tw + 48 + (keep ? 44 : 0)) / 8) * 8;
            const x = clamp(this.mouse.x, w / 2 + 12, GAME_WIDTH - w / 2 - 12);
            const y = this.mouse.y > GAME_HEIGHT - 260 ? this.mouse.y - 150 : this.mouse.y + 70;
            UIKit.note(ctx, x - w / 2, y - 26, w, 52);
            UIKit.ink(ctx, text, x - w / 2 + 24, y + 2, 26, color, 'left', 'bold');
            // 합치면 결과가 이어받을 장비: 글자 오른쪽에 작은 칸
            if (keep) {
                const ex = Math.round(x - w / 2 + 32 + tw);
                const ey = Math.round(y - 15);
                UIKit.slot(ctx, ex, ey, 32, 32, 'iron');
                this.drawEquipIcon(ctx, keep, ex + 4, ey + 4, 0.5);
                UIKit.gradeFrame(ctx, ex + 1, ey + 1, 30, 30, MONSTER_GRADES[EQUIPMENT[keep].grade].color, 2);
            }
        }
    },

    // 끄는 몬스터 그림(손가락을 따라감)과 놓지 못해 제자리로 돌아가는 그림
    drawDragged(ctx) {
        const draw = (type, sx, sy, alpha) => {
            const def = MONSTERS[type];
            const ghost = { x: sx / WORLD_ZOOM, y: sy / WORLD_ZOOM, dir: 'down', atkPose: 0, anim: Game.time, moving: false };
            const { clip, name } = Render.monsterFrame(def, ghost);
            ctx.save();
            ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
            ctx.globalAlpha = alpha;
            Render.monsterBody(ctx, def, ghost, Assets.get(name), clip);
            ctx.restore();
        };
        for (const r of this.returning) {
            const k = clamp(r.age / r.life, 0, 1);
            const e = 1 - (1 - k) * (1 - k);
            draw(r.type, r.x + (r.to.x - r.x) * e, r.y + 20 + (r.to.y - 10 - r.y - 20) * e, 0.85 * (1 - k * 0.5));
        }
        // 끄는 장비: 손가락 오른쪽 아래에 원래 크기로(놓을 몬스터를 가리지 않게), 놓을 몬스터가 있으면 끼우기·맞바꾸기 안내
        const ed = this.equipDrag;
        if (ed && ed.x !== undefined) {
            this.drawEquipSlot(ctx, ed.id, ed.x + 14, ed.y + 4, 56, true, false);
            const m = this.equipTarget;
            if (m) {
                const name = MONSTERS[m.type].name;
                const text = m.equip ? `맞바꾸기 → ${name} (${EQUIPMENT[m.equip].name}은 보관함으로)` : `끼우기 → ${name}`;
                ctx.font = `bold 24px ${UI_FONT}`;
                const w = Math.ceil((ctx.measureText(text).width + 48) / 8) * 8;
                const x = clamp(ed.x, w / 2 + 12, GAME_WIDTH - w / 2 - 12);
                const y = ed.y > GAME_HEIGHT - 260 ? ed.y - 110 : ed.y + 90;
                UIKit.note(ctx, x - w / 2, y - 25, w, 50);
                UIKit.ink(ctx, text, x, y + 2, 24, MONSTER_GRADES[EQUIPMENT[ed.id].grade].ink, 'center', 'bold');
            }
        }
        if (!this.drag || this.drag.x === undefined) return;
        // 놓을 수 있는 칸 위에서는 칸에 붙은 반투명 그림(drawRanges)만 보인다
        if (this.hoverCell && this.canPlaceAt(this.hoverCell.col, this.hoverCell.row)) return;
        draw(this.drag.type, this.drag.x, this.drag.y + 20, 0.9);
    },

    // 소환과 합치기 연출. 다른 몬스터와 HUD 위에도 보이도록 화면 맨 위에 세계 배율로 그린다
    popPoint(pt) {
        return { x: pt.x, y: pt.y - 30 };
    },

    drawPops(ctx) {
        if (!Fx.pops.length) return;
        ctx.save();
        ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
        for (const p of Fx.pops) Render.drawPop(ctx, p, pt => this.popPoint(pt));
        ctx.restore();
    },

    // "히든 조합 발견!": 화면 가운데 남색 띠, 재료 두 마리(랭크 조건이 있으면 이름 뒤에)와 결과.
    // 등급 표의 fx가 2 이상(전설, 신화)이면 띠와 결과 그림이 더 크고, 빛줄기가 많고 "전설 등급" 글자가 붙고 반짝이가 쏟아진다.
    // 신화(fx 3)는 더 크고 빛줄기가 붉은 무지개 색으로 돈다
    drawDiscovery(ctx) {
        const d = Fx.discovery;
        if (!d || d.age < 0) return;
        const T = UI_THEME;
        const fx = gradeInfo(d.grade, 'fx', 0);
        const legend = fx >= 2;
        const myth = fx >= 3;
        const rainbow = gradeInfo(d.grade, 'rainbow', null);
        const a = clamp(Math.min(d.age / 0.2, (d.life - d.age) / 0.4), 0, 1);
        const cx = GAME_WIDTH / 2;
        const cy = 520;
        const half = myth ? 340 : (legend ? 300 : 230);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = T.dimLight;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        UIKit.plank(ctx, -40, cy - half + 30, GAME_WIDTH + 80, half * 2 - 60);
        // 결과 뒤에서 도는 빛줄기
        const rx = cx + 250;
        const ry = cy + 40;
        const rays = myth ? 40 : (legend ? 28 : 16);
        const len = myth ? 700 : (legend ? 520 : 320);
        const color = MONSTER_GRADES[d.grade] ? MONSTER_GRADES[d.grade].glow : '255,215,106';
        const rayColor = i => (rainbow ? hexRgb(rainbow[i % (rainbow.length - 1)]) : color);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, cy - half + 30, GAME_WIDTH, half * 2 - 60);
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < rays; i++) {
            const ang = d.age * (legend ? 0.9 : 0.7) + i / rays * Math.PI * 2;
            ctx.fillStyle = `rgba(${rayColor(i)},${i % 2 ? 0.2 : 0.12})`;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + Math.cos(ang - 0.08) * len, ry + Math.sin(ang - 0.08) * len);
            ctx.lineTo(rx + Math.cos(ang + 0.08) * len, ry + Math.sin(ang + 0.08) * len);
            ctx.closePath();
            ctx.fill();
        }
        const glow = ctx.createRadialGradient(rx, ry, 10, rx, ry, myth ? 320 : (legend ? 260 : 180));
        glow.addColorStop(0, `rgba(${color},0.55)`);
        glow.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(rx - 300, ry - 300, 600, 600);
        // 쏟아지는 반짝이(도트)
        for (let i = 0; i < (myth ? 110 : (legend ? 60 : 30)); i++) {
            const k = (d.age * 0.6 + i * 0.137) % 1;
            const px = rx + Math.cos(i * 2.4) * (60 + k * (legend ? 480 : 320));
            const py = ry + Math.sin(i * 2.4) * (40 + k * (legend ? 220 : 160));
            ctx.globalAlpha = a * (1 - k);
            ctx.fillStyle = i % 3 ? `rgb(${rayColor(i)})` : '#ffffff';
            const s = i % 4 === 0 ? 8 : 4;
            ctx.fillRect(Math.round(px), Math.round(py), s, s);
        }
        ctx.restore();
        const pop = d.age < 0.25 ? 1.5 - d.age / 0.25 * 0.5 : 1;
        const titleY = cy - (myth ? 200 : (legend ? 168 : 124));
        UIKit.bigText(ctx, '히든 조합 발견!', cx, titleY, Math.round((myth ? 128 : (legend ? 112 : 92)) * pop), T.gold, 'center', '#fff4c0');
        if (legend) UIKit.bigText(ctx, `${MONSTER_GRADES[d.grade].name} 등급`, cx, titleY + (myth ? 96 : 84), myth ? 56 : 44, MONSTER_GRADES[d.grade].light, 'center', '#ffffff');
        const icon = (type, rank, x, size) => {
            this.drawMonsterIcon(ctx, type, x - size / 2, ry - size / 2, size);
            const big = size > 100;
            const label = MONSTERS[type].name + (rank ? ` ${rank}` : '');
            UIKit.text(ctx, label, x, ry + size / 2 + 28, big ? 32 : 24, big ? MONSTER_GRADES[MONSTERS[type].grade].light : T.cream, 'center', 'bold');
        };
        if (d.parts) {
            // 재료가 여럿인 조합식: 일반 x2 + 영웅 + S랭크 전설
            const p = d.parts[0];
            icon(p.type, null, cx - 560, 96);
            UIKit.bigText(ctx, `x${p.count}`, cx - 492, ry + 30, 34, T.gold, 'left');
            UIKit.bigText(ctx, '+', cx - 395, ry, 48, T.cream, 'center');
            icon(d.b, d.bRank, cx - 280, 96);
            UIKit.bigText(ctx, '+', cx - 165, ry, 48, T.cream, 'center');
            icon(d.a, d.aRank, cx - 50, 96);
        } else {
            icon(d.a, d.aRank, cx - 400, 96);
            UIKit.bigText(ctx, '+', cx - 275, ry, 56, T.cream, 'center');
            icon(d.b, d.bRank, cx - 150, 96);
        }
        UIKit.bigText(ctx, '=', cx + (d.parts ? 75 : 40), ry, 56, T.gold, 'center');
        if (myth) UIKit.gradeFrame(ctx, rx - 124, ry - 124, 248, 248, MONSTER_GRADES[d.grade].color, 8);
        icon(d.type, null, rx, myth ? 230 : (legend ? 200 : 152));
        ctx.restore();
    },

    // 라운드 완료(남색 창)와 보스 등장(남색 띠에 금테 초상, 빨간 경고와 큰 이름)
    drawBanner(ctx) {
        const b = Fx.banner;
        if (!b) return;
        const T = UI_THEME;
        const a = clamp(Math.min(b.age / 0.15, (b.life - b.age) / 0.3), 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        if (b.small) {
            const w = 520;
            const x = GAME_WIDTH / 2 - w / 2;
            const pop = b.age < 0.15 ? 1.25 - b.age / 0.15 * 0.25 : 1;
            UIKit.note(ctx, x, 196, w, 116, { pin: true });
            UIKit.bigText(ctx, b.name, GAME_WIDTH / 2, 240, Math.round(46 * pop), T.gold, 'center', '#fff4c0');
            UIKit.text(ctx, b.sub, GAME_WIDTH / 2, 286, 26, T.cream, 'center', 'bold');
        } else {
            const slide = (1 - a) * 80;
            UIKit.plank(ctx, -40, 380, GAME_WIDTH + 80, 240);
            ctx.fillStyle = 'rgba(200,30,50,0.18)';
            ctx.fillRect(0, 386, GAME_WIDTH, 228);
            if (b.portrait) {
                UIKit.waxFrame(ctx, 404 - slide, 396, 208);
                this.drawPortrait(ctx, b.portrait, 412 - slide, 404, 192);
            }
            UIKit.text(ctx, b.sub, 660 + slide, 450, 32, '#ff8a78', 'left', 'bold');
            UIKit.bigText(ctx, b.name, 660 + slide, 530, 88, '#ffffff', 'left', '#ffe0d8');
        }
        ctx.restore();
    },

    drawTitle(ctx) {
        const T = UI_THEME;
        ctx.fillStyle = T.dimLight;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        const lift = Math.round(Math.sin(Game.time * 1.4) * 4);
        // 제목: 흰 글자에 금 테와 진한 남색 외곽선, 아래로 진한 그림자
        ctx.save();
        ctx.font = `bold 150px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 30;
        ctx.strokeStyle = T.outline;
        ctx.strokeText('던전 수호대', cx, 318 + lift);
        ctx.lineWidth = 26;
        ctx.strokeText('던전 수호대', cx, 310 + lift);
        ctx.lineWidth = 12;
        ctx.strokeStyle = T.goldLine;
        ctx.strokeText('던전 수호대', cx, 310 + lift);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('던전 수호대', cx, 310 + lift);
        ctx.restore();
        this.drawHexPlate(ctx, cx - 470, 408, 940, 68);
        UIKit.text(ctx, '용사들이 또 왔습니다. 마왕의 왕좌를 지키세요.', cx, 443, 30, T.cream, 'center');
        UIKit.panel(ctx, GAME_WIDTH - 330, 18, 300, 72);
        UIKit.text(ctx, `스토리 ${Meta.data.cleared.length} / ${STAGES.length}`, GAME_WIDTH - 180, 55, 30, T.gold, 'center', 'bold');
    },

    drawResult(ctx) {
        const G = Game;
        const T = UI_THEME;
        const win = G.state === 'victory';
        ctx.fillStyle = T.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        UIKit.panel(ctx, cx - 440, 130, 880, 740);
        const st = stageDef(G.stage);
        UIKit.bigText(ctx, win ? '왕좌를 지켰습니다!' : '왕좌가 무너졌습니다', cx, 200, 58, win ? T.gold : '#ff9a8a', 'center', win ? '#fff4c0' : null);
        if (st) UIKit.ink(ctx, `스테이지 ${st.no} · ${st.name}`, cx, 248, 24, T.inkSoft, 'center', 'bold');
        const lord = G.lordDef();
        const portrait = Assets.get(lord.sprite);
        UIKit.gradeFrame(ctx, cx - 400, 268, 276, 276, T.goldLine, 4);
        UIKit.waxFrame(ctx, cx - 398, 270, 272);
        if (portrait) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(portrait, cx - 390, 278, 256, 256);
        }
        const t = Math.round(G.stats.time);
        const rows = [
            ['남은 마왕 체력', `${G.hp} / ${G.maxHp()}`],
            ['처치한 용사', `${G.stats.kills}명`],
            CORRUPTION_ENABLED && ['타락시킨 용사', `${G.stats.corrupted}명`],
            ['소환 / 합치기', `${G.stats.summoned} / ${G.stats.merged}`],
            ['걸린 시간', `${Math.floor(t / 60)}분 ${t % 60}초`]
        ].filter(Boolean);
        if (!win) rows.splice(0, 1, ['막아 낸 라운드', `${G.waveIndex} / ${G.waves.length}`]);
        rows.forEach(([k, v], i) => {
            UIKit.ink(ctx, k, cx - 100, 310 + i * 52, 24, T.inkSoft);
            UIKit.ink(ctx, v, cx + 390, 310 + i * 52, 34, T.ink, 'right', 'bold');
        });
        // 스테이지 결과: 처음 깼으면 풀린 것, 다시 깼으면 해금은 처음 한 번뿐이라는 안내, 지면 다시 도전 안내
        const res = G.runResult;
        let line = win ? '"고생했다. 다음 지역은 2단계에서 만들어 두마."' : '"내 의자 다시 사 와."';
        if (st && res) {
            ctx.fillStyle = T.parchmentDark;
            ctx.fillRect(cx - 390, 588, 780, 3);
            if (win && res.firstClear) {
                UIKit.ink(ctx, '처음 깸!', cx - 390, 630, 34, T.inkWax, 'left', 'bold');
                // 풀린 것이 많으면(3개 이상) 아이콘을 줄이고 이름은 아이콘 아래 한 줄로
                const many = res.unlocks.length > 2;
                const size = many ? 64 : 72;
                res.unlocks.forEach((u, i) => this.drawUnlockIcon(ctx, u, cx - 200 + i * (size + 16), 598, size));
                const names = res.unlocks.map(u => this.unlockInfo(u).name).join(' · ');
                if (many) UIKit.ink(ctx, names, cx - 200, 686, 20, T.ink, 'left', 'bold');
                else UIKit.ink(ctx, names, cx - 200 + res.unlocks.length * 92 + 8, 636, 22, T.ink, 'left', 'bold');
            } else if (win) {
                UIKit.ink(ctx, '다시 깸 · 해금은 처음 깰 때만 받습니다', cx, 630, 24, T.inkSoft, 'center', 'bold');
            } else {
                UIKit.ink(ctx, '다시 도전하면 시작 전 대화 없이 바로 시작합니다', cx, 630, 22, T.inkSoft, 'center');
            }
            const next = nextStage(st.id);
            if (win && !next) line = '"이야기는 끝! 이제 본부의 도전의 문이다."';
            else if (win) line = `"다음은 ${next.no}. ${next.name}. 쉬지 마라."`;
        }
        UIKit.ink(ctx, line, cx, 726, 24, T.ink, 'center');
    },

    // ----- 스토리 그리기 -----

    // 해금 항목 그림: 마왕은 금테 액자 초상, 유물은 은테 칸의 유물, 유물 칸은 금 칸에 가방, 엔딩은 책
    drawUnlockIcon(ctx, u, x, y, size) {
        if (u.kind === 'lord') {
            UIKit.waxFrame(ctx, x, y, size);
            this.drawLordPortrait(ctx, DEMON_LORDS[u.id], x + 8, y + 8, size - 16);
            return;
        }
        UIKit.slot(ctx, x, y, size, size, u.kind === 'relic' ? 'iron' : 'gold');
        const k = Math.max(1, Math.floor((size - 8) / 48));
        const o = (size - 48 * k) / 2;
        if (u.kind === 'relic') {
            const img = Assets.get(`relic_${u.id}`);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, Math.round(x + o), Math.round(y + o), 48 * k, 48 * k);
            }
        } else {
            UIKit.icon(ctx, u.kind === 'slot' ? 'bag' : 'book', x + o, y + o, k);
            if (u.kind === 'slot') UIKit.text(ctx, '+1', x + size - 6, y + size - 12, Math.round(size / 4), UI_THEME.gold, 'right');
        }
    },

    // 해금 항목의 이름과 종류
    unlockInfo(u) {
        if (u.kind === 'lord') return { kind: '마왕', name: DEMON_LORDS[u.id].name };
        if (u.kind === 'relic') return { kind: '유물', name: RELICS[u.id].name };
        if (u.kind === 'slot') return { kind: '유물 칸', name: '유물 칸 +1' };
        return { kind: '엔딩', name: '1부 끝' };
    },

    // 스토리 지도: 남색 창에 이야기 제목, 점선 길, 스테이지 메달. 아래 창에 고른 스테이지 설명과 처음 깰 때의 보상
    drawStoryMap(ctx) {
        const T = UI_THEME;
        const M = STORY_MAP;
        this.drawTable(ctx);
        this.drawHexPlate(ctx, GAME_WIDTH / 2 - 220, 26, 440, 62);
        UIKit.text(ctx, '스토리 지도', GAME_WIDTH / 2, 58, 34, T.cream, 'center', 'bold');
        UIKit.panel(ctx, M.x, M.y, M.w, M.h);
        const done = STAGES.every(st => Meta.isCleared(st.id));
        UIKit.bigText(ctx, STORY_TITLE.name, M.x + M.w / 2, M.y + 78, 42, done ? T.gold : T.cream, 'center');
        UIKit.ink(ctx, STORY_TITLE.sub, M.x + M.w / 2, M.y + 120, 19, T.inkSoft, 'center');
        // 점선 길: 깬 구간은 금색, 나머지는 흐린 색
        for (let i = 1; i < STAGES.length; i++) {
            const a = STAGES[i - 1].map;
            const b = STAGES[i].map;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            ctx.fillStyle = Meta.isCleared(STAGES[i - 1].id) ? T.goldLine : T.inkFaint;
            for (let t = STAMP_R + 10; t < len - STAMP_R - 6; t += 20) {
                const px = a[0] + (b[0] - a[0]) * t / len;
                const py = a[1] + (b[1] - a[1]) * t / len;
                ctx.fillRect(Math.round(px) - 4, Math.round(py) - 4, 8, 8);
            }
        }
        // 메달: 깸은 금 고리 붉은 보석, 열림은 밝은 은청색(다음 스테이지는 숨쉬는 금 고리), 잠김은 어두운 판에 자물쇠
        for (const st of STAGES) {
            const [x, y] = st.map;
            const cleared = Meta.isCleared(st.id);
            const open = Meta.isOpen(st.id);
            const picked = this.storyPick === st.id;
            const hover = this.hoverButton && this.hoverButton.stamp === st.id;
            const disc = (r, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            };
            if (picked) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(x, y, STAMP_R, x, y, STAMP_R + 40);
                g.addColorStop(0, 'rgba(255,210,90,0.5)');
                g.addColorStop(1, 'rgba(255,210,90,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - STAMP_R - 40, y - STAMP_R - 40, STAMP_R * 2 + 80, STAMP_R * 2 + 80);
                ctx.restore();
                disc(STAMP_R + 12, T.goldLight);
            }
            if (cleared) {
                this.drawWaxSeal(ctx, x, y, STAMP_R);
                UIKit.bigText(ctx, String(st.no), x, y + 2, 40, '#ffffff', 'center');
            } else if (open) {
                const pulse = 4 + Math.round((Math.sin(Game.time * 3) + 1) * 3);
                ctx.strokeStyle = T.goldLine;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(x, y, STAMP_R + pulse, 0, Math.PI * 2);
                ctx.stroke();
                disc(STAMP_R + 3, T.outline);
                disc(STAMP_R, hover ? '#cfe0ff' : '#a9c2f0');
                disc(STAMP_R - 6, hover ? '#e8f0ff' : '#d6e4ff');
                UIKit.ink(ctx, String(st.no), x, y + 2, 42, '#14204a', 'center', 'bold');
            } else {
                disc(STAMP_R + 3, T.outline);
                disc(STAMP_R, '#2a3654');
                ctx.save();
                ctx.globalAlpha = 0.85;
                UIKit.icon(ctx, 'lock', x - 24, y - 26);
                ctx.restore();
            }
            if (st.boss) UIKit.text(ctx, '보스', x + STAMP_R + 8, y - STAMP_R + 8, 18, open ? '#ff8a78' : T.inkFaint, 'left', 'bold');
            // 이름 뒤는 창 색으로 비워 점선 길이 글자를 가로지르지 않게 한다
            ctx.font = `bold 20px ${UI_FONT}`;
            const nw = Math.ceil(ctx.measureText(st.name).width) + 12;
            ctx.fillStyle = T.navy;
            ctx.fillRect(Math.round(x - nw / 2), y + STAMP_R + 13, nw, 26);
            UIKit.ink(ctx, st.name, x, y + STAMP_R + 26, 20, open ? T.ink : T.inkFaint, 'center', 'bold');
            const zone = ZONES[st.zone];
            if (zone) UIKit.ink(ctx, zone.name, x, y + STAMP_R + 50, 16, open ? T.inkSoft : T.inkFaint, 'center');
        }
        this.drawStoryInfo(ctx);
    },

    // 지도 아래 창: 고른 스테이지의 번호, 이름, 지역, 라운드 수, 보스, 처음 깰 때의 보상 아이콘
    drawStoryInfo(ctx) {
        const T = UI_THEME;
        const I = STORY_INFO;
        UIKit.panel(ctx, I.x, I.y, I.w, I.h);
        const st = stageDef(this.storyPick);
        if (!st) return;
        const cleared = Meta.isCleared(st.id);
        const zone = ZONES[st.zone];
        UIKit.text(ctx, `${STORY_TITLE.name} · 스테이지 ${st.no} / ${STAGES.length}${zone ? ` · ${zone.name}` : ''}`, I.x + 50, I.y + 50, 24, T.creamSoft);
        UIKit.text(ctx, st.name, I.x + 50, I.y + 110, 56, T.cream, 'left', 'bold');
        UIKit.icon(ctx, 'wave', I.x + 46, I.y + 154);
        UIKit.text(ctx, `라운드 ${st.waves.length}`, I.x + 102, I.y + 180, 28, T.gold, 'left', 'bold');
        if (st.boss) UIKit.text(ctx, `보스 ${BOSSES[st.boss].name}`, I.x + 280, I.y + 180, 26, T.bad, 'left', 'bold');
        if (cleared) UIKit.text(ctx, '깬 스테이지', I.x + 50, I.y + 222, 20, T.good);
        // 처음 깰 때 보상
        const rx = I.x + 720;
        UIKit.text(ctx, cleared ? '처음 깰 때 받은 것' : '처음 깰 때', rx, I.y + 50, 24, T.cream, 'left', 'bold');
        st.unlocks.forEach((u, i) => {
            const x = rx + i * 150;
            ctx.save();
            if (cleared) ctx.globalAlpha = 0.55;
            this.drawUnlockIcon(ctx, u, x + 30, I.y + 76, 84);
            ctx.restore();
            const info = this.unlockInfo(u);
            UIKit.text(ctx, info.name, x + 72, I.y + 190, 19, cleared ? T.creamSoft : T.cream, 'center');
            UIKit.text(ctx, info.kind, x + 72, I.y + 218, 16, T.creamSoft, 'center');
        });
    },

    // 대화: 맵 위를 어둡게, 위에 스테이지 이름 표지판, 아래 남색 대화창에 왼쪽 초상과 이름표, 한 글자씩 나오는 대사
    drawDialogue(ctx) {
        const T = UI_THEME;
        const D = this.dialogue;
        const B = DIALOGUE_BOX;
        ctx.fillStyle = T.dimLight;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        if (D.title) {
            ctx.font = `bold 32px ${UI_FONT}`;
            const w = Math.ceil(ctx.measureText(D.title).width) + 150;
            this.drawHexPlate(ctx, GAME_WIDTH / 2 - w / 2, 30, w, 70);
            UIKit.text(ctx, D.title, GAME_WIDTH / 2, 66, 32, T.cream, 'center', 'bold');
        }
        const [who, text] = D.lines[D.index];
        const cast = STORY_CAST[who] || { name: who };
        UIKit.panel(ctx, B.x, B.y, B.w, B.h);
        // 초상: 금테 액자(232px)
        const portrait = castPortrait(who);
        UIKit.waxFrame(ctx, B.x + 40, B.y + 36, 232);
        if (portrait) this.drawPortrait(ctx, portrait, B.x + 48, B.y + 44, 216);
        // 이름표: 대화창 위쪽에 걸친 육각 이름판
        ctx.font = `bold 28px ${UI_FONT}`;
        const nw = Math.ceil(ctx.measureText(cast.name).width) + 110;
        this.drawHexPlate(ctx, B.x + 300, B.y - 30, nw, 58);
        UIKit.text(ctx, cast.name, B.x + 300 + nw / 2, B.y - 1, 28, T.gold, 'center', 'bold');
        // 대사: 줄을 먼저 나눈 뒤 나온 글자 수만큼만 보인다
        ctx.font = `34px ${UI_FONT}`;
        const lines = this.wrapLines(ctx, text, B.w - 420);
        let left = Math.floor(D.chars);
        lines.forEach((line, i) => {
            if (left <= 0) return;
            const shown = line.slice(0, left);
            left -= line.length + 1; // 줄 사이 띄어쓰기 한 칸
            UIKit.ink(ctx, shown, B.x + 320, B.y + 82 + i * 50, 34, T.ink);
        });
        const done = D.chars >= text.length;
        if (done && Math.floor(Game.time * 2.5) % 2 === 0) {
            // 다 나오면 오른쪽 아래에 깜빡이는 화살표
            const ax = B.x + B.w - 70;
            const ay = B.y + B.h - 70;
            ctx.fillStyle = T.gold;
            ctx.beginPath();
            ctx.moveTo(ax - 14, ay - 8);
            ctx.lineTo(ax + 14, ay - 8);
            ctx.lineTo(ax, ay + 10);
            ctx.fill();
        }
        UIKit.ink(ctx, `${D.index + 1} / ${D.lines.length} · 클릭·Space 다음 · Esc 건너뛰기`, B.x + B.w - 110, B.y + B.h - 40, 18, T.inkSoft, 'right');
    },

    // 해금 카드: 어둡게 덮은 화면 가운데 남색 카드 한 장. 그림, 종류, 이름, 효과 표에서 만든 설명, 몇 번째 카드인지
    drawUnlockCard(ctx) {
        const T = UI_THEME;
        const C = this.unlockCards;
        const u = C.list[C.index];
        const info = this.unlockInfo(u);
        const U = UNLOCK_CARD;
        const cx = GAME_WIDTH / 2;
        const x = cx - U.w / 2;
        ctx.fillStyle = T.dim;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        UIKit.bigText(ctx, '새로 풀렸습니다!', cx, U.y - 50, 52, T.gold, 'center', '#fff4c0');
        UIKit.panel(ctx, x, U.y, U.w, U.h);
        UIKit.gradeFrame(ctx, x - 6, U.y - 6, U.w + 12, U.h + 12, T.goldLine, 4);
        UIKit.ink(ctx, info.kind, cx, U.y + 60, 26, T.inkSoft, 'center', 'bold');
        let y = U.y + 100;
        if (u.kind === 'lord') {
            const lord = DEMON_LORDS[u.id];
            const img = Assets.get(lord.sprite);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, Math.round(cx - img.width), Math.round(y + 250 - lord.footPx * 2), img.width * 2, img.height * 2);
            }
            y += 270;
        } else {
            this.drawUnlockIcon(ctx, u, cx - 96, y + 20, 192);
            y += 250;
        }
        UIKit.bigText(ctx, info.name, cx, y + 20, 44, T.gold, 'center', '#fff4c0');
        y += 70;
        if (u.kind === 'lord' || u.kind === 'relic') {
            const def = u.kind === 'lord' ? DEMON_LORDS[u.id] : RELICS[u.id];
            y = this.drawEffectLines(ctx, def.effects, cx, y, 26, 36, 'center');
            if (def.desc) {
                ctx.font = `21px ${UI_FONT}`;
                this.wrapLines(ctx, def.desc, U.w - 100).slice(0, 1).forEach(t => UIKit.ink(ctx, t, cx, y + 10, 21, T.inkSoft, 'center'));
            }
            UIKit.ink(ctx, u.kind === 'lord' ? '이제 고르기 화면에서 고를 수 있습니다' : '판을 시작할 때 유물 칸에 넣을 수 있습니다', cx, U.y + U.h - 34, 19, T.inkFaint, 'center');
        } else if (u.kind === 'slot') {
            UIKit.ink(ctx, `유물을 ${Meta.relicSlots()}개까지 들고 시작합니다`, cx, y, 26, T.inkGood, 'center', 'bold');
        } else {
            UIKit.ink(ctx, '메인 스토리를 모두 깼습니다.', cx, y, 26, T.ink, 'center', 'bold');
            UIKit.ink(ctx, '이제 본부의 도전의 문에서 겨루세요.', cx, y + 40, 22, T.inkSoft, 'center');
        }
        if (C.list.length > 1) UIKit.text(ctx, `${C.index + 1} / ${C.list.length}`, cx, U.y + U.h + 20, 22, T.creamSoft, 'center');
    },

    // ----- 도감 그리기 -----

    // 못 본 몬스터의 검은 실루엣(그림의 모양만 진한 남색). 그림마다 한 번 만들어 둔다
    silhouette(img) {
        this.silhouettes = this.silhouettes || new Map();
        let c = this.silhouettes.get(img);
        if (!c) {
            c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0);
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = '#04070f';
            g.fillRect(0, 0, c.width, c.height);
            this.silhouettes.set(img, c);
        }
        return c;
    },

    // 몬스터 그림 칸(본 것) 또는 실루엣 칸(못 본 것, 흐린 테두리)
    drawDexIcon(ctx, type, x, y, size, known) {
        if (known) {
            this.drawMonsterIcon(ctx, type, x, y, size);
            return;
        }
        ctx.fillStyle = '#1a2440';
        ctx.fillRect(x, y, size, size);
        const img = Assets.get(`${MONSTERS[type].sprite}/rotations/south`);
        if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, size, size);
            ctx.clip();
            ctx.imageSmoothingEnabled = false;
            this.drawIconImage(ctx, this.silhouette(img), MONSTERS[type], x, y, size);
            ctx.restore();
        }
        UIKit.gradeFrame(ctx, x, y, size, size, '#3a4868', 3);
    },

    // 금테 상세 창(Asteria 대장간 오른쪽 창처럼): 남색 판에 굵은 금선
    drawDetailFrame(ctx, x, y, w, h) {
        const T = UI_THEME;
        x = Math.round(x);
        y = Math.round(y);
        ctx.fillStyle = T.outline;
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        ctx.fillStyle = '#0c1430';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = T.goldLine;
        ctx.fillRect(x, y, w, 4);
        ctx.fillRect(x, y + h - 4, w, 4);
        ctx.fillRect(x, y, 4, h);
        ctx.fillRect(x + w - 4, y, 4, h);
        ctx.fillStyle = T.goldLight;
        ctx.fillRect(x + 4, y + 4, w - 8, 2);
    },

    drawCollection(ctx) {
        const C = this.collection;
        this.drawTable(ctx);
        UIKit.icon(ctx, 'book', 60, 38);
        UIKit.text(ctx, '도감', 118, 62, 46, UI_THEME.cream, 'left', 'bold');
        if (C.tab === 'monster') this.drawDexMonsters(ctx);
        else this.drawDexRecipes(ctx);
        const pages = this.collectionPages(C.tab);
        if (pages > 1) UIKit.text(ctx, `${C.page + 1} / ${pages}`, GAME_WIDTH / 2, GAME_HEIGHT - 64, 30, UI_THEME.cream, 'center', 'bold');
    },

    // 몬스터 탭: 왼쪽은 등급 색 테두리 칸(그림, 이름, 오른쪽 아래 작은 등급 이름), 오른쪽은 금테 상세 창(마우스를 올린 몬스터).
    // 못 본 것은 실루엣과 ???
    drawDexMonsters(ctx) {
        const T = UI_THEME;
        const ids = Object.keys(MONSTERS);
        const seen = ids.filter(id => Meta.hasSeen(id)).length;
        UIKit.text(ctx, `본 몬스터 ${seen} / ${ids.length}`, 76, 150, 30, T.cream, 'left', 'bold');
        UIKit.text(ctx, '소환, 합치기, 보스 보상으로 맵에 나온 몬스터가 기록됩니다', 420, 152, 19, T.creamSoft);
        const m = this.mouse;
        const cells = this.collectionCells();
        const hot = cells.find(c => m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h);
        const pick = hot || cells.find(c => Meta.hasSeen(c.item)) || null;
        for (const c of cells) {
            const type = c.item;
            const def = MONSTERS[type];
            const known = Meta.hasSeen(type);
            const grade = MONSTER_GRADES[def.grade];
            const on = pick === c;
            UIKit.slot(ctx, c.x, c.y, c.w, c.h, 'iron', on ? 'hover' : null);
            const size = 128;
            this.drawDexIcon(ctx, type, c.x + (c.w - size) / 2, c.y + 14, size, known);
            if (known) {
                UIKit.gradeFrame(ctx, c.x + 2, c.y + 2, c.w - 4, c.h - 4, grade.color, on ? 5 : 3);
                UIKit.text(ctx, grade.name, c.x + c.w - 12, c.y + 130, 16, grade.light, 'right', 'bold');
                ctx.font = `bold 20px ${UI_FONT}`;
                let fs = 20;
                while (fs > 14 && ctx.measureText(def.name).width > c.w - 16) ctx.font = `bold ${--fs}px ${UI_FONT}`;
                UIKit.text(ctx, def.name, c.x + c.w / 2, c.y + 172, fs, grade.light, 'center', 'bold');
            } else {
                UIKit.text(ctx, '???', c.x + c.w / 2, c.y + 172, 22, T.inkFaint, 'center', 'bold');
            }
        }
        // 상세 창
        const D = COL_DETAIL;
        this.drawDetailFrame(ctx, D.x, D.y, D.w, D.h);
        if (!pick || !Meta.hasSeen(pick.item)) {
            UIKit.ink(ctx, pick ? '아직 만나지 못했습니다' : '칸에 마우스를 올리면 자세히 봅니다', D.x + D.w / 2, D.y + D.h / 2, 26, T.inkSoft, 'center', 'bold');
            return;
        }
        const type = pick.item;
        const def = MONSTERS[type];
        const grade = MONSTER_GRADES[def.grade];
        const x = D.x + 36;
        let y = D.y + 36;
        this.drawMonsterIcon(ctx, type, x, y, 192);
        const tx = x + 220;
        UIKit.ink(ctx, '도감 기록', tx, y + 14, 20, T.inkSoft);
        UIKit.bigText(ctx, def.name, tx, y + 58, 40, grade.light, 'left');
        const cw = this.drawGradeChip(ctx, def.grade, tx, y + 104, 18);
        UIKit.ink(ctx, `${MONSTER_ROLES[def.role].name} · ${MONSTER_FAMILIES[def.family] || ''}`, tx + cw + 10, y + 105, 20, T.inkSoft, 'left', 'bold');
        const st = def.stats;
        let sx = tx;
        sx = this.drawStatChip(ctx, 'attack', String(st.damage), '피해', sx, y + 160);
        if (monsterBlocks(type)) this.drawStatChip(ctx, 'hpHeart', String(st.hp), '체력', sx, y + 160);
        else this.drawStatChip(ctx, null, String(st.range), '사거리', sx, y + 160);
        y += 230;
        ctx.fillStyle = T.parchmentDark;
        ctx.fillRect(x, y, D.w - 72, 2);
        y += 36;
        const maxW = D.w - 80;
        ctx.font = `20px ${UI_FONT}`;
        if (!def.abilities.length) {
            UIKit.ink(ctx, '능력 없음', x, y, 22, T.inkFaint, 'left', 'bold');
            y += 40;
        }
        for (const a of def.abilities) {
            const kind = ABILITY_KINDS[a.kind];
            UIKit.ink(ctx, kind.name, x, y, 24, ABILITY_INK, 'left', 'bold');
            y += 34;
            ctx.font = `20px ${UI_FONT}`;
            for (const line of this.wrapLines(ctx, kind.desc(a), maxW).slice(0, 3)) {
                UIKit.ink(ctx, line, x, y, 20, T.ink);
                y += 28;
            }
            y += 10;
        }
        for (const s of def.skills || []) {
            UIKit.ink(ctx, `특수 스킬 · ${s.name}`, x, y, 24, SKILL_INK, 'left', 'bold');
            y += 34;
            ctx.font = `20px ${UI_FONT}`;
            for (const line of this.wrapLines(ctx, skillDesc(s), maxW).slice(0, 3)) {
                UIKit.ink(ctx, line, x, y, 20, T.ink);
                y += 28;
            }
            y += 10;
        }
        ctx.font = `20px ${UI_FONT}`;
        for (const line of this.wrapLines(ctx, def.desc || '', maxW).slice(0, 4)) {
            UIKit.ink(ctx, line, x, y, 20, T.inkSoft);
            y += 28;
        }
    },

    // 조합식 탭: 나무 판 줄. 공개 조합식은 재료와 결과(전설 결과는 찾기 전 ???). 히든은 찾기 전 ???, 찾으면 재료와 랭크 조건
    drawDexRecipes(ctx) {
        const T = UI_THEME;
        const hidden = MONSTER_RECIPES.filter(r => r.hidden);
        const foundHidden = hidden.filter(r => Meta.hasRecipe(r)).length;
        UIKit.text(ctx, `조합식 ${MONSTER_RECIPES.length - hidden.length}개 공개 · 히든 ${foundHidden} / ${hidden.length} 찾음`, 70, 150, 30, T.cream);
        UIKit.text(ctx, '랭크 조건은 재료별 최소 랭크입니다', 760, 152, 19, T.creamSoft);
        for (const c of this.collectionCells()) {
            const r = c.item;
            const found = Meta.hasRecipe(r);
            const open = !r.hidden || found;
            UIKit.panel(ctx, c.x, c.y, c.w, c.h, { tint: open ? null : 'shade' });
            const cy = c.y + c.h / 2;
            // 숨긴 칸은 실루엣도 없이 '?'(모양으로 몬스터를 알아볼 수 없게)
            const unknownBox = x => {
                UIKit.slot(ctx, x, c.y + 14, 72, 72, 'iron');
                UIKit.text(ctx, '?', x + 36, c.y + 50, 40, T.creamSoft, 'center');
            };
            const side = (type, rank, x, show) => {
                if (show) this.drawMonsterIcon(ctx, type, x, c.y + 14, 72);
                else unknownBox(x);
                const label = show ? MONSTERS[type].name + (rank ? ` ${rank}+` : '') : '???';
                UIKit.text(ctx, label, x + 84, cy, 19, show ? T.cream : T.creamSoft);
            };
            if (r.parts) {
                // 재료가 여럿인 히든 조합식: 본 몬스터는 찾기 전에도 재료 칸이 하나씩 드러난다
                const slot = (type, label, x, count) => {
                    const show = open || Meta.hasSeen(type);
                    if (show) this.drawMonsterIcon(ctx, type, x, c.y + 14, 72);
                    else unknownBox(x);
                    if (count) UIKit.text(ctx, `x${count}`, x + 68, c.y + 74, 22, T.gold, 'right', 'bold');
                    UIKit.text(ctx, show ? label : '???', x + 80, cy, 16, show ? T.cream : T.creamSoft);
                };
                const p = r.parts[0];
                slot(p.type, MONSTERS[p.type].name, c.x + 12, p.count);
                UIKit.text(ctx, '+', c.x + 204, cy, 24, T.cream, 'center');
                slot(r.b, MONSTERS[r.b].name, c.x + 216);
                UIKit.text(ctx, '+', c.x + 394, cy, 24, T.cream, 'center');
                slot(r.a, `${MONSTERS[r.a].name} ${r.aRank}`, c.x + 404);
            } else {
                side(r.a, r.aRank, c.x + 16, open);
                UIKit.text(ctx, '+', c.x + 284, cy, 30, T.cream, 'center');
                side(r.b, r.bRank, c.x + 306, open);
            }
            UIKit.text(ctx, '=', c.x + 576, cy, 30, T.gold, 'center');
            // 결과: 등급 표의 secret(전설, 신화)은 찾기 전까지 숨긴다
            const res = MONSTERS[r.result];
            const showResult = open && (!gradeInfo(res.grade, 'secret', false) || found);
            if (showResult) this.drawMonsterIcon(ctx, r.result, c.x + 598, c.y + 14, 72);
            else unknownBox(c.x + 598);
            UIKit.text(ctx, showResult ? res.name : '???', c.x + 682, cy, 19, showResult ? MONSTER_GRADES[res.grade].light : T.creamSoft);
            if (r.hidden) UIKit.text(ctx, found ? '히든' : '히든 조합식', c.x + c.w - 16, c.y + 18, 16, T.gold, 'right');
        }
    }
};
