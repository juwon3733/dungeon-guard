// 마왕군 유닛: 오크 초소의 오크와 타락한 용사.
const BLOCK_CAPACITY = 3;

function createOrc(owner, slot, stats) {
    // 길을 따라 앞뒤로, 길 폭 방향으로도 어긋나게 세워 두 마리가 겹치지 않게 한다
    const offset = slot === 0 ? -42 : 42;
    const p = pathAt(owner.rally.d + offset);
    const side = slot === 0 ? -16 : 16;
    return {
        kind: 'orc', owner, slot, x: owner.x, y: owner.y, homeX: p.x - p.dy * side, homeY: p.y + p.dx * side, d: owner.rally.d + offset,
        hp: stats.unitHp, maxHp: stats.unitHp, damage: stats.damage, interval: stats.interval, armor: stats.armor,
        range: 1.1, blockCount: 0, atk: 0, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, flash: 0, anim: Math.random() * 4, target: null,
        facing: 1, ranged: false
    };
}

function createCorruptUnit(corpse) {
    const def = CORRUPTED[corpse.type];
    return {
        kind: 'corrupt', heroType: corpse.type, female: corpse.female, owner: null, slot: -1,
        x: corpse.x, y: corpse.y, homeX: corpse.x, homeY: corpse.y, d: corpse.d,
        hp: def.hp, maxHp: def.hp, damage: def.damage, interval: def.interval, armor: 0,
        range: def.range, ranged: !!def.ranged, atk: 0, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, flash: 0, anim: 0, target: null,
        facing: 1, dir: corpse.dir === 'right' ? 'left' : 'down', rise: 0.5
    };
}

function damageUnit(u, amount) {
    if (u.removed) return;
    const dealt = amount * (1 - (u.armor || 0));
    u.hp -= dealt;
    u.flash = 0.09;
    Fx.number(u, u.x, u.y - 74, Math.round(dealt), '#ff8f8f', false);
    Fx.burst(u.x, u.y - 30, '#ff8f8f', 2, 150, 0.24, 5);
    if (u.hp <= 0) {
        u.removed = true;
        Fx.burst(u.x, u.y - 44, u.kind === 'corrupt' ? '#c56bff' : '#d59560', 14, 320, 0.45, 7);
        Sfx.play('unitDown');
        for (const h of Game.heroes) if (h.blocker === u) h.blocker = null;
    }
}

function updateUnit(u, dt) {
    u.flash = Math.max(0, u.flash - dt);
    u.atkPose = Math.max(0, u.atkPose - dt);
    u.anim += dt * 5;
    if (u.rise > 0) {
        u.rise -= dt;
        return;
    }

    // 초소에서 길로 걸어 나온다
    const toHome = distance(u.x, u.y, u.homeX, u.homeY);
    if (toHome > 6) {
        const v = 170 * dt;
        u.facing = u.homeX >= u.x ? 1 : -1;
        u.dir = dirFromVector(u.homeX - u.x, u.homeY - u.y);
        u.x += (u.homeX - u.x) / toHome * Math.min(v, toHome);
        u.y += (u.homeY - u.y) / toHome * Math.min(v, toHome);
        u.moving = true;
        return;
    }
    u.moving = false;

    if (u.target && (u.target.dead || u.target.waiting)) u.target = null;
    if (!u.ranged) {
        // 돌진 등으로 붙잡은 용사가 빠져나가면 놓아준다
        if (u.target && u.target.blocker !== u) u.target = null;
        // Why: 무리를 상대하므로 유닛 하나가 최대 3명을 붙잡는다. 나머지는 지나가 추가 배치 판단이 생긴다.
        const held = Game.heroes.filter(h => h.blocker === u && !h.dead);
        if (held.length < BLOCK_CAPACITY) {
            const candidate = nearestHero(u.x, u.y, u.range * TILE, h => !h.blocker && h.chargeTime <= 0);
            if (candidate) { candidate.blocker = u; held.push(candidate); }
        }
        if (!u.target && held.length) u.target = held[0];
    } else if (!u.target || distance(u.x, u.y, heroWorld(u.target).x, heroWorld(u.target).y) > u.range * TILE) {
        u.target = nearestHero(u.x, u.y, u.range * TILE);
    }
    if (!u.target) return;

    const tp = heroWorld(u.target);
    u.facing = tp.x >= u.x ? 1 : -1;
    u.dir = dirFromVector(tp.x - u.x, tp.y - u.y);
    u.atk -= dt;
    if (u.atk <= 0) {
        u.atk = u.interval;
        u.atkPose = u.atkPoseMax = ATTACK_POSE_TIME;
        if (u.ranged) {
            Game.projectiles.push({ kind: 'arrow', x: u.x, y: u.y - 70, target: u.target, damage: u.damage, speed: 1100, big: false, trail: 0 });
            Sfx.play('orb');
        } else {
            damageHero(u.target, u.damage, u.x, u.y, '#ffb76b');
            Sfx.play('slash');
        }
    }
}
