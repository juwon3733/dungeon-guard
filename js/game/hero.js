// 용사: 경로를 따라 왕좌로 걷고, 막히면 막은 유닛과 싸운다.

function createHero(type, waveIndex, delay, isBoss) {
    const def = HEROES[type];
    const scale = 1 + COMBAT_RULES.hpPerWave * waveIndex;
    const hp = isBoss ? def.hp * FLOOR_BOSS.hpMultiplier * scale : def.hp * scale;
    return {
        type,
        boss: !!isBoss,
        elite: !isBoss && !!def.elite,
        throneDamage: isBoss ? FLOOR_BOSS.throneDamage : (def.throneDamage || 1),
        name: isBoss ? FLOOR_BOSS.name : def.name,
        female: Math.random() < 0.5,
        d: 0,
        lane: isBoss ? 0 : randRange(-34, 34), // 넓게 퍼져 무리로 보이게 한다
        hp, maxHp: hp,
        speed: (isBoss ? FLOOR_BOSS.speed : def.speed) * TILE,
        damage: isBoss ? FLOOR_BOSS.damage : def.damage,
        interval: isBoss ? FLOOR_BOSS.interval : def.interval,
        armor: isBoss ? FLOOR_BOSS.armor : (def.armor || 0),
        bounty: isBoss ? FLOOR_BOSS.bounty : def.bounty,
        delay,
        waiting: true,
        dir: 'right',
        anim: Math.random() * 4,
        atk: 0,
        atkPose: 0,
        flash: 0,
        stun: 0,
        cast: def.stunEvery ? randRange(1.5, def.stunEvery) : 0,
        blocker: null,
        chargeTime: 0,
        charged: false,
        stomped: false,
        windup: 0,
        dead: false
    };
}

function heroWorld(h) {
    const p = pathAt(h.d);
    return { x: p.x - p.dy * h.lane, y: p.y + p.dx * h.lane, dx: p.dx, dy: p.dy };
}

function dirFromVector(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
}

function updateHero(h, dt) {
    const G = Game;
    if (h.waiting) {
        h.delay -= dt;
        if (h.delay <= 0) {
            h.waiting = false;
            Sfx.play('spawn');
            if (h.elite && Math.random() < 0.5) {
                const w = heroWorld(h);
                Fx.say(w.x, w.y - 150, randItem(SPEECH.elite), 1.4);
            }
        }
        return;
    }
    h.flash = Math.max(0, h.flash - dt);
    h.atkPose = Math.max(0, h.atkPose - dt);
    h.anim += dt * (h.chargeTime > 0 ? 14 : 7);

    if (h.boss) updateBossPatterns(h, dt);
    if (h.stun > 0) {
        h.stun -= dt;
        return;
    }
    if (h.windup > 0) return;

    if (h.blocker && (h.blocker.hp <= 0 || h.blocker.removed)) h.blocker = null;
    if (h.blocker) {
        const blocker = h.blocker; // Why: 공격으로 유닛이 죽으면 h.blocker가 비워지므로 미리 잡아 둔다.
        const hp = heroWorld(h);
        h.dir = dirFromVector(blocker.x - hp.x, blocker.y - hp.y);
        h.atk -= dt;
        if (h.atk <= 0) {
            h.atk = h.interval;
            h.atkPose = 0.22;
            damageUnit(blocker, h.damage);
            Sfx.play('slash');
        }
        return;
    }

    if (HEROES[h.type].stunEvery && !h.boss) updateMageCast(h, dt);

    const speed = h.chargeTime > 0 ? FLOOR_BOSS.chargeSpeed * TILE : h.speed;
    h.d += speed * dt;
    const p = pathAt(h.d);
    h.dir = dirFromVector(p.dx, p.dy);
    if (h.chargeTime > 0) {
        h.chargeTime -= dt;
        const w = heroWorld(h);
        Fx.burst(w.x, w.y, '#b98bff', 1, 80, 0.3, 6);
    }
    if (h.d >= PATH.length - 56) {
        h.dead = true;
        h.arrived = true;
        const w = heroWorld(h);
        if (Math.random() < 0.25) Fx.say(w.x - 60, w.y - 100, randItem(SPEECH.arrive), 1.5);
        if (h.boss) { G.hp = 0; damageThrone(FLOOR_BOSS.throneDamage); }
        else damageThrone(h.throneDamage);
    }
}

function updateMageCast(h, dt) {
    const def = HEROES[h.type]; // 마법사와 정예 뇌술사가 함께 쓴다
    h.cast -= dt;
    if (h.cast > 0) return;
    const w = heroWorld(h);
    let target = null;
    let best = def.stunRange * TILE;
    for (const f of Game.facilities) {
        const dd = distance(w.x, w.y, f.x, f.y);
        if (dd <= best && f.stun <= 0) { best = dd; target = f; }
    }
    if (!target) { h.cast = 0.4; return; }
    h.cast = def.stunEvery;
    h.atkPose = 0.35;
    target.stun = def.stunTime;
    Fx.beam(w.x, w.y - (h.elite ? 80 : 44), target.x, target.y - 60, '#7fd8ff', 8, 0.3);
    Fx.ring(target.x, target.y - 20, 74, '#7fd8ff', 0.4);
    if (Math.random() < 0.3) Fx.say(w.x, w.y - 90, '멈춰라!', 0.9);
    Sfx.play('stun');
}

function updateBossPatterns(h, dt) {
    const rule = FLOOR_BOSS;
    const ratio = h.hp / h.maxHp;
    if (!h.charged && ratio <= rule.chargeAt) {
        h.charged = true;
        h.chargeTime = rule.chargeTime;
        h.blocker = null;
        Fx.addShake(10);
        Fx.say(heroWorld(h).x, heroWorld(h).y - 190, '돌격!', 1.2, true);
        Sfx.play('charge');
    }
    if (!h.stomped && ratio <= rule.stompAt) {
        h.stomped = true;
        h.windup = rule.stompWindup;
        const w = heroWorld(h);
        Game.telegraphs.push({ x: w.x, y: w.y, radius: rule.stompRange * TILE, age: 0, life: rule.stompWindup });
        Sfx.play('charge');
    }
    if (h.windup > 0) {
        h.windup -= dt;
        if (h.windup <= 0) {
            const w = heroWorld(h);
            for (const f of Game.facilities) {
                if (distance(w.x, w.y, f.x, f.y) <= rule.stompRange * TILE) f.stun = rule.stompStun;
            }
            Fx.ring(w.x, w.y, rule.stompRange * TILE, '#d39bff', 0.5);
            Fx.burst(w.x, w.y, '#d39bff', 44, 680, 0.6, 8);
            Fx.addShake(26);
            Sfx.play('lightning');
        }
    }
}
