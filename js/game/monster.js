// 배치한 몬스터와 몬스터가 쏜 투사체. 동작은 몬스터 id가 아니라 역할(blocks), 수치, 능력 종류(abilities)로 정한다.
// 모든 몬스터는 길 옆 칸(col, row, 곧 homeX, homeY)에 놓는다. x, y는 지금 서 있는 곳이다.
//   막는 몬스터: 가장 가까운 길 지점(rally)으로 걸어 나가 용사를 붙잡고 싸운다. 쓰러지면 respawn초 뒤 놓은 칸에서 다시 나온다.
//   그 밖: 놓은 칸에서 사거리 안의 가장 앞선 용사를 공격한다. 공격받지 않는다.

const MONSTER_FOOT = 14; // 칸 가운데에서 발끝까지 아래로 내린 거리(세계 px)
const MONSTER_RELEASE = 0.5; // 공격 동작의 이 비율 지점에서 화살과 구체가 손을 떠난다
const MONSTER_WALK_SPEED = 170; // 길로 걸어 나가는 속도(세계 px/초). 예전 오크 초소의 오크와 같다
const MONSTER_WALK_FPS = 8;

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
    const rankMul = MONSTER_RANKS[m.rank || 0].mul;
    stats.damage *= rankMul;
    stats.hp *= rankMul;
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
    const enrage = monsterEnrage(m);
    if (enrage) stats.interval *= enrage.intervalMul;
    return stats;
}

// 광폭화 중이면 그 능력을, 아니면 null. 체력이 없는 몬스터(팝업 미리보기, 원거리)와 쓰러진 몬스터는 걸리지 않는다
function monsterEnrage(m) {
    const a = monsterAbility(m.type, 'enrage');
    if (!a || !(m.maxHp > 0) || m.down > 0) return null;
    return m.hp / m.maxHp <= a.below ? a : null;
}

// 몬스터의 공격이 용사에게 맞음: 맞은 뒤 걸리는 능력(저주)을 적용한다. 피해를 준 다음에 부른다
function monsterHitHero(type, hero) {
    if (hero.dead) return;
    const curse = monsterAbility(type, 'curseShot');
    if (curse) curseHero(hero, curse.duration, curse.takenMul);
}

// 쓰러질 때 능력: 반경 안 용사 기절(보스 제외)
function monsterDeathAbilities(m) {
    const a = monsterAbility(m.type, 'deathStun');
    if (!a) return;
    for (const h of Game.heroes) {
        if (h.dead || h.waiting || h.boss) continue;
        const p = heroWorld(h);
        if (distance(m.x, m.y + MONSTER_FOOT, p.x, p.y) > a.radius * TILE) continue;
        applyStun(h, a.duration);
        Fx.burst(p.x, p.y - 40, '#d9c8ff', 6, 200, 0.4, 5);
    }
    Fx.ring(m.x, m.y + MONSTER_FOOT, a.radius * TILE, '#d9c8ff', 0.45);
    Fx.ring(m.x, m.y + MONSTER_FOOT, a.radius * TILE * 0.6, '#9a6bff', 0.35);
    Fx.burst(m.x, m.y - 20, '#cdb8ff', 26, 520, 0.5, 6);
    Fx.addShake(8);
}

