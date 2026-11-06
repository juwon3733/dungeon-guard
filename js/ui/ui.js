// 화면 UI: 버튼 배치와 입력 처리, HUD 그리기.
const BAR_H = 124; // 하단 바 높이
const BAR_TAB_X = 206; // 체력 구슬 오른쪽의 탭 버튼
const BAR_SLOT_X = 362; // 첫 슬롯 위치
const BAR_SLOT_W = 236;
const SUMMON_BTN_W = 300; // 몬스터 탭의 소환 버튼
const FIELD_COUNT_X = BAR_SLOT_X + SUMMON_BTN_W + 28; // 맵 몬스터 수 표시(현재 수/상한)
const NEXT_BTN_X = 1132;
const POPUP_ABILITY_H = 30; // 팝업의 능력 한 줄 높이
const POPUP_RANK_H = 30; // 팝업의 랭크 줄 높이
const POPUP_SACRIFICE_H = 30; // 팝업의 제물 안내 줄 높이
const DRAG_START = 10; // 이만큼(화면 px) 움직여야 끌기로 본다. 덜 움직이고 떼면 누르기(선택)다
const REWARD_CARD_W = 380; // 보스 보상 카드
const REWARD_CARD_H = 540;
const REWARD_CARD_GAP = 44;
const REWARD_CARD_Y = 290;
// 하단 바의 장비 보관함(3칸 x 2줄). 마왕 탭 스킬 칸(844까지)과 다음 웨이브 버튼(NEXT_BTN_X) 사이라 탭과 관계없이 늘 보인다
const BAG_X = 862;
const BAG_COLS = 3;
const BAG_SLOT = 52; // 칸 크기. 48px 장비 그림을 원래 크기로 넣는다
const BAG_GAP = 6;
const POPUP_EQUIP_H = 70; // 팝업의 장비 줄 높이
const EQUIP_MAP_ICON = 24; // 맵 몬스터 곁 장비 그림(화면 px). 48px의 정확히 절반이라 도트 하나가 화면 1px이 되어 흐려지지 않는다

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
    orbHp: null, // 체력 구슬에 보이는 체력. 제물로 오를 때는 천천히 차오르고, 깎일 때는 바로 줄어든다
    targeting: false,
    toast: null,
    corruptHintShown: false,
    pressed: null,

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
        if (G.state === 'title') {
            this.button('start', GAME_WIDTH / 2 - 190, 760, 380, 92, { label: '던전 지키기', theme: 'gold', size: 38, onClick: () => this.startGame() });
            return;
        }
        if (G.state === 'victory' || G.state === 'defeat') {
            this.button('retry', GAME_WIDTH / 2 - 190, 700, 380, 84, {
                label: G.state === 'victory' ? '다시 도전' : '첫 웨이브부터 다시', theme: 'gold', size: 30, onClick: () => this.startGame()
            });
            return;
        }

        // 상단 오른쪽 설정 버튼
        let bx = GAME_WIDTH - 66;
        const small = (id, label, active, onClick) => {
            this.button(id, bx, 14, 54, 54, { label, theme: active ? 'gold' : 'button', size: 22, onClick });
            bx -= 62;
        };
        small('mute', Sfx.muted ? '끔' : '음', !Sfx.muted, () => { Sfx.setMuted(!Sfx.muted); saveSettings(); });
        small('fx', Fx.reduce ? '약' : '강', !Fx.reduce, () => { Fx.reduce = !Fx.reduce; saveSettings(); });
        small('pause', G.paused ? '▶' : 'II', G.paused, () => { G.paused = !G.paused; });
        small('speed', `${G.speed}x`, G.speed > 1, () => { G.speed = G.speed === 1 ? 2 : 1; });

        // 보스 보상 3택: 카드만 누를 수 있다(소환, 끌기, 탭, 다음 웨이브는 고른 뒤에)
        if (G.bossReward) {
            this.layoutBossReward();
            return;
        }

        // 하단 바: 탭 두 개, 탭에 따라 소환 버튼과 맵 몬스터 수나 마왕 스킬 슬롯, 다음 웨이브
        const barY = GAME_HEIGHT - BAR_H;
        this.button('tab_monster', BAR_TAB_X, barY + 8, 136, 52, { tab: 'monster', label: '몬스터', onClick: () => this.setTab('monster') });
        this.button('tab_demon', BAR_TAB_X, barY + 66, 136, 52, { tab: 'demon', label: '마왕', onClick: () => this.setTab('demon') });
        const slotY = barY + 12;
        const slotX = i => BAR_SLOT_X + i * (BAR_SLOT_W + 10);
        if (this.tab === 'monster') {
            const full = G.fieldFull();
            this.button('summon', BAR_SLOT_X, slotY, SUMMON_BTN_W, 104, {
                summonBtn: true, disabled: full || G.gold < G.summonCost(), full,
                onClick: () => this.doSummon()
            });
        } else {
            this.button('lightning', slotX(0), slotY, BAR_SLOT_W, 104, { skill: 'lightning', onClick: () => this.toggleLightning() });
            this.button('roar', slotX(1), slotY, BAR_SLOT_W, 104, { skill: 'roar', onClick: () => this.useRoar() });
        }
        // 보관함 칸: 누르고 끌면 장비 끌기(onDown). 그림은 drawBag이 하단 바와 함께 그린다
        for (let i = 0; i < EQUIP_RULES.slots; i++) {
            const r = this.bagRect(i);
            this.button(`bag${i}`, r.x, r.y, r.w, r.h, { bagSlot: i });
        }
        if (G.state === 'prep') {
            const bonus = G.waveIndex > 0 ? Math.floor(Math.max(0, G.prepTimer)) : 0;
            this.button('next', NEXT_BTN_X, barY + 22, 320, 84, {
                label: G.waveIndex === 0 ? '첫 웨이브 시작' : `다음 웨이브  +${bonus}G`, theme: 'gold', size: 28,
                sub: `${Math.ceil(Math.max(0, G.prepTimer))}초 뒤 자동 시작`,
                onClick: () => { G.startWave(); this.clearSelection(); }
            });
        }

        if (this.selectedMonster) this.layoutMonsterMenu();
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
    // 히든 조합식은 드러내지 않는다(등급 합치기가 되면 그것으로, 아니면 '???')
    shownPlan(a, b) {
        const plan = Game.mergePlanFor(a, b);
        if (plan.kind !== 'recipe' || !plan.recipe.hidden) return plan;
        const ga = MONSTERS[a.type].grade;
        if (ga === MONSTERS[b.type].grade && nextGrade(ga)) return { kind: 'grade', grade: nextGrade(ga) };
        return { kind: 'unknown' };
    },

    // 팝업 줄: 이름과 수치, 함께 합칠 수 있는 몬스터, 판매. 강화는 MONSTER_UPGRADE_ENABLED일 때만
    layoutMonsterMenu() {
        const f = this.selectedMonster;
        const type = f.type;
        const def = MONSTERS[type];
        const recipes = publicRecipesFor(type);
        const upgrades = MONSTER_UPGRADE_ENABLED && def.branches ? (f.tier === 1 ? 1 : (f.tier === 2 ? 2 : 0)) : 0;
        const w = 460;
        const h = 166 + POPUP_RANK_H + POPUP_EQUIP_H + def.abilities.length * POPUP_ABILITY_H + 34 + recipes.length * 50 + 40 + POPUP_SACRIFICE_H + upgrades * 88 + 64;
        const o = this.popupOrigin(f.x, f.y, w, h);
        this.popup = { x: o.x, y: o.y, w, h, type, monster: f, recipes };
        // 장비 줄의 빼기 버튼(낀 장비가 있을 때). 자리는 drawPopup의 장비 줄과 같다
        if (f.equip) {
            this.button('unequip', o.x + w - 98, o.y + 166 + POPUP_RANK_H + 8, 84, 34, {
                label: '빼기', size: 19,
                onClick: () => {
                    const res = Game.unequipMonster(f);
                    if (!res.ok && res.reason === 'full') this.showToast('보관함이 가득 차 뺄 수 없습니다.');
                }
            });
        }
        let y = o.y + h - 64 - upgrades * 88;
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
        this.button('sell', o.x + 12, y, w - 24, 50, {
            label: `판매  +${Game.sellValue(type)}G`, theme: 'danger', size: 22,
            onClick: () => {
                Game.sell(f);
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

    startGame() {
        Game.reset();
        Game.speed = 1;
        this.cancel();
        this.returning = [];
        this.tab = 'monster';
    },

    setTab(tab) {
        if (this.tab === tab) return;
        this.tab = tab;
        if (tab !== 'monster') this.cancelDrag();
        if (tab !== 'demon') this.targeting = false;
    },

    // 소환 버튼과 S 키
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
        return Game.canPlace(this.drag.type, col, row);
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
        if (m) return { monster: m };
        return { cell: { col, row } };
    },

    // 놓으면 일어날 일(미리보기와 실제 처리가 같이 쓴다)
    //   sacrifice: 왕좌에 바치기 / merge: 합치기(plan은 화면용) / place: 칸으로 옮기기 / back: 제자리 / invalid: 놓을 수 없음(reason)
    dropAction(t) {
        const d = this.drag;
        if (!d || !t) return { action: 'back' };
        const src = d.src;
        if (t.throne) return { action: 'sacrifice', gain: sacrificeGain(src.monster) };
        if (t.monster) {
            const loc = { monster: t.monster };
            if (Game.sameLoc(src, loc)) return { action: 'back' };
            const plan = this.shownPlan(src.monster, loc.monster);
            const real = Game.mergePlanFor(src.monster, loc.monster);
            return real.kind === 'none' ? { action: 'invalid', loc, reason: real.reason, plan } : { action: 'merge', loc, plan };
        }
        const { col, row } = t.cell;
        if (src.monster.col === col && src.monster.row === row) return { action: 'back' };
        if (Game.canPlace(d.type, col, row)) return { action: 'place', col, row };
        let reason = 'cell';
        if (isPathCell(col, row)) reason = 'path';
        return { action: 'invalid', reason, col, row };
    },

    // 맵의 몬스터를 누른다. 떼는 순간 끌기인지 누르기인지 나눈다(onUp). 다른 곳은 바로 클릭으로 처리한다
    onDown(x, y, shift) {
        Sfx.unlock();
        this.onMove(x, y);
        this.layout();
        this.press = null;
        this.cancelEquipDrag();
        const b = this.buttonAt(x, y);
        const inGame = Game.inPlay() && !Game.bossReward; // 보상을 고르는 동안 맵의 몬스터를 누르거나 끌지 않는다
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
        if (act.action === 'sacrifice' && Game.sacrifice(d.src.monster).ok) return;
        if (act.action === 'merge') {
            const res = Game.merge(d.src, act.loc);
            if (res.ok) return;
            act.action = 'invalid';
            act.reason = res.reason;
        }
        if (act.action === 'place') {
            if (Game.moveMonster(d.src.monster, act.col, act.row)) return;
            act.action = 'invalid';
            act.reason = 'cell';
        }
        // 놓지 못했다: 안내하고 제자리로 날아간다
        if (act.action === 'invalid') {
            const msg = {
                top: '영웅은 최고 등급이라 더 합칠 수 없습니다.',
                mismatch: '등급이 다르고 조합식도 없어 합칠 수 없습니다.',
                unique: '전설 몬스터는 맵에 1마리만 둘 수 있습니다.',
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
        if (Game.hp > COMBAT_RULES.roar.unlockHp) {
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
                this.drag = { src: this.press.src, type };
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
        this.hoverCell = this.dropTarget && this.dropTarget.cell && this.dropTarget.cell.col >= 0 && this.dropTarget.cell.row >= 0 ? this.dropTarget.cell : null;
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
        const G = Game;
        if (!G.inPlay() || G.bossReward) return;

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
        if (G.state === 'title' || G.state === 'victory' || G.state === 'defeat') {
            if (code === 'Space' || code === 'Enter') this.startGame();
            return;
        }
        if (G.bossReward) {
            // 보상을 고르는 동안은 1, 2, 3(숫자 패드 포함)과 배속, 일시정지만 받는다
            const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
            if (m) this.pickReward(Number(m[1]) - 1);
            else if (code === 'KeyF') G.speed = G.speed === 1 ? 2 : 1;
            else if (code === 'KeyP') G.paused = !G.paused;
            return;
        }
        if (code === 'Space') { G.startWave(); this.clearSelection(); }
        else if (code === 'KeyS') this.doSummon();
        else if (code === 'KeyQ') this.toggleLightning();
        else if (code === 'KeyW') this.useRoar();
        else if (code === 'Tab') this.setTab(this.tab === 'monster' ? 'demon' : 'monster');
        else if (code === 'KeyF') G.speed = G.speed === 1 ? 2 : 1;
        else if (code === 'KeyP') G.paused = !G.paused;
        else if (code === 'Escape') this.cancel();
    },

    update(dt) {
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
        // 체력 구슬: 오를 때는 초당 6씩 차오르고, 깎이면 바로 맞춘다
        if (this.orbHp === null || Game.hp < this.orbHp || !Game.inPlay()) this.orbHp = Game.hp;
        else this.orbHp = Math.min(Game.hp, this.orbHp + dt * 6);
        for (const r of this.returning) r.age += dt;
        this.returning = this.returning.filter(r => r.age < r.life);
        this.layout();
        this.hoverButton = this.buttonAt(this.mouse.x, this.mouse.y);
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
            for (const m of Game.monsters) {
                if (focus.loc.monster === m || m.reveal > 0) continue;
                const plan = this.shownPlan(focus.loc.monster, m);
                if (plan.kind === 'none' || plan.kind === 'unknown') continue;
                Render.mergeRing(ctx, m.homeX, m.homeY + MONSTER_FOOT, plan.kind === 'recipe' ? '#ffd76a' : MONSTER_GRADES[plan.grade].color, target === m);
                // 길로 걸어 나간 몬스터도 서 있는 곳에 고리를 그린다
                if (m.blocks && distance(m.x, m.y, m.homeX, m.homeY) > 20 && m.down <= 0) {
                    Render.mergeRing(ctx, m.x, m.y + MONSTER_FOOT, plan.kind === 'recipe' ? '#ffd76a' : MONSTER_GRADES[plan.grade].color, target === m);
                }
            }
        }
        const f = this.selectedMonster;
        if (f) {
            if (f.blocks) {
                this.drawRallyPath(ctx, f.homeX, f.homeY + MONSTER_FOOT, f.rally.x, f.rally.y + MONSTER_FOOT);
                Render.rangeRing(ctx, f.rally.x, f.rally.y + MONSTER_FOOT, monsterStats(f).range * TILE, 'rgba(255,224,138,1)');
            } else {
                Render.rangeRing(ctx, f.x, f.y, monsterStats(f).range * TILE, 'rgba(255,224,138,1)');
            }
        }
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

    draw(ctx) {
        const G = Game;
        if (G.state === 'title') {
            this.drawTitle(ctx);
            this.drawButtons(ctx);
            return;
        }
        this.drawBottomBar(ctx);
        this.drawTopBar(ctx);
        this.drawParty(ctx);
        this.drawBossBar(ctx);
        this.drawStreak(ctx);
        if (this.popup) this.drawPopup(ctx);
        this.drawButtons(ctx);
        this.drawEquipTips(ctx);
        this.drawMergeBadges(ctx);
        if (!G.bossReward) {
            this.drawHints(ctx);
            this.drawBanner(ctx);
        }
        this.drawPops(ctx);
        this.drawDragged(ctx);
        this.drawDiscovery(ctx);
        if (G.bossReward) this.drawBossReward(ctx);
        if (this.toast) {
            const a = clamp((this.toast.life - this.toast.age) / 0.3, 0, 1);
            ctx.save();
            ctx.globalAlpha = a;
            UIKit.text(ctx, this.toast.text, GAME_WIDTH / 2, GAME_HEIGHT - 170, 28, '#ffb4b4', 'center');
            ctx.restore();
        }
        if (G.paused) {
            ctx.fillStyle = 'rgba(4,2,14,0.45)';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            UIKit.text(ctx, '일시정지', GAME_WIDTH / 2, 330, 62, '#ffe08a', 'center');
            UIKit.text(ctx, `멈춘 상태에서도 소환, 배치, 합치기${CORRUPTION_ENABLED ? ', 타락' : ''}을 할 수 있습니다.`, GAME_WIDTH / 2, 392, 26, '#ffffff', 'center');
        }
        if (G.state === 'victory' || G.state === 'defeat') {
            this.drawResult(ctx);
            this.drawButtons(ctx);
        }
    },

    drawTopBar(ctx) {
        const G = Game;
        // 층과 웨이브 표시: 양끝이 뾰족한 명판
        const cx = GAME_WIDTH / 2;
        const w = 560;
        const y = 12;
        const h = 62;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2 - 26, y + h / 2);
        ctx.lineTo(cx - w / 2, y);
        ctx.lineTo(cx + w / 2, y);
        ctx.lineTo(cx + w / 2 + 26, y + h / 2);
        ctx.lineTo(cx + w / 2, y + h);
        ctx.lineTo(cx - w / 2, y + h);
        ctx.closePath();
        const plate = ctx.createLinearGradient(0, y, 0, y + h);
        plate.addColorStop(0, '#2a2348');
        plate.addColorStop(1, '#141027');
        ctx.fillStyle = plate;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d8a94f';
        ctx.stroke();
        UIKit.plain(ctx, '지하 감옥', cx - w / 2 + 24, y + h / 2, 22, '#c9b6ea');
        UIKit.text(ctx, '1층', cx - 66, y + h / 2, 32, '#ffffff', 'center');
        UIKit.text(ctx, `웨이브 ${Math.min(G.waveIndex + 1, WAVES.length)}/${WAVES.length}`, cx + w / 2 - 22, y + h / 2, 28, '#7fe3ff', 'right');
        if (CORRUPTION_ENABLED) {
            const corrupt = G.units.filter(u => u.kind === 'corrupt').length;
            UIKit.text(ctx, `타락 ${corrupt}/${COMBAT_RULES.corruptMax}`, 22, 40, 26, '#d7a8ff');
        }
    },

    // Asteria 구성의 하단 바: 왼쪽 체력 구슬, 탭과 슬롯, 오른쪽 재화
    drawBottomBar(ctx) {
        const G = Game;
        const y = GAME_HEIGHT - BAR_H;
        const bar = ctx.createLinearGradient(0, y, 0, GAME_HEIGHT);
        bar.addColorStop(0, '#1a1633');
        bar.addColorStop(1, '#090713');
        ctx.fillStyle = bar;
        ctx.fillRect(0, y, GAME_WIDTH, 124);
        ctx.fillStyle = '#08060f';
        ctx.fillRect(0, y - 4, GAME_WIDTH, 4);
        ctx.fillStyle = '#d8a94f';
        ctx.fillRect(0, y, GAME_WIDTH, 3);
        ctx.fillStyle = 'rgba(216,169,79,0.35)';
        ctx.fillRect(0, y + 5, GAME_WIDTH, 1);

        // 체력 구슬
        const ox = 104;
        const oy = GAME_HEIGHT - 94;
        const r = 72;
        ctx.save();
        ctx.beginPath();
        ctx.arc(ox, oy, r + 12, 0, Math.PI * 2);
        ctx.fillStyle = '#100b1d';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#d8a94f';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#26101d';
        ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
        const shownHp = this.orbHp === null ? G.hp : this.orbHp;
        const ratio = clamp(shownHp / COMBAT_RULES.maxHp, 0, 1);
        const top = oy + r - r * 2 * ratio;
        const liquid = ctx.createLinearGradient(0, top, 0, oy + r);
        liquid.addColorStop(0, '#ff5a7c');
        liquid.addColorStop(1, '#8c1236');
        ctx.fillStyle = liquid;
        ctx.fillRect(ox - r, top + Math.sin(G.time * 3) * 3, r * 2, r * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.ellipse(ox - 22, oy - 38, 26, 14, -0.5, 0, Math.PI * 2);
        ctx.fill();
        // 제물로 차오를 때 구슬이 금빛으로 빛난다
        if (Fx.hpGlow > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255,220,140,${0.45 * Fx.hpGlow})`;
            ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
        }
        ctx.restore();
        if (Fx.hpGlow > 0) {
            ctx.save();
            ctx.globalAlpha = Fx.hpGlow;
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#ffe08a';
            ctx.beginPath();
            ctx.arc(ox, oy, r + 14 + (1 - Fx.hpGlow) * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        UIKit.text(ctx, String(Math.floor(shownHp)), ox, oy - 8, 46, '#ffffff', 'center');
        UIKit.text(ctx, `/ ${COMBAT_RULES.maxHp}`, ox, oy + 30, 22, '#ffd9e2', 'center');

        // 골드: 코인이 도착하면 잠깐 커진다
        const pulse = 1 + Fx.goldPulse * 0.2;
        ctx.fillStyle = '#6b3f0a';
        ctx.fillRect(HUD_GOLD.x - 19, HUD_GOLD.y - 19, 38, 38);
        ctx.fillStyle = '#ffd24d';
        ctx.fillRect(HUD_GOLD.x - 15, HUD_GOLD.y - 15, 30, 30);
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(HUD_GOLD.x - 11, HUD_GOLD.y - 11, 11, 11);
        UIKit.text(ctx, String(G.gold), GAME_WIDTH - 36, HUD_GOLD.y, Math.round(44 * pulse), '#ffe08a', 'right');
        this.drawBag(ctx);
    },

    // 장비 그림(48px)을 (x, y)에 scale배로 그린다. 정수 배율이거나 절반이라 도트가 흐려지지 않는다
    drawEquipIcon(ctx, id, x, y, scale) {
        const img = Assets.get(`equip_${id}`);
        if (!img) return;
        const s = 48 * (scale || 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, Math.round(x), Math.round(y), s, s);
    },

    // 장비 칸 하나: 어두운 네모, 장비가 있으면 등급 색 테두리와 그림
    drawEquipSlot(ctx, id, x, y, size, hot, faded) {
        UIKit.frame(ctx, x, y, size, size, hot ? 'buttonHover' : 'dark', 4);
        if (!id) return;
        ctx.save();
        if (faded) ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.strokeStyle = MONSTER_GRADES[EQUIPMENT[id].grade].color;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        this.drawEquipIcon(ctx, id, x + (size - 48) / 2, y + (size - 48) / 2, 1);
        ctx.restore();
    },

    // 하단 바의 보관함: 3x2칸과 "장비 n/6". 보상을 고르는 동안에도 보인다
    drawBag(ctx) {
        const G = Game;
        for (let i = 0; i < EQUIP_RULES.slots; i++) {
            const r = this.bagRect(i);
            const id = G.equipBag[i];
            const hot = id && this.hoverButton && this.hoverButton.bagSlot === i && !this.equipDrag && !G.bossReward;
            const dragging = this.equipDrag && this.equipDrag.index === i;
            this.drawEquipSlot(ctx, id, r.x, r.y, r.w, hot, dragging);
        }
        const lx = BAG_X + BAG_COLS * (BAG_SLOT + BAG_GAP) + 6;
        const y = GAME_HEIGHT - BAR_H;
        const full = G.bagFull();
        UIKit.plain(ctx, '장비', lx, y + 36, 20, '#c9b6ea');
        UIKit.text(ctx, `${G.equipBag.length}/${EQUIP_RULES.slots}`, lx, y + 80, 30, full ? '#ff8f8f' : '#ffffff');
    },

    // 장비 설명: 보관함 칸이나 팝업의 장비 칸 위에 마우스를 올렸을 때
    drawEquipTips(ctx) {
        if (this.equipDrag || Game.bossReward) return;
        const tip = (id, x, y) => {
            const def = EQUIPMENT[id];
            const grade = MONSTER_GRADES[def.grade];
            this.drawTooltip(ctx, clamp(x, 12, GAME_WIDTH - 442), y, `${def.name} · ${grade.name}`, equipEffectText(id), grade.light);
        };
        const b = this.hoverButton;
        if (b && b.bagSlot !== undefined && Game.equipBag[b.bagSlot]) {
            tip(Game.equipBag[b.bagSlot], b.x - 120, GAME_HEIGHT - BAR_H - 92);
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

    drawParty(ctx) {
        const G = Game;
        const wave = G.currentWave();
        const x = GAME_WIDTH - 372;
        const y = 76;
        const entries = Object.entries(wave.members);
        const elites = Object.entries(wave.elites || {});
        // Why: 정예와 보스가 섞이면 줄이 6개까지 늘어난다. 줄을 낮게 잡아 왕좌의 마왕을 가리지 않게 한다(6줄이어도 y 400 위에서 끝난다).
        const ROW_H = 42;
        const h = 58 + (entries.length + elites.length + (wave.boss ? 1 : 0)) * ROW_H;
        UIKit.frame(ctx, x, y, 360, h, 'panel', 8);
        UIKit.plain(ctx, G.state === 'wave' ? '이번 파티' : '다음 파티', x + 20, y + 28, 18, '#c9b6ea');
        UIKit.text(ctx, wave.party, x + 340, y + 28, 23, '#ffe08a', 'right');
        let ry = y + 54;
        const row = (img, name, note, count, elite) => {
            const box = ROW_H - 4;
            UIKit.frame(ctx, x + 14, ry - 2, box, box, elite ? 'gold' : 'dark', 4);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                const size = img.width * Math.max(1, Math.floor(44 / img.width)); // 도트 격자가 깨지지 않게 정수 배율로 그린다
                ctx.save();
                ctx.beginPath();
                ctx.rect(x + 16, ry, box - 4, box - 4);
                ctx.clip();
                ctx.drawImage(img, x + 14 + box / 2 - size / 2, ry + box / 2 - 2 - size / 2, size, size);
                ctx.restore();
            }
            UIKit.text(ctx, name, x + 62, ry + 9, 18, elite ? '#ffd76a' : '#ffffff');
            UIKit.plain(ctx, note, x + 62, ry + 28, 14, '#b8a9d0');
            if (count) UIKit.text(ctx, `x${count}`, x + 340, ry + 17, 24, '#ffffff', 'right');
            ry += ROW_H;
        };
        for (const [type, count] of entries) {
            const def = HEROES[type];
            row(Assets.get(Render.heroStandName(type, false, 'down')), def.name, def.counter, count);
        }
        for (const [type, count] of elites) {
            const def = HEROES[type];
            row(Assets.get(Render.heroStandName(type, false, 'down')), def.name, def.counter, count, true);
        }
        if (wave.boss) {
            const def = BOSSES[wave.boss];
            row(Assets.get(def.portrait), def.name, def.note, 1);
        }
    },

    drawBossBar(ctx) {
        const boss = Game.heroes.find(h => h.boss && !h.waiting);
        if (!boss) return;
        const cx = GAME_WIDTH / 2;
        UIKit.frame(ctx, cx - 340, 82, 680, 62, 'danger', 8);
        const p = Assets.get(BOSSES[boss.bossKey].portrait);
        if (p) {
            ctx.imageSmoothingEnabled = false;
            // 64px 직업 그림은 줄이면 도트가 깨지므로 가운데 58px을 그대로 잘라 쓴다
            if (p.width === 64) ctx.drawImage(p, 3, 0, 58, 58, cx - 332, 84, 58, 58);
            else ctx.drawImage(p, cx - 332, 84, 58, 58);
        }
        UIKit.text(ctx, boss.name, cx - 262, 102, 22, '#ffe6ea');
        UIKit.bar(ctx, cx - 262, 120, 590, 14, boss.hp / boss.maxHp, '#ff6e8a', '#a0233f');
    },

    drawStreak(ctx) {
        const G = Game;
        if (G.streak < 2) return;
        const size = Math.round(42 + G.streakPop * 18 + Math.min(G.streak, 20));
        const color = G.streak >= 10 ? '#ff7a5c' : (G.streak >= 5 ? '#ffc65c' : '#ffe9a8');
        ctx.save();
        ctx.globalAlpha = clamp(G.streakTimer / 0.5, 0, 1);
        UIKit.text(ctx, `${G.streak} 연속 처치`, 30, GAME_HEIGHT - 186, size, color);
        ctx.restore();
    },

    // 몬스터의 rotations/south 그림을 size 크기 네모 안에 그리고, 등급 색 테두리를 두른다
    drawMonsterIcon(ctx, type, x, y, size, noFrame) {
        const def = MONSTERS[type];
        if (!noFrame) {
            ctx.fillStyle = '#0d0918';
            ctx.fillRect(x, y, size, size);
        }
        const img = Assets.get(`${def.sprite}/rotations/south`);
        if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, size, size);
            ctx.clip();
            ctx.imageSmoothingEnabled = false;
            const s = img.width * Math.max(1, Math.floor(size / img.width)); // 도트 격자가 깨지지 않게 정수 배율로 그린다
            ctx.drawImage(img, x + (size - s) / 2, y + (size - s) / 2, s, s);
            ctx.restore();
        }
        if (noFrame) return;
        ctx.lineWidth = 3;
        ctx.strokeStyle = MONSTER_GRADES[def.grade].color;
        ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    },

    // 고른 몬스터 정보: 이름, 등급, 역할, 수치, 함께 합칠 수 있는 몬스터. 판매 버튼은 layoutMonsterMenu가 놓는다
    drawPopup(ctx) {
        const p = this.popup;
        const f = p.monster;
        const def = MONSTERS[p.type];
        const grade = MONSTER_GRADES[def.grade];
        UIKit.frame(ctx, p.x, p.y, p.w, p.h, 'panel', 8);
        this.drawMonsterIcon(ctx, p.type, p.x + 16, p.y + 16, 64);
        UIKit.text(ctx, def.name, p.x + 96, p.y + 36, 28, '#ffe08a');
        UIKit.plain(ctx, `${grade.name} · ${MONSTER_ROLES[def.role].name} · ${MONSTER_FAMILIES[def.family]}`, p.x + 96, p.y + 68, 19, grade.light);
        const stats = monsterStats(f);
        const num = v => Math.round(v * 100) / 100; // 장비로 0.8695...처럼 되는 값을 소수 둘째 자리까지
        let line1;
        let line2;
        if (monsterBlocks(p.type)) {
            line1 = f.down > 0 ? `${Math.ceil(f.down)}초 뒤 다시 나옴` : `체력 ${Math.ceil(f.hp)}/${Math.round(stats.hp)}`;
            line1 += ` · 피해 ${Math.round(stats.damage)} · 간격 ${num(stats.interval)}초`;
            line2 = `막기 ${stats.block}명 · 쓰러지면 ${stats.respawn}초 뒤 다시 나옴`;
        } else {
            line1 = `피해 ${Math.round(stats.damage)} · 간격 ${num(stats.interval)}초 · 사거리 ${num(stats.range)}`;
            line2 = stats.splash ? `광역 반경 ${stats.splash} · 무리를 함께 공격` : '가장 앞선 용사 하나를 노림';
        }
        // 랭크: 글자는 랭크 색, 옆에 다음 랭크까지 남은 처치 수(정예 3, 보스 10으로 센다)
        const rank = f.rank || 0;
        const rankDef = MONSTER_RANKS[rank];
        const nextRank = MONSTER_RANKS[rank + 1];
        UIKit.plain(ctx, '랭크', p.x + 20, p.y + 108, 19, '#d8ccef');
        UIKit.text(ctx, rankDef.name, p.x + 70, p.y + 108, 24, rankDef.color, 'left', 'bold');
        const rankLine = nextRank ? `다음 ${nextRank.name}까지 ${monsterXpToNext(f)}처치` : '최고 랭크';
        UIKit.plain(ctx, rankLine, p.x + 100, p.y + 108, 17, nextRank ? '#f2e6ff' : '#ffe08a');
        UIKit.plain(ctx, line1, p.x + 20, p.y + 108 + POPUP_RANK_H, 19, '#ffffff');
        UIKit.plain(ctx, line2, p.x + 20, p.y + 138 + POPUP_RANK_H, 18, '#d8ccef');

        // 장비 줄: 칸(마우스를 올리면 설명), 이름과 등급, 효과. 빼기 버튼은 layoutMonsterMenu가 놓는다
        let y = p.y + 166 + POPUP_RANK_H;
        ctx.fillStyle = 'rgba(216,169,79,0.45)';
        ctx.fillRect(p.x + 16, y - 6, p.w - 32, 2);
        this.popupEquipRect = { x: p.x + 18, y: y + 4, w: 56, h: 56 };
        this.drawEquipSlot(ctx, f.equip, p.x + 18, y + 4, 56, false, false);
        if (f.equip) {
            const eq = EQUIPMENT[f.equip];
            const eg = MONSTER_GRADES[eq.grade];
            UIKit.text(ctx, eq.name, p.x + 88, y + 22, 21, eg.light);
            ctx.font = `21px ${UI_FONT}`;
            UIKit.plain(ctx, `${eg.name} 장비`, p.x + 98 + ctx.measureText(eq.name).width, y + 22, 16, '#b8a9d0');
            UIKit.plain(ctx, equipEffectText(f.equip), p.x + 88, y + 50, 16, '#9dffb0');
        } else {
            UIKit.text(ctx, '장비 없음', p.x + 88, y + 22, 20, '#a59db5');
            UIKit.plain(ctx, '보관함의 장비를 끌어 놓으면 끼웁니다', p.x + 88, y + 50, 16, '#b8a9d0');
        }
        y += POPUP_EQUIP_H;

        // 능력: 한 줄에 하나. 이름과 설명은 ABILITY_KINDS에서 온다
        for (const a of def.abilities) {
            const kind = ABILITY_KINDS[a.kind];
            UIKit.plain(ctx, kind.name, p.x + 20, y + 12, 18, '#ffb0e8');
            const nameW = ctx.measureText(kind.name).width;
            UIKit.plain(ctx, kind.desc(a), p.x + 32 + nameW, y + 12, 17, '#f2e6ff');
            y += POPUP_ABILITY_H;
        }

        // 함께 합칠 수 있는 몬스터
        ctx.fillStyle = 'rgba(216,169,79,0.45)';
        ctx.fillRect(p.x + 16, y, p.w - 32, 2);
        UIKit.plain(ctx, '함께 합칠 수 있는 몬스터', p.x + 20, y + 18, 18, '#ffd76a');
        y += 34;
        for (const r of p.recipes) {
            const res = MONSTERS[r.result];
            this.drawMonsterIcon(ctx, r.partner, p.x + 18, y + 2, 44);
            // 랭크 조건이 있으면 이름 뒤에 적는다(예: 해골 기사 A+)
            UIKit.plain(ctx, MONSTERS[r.partner].name + (r.partnerRank ? ` ${r.partnerRank}+` : ''), p.x + 72, y + 24, 19, '#ffffff');
            UIKit.text(ctx, '→', p.x + 222, y + 24, 22, '#ffd76a', 'center');
            this.drawMonsterIcon(ctx, r.result, p.x + 246, y + 2, 44);
            UIKit.plain(ctx, res.name, p.x + 300, y + 24, 19, MONSTER_GRADES[res.grade].light);
            y += 50;
        }
        const next = nextGrade(def.grade);
        const gradeLine = next ? `같은 ${grade.name} 등급 아무나 → ${MONSTER_GRADES[next].name} 무작위 1마리`
            : `${grade.name}은 최고 등급이라 등급 합치기를 할 수 없습니다`;
        UIKit.plain(ctx, gradeLine, p.x + 20, y + 18, 17, next ? MONSTER_GRADES[next].light : '#a59db5');
        // 제물: 이 몬스터(랭크 포함)를 바치면 얻는 것
        UIKit.plain(ctx, `왕좌로 끌어 바치면 ${sacrificeText(sacrificeGain(f))}`, p.x + 20, y + 18 + POPUP_SACRIFICE_H, 17, '#ffd76a');
    },

    drawButtons(ctx) {
        for (const b of this.buttons) {
            const hover = this.hoverButton === b && !b.disabled;
            if (b.reward) continue; // 보상 카드는 어둡게 깐 화면 위에 drawBossReward가 그린다
            if (b.bagSlot !== undefined) continue; // 보관함 칸은 drawBag이 그린다
            if (b.skill) this.drawSkillButton(ctx, b, hover);
            else if (b.summonBtn) this.drawSummonButton(ctx, b, hover);
            else if (b.tab) this.drawTabButton(ctx, b, hover);
            else if (b.upgrade) this.drawUpgradeButton(ctx, b, hover);
            else {
                let theme = b.theme || 'button';
                if (hover) theme = theme === 'gold' ? 'goldHover' : (theme === 'danger' ? 'dangerHover' : 'buttonHover');
                UIKit.frame(ctx, b.x, b.y, b.w, b.h, theme, 6);
                const ly = b.y + b.h / 2 - (b.sub ? 12 : 0);
                UIKit.text(ctx, b.label, b.x + b.w / 2, ly, b.size || 24, '#ffffff', 'center');
                if (b.sub) UIKit.text(ctx, b.sub, b.x + b.w / 2, ly + 30, 18, '#fff2d0', 'center');
            }
        }
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

    // 보스 보상 3택: 화면을 어둡게 깔고 제목과 카드 3장
    drawBossReward(ctx) {
        ctx.fillStyle = 'rgba(4,2,14,0.72)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        UIKit.text(ctx, '보스 처치 보상', cx, REWARD_CARD_Y - 112, 66, '#ffd76a', 'center');
        UIKit.plain(ctx, '하나를 고르세요 · 누르거나 1, 2, 3', cx, REWARD_CARD_Y - 52, 26, '#e4d8fa', 'center');
        for (const b of this.buttons) if (b.reward) this.drawRewardCard(ctx, b, this.hoverButton === b && !b.disabled);
    },

    drawRewardCard(ctx, b, hover) {
        const card = b.reward;
        const x = b.x;
        const y = b.y - (hover ? 8 : 0);
        const w = b.w;
        const h = b.h;
        const cx = x + w / 2;
        const def = card.kind === 'monster' ? MONSTERS[card.type] : null;
        const eq = card.kind === 'equip' ? EQUIPMENT[card.id] : null;
        const grade = def || eq ? MONSTER_GRADES[(def || eq).grade] : null;
        const edge = grade ? grade.color : '#ffd24d';
        UIKit.frame(ctx, x, y, w, h, 'panel', 10);
        if (hover) {
            // 마우스를 올린 카드: 살짝 떠오르고 등급 색으로 은은하게 빛난다
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = edge;
            ctx.fillRect(x + 12, y + 12, w - 24, h - 24);
            ctx.restore();
        }
        // 등급 테두리(골드 카드는 금색)
        ctx.lineWidth = hover ? 6 : 4;
        ctx.strokeStyle = edge;
        ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
        // 고르는 키
        UIKit.frame(ctx, x + 22, y + 22, 44, 44, 'dark', 4);
        UIKit.text(ctx, String(b.index + 1), x + 44, y + 45, 26, '#ffe08a', 'center');
        if (def) {
            const size = 168;
            this.drawMonsterIcon(ctx, card.type, cx - size / 2, y + 44, size);
            UIKit.text(ctx, def.name, cx, y + 248, 34, grade.light, 'center');
            UIKit.plain(ctx, `${grade.name} · ${MONSTER_ROLES[def.role].name}`, cx, y + 288, 22, '#d8ccef', 'center');
            let ly = y + 330;
            for (const a of def.abilities) {
                const kind = ABILITY_KINDS[a.kind];
                UIKit.text(ctx, kind.name, cx, ly, 22, '#ffb0e8', 'center');
                ly += 30;
                ctx.font = `19px ${UI_FONT}`;
                for (const line of this.wrapLines(ctx, kind.desc(a), w - 64)) {
                    UIKit.plain(ctx, line, cx, ly, 19, '#f2e6ff', 'center');
                    ly += 26;
                }
                ly += 6;
            }
            ctx.font = `18px ${UI_FONT}`;
            for (const line of this.wrapLines(ctx, def.desc, w - 64)) {
                UIKit.plain(ctx, line, cx, ly + 4, 18, '#b8a9d0', 'center');
                ly += 24;
            }
            UIKit.plain(ctx, '맵의 빈 칸에 바로 나옵니다', cx, y + h - 40, 19, '#c9b6ea', 'center');
        } else if (eq) {
            // 장비 카드: 48px 그림을 3배(정수 배율)로
            const size = 168;
            ctx.fillStyle = '#0d0918';
            ctx.fillRect(cx - size / 2, y + 44, size, size);
            this.drawEquipIcon(ctx, card.id, cx - 72, y + 44 + (size - 144) / 2, 3);
            ctx.lineWidth = 3;
            ctx.strokeStyle = grade.color;
            ctx.strokeRect(cx - size / 2 + 1.5, y + 45.5, size - 3, size - 3);
            UIKit.text(ctx, eq.name, cx, y + 248, 34, grade.light, 'center');
            UIKit.plain(ctx, `${grade.name} · 장비`, cx, y + 288, 22, '#d8ccef', 'center');
            let ly = y + 334;
            ctx.font = `21px ${UI_FONT}`;
            for (const line of this.wrapLines(ctx, equipEffectText(card.id), w - 64)) {
                UIKit.text(ctx, line, cx, ly, 21, '#9dffb0', 'center');
                ly += 30;
            }
            UIKit.plain(ctx, '몬스터 하나에 끼워 강하게 만듭니다.', cx, ly + 10, 18, '#b8a9d0', 'center');
            UIKit.plain(ctx, `보관함에 들어갑니다 · ${Game.equipBag.length}/${EQUIP_RULES.slots}`, cx, y + h - 40, 19, '#c9b6ea', 'center');
        } else {
            // 골드 카드: 큰 금화
            const gy = y + 128;
            ctx.fillStyle = '#6b3f0a';
            ctx.fillRect(cx - 62, gy - 62, 124, 124);
            ctx.fillStyle = '#ffd24d';
            ctx.fillRect(cx - 50, gy - 50, 100, 100);
            ctx.fillStyle = '#fff2b0';
            ctx.fillRect(cx - 38, gy - 38, 34, 34);
            ctx.fillStyle = '#c98a1c';
            ctx.fillRect(cx - 50, gy + 38, 100, 12);
            UIKit.text(ctx, `${card.gold}G`, cx, y + 248, 46, '#ffe08a', 'center');
            UIKit.plain(ctx, '골드', cx, y + 288, 22, '#d8ccef', 'center');
            UIKit.plain(ctx, '바로 받습니다.', cx, y + 334, 19, '#f2e6ff', 'center');
            UIKit.plain(ctx, `지금 소환 비용 ${Game.summonCost()}G`, cx, y + 364, 19, '#b8a9d0', 'center');
        }
        if (b.disabled) {
            ctx.fillStyle = 'rgba(4,2,12,0.68)';
            ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
            UIKit.text(ctx, eq ? '보관함 가득' : '자리 없음', cx, y + h / 2, 36, '#ff8f8f', 'center');
            const note = eq ? `보관함 ${Game.equipBag.length}/${EQUIP_RULES.slots}` : `맵 몬스터 ${Game.monsters.length}/${SUMMON_RULES.maxField}`;
            UIKit.plain(ctx, note, cx, y + h / 2 + 42, 20, '#e4d8fa', 'center');
        }
    },

    // 소환 버튼(현재 비용)과 그 오른쪽의 맵 몬스터 수(현재 수/상한)
    drawSummonButton(ctx, b, hover) {
        const G = Game;
        const cost = G.summonCost();
        const pulse = !b.disabled && G.monsters.length === 0 ? Math.sin(G.time * 5) * 0.5 + 0.5 : 0;
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, b.disabled ? 'off' : (hover ? 'goldHover' : 'gold'), 6);
        if (pulse > 0) {
            ctx.save();
            ctx.globalAlpha = pulse * 0.5;
            ctx.strokeStyle = '#fff1c8';
            ctx.lineWidth = 4;
            ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
            ctx.restore();
        }
        UIKit.text(ctx, '소환', b.x + 22, b.y + 34, 32, b.disabled ? '#a59db5' : '#ffffff');
        UIKit.text(ctx, 'S', b.x + b.w - 16, b.y + 30, 22, b.disabled ? '#8a8299' : '#fff2d0', 'right');
        const sub = b.full ? '자리 없음 · 합치세요' : `${cost}G`;
        UIKit.text(ctx, sub, b.x + 22, b.y + 76, b.full ? 22 : 30, b.full ? '#ff8f8f' : (G.gold < cost ? '#ff8f8f' : '#fff2b0'));
        if (!b.full && cost < SUMMON_RULES.maxCost) UIKit.plain(ctx, `다음 +${SUMMON_RULES.costStep}G`, b.x + b.w - 16, b.y + 78, 18, b.disabled ? '#8a8299' : '#fff2d0', 'right');
        // 맵 몬스터 수: 상한에 닿으면 빨갛게
        const n = G.monsters.length;
        UIKit.plain(ctx, '맵 몬스터', FIELD_COUNT_X, b.y + 30, 20, '#c9b6ea');
        UIKit.text(ctx, `${n}/${SUMMON_RULES.maxField}`, FIELD_COUNT_X, b.y + 74, 38, b.full ? '#ff8f8f' : '#ffffff');
        if (hover) {
            const o = SUMMON_RULES.odds;
            const odds = GRADE_ORDER.filter(g => o[g] > 0).map(g => `${MONSTER_GRADES[g].name} ${Math.round(o[g] * 100)}%`).join(' · ');
            this.drawTooltip(ctx, b.x, b.y - 92, `몬스터 소환 · ${cost}G`, odds);
        }
    },

    drawSkillButton(ctx, b, hover) {
        const lightning = b.skill === 'lightning';
        const cd = Game.skills[b.skill];
        const max = lightning ? COMBAT_RULES.lightning.cooldown : COMBAT_RULES.roar.cooldown;
        const locked = !lightning && Game.hp > COMBAT_RULES.roar.unlockHp;
        const active = lightning && this.targeting;
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, active ? 'goldHover' : (hover ? 'buttonHover' : 'dark'), 6);
        // 왼쪽 네모: 스킬 칸 그림, 아이콘, 재사용 가림막
        const sx = b.x + 8;
        const sy = b.y + 8;
        const ss = b.h - 16;
        const slot = Assets.get('ui_skillSlot');
        ctx.imageSmoothingEnabled = false;
        if (slot) ctx.drawImage(slot, sx, sy, ss, ss);
        else UIKit.frame(ctx, sx, sy, ss, ss, 'dark', 6);
        const icon = Assets.get(lightning ? 'icon_power_thunderStrike' : 'portrait_riftLord');
        if (icon) ctx.drawImage(icon, sx + 14, sy + 14, ss - 28, ss - 28);
        if (cd > 0 || locked) {
            const ratio = locked ? 1 : cd / max;
            ctx.fillStyle = 'rgba(4,2,12,0.72)';
            ctx.fillRect(sx + 10, sy + 10 + (ss - 20) * (1 - ratio), ss - 20, (ss - 20) * ratio);
            if (!locked) UIKit.text(ctx, String(Math.ceil(cd)), sx + ss / 2, sy + ss / 2, 30, '#ffffff', 'center');
        }
        const tx = b.x + ss + 24;
        UIKit.text(ctx, lightning ? '번개' : '호통', tx, b.y + 32, 24, locked ? '#a59db5' : '#ffffff');
        let status = '준비됨';
        let color = '#9dffb0';
        if (active) { status = '조준 중'; color = '#ffe08a'; }
        else if (locked) { status = `체력 ${COMBAT_RULES.roar.unlockHp} 이하`; color = '#c9b6ea'; }
        else if (cd > 0) { status = `${Math.ceil(cd)}초`; color = '#ff8f8f'; }
        UIKit.text(ctx, status, tx, b.y + 72, 19, color);
        UIKit.text(ctx, lightning ? 'Q' : 'W', b.x + b.w - 16, b.y + 30, 22, '#ffe08a', 'right');
        if (hover) {
            const name = lightning ? '마왕의 번개' : '마왕의 호통';
            const desc = lightning ? `범위 피해 ${COMBAT_RULES.lightning.damage}, 재사용 ${max}초` : `모든 용사 ${COMBAT_RULES.roar.duration}초 정지, 체력 ${COMBAT_RULES.roar.unlockHp} 이하`;
            this.drawTooltip(ctx, b.x, b.y - 92, name, desc);
        }
    },

    // 슬롯 위에 뜨는 설명
    drawTooltip(ctx, x, y, title, desc, titleColor) {
        UIKit.frame(ctx, x, y, 430, 82, 'dark', 6);
        UIKit.text(ctx, title, x + 20, y + 24, 24, titleColor || '#ffe08a');
        UIKit.plain(ctx, desc, x + 20, y + 56, 19, '#ffffff');
    },

    drawTabButton(ctx, b, hover) {
        const on = this.tab === b.tab;
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, on ? 'gold' : (hover ? 'buttonHover' : 'dark'), 6);
        UIKit.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, 26, on ? '#ffffff' : '#c9b6ea', 'center');
    },

    drawUpgradeButton(ctx, b, hover) {
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, b.disabled ? 'off' : (hover ? 'buttonHover' : 'button'), 6);
        UIKit.text(ctx, b.upgrade.name, b.x + 18, b.y + 26, 23, '#ffffff');
        UIKit.plain(ctx, b.upgrade.desc, b.x + 18, b.y + 56, 18, '#e4d8fa');
        UIKit.text(ctx, `${b.upgrade.cost}G`, b.x + b.w - 16, b.y + 26, 23, b.disabled ? '#ff8f8f' : '#ffe08a', 'right');
    },

    drawHints(ctx) {
        const G = Game;
        UIKit.text(ctx, 'S 소환 · Tab 탭 전환 · Space 다음 웨이브 · F 배속 · P 일시정지 · M 소리', GAME_WIDTH - 20, GAME_HEIGHT - 146, 20, '#e4d8fa', 'right');

        let hint = null;
        if (this.targeting) hint = '번개를 떨어뜨릴 곳을 누르세요. Esc로 취소합니다.';
        else if (this.drag) hint = '빈 칸으로 옮기거나 몬스터 위에 놓아 합치세요. 왕좌에 놓으면 제물입니다.';
        else if (this.equipDrag) hint = '장비를 몬스터 위에 놓으면 끼웁니다. 이미 끼고 있으면 맞바꿉니다.';
        else if (G.equipBag.length && G.monsters.length && !G.monsters.some(m => m.equip)) hint = '아래 보관함의 장비를 맵의 몬스터 위로 끌어 놓으면 끼웁니다.';
        else if (G.waveIndex === 0 && G.state === 'prep' && G.monsters.length === 0) hint = `아래 소환 버튼(S)을 누르면 몬스터가 길 옆에 바로 나옵니다. 지금 ${G.summonCost()}골드입니다.`;
        else if (G.waveIndex === 0 && G.state === 'prep' && G.stats.merged === 0 && G.monsters.length >= 2) hint = '몬스터를 끌어 다른 몬스터 위에 놓으면 합칩니다. 빈 칸으로 옮길 수도 있습니다.';
        else if (G.state === 'prep' && G.hp < COMBAT_RULES.maxHp && G.stats.sacrificed === 0 && G.monsters.length > 0) hint = '몬스터를 왕좌의 마왕 위로 끌어 바치면 체력을 회복하고 번개가 빨리 돌아옵니다.';
        else if (CORRUPTION_ENABLED && G.corpses.length > 0 && !this.corruptHintShown) hint = '쓰러진 용사를 누르면 내 부하가 됩니다. 5초 안에 고르세요!';
        if (hint) {
            const pulse = 1 + Math.sin(G.time * 5) * 0.03;
            UIKit.text(ctx, hint, GAME_WIDTH / 2, 196, Math.round(32 * pulse), '#ffe08a', 'center');
        }
    },

    // 화면 좌표: 맵 몬스터 머리 위(배지 자리)
    monsterTopScreen(m) {
        return { x: m.x * WORLD_ZOOM, y: (m.y + MONSTER_FOOT - MONSTERS[m.type].art.barY - 26) * WORLD_ZOOM };
    },

    // 고르거나 끄는 동안 합칠 수 있는 몬스터 위의 배지: 공개 조합식은 결과 그림, 등급 합치기는 다음 등급 '?'
    drawMergeBadges(ctx) {
        const focus = this.focus();
        if (!focus || !Game.inPlay()) return;
        const badge = (x, y, plan, hot) => {
            const s = hot ? 56 : 44;
            const bx = Math.round(x - s / 2);
            const by = Math.round(y - s);
            const bob = Math.round(Math.sin(Game.time * 4 + x) * 2);
            if (plan.kind === 'recipe') {
                UIKit.frame(ctx, bx - 4, by - 4 + bob, s + 8, s + 8, 'gold', 4);
                this.drawMonsterIcon(ctx, plan.result, bx, by + bob, s);
            } else {
                const color = MONSTER_GRADES[plan.grade].color;
                UIKit.frame(ctx, bx - 4, by - 4 + bob, s + 8, s + 8, 'dark', 4);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(bx, by + bob, s, s);
                UIKit.text(ctx, '?', x, by + s / 2 + bob, hot ? 34 : 28, color, 'center');
            }
        };
        const hotMonster = this.drag && this.dropTarget && this.dropTarget.monster;
        for (const m of Game.monsters) {
            if (focus.loc.monster === m || m.reveal > 0) continue;
            const plan = this.shownPlan(focus.loc.monster, m);
            if (plan.kind !== 'recipe' && plan.kind !== 'grade') continue;
            const p = this.monsterTopScreen(m.down > 0 ? { ...m, x: m.homeX, y: m.homeY } : m);
            badge(p.x, p.y, plan, hotMonster === m);
        }
        // 끄는 중 놓을 곳 설명: 합치면 무엇이 되는지, 왜 안 되는지
        if (!this.drag || !this.dropTarget) return;
        const act = this.dropAction(this.dropTarget);
        let text = null;
        let color = '#ffe08a';
        if (act.action === 'sacrifice') {
            // 실제로 얻는 효과(체력은 최대치까지만)
            const room = Math.max(0, COMBAT_RULES.maxHp - Game.hp);
            const heal = Math.min(act.gain.heal, room);
            text = `제물: ${sacrificeText({ heal, lightning: act.gain.lightning })}${room === 0 ? ' (체력 가득)' : ''}`;
        } else if (act.action === 'merge') {
            text = act.plan.kind === 'recipe' ? `합치기 → ${MONSTERS[act.plan.result].name}`
                : (act.plan.kind === 'grade' ? `합치기 → ${MONSTER_GRADES[act.plan.grade].name} 무작위` : '합치기 → ???');
            color = act.plan.kind === 'recipe' ? '#ffd76a' : (act.plan.kind === 'grade' ? MONSTER_GRADES[act.plan.grade].color : '#ffffff');
        } else if (act.action === 'invalid' && (act.reason === 'top' || act.reason === 'mismatch' || act.reason === 'unique')) {
            text = { top: '합칠 수 없음 · 최고 등급', mismatch: '합칠 수 없음', unique: '합칠 수 없음 · 전설은 맵에 1마리' }[act.reason];
            color = '#ff8f8f';
        }
        if (text) {
            // 손가락 아래쪽에 띄운다. 하단 바 근처에서는 위쪽에 띄운다
            const x = clamp(this.mouse.x, 200, GAME_WIDTH - 200);
            const y = this.mouse.y > GAME_HEIGHT - 260 ? this.mouse.y - 150 : this.mouse.y + 70;
            UIKit.text(ctx, text, x, y, 28, color, 'center');
            // 합치면 결과가 이어받을 장비: 글자 오른쪽에 작은 칸
            const keep = act.action === 'merge' ? Game.mergeEquip(this.drag.src.monster, act.loc.monster).keep : null;
            if (keep) {
                ctx.font = `28px ${UI_FONT}`;
                const ex = Math.round(x + ctx.measureText(text).width / 2 + 12);
                const ey = Math.round(y - 15);
                UIKit.frame(ctx, ex, ey, 30, 30, 'dark', 3);
                ctx.lineWidth = 2;
                ctx.strokeStyle = MONSTER_GRADES[EQUIPMENT[keep].grade].color;
                ctx.strokeRect(ex + 1, ey + 1, 28, 28);
                this.drawEquipIcon(ctx, keep, ex + 3, ey + 3, 0.5);
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
                const x = clamp(ed.x, 320, GAME_WIDTH - 320);
                const y = ed.y > GAME_HEIGHT - 260 ? ed.y - 110 : ed.y + 90;
                UIKit.text(ctx, text, x, y, 26, MONSTER_GRADES[EQUIPMENT[ed.id].grade].light, 'center');
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

    // "히든 조합 발견!": 화면 가운데 띠, 재료 두 마리(랭크 조건이 있으면 이름 뒤에)와 결과.
    // 전설 결과는 띠와 결과 그림이 더 크고, 빛줄기가 많고 금색이며 "전설" 글자가 붙는다
    drawDiscovery(ctx) {
        const d = Fx.discovery;
        if (!d || d.age < 0) return;
        const legend = d.grade === 'legendary';
        const a = clamp(Math.min(d.age / 0.2, (d.life - d.age) / 0.4), 0, 1);
        const cx = GAME_WIDTH / 2;
        const cy = 520;
        const half = legend ? 280 : 220;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = legend ? 'rgba(8,4,0,0.55)' : 'rgba(4,2,14,0.55)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const band = ctx.createLinearGradient(0, cy - half, 0, cy + half);
        const c0 = legend ? '90,52,8' : '60,20,90';
        const c1 = legend ? '60,30,4' : '40,12,60';
        band.addColorStop(0, `rgba(${c0},0)`);
        band.addColorStop(0.2, `rgba(${c0},0.94)`);
        band.addColorStop(0.8, `rgba(${c1},0.94)`);
        band.addColorStop(1, `rgba(${c1},0)`);
        ctx.fillStyle = band;
        ctx.fillRect(0, cy - half, GAME_WIDTH, half * 2);
        ctx.fillStyle = '#ffd76a';
        const line = legend ? 8 : 4;
        ctx.fillRect(0, cy - half + 44, GAME_WIDTH, line);
        ctx.fillRect(0, cy + half - 48, GAME_WIDTH, line);
        // 결과 뒤에서 도는 빛줄기
        const rx = cx + 250;
        const ry = cy + 40;
        const rays = legend ? 24 : 14;
        const len = legend ? 420 : 260;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < rays; i++) {
            const ang = d.age * (legend ? 0.9 : 0.7) + i / rays * Math.PI * 2;
            ctx.fillStyle = i % 2 ? 'rgba(255,215,106,0.16)' : (legend ? 'rgba(255,170,60,0.18)' : 'rgba(200,120,255,0.16)');
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + Math.cos(ang - 0.09) * len, ry + Math.sin(ang - 0.09) * len);
            ctx.lineTo(rx + Math.cos(ang + 0.09) * len, ry + Math.sin(ang + 0.09) * len);
            ctx.closePath();
            ctx.fill();
        }
        if (legend) {
            const glow = ctx.createRadialGradient(rx, ry, 0, rx, ry, 170);
            glow.addColorStop(0, `rgba(255,220,120,${0.45 + Math.sin(d.age * 6) * 0.1})`);
            glow.addColorStop(1, 'rgba(255,200,70,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(rx - 170, ry - 170, 340, 340);
        }
        ctx.restore();
        const pop = d.age < 0.25 ? 1.4 - d.age / 0.25 * 0.4 : 1;
        const titleY = cy - (legend ? 150 : 112);
        UIKit.text(ctx, '히든 조합 발견!', cx, titleY, Math.round((legend ? 104 : 88) * pop), '#ffd76a', 'center');
        if (legend) UIKit.text(ctx, `${MONSTER_GRADES.legendary.name} 등급`, cx, titleY + 76, 40, MONSTER_GRADES.legendary.light, 'center');
        const icon = (type, rank, x, size) => {
            this.drawMonsterIcon(ctx, type, x - size / 2, ry - size / 2, size);
            const big = size > 100;
            const label = MONSTERS[type].name + (rank ? ` ${rank}` : '');
            UIKit.text(ctx, label, x, ry + size / 2 + 24, big ? 30 : 24, big ? MONSTER_GRADES[MONSTERS[type].grade].light : '#ffffff', 'center');
        };
        icon(d.a, d.aRank, cx - 400, 96);
        UIKit.text(ctx, '+', cx - 275, ry, 52, '#ffffff', 'center');
        icon(d.b, d.bRank, cx - 150, 96);
        UIKit.text(ctx, '=', cx + 40, ry, 52, '#ffd76a', 'center');
        icon(d.type, null, rx, legend ? 192 : 144);
        ctx.restore();
    },

    drawBanner(ctx) {
        const b = Fx.banner;
        if (!b) return;
        const a = clamp(Math.min(b.age / 0.15, (b.life - b.age) / 0.3), 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        if (b.small) {
            UIKit.text(ctx, b.name, GAME_WIDTH / 2, 240, 52, '#ffffff', 'center');
            UIKit.text(ctx, b.sub, GAME_WIDTH / 2, 298, 32, '#ffe08a', 'center');
        } else {
            const slide = (1 - a) * 80;
            ctx.fillStyle = 'rgba(40,4,20,0.85)';
            ctx.fillRect(0, 380, GAME_WIDTH, 240);
            ctx.fillStyle = '#d4354f';
            ctx.fillRect(0, 380, GAME_WIDTH, 6);
            ctx.fillRect(0, 614, GAME_WIDTH, 6);
            const p = Assets.get(b.portrait || 'portrait_fallenKnight');
            if (p) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(p, 420 - slide, 404, 192, 192);
            }
            UIKit.text(ctx, b.sub, 660 + slide, 450, 32, '#ff9daf');
            UIKit.text(ctx, b.name, 660 + slide, 530, 84, '#ffffff');
        }
        ctx.restore();
    },

    drawTitle(ctx) {
        ctx.fillStyle = 'rgba(5,2,16,0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        const lift = Math.sin(Game.time * 1.4) * 4;
        // 금색 그라데이션 제목
        ctx.save();
        ctx.font = `150px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 26;
        ctx.strokeStyle = '#0a0416';
        ctx.strokeText('던전 수호대', cx, 310 + lift);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#5a2a88';
        ctx.strokeText('던전 수호대', cx, 310 + lift);
        const g = ctx.createLinearGradient(0, 230, 0, 390);
        g.addColorStop(0, '#fff3c0');
        g.addColorStop(0.5, '#ffc95a');
        g.addColorStop(1, '#c9721c');
        ctx.fillStyle = g;
        ctx.fillText('던전 수호대', cx, 310 + lift);
        ctx.restore();
        UIKit.text(ctx, '용사들이 또 왔습니다. 마왕의 왕좌를 지키세요.', cx, 442, 36, '#ffffff', 'center');
        UIKit.frame(ctx, cx - 460, 488, 920, 252, 'panel', 8);
        const lines = [
            `소환(S)하면 몬스터가 길 옆 칸에 바로 나옵니다. 맵에 ${SUMMON_RULES.maxField}마리까지 둡니다.`,
            '몬스터를 다른 몬스터 위에 놓으면 합쳐 더 강한 몬스터가 됩니다.',
            '같은 등급 2마리는 상위 등급으로, 조합식은 정해진 몬스터로. 숨은 조합도 있습니다.',
            '보스와 정예가 주는 장비는 하단 보관함에서 몬스터 위로 끌어 끼웁니다.',
            CORRUPTION_ENABLED && '쓰러진 용사를 5초 안에 누르면 타락시켜 부하로 만듭니다.',
            '마왕 탭의 번개(Q)로 공격하고, 체력이 낮으면 호통(W)!'
        ].filter(Boolean);
        lines.forEach((t, i) => UIKit.plain(ctx, t, cx, 526 + i * 40, 26, '#efe6ff', 'center'));
        UIKit.plain(ctx, '품질 시험판 · 지하 감옥 1층', cx, 900, 24, '#b8a9d0', 'center');
    },

    drawResult(ctx) {
        const G = Game;
        const win = G.state === 'victory';
        ctx.fillStyle = 'rgba(4,2,14,0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        const cx = GAME_WIDTH / 2;
        UIKit.frame(ctx, cx - 430, 230, 860, 590, 'panel', 10);
        UIKit.text(ctx, win ? '왕좌를 지켰습니다!' : '왕좌가 무너졌습니다', cx, 310, 62, win ? '#ffe08a' : '#ff8f9f', 'center');
        const portrait = Assets.get(win ? 'boss_rift_lord_down' : 'boss_rift_lord_cast');
        if (portrait) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(portrait, cx - 390, 370, 256, 256);
        }
        const t = Math.round(G.stats.time);
        const rows = [
            ['남은 마왕 체력', `${G.hp} / ${COMBAT_RULES.maxHp}`],
            ['처치한 용사', `${G.stats.kills}명`],
            CORRUPTION_ENABLED && ['타락시킨 용사', `${G.stats.corrupted}명`],
            ['소환 / 합치기', `${G.stats.summoned}번 / ${G.stats.merged}번`],
            ['걸린 시간', `${Math.floor(t / 60)}분 ${t % 60}초`]
        ].filter(Boolean);
        if (!win) rows.splice(0, 1, ['막아 낸 웨이브', `${G.waveIndex} / ${WAVES.length}`]);
        rows.forEach(([k, v], i) => {
            UIKit.plain(ctx, k, cx - 110, 408 + i * 50, 28, '#c9b6ea');
            UIKit.text(ctx, v, cx + 380, 408 + i * 50, 30, '#ffffff', 'right');
        });
        UIKit.plain(ctx, win ? '"고생했다. 다음 지역은 2단계에서 만들어 두마."' : '"내 의자 다시 사 와."', cx, 660, 24, '#efe6ff', 'center');
    }
};
