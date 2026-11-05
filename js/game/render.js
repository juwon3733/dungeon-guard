// 게임 세계 그리기. 상태를 읽기만 하고 바꾸지 않는다(UI 버튼 제외).
const Render = {
    mapLayer: null,

    buildMap() {
        const c = document.createElement('canvas');
        c.width = GAME_WIDTH;
        c.height = GAME_HEIGHT;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;

        // 우주 배경 위에 떠 있는 섬: Asteria의 지역 구성과 같다
        const space = Assets.get('void_shadow');
        if (space) g.drawImage(space, 0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Why: 섬 원본은 정사각형이라 윗면이 화면 전체를 덮도록 가로로 더 늘린다. 절벽은 하단 HUD 뒤로 이어진다.
        const island = Assets.get('island_shadow');
        if (island) g.drawImage(island, -24, -26, 1968, 1400);

        // 지면이 어두우면 전투가 묻히므로 은은하게 밝힌다
        g.save();
        g.globalCompositeOperation = 'lighter';
        const lift = g.createRadialGradient(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.46, 120, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.46, 1000);
        lift.addColorStop(0, 'rgba(70,45,110,0.28)');
        lift.addColorStop(1, 'rgba(70,45,110,0)');
        g.fillStyle = lift;
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        g.restore();

        this.drawThroneDais(g);
        this.drawDeck(g);

        const portal = Assets.get('prop_fieldPortal');
        if (portal) g.drawImage(portal, -28, tileY(3) - 112, 192, 192);

        const v = g.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, GAME_WIDTH / 2, GAME_HEIGHT / 2, 1180);
        v.addColorStop(0, 'rgba(0,0,10,0)');
        v.addColorStop(1, 'rgba(0,0,10,0.42)');
        g.fillStyle = v;
        g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.mapLayer = c;
    },

    // 원본 다리 그림에서 난간과 돌바닥을 잘라 길로 잇는다
    drawDeck(g) {
        const deck = Assets.get('bridgedeck_shadow');
        if (!deck) return;
        const DECK = { top: 230, bottom: 770, width: 150 }; // 원본의 난간 포함 세로 범위와 화면 폭
        const srcH = DECK.bottom - DECK.top;
        const unit = deck.width * DECK.width / srcH;
        const half = DECK.width / 2;
        for (const s of PATH.segments) {
            g.save();
            g.translate(s.ax, s.ay);
            g.rotate(Math.atan2(s.dy, s.dx));
            for (let x = 0; x < s.len; x += unit - 1) {
                const w = Math.min(unit, s.len - x);
                g.drawImage(deck, 0, DECK.top, deck.width * (w / unit), srcH, x, -half, w, DECK.width);
            }
            g.restore();
        }
        // 꺾이는 곳은 난간 없는 돌바닥으로 덮고 네 귀퉁이에 기둥을 세운다
        for (let i = 1; i < PATH_TILES.length - 1; i++) {
            const x = tileX(PATH_TILES[i][0]);
            const y = tileY(PATH_TILES[i][1]);
            g.drawImage(deck, 300, 400, 200, 200, x - half + 12, y - half + 12, DECK.width - 24, DECK.width - 24);
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                g.fillStyle = '#1a1626';
                g.fillRect(x + sx * (half - 8) - 13, y + sy * (half - 8) - 13, 26, 26);
                g.fillStyle = '#5a4f73';
                g.fillRect(x + sx * (half - 8) - 9, y + sy * (half - 8) - 11, 18, 18);
                g.fillStyle = '#c56bff';
                g.fillRect(x + sx * (half - 8) - 3, y + sy * (half - 8) - 5, 6, 6);
            }
        }
    },

    drawThroneDais(g) {
        const size = TILE * 3;
        const x = THRONE_TILE.col * TILE - TILE;
        const y = MAP_TOP + THRONE_TILE.row * TILE - TILE;
        for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
                const img = Assets.get(dc === 1 && dr === 1 ? 'tile_shadow_rare' : 'tile_shadow_detailB');
                if (img) g.drawImage(img, x + dc * TILE, y + dr * TILE, TILE, TILE);
            }
        }
        g.lineWidth = 6;
        g.strokeStyle = '#1a1626';
        g.strokeRect(x, y, size, size);
        g.lineWidth = 2;
        g.strokeStyle = '#a36bff';
        g.strokeRect(x + 5, y + 5, size - 10, size - 10);
    },

    sprite(ctx, img, x, footY, scale, footPx, flip) {
        if (!img) return;
        const s = scale || 2;
        const w = img.width * s;
        const h = img.height * s;
        const foot = (footPx === undefined ? img.height * 0.89 : footPx) * s;
        ctx.imageSmoothingEnabled = false;
        if (flip) {
            ctx.save();
            ctx.translate(x, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -w / 2, footY - foot, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(img, x - w / 2, footY - foot, w, h);
        }
    },

    shadow(ctx, x, y, rx, ry, alpha) {
        ctx.fillStyle = `rgba(2,0,10,${alpha === undefined ? 0.42 : alpha})`;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // 그릴 그림 이름과 배율, 발 위치. PixelLab 그림이 있는 용사는 그쪽을 쓴다(동작은 아직 없어 방향 그림만).
    heroSprite(type, female, dir, anim, atkPose, casting) {
        const def = HEROES[type];
        const plName = def.pl && `${def.pl}/rotations/${PL_DIRS[dir] || 'south'}`;
        if (plName && Assets.get(plName)) return { name: plName, scale: PL_SCALE, foot: def.plFoot }; // 그림이 아직 없으면 Asteria 그림을 쓴다
        return { name: this.heroSpriteName(type, female, dir, anim, atkPose, casting), scale: HERO_SCALE, foot: 57 };
    },

    heroSpriteName(type, female, dir, anim, atkPose, casting) {
        const base = HEROES[type].sprite + (female ? '_female' : '');
        if (atkPose > 0) {
            const frame = atkPose > 0.11 ? 0 : 1;
            return `${base}_act_${dir}_${casting ? 'cast' : 'atk'}${frame}`;
        }
        return `${base}_walk_${dir}${Math.floor(anim) % 4}`;
    },

    drawHero(ctx, h) {
        const p = heroWorld(h);
        if (h.waiting) return;
        if (h.boss) {
            const bob = h.windup > 0 ? 0 : Math.sin(h.anim * 0.9) * 4;
            let name = 'boss_fallen_knight_down';
            let flip = false;
            if (h.windup > 0) name = 'boss_fallen_knight_windup';
            else if (h.atkPose > 0) name = 'boss_fallen_knight_slam';
            else if (h.dir === 'left') name = 'boss_fallen_knight_left';
            else if (h.dir === 'right') { name = 'boss_fallen_knight_left'; flip = true; }
            this.shadow(ctx, p.x, p.y + 10, 50, 15);
            if (h.chargeTime > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.4;
                const back = pathAt(h.d - 36);
                this.sprite(ctx, Assets.tinted(name, '#a56bff', 0.9), back.x, back.y + bob + 12, BOSS_SCALE, 118, flip);
                ctx.restore();
            }
            const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            this.sprite(ctx, img, p.x, p.y + bob + 12, BOSS_SCALE, 118, flip);
        } else {
            const casting = h.type === 'mage';
            const spr = this.heroSprite(h.type, h.female, h.dir, h.anim, h.atkPose, casting);
            this.shadow(ctx, p.x, p.y + 9, 19, 6);
            const img = h.flash > 0 ? Assets.tinted(spr.name, '#ffffff', 0.85) : Assets.get(spr.name);
            this.sprite(ctx, img, p.x, p.y + 10, spr.scale, spr.foot);
            this.healthBar(ctx, p.x, p.y - 64, h.hp / h.maxHp, 40, '#ff5a5a');
        }
        if (h.stun > 0) this.stunStars(ctx, p.x, p.y - (h.boss ? 165 : 72));
    },

    healthBar(ctx, x, y, ratio, w, color) {
        if (ratio >= 0.999) return;
        ctx.fillStyle = '#0a0812';
        ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x - w / 2, y, w * clamp(ratio, 0, 1), 6);
    },

    stunStars(ctx, x, y) {
        const t = Game.time * 5;
        ctx.fillStyle = '#ffe36b';
        for (let i = 0; i < 3; i++) {
            const a = t + i * 2.1;
            ctx.fillRect(Math.round(x + Math.cos(a) * 28) - 4, Math.round(y + Math.sin(a) * 9) - 4, 8, 8);
        }
    },

    drawUnit(ctx, u) {
        if (u.kind === 'orc') {
            const name = u.atkPose > 0 ? 'anim_boarWarrior_attack' : (u.moving ? `anim_boarWarrior_walk${Math.floor(u.anim) % 2}` : 'anim_boarWarrior_walk0');
            this.shadow(ctx, u.x, u.y + 8, 20, 7);
            const img = u.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            this.sprite(ctx, img, u.x, u.y + 10, HERO_SCALE, 56, u.facing > 0);
        } else {
            const casting = u.heroType === 'mage';
            const spr = this.heroSprite(u.heroType, u.female, u.dir || 'down', 0, u.atkPose, casting);
            const name = spr.name;
            this.shadow(ctx, u.x, u.y + 9, 21, 7, 0.6);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const pulse = 0.2 + Math.sin(Game.time * 4) * 0.08;
            ctx.fillStyle = `rgba(150,60,230,${pulse})`;
            ctx.beginPath();
            ctx.ellipse(u.x, u.y + 9, 30, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            const risen = u.rise > 0 ? 1 - u.rise / 0.5 : 1;
            const img = u.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.tinted(name, '#7c2bd6', 0.48);
            ctx.save();
            ctx.globalAlpha = 0.4 + 0.6 * risen;
            this.sprite(ctx, img, u.x, u.y + 10 + (1 - risen) * 14, spr.scale, spr.foot);
            ctx.restore();
        }
        this.healthBar(ctx, u.x, u.y - 66, u.hp / u.maxHp, 40, u.kind === 'corrupt' ? '#c56bff' : '#74d65a');
    },

    drawFacility(ctx, f) {
        const stunned = f.stun > 0;
        const recoil = f.recoil * 5;
        // 돌 받침과 뒤쪽 빛: 어두운 바닥에서 시설의 실루엣이 먼저 보이게 한다
        ctx.fillStyle = '#17112a';
        ctx.fillRect(f.x - 42, f.y + 8, 84, 34);
        ctx.fillStyle = '#4a3d6e';
        ctx.fillRect(f.x - 38, f.y + 8, 76, 6);
        ctx.fillStyle = '#2a2144';
        ctx.fillRect(f.x - 38, f.y + 14, 76, 22);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const tint = { archer: '120,170,255', crystal: '190,90,255', barracks: '255,130,70' }[f.type];
        const glowAlpha = 0.3 + Math.sin(Game.time * 2.4 + f.bob) * 0.05 + (f.tier - 1) * 0.08;
        const back = ctx.createRadialGradient(f.x, f.y - 40, 10, f.x, f.y - 40, 110);
        back.addColorStop(0, `rgba(${tint},${glowAlpha})`);
        back.addColorStop(1, `rgba(${tint},0)`);
        ctx.fillStyle = back;
        ctx.fillRect(f.x - 110, f.y - 150, 220, 220);
        ctx.restore();
        if (f.tier >= 2) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const color = f.tier >= 3 ? '255,190,90' : '160,110,255';
            const pulse = 0.2 + Math.sin(Game.time * 3 + f.bob) * 0.05;
            ctx.fillStyle = `rgba(${color},${pulse})`;
            ctx.beginPath();
            ctx.ellipse(f.x, f.y + 26, 54, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        let name;
        let footPx;
        let y = f.y + 34;
        if (f.type === 'archer') {
            name = 'facility_archer';
            footPx = 86;
            y += recoil;
        } else if (f.type === 'crystal') {
            name = 'prop_shard';
            footPx = 74;
            y = f.y + 28 + Math.sin(f.bob) * 5 + recoil;
        } else {
            name = 'wall_shadow_doorOpen';
            footPx = 44;
            y = f.y + 30;
        }
        const img = stunned ? Assets.tinted(name, '#7fc6ff', 0.55) : Assets.get(name);
        this.sprite(ctx, img, f.x, y, 2, footPx);

        if (f.type === 'barracks') {
            // 초소 깃발: 전용 그림이 나오기 전까지 도형으로 표시한다
            ctx.fillStyle = '#332148';
            ctx.fillRect(f.x - 4, f.y - 74, 6, 42);
            ctx.fillStyle = f.tier >= 3 ? '#ffb45a' : '#b5392f';
            ctx.fillRect(f.x + 2, f.y - 74, 26, 16);
        }
        if (f.muzzle > 0) {
            const ox = f.x;
            const oy = f.y - (f.type === 'archer' ? 120 : 92);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(205,160,255,0.85)';
            ctx.beginPath();
            ctx.arc(ox, oy, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // 단계 표시
        for (let i = 0; i < f.tier; i++) {
            const sx = f.x - (f.tier - 1) * 11 + i * 22;
            const sy = f.y + 44;
            ctx.fillStyle = '#120c20';
            ctx.fillRect(sx - 8, sy - 8, 16, 16);
            ctx.fillStyle = f.tier >= 3 ? '#ffd76a' : '#c8a6ff';
            ctx.fillRect(sx - 5, sy - 5, 10, 10);
        }
        if (stunned) {
            this.stunStars(ctx, f.x, f.y - 112);
            UIKit.text(ctx, '정지', f.x, f.y - 138, 22, '#9fdcff', 'center');
        }
    },

    drawThrone(ctx) {
        const x = tileX(THRONE_TILE.col);
        const y = tileY(THRONE_TILE.row);
        const hurt = Game.throneFlash > 0;
        const casting = Fx.dim > 0.3;
        const name = casting ? 'boss_rift_lord_cast' : 'boss_rift_lord_down';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.2 + Math.sin(Game.time * 2) * 0.06;
        const g = ctx.createRadialGradient(x, y - 20, 10, x, y - 20, 200);
        g.addColorStop(0, `rgba(170,70,255,${pulse})`);
        g.addColorStop(1, 'rgba(170,70,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 200, y - 220, 400, 400);
        ctx.restore();
        this.shadow(ctx, x, y + 26, 84, 24, 0.55);
        const bob = Math.sin(Game.time * 1.6) * 3;
        const img = hurt ? Assets.tinted(name, '#ff4466', 0.7) : Assets.get(name);
        this.sprite(ctx, img, x, y + 30 + bob, 2, 118);
    },

    drawCorpse(ctx, c) {
        const spr = this.heroSprite(c.type, c.female, 'down', 0, 0, false);
        const name = spr.name;
        const left = 1 - c.age / c.life;
        const blink = left < 0.3 ? (Math.floor(Game.time * 8) % 2 === 0 ? 0.45 : 0.9) : 0.9;
        const hovered = UI.hoverCorpse === c;
        ctx.save();
        ctx.translate(c.x, c.y + 8);
        ctx.rotate(Math.PI / 2 * 0.92);
        ctx.globalAlpha = blink;
        const img = hovered ? Assets.tinted(name, '#b56bff', 0.45) : Assets.tinted(name, '#1b1030', 0.35);
        if (img) {
            ctx.imageSmoothingEnabled = false;
            const w = img.width * spr.scale;
            const h = img.height * spr.scale;
            ctx.drawImage(img, -w / 2, -18 - h / 2, w, h);
        }
        ctx.restore();

        // 남은 시간 고리
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#120a22';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 46, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = Game.gold >= c.cost ? '#c56bff' : '#6a5f7c';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 46, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.stroke();
        ctx.restore();
        UIKit.text(ctx, `${c.cost}`, c.x, c.y - 70, hovered ? 24 : 18, Game.gold >= c.cost ? '#e9c8ff' : '#8f8599', 'center');
    },

    drawProjectile(ctx, p) {
        if (p.kind === 'arrow') {
            const img = Assets.get(p.big ? 'fx_arrowBig' : 'fx_arrowPoison');
            const size = p.big ? 170 : 120;
            const frame = Math.floor(Game.time * 18) % 4;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle || 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.imageSmoothingEnabled = false;
            if (img) ctx.drawImage(img, frame * 128, 0, 128, 128, -size / 2, -size / 2, size, size);
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 32);
            g.addColorStop(0, 'rgba(255,245,255,1)');
            g.addColorStop(0.4, 'rgba(180,100,255,0.9)');
            g.addColorStop(1, 'rgba(120,40,220,0)');
            ctx.fillStyle = g;
            ctx.fillRect(p.x - 32, p.y - 32, 64, 64);
            ctx.restore();
        }
    },

    drawBuildPads(ctx) {
        const showAll = Game.state === 'prep' || UI.selectedCell;
        if (!showAll) return;
        const pulse = 0.14 + Math.sin(Game.time * 3) * 0.05;
        ctx.lineWidth = 3;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            if (Game.facilityAt(c, r)) continue;
            const x = c * TILE;
            const y = MAP_TOP + r * TILE;
            ctx.strokeStyle = `rgba(190,150,255,${pulse})`;
            ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
        }
    },

    drawHoverCell(ctx) {
        const cell = UI.selectedCell || UI.hoverCell;
        if (!cell || Game.state === 'title') return;
        const x = cell.col * TILE;
        const y = MAP_TOP + cell.row * TILE;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffe08a';
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = 'rgba(255,224,138,0.12)';
        ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
    },

    rangeRing(ctx, x, y, radius, color) {
        ctx.save();
        ctx.fillStyle = color.replace('1)', '0.1)');
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -Game.time * 40;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
    },

    drawTorches(ctx) {
        const t = Game.time;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [c, r] of TORCHES) {
            const x = tileX(c);
            const y = tileY(r) - 10;
            const flick = 0.82 + Math.sin(t * 9 + c) * 0.09 + Math.sin(t * 23 + r * 5) * 0.05;
            const radius = 200 * flick;
            const g = ctx.createRadialGradient(x, y, 8, x, y, radius);
            g.addColorStop(0, `rgba(255,150,70,${0.34 * flick})`);
            g.addColorStop(0.45, `rgba(190,70,40,${0.1 * flick})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
        // 불꽃 도트
        for (const [c, r] of TORCHES) {
            const x = tileX(c);
            const y = tileY(r) - 10;
            ctx.fillStyle = '#2a1a2c';
            ctx.fillRect(x - 4, y + 2, 8, 18);
            const f = Math.floor(t * 12 + c) % 3;
            ctx.fillStyle = '#ff6b2c';
            ctx.fillRect(x - 8, y - 12 - f * 2, 16, 16 + f * 2);
            ctx.fillStyle = '#ffc94d';
            ctx.fillRect(x - 4, y - 8 - f, 8, 10 + f);
        }
    },

    drawEffects(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = false;
        for (const a of Fx.anims) {
            const img = Assets.get(a.name);
            if (!img) continue;
            const frame = Math.min(7, Math.floor(a.age / a.life * 8));
            const half = a.size / 2;
            ctx.drawImage(img, frame * 128, 0, 128, 128, a.x - half, a.y - half, a.size, a.size);
        }
        for (const g of Fx.glows) {
            const a = 1 - g.age / g.life;
            const grad = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, g.radius);
            grad.addColorStop(0, g.color.replace(',1)', `,${0.7 * a})`));
            grad.addColorStop(1, g.color.replace(',1)', ',0)'));
            ctx.fillStyle = grad;
            ctx.fillRect(g.x - g.radius, g.y - g.radius, g.radius * 2, g.radius * 2);
        }
        for (const p of Fx.particles) {
            ctx.globalAlpha = clamp(p.life / p.max * 1.4, 0, 1);
            ctx.fillStyle = p.color;
            const s = p.size;
            // 도트처럼 보이도록 2픽셀 격자에 맞춰 사각형으로 그린다
            ctx.fillRect(Math.round(p.x / 2) * 2 - s / 2, Math.round(p.y / 2) * 2 - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        for (const r of Fx.rings) {
            const t = r.age / r.life;
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 8 * (1 - t) + 2;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius * (0.25 + 0.75 * Math.sqrt(t)), 0, Math.PI * 2);
            ctx.stroke();
        }
        for (const b of Fx.beams) {
            const t = b.age / b.life;
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.width * (1 - t * 0.6);
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.moveTo(b.ax, b.ay);
            ctx.lineTo(b.bx, b.by);
            ctx.stroke();
        }
        for (const b of Fx.bolts) {
            const t = b.age / b.life;
            ctx.globalAlpha = 1 - t;
            for (const [color, width] of [[b.color, 16], ['#ffffff', 5]]) {
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                ctx.lineJoin = 'miter';
                ctx.beginPath();
                b.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    drawNumbers(ctx) {
        for (const n of Fx.numbers) {
            // 처음 120ms는 크게 튀어나온다 (Asteria와 같은 기준)
            const pop = n.age < 0.12 ? 1.55 - (n.age / 0.12) * 0.55 : 1;
            const size = Math.round((n.big ? 50 : 26) * pop);
            ctx.save();
            ctx.globalAlpha = clamp((n.life - n.age) / 0.25, 0, 1);
            UIKit.text(ctx, String(n.amount), n.x, n.y, size, n.color, 'center');
            ctx.restore();
        }
    },

    drawSpeech(ctx) {
        for (const s of Fx.speech) {
            const a = clamp(Math.min(s.age / 0.1, (s.life - s.age) / 0.2), 0, 1);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.font = `24px ${UI_FONT}`;
            const w = ctx.measureText(s.text).width + 32;
            const x = clamp(s.x, w / 2 + 8, GAME_WIDTH - w / 2 - 8);
            const y = s.y - (1 - a) * 8;
            UIKit.frame(ctx, x - w / 2, y - 26, w, 48, s.boss ? 'danger' : 'speech', 6);
            ctx.fillStyle = s.boss ? '#ffe6ea' : '#1c1428';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.text, x, y - 1);
            ctx.restore();
        }
    },

    drawCoins(ctx) {
        for (const c of Fx.coins) {
            ctx.fillStyle = '#6b3f0a';
            ctx.fillRect(c.x - 9, c.y - 9, 18, 18);
            ctx.fillStyle = '#ffd24d';
            ctx.fillRect(c.x - 7, c.y - 7, 14, 14);
            ctx.fillStyle = '#fff2b0';
            ctx.fillRect(c.x - 5, c.y - 5, 5, 5);
        }
    },

    world(ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (Fx.shake > 0.5) {
            ctx.translate(Math.round(randRange(-Fx.shake, Fx.shake)), Math.round(randRange(-Fx.shake, Fx.shake)));
        }
        if (this.mapLayer) ctx.drawImage(this.mapLayer, 0, 0);

        for (const d of Fx.decals) {
            const a = clamp((d.life - d.age) / 2, 0, 1) * 0.7;
            const g = ctx.createRadialGradient(d.x, d.y, 8, d.x, d.y, d.radius);
            g.addColorStop(0, `rgba(10,6,16,${a})`);
            g.addColorStop(0.7, `rgba(40,20,50,${a * 0.5})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(d.x - d.radius, d.y - d.radius, d.radius * 2, d.radius * 2);
        }

        this.drawBuildPads(ctx);
        this.drawHoverCell(ctx);
        UI.drawRanges(ctx);

        for (const t of Game.telegraphs) {
            const k = t.age / t.life;
            ctx.save();
            ctx.fillStyle = `rgba(255,70,110,${0.12 + 0.18 * k})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#ff5e7f';
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,90,130,0.35)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius * k, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (UI.targeting) {
            const rule = COMBAT_RULES.lightning;
            this.rangeRing(ctx, UI.mouse.x, UI.mouse.y, rule.radius * TILE, 'rgba(160,220,255,1)');
        }

        for (const c of Game.corpses) this.drawCorpse(ctx, c);

        // y 순서대로 그려 아래쪽이 앞에 보이게 한다
        const entities = [];
        for (const p of DECOR) entities.push({ y: tileY(p.row) + 30, draw: () => this.sprite(ctx, Assets.get(p.sprite), tileX(p.col), tileY(p.row) + 30, 2, 74) });
        for (const f of Game.facilities) entities.push({ y: f.y + 30, draw: () => this.drawFacility(ctx, f) });
        for (const u of Game.units) entities.push({ y: u.y + 12, draw: () => this.drawUnit(ctx, u) });
        for (const h of Game.heroes) {
            if (h.waiting) continue;
            const w = heroWorld(h);
            entities.push({ y: w.y + 14, draw: () => this.drawHero(ctx, h) });
        }
        entities.push({ y: tileY(THRONE_TILE.row) + 30, draw: () => this.drawThrone(ctx) });
        entities.sort((a, b) => a.y - b.y);
        for (const e of entities) e.draw();

        this.drawTorches(ctx);

        if (Fx.dim > 0) {
            ctx.fillStyle = `rgba(4,2,16,${Fx.dim * 0.72})`;
            ctx.fillRect(-40, -40, GAME_WIDTH + 80, GAME_HEIGHT + 80);
        }

        for (const p of Game.projectiles) this.drawProjectile(ctx, p);
        this.drawEffects(ctx);
        this.drawNumbers(ctx);
        this.drawSpeech(ctx);
        ctx.restore();
        this.drawCoins(ctx);
    }
};