function createMonster(type, col, row) {
    const m = {
        kind: 'monster', type, blocks: monsterBlocks(type), col, row, x: tileX(col), y: tileY(row),
        homeX: tileX(col), homeY: tileY(row), rally: null, moving: false,
        tier: 1, branch: null, invested: MONSTERS[type].cost,
        rank: 0, xp: 0, rankUp: 0, // rank는 MONSTER_RANKS 번호, rankUp은 랭크가 오른 연출의 남은 초
        atk: 0.2, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, shot: null, anim: Math.random() * 4,
        dir: 'down', flash: 0, stun: 0, down: 0, target: null, hp: 0, maxHp: 0, armor: 0
    };
    // 발끝이 용사가 걷는 길 선에 오도록 칸 가운데 기준 위치를 발 높이만큼 올려 둔다
    if (m.blocks) {
        const r = rallyPoint(col, row);
        m.rally = { d: r.d, x: r.x, y: r.y - MONSTER_FOOT + 10 };
    }
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

// 랭크를 정한다. 경험치는 그 랭크의 시작값으로 맞춘다(합치기 승계, 시험 도구)
function setMonsterRank(m, rank) {
    m.rank = clamp(rank, 0, MONSTER_RANKS.length - 1);
    m.xp = MONSTER_RANKS[m.rank].xp;
    applyMonsterStats(m);
}

// 다음 랭크까지 남은 경험치(처치 수). 최고 랭크면 0
function monsterXpToNext(m) {
    const next = MONSTER_RANKS[(m.rank || 0) + 1];
    return next ? Math.max(0, next.xp - (m.xp || 0)) : 0;
}

// 몬스터가 용사를 쓰러뜨림: 처치 경험치를 받고, 넘친 만큼 랭크를 올린다(체력은 비율을 유지한다).
// 합쳐지거나 팔려 사라진 몬스터의 투사체가 마무리했으면 아무도 받지 않는다
function monsterKilledHero(m, hero) {
    if (!m || m.kind !== 'monster' || m.removed) return;
    m.xp += hero.boss ? RANK_KILL_XP.boss : (hero.elite ? RANK_KILL_XP.elite : RANK_KILL_XP.normal);
    const before = m.rank;
    while (MONSTER_RANKS[m.rank + 1] && m.xp >= MONSTER_RANKS[m.rank + 1].xp) m.rank++;
    if (m.rank === before) return;
    applyMonsterStats(m);
    m.rankUp = 1.2;
    const top = m.rank === MONSTER_RANKS.length - 1;
    const color = MONSTER_RANKS[m.rank].color;
    const footY = m.y + MONSTER_FOOT;
    Fx.ring(m.x, footY, top ? 120 : 80, color, 0.45);
    Fx.rise(m.x, footY, color, top ? 30 : 16, 34, 0.7);
    if (top) Fx.glow(m.x, footY - 40, 140, 'rgba(255,210,70,1)', 0.4);
    Sfx.play('rankUp', m.rank);
}

// 원거리 몬스터의 투사체가 나가는 위치: 발끝에서 손 높이만큼 위, 동서를 볼 때는 앞쪽으로
function monsterHand(m) {
    const hand = MONSTERS[m.type].art.hand || { x: 0, y: 60 };
    const side = m.dir === 'right' ? 1 : (m.dir === 'left' ? -1 : 0);
    return { x: m.x + side * hand.x, y: m.y + MONSTER_FOOT - hand.y };
}

function updateMonster(m, dt) {
    m.anim += dt;
    if (m.reveal > 0) m.reveal -= dt; // 합치기 결과: 연출이 끝날 때까지 그림을 숨긴다
    m.flash = Math.max(0, m.flash - dt);
    m.atkPose = Math.max(0, m.atkPose - dt);
    m.rankUp = Math.max(0, (m.rankUp || 0) - dt);
    if (m.down > 0) {
        m.stun = 0; // 쓰러진 동안 걸린 정지가 다시 나온 뒤까지 남지 않게 한다
        m.down -= dt;
        if (m.down <= 0) reviveMonster(m);
        return;
    }
    if (m.stun > 0) {
        m.stun -= dt;
        m.shot = null;
        return;
    }
    if (m.blocks) updateBlockMonster(m, dt);
    else updateSideMonster(m, dt);
}

// 막는 몬스터: 집결점까지 걸어 나간 뒤에야 용사를 붙잡는다
function updateBlockMonster(m, dt) {
    const toRally = distance(m.x, m.y, m.rally.x, m.rally.y);
    if (toRally > 6) {
        const step = Math.min(MONSTER_WALK_SPEED * dt, toRally);
        m.dir = dirFromVector(m.rally.x - m.x, m.rally.y - m.y);
        m.x += (m.rally.x - m.x) / toRally * step;
        m.y += (m.rally.y - m.y) / toRally * step;
        m.moving = true;
        return;
    }
    m.moving = false;
    const stats = monsterStats(m);
    const target = holdHeroes(m, stats.block, stats.range);
    if (!target) return;
    const tp = heroWorld(target);
    m.dir = dirFromVector(tp.x - m.x, tp.y - m.y);
    m.atk -= dt;
    if (m.atk > 0) return;
    m.atk = stats.interval;
    m.atkPose = m.atkPoseMax = Math.min(ATTACK_POSE_TIME, stats.interval);
    damageHero(target, stats.damage, m.x, m.y, '#ffb76b', m);
    monsterHitHero(m.type, target);
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
        fireBeam(hand.x, hand.y, stats, tp, m);
    } else if (stats.splash > 0) {
        Game.projectiles.push({
            kind: 'orb', x: hand.x, y: hand.y, tx: tp.x, ty: tp.y - 30, sx: hand.x, sy: hand.y,
            age: 0, time: clamp(distance(hand.x, hand.y, tp.x, tp.y) / 760, 0.25, 0.6),
            damage: stats.damage, splash: stats.splash * TILE, src: m.type, owner: m
        });
        Fx.glow(hand.x, hand.y, 50, 'rgba(190,110,255,1)', 0.18);
        Sfx.play('orb');
    } else {
        Game.projectiles.push({
            kind: 'arrow', x: hand.x, y: hand.y, target, damage: stats.damage, src: m.type, owner: m,
            speed: stats.heavy ? 2200 : 1300, big: stats.heavy, trail: 0,
            curse: !!monsterAbility(m.type, 'curseShot') // 저주 화살은 보랏빛 꼬리를 남긴다
        });
        Sfx.play(stats.heavy ? 'snipe' : 'arrow');
    }
}

