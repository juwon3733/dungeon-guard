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
        hp: base.hp || 0, damage: base.damage, interval: base.interval, range: monsterReach(m.type), splash: base.splash || 0,
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
    if (m.equip || m.equip2) {
        const power = 1 + Game.mods.equipPower; // 유물: 장비 효과
        stats.hp *= 1 + monsterEquip(m, 'hp') * power;
        stats.damage *= 1 + monsterEquip(m, 'damage') * power;
        stats.range *= 1 + monsterEquip(m, 'range') * power;
        stats.interval /= 1 + monsterEquip(m, 'speed') * power;
    }
    // 마왕과 유물: 장비와 같은 방식으로 그 뒤에 곱한다. 값이 없으면(0, 1) 그대로다
    const mods = Game.mods;
    stats.hp *= 1 + mods.hp;
    stats.damage *= (1 + mods.damage) * (1 + Game.relicDamage(m));
    stats.damage *= 1 + FAMILY_UPGRADE.damagePer * Game.familyLevel(def.family); // 종족 강화
    stats.range *= 1 + mods.range;
    stats.interval /= (1 + mods.attackSpeed) * (Game.earlyBoost ? 1 + mods.earlyAttackSpeed : 1) * (1 + clockHaste()); // clockHaste: 시계탑의 마왕 가속
    stats.armor = 1 - (1 - stats.armor) * (1 - mods.monsterArmor);
    stats.respawn *= mods.respawn;
    // 오라(지원 몬스터): updateAuras가 매 프레임 정해 둔 값. 피해와 공격 속도만 바꾸고 최대 체력은 건드리지 않아
    // 오라 안팎을 오가도 체력 비율이 흔들리지 않는다. 팝업 미리보기처럼 aura가 없는 개체는 그대로다
    if (m.aura) {
        stats.damage *= 1 + m.aura.damage;
        stats.interval /= 1 + m.aura.attackSpeed;
    }
    const enrage = monsterEnrage(m);
    if (enrage) stats.interval *= enrage.intervalMul;
    // 강화 제단 위
    if (onAltar(m.type, m.col, m.row)) {
        stats.damage *= 1 + MAP_RULES.altarDamage;
        stats.range += MAP_RULES.altarRange;
    }
    // 격분: 처치 뒤 잠시 빨라진다
    if (m.frenzyT > 0) stats.interval *= m.frenzyMul;
    if (m.slowT > 0) stats.interval *= m.slowMul || 1; // 마법사 감속
    // 유물: 근접 몬스터
    if (MONSTER_ROLES[def.role].melee) {
        stats.damage *= 1 + mods.meleeDamage;
        stats.range += mods.meleeRange;
        stats.interval /= 1 + mods.meleeSpeed; // 망자의 뿔피리
    }
    // 유물: 오크 공격 속도(전쟁 함성), 1칸 몬스터 공격 속도(작은 거인)
    if (def.family === 'orc') stats.interval /= 1 + mods.orcSpeed;
    if (mods.smallSpeed && monsterCells(m.type).join() === '1,1') stats.interval /= 1 + mods.smallSpeed;
    // 스킬 buff(전쟁의 함성 등). 최대 체력은 건드리지 않는다
    if (m.buffT > 0 && m.buff) {
        stats.damage *= 1 + (m.buff.damage || 0);
        stats.interval /= 1 + (m.buff.speed || 0);
        stats.armor = 1 - (1 - stats.armor) * (1 - (m.buff.armor || 0));
    }
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
    if (z.kind === 'puddle') { updatePuddle(z, dt); return; }
    if (z.kind === 'trap') { updateTrap(z, dt); return; }
    if (z.kind === 'vortex') { updateVortex(z, dt); return; }
    z.age += dt;
    z.tick -= dt;
    if (z.tick > 1e-6) return;
    z.tick += HAZARD_TICK;
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(z.x, z.y, p.x, p.y) > z.radius) continue;
        if (z.kind === 'poison') poisonHero(h, 1.5, z.dps, null); // 역병 구름: 피해는 독으로
        else damageHero(h, z.dps * HAZARD_TICK, z.x, z.y, '#ff9d4d', z.owner, true);
    }
}

// 웅덩이(공격 모양 puddle): 0.5초마다 안의 용사를 느리게 하고(slow) 방어력을 줄인다(armorMul, damageHero가 읽는다). 겹치지 않고 시간만 채운다
function updatePuddle(z, dt) {
    z.age += dt;
    z.tick -= dt;
    if (z.tick > 1e-6) return;
    z.tick += HAZARD_TICK;
    const keep = HAZARD_TICK + 0.2;
    for (const h of heroesInCircle(z.x, z.y, z.radius)) {
        h.slowMul = h.slow > 0 ? Math.min(h.slowMul, z.slow) : z.slow;
        h.slow = Math.max(h.slow, keep);
        if (z.armorMul < 1) {
            const on = h.shredUntil > Game.time; // 판 시간으로 끝을 잰다(용사 갱신을 건드리지 않는다)
            h.shredMul = on ? Math.min(h.shredMul, z.armorMul) : z.armorMul;
            h.shredUntil = Math.max(on ? h.shredUntil : 0, Game.time + keep);
        }
    }
}

// 덫(공격 모양 trap): arm초 뒤부터 용사가 trigger 안에 들어오면 radius 안을 때리고 사라진다
function updateTrap(z, dt) {
    z.age += dt;
    if (z.age < z.arm) return;
    const near = heroesInCircle(z.x, z.y, z.trigger);
    if (!near.length) return;
    const hits = strikeArea(z, z.x, z.y, z.radius, z.damage);
    strikeChain(z, hits.includes(near[0]) ? near[0] : hits[0], z.damage);
    const owner = liveOwner(z);
    if (owner) dropBurnGround(owner, z.x, z.y);
    attackImpact(z.look, z.src, z.x, z.y, z.radius, z.tier);
    Fx.addShake(4);
    Sfx.play('blast');
    z.age = z.life;
}

// 소용돌이(공격 모양 vortex): 보스가 아닌 용사 가운데 지나친 용사를 길 뒤로 끌어 가운데에 붙잡고, tick초마다 피해
function updateVortex(z, dt) {
    z.age += dt;
    for (const h of heroesInCircle(z.x, z.y, z.radius)) {
        if (h.boss) continue;
        const w = heroWorld(h);
        const back = routePoint(h, -6);
        if (distance(back.x, back.y, z.x, z.y) < distance(w.x, w.y, z.x, z.y) - 0.5) h.d = Math.max(0, h.d - z.pull * dt);
    }
    z.tick -= dt;
    if (z.tick > 1e-6) return;
    z.tick += z.every;
    const owner = liveOwner(z);
    for (const h of heroesInCircle(z.x, z.y, z.radius)) monsterDealt(owner, damageHero(h, z.damage, z.x, z.y, z.color, owner));
}

