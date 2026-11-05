// 게임 세계 그리기. 상태를 읽기만 하고 바꾸지 않는다(UI 버튼 제외).
const Render = {
    mapLayer: null,

    buildMap() {
        const c = document.createElement('canvas');
        c.width = WORLD_WIDTH;
        c.height = WORLD_HEIGHT;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;

        // 우주 배경 위에 떠 있는 섬: Asteria의 지역 구성과 같다
        const space = Assets.get('void_shadow');
        if (space) g.drawImage(space, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        // Why: 섬 원본은 정사각형이라 윗면이 화면 전체를 덮도록 가로로 더 늘린다. 절벽은 하단 HUD 뒤로 이어진다.
        const island = Assets.get('island_shadow');
        if (island) g.drawImage(island, -24 / WORLD_ZOOM, -26 / WORLD_ZOOM, 1968 / WORLD_ZOOM, 1400 / WORLD_ZOOM);

        // 지면이 어두우면 전투가 묻히므로 은은하게 밝힌다
        g.save();
        g.globalCompositeOperation = 'lighter';
        const lift = g.createRadialGradient(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.46, 120, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.46, 1000 / WORLD_ZOOM);
        lift.addColorStop(0, 'rgba(70,45,110,0.28)');
        lift.addColorStop(1, 'rgba(70,45,110,0)');
        g.fillStyle = lift;
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        g.restore();

        this.drawThroneDais(g);
        this.drawDeck(g);

        const portal = Assets.get('prop_fieldPortal');
        if (portal) g.drawImage(portal, -28, tileY(3) - 112, 192, 192);

        const v = g.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 560 / WORLD_ZOOM, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 1180 / WORLD_ZOOM);
        v.addColorStop(0, 'rgba(0,0,10,0)');
        v.addColorStop(1, 'rgba(0,0,10,0.42)');
        g.fillStyle = v;
        g.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.mapLayer = c;
    },

    // 원본 다리 그림에서 난간과 돌바닥을 잘라 길로 잇는다
    drawDeck(g) {
        const deck = Assets.get('bridgedeck_shadow');
        if (!deck) return;
        const DECK = { top: 230, bottom: 770, width: 120 }; // 원본의 난간 포함 세로 범위와 세계 좌표 폭
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

    heroSpriteName(type, female, dir, anim, atkPose, casting) {
        const def = HEROES[type];
        if (def.anim) {
            if (atkPose > 0) {
                const clip = def.anim.attack;
                return this.plFrame(def, clip, dir, clamp(Math.floor((1 - atkPose / (def.atkTime || 0.22)) * clip.frames), 0, clip.frames - 1));
            }
            return this.plFrame(def, def.anim.walk, dir, Math.floor(anim) % def.anim.walk.frames);
        }
        const base = def.sprite + (female ? '_female' : '');
        if (atkPose > 0) {
            const frame = atkPose > 0.11 ? 0 : 1;
            return `${base}_act_${dir}_${casting ? 'cast' : 'atk'}${frame}`;
        }
        return `${base}_walk_${dir}${Math.floor(anim) % 4}`;
    },

    plFacing(dir) {
        return { down: 'south', up: 'north', left: 'west', right: 'east' }[dir] || 'south';
    },

    // 그 동작에 실제로 있는 방향을 고른다. 서쪽이 없으면 동쪽을 뒤집어 쓴다
    plPick(clip, dir) {
        const facing = this.plFacing(dir);
        if (!clip.dirs || clip.dirs.includes(facing)) return { facing, flip: false };
        if (facing === 'west' && clip.dirs.includes('east')) return { facing: 'east', flip: true };
        return { facing: clip.dirs[0], flip: false };
    },

    plFrame(def, clip, dir, i) {
        return `${def.sprite}/animations/${clip.folder}/${this.plPick(clip, dir).facing}/frame_${String(i).padStart(3, '0')}`;
    },

    // 이번 프레임의 동작 그림을 발 위치와 좌우 반전까지 맞춰 그린다
    plSprite(ctx, img, def, clip, dir, x, footY) {
        const pick = this.plPick(clip, dir);
        const foot = typeof clip.footPx === 'number' ? clip.footPx : clip.footPx[pick.facing];
        this.sprite(ctx, img, x, footY, def.scale, foot, pick.flip);
    },

    // 서 있는 그림: 다음 파티 목록과 Asteria 그림의 시체에 쓴다
    heroStandName(type, female, dir) {
        const def = HEROES[type];
        if (def.anim) return `${def.sprite}/rotations/south`;
        return `${def.sprite}${female ? '_female' : ''}_walk_${dir || 'down'}0`;
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
            const def = HEROES[h.type];
            const name = this.heroSpriteName(h.type, h.female, h.dir, h.anim, h.atkPose, casting);
            this.shadow(ctx, p.x, p.y + 9, 19, 6);
            const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            this.plSprite(ctx, img, def, h.atkPose > 0 ? def.anim.attack : def.anim.walk, h.dir, p.x, p.y + 10);
            this.healthBar(ctx, p.x, p.y - (def.barY || 64), h.hp / h.maxHp, 40, '#ff5a5a');
        }
        if (h.stun > 0) this.stunStars(ctx, p.x, p.y - (h.boss ? 165 : (HEROES[h.type].barY || 64) + 8));
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
            const art = ORC_ART;
            const clip = u.atkPose > 0 ? art.anim.attack : art.anim.walk;
            const i = u.atkPose > 0 ? clamp(Math.floor((1 - u.atkPose / 0.22) * clip.frames), 0, clip.frames - 1) : (u.moving ? Math.floor(u.anim) % clip.frames : 0);
            const name = this.plFrame(art, clip, u.dir, i);
            this.shadow(ctx, u.x, u.y + 8, 20, 7);
            const img = u.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            this.plSprite(ctx, img, art, clip, u.dir, u.x, u.y + 10);
        } else {
            const casting = u.heroType === 'mage';
            const name = this.heroSpriteName(u.heroType, u.female, u.dir || 'down', 0, u.atkPose, casting);
            const def = HEROES[u.heroType];
            const clip = u.atkPose > 0 ? def.anim.attack : def.anim.walk;
            const risen = u.rise > 0 ? clamp(1 - u.rise / 0.5, 0, 1) : 1;
            this.shadow(ctx, u.x, u.y + 9, 21, 7, 0.6);
            this.drawCorruptAura(ctx, u.x, u.y + 9, risen, u.x * 0.013);
            this.drawCorruptSprite(ctx, name, def, clip, u.dir || 'down', u.x, u.y + 10, risen, u.flash > 0);
        }
        const barY = (u.kind === 'corrupt' ? HEROES[u.heroType].barY : ORC_ART.barY) + 2;
        this.healthBar(ctx, u.x, u.y - barY, u.hp / u.maxHp, 40, u.kind === 'corrupt' ? '#c56bff' : '#74d65a');
    },

    // 타락 표시: 발밑에서 도는 도트 룬 고리와 위로 떠오르는 입자. seed로 유닛마다 박자를 어긋낸다.
    // 일어나는 중(risen < 1)에는 고리가 안에서 밖으로 퍼진다. calm이면 입자 없이 고리만 그린다(타락 가능한 시체).
    drawCorruptAura(ctx, x, y, risen, seed, calm) {
        const t = Game.time + seed;
        const grow = 0.35 + 0.65 * risen;
        const rx = 34 * grow;
        const ry = 12 * grow;
        const snap = v => Math.round(v / 2) * 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 고리 안쪽의 은은한 빛
        const pulse = 0.22 + Math.sin(t * 4) * 0.06;
        const glow = ctx.createRadialGradient(x, y, 2, x, y, rx);
        glow.addColorStop(0, `rgba(200,70,255,${pulse + 0.1})`);
        glow.addColorStop(1, 'rgba(200,70,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        // 도트 고리: 작은 점 사이사이에 십자 모양 룬 4개
        const spin = t * 0.9;
        for (let i = 0; i < 20; i++) {
            const a = spin + i / 20 * Math.PI * 2;
            const px = snap(x + Math.cos(a) * rx);
            const py = snap(y + Math.sin(a) * ry);
            const front = Math.sin(a) > 0; // 앞쪽 절반을 더 밝게 해 바닥에 누운 고리처럼 보이게 한다
            if (i % 5 === 0) {
                ctx.fillStyle = front ? '#ff9cf2' : 'rgba(230,110,255,0.7)';
                ctx.fillRect(px - 2, py - 6, 4, 12);
                ctx.fillRect(px - 6, py - 2, 12, 4);
            } else {
                ctx.fillStyle = front ? 'rgba(240,120,255,0.95)' : 'rgba(170,70,240,0.6)';
                ctx.fillRect(px - 2, py - 2, 4, 4);
            }
        }
        // 떠오르는 입자: 상태 없이 시간만으로 계산한다
        for (let i = 0; i < (calm ? 0 : 7); i++) {
            const k = (t * 0.7 + i / 7 + Math.sin(i * 12.9898 + seed) * 0.5 + 1) % 1;
            const px = snap(x + Math.sin(i * 2.4 + seed * 3) * rx * 0.8 + Math.sin(t * 2 + i) * 3);
            const py = snap(y - k * 90 * grow);
            const a = (1 - k) * (k < 0.1 ? k * 10 : 1);
            ctx.fillStyle = i % 3 === 0 ? `rgba(255,210,255,${a})` : `rgba(220,90,255,${a})`;
            const s = i % 3 === 0 ? 4 : 6;
            ctx.fillRect(px - s / 2, py - s / 2, s, s);
        }
        ctx.restore();
    },

    // 타락 그림: 본 그림은 살짝만 물들이고, 밝은 자주색 윤곽선으로 어두운 바닥에서 떼어 낸다.
    // 일어나는 중에는 발밑 아래를 잘라 땅속에서 솟아오르게 하고 윤곽선이 하얗게 달아올랐다 식는다.
    drawCorruptSprite(ctx, name, def, clip, dir, x, footY, risen, flash) {
        const ease = 1 - Math.pow(1 - risen, 3);
        const sink = (1 - ease) * 100;
        ctx.save();
        if (risen < 1) {
            // 땅에서 솟는 빛기둥: 시체 타락 연출의 빛줄기에서 이어져 다 일어나면 꺼진다
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const k = 1 - ease;
            const col = ctx.createLinearGradient(0, footY - 150, 0, footY);
            col.addColorStop(0, 'rgba(230,110,255,0)');
            col.addColorStop(1, `rgba(255,170,250,${0.75 * k})`);
            ctx.fillStyle = col;
            ctx.fillRect(x - 30, footY - 150, 60, 150);
            ctx.fillStyle = `rgba(255,235,255,${0.8 * k})`;
            ctx.fillRect(x - 40, footY - 4, 80, 6);
            ctx.restore();
            ctx.beginPath();
            ctx.rect(x - 120, footY - 260, 240, 262);
            ctx.clip();
        }
        const draw = (img, ox, oy) => this.plSprite(ctx, img, def, clip, dir, x + ox, footY + sink + oy);
        this.corruptOutline(ctx, name, def.scale || 2, draw, risen < 1 ? '#ffe6ff' : '#ff6be6', 1);
        draw(flash ? Assets.tinted(name, '#ffffff', 0.85) : Assets.tinted(name, '#7c2bd6', 0.22), 0, 0);
        ctx.restore();
    },

    // 상하좌우로 1도트 어긋난 밝은 실루엣과, 그 바깥 2도트의 보라 발광을 먼저 깐다. 위에 본 그림을 그리면 윤곽선만 남는다.
    // draw(img, ox, oy)는 그림을 제자리에서 (ox, oy)만큼 밀어 그리는 함수다.
    corruptOutline(ctx, name, dot, draw, color, strength) {
        const ring = (img, r) => {
            for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) draw(img, ox * dot, oy * dot);
        };
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 * strength;
        ring(Assets.tinted(name, '#c040ff', 1), 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = strength;
        ring(Assets.tinted(name, color, 1), 1);
        ctx.restore();
    },

    drawFacility(ctx, f) {
        const stunned = f.stun > 0;
        const recoil = f.recoil * 5;
        // 뒤쪽 빛: 어두운 바닥에서 시설의 실루엣이 먼저 보이게 한다
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
        const art = FACILITY_ART[f.type];
        const img = stunned ? Assets.tinted(art.sprite, '#7fc6ff', 0.55) : Assets.get(art.sprite);
        this.sprite(ctx, img, f.x, f.y + 34 + (f.type === 'barracks' ? 0 : recoil), 1 / WORLD_ZOOM, art.footPx); // 화면에서 원본 1배가 된다

        if (f.muzzle > 0) {
            const ox = f.x;
            const oy = f.y - (f.type === 'archer' ? 85 : 60);
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
            UIKit.text(ctx, '정지', f.x, f.y - 138, Math.round(22 / WORLD_ZOOM), '#9fdcff', 'center');
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
        const def = HEROES[c.type];
        const fall = def.anim && def.anim.death; // 쓰러지는 동작을 재생한 뒤 마지막 프레임을 유지한다
        const name = fall ? this.plFrame(def, fall, c.dir, Math.min(fall.frames - 1, Math.floor(c.age * 14))) : this.heroStandName(c.type, c.female, 'down');
        const left = 1 - c.age / c.life;
        const blink = left < 0.3 ? (Math.floor(Game.time * 8) % 2 === 0 ? 0.45 : 0.9) : 0.9;
        const hovered = UI.hoverCorpse === c;
        // 지금 클릭하면 바로 타락시킬 수 있는 시체만 고리와 윤곽선으로 부른다
        const ready = Game.gold >= c.cost && Game.units.filter(u => u.kind === 'corrupt').length < COMBAT_RULES.corruptMax;
        if (ready) this.drawCorruptAura(ctx, c.x, c.y + 10, hovered ? 1 : 0.8, c.x * 0.013, true);
        ctx.save();
        ctx.translate(c.x, c.y + 8);
        if (!fall) ctx.rotate(Math.PI / 2 * 0.92);
        ctx.globalAlpha = blink;
        const img = hovered ? Assets.tinted(name, '#b56bff', 0.3) : Assets.tinted(name, '#1b1030', ready ? 0.2 : 0.4);
        if (img && fall) {
            const draw = (im, ox, oy) => this.plSprite(ctx, im, def, fall, c.dir, ox, 2 + oy);
            if (ready) this.corruptOutline(ctx, name, def.scale || 2, draw, hovered ? '#ffe6ff' : '#ff6be6', hovered ? 1 : 0.55 + Math.sin(Game.time * 6) * 0.25);
            draw(img, 0, 0);
        } else if (img) {
            ctx.imageSmoothingEnabled = false;
            const size = img.width * HERO_SCALE;
            ctx.drawImage(img, -size / 2, -size * 0.725, size, size);
        }
        ctx.restore();

        // 남은 시간 고리
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#120a22';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 46, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = ready ? '#ff6be6' : '#6a5f7c';
        ctx.beginPath();
        ctx.arc(c.x, c.y - 46, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.stroke();
        ctx.restore();
        UIKit.text(ctx, `${c.cost}`, c.x, c.y - 70, Math.round((hovered ? 24 : 18) / WORLD_ZOOM), ready ? '#ffd6fb' : '#8f8599', 'center');
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
            const size = Math.round((n.big ? 50 : 26) * pop / WORLD_ZOOM); // 글자는 세계와 함께 줄지 않게 한다
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
            ctx.font = `${Math.round(24 / WORLD_ZOOM)}px ${UI_FONT}`;
            const w = ctx.measureText(s.text).width + 42;
            const x = clamp(s.x, w / 2 + 8, WORLD_WIDTH - w / 2 - 8);
            const y = s.y - (1 - a) * 8;
            UIKit.frame(ctx, x - w / 2, y - 34, w, 64, s.boss ? 'danger' : 'speech', 6);
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
        ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
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
            this.rangeRing(ctx, UI.mouse.x / WORLD_ZOOM, UI.mouse.y / WORLD_ZOOM, rule.radius * TILE, 'rgba(160,220,255,1)');
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
            ctx.fillRect(-40, -40, WORLD_WIDTH + 80, WORLD_HEIGHT + 80);
        }

        for (const p of Game.projectiles) this.drawProjectile(ctx, p);
        this.drawEffects(ctx);
        this.drawNumbers(ctx);
        this.drawSpeech(ctx);
        ctx.restore();
        this.drawCoins(ctx);
    }
};
