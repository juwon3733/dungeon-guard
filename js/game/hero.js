// 용사: 경로를 따라 왕좌로 걷고, 막히면 막은 유닛과 싸운다.

// Why: 공격 동작(6프레임)을 보여 주는 시간. 표시 전용이며 피해량·공격 간격과는 무관하다.
const ATTACK_POSE_TIME = 0.4;

// bossKey: 층 보스로 만들 때 BOSSES의 열쇠(true면 부대장). 보스는 type 대신 보스의 base 직업을 쓴다.
// route: 들어오는 입구의 길(ROUTES 열쇠). 없으면 north
function createHero(type, waveIndex, delay, bossKey, route) {
    const key = bossKey === true ? 'fallen_knight' : bossKey;
    const bossDef = key ? BOSSES[key] : null;
    if (bossDef) type = bossDef.base;
    const def = HEROES[type];
    const scale = (1 + COMBAT_RULES.hpPerWave * waveIndex) * Game.heroHpMul * Game.endlessHpMul(waveIndex); // 스테이지 체력 배율(스토리 없으면 1)
    const swarm = !bossDef && !def.elite; // 일반 용사는 떼로 나오는 만큼 한 명이 약하다(SWARM_RULES)
    const hp = bossDef ? def.hp * bossDef.hpMultiplier * scale * (bossDef.waveHpMul || 1) : def.hp * scale * (swarm ? SWARM_RULES.hpMul : 1);
    const src = bossDef || def;
    return {
        type,
        boss: !!bossDef,
        bossKey: bossDef ? key : null,
        elite: !bossDef && !!def.elite,
        throneDamage: (src.throneDamage || 1) * (swarm ? SWARM_RULES.leak : 1),
        name: src.name,
        route: route || 'north',
        d: 0, // route 길 위에서 입구로부터 이동한 거리
        lane: bossDef ? 0 : rngRange('spawn', -34, 34), // 넓게 퍼져 무리로 보이게 한다
        hp, maxHp: hp,
        speed: src.speed * TILE * Game.mods.heroSpeed, // 마왕과 유물의 용사 이동 속도(heroSpeed)
        damage: src.damage,
        interval: src.interval,
        armor: src.armor || 0,
        bounty: src.bounty * (swarm ? SWARM_RULES.bountyMul : 1),
        delay,
        waiting: true,
        dir: 'right',
        anim: Math.random() * 4,
        atk: 0,
        atkPose: 0,
        atkPoseMax: ATTACK_POSE_TIME,
        flash: 0,
        stun: 0,
        curse: 0, curseMul: 1, // 저주(curseShot): 남은 초와 받는 피해 배율
        burn: 0, burnDps: 0, burnTick: 0, burnOwner: null, // 화상(burnShot): 남은 초, 초당 피해, 다음 피해까지 초, 건 몬스터
        slow: 0, slowMul: 1, // 빙결(slowShot): 남은 초와 이동 속도 배율
        cast: !bossDef && def.stunEvery ? rngRange('spawn', 1.5, def.stunEvery) : 0,
        song: !bossDef && def.song ? rngRange('spawn', 1, def.song.every) : 0,
        haste: 0, hasteMul: 1, // 음유시인 노래로 받은 가속: 남은 초와 배율
        blockTime: 0, // 지금 막힌 채로 지난 초(검사 돌파)
        slip: 0, // 남은 초 동안 막히지 않는다(검사 돌파 직후)
        blocker: null,
        chargeTime: 0,
        chargeSpeed: 0,
        patternsDone: [],
        windup: 0,
        blast: null, // windup이 끝나면 터질 범위 정지
        dead: false
    };
}

// 유닛 u가 용사 h를 새로 붙잡을 수 있는지
function canBlockHero(u, h) {
    if (h.blocker || h.chargeTime > 0 || h.slip > 0) return false;
    if (u.kind === 'monster' && MONSTERS[u.type].family === 'orc' && !h.boss && HEROES[h.type].passOrcs) return false;
    return true;
}

