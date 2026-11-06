// 배치한 몬스터와 몬스터가 쏜 투사체. 동작은 몬스터 id가 아니라 역할의 설치 위치(place)와 수치로 정한다.
//   path: 길 칸에 서서 용사를 붙잡고 싸운다. 쓰러지면 respawn초 뒤 같은 자리에서 다시 일어난다.
//   side: 길 옆 칸에서 사거리 안의 가장 앞선 용사를 공격한다. 공격받지 않는다.

const MONSTER_FOOT = 14; // 칸 가운데에서 발끝까지 아래로 내린 거리(세계 px)
const MONSTER_RELEASE = 0.5; // 공격 동작의 이 비율 지점에서 화살과 구체가 손을 떠난다

function monsterStats(m) {
    const def = MONSTERS[m.type];
    const base = def.stats;
    const stats = {
        hp: base.hp || 0, damage: base.damage, interval: base.interval, range: base.range, splash: base.splash || 0,
        block: base.block || 0, respawn: base.respawn || 0, armor: 0, beam: false, heavy: false
    };
    if (m.tier >= 2) {
        stats.damage *= 1.5;
        stats.hp *= 1.5;
    }
    if (m.tier >= 3 && m.branch) {
        const b = def.branches[m.branch];
        if (b.damageMul) stats.damage *= b.damageMul;
        if (b.interval) stats.interval = b.interval;
        if (b.range) stats.range = b.range;
        if (b.splash) stats.splash = b.splash;
        if (b.armor) stats.armor = b.armor;
        if (b.beam) stats.beam = true;
        if (b.heavy) stats.heavy = true;
    }
    return stats;
}

function createMonster(type, col, row) {
    const m = {
        kind: 'monster', type, place: monsterPlace(type), col, row, x: tileX(col), y: tileY(row),
        tier: 1, branch: null, invested: MONSTERS[type].cost,
        atk: 0.2, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, shot: null, anim: Math.random() * 4,
        dir: 'down', flash: 0, stun: 0, down: 0, target: null, hp: 0, maxHp: 0, armor: 0
    };
    applyMonsterStats(m, true);
    return m;
}

// 강화하면 체력은 비율을 유지한 채 최대치만 늘린다
function applyMonsterStats(m, fresh) {
    const stats = monsterStats(m);
    const ratio = fresh || m.maxHp <= 0 ? 1 : m.hp / m.maxHp;
    m.maxHp = stats.hp;
    if (m.down <= 0) m.hp = stats.hp * ratio;
    m.armor = stats.armor;
}

// 원거리 몬스터의 투사체가 나가는 위치: 발끝에서 손 높이만큼 위, 동서를 볼 때는 앞쪽으로
function monsterHand(m) {
    const hand = MONSTERS[m.type].art.hand || { x: 0, y: 60 };
    const side = m.dir === 'right' ? 1 : (m.dir === 'left' ? -1 : 0);
    return { x: m.x + side * hand.x, y: m.y + MONSTER_FOOT - hand.y };
}

function updateMonster(m, dt) {
    m.anim += dt;
    m.flash = Math.max(0, m.flash - dt);
    m.atkPose = Math.max(0, m.atkPose - dt);
    if (m.down > 0) {
        m.down -= dt;
        if (m.down <= 0) reviveMonster(m);
        return;
    }
    if (m.stun > 0) {
        m.stun -= dt;
        m.shot = null;
        return;
    }
    if (m.place === 'path') updatePathMonster(m, dt);
    else updateSideMonster(m, dt);
}

function updatePathMonster(m, dt) {
    const stats = monsterStats(m);
    const target = holdHeroes(m, stats.block, stats.range);
    if (!target) return;
    const tp = heroWorld(target);
    m.dir = dirFromVector(tp.x - m.x, tp.y - m.y);
    m.atk -= dt;
    if (m.atk > 0) return;
    m.atk = stats.interval;
    m.atkPose = m.atkPoseMax = Math.min(ATTACK_POSE_TIME, stats.interval);
    damageHero(target, stats.damage, m.x, m.y, '#ffb76b');
    Sfx.play('slash');
}

function updateSideMonster(m, dt) {
    const stats = monsterStats(m);
    // 공격 동작 중간에 손을 떠난다. 그 사이 대상이 쓰러지면 사거리 안의 다른 용사를 노린다
    if (m.shot) {
        m.shot.t -= dt;
        if (m.shot.t <= 0) {
            let target = m.shot.target;
            if (target.dead) target = foremostHero(m.x, m.y, stats.range * TILE);
            m.shot = null;
            if (target) fireMonsterShot(m, stats, target);
        }
        return;
    }
    m.atk -= dt;
    if (m.atk > 0) return;
    const target = foremostHero(m.x, m.y, stats.range * TILE);
    if (!target) { m.atk = 0.08; return; }
    const tp = heroWorld(target);
    m.dir = dirFromVector(tp.x - m.x, tp.y - m.y);
    m.atk = stats.interval;
    m.atkPose = m.atkPoseMax = Math.min(ATTACK_POSE_TIME, stats.interval);
    m.shot = { target, t: m.atkPoseMax * MONSTER_RELEASE };
}

function fireMonsterShot(m, stats, target) {
    const tp = heroWorld(target);
    const hand = monsterHand(m);
    if (stats.beam) {
        fireBeam(hand.x, hand.y, stats, tp);
    } else if (stats.splash > 0) {
        Game.projectiles.push({
            kind: 'orb', x: hand.x, y: hand.y, tx: tp.x, ty: tp.y - 30, sx: hand.x, sy: hand.y,
            age: 0, time: clamp(distance(hand.x, hand.y, tp.x, tp.y) / 760, 0.25, 0.6),
            damage: stats.damage, splash: stats.splash * TILE
        });
        Fx.glow(hand.x, hand.y, 50, 'rgba(190,110,255,1)', 0.18);
        Sfx.play('orb');
    } else {
        Game.projectiles.push({
            kind: 'arrow', x: hand.x, y: hand.y, target, damage: stats.damage,
            speed: stats.heavy ? 2200 : 1300, big: stats.heavy, trail: 0
        });
        Sfx.play(stats.heavy ? 'snipe' : 'arrow');
    }
}

function fireBeam(ox, oy, stats, tp) {
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

// 길 몬스터가 쓰러짐: 붙잡던 용사를 놓고 재생성을 기다린다. damageUnit이 부른다
function knockDownMonster(m) {
    const stats = monsterStats(m);
    m.hp = 0;
    m.down = stats.respawn;
    m.atkPose = 0;
    m.target = null;
    for (const h of Game.heroes) if (h.blocker === m) h.blocker = null;
    Fx.anim('fx_explosion', m.x, m.y - 30, 150, 0.4);
    Fx.burst(m.x, m.y - 40, '#d59560', 14, 320, 0.45, 7);
    Sfx.play('unitDown');
}

function reviveMonster(m) {
    m.down = 0;
    m.hp = m.maxHp;
    m.atk = 0.3;
    Fx.ring(m.x, m.y + MONSTER_FOOT, 70, '#ffb76b', 0.35);
    Fx.rise(m.x, m.y + MONSTER_FOOT, '#ffb76b', 14, 30, 0.5);
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
