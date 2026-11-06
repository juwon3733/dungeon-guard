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

    // 공격 동작의 몇 번째 프레임인지: 남은 표시 시간(atkPose)을 처음 길이(atkPoseMax)로 나눠 계산한다
    attackFrame(atkPose, atkPoseMax, frames) {
        return clamp(Math.floor((1 - atkPose / (atkPoseMax || atkPose)) * frames), 0, frames - 1);
    },

    heroSpriteName(type, female, dir, anim, atkPose, casting, atkPoseMax) {
        const def = HEROES[type];
        if (def.anim) {
            if (atkPose > 0) {
                const clip = def.anim.attack;
                return this.plFrame(def, clip, dir, this.attackFrame(atkPose, atkPoseMax, clip.frames));
            }
            return this.plFrame(def, def.anim.walk, dir, Math.floor(anim) % def.anim.walk.frames);
        }
        const base = def.sprite + (female ? '_female' : '');
        if (atkPose > 0) {
            const frame = this.attackFrame(atkPose, atkPoseMax, 2);
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

    // 용사 그림 한 장을 그린다. PixelLab 그림은 동작별 발 위치와 반전을 쓰고, Asteria 그림은 방향별 그림을 그대로 쓴다
    heroSprite(ctx, img, def, atkPose, dir, x, footY) {
        if (def.anim) this.plSprite(ctx, img, def, atkPose > 0 ? def.anim.attack : def.anim.walk, dir, x, footY);
        else this.sprite(ctx, img, x, footY, def.scale, def.footPx);
    },

    // 정예 표시: 발밑의 금색 빛 고리
    eliteRing(ctx, x, y) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.55 + Math.sin(Game.time * 5) * 0.15;
        ctx.fillStyle = `rgba(255,190,60,${pulse * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 46, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(255,215,100,${pulse})`;
        ctx.stroke();
        ctx.restore();
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
        if (h.boss && BOSSES[h.bossKey].art) {
            this.drawArtBoss(ctx, h, p, BOSSES[h.bossKey].art);
        } else if (h.boss) {
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
            const def = HEROES[h.type];
            const casting = !!(def.stunEvery || def.song);
            // 막혀 싸우는 동안 공격 사이에는 걷기 대신 서 있는 그림(걷기 0번 프레임)을 쓴다
            const anim = h.blocker ? 0 : h.anim;
            const name = this.heroSpriteName(h.type, h.female, h.dir, anim, h.atkPose, casting, h.atkPoseMax);
            if (h.elite) {
                this.shadow(ctx, p.x, p.y + 9, 34, 11);
                this.eliteRing(ctx, p.x, p.y + 9);
            } else {
                this.shadow(ctx, p.x, p.y + 9, 19, 6);
            }
            const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
            this.heroSprite(ctx, img, def, h.atkPose, h.dir, p.x, p.y + 10);
            this.healthBar(ctx, p.x, p.y - (def.barY || 64), h.hp / h.maxHp, 40, '#ff5a5a');
        }
        if (h.haste > 0) this.hasteNotes(ctx, p.x, p.y + 9, h.d * 0.01, h.boss || h.elite ? 1.4 : 1);
        const headY = p.y - (h.boss ? BOSSES[h.bossKey].starY : (HEROES[h.type].barY || 64) + 8);
        if (h.stun > 0) this.stunStars(ctx, p.x, headY);
        if (h.curse > 0) this.curseMark(ctx, p.x, headY - 30, h.curse);
    },

    // 직업 그림 보스(대마도사): Asteria 직업 그림을 크게 그린다. 경고(windup) 동안은 주문 동작, 공격은 공격 동작이다
    drawArtBoss(ctx, h, p, art) {
        let name;
        if (h.windup > 0) name = `${art.sprite}_act_${h.dir}_cast${Math.floor(Game.time * 6) % 2}`;
        else if (h.atkPose > 0) name = `${art.sprite}_act_${h.dir}_atk${this.attackFrame(h.atkPose, h.atkPoseMax, 2)}`;
        else name = `${art.sprite}_walk_${h.dir}${Math.floor(h.blocker ? 0 : h.anim) % 4}`;
        this.shadow(ctx, p.x, p.y + 10, 62, 19);
        // 발밑의 푸른 전류 고리: 경고 중에는 더 밝게 떤다
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const hot = h.windup > 0 ? 1 : 0;
        const pulse = 0.45 + Math.sin(Game.time * (hot ? 30 : 5)) * 0.15 + hot * 0.3;
        ctx.fillStyle = `rgba(90,180,255,${pulse * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 10, 70, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(150,220,255,${pulse})`;
        ctx.stroke();
        ctx.restore();
        const img = h.flash > 0 ? Assets.tinted(name, '#ffffff', 0.85) : Assets.get(name);
        this.sprite(ctx, img, p.x, p.y + 12, art.scale, art.footPx);
    },

    // 음유시인 가속 표시: 발밑에서 떠오르는 초록 음표. 상태 없이 시간만으로 계산한다
    hasteNotes(ctx, x, y, seed, size) {
        const t = Game.time + seed;
        const snap = v => Math.round(v / 2) * 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(120,255,170,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, 36 * size, 12 * size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        for (let i = 0; i < 3; i++) {
            const k = (t * 0.9 + i / 3) % 1;
            const nx = snap(x + Math.sin(i * 2.1 + seed * 5) * 26 * size + Math.sin(t * 3 + i) * 6);
            const ny = snap(y - 8 - k * 70 * size);
            const a = Math.min(1, (1 - k) * 2) * Math.min(1, k * 8);
            const s = 2 * Math.round(size * 1.5);
            ctx.fillStyle = `rgba(40,90,50,${a * 0.8})`; // 어두운 바닥에서 떨어져 보이게 1도트 그림자
            this.noteGlyph(ctx, nx + s / 2, ny + s / 2, s);
            ctx.fillStyle = i === 1 ? `rgba(255,240,150,${a})` : `rgba(140,255,180,${a})`;
            this.noteGlyph(ctx, nx, ny, s);
        }
    },

    // 도트 음표 한 개: 머리, 기둥, 꼬리. s는 도트 한 칸 크기
    noteGlyph(ctx, x, y, s) {
        ctx.fillRect(x - 2 * s, y - s, 3 * s, 2 * s);
        ctx.fillRect(x, y - 6 * s, s, 6 * s);
        ctx.fillRect(x + s, y - 6 * s, s, s);
        ctx.fillRect(x + 2 * s, y - 5 * s, s, 2 * s);
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

    // 타락 유닛
    drawUnit(ctx, u) {
        const def = HEROES[u.heroType];
        const casting = !!(def.stunEvery || def.song);
        // 타락 유닛은 시체 자리에 멈춰 싸우므로 공격 사이에는 서 있는 그림(걷기 0번 프레임)을 쓴다
        const name = this.heroSpriteName(u.heroType, u.female, u.dir || 'down', 0, u.atkPose, casting, u.atkPoseMax);
        const risen = u.rise > 0 ? clamp(1 - u.rise / 0.5, 0, 1) : 1;
        this.shadow(ctx, u.x, u.y + 9, 21, 7, 0.6);
        this.drawCorruptAura(ctx, u.x, u.y + 9, risen, u.x * 0.013);
        this.drawCorruptSprite(ctx, name, def, u.atkPose, u.dir || 'down', u.x, u.y + 10, risen, u.flash > 0);
        this.healthBar(ctx, u.x, u.y - def.barY - 2, u.hp / u.maxHp, 40, '#c56bff');
        if (u.stun > 0) this.stunStars(ctx, u.x, u.y - def.barY - 16);
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
    drawCorruptSprite(ctx, name, def, atkPose, dir, x, footY, risen, flash) {
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
        const draw = (img, ox, oy) => this.heroSprite(ctx, img, def, atkPose, dir, x + ox, footY + sink + oy);
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

    // 몬스터의 지금 그림 이름: 공격 중이면 공격 동작을 한 번, 아니면 대기 동작을 천천히 반복한다(idleFps 0이면 첫 프레임)
    monsterFrame(def, m) {
        const art = def.art;
        if (m.atkPose > 0) {
            const clip = art.anim.attack;
            return { clip, name: this.plFrame(def, clip, m.dir, this.attackFrame(m.atkPose, m.atkPoseMax, clip.frames)) };
        }
        if (m.moving && art.anim.walk) {
            const walk = art.anim.walk;
            return { clip: walk, name: this.plFrame(def, walk, m.dir, Math.floor(m.anim * MONSTER_WALK_FPS) % walk.frames) };
        }
        const clip = art.anim.idle;
        const i = art.idleFps ? Math.floor(m.anim * art.idleFps) % clip.frames : 0;
        return { clip, name: this.plFrame(def, clip, m.dir, i) };
    },

    // 서 있는 몬스터 한 마리: 그림자와 그림. 건설 모드의 반투명 그림에도 쓴다
    monsterBody(ctx, def, m, img, clip) {
        const footY = m.y + MONSTER_FOOT;
        this.shadow(ctx, m.x, footY - 2, 22, 8);
        this.plSprite(ctx, img, def.art, clip, m.dir, m.x, footY);
    },

    drawMonster(ctx, m) {
        const def = MONSTERS[m.type];
        const footY = m.y + MONSTER_FOOT;
        if (m.reveal > 0) return; // 합치기 결과: 빨려 들어가는 연출이 끝나면 나타난다
        // 끄는 중인 몬스터는 제자리에 흐리게 남긴다
        const dragged = UI.drag && UI.drag.src.monster === m;
        if (dragged) {
            ctx.save();
            ctx.globalAlpha = 0.3;
        }
        this.drawMonsterInner(ctx, m, def, footY);
        if (dragged) ctx.restore();
    },

    drawMonsterInner(ctx, m, def, footY) {
        if (m.down > 0) {
            this.drawRespawn(ctx, def, m);
            return;
        }
        const stunned = m.stun > 0;
        // 뒤쪽 빛: 어두운 바닥에서 몬스터의 실루엣이 먼저 보이게 한다
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowAlpha = 0.22 + Math.sin(Game.time * 2.4 + m.x) * 0.04 + (m.tier - 1) * 0.06;
        const back = ctx.createRadialGradient(m.x, footY - 44, 8, m.x, footY - 44, 80);
        back.addColorStop(0, `rgba(${def.art.glow},${glowAlpha})`);
        back.addColorStop(1, `rgba(${def.art.glow},0)`);
        ctx.fillStyle = back;
        ctx.fillRect(m.x - 80, footY - 124, 160, 160);
        ctx.restore();
        if (m.tier >= 2) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const color = m.tier >= 3 ? '255,190,90' : '160,110,255';
            ctx.fillStyle = `rgba(${color},${0.2 + Math.sin(Game.time * 3 + m.x) * 0.05})`;
            ctx.beginPath();
            ctx.ellipse(m.x, footY, 40, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        const enraged = !!monsterEnrage(m);
        if (enraged) this.enrageAura(ctx, m.x, footY, m.x * 0.01);
        const { clip, name } = this.monsterFrame(def, m);
        let img = Assets.get(name);
        if (m.flash > 0) img = Assets.tinted(name, '#ffffff', 0.85);
        else if (stunned) img = Assets.tinted(name, '#7fc6ff', 0.55);
        this.monsterBody(ctx, def, m, img, clip);
        // 광폭화: 몸 위에 붉은 빛을 더한다(밝기는 맥박처럼 오르내린다)
        if (enraged && !(m.flash > 0)) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(Game.time * 9 + m.x) * 0.15;
            this.plSprite(ctx, Assets.tinted(name, '#ff2a12', 1), def.art, clip, m.dir, m.x, footY);
            ctx.restore();
        }

        // 등급 표시: 발밑의 등급 색 마름모. 강화를 켜면 단계 표시도 함께 그린다
        this.gradeMark(ctx, m.x, footY + 20, def.grade);
        this.rankMark(ctx, m, footY);
        for (let i = 0; MONSTER_UPGRADE_ENABLED && i < m.tier; i++) {
            const sx = m.x - (m.tier - 1) * 11 + i * 22;
            const sy = footY + 40;
            ctx.fillStyle = '#120c20';
            ctx.fillRect(sx - 8, sy - 8, 16, 16);
            ctx.fillStyle = m.tier >= 3 ? '#ffd76a' : '#c8a6ff';
            ctx.fillRect(sx - 5, sy - 5, 10, 10);
        }
        if (m.blocks) this.healthBar(ctx, m.x, footY - def.art.barY, m.hp / m.maxHp, 40, '#74d65a');
        if (stunned) {
            this.stunStars(ctx, m.x, footY - def.art.barY - 14);
            UIKit.text(ctx, '정지', m.x, footY - def.art.barY - 40, Math.round(22 / WORLD_ZOOM), '#9fdcff', 'center');
        }
    },

    // 광폭화 몬스터 발밑과 등 뒤의 붉은 빛, 위로 날리는 불티
    enrageAura(ctx, x, footY, seed) {
        const t = Game.time + seed;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.5 + Math.sin(t * 9) * 0.12;
        const back = ctx.createRadialGradient(x, footY - 44, 6, x, footY - 44, 86);
        back.addColorStop(0, `rgba(255,60,30,${pulse * 0.7})`);
        back.addColorStop(1, 'rgba(255,40,20,0)');
        ctx.fillStyle = back;
        ctx.fillRect(x - 86, footY - 130, 172, 172);
        ctx.fillStyle = `rgba(255,70,40,${pulse * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(x, footY, 42, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
            const k = (t * 1.3 + i / 5) % 1;
            const ex = Math.round(x + Math.sin(i * 2.7 + seed * 3) * 26);
            const ey = Math.round(footY - 10 - k * 90);
            ctx.fillStyle = `rgba(255,${120 + i * 20},60,${(1 - k) * 0.9})`;
            ctx.fillRect(ex - 3, ey - 3, 6, 6);
        }
        ctx.restore();
    },

    // 저주 표식: 용사 머리 위에 떠 있는 보라 눈 문양. 남은 시간이 1초 아래면 깜빡인다
    curseMark(ctx, x, y, left) {
        if (left < 1 && Math.floor(Game.time * 8) % 2) return;
        const bob = Math.round(Math.sin(Game.time * 4 + x) * 3);
        const cy = y + bob;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, cy, 2, x, cy, 30);
        g.addColorStop(0, 'rgba(190,80,255,0.55)');
        g.addColorStop(1, 'rgba(190,80,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 30, cy - 30, 60, 60);
        ctx.restore();
        // 도트 문양: 어두운 테두리, 보라 마름모, 가운데 밝은 눈
        const s = 5;
        const diamond = (r, color) => {
            ctx.fillStyle = color;
            for (let i = -r; i <= r; i++) {
                const w = r - Math.abs(i);
                ctx.fillRect(x - (w + 1) * s + s / 2, cy + i * s - s / 2, (w * 2 + 1) * s, s);
            }
        };
        diamond(4, '#1a0726');
        diamond(3, '#a24bff');
        diamond(1, '#f2d4ff');
        ctx.fillStyle = '#3a0a52';
        ctx.fillRect(x - s / 2, cy - s / 2, s, s);
    },

    // 등급 마름모: 일반은 작고 흐리게, 희귀 이상은 크고 빛나게. 전설은 더 큰 금색 마름모에 넓은 빛과 반짝이는 테두리
    gradeMark(ctx, x, y, grade) {
        const color = MONSTER_GRADES[grade].color;
        const legend = grade === 'legendary';
        const s = grade === 'common' ? 6 : (legend ? 13 : 9);
        ctx.save();
        if (grade !== 'common') {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(${MONSTER_GRADES[grade].glow},${(legend ? 0.4 : 0.25) + Math.sin(Game.time * 4 + x) * 0.08})`;
            ctx.beginPath();
            ctx.ellipse(x, y - 20, legend ? 60 : 42, legend ? 20 : 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#120c20';
        ctx.beginPath();
        ctx.moveTo(x, y - s - 4); ctx.lineTo(x + s + 4, y); ctx.lineTo(x, y + s + 4); ctx.lineTo(x - s - 4, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fill();
        if (legend) {
            ctx.strokeStyle = `rgba(255,248,214,${0.6 + Math.sin(Game.time * 6) * 0.3})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#fff6d0';
            ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        ctx.restore();
    },

    // 랭크 글자: 등급 마름모 오른쪽에 작게. D는 그리지 않아 몬스터가 많아도 맵이 어지럽지 않다. S는 금색으로 빛난다.
    // 랭크가 오른 직후(rankUp)에는 글자가 커졌다 돌아오고 머리 위에 "랭크 업"이 떠오른다
    rankMark(ctx, m, footY) {
        const rank = m.rank || 0;
        const r = MONSTER_RANKS[rank];
        const top = rank === MONSTER_RANKS.length - 1;
        const up = m.rankUp > 0 ? m.rankUp / 1.2 : 0;
        if (rank > 0) {
            const x = m.x + 26;
            const y = footY + 20;
            const size = Math.round((top ? 30 : 24) * (1 + up * 0.6));
            if (top) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createRadialGradient(x, y, 2, x, y, 26);
                g.addColorStop(0, `rgba(255,200,60,${0.5 + Math.sin(Game.time * 5 + m.x) * 0.15})`);
                g.addColorStop(1, 'rgba(255,200,60,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x - 26, y - 26, 52, 52);
                ctx.restore();
            }
            UIKit.text(ctx, r.name, x, y + 1, size, r.color, 'center', 'bold');
        }
        if (up > 0) {
            const lift = (1 - up) * 40;
            ctx.save();
            ctx.globalAlpha = Math.min(1, up * 2.5);
            UIKit.text(ctx, `랭크 ${r.name}!`, m.x, footY - MONSTERS[m.type].art.barY - 30 - lift, Math.round(24 / WORLD_ZOOM), r.color, 'center', 'bold');
            ctx.restore();
        }
    },

    // 합칠 수 있는 몬스터 발밑의 고리. hot이면 지금 놓으려는 대상이다
    mergeRing(ctx, x, y, color, hot) {
        const pulse = 0.8 + Math.sin(Game.time * 8) * 0.2;
        ctx.save();
        ctx.globalAlpha = hot ? 1 : pulse;
        ctx.lineWidth = hot ? 8 : 5;
        ctx.strokeStyle = color;
        ctx.setLineDash(hot ? [] : [12, 8]);
        ctx.lineDashOffset = -Game.time * 50;
        ctx.beginPath();
        ctx.ellipse(x, y, hot ? 54 : 46, hot ? 19 : 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (hot) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.25;
            ctx.fill();
        }
        ctx.restore();
    },

    // 소환·합치기 연출 한 개. pt(점)는 몬스터가 선 세계 좌표를 연출 중심(세계 좌표)으로 바꾼다
    //   합치기: delay 동안 두 몬스터가 하얗게 달아오르며 결과 자리로 빨려 들어가고, 그 뒤 빛이 터진다
    //   터진 뒤: 등급 색 빛, 빛줄기(희귀 이상), 퍼지는 고리, 불꽃, 결과 이름. 등급이 높을수록 크고 길다
    drawPop(ctx, p, pt) {
        const g = GRADE_FX[p.grade] || GRADE_FX.common;
        const rgb = MONSTER_GRADES[p.grade].glow;
        const to = pt(p.to);
        ctx.imageSmoothingEnabled = false;
        if (p.kind === 'merge' && p.age < p.delay) {
            const k = p.age / p.delay;
            const e = k * k;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const glow = ctx.createRadialGradient(to.x, to.y, 4, to.x, to.y, 50 + 110 * k);
            glow.addColorStop(0, `rgba(255,255,255,${0.7 * k})`);
            glow.addColorStop(0.4, `rgba(${rgb},${0.5 * k})`);
            glow.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = glow;
            ctx.fillRect(to.x - 170, to.y - 170, 340, 340);
            ctx.restore();
            p.from.forEach((f, i) => {
                const from = pt(f);
                const side = i ? 1 : -1;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy) || 1;
                const swirl = Math.sin(k * Math.PI) * Math.min(80, len * 0.3) * side;
                const x = from.x + dx * e - dy / len * swirl;
                const y = from.y + dy * e + dx / len * swirl;
                // 꼬리 불꽃
                ctx.fillStyle = `rgba(${rgb},${0.8 * k})`;
                for (let j = 1; j <= 4; j++) {
                    const kk = Math.max(0, k - j * 0.06);
                    const ee = kk * kk;
                    const sw = Math.sin(kk * Math.PI) * Math.min(80, len * 0.3) * side;
                    ctx.fillRect(Math.round(from.x + dx * ee - dy / len * sw) - 4, Math.round(from.y + dy * ee + dx / len * sw) - 4, 8, 8);
                }
                const name = `${MONSTERS[p.fromTypes[i]].sprite}/rotations/south`;
                const white = Math.round(Math.min(1, k * 1.6) * 4) / 4; // 색 입힌 사본 캐시가 늘지 않게 4단계로 끊는다
                const img = white > 0 ? Assets.tinted(name, '#ffffff', white) : Assets.get(name);
                this.sprite(ctx, img, x, y + 40 * (1 - 0.6 * e), 2 * (1 - 0.6 * e));
            });
            return;
        }
        const t = p.age - p.delay;
        const T = g.pop;
        const k = clamp(t / T, 0, 1);
        const fade = 1 - k;
        const ease = 1 - Math.pow(1 - k, 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 터지는 빛
        const flash = clamp(1 - t / 0.35, 0, 1);
        const r0 = 60 + g.rays * 6 + 120 * ease;
        const glow = ctx.createRadialGradient(to.x, to.y, 4, to.x, to.y, r0);
        glow.addColorStop(0, `rgba(255,255,255,${0.9 * flash + 0.25 * fade})`);
        glow.addColorStop(0.35, `rgba(${rgb},${0.6 * fade})`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(to.x - r0, to.y - r0, r0 * 2, r0 * 2);
        // 빛기둥: 희귀 이상
        if (g.rays) {
            const colH = 260 + g.rays * 14;
            const col = ctx.createLinearGradient(0, to.y - colH, 0, to.y + 30);
            col.addColorStop(0, `rgba(${rgb},0)`);
            col.addColorStop(1, `rgba(${rgb},${0.55 * fade})`);
            ctx.fillStyle = col;
            const cw = 30 + g.rays * 2;
            ctx.fillRect(to.x - cw / 2, to.y - colH, cw, colH + 30);
        }
        // 빛줄기
        for (let i = 0; i < g.rays; i++) {
            const ang = p.seed + i / g.rays * Math.PI * 2 + t * 0.9;
            const len = 90 + 220 * ease + (i % 2) * 40;
            ctx.fillStyle = `rgba(${i % 2 ? '255,255,255' : rgb},${0.45 * fade})`;
            ctx.beginPath();
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(to.x + Math.cos(ang - 0.07) * len, to.y + Math.sin(ang - 0.07) * len);
            ctx.lineTo(to.x + Math.cos(ang + 0.07) * len, to.y + Math.sin(ang + 0.07) * len);
            ctx.closePath();
            ctx.fill();
        }
        // 퍼지는 고리
        for (let i = 0; i < (g.rays ? 2 : 1); i++) {
            const kk = clamp(k * 1.4 - i * 0.25, 0, 1);
            if (kk <= 0 || kk >= 1) continue;
            ctx.globalAlpha = 1 - kk;
            ctx.strokeStyle = i ? '#ffffff' : `rgb(${rgb})`;
            ctx.lineWidth = 10 * (1 - kk) + 2;
            ctx.beginPath();
            ctx.arc(to.x, to.y, 30 + (140 + g.rays * 8) * Math.sqrt(kk), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // 불꽃: 상태 없이 시간과 번호로 위치를 정한다
        for (let i = 0; i < g.sparks; i++) {
            const ang = p.seed * 3 + i * 2.39996;
            const dist = (70 + (i % 7) * 26 + g.rays * 5) * ease;
            const x = to.x + Math.cos(ang) * dist;
            const y = to.y + Math.sin(ang) * dist * 0.8 + k * k * 90;
            const sz = i % 3 === 0 ? 10 : 6;
            ctx.fillStyle = i % 3 === 0 ? `rgba(255,255,255,${fade})` : `rgba(${rgb},${fade})`;
            ctx.fillRect(Math.round(x / 2) * 2 - sz / 2, Math.round(y / 2) * 2 - sz / 2, sz, sz);
        }
        ctx.restore();
        // 결과 그림의 하얀 섬광: 커졌다가 줄며 사라진다
        if (t < 0.3) {
            const name = `${MONSTERS[p.type].sprite}/rotations/south`;
            ctx.save();
            ctx.globalAlpha = 1 - t / 0.3;
            this.sprite(ctx, Assets.tinted(name, '#ffffff', 1), to.x, to.y + 40, 2 + (1 - t / 0.3) * 1.2);
            ctx.restore();
        }
        // 결과 이름과 등급: 합치기는 언제나, 소환은 희귀 이상만
        if (p.kind === 'merge' || p.grade !== 'common') {
            const big = p.grade === 'epic' || p.grade === 'legendary';
            const a = clamp(Math.min(t / 0.12, (T + 0.4 - t) / 0.3), 0, 1);
            const popK = t < 0.15 ? 1.5 - t / 0.15 * 0.5 : 1;
            const label = p.kind === 'summon' ? `${MONSTER_GRADES[p.grade].name} 등장!` : MONSTERS[p.type].name;
            const size = Math.round((big ? 44 : 32) * popK / WORLD_ZOOM);
            const ly = to.y - 130 - t * 30;
            const lx = clamp(to.x, 220, WORLD_WIDTH - 220);
            ctx.save();
            ctx.globalAlpha = a;
            UIKit.text(ctx, label, lx, ly, size, MONSTER_GRADES[p.grade].light, 'center');
            if (p.kind === 'summon' || p.grade !== 'common') {
                const sub = p.kind === 'summon' ? MONSTERS[p.type].name : `${MONSTER_GRADES[p.grade].name}!`;
                UIKit.text(ctx, sub, lx, ly + size * 0.95, Math.round(22 / WORLD_ZOOM), '#ffffff', 'center');
            }
            ctx.restore();
        }
    },

    // 막는 몬스터가 놓인 칸: 길로 나간 동안 칸이 비어 보이지 않게 바닥에 표식을 남긴다
    drawMonsterHome(ctx, m) {
        if (!m.blocks || m.down > 0 || m.reveal > 0) return;
        const x = m.homeX;
        const y = m.homeY + MONSTER_FOOT;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(255,183,107,${0.35 + Math.sin(Game.time * 2 + x) * 0.08})`;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(x, y, 30, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    // 쓰러진 막는 몬스터: 놓은 칸에 흐린 그림과 다시 나올 때까지 남은 시간 고리
    drawRespawn(ctx, def, m) {
        const left = clamp(m.down / monsterStats(m).respawn, 0, 1);
        const x = m.homeX;
        const footY = m.homeY + MONSTER_FOOT;
        ctx.save();
        ctx.globalAlpha = 0.35;
        const name = this.plFrame(def, def.art.anim.idle, 'down', 0);
        this.plSprite(ctx, Assets.tinted(name, '#1b1030', 0.6), def.art, def.art.anim.idle, 'down', x, footY);
        ctx.restore();
        const cy = footY - 40;
        ctx.save();
        ctx.fillStyle = 'rgba(10,6,20,0.7)';
        ctx.beginPath();
        ctx.arc(x, cy, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#3a2f4c';
        ctx.beginPath();
        ctx.arc(x, cy, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffb76b';
        ctx.beginPath();
        ctx.arc(x, cy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left));
        ctx.stroke();
        ctx.restore();
        UIKit.text(ctx, String(Math.ceil(m.down)), x, cy, Math.round(22 / WORLD_ZOOM), '#ffe0c0', 'center');
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
        const name = fall ? this.plFrame(def, fall, c.dir, Math.min(fall.frames - 1, Math.floor(c.age * CORPSE_FALL_FPS))) : this.heroStandName(c.type, c.female, 'down');
        const left = 1 - c.age / c.life;
        // 타락이 꺼져 있으면 깜빡임 대신 마지막 CORPSE_FADE_TIME초 동안 서서히 사라진다
        const blink = !CORRUPTION_ENABLED ? 0.9 * Math.min(1, (c.life - c.age) / CORPSE_FADE_TIME)
            : left < 0.3 ? (Math.floor(Game.time * 8) % 2 === 0 ? 0.45 : 0.9) : 0.9;
        const hovered = UI.hoverCorpse === c;
        // 지금 클릭하면 바로 타락시킬 수 있는 시체만 고리와 윤곽선으로 부른다
        const ready = CORRUPTION_ENABLED && Game.gold >= c.cost && Game.units.filter(u => u.kind === 'corrupt').length < COMBAT_RULES.corruptMax;
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
            const size = img.width * (def.scale || HERO_SCALE);
            const draw = (im, ox, oy) => ctx.drawImage(im, -size / 2 + ox, -size * 0.725 + oy, size, size);
            if (ready) this.corruptOutline(ctx, name, def.scale || HERO_SCALE, draw, hovered ? '#ffe6ff' : '#ff6be6', hovered ? 1 : 0.55 + Math.sin(Game.time * 6) * 0.25);
            draw(img, 0, 0);
        }
        ctx.restore();
        if (!CORRUPTION_ENABLED) return;

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

    // 몬스터를 놓을 수 있는 길 옆 칸: 건설 모드에서는 밝게, 준비 시간에는 흐리게 보여 준다. 길 칸에는 놓을 수 없다
    drawBuildPads(ctx) {
        const placing = !!UI.drag;
        if (!placing && Game.state !== 'prep') return;
        const pulse = placing ? 0.42 + Math.sin(Game.time * 5) * 0.1 : 0.14 + Math.sin(Game.time * 3) * 0.05;
        const color = '190,150,255';
        ctx.lineWidth = 3;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            const occupant = Game.monsterAt(c, r);
            if (occupant && !(UI.drag && UI.drag.src.monster === occupant)) continue;
            const x = c * TILE;
            const y = MAP_TOP + r * TILE;
            if (placing) {
                ctx.fillStyle = `rgba(${color},${pulse * 0.15})`;
                ctx.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
            }
            ctx.strokeStyle = `rgba(${color},${pulse})`;
            ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
        }
    },

    // 건설 모드에서 마우스가 있는 칸: 지을 수 있으면 금색, 없으면 빨간색
    drawHoverCell(ctx) {
        const cell = UI.drag && UI.hoverCell;
        if (!cell || Game.state === 'title') return;
        const ok = UI.canPlaceAt(cell.col, cell.row);
        const x = cell.col * TILE;
        const y = MAP_TOP + cell.row * TILE;
        ctx.lineWidth = 4;
        ctx.strokeStyle = ok ? '#ffe08a' : '#ff5a6e';
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.fillStyle = ok ? 'rgba(255,224,138,0.18)' : 'rgba(255,60,80,0.3)';
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

    // pixelfx 시트 효과. 빛이 이미 색과 알파로 합쳐져 있어 lighter가 아니라 보통 합성으로 그린다.
    // 화면에서 정수 배율(1배, 큰 효과는 2배)이 되도록 1 / WORLD_ZOOM 단위로 키우고 화면 픽셀에 맞춘다
    drawSheetEffects(ctx) {
        ctx.imageSmoothingEnabled = false;
        for (const a of Fx.anims) {
            const sheet = FX_SHEETS[a.name];
            const img = sheet && Assets.get(sheet.image);
            if (!img) continue;
            const frame = Math.min(sheet.frames - 1, Math.floor(a.age / a.life * sheet.frames));
            const k = Math.max(1, Math.round(a.size * WORLD_ZOOM / sheet.fit));
            const s = k / WORLD_ZOOM;
            const x = Math.round((a.x - sheet.pivotX * s) * WORLD_ZOOM) / WORLD_ZOOM;
            const y = Math.round((a.y - sheet.pivotY * s) * WORLD_ZOOM) / WORLD_ZOOM;
            ctx.drawImage(img, (frame % sheet.cols) * sheet.w, Math.floor(frame / sheet.cols) * sheet.h, sheet.w, sheet.h,
                x, y, sheet.w * s, sheet.h * s);
        }
    },

    drawEffects(ctx) {
        ctx.save();
        this.drawSheetEffects(ctx);
        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = false;
        for (const a of Fx.anims) {
            if (FX_SHEETS[a.name]) continue;
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
            const rgb = t.color || '255,70,110'; // 감전 경고는 푸른색
            ctx.save();
            ctx.fillStyle = `rgba(${rgb},${0.12 + 0.18 * k})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = t.color ? `rgb(${rgb})` : '#ff5e7f';
            ctx.stroke();
            ctx.fillStyle = t.color ? `rgba(${rgb},0.35)` : 'rgba(255,90,130,0.35)';
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
        for (const m of Game.monsters) {
            if (m.blocks) entities.push({ y: m.homeY - TILE / 2, draw: () => this.drawMonsterHome(ctx, m) });
            const footY = (m.down > 0 ? m.homeY : m.y) + MONSTER_FOOT;
            entities.push({ y: footY, draw: () => this.drawMonster(ctx, m) });
        }
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
