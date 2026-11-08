// 유물 2판(47종)의 전투 효과와 치명타. 유물 표와 설명은 js/data/demonlords.js의 RELICS, 수치 키는 LORD_EFFECTS.
// 난수는 모두 고정 난수(rng)로 굴려 입력 재생에서 같은 판이 나온다.

function monsterFamily(m) { return m && MONSTERS[m.type] ? MONSTERS[m.type].family : null; }

// 상태 이상(기절, 감속, 저주, 화상, 중독, 속박)에 걸렸는지
function heroAfflicted(h) {
    return h.stun > 0 || h.slow > 0 || h.curse > 0 || h.burn > 0 || h.poison > 0 || h.bound > 0;
}

// 몬스터 공격 한 번의 유물 배율과 치명타. { amount, crit }
function relicHitDamage(hero, amount, attacker) {
    const G = Game;
    const mods = G.mods;
    let mul = 1;
    if (mods.farDamage) {
        // 저격수의 표식: 사거리 끝에 있는 적일수록 더 아프다
        const w = heroWorld(hero);
        const reach = Math.max(1, monsterStats(attacker).range * TILE);
        mul *= 1 + mods.farDamage * clamp(distance(attacker.x, attacker.y, w.x, w.y) / reach, 0, 1);
    }
    if (mods.statusDamage && heroAfflicted(hero)) mul *= 1 + mods.statusDamage;
    const chance = COMBAT_RULES.crit.chance + mods.critChance + (monsterFamily(attacker) === 'undead' ? mods.undeadCrit : 0) + (hero.elite || hero.boss ? mods.eliteCrit : 0);
    const crit = chance > 0 && rng('battle') < chance; // 확률이 0이면 난수를 쓰지 않는다
    if (crit) mul *= COMBAT_RULES.crit.damage + mods.critDamage;
    return { amount: amount * mul, crit };
}

// 둘레의 다른 용사들에게 피해(정령 튀김, 폭죽, 잔혹한 칼날). 지속 피해로 줘서 치명타와 연쇄가 다시 일어나지 않는다
function relicSplash(x, y, radius, damage, color, owner, except) {
    const G = Game;
    if (G.relicSplashing || !(damage > 0)) return;
    G.relicSplashing = true;
    for (const h of G.heroes.slice()) {
        if (h === except || h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(x, y, p.x, p.y) <= radius) damageHero(h, damage, x, y, color, owner, true);
    }
    G.relicSplashing = false;
}

// 몬스터에게 맞음(피해 뒤): 얼음 송곳니, 지옥불 인장, 정령의 구슬
function relicOnHit(hero, owner) {
    const G = Game;
    const mods = G.mods;
    if (!owner || owner.kind !== 'monster' || owner.removed || hero.dead) return;
    if (mods.freezeChance && rng('battle') < mods.freezeChance) slowHero(hero, 1.5, 0.5);
    const family = monsterFamily(owner);
    if (family === 'demon' && mods.demonBurn) burnHero(hero, 3, monsterStats(owner).damage * mods.demonBurn, owner);
    if (family === 'spirit' && mods.spiritSplash) {
        const w = heroWorld(hero);
        relicSplash(w.x, w.y, TILE, monsterStats(owner).damage * mods.spiritSplash, '#9fe8ff', owner, hero);
    }
}

// 용사가 쓰러짐: 학살의 종 게이지, 영혼 수확 낫, 사냥꾼의 뿔, 폭죽 상자
function relicOnKill(hero, pos, attacker) {
    const G = Game;
    const mods = G.mods;
    const L = RELIC_LIMITS;
    if (mods.slaughterBell) G.relicGauge = Math.min(L.gaugeMax, G.relicGauge + (hero.boss ? 100 : hero.elite ? 10 : 1));
    if (mods.soulScythe && hero.elite) G.relicSouls = Math.min(L.soulMax, G.relicSouls + 1);
    if (attacker && attacker.kind === 'monster' && !attacker.removed && mods.beastFrenzy && monsterFamily(attacker) === 'beast') {
        attacker.buffT = 3;
        attacker.buff = { speed: mods.beastFrenzy };
    }
    if (mods.killBlast && !hero.elite && !hero.boss && !G.relicSplashing && rng('battle') < mods.killBlast) {
        const damage = attacker && attacker.kind === 'monster' && !attacker.removed ? monsterStats(attacker).damage : G.lightningDamage();
        Fx.anim('fx_explosion', pos.x, pos.y - 24, 200, 0.3);
        relicSplash(pos.x, pos.y, TILE, damage, '#ff9d4d', null, hero);
    }
}

// 유물을 눌러 발동(학살의 종, 영혼 수확 낫). 준비되지 않았으면 false
function fireRelic(id) {
    const G = Game;
    if (!G.inPlay() || !G.relics.includes(id) || !hasEntry(RELICS, id)) return false;
    const e = RELICS[id].effects;
    const L = RELIC_LIMITS;
    if (e.slaughterBell) {
        if (G.relicGauge < L.gaugeMax) return false;
        G.relicGauge = 0;
        for (const h of G.heroes.slice()) {
            if (h.dead || h.waiting) continue;
            const w = heroWorld(h);
            damageHero(h, h.maxHp * (h.boss ? 0.1 : 0.5), w.x, w.y, '#ff5a5a', null, true);
        }
        Fx.addShake(18);
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '종이 울린다.', 2);
        Sfx.play('bossDown');
        return true;
    }
    if (e.soulScythe) {
        if (G.relicSouls < L.soulMax) return false;
        G.relicSouls = 0;
        for (const m of G.monsters) {
            if (m.removed) continue;
            m.buffT = 10;
            m.buff = { speed: 0.5 };
        }
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '영혼을 거둬라.', 2);
        Sfx.play('charge');
        return true;
    }
    return false;
}

// 발동형 유물의 채운 정도(0~1). 발동형이 아니면 null
function relicCharge(id) {
    if (!hasEntry(RELICS, id)) return null;
    const e = RELICS[id].effects;
    if (e.slaughterBell) return Game.relicGauge / RELIC_LIMITS.gaugeMax;
    if (e.soulScythe) return Game.relicSouls / RELIC_LIMITS.soulMax;
    return null;
}

// 불사의 왕관: 마왕이 쓰러지면 한 번 부활해 이번 라운드를 처음부터 다시
function relicUndying() {
    const G = Game;
    if (!G.mods.undying || G.undyingUsed) return false;
    G.undyingUsed = true;
    G.hp = G.maxHp();
    G.heroes = [];
    G.projectiles = [];
    G.state = 'prep';
    G.prepTimer = 3;
    G.roundHit = false;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 120, 360, '#ffe08a', 0.6);
    Fx.say(tx, ty - LORD_SAY_Y, '한 번 더.', 2.5);
    return true;
}

// 몬스터 두 장비 칸의 효과 합(장비 먹는 괴물이면 둘째 칸도)
function monsterEquip(m, key) {
    return m ? equipEffect(m.equip, key) + equipEffect(m.equip2, key) : 0;
}