// 광폭화 중이면 그 능력을, 아니면 null. 체력이 없는 몬스터(팝업 미리보기, 원거리)와 쓰러진 몬스터는 걸리지 않는다
function monsterEnrage(m) {
    const a = monsterAbility(m.type, 'enrage');
    if (!a || !(m.maxHp > 0) || m.down > 0) return null;
    return m.hp / m.maxHp <= a.below ? a : null;
}

// 몬스터의 공격이 용사에게 맞음: 맞은 뒤 걸리는 능력(저주, 화상, 빙결, 악몽)을 적용한다. 피해를 준 다음에 부른다.
// owner는 쏜 몬스터(화상 피해로 쓰러뜨리면 처치 경험치를 받는다. 없어도 된다)
// 몬스터 능력에 맞는 명중 소리: 불, 얼음, 번개, 저주, 기절. 없으면 기본 소리(fallback)
// 공격할 대상 쪽으로 돈다. 공격 그림이 옆모습뿐이면 위아래 대상도 왼쪽이나 오른쪽을 보고 친다(그림이 정면과 옆을 오가며 튀지 않게)
function faceTarget(m, x, y) {
    const dirs = MONSTERS[m.type].art.anim.attack.dirs || [];
    m.dir = dirs.includes('south') || dirs.includes('north') ? dirFromVector(x - m.x, y - m.y) : (x >= m.x ? 'right' : 'left');
}

function monsterHitSfx(type, fallback) {
    const kinds = (MONSTERS[type] && MONSTERS[type].abilities || []).map(a => a.kind);
    if (kinds.includes('burnShot') || kinds.includes('burnGround')) return 'hitFire';
    if (kinds.includes('slowShot')) return 'hitIce';
    if (kinds.includes('chain')) return 'hitLightning';
    if (kinds.includes('curseShot')) return 'hitCurse';
    if (kinds.includes('stunShot') || kinds.includes('cleave')) return 'hitHeavy';
    return fallback;
}