// owner: 쏜 몬스터(처치 경험치를 받는다)
function fireBeam(ox, oy, stats, tp, owner) {
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
        if (off < 42) {
            damageHero(h, stats.damage, ox, oy, '#d7a8ff', owner);
            monsterHitHero(owner.type, h);
        }
    }
    Sfx.play('beam');
}

// 막는 몬스터가 쓰러짐: 붙잡던 용사를 놓고 놓은 칸에서 재생성을 기다린다. damageUnit이 부른다
function knockDownMonster(m) {
    const stats = monsterStats(m);
    m.hp = 0;
    m.down = stats.respawn;
    m.atkPose = 0;
    m.target = null;
    for (const h of Game.heroes) if (h.blocker === m) h.blocker = null;
    monsterDeathAbilities(m); // 집으로 돌아가기 전, 쓰러진 자리에서 터진다
    Fx.anim('fx_explosion', m.x, m.y - 30, 150, 0.4);
    Fx.burst(m.x, m.y - 40, '#d59560', 14, 320, 0.45, 7);
    Sfx.play('unitDown');
    m.x = m.homeX;
    m.y = m.homeY;
    m.moving = false;
}

function reviveMonster(m) {
    m.down = 0;
    m.hp = m.maxHp;
    m.atk = 0.3;
    m.x = m.homeX;
    m.y = m.homeY;
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
            damageHero(t, p.damage, p.x, p.y, p.big ? '#ff9d6b' : (p.curse ? '#d9a8ff' : '#ffe36b'), p.owner);
            // 타락 유닛의 화살에는 src와 owner가 없다
            if (p.src) monsterHitHero(p.src, t);
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
                size: p.big || p.curse ? 6 : 4, color: p.big ? '#ffb07a' : (p.curse ? '#b05cff' : '#b89dff'), gravity: 0
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
            splashDamage(p.tx, p.ty + 30, p.splash, p.damage, '#d7a8ff', h => monsterHitHero(p.src, h), p.owner);
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
