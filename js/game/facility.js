// 시설과 시설이 만든 투사체.

function facilityStats(f) {
    const def = FACILITIES[f.type];
    const stats = {
        damage: def.damage, interval: def.interval, range: def.range, splash: def.splash || 0,
        unitHp: def.unitHp || 0, armor: 0, beam: false
    };
    if (f.tier >= 2) {
        stats.damage *= 1.5;
        if (f.type === 'barracks') stats.unitHp *= 1.5;
    }
    if (f.tier >= 3 && f.branch) {
        const b = def.branches[f.branch];
        if (b.damageMul) stats.damage *= b.damageMul;
        if (b.interval) stats.interval = b.interval;
        if (b.range) stats.range = b.range;
        if (b.splash) stats.splash = b.splash;
        if (b.armor) stats.armor = b.armor;
        if (b.beam) stats.beam = true;
    }
    return stats;
}

function createFacility(type, col, row) {
    const f = {
        type, col, row, x: tileX(col), y: tileY(row),
        tier: 1, branch: null, invested: FACILITIES[type].cost,
        cooldown: 0.2, stun: 0, recoil: 0, muzzle: 0, bob: Math.random() * 6, rally: null
    };
    if (type === 'barracks') {
        const d = nearestPathDistance(f.x, f.y);
        const p = pathAt(d);
        f.rally = { d, x: p.x, y: p.y };
    }
    return f;
}

function updateFacility(f, dt) {
    const G = Game;
    f.bob += dt * 2.6;
    f.recoil = Math.max(0, f.recoil - dt * 6);
    f.muzzle = Math.max(0, f.muzzle - dt);
    if (f.stun > 0) {
        f.stun -= dt;
        return;
    }
    if (f.type === 'barracks') {
        updateBarracks(f, dt);
        return;
    }
    f.cooldown -= dt;
    if (f.cooldown > 0) return;
    const stats = facilityStats(f);
    const target = foremostHero(f.x, f.y, stats.range * TILE);
    if (!target) { f.cooldown = 0.08; return; }
    f.cooldown = stats.interval;
    f.recoil = 1;
    f.muzzle = 0.09;
    const tp = heroWorld(target);
    const originY = f.y - (f.type === 'archer' ? 85 : 60); // 건물 꼭대기와 수정 위치
    if (f.type === 'archer') {
        G.projectiles.push({
            kind: 'arrow', x: f.x, y: originY, target, damage: stats.damage,
            speed: f.branch === 'B' ? 2200 : 1300, big: f.branch === 'B', trail: 0
        });
        Sfx.play(f.branch === 'B' ? 'snipe' : 'arrow');
    } else if (stats.beam) {
        fireCrystalBeam(f, stats, tp);
    } else {
        G.projectiles.push({
            kind: 'orb', x: f.x, y: originY, tx: tp.x, ty: tp.y - 30, sx: f.x, sy: originY,
            age: 0, time: clamp(distance(f.x, originY, tp.x, tp.y) / 760, 0.25, 0.6),
            damage: stats.damage, splash: stats.splash * TILE
        });
        Sfx.play('orb');
    }
}

function fireCrystalBeam(f, stats, tp) {
    const ox = f.x;
    const oy = f.y - 60;
    const len = distance(ox, oy, tp.x, tp.y - 30) || 1;
    const dx = (tp.x - ox) / len;
    const dy = (tp.y - 30 - oy) / len;
    const reach = stats.range * TILE + 80;
    Fx.beam(ox, oy, ox + dx * reach, oy + dy * reach, '#c28bff', 30, 0.2);
    Fx.anim('fx_blastViolet', ox, oy, 170, 0.28);
    Fx.beam(ox, oy, ox + dx * reach, oy + dy * reach, '#ffffff', 8, 0.14);
    Fx.addShake(4);
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        const along = (p.x - ox) * dx + (p.y - 30 - oy) * dy;
        if (along < 0 || along > reach) continue;
        const off = Math.abs((p.x - ox) * dy - (p.y - 30 - oy) * dx);
        if (off < 42) damageHero(h, stats.damage, ox, oy, '#d7a8ff');
    }
    Sfx.play('beam');
}

function updateBarracks(f, dt) {
    const G = Game;
    const def = FACILITIES.barracks;
    const stats = facilityStats(f);
    const mine = G.units.filter(u => u.owner === f);
    for (let slot = 0; slot < def.unitCount; slot++) {
        const unit = mine.find(u => u.slot === slot);
        if (unit) continue;
        f.spawnTimers = f.spawnTimers || {};
        if (f.spawnTimers[slot] === undefined) f.spawnTimers[slot] = f.everSpawned ? def.respawn : 0.1;
        f.spawnTimers[slot] -= dt;
        if (f.spawnTimers[slot] <= 0) {
            delete f.spawnTimers[slot];
            f.everSpawned = true;
            G.units.push(createOrc(f, slot, stats));
            Fx.ring(f.x, f.y, 60, '#ffb76b', 0.3);
        }
    }
}

function updateProjectile(p, dt) {
    if (p.kind === 'arrow') {
        const t = p.target;
        if (t.dead) { p.done = true; return; }
        const w = heroWorld(t);
        const tx = w.x;
        const ty = w.y - (t.boss ? 90 : 46);
        const len = distance(p.x, p.y, tx, ty);
        const step = p.speed * dt;
        p.angle = Math.atan2(ty - p.y, tx - p.x);
        if (len <= step + 8) {
            damageHero(t, p.damage, p.x, p.y, p.big ? '#ff9d6b' : '#ffe36b');
            if (p.big) Fx.addShake(5);
            Sfx.play('hit');
            p.done = true;
            return;
        }
        p.x += (tx - p.x) / len * step;
        p.y += (ty - p.y) / len * step;
        p.trail += dt;
        if (p.trail > 0.02) {
            p.trail = 0;
            Fx.particles.push({
                x: p.x, y: p.y, vx: 0, vy: 0, life: 0.14, max: 0.14,
                size: p.big ? 6 : 4, color: p.big ? '#ffb07a' : '#b89dff', gravity: 0
            });
        }
    } else {
        p.age += dt;
        const t = clamp(p.age / p.time, 0, 1);
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t - Math.sin(t * Math.PI) * 90;
        if (Math.random() < 0.7) {
            Fx.particles.push({
                x: p.x + randRange(-6, 6), y: p.y + randRange(-6, 6), vx: 0, vy: -20,
                life: 0.25, max: 0.25, size: 6, color: '#a96bff', gravity: 0
            });
        }
        if (t >= 1) {
            splashDamage(p.tx, p.ty + 30, p.splash, p.damage, '#d7a8ff');
            Fx.ring(p.tx, p.ty + 30, p.splash, '#c28bff', 0.3);
            Fx.anim('fx_blastViolet', p.tx, p.ty + 10, p.splash * 2.8, 0.42);
            Fx.glow(p.tx, p.ty, p.splash * 1.5, 'rgba(170,90,255,1)', 0.24);
            Fx.burst(p.tx, p.ty, '#c28bff', 22, 420, 0.42, 7);
            Fx.addShake(6);
            Sfx.play('blast');
            p.done = true;
        }
    }
}
