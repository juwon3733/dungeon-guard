// 배치한 몬스터와 몬스터가 쏜 투사체. 동작은 몬스터 id가 아니라 역할(blocks), 수치, 능력 종류(abilities)로 정한다.
// 모든 몬스터는 길 옆 칸(col, row, 곧 homeX, homeY)에 놓는다. x, y는 지금 서 있는 곳이다.
//   막는 몬스터: 가장 가까운 길 지점(rally)으로 걸어 나가 용사를 붙잡고 싸운다. 쓰러지면 respawn초 뒤 놓은 칸에서 다시 나온다.
//   그 밖: 놓은 칸에서 사거리 안의 가장 앞선 용사를 공격한다. 공격받지 않는다.

const MONSTER_FOOT = 0; // 칸 가운데에서 발끝까지 아래로 내린 거리(세계 px). 발이 칸 가운데에 온다
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
    // 장비: 랭크와 갈래까지 정한 수치에 곱한다(갈래의 interval, range는 값을 바꾸므로 그 뒤에)
    if (m.equip) {
        stats.hp *= 1 + equipEffect(m.equip, 'hp');
        stats.damage *= 1 + equipEffect(m.equip, 'damage');
        stats.range *= 1 + equipEffect(m.equip, 'range');
        stats.interval /= 1 + equipEffect(m.equip, 'speed');
    }
    // 마왕과 유물: 장비와 같은 방식으로 그 뒤에 곱한다. 값이 없으면(0, 1) 그대로다
    const mods = Game.mods;
    stats.hp *= 1 + mods.hp;
    stats.damage *= 1 + mods.damage;
    stats.range *= 1 + mods.range;
    stats.interval /= 1 + mods.attackSpeed;
    stats.respawn *= mods.respawn;
    // 오라(지원 몬스터): updateAuras가 매 프레임 정해 둔 값. 피해와 공격 속도만 바꾸고 최대 체력은 건드리지 않아
    // 오라 안팎을 오가도 체력 비율이 흔들리지 않는다. 팝업 미리보기처럼 aura가 없는 개체는 그대로다
    if (m.aura) {
        stats.damage *= 1 + m.aura.damage;
        stats.interval /= 1 + m.aura.attackSpeed;
    }
    const enrage = monsterEnrage(m);
    if (enrage) stats.interval *= enrage.intervalMul;
    return stats;
}

// 같은 몬스터의 kind 능력 전부(오라처럼 여러 개를 가질 수 있는 능력)
function monsterAbilities(type, kind) {
    return MONSTERS[type].abilities.filter(a => a.kind === kind);
}

// 오라: 쓰러지지 않은 몬스터의 aura 능력이 반경 안 몬스터(자신 포함)에게 닿는다. 같은 stat은 가장 큰 값 하나만 받는다.
// 결과는 m.aura = { heal, damage, attackSpeed }(없으면 0). Game.update가 몬스터를 움직이기 전에 한 번 부른다
function updateAuras(monsters) {
    const sources = [];
    for (const m of monsters) {
        if (m.down > 0) continue;
        for (const a of monsterAbilities(m.type, 'aura')) sources.push({ m, a });
    }
    for (const m of monsters) {
        const aura = { heal: 0, damage: 0, attackSpeed: 0 };
        if (!(m.down > 0)) {
            for (const { m: src, a } of sources) {
                if (distance(src.x, src.y, m.x, m.y) > a.radius * TILE) continue;
                aura[a.stat] = Math.max(aura[a.stat], a.value);
            }
        }
        m.aura = aura;
    }
}

// 체력 회복(재생, 오라, 흡혈). 최대 체력을 넘지 않고, 쓰러진 몬스터는 회복하지 않는다. 실제로 오른 양을 돌려준다
function healMonster(m, amount) {
    if (!(amount > 0) || m.down > 0 || !(m.maxHp > 0)) return 0;
    const before = m.hp;
    m.hp = Math.min(m.maxHp, m.hp + amount);
    return m.hp - before;
}

