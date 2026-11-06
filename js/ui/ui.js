// 화면 UI: 버튼 배치와 입력 처리, HUD 그리기.
const BAR_H = 124; // 하단 바 높이
const BAR_TAB_X = 206; // 체력 구슬 오른쪽의 탭 버튼
const BAR_SLOT_X = 362; // 첫 슬롯 위치
const BAR_SLOT_W = 236;

const UI = {
    mouse: { x: 0, y: 0 },
    buttons: [],
    hoverCell: null,
    selectedMonster: null,
    tab: 'monster', // 하단 바 탭: 'monster' 몬스터 배치, 'demon' 마왕 스킬
    placing: null, // 건설 모드에서 놓을 몬스터 id
    hoverCorpse: null,
    hoverButton: null,
    targeting: false,
    toast: null,
    corruptHintShown: false,
    pressed: null,

    button(id, x, y, w, h, opts) {
        this.buttons.push(Object.assign({ id, x, y, w, h }, opts));
    },

    showToast(text) { this.toast = { text, age: 0, life: 1.6 }; },

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

        // 하단 바: 탭 두 개, 탭에 따라 몬스터 슬롯이나 마왕 스킬 슬롯, 다음 웨이브
        const barY = GAME_HEIGHT - BAR_H;
        this.button('tab_monster', BAR_TAB_X, barY + 8, 136, 52, { tab: 'monster', label: '몬스터', onClick: () => this.setTab('monster') });
        this.button('tab_demon', BAR_TAB_X, barY + 66, 136, 52, { tab: 'demon', label: '마왕', onClick: () => this.setTab('demon') });
        const slotY = barY + 12;
        const slotX = i => BAR_SLOT_X + i * (BAR_SLOT_W + 10);
        if (this.tab === 'monster') {
            MONSTER_SLOTS.forEach((type, i) => {
                this.button(`place_${type}`, slotX(i), slotY, BAR_SLOT_W, 104, {
                    card: type, hotkey: String(i + 1), disabled: G.gold < MONSTERS[type].cost,
                    onClick: () => this.pickMonster(type)
                });
            });
        } else {
            this.button('lightning', slotX(0), slotY, BAR_SLOT_W, 104, { skill: 'lightning', onClick: () => this.toggleLightning() });
            this.button('roar', slotX(1), slotY, BAR_SLOT_W, 104, { skill: 'roar', onClick: () => this.useRoar() });
        }
        if (G.state === 'prep') {
            const bonus = G.waveIndex > 0 ? Math.floor(Math.max(0, G.prepTimer)) : 0;
            this.button('next', slotX(3) + 20, barY + 22, 330, 84, {
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

    layoutMonsterMenu() {
        const f = this.selectedMonster;
        const def = MONSTERS[f.type];
        const w = 360;
        const rows = f.tier === 1 ? 1 : (f.tier === 2 ? 2 : 0);
        const h = 108 + rows * 88 + 62;
        const o = this.popupOrigin(f.x, f.y, w, h);
        this.popup = { x: o.x, y: o.y, w, h, monster: f };
        let y = o.y + 100;
        if (f.tier === 1) {
            const cost = upgradeCost(f.type, 2);
            this.button('up2', o.x + 12, y, w - 24, 80, {
                upgrade: { name: '2단계 강화', desc: f.place === 'path' ? '피해·체력 +50%' : '피해 +50%', cost },
                disabled: Game.gold < cost,
                onClick: () => { if (!Game.upgrade(f)) this.showToast('골드가 부족합니다.'); }
            });
            y += 88;
        } else if (f.tier === 2) {
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
        const refund = Math.floor(f.invested * COMBAT_RULES.sellRefund);
        this.button('sell', o.x + 12, y, w - 24, 50, {
            label: `판매  +${refund}G`, theme: 'danger', size: 22,
            onClick: () => { Game.sell(f); this.clearSelection(); }
        });
    },

    clearSelection() {
        this.selectedMonster = null;
        this.popup = null;
    },

    // 우클릭과 Esc: 건설 모드, 번개 조준, 몬스터 선택을 모두 끈다
    cancel() {
        this.clearSelection();
        this.placing = null;
        this.targeting = false;
    },

    startGame() {
        Game.reset();
        Game.speed = 1;
        this.cancel();
        this.tab = 'monster';
    },

    setTab(tab) {
        if (this.tab === tab) return;
        this.tab = tab;
        if (tab !== 'monster') this.placing = null;
        if (tab !== 'demon') this.targeting = false;
    },

    // 몬스터 슬롯을 고르면 건설 모드가 된다. 같은 슬롯을 다시 고르면 취소한다
    pickMonster(type) {
        if (!type) return;
        this.setTab('monster');
        if (this.placing === type) { this.placing = null; return; }
        const def = MONSTERS[type];
        if (Game.gold < def.cost) {
            this.showToast(`${def.name}에는 ${def.cost}골드가 필요합니다.`);
            return;
        }
        this.placing = type;
        this.targeting = false;
        this.clearSelection();
    },

    canPlaceAt(col, row) { return !!this.placing && Game.canPlace(this.placing, col, row); },

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

    corpseAt(x, y) {
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
        this.hoverCorpse = this.hoverButton ? null : this.corpseAt(wx, wy);
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        const inGame = Game.state === 'prep' || Game.state === 'wave';
        this.hoverCell = inGame && this.placing && !this.hoverButton && col >= 0 && row >= 0 ? { col, row } : null;
    },

    // shift: Shift를 누른 채 지으면 건설 모드를 이어 간다
    onClick(x, y, shift) {
        Sfx.unlock();
        this.layout();
        const b = this.buttonAt(x, y);
        if (b) {
            if (b.onClick) b.onClick();
            Sfx.play('click');
            return;
        }
        const G = Game;
        if (G.state !== 'prep' && G.state !== 'wave') return;

        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        if (this.targeting) {
            if (castLightning(wx, wy)) this.targeting = false;
            return;
        }
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        // 건설 모드: 놓을 수 있는 칸이면 놓는다. 아니면 아래 타락과 안내로 넘어간다
        if (this.placing && this.canPlaceAt(col, row)) {
            const def = MONSTERS[this.placing];
            if (G.place(this.placing, col, row)) {
                if (!shift) this.placing = null;
            } else {
                this.showToast(`${def.name}에는 ${def.cost}골드가 필요합니다.`);
                this.placing = null;
            }
            return;
        }
        const corpse = this.corpseAt(wx, wy);
        if (corpse) {
            const res = corruptCorpse(corpse);
            if (!res.ok) this.showToast(res.reason === 'gold' ? `타락에는 ${corpse.cost}골드가 필요합니다.` : `타락 유닛은 층당 ${COMBAT_RULES.corruptMax}명까지입니다.`);
            this.corruptHintShown = true;
            return;
        }
        if (this.placing) {
            let msg = monsterPlace(this.placing) === 'path' ? '근접 몬스터는 빛나는 길 칸에만 놓을 수 있습니다.' : '원거리 몬스터는 빛나는 길 옆 칸에만 놓을 수 있습니다.';
            if (G.monsterAt(col, row)) msg = '이미 몬스터가 있는 칸입니다.';
            this.showToast(msg);
            return;
        }
        const f = G.monsterAt(col, row);
        if (f) {
            this.selectedMonster = this.selectedMonster === f ? null : f;
            this.popup = null;
            return;
        }
        if (isBuildCell(col, row) || isPathSlot(col, row)) {
            this.clearSelection();
            this.setTab('monster');
            this.showToast('아래 몬스터 탭에서 놓을 몬스터를 고르세요.');
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
        if (code === 'Space') { G.startWave(); this.clearSelection(); }
        else if (code === 'KeyQ') this.toggleLightning();
        else if (code === 'KeyW') this.useRoar();
        else if (code === 'Tab') this.setTab(this.tab === 'monster' ? 'demon' : 'monster');
        else if (/^Digit[1-9]$/.test(code)) this.pickMonster(MONSTER_SLOTS[Number(code.slice(5)) - 1]);
        else if (code === 'KeyF') G.speed = G.speed === 1 ? 2 : 1;
        else if (code === 'KeyP') G.paused = !G.paused;
        else if (code === 'Escape') this.cancel();
    },

    update(dt) {
        if (this.toast) {
            this.toast.age += dt;
            if (this.toast.age > this.toast.life) this.toast = null;
        }
        if (this.selectedMonster && !Game.monsters.includes(this.selectedMonster)) this.clearSelection();
        this.layout();
        this.hoverButton = this.buttonAt(this.mouse.x, this.mouse.y);
    },

    // 세계 위에 깔리는 사거리 표시와 건설 모드의 반투명 몬스터
    drawRanges(ctx) {
        const cell = this.placing && this.hoverCell;
        if (cell) {
            const ok = this.canPlaceAt(cell.col, cell.row);
            const def = MONSTERS[this.placing];
            const ghost = { x: tileX(cell.col), y: tileY(cell.row), dir: 'down', atkPose: 0, anim: 0 };
            Render.rangeRing(ctx, ghost.x, ghost.y, def.stats.range * TILE, ok ? 'rgba(255,224,138,1)' : 'rgba(255,90,110,1)');
            const { clip, name } = Render.monsterFrame(def, ghost);
            ctx.save();
            ctx.globalAlpha = ok ? 0.6 : 0.3;
            Render.monsterBody(ctx, def, ghost, Assets.get(name), clip); // drawMonster와 같은 위치와 배율
            ctx.restore();
        }
        if (this.selectedMonster) {
            const f = this.selectedMonster;
            Render.rangeRing(ctx, f.x, f.y, monsterStats(f).range * TILE, 'rgba(255,224,138,1)');
        }
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
        this.drawHints(ctx);
        this.drawBanner(ctx);
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
            UIKit.text(ctx, '멈춘 상태에서도 배치와 타락을 할 수 있습니다.', GAME_WIDTH / 2, 392, 26, '#ffffff', 'center');
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
        const corrupt = G.units.filter(u => u.kind === 'corrupt').length;
        UIKit.text(ctx, `타락 ${corrupt}/${COMBAT_RULES.corruptMax}`, 22, 40, 26, '#d7a8ff');
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
        const ratio = clamp(G.hp / COMBAT_RULES.maxHp, 0, 1);
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
        ctx.restore();
        UIKit.text(ctx, String(G.hp), ox, oy - 8, 46, '#ffffff', 'center');
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
    },

    drawParty(ctx) {
        const G = Game;
        const wave = G.currentWave();
        const x = GAME_WIDTH - 372;
        const y = 76;
        const entries = Object.entries(wave.members);
        const elites = Object.entries(wave.elites || {});
        const h = 92 + (entries.length + elites.length) * 62 + (wave.boss ? 62 : 0);
        UIKit.frame(ctx, x, y, 360, h, 'panel', 8);
        UIKit.plain(ctx, G.state === 'wave' ? '이번 파티' : '다음 파티', x + 20, y + 28, 20, '#c9b6ea');
        UIKit.text(ctx, wave.party, x + 20, y + 60, 25, '#ffe08a');
        let ry = y + 90;
        const row = (img, name, note, count, elite) => {
            UIKit.frame(ctx, x + 14, ry - 2, 56, 56, elite ? 'gold' : 'dark', 4);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                const size = img.width * Math.max(1, Math.floor(64 / img.width)); // 도트 격자가 깨지지 않게 정수 배율로 그린다
                ctx.drawImage(img, x + 42 - size / 2, ry + 24 - size / 2, size, size);
            }
            UIKit.text(ctx, name, x + 80, ry + 13, 22, elite ? '#ffd76a' : '#ffffff');
            UIKit.plain(ctx, note, x + 80, ry + 39, 17, '#b8a9d0');
            if (count) UIKit.text(ctx, `x${count}`, x + 340, ry + 22, 28, '#ffffff', 'right');
            ry += 62;
        };
        for (const [type, count] of entries) {
            const def = HEROES[type];
            row(Assets.get(Render.heroStandName(type, false, 'down')), def.name, def.counter, count);
        }
        for (const [type, count] of elites) {
            const def = HEROES[type];
            row(Assets.get(Render.heroStandName(type, false, 'down')), def.name, def.counter, count, true);
        }
        if (wave.boss) row(Assets.get('portrait_fallenKnight'), FLOOR_BOSS.name, '돌진, 주변 몬스터 정지', 1);
    },

    drawBossBar(ctx) {
        const boss = Game.heroes.find(h => h.boss && !h.waiting);
        if (!boss) return;
        const cx = GAME_WIDTH / 2;
        UIKit.frame(ctx, cx - 340, 82, 680, 62, 'danger', 8);
        const p = Assets.get('portrait_fallenKnight');
        if (p) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(p, cx - 332, 84, 58, 58);
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
    drawMonsterIcon(ctx, type, x, y, size) {
        const def = MONSTERS[type];
        ctx.fillStyle = '#0d0918';
        ctx.fillRect(x, y, size, size);
        const img = Assets.get(`${def.sprite}/rotations/south`);
        if (img) {
            ctx.imageSmoothingEnabled = false;
            const s = img.width * Math.max(1, Math.floor(size / img.width)); // 도트 격자가 깨지지 않게 정수 배율로 그린다
            ctx.drawImage(img, x + (size - s) / 2, y + (size - s) / 2, s, s);
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = MONSTER_GRADES[def.grade].color;
        ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    },

    drawPopup(ctx) {
        const p = this.popup;
        UIKit.frame(ctx, p.x, p.y, p.w, p.h, 'panel', 8);
        if (p.monster) {
            const f = p.monster;
            const def = MONSTERS[f.type];
            const stats = monsterStats(f);
            const tier = f.branch ? `3단계 · ${def.branches[f.branch].name}` : `${f.tier}단계`;
            this.drawMonsterIcon(ctx, f.type, p.x + 16, p.y + 14, 56);
            UIKit.text(ctx, def.name, p.x + 84, p.y + 30, 26, '#ffe08a');
            UIKit.plain(ctx, tier, p.x + p.w - 20, p.y + 30, 20, '#c9b6ea', 'right');
            UIKit.plain(ctx, `${MONSTER_GRADES[def.grade].name} · ${MONSTER_ROLES[def.role].name}`, p.x + 84, p.y + 58, 17, MONSTER_GRADES[def.grade].color);
            let line = `피해 ${Math.round(stats.damage)} · 간격 ${stats.interval}초 · 사거리 ${stats.range}`;
            if (f.place === 'path') {
                line = f.down > 0 ? `${Math.ceil(f.down)}초 뒤 다시 일어남 · 피해 ${Math.round(stats.damage)}`
                    : `체력 ${Math.ceil(f.hp)}/${Math.round(stats.hp)} · 피해 ${Math.round(stats.damage)} · 막기 ${stats.block}`;
            }
            UIKit.plain(ctx, line, p.x + 20, p.y + 86, 18, '#ffffff');
        }
    },

    drawButtons(ctx) {
        for (const b of this.buttons) {
            const hover = this.hoverButton === b && !b.disabled;
            if (b.skill) this.drawSkillButton(ctx, b, hover);
            else if (b.card) this.drawCardButton(ctx, b, hover);
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
    drawTooltip(ctx, x, y, title, desc) {
        UIKit.frame(ctx, x, y, 430, 82, 'dark', 6);
        UIKit.text(ctx, title, x + 20, y + 24, 24, '#ffe08a');
        UIKit.plain(ctx, desc, x + 20, y + 56, 19, '#ffffff');
    },

    drawTabButton(ctx, b, hover) {
        const on = this.tab === b.tab;
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, on ? 'gold' : (hover ? 'buttonHover' : 'dark'), 6);
        UIKit.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, 26, on ? '#ffffff' : '#c9b6ea', 'center');
    },

    drawCardButton(ctx, b, hover) {
        const def = MONSTERS[b.card];
        const active = this.placing === b.card;
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, active ? 'goldHover' : (b.disabled ? 'off' : (hover ? 'buttonHover' : 'dark')), 6);
        ctx.save();
        if (b.disabled) ctx.globalAlpha = 0.4;
        this.drawMonsterIcon(ctx, b.card, b.x + 8, b.y + 8, b.h - 16);
        ctx.restore();
        const tx = b.x + b.h + 4;
        UIKit.text(ctx, def.name, tx, b.y + 32, 21, b.disabled ? '#8a8299' : '#ffffff');
        UIKit.text(ctx, `${def.cost}G`, tx, b.y + 72, 24, b.disabled ? '#ff8f8f' : '#ffe08a');
        UIKit.text(ctx, b.hotkey, b.x + b.w - 16, b.y + 72, 22, '#e4d8fa', 'right');
        if (this.hoverButton === b) { // 골드가 모자라 어두운 슬롯도 설명은 보여 준다
            this.drawTooltip(ctx, b.x, b.y - 92, `${def.name} · ${MONSTER_ROLES[def.role].name}`, def.desc);
        }
    },

    drawUpgradeButton(ctx, b, hover) {
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, b.disabled ? 'off' : (hover ? 'buttonHover' : 'button'), 6);
        UIKit.text(ctx, b.upgrade.name, b.x + 18, b.y + 26, 23, '#ffffff');
        UIKit.plain(ctx, b.upgrade.desc, b.x + 18, b.y + 56, 18, '#e4d8fa');
        UIKit.text(ctx, `${b.upgrade.cost}G`, b.x + b.w - 16, b.y + 26, 23, b.disabled ? '#ff8f8f' : '#ffe08a', 'right');
    },

    drawHints(ctx) {
        const G = Game;
        UIKit.text(ctx, 'Tab 탭 전환 · Space 다음 웨이브 · F 배속 · P 일시정지 · M 소리', GAME_WIDTH - 20, GAME_HEIGHT - 146, 20, '#e4d8fa', 'right');

        let hint = null;
        if (this.targeting) hint = '번개를 떨어뜨릴 곳을 누르세요. Esc로 취소합니다.';
        else if (this.placing) hint = `빛나는 ${monsterPlace(this.placing) === 'path' ? '길' : '길 옆'} 칸을 눌러 놓으세요. Shift 이어 놓기 · 우클릭/Esc 취소`;
        else if (G.waveIndex === 0 && G.state === 'prep' && G.monsters.length === 0) hint = '아래 몬스터 탭에서 몬스터를 고른 뒤 빛나는 칸을 누르세요.';
        else if (G.corpses.length > 0 && !this.corruptHintShown) hint = '쓰러진 용사를 누르면 내 부하가 됩니다. 5초 안에 고르세요!';
        if (hint) {
            const pulse = 1 + Math.sin(G.time * 5) * 0.03;
            UIKit.text(ctx, hint, GAME_WIDTH / 2, 196, Math.round(32 * pulse), '#ffe08a', 'center');
        }
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
            const p = Assets.get('portrait_fallenKnight');
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
            '아래 몬스터 탭에서 몬스터를 골라 던전에 놓으세요.',
            '오크는 길을 막고, 궁수와 마법사는 길 옆에서 공격합니다.',
            '쓰러진 용사를 5초 안에 누르면 타락시켜 부하로 만듭니다.',
            '마왕 탭의 번개(Q)로 공격하고, 체력이 낮으면 호통(W)!',
            '용사가 왕좌에 닿으면 마왕의 체력이 줄어듭니다.'
        ];
        lines.forEach((t, i) => UIKit.plain(ctx, t, cx, 530 + i * 42, 26, '#efe6ff', 'center'));
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
            ['타락시킨 용사', `${G.stats.corrupted}명`],
            ['놓은 몬스터', `${G.stats.placed}마리`],
            ['걸린 시간', `${Math.floor(t / 60)}분 ${t % 60}초`]
        ];
        if (!win) rows.splice(0, 1, ['막아 낸 웨이브', `${G.waveIndex} / ${WAVES.length}`]);
        rows.forEach(([k, v], i) => {
            UIKit.plain(ctx, k, cx - 110, 408 + i * 50, 28, '#c9b6ea');
            UIKit.text(ctx, v, cx + 380, 408 + i * 50, 30, '#ffffff', 'right');
        });
        UIKit.plain(ctx, win ? '"고생했다. 다음 지역은 2단계에서 만들어 두마."' : '"내 의자 다시 사 와."', cx, 660, 24, '#efe6ff', 'center');
    }
};
