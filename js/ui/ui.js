// 화면 UI: 버튼 배치와 입력 처리, HUD 그리기.
const UI = {
    mouse: { x: 0, y: 0 },
    buttons: [],
    hoverCell: null,
    selectedCell: null,
    selectedFacility: null,
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

        // 하단 스킬과 다음 웨이브
        const cy = GAME_HEIGHT - 112;
        const cx = GAME_WIDTH / 2;
        this.button('lightning', cx - 250, cy, 96, 96, { skill: 'lightning', onClick: () => this.toggleLightning() });
        this.button('roar', cx - 144, cy, 96, 96, { skill: 'roar', onClick: () => this.useRoar() });
        if (G.state === 'prep') {
            const bonus = G.waveIndex > 0 ? Math.floor(Math.max(0, G.prepTimer)) : 0;
            this.button('next', cx - 36, cy + 6, 330, 84, {
                label: G.waveIndex === 0 ? '첫 웨이브 시작' : `다음 웨이브  +${bonus}G`, theme: 'gold', size: 28,
                sub: `${Math.ceil(Math.max(0, G.prepTimer))}초 뒤 자동 시작`,
                onClick: () => { G.startWave(); this.clearSelection(); }
            });
        }

        if (this.selectedCell) this.layoutBuildMenu();
        if (this.selectedFacility) this.layoutFacilityMenu();
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

    layoutBuildMenu() {
        const { col, row } = this.selectedCell;
        const types = ['archer', 'crystal', 'barracks'];
        const w = 340;
        const rowH = 104;
        const h = rowH * types.length + 20;
        const o = this.popupOrigin(tileX(col), tileY(row), w, h);
        this.popup = { x: o.x, y: o.y, w, h };
        types.forEach((type, i) => {
            const def = FACILITIES[type];
            this.button(`build_${type}`, o.x + 10, o.y + 10 + i * rowH, w - 20, rowH - 8, {
                card: type, disabled: Game.gold < def.cost,
                onClick: () => {
                    const f = Game.build(type, col, row);
                    if (f) this.clearSelection();
                    else this.showToast('골드가 부족합니다.');
                }
            });
        });
    },

    layoutFacilityMenu() {
        const f = this.selectedFacility;
        const def = FACILITIES[f.type];
        const w = 360;
        const rows = f.tier === 1 ? 1 : (f.tier === 2 ? 2 : 0);
        const h = 108 + rows * 88 + 62;
        const o = this.popupOrigin(f.x, f.y, w, h);
        this.popup = { x: o.x, y: o.y, w, h, facility: f };
        let y = o.y + 100;
        if (f.tier === 1) {
            const cost = upgradeCost(f.type, 2);
            this.button('up2', o.x + 12, y, w - 24, 80, {
                upgrade: { name: '2단계 강화', desc: f.type === 'barracks' ? '오크 피해·체력 +50%' : '피해 +50%', cost },
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
        this.selectedCell = null;
        this.selectedFacility = null;
        this.popup = null;
    },

    startGame() {
        Game.reset();
        Game.speed = 1;
        this.clearSelection();
        this.targeting = false;
    },

    toggleLightning() {
        if (Game.skills.lightning > 0) {
            this.showToast(`번개 재사용까지 ${Math.ceil(Game.skills.lightning)}초`);
            return;
        }
        this.targeting = !this.targeting;
        this.clearSelection();
    },

    useRoar() {
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
        this.hoverCell = inGame && !this.hoverButton && !this.targeting && isBuildCell(col, row) ? { col, row } : null;
    },

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
        if (G.state !== 'prep' && G.state !== 'wave') return;

        const wx = x / WORLD_ZOOM;
        const wy = y / WORLD_ZOOM;
        if (this.targeting) {
            if (castLightning(wx, wy)) this.targeting = false;
            return;
        }
        const corpse = this.corpseAt(wx, wy);
        if (corpse) {
            const res = corruptCorpse(corpse);
            if (!res.ok) this.showToast(res.reason === 'gold' ? `타락에는 ${corpse.cost}골드가 필요합니다.` : `타락 유닛은 층당 ${COMBAT_RULES.corruptMax}명까지입니다.`);
            this.corruptHintShown = true;
            return;
        }
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        const f = G.facilityAt(col, row);
        if (f) {
            this.selectedFacility = this.selectedFacility === f ? null : f;
            this.selectedCell = null;
            this.popup = null;
            return;
        }
        if (isBuildCell(col, row)) {
            this.selectedCell = { col, row };
            this.selectedFacility = null;
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
        else if (code === 'KeyF') G.speed = G.speed === 1 ? 2 : 1;
        else if (code === 'KeyP') G.paused = !G.paused;
        else if (code === 'Escape') { this.clearSelection(); this.targeting = false; }
    },

    update(dt) {
        if (this.toast) {
            this.toast.age += dt;
            if (this.toast.age > this.toast.life) this.toast = null;
        }
        if (this.selectedFacility && !Game.facilities.includes(this.selectedFacility)) this.clearSelection();
        this.layout();
        this.hoverButton = this.buttonAt(this.mouse.x, this.mouse.y);
    },

    // 세계 위에 깔리는 사거리 표시
    drawRanges(ctx) {
        let hoveredType = null;
        if (this.hoverButton && this.hoverButton.card) hoveredType = this.hoverButton.card;
        if (this.selectedCell && hoveredType) {
            const def = FACILITIES[hoveredType];
            Render.rangeRing(ctx, tileX(this.selectedCell.col), tileY(this.selectedCell.row), def.range * TILE, 'rgba(255,224,138,1)');
        }
        if (this.selectedFacility) {
            const f = this.selectedFacility;
            Render.rangeRing(ctx, f.x, f.y, facilityStats(f).range * TILE, 'rgba(255,224,138,1)');
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
            UIKit.text(ctx, '멈춘 상태에서도 짓기와 타락을 할 수 있습니다.', GAME_WIDTH / 2, 392, 26, '#ffffff', 'center');
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

    // Asteria 구성의 하단 바: 왼쪽 체력 구슬, 가운데 스킬, 오른쪽 재화
    drawBottomBar(ctx) {
        const G = Game;
        const y = GAME_HEIGHT - 124;
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

        // 마왕 이름
        const portrait = Assets.get('portrait_riftLord');
        UIKit.frame(ctx, 200, y + 18, 88, 88, 'dark', 6);
        if (portrait) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(portrait, 212, y + 30, 64, 64);
        }
        UIKit.text(ctx, '마왕', 304, y + 42, 30, '#ffffff');
        UIKit.plain(ctx, '왕좌를 지키는 중', 304, y + 84, 20, '#c9b6ea');

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
        const h = 92 + entries.length * 62 + (wave.boss ? 62 : 0);
        UIKit.frame(ctx, x, y, 360, h, 'panel', 8);
        UIKit.plain(ctx, G.state === 'wave' ? '이번 파티' : '다음 파티', x + 20, y + 28, 20, '#c9b6ea');
        UIKit.text(ctx, wave.party, x + 20, y + 60, 25, '#ffe08a');
        let ry = y + 90;
        const row = (img, name, note, count) => {
            UIKit.frame(ctx, x + 14, ry - 2, 56, 56, 'dark', 4);
            if (img) {
                ctx.imageSmoothingEnabled = false;
                const size = img.width * Math.max(1, Math.floor(64 / img.width)); // 도트 격자가 깨지지 않게 정수 배율로 그린다
                ctx.drawImage(img, x + 42 - size / 2, ry + 24 - size / 2, size, size);
            }
            UIKit.text(ctx, name, x + 80, ry + 13, 22, '#ffffff');
            UIKit.plain(ctx, note, x + 80, ry + 39, 17, '#b8a9d0');
            if (count) UIKit.text(ctx, `x${count}`, x + 340, ry + 22, 28, '#ffffff', 'right');
            ry += 62;
        };
        for (const [type, count] of entries) {
            const def = HEROES[type];
            row(Assets.get(Render.heroStandName(type, false, 'down')), def.name, def.counter, count);
        }
        if (wave.boss) row(Assets.get('portrait_fallenKnight'), FLOOR_BOSS.name, '돌진, 주변 시설 정지', 1);
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

    drawCardIcon(ctx, type, x, y) {
        ctx.imageSmoothingEnabled = false;
        const i = Assets.get(FACILITY_ART[type].sprite);
        if (i) ctx.drawImage(i, x - 8, y - 8, 96, 96);
    },

    drawPopup(ctx) {
        const p = this.popup;
        UIKit.frame(ctx, p.x, p.y, p.w, p.h, 'panel', 8);
        if (p.facility) {
            const f = p.facility;
            const def = FACILITIES[f.type];
            const stats = facilityStats(f);
            const tier = f.branch ? `3단계 · ${def.branches[f.branch].name}` : `${f.tier}단계`;
            UIKit.text(ctx, def.name, p.x + 20, p.y + 30, 26, '#ffe08a');
            UIKit.plain(ctx, tier, p.x + p.w - 20, p.y + 30, 20, '#c9b6ea', 'right');
            const line = f.type === 'barracks'
                ? `오크 체력 ${Math.round(stats.unitHp)} · 피해 ${Math.round(stats.damage)}`
                : `피해 ${Math.round(stats.damage)} · 간격 ${stats.interval}초 · 사거리 ${stats.range}`;
            UIKit.plain(ctx, line, p.x + 20, p.y + 70, 19, '#ffffff');
        }
    },

    drawButtons(ctx) {
        for (const b of this.buttons) {
            const hover = this.hoverButton === b && !b.disabled;
            if (b.skill) this.drawSkillButton(ctx, b, hover);
            else if (b.card) this.drawCardButton(ctx, b, hover);
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
        const slot = Assets.get('ui_skillSlot');
        ctx.imageSmoothingEnabled = false;
        if (slot) ctx.drawImage(slot, b.x, b.y, b.w, b.h);
        else UIKit.frame(ctx, b.x, b.y, b.w, b.h, 'dark', 6);
        if (lightning) {
            const icon = Assets.get('icon_power_thunderStrike');
            if (icon) ctx.drawImage(icon, b.x + 16, b.y + 16, 64, 64);
        } else {
            const icon = Assets.get('portrait_riftLord');
            if (icon) ctx.drawImage(icon, b.x + 16, b.y + 16, 64, 64);
        }
        if (cd > 0 || locked) {
            const ratio = locked ? 1 : cd / max;
            ctx.fillStyle = 'rgba(4,2,12,0.72)';
            ctx.fillRect(b.x + 12, b.y + 12 + (b.h - 24) * (1 - ratio), b.w - 24, (b.h - 24) * ratio);
            if (!locked) UIKit.text(ctx, String(Math.ceil(cd)), b.x + b.w / 2, b.y + b.h / 2, 32, '#ffffff', 'center');
        }
        if (hover || (lightning && this.targeting)) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffe08a';
            ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
        }
        UIKit.text(ctx, lightning ? 'Q' : 'W', b.x + 18, b.y + 20, 22, '#ffffff', 'center');
        if (hover) {
            const name = lightning ? '마왕의 번개' : '마왕의 호통';
            const desc = lightning ? `범위 피해 ${COMBAT_RULES.lightning.damage}, 재사용 ${max}초` : `모든 용사 ${COMBAT_RULES.roar.duration}초 정지, 체력 ${COMBAT_RULES.roar.unlockHp} 이하`;
            UIKit.frame(ctx, b.x - 60, b.y - 92, 430, 82, 'dark', 6);
            UIKit.text(ctx, name, b.x - 40, b.y - 68, 24, '#ffe08a');
            UIKit.plain(ctx, desc, b.x - 40, b.y - 36, 19, '#ffffff');
        }
    },

    drawCardButton(ctx, b, hover) {
        const def = FACILITIES[b.card];
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, b.disabled ? 'off' : (hover ? 'buttonHover' : 'dark'), 6);
        ctx.save();
        if (b.disabled) ctx.globalAlpha = 0.5;
        this.drawCardIcon(ctx, b.card, b.x + 6, b.y + 4);
        ctx.restore();
        UIKit.text(ctx, def.name, b.x + 92, b.y + 26, 23, b.disabled ? '#a59db5' : '#ffffff');
        UIKit.plain(ctx, def.desc, b.x + 92, b.y + 62, 16, '#c9b6ea');
        UIKit.text(ctx, `${def.cost}G`, b.x + b.w - 14, b.y + 26, 23, b.disabled ? '#ff8f8f' : '#ffe08a', 'right');
    },

    drawUpgradeButton(ctx, b, hover) {
        UIKit.frame(ctx, b.x, b.y, b.w, b.h, b.disabled ? 'off' : (hover ? 'buttonHover' : 'button'), 6);
        UIKit.text(ctx, b.upgrade.name, b.x + 18, b.y + 26, 23, '#ffffff');
        UIKit.plain(ctx, b.upgrade.desc, b.x + 18, b.y + 56, 18, '#e4d8fa');
        UIKit.text(ctx, `${b.upgrade.cost}G`, b.x + b.w - 16, b.y + 26, 23, b.disabled ? '#ff8f8f' : '#ffe08a', 'right');
    },

    drawHints(ctx) {
        const G = Game;
        UIKit.text(ctx, 'Space 다음 웨이브 · F 배속 · P 일시정지 · M 소리', GAME_WIDTH - 20, GAME_HEIGHT - 146, 20, '#e4d8fa', 'right');

        let hint = null;
        if (this.targeting) hint = '번개를 떨어뜨릴 곳을 누르세요. Esc로 취소합니다.';
        else if (G.waveIndex === 0 && G.state === 'prep' && G.facilities.length === 0) hint = '길 옆의 빛나는 칸을 눌러 시설을 지으세요.';
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
        UIKit.frame(ctx, cx - 460, 500, 920, 216, 'panel', 8);
        const lines = [
            '길 옆 칸을 눌러 시설을 지으면 용사를 자동으로 공격합니다.',
            '쓰러진 용사를 5초 안에 누르면 타락시켜 부하로 만듭니다.',
            'Q로 마왕의 번개를 떨어뜨리고, 체력이 낮으면 W로 호통치세요.',
            '용사가 왕좌에 닿으면 마왕의 체력이 줄어듭니다.'
        ];
        lines.forEach((t, i) => UIKit.plain(ctx, t, cx, 548 + i * 42, 26, '#efe6ff', 'center'));
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
            ['지은 시설', `${G.stats.built}개`],
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
