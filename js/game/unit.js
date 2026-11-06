// 마왕군 유닛: 타락한 용사. 길 몬스터와 함께 쓰는 길막기 규칙(holdHeroes)과 피해 처리(damageUnit)도 여기 있다.
const BLOCK_CAPACITY = 3; // 타락 유닛 하나가 붙잡는 용사 수

function createCorruptUnit(corpse) {
    const def = CORRUPTED[corpse.type];
    return {
        kind: 'corrupt', heroType: corpse.type, female: corpse.female,
        x: corpse.x, y: corpse.y, route: corpse.route || 'north', d: corpse.d,
        hp: def.hp, maxHp: def.hp, damage: def.damage, interval: def.interval, armor: 0,
        range: def.range, ranged: !!def.ranged, stun: 0, atk: 0, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, flash: 0, anim: 0, target: null,
        // 쓰러질 때 걷던 방향의 반대, 곧 다음 용사가 오는 쪽을 보고 일어난다. 위아래로 걷다 쓰러졌으면 얼굴이 보이게 아래를 본다.
        dir: { right: 'left', left: 'right' }[corpse.dir] || 'down', rise: 0.5
    };
}

// 길을 막는 쪽(타락 근접 유닛, 길 몬스터)이 용사를 붙잡고, 지금 때릴 용사를 돌려준다.
// Why: 무리를 상대하므로 하나가 여러 명(capacity)을 붙잡는다. 나머지는 지나가 추가 배치 판단이 생긴다.
function holdHeroes(u, capacity, range) {
    if (u.target && (u.target.dead || u.target.waiting)) u.target = null;
    // 돌진 등으로 붙잡은 용사가 빠져나가면 놓아준다
    if (u.target && u.target.blocker !== u) u.target = null;
    const held = Game.heroes.filter(h => h.blocker === u && !h.dead);
    if (held.length < capacity) {
        const candidate = nearestHero(u.x, u.y, range * TILE, h => canBlockHero(u, h));
        if (candidate) { candidate.blocker = u; held.push(candidate); }
    }
    if (!u.target && held.length) u.target = held[0];
    return u.target;
}

function damageUnit(u, amount) {
    if (u.removed || u.hp <= 0) return;
    const dealt = amount * (1 - (u.armor || 0));
    u.hp -= dealt;
    u.flash = 0.09;
    Fx.number(u, u.x, u.y - 74, Math.round(dealt), '#ff8f8f', false);
    Fx.burst(u.x, u.y - 30, '#ff8f8f', 2, 150, 0.24, 5);
    if (u.hp > 0) return;
    if (u.kind === 'monster') {
        knockDownMonster(u);
        return;
    }
    u.removed = true;
    Fx.burst(u.x, u.y - 44, '#c56bff', 14, 320, 0.45, 7);
    Sfx.play('unitDown');
    for (const h of Game.heroes) if (h.blocker === u) h.blocker = null;
}

function updateUnit(u, dt) {
    u.flash = Math.max(0, u.flash - dt);
    u.atkPose = Math.max(0, u.atkPose - dt);
    u.anim += dt * 5;
    if (u.rise > 0) {
        u.rise -= dt;
        return;
    }
    // 감전·밀침으로 정지: 붙잡은 용사는 계속 붙잡고 있지만 때리지도 걷지도 않는다
    if (u.stun > 0) {
        u.stun -= dt;
        u.moving = false;
        return;
    }

    if (!u.ranged) {
        holdHeroes(u, BLOCK_CAPACITY, u.range);
    } else {
        if (u.target && (u.target.dead || u.target.waiting)) u.target = null;
        if (!u.target || distance(u.x, u.y, heroWorld(u.target).x, heroWorld(u.target).y) > u.range * TILE) {
            u.target = nearestHero(u.x, u.y, u.range * TILE);
        }
    }
    if (!u.target) return;

    const tp = heroWorld(u.target);
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