function heroWorld(h) {
    const p = pathAt(h.d, h.route);
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
                Fx.say(w.x, w.y - 240, randItem(SPEECH.elite), 1.4);
            }
        }
        return;
    }
    h.flash = Math.max(0, h.flash - dt);
    h.atkPose = Math.max(0, h.atkPose - dt);
    h.haste = Math.max(0, h.haste - dt);
    h.slip = Math.max(0, h.slip - dt);
    h.curse = Math.max(0, h.curse - dt);
    h.slow = Math.max(0, h.slow - dt);
    if (h.burn > 0) {
        // 화상은 정지와 막힘 중에도 탄다. 0.5초마다 피해(방어력 무시)
        h.burn -= dt;
        h.burnTick -= dt;
        if (h.burnTick <= 1e-6) { // 프레임 시간을 더해 생기는 오차로 마지막 피해를 놓치지 않게 한다
            h.burnTick += 0.5;
            const w = heroWorld(h);
            const owner = h.burnOwner && !h.burnOwner.removed ? h.burnOwner : null;
            damageHero(h, h.burnDps * 0.5, w.x, w.y, '#ff9d4d', owner, true);
            if (h.dead) return;
        }
        if (h.burn <= 0) h.burn = 0;
    }
    h.anim += dt * (h.chargeTime > 0 ? 14 : 7) * (h.haste > 0 ? h.hasteMul : 1);

    if (h.boss) updateBossPatterns(h, dt);
    updateWindup(h, dt);
    if (h.stun > 0) {
        h.stun -= dt;
        return;
    }
    if (h.windup > 0) return;

    const def = HEROES[h.type];
    if (def.song && !h.boss) updateSong(h, dt);

    if (h.blocker && (h.blocker.hp <= 0 || h.blocker.removed)) h.blocker = null;
    if (h.blocker) {
        const blocker = h.blocker; // Why: 공격으로 유닛이 죽으면 h.blocker가 비워지므로 미리 잡아 둔다.
        const hp = heroWorld(h);
        h.dir = dirFromVector(blocker.x - hp.x, blocker.y - hp.y);
        h.blockTime += dt;
        if (def.breakthrough && !h.boss && h.blockTime >= def.breakthrough.after) {
            breakThrough(h, blocker, def.breakthrough);
            return;
        }
        h.atk -= dt;
        if (h.atk <= 0) {
            h.atk = h.interval;
            h.atkPose = h.atkPoseMax = ATTACK_POSE_TIME;
            damageUnit(blocker, h.damage, h);
            Sfx.play('slash');
        }
        return;
    }
    h.blockTime = 0;

    if (def.stunEvery && !h.boss) updateMageCast(h, dt);
    if (h.windup > 0) return; // 뇌술사가 범위 감전 경고를 막 시작했다

    const bridge = Game.mods.mergedSlow !== 1 && h.d >= mergeDistance(h.route) ? Game.mods.mergedSlow : 1; // 유물: 합류점을 지난 용사
    const speed = h.chargeTime > 0 ? h.chargeSpeed : h.speed * bridge * (h.haste > 0 ? h.hasteMul : 1) * (h.slow > 0 ? h.slowMul : 1);
    h.d += speed * dt;
    const p = pathAt(h.d, h.route);
    h.dir = dirFromVector(p.dx, p.dy);
    if (h.chargeTime > 0) {
        h.chargeTime -= dt;
        const w = heroWorld(h);
        Fx.burst(w.x, w.y, '#b98bff', 1, 80, 0.3, 6);
    }
    if (h.d >= ROUTES[h.route].length - 56) {
        h.dead = true;
        h.arrived = true;
        const w = heroWorld(h);
        if (Math.random() < 0.25) Fx.say(w.x - 60, w.y - 150, randItem(SPEECH.arrive), 1.5);
        if (h.boss) { G.hp = 0; damageThrone(h.throneDamage); }
        else {
            // 일반 용사는 왕좌 피해가 1보다 작아 모아서 깎는다
            G.leak = (G.leak || 0) + h.throneDamage;
            const whole = Math.floor(G.leak + 1e-9);
            if (whole >= 1) {
                G.leak -= whole;
                damageThrone(whole);
            }
        }
    }
}