// 몬스터가 용사에게 실제로 준 피해(dealt)에 따라 붙는 능력: 흡혈
function monsterDealt(m, dealt) {
    if (!m || m.kind !== 'monster' || m.removed || !(dealt > 0)) return;
    const a = monsterAbility(m.type, 'lifesteal');
    if (!a) return;
    if (healMonster(m, dealt * a.ratio) > 0 && (m.healFx || 0) <= 0) {
        m.healFx = 0.5;
        Fx.anim('fx_lifesteal', m.x, m.y - 66, 120);
    }
}

// 가르기: 대상 둘레 radius칸 안의 다른 용사에게 피해의 ratio
function monsterCleave(m, target, damage) {
    const a = monsterAbility(m.type, 'cleave');
    if (!a) return;
    const c = heroWorld(target);
    Fx.anim('fx_cleave', c.x, c.y + 6, a.radius * TILE * 1.2);
    for (const h of Game.heroes.slice()) {
        if (h === target || h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(c.x, c.y, p.x, p.y) > a.radius * TILE) continue;
        monsterDealt(m, damageHero(h, damage * a.ratio, c.x, c.y, '#ffb36b', m));
    }
}

// 연쇄 번개: 맞은 용사(first)에서 jump칸 안의 가장 가까운 다음 용사로 count번 이어진다. 이미 맞은 용사는 건너뛴다
function monsterChain(m, first, damage) {
    const a = m && monsterAbility(m.type, 'chain');
    if (!a || !first) return;
    const hit = [first];
    let from = heroWorld(first);
    for (let i = 0; i < a.count; i++) {
        const next = nearestHero(from.x, from.y, a.jump * TILE, h => !hit.includes(h));
        if (!next) break;
        hit.push(next);
        const p = heroWorld(next);
        Fx.beam(from.x, from.y - 40, p.x, p.y - 40, '#7dffb4', 10, 0.22);
        Fx.beam(from.x, from.y - 40, p.x, p.y - 40, '#ffffff', 3, 0.16);
        Fx.anim('fx_hit_lightning', p.x, p.y - 60, 195);
        damageHero(next, damage * a.ratio, from.x, from.y, '#9dffc8', m);
        monsterHitHero(m.type, next, m);
        from = p;
    }
}

// 가시: 막는 몬스터가 용사에게 맞으면 받은 피해의 ratio를 그 용사에게 돌려준다(이 반사로 쓰러뜨리면 처치 경험치)
function monsterThorns(m, taken, attacker) {
    const a = monsterAbility(m.type, 'thorns');
    if (!a || !attacker || attacker.dead || !(taken > 0)) return;
    damageHero(attacker, taken * a.ratio, m.x, m.y, '#b8ff8a', m);
    if (m.thornsFx <= 0) {
        m.thornsFx = 0.8; // 자주 맞으므로 효과는 0.8초에 한 번
        Fx.anim('fx_thorns', m.x, m.y + MONSTER_FOOT, 240);
    }
}

// 불 장판: 광역 공격이 떨어진 자리에 남는다(Game.hazards). 0.5초마다 안의 용사에게 방어력을 무시한 피해
const HAZARD_TICK = 0.5;
function dropBurnGround(m, x, y) {
    const a = m && monsterAbility(m.type, 'burnGround');
    if (!a) return;
    Game.hazards.push({ kind: 'fire', x, y, radius: a.radius * TILE, dps: a.dps, life: a.duration, age: 0, tick: HAZARD_TICK, owner: m });
}

function updateHazard(z, dt) {
    z.age += dt;
    z.tick -= dt;
    if (z.tick > 1e-6) return;
    z.tick += HAZARD_TICK;
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(z.x, z.y, p.x, p.y) > z.radius) continue;
        damageHero(h, z.dps * HAZARD_TICK, z.x, z.y, '#ff9d4d', z.owner, true);
    }
}

// 광폭화 중이면 그 능력을, 아니면 null. 체력이 없는 몬스터(팝업 미리보기, 원거리)와 쓰러진 몬스터는 걸리지 않는다
function monsterEnrage(m) {
    const a = monsterAbility(m.type, 'enrage');
    if (!a || !(m.maxHp > 0) || m.down > 0) return null;
    return m.hp / m.maxHp <= a.below ? a : null;
}