function monsterHitHero(type, hero, owner) {
    if (hero.dead) return;
    // 장비의 적중 효과
    for (const id of owner ? [owner.equip, owner.equip2] : []) {
        const eq = id && EQUIPMENT[id].onHit;
        if (!eq) continue;
        if (eq.curse) curseHero(hero, eq.curse[0], eq.curse[1]);
        if (eq.burn) burnHero(hero, eq.burn[0], eq.burn[1], owner);
        if (eq.slow) slowHero(hero, eq.slow[0], eq.slow[1]);
    }
    relicOnHit(hero, owner); // 유물: 얼음 송곳니, 지옥불 인장, 정령의 구슬
    const curse = monsterAbility(type, 'curseShot');
    if (curse) curseHero(hero, curse.duration, curse.takenMul);
    const burn = monsterAbility(type, 'burnShot');
    if (burn) burnHero(hero, burn.duration, burn.dps, owner);
    const slow = monsterAbility(type, 'slowShot');
    if (slow) slowHero(hero, slow.duration, slow.speedMul);
    // 역병의 군주: 몬스터에게 맞으면 독(공격력의 일부를 초마다)
    const plague = Game.lordPassive('plague');
    if (plague && owner && owner.kind === 'monster' && !owner.removed) poisonHero(hero, plague.duration, monsterStats(owner).damage * plague.ratio, owner);
    chainOnHit(hero); // 사슬의 군주: 확률로 묶음(combat.js)
    if (Game.power('slowHit') && !hero.dead && rng('battle') < COMBAT_RULES.clock.slowHitChance) slowHero(hero, 1.5, 0.7); // 시계탑: 모래 바람
    const stun = monsterAbility(type, 'stunShot');
    // 보스는 걸리지 않는다(난수도 쓰지 않는다)
    if (stun && !hero.boss && rng('battle') < stun.chance) {
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

// ----- 특수 스킬(표: SKILL_KINDS) -----
function skillHeroes(m, reach) {
    return Game.heroes.filter(h => {
        if (h.dead || h.waiting) return false;
        if (reach === 'map') return true;
        const p = heroWorld(h);
        return distance(m.x, m.y, p.x, p.y) <= reach * TILE;
    });
}

// 스킬 효과를 용사 한 명에게. stun은 보스 제외
function skillAfflict(m, s, stats, h) {
    if (h.dead) return;
    if (s.stun && !h.boss) applyStun(h, s.stun);
    if (s.slow) slowHero(h, s.slow, SKILL_SLOW_MUL);
    if (s.curse) curseHero(h, s.curse, SKILL_CURSE_MUL);
    if (s.burn) burnHero(h, s.burn, stats.damage * SKILL_BURN_DPS, m);
}

function skillHit(m, s, stats, h, color) {
    monsterDealt(m, damageHero(h, stats.damage * s.mul, m.x, m.y, color, m));
    skillAfflict(m, s, stats, h);
}

// 스킬을 쓸 수 있으면 쓰고 true. 맞을 대상이 없으면 false(대기가 0에서 기다린다)
function castMonsterSkill(m, s, stats) {
    const art = MONSTERS[m.type].art;
    const color = `rgb(${art.glow})`;
    switch (s.kind) {
        case 'nova': {
            const list = skillHeroes(m, s.radius);
            if (!list.length) return false;
            for (const h of list.slice()) skillHit(m, s, stats, h, color);
            if (s.radius === 'map') Fx.anim('fx_adv_doomMelody_requiem', m.x, m.y - 40, 900, 0.75);
            else {
                Fx.ring(m.x, m.y, s.radius * TILE, color, 0.5);
                Fx.anim('fx_blastViolet', m.x, m.y - 30, s.radius * TILE * 2, 0.5);
            }
            break;
        }
        case 'meteor': {
            const t = foremostHero(m.x, m.y, s.reach * TILE);
            if (!t) return false;
            const c = heroWorld(t);
            for (const h of Game.heroes.slice()) {
                if (h.dead || h.waiting) continue;
                const p = heroWorld(h);
                if (distance(c.x, c.y, p.x, p.y) <= s.radius * TILE) skillHit(m, s, stats, h, color);
            }
            Fx.anim('fx_explosion', c.x, c.y - 40, s.radius * TILE * 2.4, 0.5);
            Fx.ring(c.x, c.y, s.radius * TILE, color, 0.45);
            break;
        }
        case 'barrage': {
            const list = skillHeroes(m, s.reach);
            if (!list.length) return false;
            for (let i = 0; i < s.count; i++) {
                const alive = list.filter(h => !h.dead);
                if (!alive.length) break;
                const h = rngItem('battle', alive);
                const p = heroWorld(h);
                if (i < 8) Fx.anim('fx_hit_lightning', p.x, p.y - 60, 240, 0.4);
                skillHit(m, s, stats, h, color);
            }
            break;
        }
        case 'harvest': {
            const list = skillHeroes(m, s.reach).filter(h => !h.boss && h.hp / h.maxHp <= s.below);
            if (!list.length) return false;
            for (const h of list) {
                const p = heroWorld(h);
                Fx.anim('fx_cleave', p.x, p.y - 20, 220, 0.4);
                damageHero(h, h.hp + 1, m.x, m.y, color, m, true);
                if (s.gold) { Game.gold += s.gold; Fx.coin(p.x, p.y - 60, s.gold); }
            }
            break;
        }
        case 'timeStop': {
            const list = skillHeroes(m, 'map');
            if (!list.length) return false;
            for (const h of list) {
                if (h.boss) slowHero(h, s.duration, SKILL_SLOW_MUL);
                else applyStun(h, s.duration);
            }
            Fx.anim('fx_blastCyan', m.x, m.y - 60, 900, 0.6);
            break;
        }
        case 'push': {
            const list = skillHeroes(m, s.radius);
            if (!list.length) return false;
            for (const h of list.slice()) {
                if (!h.boss) { h.d = Math.max(0, h.d - s.tiles * TILE); h.blocker = null; }
                skillHit(m, s, stats, h, color);
            }
            Fx.anim('fx_blastCyan', m.x, m.y - 60, 900, 0.6);
            break;
        }
        case 'buff': {
            if (!skillHeroes(m, 'map').length) return false;
            for (const o of Game.monsters) {
                if (o.removed || o.down > 0) continue;
                o.buffT = s.duration;
                o.buff = s;
                Fx.ring(o.x, o.y, 70, color, 0.35);
            }
            Fx.anim('fx_blastGold', m.x, m.y - 60, 600, 0.5);
            break;
        }
        case 'heal': {
            const hurt = Game.monsters.filter(o => !o.removed && (o.down > 0 ? s.revive : o.blocks && o.hp < o.maxHp));
            if (!hurt.length) return false;
            for (const o of hurt) {
                if (o.down > 0) reviveMonster(o);
                else healMonster(o, o.maxHp * s.ratio);
                Fx.anim('fx_heal', o.x, o.y - 66, 150);
            }
            Fx.anim('fx_heal_aoe', m.x, m.y, 500);
            break;
        }
        default: return false;
    }
    m.atkPose = m.atkPoseMax = ATTACK_POSE_TIME;
    Fx.say(m.x, m.y - art.barY, s.name, 1.2);
    Fx.addShake(5);
    Sfx.play('upgrade');
    return true;
}

// 기술 동작을 재생하는 시간(일반 공격 ATTACK_POSE_TIME보다 길다)
const SKILL_POSE_TIME = 0.75;

// 쓰러졌거나 정지 중에는 부르지 않는다
function updateMonsterSkills(m, dt) {
    const skills = MONSTERS[m.type].skills;
    if (!skills) return;
    if (!m.skillCd) m.skillCd = skills.map(s => s.cooldown * 0.5); // 첫 사용은 대기의 절반 뒤
    const stats = monsterStats(m);
    skills.forEach((s, i) => {
        m.skillCd[i] -= dt;
        if (m.skillCd[i] <= 0) {
            if (castMonsterSkill(m, s, stats)) {
                m.skillCd[i] = s.cooldown;
                // 기술마다 동작(art.anim.skill0, skill1)이 있으면 그것을 일반 공격보다 길게 재생한다
                m.skillPose = i;
                if (MONSTERS[m.type].art.anim['skill' + i]) m.atkPose = m.atkPoseMax = SKILL_POSE_TIME;
            } else m.skillCd[i] = 0;
        }
    });
}

function createMonster(type, col, row) {
    const m = {
        kind: 'monster', uid: Game.nextUid++, type, blocks: monsterBlocks(type), col, row, x: monsterHomeX(type, col), y: monsterHomeY(type, row),
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

// 둘째 장비 칸(유물 장비 먹는 괴물)
function setMonsterEquip2(m, id) {
    m.equip2 = id || null;
    applyMonsterStats(m);
}


// 몬스터가 용사를 쓰러뜨림: 처치 경험치를 받고, 넘친 만큼 랭크를 올린다(체력은 비율을 유지한다).
// 합쳐지거나 팔려 사라진 몬스터의 투사체가 마무리했으면 아무도 받지 않는다
function monsterKilledHero(m, hero) {
    // 격분: 처치하면 잠시 빨라진다
    if (m && m.kind === 'monster' && !m.removed) {
        const fr = monsterAbility(m.type, 'frenzy');
        if (fr) { m.frenzyT = fr.duration; m.frenzyMul = fr.intervalMul; }
    }
    if (!m || m.kind !== 'monster' || m.removed) return;
    // 약탈(goldOnKill): 처치 골드와 따로 더 받는다
    const loot = monsterAbility(m.type, 'goldOnKill');
    if (loot) {
        Game.gold += loot.gold;
        const p = heroWorld(hero);
        Fx.anim('fx_gold', p.x, p.y - 75, 120);
        Fx.number(hero, p.x, p.y - 165, `+${loot.gold}G`, '#ffd76a', false);
    }
    m.kills = (m.kills || 0) + 1; // 처치 수(랭크는 골드로 돌린다)
}

// 랭크가 바뀐 연출(골드로 돌렸을 때). 오르면 고리와 글자, 내리면 조용히
function showRankChange(m, before) {
    if (m.rank <= before) return;
    m.rankUp = 1.2;
    const top = m.rank >= rankIndex('S');
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
    m.buffT = Math.max(0, (m.buffT || 0) - dt);
    m.frenzyT = Math.max(0, (m.frenzyT || 0) - dt);
    m.slowT = Math.max(0, (m.slowT || 0) - dt);
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
    updateMonsterSkills(m, dt);
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
    faceTarget(m, tp.x, tp.y);
    m.atk -= dt;
    if (m.atk > 0) return;
    m.atk = stats.interval;
    m.atkPose = m.atkPoseMax = Math.min(ATTACK_POSE_TIME, stats.interval);
    m.skillPose = -1;
    monsterDealt(m, damageHero(target, stats.damage, m.x, m.y, '#ffb76b', m));
    monsterHitHero(m.type, target, m);
    monsterCleave(m, target, stats.damage);
    Sfx.play(monsterHitSfx(m.type, 'slash'));
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
    faceTarget(m, tp.x, tp.y);
    m.atk = stats.interval;
    m.atkPose = m.atkPoseMax = Math.min(ATTACK_POSE_TIME, stats.interval);
    m.skillPose = -1;
    m.shot = { target, t: m.atkPoseMax * MONSTER_RELEASE };
}

// ----- 공격 모양(ATTACK_KINDS, MONSTER_ATTACKS) -----
// 모든 공격은 Game.projectiles에 개체(kind 'atk') 하나 이상을 남긴다. 날아가는 공격은 개체가 움직이며 때리고,
// 바로 맞는 공격은 쏜 순간 때린 뒤 개체는 그림으로만 남는다(그리기는 Render.drawAttack, 색과 모양은 ATTACK_LOOKS).
// 판 결과를 바꾸는 계산은 rng와 Math.sqrt만 쓴다(입력 재생). 삼각함수와 Math.random은 그림에만 쓴다
const ATTACK_HIT_COLOR = '#ffd26a';
const ATTACK_MAX_LIFE = 2.5; // 날아가는 공격이 대상을 잃고 떠돌지 않게 하는 상한(초)
// 바로 맞는 근접 모양(대상 고르기만 다르다). 원거리 몬스터가 쓰면 한 명만 때린다
const MELEE_ATTACKS = ['claw', 'spikes', 'tentacle', 'thrust', 'slam', 'sweep', 'whirl', 'smite'];

function liveOwner(p) { return p.owner && !p.owner.removed ? p.owner : null; }
function attackLookColor(look) {
    const L = typeof ATTACK_LOOKS !== 'undefined' && ATTACK_LOOKS[look];
    return L ? L.hit : ATTACK_HIT_COLOR;
}
function liveHeroList() { return Game.heroes.filter(h => !h.dead && !h.waiting); }
// 화살이 노리는 몸 높이
function heroBody(h) {
    const w = heroWorld(h);
    return { x: w.x, y: w.y - (h.boss ? 90 : 46) };
}
function unitVec(ax, ay, bx, by) {
    const len = distance(ax, ay, bx, by) || 1;
    return { dx: (bx - ax) / len, dy: (by - ay) / len, len };
}
// 길을 따라 k px 떨어진 자리(용사 h의 길과 줄)
function routePoint(h, k) { return heroWorld({ d: h.d + k, route: h.route, lane: h.lane }); }
// t초 동안 용사가 길을 따라 갈 거리(멈춰 있거나 붙잡혀 있으면 0)와 그 발끝 자리
function heroLead(h, t) {
    const moving = !(h.stun > 0) && !h.blocker && !(h.bound > 0);
    return moving ? (h.speed || 0) * (h.slow > 0 ? h.slowMul : 1) * t : 0;
}
function heroAhead(h, t) { return routePoint(h, heroLead(h, t)); }

// 선분(시작 o, 방향 v, 길이 len, 폭 width px) 위의 용사를 가까운 순으로. body면 몸 높이, 아니면 발끝으로 잰다
function heroesOnLine(ox, oy, v, len, width, body) {
    const list = [];
    for (const h of liveHeroList()) {
        const p = body ? heroBody(h) : heroWorld(h);
        const along = (p.x - ox) * v.dx + (p.y - oy) * v.dy;
        if (along < -width || along > len + width * 0.5) continue;
        if (Math.abs((p.x - ox) * v.dy - (p.y - oy) * v.dx) <= width) list.push({ h, along });
    }
    return list.sort((a, b) => a.along - b.along).map(o => o.h);
}
// 부채꼴: 시작 o에서 반지름 len 안, 방향 v와 이루는 각의 코사인이 cos 이상(발끝)
function heroesInCone(ox, oy, v, len, cos) {
    return liveHeroList().filter(h => {
        const p = heroWorld(h);
        const d = distance(ox, oy, p.x, p.y);
        if (d > len) return false;
        return d < 1 || ((p.x - ox) * v.dx + (p.y - oy) * v.dy) / d >= cos;
    });
}
function heroesInCircle(x, y, r) {
    return liveHeroList().filter(h => {
        const p = heroWorld(h);
        return distance(x, y, p.x, p.y) <= r;
    });
}
// 대상 수 제한: 첫 대상을 먼저, 나머지는 왕좌에 가까운 순으로 cap명까지
function capTargets(first, list, cap) {
    const rest = list.filter(h => h !== first).sort((a, b) => remainingDistance(a) - remainingDistance(b));
    return (first && !first.dead ? [first, ...rest] : rest).slice(0, cap);
}
// 사거리 안 용사를 앞선 순으로(첫 대상 먼저)
function rangeTargets(m, stats, first) {
    return capTargets(first, heroesInCircle(m.x, m.y, stats.range * TILE), Infinity);
}

// 공격 개체: 그림(look)과 쏜 몬스터. big은 2칸 넘는 몬스터(그림을 키운다), tier는 등급 순서(높을수록 화려하다)
function pushAttack(m, a, atk, extra) {
    const def = MONSTERS[m.type];
    const p = Object.assign({
        kind: 'atk', atk, look: a.look || atk, src: m.type, owner: m, age: 0, life: 0.4,
        color: attackLookColor(a.look), big: Math.max(...monsterCells(m.type)) > 1, tier: GRADE_ORDER.indexOf(def.grade), seed: Math.random() * 100
    }, extra);
    Game.projectiles.push(p);
    return p;
}

// 공격 하나가 용사 한 명을 맞힘: 피해, 흡혈, 맞으면 걸리는 능력. p는 공격 개체(src, owner, color)
function strikeHero(p, h, damage, fx, fy) {
    if (!h || h.dead) return 0;
    const owner = liveOwner(p);
    const dealt = damageHero(h, damage, fx, fy, p.color || ATTACK_HIT_COLOR, owner);
    monsterDealt(owner, dealt);
    monsterHitHero(p.src, h, owner);
    return dealt;
}
function strikeChain(p, first, damage) {
    const owner = liveOwner(p);
    if (owner && first) monsterChain(owner, first, damage);
}
// 자리 (x, y) 반경 안 용사를 모두 맞힌다(광역)
function strikeArea(p, x, y, r, damage) {
    const hits = heroesInCircle(x, y, r);
    for (const h of hits) strikeHero(p, h, damage, x, y);
    return hits;
}
// 그림만 남는 터짐(덫, 던진 것이 떨어진 자리)
function attackImpact(look, src, x, y, r, tier) {
    Game.projectiles.push({ kind: 'atk', atk: 'impact', look, src, x, y, r, tier: tier || 0, age: 0, life: 0.45, seed: Math.random() * 100 });
}

// 근접 모양: 첫 대상(first)을 기준으로 모양 안 용사를 stats.block명까지(원거리 몬스터가 쓰면 한 명) 바로 때린다
function meleeAttack(m, stats, first, a) {
    const cap = Math.max(1, stats.block || 0);
    const reach = stats.range * TILE;
    const foot = { x: m.x, y: m.y + MONSTER_FOOT };
    const f = heroWorld(first);
    const v = unitVec(foot.x, foot.y, f.x, f.y);
    const size = Math.max(...monsterCells(m.type));
    let list;
    if (a.kind === 'thrust') list = heroesOnLine(foot.x, foot.y, v, reach + a.extra * TILE, a.width * TILE * (1 + (size - 1) * 0.25), false);
    else if (a.kind === 'slam') list = heroesInCircle(f.x, f.y, a.radius * TILE * (1 + (size - 1) * 0.3));
    else if (a.kind === 'sweep') list = heroesInCone(foot.x, foot.y, v, reach, a.cos);
    else list = heroesInCircle(foot.x, foot.y, reach);
    const targets = capTargets(first, list, cap);
    const p = pushAttack(m, a, a.kind, {
        ox: foot.x, oy: foot.y, tx: f.x, ty: f.y, v, cos: a.cos, reach: a.kind === 'thrust' ? reach + a.extra * TILE : reach, size,
        radius: a.kind === 'slam' ? a.radius * TILE * (1 + (size - 1) * 0.3) : (a.radius || 0) * TILE,
        hits: targets.map(h => { const w = heroWorld(h); return { x: w.x, y: w.y, boss: !!h.boss }; }),
        life: a.kind === 'whirl' || a.kind === 'smite' ? 0.5 : 0.4
    });
    for (const h of targets) strikeHero(p, h, stats.damage, m.x, m.y);
    // 천벌: 번개가 떨어진 둘레의 다른 용사도(한 번씩)
    if (a.kind === 'smite') {
        const done = targets.slice();
        for (const t of p.hits) {
            for (const h of heroesInCircle(t.x, t.y, a.radius * TILE)) {
                if (done.includes(h)) continue;
                done.push(h);
                strikeHero(p, h, stats.damage * a.ratio, t.x, t.y);
            }
        }
        Fx.addShake(4);
    }
    monsterCleave(m, first, stats.damage);
    if (a.kind === 'slam' || a.kind === 'tentacle') Fx.addShake(size > 1 ? 5 : 2);
    Sfx.play(monsterHitSfx(m.type, a.kind === 'slam' || a.kind === 'spikes' ? 'hitHeavy' : 'slash'));
}

// 원거리 모양(그리고 근접이 쓰는 숨결, 땅 가르기, 파동). (몬스터, 수치, 대상, 공격 값, 근접인가)
const ATTACKS = {
    pierce(m, s, target, a) {
        const o = monsterHand(m);
        const aim = heroAhead(target, 0.12);
        const v = unitVec(o.x, o.y, aim.x, aim.y - (target.boss ? 90 : 46));
        pushAttack(m, a, 'pierce', { x: o.x, y: o.y, sx: o.x, sy: o.y, v, speed: a.speed || 1500, dist: 0, max: s.range * TILE + TILE, damage: s.damage, ratio: a.ratio, cap: a.max, hit: [], life: ATTACK_MAX_LIFE });
        Sfx.play('arrow');
    },
    boomerang(m, s, target, a) {
        const o = monsterHand(m);
        const aim = heroAhead(target, 0.15);
        const v = unitVec(o.x, o.y, aim.x, aim.y - (target.boss ? 90 : 46));
        const len = Math.min(v.len + TILE * 0.8, s.range * TILE + TILE);
        const sheet = MONSTERS[m.type].art.shot; // 시트 그림(도끼, 원반)이 있으면 돌려 그린다. 'bolt'은 시트가 아니다
        const shot = sheet && sheet !== 'bolt' ? sheet : null;
        pushAttack(m, a, 'boomerang', {
            x: o.x, y: o.y, sx: o.x, sy: o.y, ex: o.x + v.dx * len, ey: o.y + v.dy * len, nx: -v.dy, ny: v.dx, bow: TILE * 0.35,
            s: 0, back: false, time: len / (shot ? 1100 : 650), damage: s.damage * a.ratio, base: s.damage, max: a.max, hitOut: [], hitBack: [], chained: false,
            shot, life: ATTACK_MAX_LIFE
        });
        Sfx.play('arrow');
    },
    stream(m, s, target, a) {
        const o = monsterHand(m);
        const b = heroBody(target);
        const v = unitVec(o.x, o.y, b.x, b.y);
        const len = s.range * TILE + TILE * 0.5;
        const hits = capTargets(target, heroesOnLine(o.x, o.y, v, len, a.width * TILE, true), a.count);
        const far = hits.reduce((d, h) => { const q = heroBody(h); return Math.max(d, (q.x - o.x) * v.dx + (q.y - o.y) * v.dy); }, v.len);
        const p = pushAttack(m, a, 'stream', { ox: o.x, oy: o.y, v, len: far + 24, life: 0.5, hits: [] });
        hits.forEach((h, i) => {
            strikeHero(p, h, s.damage * (i ? a.ratio : 1), o.x, o.y);
            if (!h.dead && !h.boss && a.push > 0) {
                h.d = Math.max(0, h.d - a.push * TILE);
                h.blocker = null;
            }
            const w = heroBody(h);
            p.hits.push({ x: w.x, y: w.y });
        });
        strikeChain(p, target, s.damage);
        if (a.puddle) {
            const f = heroWorld(target);
            dropPuddle(m, Object.assign({}, ATTACK_KINDS.puddle, { look: a.look }), f.x, f.y);
        }
        Sfx.play('hitIce');
    },
    puddle(m, s, target, a) { lobAttack(m, s, target, a, 'puddle'); },
    vortex(m, s, target, a) { lobAttack(m, s, target, a, 'vortex'); },
    trap(m, s, target, a) {
        // 대상 앞 길(0.4칸)에 놓는다. 몬스터당 max개, 넘으면 가장 오래된 덫이 사라진다
        const mine = Game.hazards.filter(z => z.kind === 'trap' && z.owner === m && z.age < z.life);
        if (mine.length >= a.max) mine[0].age = mine[0].life;
        const spot = routePoint(target, TILE * 0.4);
        const o = monsterHand(m);
        pushAttack(m, a, 'lob', { x: o.x, y: o.y, sx: o.x, sy: o.y, tx: spot.x, ty: spot.y, target: null, time: 0.32, arc: 80, then: 'trap', a, damage: s.damage * a.ratio, splash: (s.splash || a.radius) * TILE, life: ATTACK_MAX_LIFE });
        Sfx.play('orb');
    },
    drop(m, s, target, a, melee) {
        // 떨어질 때 용사가 설 자리. 여럿이면 길을 따라 앞뒤로 벌린다
        const lead = heroLead(target, a.delay);
        const pts = [];
        for (let i = 0; i < a.count; i++) {
            const q = routePoint(target, lead + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * a.spread * TILE);
            pts.push({ x: q.x, y: q.y });
        }
        pushAttack(m, a, 'drop', { pts, delay: a.delay, radius: (s.splash || a.radius) * TILE, damage: s.damage * a.ratio, cap: melee ? Math.max(1, s.block) : Infinity, fired: false, life: a.delay + 0.5 });
        Sfx.play('orb');
    },
    beam(m, s, target, a) {
        const o = monsterHand(m);
        const b = heroBody(target);
        const v = unitVec(o.x, o.y, b.x, b.y);
        const f = heroWorld(target);
        pushAttack(m, a, 'beam', { ox: o.x, oy: o.y, v, len: s.range * TILE + a.extra * TILE, width: a.width * TILE, ticks: a.ticks, every: a.duration / a.ticks, n: 0, damage: s.damage * a.ratio, life: a.duration + 0.15 });
        dropBurnGround(m, f.x, f.y);
        Fx.addShake(3);
        Sfx.play('beam');
    },
    zap(m, s, target, a) {
        const o = monsterHand(m);
        const b = heroBody(target);
        const f = heroWorld(target);
        const p = pushAttack(m, a, 'zap', { ox: o.x, oy: o.y, tx: b.x, ty: b.y, fx: f.x, fy: f.y, splash: (s.splash || 0) * TILE, life: 0.28 });
        if (s.splash) strikeArea(p, f.x, f.y, s.splash * TILE, s.damage);
        else strikeHero(p, target, s.damage, o.x, o.y);
        strikeChain(p, target, s.damage);
        dropBurnGround(m, f.x, f.y);
        Sfx.play('hitLightning');
    },
    breath(m, s, target, a, melee) {
        const o = monsterHand(m);
        const f = heroWorld(target);
        const v = unitVec(m.x, m.y, f.x, f.y);
        const len = s.range * TILE + TILE * 0.3;
        const list = heroesInCone(m.x, m.y, v, len, a.cos);
        const targets = capTargets(target, list, melee ? Math.max(1, s.block) : Infinity);
        const p = pushAttack(m, a, 'breath', { ox: o.x, oy: o.y, v, len: len + (m.y - o.y) * 0.3, cos: a.cos, life: 0.5 });
        for (const h of targets) strikeHero(p, h, s.damage, m.x, m.y);
        strikeChain(p, target, s.damage);
        dropBurnGround(m, f.x, f.y);
        if (melee) monsterCleave(m, target, s.damage);
        Sfx.play('hitFire');
    },
    volley(m, s, target, a) {
        const o = monsterHand(m);
        const list = rangeTargets(m, s, target);
        const b = heroBody(target);
        const v = unitVec(o.x, o.y, b.x, b.y);
        for (let i = 0; i < a.count; i++) {
            const side = i - (a.count - 1) / 2;
            pushAttack(m, a, 'shot', {
                x: o.x, y: o.y, target: list[i % list.length], vx: (v.dx * 0.55 - v.dy * side * 0.5) * 900, vy: (v.dy * 0.55 + v.dx * side * 0.5) * 900,
                speed: a.speed || 1150, wait: i * 0.04, damage: s.damage * a.ratio, splash: (s.splash || 0) * TILE * 0.5, life: ATTACK_MAX_LIFE, n: i
            });
        }
        Sfx.play('arrow');
    },
    tether(m, s, target, a) {
        const o = monsterHand(m);
        const list = capTargets(target, heroesInCircle(m.x, m.y, s.range * TILE), a.count);
        pushAttack(m, a, 'tether', { ox: o.x, oy: o.y, list, ticks: a.ticks, every: a.duration / a.ticks, n: 0, damage: s.damage * a.ratio, life: a.duration + 0.2 });
        Sfx.play('hitCurse');
    },
    fissure(m, s, target, a, melee) {
        const f = heroWorld(target);
        const v = unitVec(m.x, m.y, f.x, f.y);
        pushAttack(m, a, 'fissure', {
            ox: m.x, oy: m.y + MONSTER_FOOT, v, len: s.range * TILE + a.extra * TILE, front: 0, speed: a.speed * TILE, width: a.width * TILE,
            cap: melee ? Math.max(1, s.block) : Infinity, hit: [], damage: s.damage, end: 0, ground: true, life: ATTACK_MAX_LIFE
        });
        Fx.addShake(4);
        Sfx.play('hitHeavy');
    },
    shockwave(m, s, target, a, melee) {
        pushAttack(m, a, 'shockwave', {
            ox: m.x, oy: m.y + MONSTER_FOOT, r: 0, max: s.range * TILE, speed: a.speed * TILE, cap: melee ? Math.max(1, s.block) : Infinity,
            hit: [], damage: s.damage, first: target, end: 0, ground: true, life: ATTACK_MAX_LIFE
        });
        Fx.addShake(3);
        Sfx.play('hitHeavy');
    },
    rewind(m, s, target, a) {
        const f = heroWorld(target);
        pushAttack(m, a, 'rewind', { target, x: f.x, y: f.y, delay: a.delay, fired: false, damage: s.damage * a.ratio, push: a.push * TILE, life: a.delay + 0.4 });
        Sfx.play('orb');
    },
    elements(m, s, target, a) {
        const o = monsterHand(m);
        const list = rangeTargets(m, s, target);
        const art = MONSTERS[m.type].art;
        ['fire', 'ice', 'storm'].forEach((look, i) => {
            const t = list[i % list.length];
            const w = heroWorld(t);
            Game.projectiles.push({
                kind: 'orb', look, x: o.x, y: o.y, tx: w.x, ty: w.y - 30, sx: o.x, sy: o.y, target: t,
                age: -i * 0.06, time: clamp(distance(o.x, o.y, w.x, w.y) / 760, 0.25, 0.6),
                damage: s.damage * a.ratio, splash: (s.splash || 1) * a.splashMul * TILE, src: m.type, owner: m,
                shot: 'bolt', impact: { fire: 'fx_hit_fire', ice: 'fx_snowflake', storm: 'fx_hit_lightning' }[look], glow: { fire: '255,140,50', ice: '140,210,255', storm: '255,240,120' }[look] || art.glow
            });
        });
        Sfx.play('orb');
    }
};

// 던져서 떨어지는 공격(웅덩이, 소용돌이): 떨어진 자리에서 맞히고 장판을 남긴다. 광역이 아니면 대상을 따라가 대상에게 떨어진다
function lobAttack(m, s, target, a, then) {
    const o = monsterHand(m);
    const f = heroWorld(target);
    pushAttack(m, a, 'lob', {
        x: o.x, y: o.y, sx: o.x, sy: o.y, tx: f.x, ty: f.y, target, home: !s.splash, time: clamp(distance(o.x, o.y, f.x, f.y) / 700, 0.3, 0.6), arc: 110,
        then, a, damage: s.damage * (then === 'vortex' ? a.ratio : 1), splash: (s.splash || 0) * TILE, life: ATTACK_MAX_LIFE
    });
    Sfx.play('orb');
}

// 웅덩이 장판: 안의 용사는 느려지고 방어력이 준다(Game.hazards, updateHazard)
function dropPuddle(m, a, x, y) {
    Game.hazards.push({ kind: 'puddle', x, y, radius: a.radius * TILE, slow: a.slow, armorMul: a.armorMul, life: a.duration, age: 0, tick: 0, look: a.look, owner: m, seed: Math.random() * 100 });
}

// 던진 것이 떨어짐: 광역이면 반경 안 모두, 아니면 대상 하나. 그 뒤 장판(웅덩이, 소용돌이)이나 덫
function landLob(p) {
    const a = p.a;
    const owner = liveOwner(p);
    if (p.then === 'trap') {
        Game.hazards.push({ kind: 'trap', x: p.tx, y: p.ty, arm: a.arm, trigger: a.trigger * TILE, radius: p.splash, damage: p.damage, life: a.life, age: 0, look: p.look, src: p.src, owner: p.owner, color: p.color, tier: p.tier, seed: p.seed });
        return;
    }
    let first = null;
    if (p.splash > 0) {
        const hits = strikeArea(p, p.tx, p.ty, p.splash, p.damage);
        first = p.target && !p.target.dead && hits.includes(p.target) ? p.target : hits[0];
    } else if (p.target && !p.target.dead) {
        strikeHero(p, p.target, p.damage, p.tx, p.ty);
        first = p.target;
    }
    strikeChain(p, first, p.damage);
    if (owner) dropBurnGround(owner, p.tx, p.ty);
    if (p.then === 'puddle' && owner) dropPuddle(owner, a, p.tx, p.ty);
    if (p.then === 'vortex') {
        Game.hazards.push({
            kind: 'vortex', x: p.tx, y: p.ty, radius: Math.max(p.splash, TILE), life: a.duration, age: 0, tick: a.tick, every: a.tick,
            damage: p.damage / a.ratio * a.tickRatio, pull: a.pull * TILE, look: p.look, src: p.src, owner: p.owner, color: p.color, seed: p.seed
        });
        Fx.addShake(5);
    }
    attackImpact(p.look, p.src, p.tx, p.ty, Math.max(p.splash, TILE * 0.5), p.tier);
    Sfx.play(p.then === 'vortex' ? 'blast' : 'hitIce');
}

// 공격 개체 움직이기(kind 'atk'). 그림만 남은 개체는 수명이 다하면 끝난다
const ATTACK_UPDATE = {
    pierce(p, dt) {
        const step = p.speed * dt;
        p.dist += step;
        p.x += p.v.dx * step;
        p.y += p.v.dy * step;
        for (const h of liveHeroList()) {
            if (p.hit.includes(h) || p.hit.length >= p.cap) continue;
            const b = heroBody(h);
            if (distance(p.x, p.y, b.x, b.y) > (h.boss ? 70 : 36)) continue;
            p.hit.push(h);
            const first = p.hit.length === 1;
            strikeHero(p, h, p.damage * (first ? 1 : p.ratio), p.x, p.y);
            if (first) strikeChain(p, h, p.damage);
        }
        if (p.dist >= p.max) p.done = true;
    },
    boomerang(p, dt) {
        p.s += dt / p.time * (p.back ? -1 : 1);
        if (!p.back && p.s >= 1) { p.s = 1; p.back = true; }
        const s = clamp(p.s, 0, 1);
        const k = p.back ? 4 * s * (1 - s) * p.bow : 0; // 갈 때는 곧게(대상을 맞힌다), 돌아올 때는 휘어 옆 줄을 훑는다
        p.x = p.sx + (p.ex - p.sx) * s + p.nx * k;
        p.y = p.sy + (p.ey - p.sy) * s + p.ny * k;
        const list = p.back ? p.hitBack : p.hitOut;
        for (const h of liveHeroList()) {
            if (list.includes(h) || list.length >= p.max) continue;
            const b = heroBody(h);
            if (distance(p.x, p.y, b.x, b.y) > (h.boss ? 70 : 44)) continue;
            list.push(h);
            strikeHero(p, h, p.damage, p.x, p.y);
            if (!p.chained) { p.chained = true; strikeChain(p, h, p.base); }
        }
        if (p.back && p.s <= 0) p.done = true;
    },
    lob(p, dt) {
        p.age += dt;
        if (p.home && p.target && !p.target.dead) {
            const f = heroWorld(p.target);
            p.tx = f.x;
            p.ty = f.y;
        }
        const t = clamp(p.age / p.time, 0, 1);
        p.x = p.sx + (p.tx - p.sx) * t;
        p.y = p.sy + (p.ty - p.sy) * t - 4 * t * (1 - t) * p.arc;
        if (t >= 1) {
            p.done = true;
            landLob(p);
        }
    },
    drop(p, dt) {
        p.age += dt;
        if (!p.fired && p.age >= p.delay - 1e-9) {
            p.fired = true;
            const hit = [];
            for (const pt of p.pts) {
                for (const h of capTargets(null, heroesInCircle(pt.x, pt.y, p.radius), p.cap)) {
                    if (hit.includes(h) || hit.length >= p.cap) continue;
                    hit.push(h);
                    strikeHero(p, h, p.damage, pt.x, pt.y);
                }
            }
            strikeChain(p, hit[0], p.damage);
            const owner = liveOwner(p);
            if (owner) dropBurnGround(owner, p.pts[0].x, p.pts[0].y);
            Fx.addShake(p.big ? 5 : 3);
            Sfx.play('blast');
        }
        if (p.age >= p.life) p.done = true;
    },
    beam(p, dt) {
        p.age += dt;
        while (p.n < p.ticks && p.age >= p.n * p.every - 1e-9) {
            p.n++;
            for (const h of heroesOnLine(p.ox, p.oy, p.v, p.len, p.width, true)) strikeHero(p, h, p.damage, p.ox, p.oy);
        }
        if (p.age >= p.life) p.done = true;
    },
    shot(p, dt) {
        p.age += dt;
        if (p.wait > 0) { p.wait -= dt; return; }
        let t = p.target;
        if (!t || t.dead) {
            t = p.target = nearestHero(p.x, p.y, TILE * 2);
            if (!t) { p.done = true; return; }
        }
        const b = heroBody(t);
        const d = unitVec(p.x, p.y, b.x, b.y);
        const k = Math.min(1, 9 * dt);
        p.vx += (d.dx * p.speed - p.vx) * k;
        p.vy += (d.dy * p.speed - p.vy) * k;
        const step = distance(0, 0, p.vx, p.vy) * dt;
        if (d.len <= Math.max(16, step + 6)) {
            p.done = true;
            if (p.splash > 0) {
                const f = heroWorld(t);
                strikeArea(p, f.x, f.y, p.splash, p.damage);
                attackImpact(p.look, p.src, b.x, b.y, p.splash, p.tier);
            } else strikeHero(p, t, p.damage, p.x, p.y);
            return;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.age >= p.life) p.done = true;
    },
    tether(p, dt) {
        p.age += dt;
        while (p.n < p.ticks && p.age >= p.n * p.every - 1e-9) {
            p.n++;
            for (const h of p.list) if (!h.dead) strikeHero(p, h, p.damage, p.ox, p.oy);
        }
        if (p.age >= p.life) p.done = true;
    },
    fissure(p, dt) {
        p.age += dt;
        if (p.front < p.len) {
            p.front = Math.min(p.len, p.front + p.speed * dt);
            for (const h of heroesOnLine(p.ox, p.oy, p.v, p.front, p.width, false)) {
                if (p.hit.includes(h) || p.hit.length >= p.cap) continue;
                p.hit.push(h);
                strikeHero(p, h, p.damage, p.ox, p.oy);
                const owner = liveOwner(p);
                if (p.hit.length === 1 && owner) monsterCleave(owner, h, p.damage);
            }
        } else {
            p.end += dt;
            if (p.end >= 0.6) p.done = true;
        }
        if (p.age >= p.life) p.done = true;
    },
    shockwave(p, dt) {
        p.age += dt;
        if (p.r < p.max) {
            p.r = Math.min(p.max, p.r + p.speed * dt);
            const fresh = heroesInCircle(p.ox, p.oy, p.r).filter(h => !p.hit.includes(h));
            for (const h of capTargets(fresh.includes(p.first) ? p.first : null, fresh, p.cap - p.hit.length)) {
                p.hit.push(h);
                strikeHero(p, h, p.damage, p.ox, p.oy);
                const owner = liveOwner(p);
                if (p.hit.length === 1 && owner) monsterCleave(owner, h, p.damage);
            }
        } else {
            p.end += dt;
            if (p.end >= 0.35) p.done = true;
        }
        if (p.age >= p.life) p.done = true;
    },
    rewind(p, dt) {
        p.age += dt;
        if (!p.fired) {
            if (p.target && !p.target.dead) {
                const f = heroWorld(p.target);
                p.x = f.x;
                p.y = f.y;
            }
            if (p.age >= p.delay - 1e-9) {
                p.fired = true;
                const h = p.target && !p.target.dead ? p.target : nearestHero(p.x, p.y, TILE * 0.7);
                if (h) {
                    strikeHero(p, h, p.damage, p.x, p.y);
                    if (!h.dead && !h.boss) {
                        h.d = Math.max(0, h.d - p.push);
                        h.blocker = null;
                    }
                }
                Sfx.play('hitIce');
            }
        }
        if (p.age >= p.life) p.done = true;
    }
};

function updateAttack(p, dt) {
    const step = ATTACK_UPDATE[p.atk];
    if (step) { step(p, dt); return; }
    p.age += dt;
    if (p.age >= p.life) p.done = true;
}

function fireMonsterShot(m, stats, target) {
    const a = monsterAttack(m.type);
    const melee = !!MONSTER_ROLES[MONSTERS[m.type].role].melee;
    if (MELEE_ATTACKS.includes(a.kind)) { meleeAttack(m, stats, target, a); return; }
    if (ATTACKS[a.kind]) { ATTACKS[a.kind](m, stats, target, a, melee); return; }
    if (melee) { meleeAttack(m, stats, target, Object.assign({}, ATTACK_KINDS.claw, { kind: 'claw' })); return; }
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
    if (p.kind === 'atk') { updateAttack(p, dt); return; }
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
            // 꿰뚫는 화살촉: 맞은 용사 뒤(1.5칸 안) 가장 가까운 용사도 맞는다
            if (Game.mods.pierce && p.owner && !p.owner.removed) {
                const next = Game.heroes.filter(h => h !== t && !h.dead && !h.waiting).map(h => ({ h, d: distance(w.x, w.y, heroWorld(h).x, heroWorld(h).y) })).filter(o => o.d <= TILE * 1.5).sort((a, b) => a.d - b.d)[0];
                if (next) damageHero(next.h, p.damage, w.x, w.y, '#ffe36b', p.owner);
            }
            // 타락 유닛의 화살에는 src와 owner가 없다
            if (p.src) monsterHitHero(p.src, t, p.owner);
            if (p.owner && !p.owner.removed) monsterChain(p.owner, t, p.damage);
            if (p.big) Fx.addShake(5);
            Sfx.play(p.src ? monsterHitSfx(p.src, 'hit') : 'hit');
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
            if (!p.look || p.look === 'fire') dropBurnGround(owner, p.tx, p.ty + 30); // 세 원소는 불 구체만
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