// 마법사는 가장 가까운 대상 하나를, 정예 뇌술사(stunArea)는 경고 뒤 사거리 안 전부를 정지시킨다
function updateMageCast(h, dt) {
    const def = HEROES[h.type];
    h.cast -= dt;
    if (h.cast > 0) return;
    const w = heroWorld(h);
    const targets = stunTargets(w.x, w.y, def.stunRange * TILE);
    if (def.stunArea) {
        if (!targets.length) { h.cast = 0.4; return; }
        h.cast = def.stunEvery;
        startBlast(h, { kind: 'shock', x: w.x, y: w.y, range: def.stunRange, stun: def.stunTime, windup: def.stunArea.warn });
        if (Math.random() < 0.3) Fx.say(w.x, w.y - 250, '전부 멈춰라!', 0.9);
        return;
    }
    let target = null;
    let best = Infinity;
    for (const t of targets) {
        const dd = distance(w.x, w.y, t.x, t.y);
        if (dd < best && !(t.stun > 0)) { best = dd; target = t; }
    }
    if (!target) { h.cast = 0.4; return; }
    h.cast = def.stunEvery;
    h.atkPose = h.atkPoseMax = def.atkTime || ATTACK_POSE_TIME; // 정예 그림에는 atkTime이 없다
    applyStun(target, def.stunTime);
    Fx.beam(w.x, w.y - (h.elite ? 80 : 44), target.x, target.y - 60, '#7fd8ff', 8, 0.3);
    Fx.ring(target.x, target.y - 30, 100, '#7fd8ff', 0.4);
    if (Math.random() < 0.3) Fx.say(w.x, w.y - 150, '멈춰라!', 0.9);
    Sfx.play('stun');
}

// 음유시인의 노래: 반경 안 용사(자신 포함)에게 가속을 건다. 곁에 다른 용사가 없으면 아껴 둔다
function updateSong(h, dt) {
    const rule = HEROES[h.type].song;
    h.song -= dt;
    if (h.song > 0) return;
    const w = heroWorld(h);
    const near = Game.heroes.filter(o => {
        if (o.dead || o.waiting) return false;
        const q = heroWorld(o);
        return distance(w.x, w.y, q.x, q.y) <= rule.radius * TILE;
    });
    if (near.length < 2) { h.song = 0.4; return; }
    h.song = rule.every;
    h.atkPose = h.atkPoseMax = 0.5;
    for (const o of near) {
        o.haste = Math.max(o.haste, rule.duration);
        o.hasteMul = rule.speedMul;
    }
    Fx.ring(w.x, w.y, rule.radius * TILE, '#8dffb4', 0.5);
    Fx.rise(w.x, w.y - 90, '#b8ffcf', 14, 40, 0.8);
    if (Math.random() < 0.3) Fx.say(w.x, w.y - 250, '달려라, 친구들!', 0.9);
    Sfx.play('spawn');
}