// 몬스터의 공격이 용사에게 맞음: 맞은 뒤 걸리는 능력(저주, 화상, 빙결, 악몽)을 적용한다. 피해를 준 다음에 부른다.
// owner는 쏜 몬스터(화상 피해로 쓰러뜨리면 처치 경험치를 받는다. 없어도 된다)
function monsterHitHero(type, hero, owner) {
    if (hero.dead) return;
    const curse = monsterAbility(type, 'curseShot');
    if (curse) curseHero(hero, curse.duration, curse.takenMul);
    const burn = monsterAbility(type, 'burnShot');
    if (burn) burnHero(hero, burn.duration, burn.dps, owner);
    const slow = monsterAbility(type, 'slowShot');
    if (slow) slowHero(hero, slow.duration, slow.speedMul);
    const stun = monsterAbility(type, 'stunShot');
    // 보스는 걸리지 않는다(난수도 쓰지 않는다)
    if (stun && !hero.boss && Math.random() < stun.chance) {
        applyStun(hero, stun.duration);
        const p = heroWorld(hero);
        Fx.ring(p.x, p.y - 30, 90, '#ff9cf2', 0.35);
    }
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
        Fx.burst(p.x, p.y - 60, '#d9c8ff', 6, 200, 0.4, 5);
    }
    Fx.ring(m.x, m.y + MONSTER_FOOT, a.radius * TILE, '#d9c8ff', 0.45);
    Fx.ring(m.x, m.y + MONSTER_FOOT, a.radius * TILE * 0.6, '#9a6bff', 0.35);
    Fx.burst(m.x, m.y - 50, '#cdb8ff', 26, 520, 0.5, 6);
    Fx.addShake(8);
}

function createMonster(type, col, row) {
    const m = {
        kind: 'monster', type, blocks: monsterBlocks(type), col, row, x: monsterHomeX(type, col), y: monsterHomeY(type, row),
        homeX: monsterHomeX(type, col), homeY: monsterHomeY(type, row), rally: null, moving: false,
        tier: 1, branch: null, invested: MONSTERS[type].cost,
        rank: 0, xp: 0, rankUp: 0, // rank는 MONSTER_RANKS 번호, rankUp은 랭크가 오른 연출의 남은 초
        equip: null, // 낀 장비 id(EQUIPMENT)
        atk: 0.2, atkPose: 0, atkPoseMax: ATTACK_POSE_TIME, shot: null, anim: Math.random() * 4,
        dir: 'down', flash: 0, stun: 0, down: 0, target: null, hp: 0, maxHp: 0, armor: 0
    };
    // 발끝이 용사가 걷는 길 선에 오도록 칸 가운데 기준 위치를 발 높이만큼 올려 둔다
    if (m.blocks) {
        const r = nearestPathPoint(m.homeX, m.homeY);
        m.rally = { route: r.route, d: r.d, x: r.x, y: r.y - MONSTER_FOOT + 10 };
    }
    applyMonsterStats(m, true);
    return m;
}

// 강화, 랭크, 장비로 수치가 바뀌면 체력은 비율을 유지한 채 최대치만 바꾼다
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

// 장비를 끼우거나 뺀다(id 또는 null). 체력은 비율을 유지한다
function setMonsterEquip(m, id) {
    m.equip = id || null;
    applyMonsterStats(m);
}

// 다음 랭크까지 남은 경험치(처치 수). 최고 랭크면 0. 장비로 경험치가 소수가 되면 올려서 센다
function monsterXpToNext(m) {
    const next = MONSTER_RANKS[(m.rank || 0) + 1];
    return next ? Math.max(0, Math.ceil(next.xp - (m.xp || 0) - 1e-9)) : 0;
}

