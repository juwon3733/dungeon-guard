// 피해, 처치, 타락처럼 여러 객체가 함께 쓰는 전투 규칙.

function damageHero(hero, amount, fromX, fromY, color) {
    if (hero.dead) return;
    // Why: 고정 방어력은 약한 연타에 불리하고 한 방이 큰 공격에 유리해, 궁수탑만 짓는 배치를 스스로 깎는다.
    const dealt = Math.max(1, amount - (hero.armor || 0));
    hero.hp -= dealt;
    hero.flash = 0.09;
    const p = heroWorld(hero);
    Fx.number(hero, p.x, p.y - (hero.boss || hero.elite ? 130 : 74), Math.round(dealt), color || '#ffe36b', dealt >= 30);
    Fx.burst(p.x, p.y - (hero.boss ? 70 : 30), color || '#ffd26a', 2, 200, 0.28, 5);
    Fx.anim(dealt >= 20 ? 'fx_hit_crit' : 'fx_hit_physical', p.x + randRange(-14, 14), p.y - (hero.boss ? 70 : 32) + randRange(-12, 12), dealt >= 20 ? 150 : 90, 0.26);
    if (hero.hp <= 0) killHero(hero, p);
}

function killHero(hero, pos) {
    hero.dead = true;
    const G = Game;
    const bounty = hero.bounty;
    G.gold += bounty;
    G.stats.kills++;
    Fx.coin(pos.x, pos.y - 40, bounty);
    Fx.burst(pos.x, pos.y - 30, hero.boss ? '#c893ff' : '#ffffff', hero.boss ? 56 : 10, hero.boss ? 620 : 300, 0.45, 6);
    Fx.burst(pos.x, pos.y - 30, '#ff9d4d', hero.boss ? 28 : 5, 240, 0.4, 5);
    Fx.ring(pos.x, pos.y - 24, hero.boss ? 190 : 46, '#ffe9b0', 0.26);
    Fx.anim(hero.boss ? 'fx_adv_arcanist_thunderGod' : 'fx_explosion', pos.x, pos.y - 34, hero.boss ? 620 : 150, hero.boss ? 0.8 : 0.36);
    Fx.glow(pos.x, pos.y - 30, hero.boss ? 280 : 80, 'rgba(255,190,110,1)', 0.2);
    if (hero.boss) {
        Fx.addShake(26);
        Sfx.play('bossDown');
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - 190, '고생했다. 다음엔 예약하고 와.', 3);
    } else {
        Fx.addShake(1.5);
    }

    // 연속 처치
    G.streak = G.streakTimer > 0 ? G.streak + 1 : 1;
    G.streakTimer = 2.4;
    if (G.streak >= 2) G.streakPop = 1;
    Sfx.play('kill', G.streak);

    if (!hero.boss) {
        G.corpses.push({
            type: hero.type, female: hero.female, x: pos.x, y: pos.y, d: hero.d, dir: hero.dir,
            age: 0, life: COMBAT_RULES.corpseTime, cost: bounty * COMBAT_RULES.corruptCostMul
        });
    }
}

function nearestHero(x, y, rangePx, predicate) {
    let best = null;
    let bestDist = rangePx;
    for (const h of Game.heroes) {
        if (h.dead || h.waiting) continue;
        if (predicate && !predicate(h)) continue;
        const p = heroWorld(h);
        const dd = distance(x, y, p.x, p.y);
        if (dd <= bestDist) { best = h; bestDist = dd; }
    }
    return best;
}

// 사거리 안에서 왕좌에 가장 가까이 간 용사를 고른다(타워 디펜스의 기본 조준)
function foremostHero(x, y, rangePx) {
    let best = null;
    for (const h of Game.heroes) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(x, y, p.x, p.y) > rangePx) continue;
        if (!best || h.d > best.d) best = h;
    }
    return best;
}

function splashDamage(x, y, radiusPx, damage, color) {
    let hits = 0;
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(x, y, p.x, p.y) <= radiusPx) {
            damageHero(h, damage, x, y, color);
            hits++;
        }
    }
    return hits;
}

function damageThrone(amount, heroName) {
    const G = Game;
    G.hp = Math.max(0, G.hp - amount);
    G.throneFlash = 0.4;
    Fx.addShake(amount >= 5 ? 22 : 12);
    Sfx.play('throneHit');
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.number('throne', tx, ty - 200, amount, '#ff5e73', true);
    Fx.burst(tx, ty - 60, '#ff5e73', 22, 420, 0.5, 7);
    Fx.anim('fx_hit_fire', tx, ty - 60, 300, 0.4);
    Fx.say(tx, ty - 190, randItem(SPEECH.throneHit), 1.8);
    if (G.hp <= 0) G.finish(false);
}