// 검사의 돌파: 막은 쪽을 길 옆으로 밀치고 잠깐 정지시킨 뒤 지나간다
function breakThrough(h, unit, rule) {
    const w = heroWorld(h);
    // 길 진행 방향에 수직으로, 서 있던 쪽으로 민다. 몬스터는 정지가 풀리면 길 지점으로 걸어 돌아간다
    let nx = -w.dy;
    let ny = w.dx;
    if ((unit.x - w.x) * nx + (unit.y - w.y) * ny < 0) { nx = -nx; ny = -ny; }
    unit.x += nx * rule.push * TILE;
    unit.y += ny * rule.push * TILE;
    applyStun(unit, rule.stun);
    if (unit.target === h) unit.target = null;
    h.blocker = null;
    h.blockTime = 0;
    h.slip = rule.free;
    h.atkPose = h.atkPoseMax = ATTACK_POSE_TIME;
    Fx.burst(unit.x, unit.y - 60, '#ffe9b0', 12, 340, 0.4, 6);
    Fx.ring(w.x, w.y - 30, 100, '#ffe9b0', 0.3);
    Fx.addShake(4);
    if (Math.random() < 0.4) Fx.say(w.x, w.y - 250, '비켜!', 0.9);
    Sfx.play('slash');
}

// 범위 정지를 예약한다: 시전자는 windup초 동안 멈추고, 바닥에 경고 원이 뜬다
function startBlast(h, blast) {
    h.blast = blast;
    h.windup = blast.windup;
    h.atkPose = h.atkPoseMax = blast.windup; // 경고 동안 주문 동작을 보인다
    Game.telegraphs.push({
        x: blast.x, y: blast.y, radius: blast.range * TILE, age: 0, life: blast.windup,
        color: blast.kind === 'shock' ? '110,200,255' : null
    });
    Sfx.play('charge');
}

// 경고가 끝나면 원 안의 방어 쪽 전부를 정지시킨다. 시전자가 정지당해도 이미 시작한 주문은 터진다(부대장 내려찍기와 같다)
function updateWindup(h, dt) {
    if (h.windup <= 0) return;
    h.windup -= dt;
    if (h.windup > 0 || !h.blast) return;
    const b = h.blast;
    h.blast = null;
    const targets = stunTargets(b.x, b.y, b.range * TILE);
    for (const t of targets) applyStun(t, b.stun);
    if (b.kind === 'shock') {
        const big = h.boss;
        for (const t of targets) {
            Fx.bolt(t.x, t.y - 30, '#bfe9ff');
            Fx.anim('fx_hit_lightning', t.x, t.y - 60, big ? 390 : 300, 0.4);
        }
        Fx.ring(b.x, b.y, b.range * TILE, '#7fd8ff', 0.5);
        Fx.burst(b.x, b.y, '#bfe9ff', big ? 44 : 22, big ? 680 : 420, 0.5, 7);
        Fx.glow(b.x, b.y, b.range * TILE, 'rgba(120,200,255,1)', 0.25);
        Fx.addShake(big ? 22 : 8);
    } else {
        Fx.ring(b.x, b.y, b.range * TILE, '#d39bff', 0.5);
        Fx.burst(b.x, b.y, '#d39bff', 44, 680, 0.6, 8);
        Fx.addShake(26);
    }
    Sfx.play('lightning');
}

// 보스 패턴: 체력 비율이 각 패턴의 at 이하가 되면 한 번씩 쓴다
function updateBossPatterns(h, dt) {
    const ratio = h.hp / h.maxHp;
    BOSSES[h.bossKey].patterns.forEach((rule, i) => {
        if (h.patternsDone[i] || ratio > rule.at) return;
        h.patternsDone[i] = true;
        const w = heroWorld(h);
        if (rule.kind === 'charge') {
            h.chargeTime = rule.time;
            h.chargeSpeed = rule.speed * TILE;
            h.blocker = null;
            Fx.addShake(10);
            Fx.say(w.x, w.y - 340, '돌격!', 1.2, true);
            Sfx.play('charge');
        } else {
            startBlast(h, { kind: rule.kind, x: w.x, y: w.y, range: rule.range, stun: rule.stun, windup: rule.windup });
            if (rule.kind === 'shock') Fx.say(w.x, w.y - 360, rule.range >= 5 ? '천둥이여, 전부 쓸어라!' : '감전이다!', 1.4, true);
        }
    });
}