// 몬스터가 용사를 쓰러뜨림: 처치 경험치를 받고, 넘친 만큼 랭크를 올린다(체력은 비율을 유지한다).
// 합쳐지거나 팔려 사라진 몬스터의 투사체가 마무리했으면 아무도 받지 않는다
function monsterKilledHero(m, hero) {
    if (!m || m.kind !== 'monster' || m.removed) return;
    // 약탈(goldOnKill): 처치 골드와 따로 더 받는다
    const loot = monsterAbility(m.type, 'goldOnKill');
    if (loot) {
        Game.gold += loot.gold;
        const p = heroWorld(hero);
        Fx.anim('fx_gold', p.x, p.y - 75, 120);
        Fx.number(hero, p.x, p.y - 165, `+${loot.gold}G`, '#ffd76a', false);
    }
    const gain = hero.boss ? RANK_KILL_XP.boss : (hero.elite ? RANK_KILL_XP.elite : RANK_KILL_XP.normal);
    m.xp += gain * (1 + equipEffect(m.equip, 'xp')) * (1 + Game.mods.xp); // 장비, 마왕과 유물(처치 경험치)
    const before = m.rank;
    while (MONSTER_RANKS[m.rank + 1] && m.xp >= MONSTER_RANKS[m.rank + 1].xp) m.rank++;
    if (m.rank === before) return;
    applyMonsterStats(m);
    m.rankUp = 1.2;
    const top = m.rank === MONSTER_RANKS.length - 1;
    const color = MONSTER_RANKS[m.rank].color;
    const footY = m.y + MONSTER_FOOT;
    Fx.ring(m.x, footY, top ? 220 : 150, color, 0.5);
    Fx.ring(m.x, footY, top ? 120 : 80, '#ffffff', 0.35);
    Fx.rise(m.x, footY, color, top ? 50 : 26, 40, 0.9);
    Fx.anim(top ? 'fx_blastGold' : 'fx_blastCyan', m.x, footY - 70, top ? 520 : 380, 0.5);
    Fx.glow(m.x, footY - 60, top ? 280 : 180, top ? 'rgba(255,210,70,1)' : 'rgba(160,220,255,1)', 0.45);
    Fx.addShake(top ? 10 : 4);
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
    m.healFx = Math.max(0, (m.healFx || 0) - dt);
    m.thornsFx = Math.max(0, (m.thornsFx || 0) - dt);
    if (m.down > 0) {
        m.stun = 0; // 쓰러진 동안 걸린 정지가 다시 나온 뒤까지 남지 않게 한다
        m.down -= dt;
        if (m.down <= 0) reviveMonster(m);
        return;
    }
    // 재생과 오라 회복: 정지 중에도 아문다. 회복 효과는 1.5초에 한 번만 보여 화면을 덮지 않는다
    const regen = monsterAbility(m.type, 'regen');
    const perSec = (regen ? regen.perSec : 0) + (m.aura ? m.aura.heal : 0);
    if (healMonster(m, perSec * dt) > 0 && m.healFx <= 0) {
        m.healFx = 1.5;
        Fx.anim('fx_heal', m.x, m.y - 66, 120);
    }
    // 회복 오라를 내는 지원 몬스터: 다친 몬스터가 반경 안에 있으면 3초마다 바닥에 회복 물결
    m.auraFx = Math.max(0, (m.auraFx || 0) - dt);
    if (m.auraFx <= 0) {
        const heal = monsterAbilities(m.type, 'aura').find(a => a.stat === 'heal');
        if (heal && Game.monsters.some(o => o.blocks && !(o.down > 0) && o.hp < o.maxHp && distance(m.x, m.y, o.x, o.y) <= heal.radius * TILE)) {
            m.auraFx = 3;
            Fx.anim('fx_heal_aoe', m.x, m.y + MONSTER_FOOT, heal.radius * TILE * 2);
        }
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
    monsterDealt(m, damageHero(target, stats.damage, m.x, m.y, '#ffb76b', m));
    monsterHitHero(m.type, target, m);
    monsterCleave(m, target, stats.damage);
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
        const art = MONSTERS[m.type].art;
        Game.projectiles.push({
            kind: 'orb', x: hand.x, y: hand.y, tx: tp.x, ty: tp.y - 30, sx: hand.x, sy: hand.y, target,
            age: 0, time: clamp(distance(hand.x, hand.y, tp.x, tp.y) / 760, 0.25, 0.6),
            damage: stats.damage, splash: stats.splash * TILE, src: m.type, owner: m,
            shot: art.shot || null, impact: art.impact || null, glow: art.glow
        });
        Fx.glow(hand.x, hand.y, 75, `rgba(${art.shot ? art.glow : '190,110,255'},1)`, 0.18);
        Sfx.play('orb');
    } else {
        const art = MONSTERS[m.type].art;
        const curse = !!monsterAbility(m.type, 'curseShot'); // 저주 화살은 보랏빛 화살과 꼬리
        Game.projectiles.push({
            kind: 'arrow', x: hand.x, y: hand.y, target, damage: stats.damage, src: m.type, owner: m,
            speed: stats.heavy ? 2200 : 1300, big: stats.heavy, trail: 0, curse,
            shot: art.shot || (curse ? 'fx_shot_curse' : null), glow: art.glow
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
    Fx.anim('fx_blastViolet', ox, oy, 255, 0.28);
    Fx.beam(ox, oy, ox + dx * reach, oy + dy * reach, '#ffffff', 8, 0.14);
    Fx.addShake(4);
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        const along = (p.x - ox) * dx + (p.y - 30 - oy) * dy;
        if (along < 0 || along > reach) continue;
        const off = Math.abs((p.x - ox) * dy - (p.y - 30 - oy) * dx);
        if (off < 42) {
            monsterDealt(owner, damageHero(h, stats.damage, ox, oy, '#d7a8ff', owner));
            monsterHitHero(owner.type, h, owner);
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
    Fx.anim('fx_explosion', m.x, m.y - 66, 225, 0.4);
    Fx.burst(m.x, m.y - 80, '#d59560', 14, 320, 0.45, 7);
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
    Fx.ring(m.x, m.y + MONSTER_FOOT, 100, '#ffb76b', 0.35);
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
            monsterDealt(p.owner, damageHero(t, p.damage, p.x, p.y, p.big ? '#ff9d6b' : (p.curse ? '#d9a8ff' : '#ffe36b'), p.owner));
            // 타락 유닛의 화살에는 src와 owner가 없다
            if (p.src) monsterHitHero(p.src, t, p.owner);
            if (p.owner && !p.owner.removed) monsterChain(p.owner, t, p.damage);
            if (p.big) Fx.addShake(5);
            Sfx.play('hit');
            p.done = true;
            return;
        }
        p.x += (tx - p.x) / len * step;
        p.y += (ty - p.y) / len * step;
        p.trail += dt;
        if (p.trail > 0.02 && !p.shot) { // 시트 투사체(불덩이, 도끼 등)는 그림에 꼬리가 있다
            p.trail = 0;
            Fx.particles.push({
                x: p.x, y: p.y, vx: 0, vy: 0, life: 0.14, max: 0.14,
                size: p.big || p.curse ? 6 : 4, color: p.big ? '#ffb07a' : (p.curse ? '#b05cff' : '#b89dff'), gravity: 0
            });
        }
    } else {
        p.age += dt;
        const t = clamp(p.age / p.time, 0, 1);
        const px = p.x;
        const py = p.y;
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t - Math.sin(t * Math.PI) * 90;
        p.angle = Math.atan2(p.y - py, p.x - px); // 시트 투사체를 날아가는 방향으로 돌린다
        const rgb = p.glow && p.shot ? p.glow : '169,107,255';
        if (Math.random() < 0.7) {
            Fx.particles.push({
                x: p.x + randRange(-6, 6), y: p.y + randRange(-6, 6), vx: 0, vy: -20,
                life: 0.25, max: 0.25, size: 6, color: `rgb(${rgb})`, gravity: 0
            });
        }
        if (t >= 1) {
            const owner = p.owner && !p.owner.removed ? p.owner : null;
            splashDamage(p.tx, p.ty + 30, p.splash, p.damage, '#d7a8ff', h => monsterHitHero(p.src, h, owner), owner,
                dealt => monsterDealt(owner, dealt));
            // 연쇄 번개는 노린 용사(쓰러졌으면 그 자리에서 가장 가까운 용사)에서 시작한다
            const first = p.target && !p.target.dead ? p.target : nearestHero(p.tx, p.ty + 30, p.splash);
            if (owner) monsterChain(owner, first, p.damage);
            dropBurnGround(owner, p.tx, p.ty + 30);
            Fx.ring(p.tx, p.ty + 30, p.splash, `rgb(${rgb})`, 0.3);
            Fx.anim(p.impact || 'fx_blastViolet', p.tx, p.ty + 10, p.splash * 2.8, 0.42);
            Fx.glow(p.tx, p.ty, p.splash * 1.5, `rgba(${rgb},1)`, 0.24);
            Fx.burst(p.tx, p.ty, `rgb(${rgb})`, 22, 420, 0.42, 7);
            Fx.addShake(6);
            Sfx.play('blast');
            p.done = true;
        }
    }
}