function corruptCorpse(corpse) {
    const G = Game;
    if (G.gold < corpse.cost) return { ok: false, reason: 'gold' };
    const alive = G.units.filter(u => u.kind === 'corrupt').length;
    if (alive >= COMBAT_RULES.corruptMax) return { ok: false, reason: 'limit' };
    G.gold -= corpse.cost;
    G.corpses = G.corpses.filter(c => c !== corpse);
    G.units.push(createCorruptUnit(corpse));
    G.stats.corrupted++;
    Fx.ring(corpse.x, corpse.y - 20, 120, '#c56bff', 0.5);
    Fx.anim('fx_adv_arcanist_lightning', corpse.x, corpse.y - 90, 360, 0.75);
    Fx.anim('fx_adv_doomMelody_requiem', corpse.x, corpse.y - 20, 260, 0.75);
    Fx.rise(corpse.x, corpse.y, '#c56bff', 46, 44, 0.9);
    Fx.rise(corpse.x, corpse.y, '#f1c8ff', 16, 26, 0.7);
    Fx.glow(corpse.x, corpse.y - 60, 240, 'rgba(180,90,255,1)', 0.65);
    Fx.beam(corpse.x, corpse.y, corpse.x, corpse.y - 900, '#c56bff', 40, 0.45);
    Fx.addShake(7);
    Fx.say(corpse.x, corpse.y - 100, randItem(SPEECH.corrupt), 2.2);
    Sfx.play('corrupt');
    return { ok: true };
}

function castLightning(x, y) {
    const G = Game;
    const rule = COMBAT_RULES.lightning;
    if (G.skills.lightning > 0) return false;
    G.skills.lightning = rule.cooldown;
    G.pendingStrikes.push({ x, y, t: 0.16 });
    Fx.dim = 0.75;
    Sfx.play('charge');
    return true;
}

function resolveStrike(strike) {
    const rule = COMBAT_RULES.lightning;
    Fx.bolt(strike.x, strike.y, '#d8f3ff');
    Fx.anim('fx_adv_arcanist_thunderGod', strike.x, strike.y - 30, 620, 0.55);
    Fx.anim('fx_adv_arcanist_lightning', strike.x, strike.y - 150, 520, 0.5);
    Fx.anim('fx_hit_lightning', strike.x, strike.y - 10, 320, 0.4);
    Fx.bolt(strike.x + randRange(-24, 24), strike.y, '#9d7bff');
    Fx.addShake(24);
    Fx.ring(strike.x, strike.y, rule.radius * TILE, '#d8f3ff', 0.34);
    Fx.glow(strike.x, strike.y, 330, 'rgba(180,220,255,1)', 0.3);
    Fx.burst(strike.x, strike.y, '#d8f3ff', 42, 620, 0.5, 7);
    Fx.decals.push({ kind: 'scorch', x: strike.x, y: strike.y, age: 0, life: 9, radius: rule.radius * TILE * 0.72 });
    splashDamage(strike.x, strike.y, rule.radius * TILE, rule.damage, '#bfe9ff');
    Sfx.play('lightning');
}

function castRoar() {
    const G = Game;
    const rule = COMBAT_RULES.roar;
    if (G.hp > rule.unlockHp || G.skills.roar > 0) return false;
    G.skills.roar = rule.cooldown;
    for (const h of G.heroes) if (!h.dead) h.stun = Math.max(h.stun, rule.duration);
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty, 1500, '#ff6e8a', 0.8);
    Fx.anim('fx_blastPink', tx, ty - 40, 760, 0.7);
    Fx.ring(tx, ty, 900, '#ffd0db', 0.6);
    Fx.dim = 0.7;
    Fx.addShake(30);
    Fx.say(tx, ty - 190, '조용히 해!!!', 2.4);
    Sfx.play('roar');
    return true;
}

// 정지·감전의 대상 목록: (x, y)에서 반경 rangePx 안의 방어 쪽 전부(시설과 마왕군 유닛).
// Why: 시설이 몬스터로 바뀌는 중이다. 정지 대상은 모두 이 함수로 얻으므로, 전환 뒤에는 여기만 고치면 된다.
// 돌려주는 대상은 x, y와 stun(남은 정지 초)을 가진다.
function stunTargets(x, y, rangePx) {
    const list = [];
    for (const f of Game.facilities) if (distance(x, y, f.x, f.y) <= rangePx) list.push(f);
    for (const u of Game.units) if (!u.removed && distance(x, y, u.x, u.y) <= rangePx) list.push(u);
    return list;
}

// 더 긴 쪽 정지를 남긴다
function applyStun(target, seconds) {
    target.stun = Math.max(target.stun || 0, seconds);
}
