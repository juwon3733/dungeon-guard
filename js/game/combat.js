// 피해, 처치, 타락처럼 여러 객체가 함께 쓰는 전투 규칙.

// attacker: 피해를 준 몬스터. 이 피해로 쓰러지면 그 몬스터가 처치 경험치를 받는다(번개, 타락 유닛은 넘기지 않는다)
// dot이 true면 지속 피해(화상, 불 장판): 방어력을 무시하고 타격 섬광 없이 숫자만 띄운다. 실제로 준 피해를 돌려준다(흡혈)
function damageHero(hero, amount, fromX, fromY, color, attacker, dot) {
    if (hero.dead) return 0;
    // Why: 고정 방어력은 약한 연타에 불리하고 한 방이 큰 공격에 유리해, 궁수만 놓는 배치를 스스로 깎는다.
    // 저주(curseShot)에 걸려 있으면 방어력을 뺀 뒤의 피해가 늘어난다
    const base = dot ? amount : Math.max(1, amount - (hero.armor || 0));
    const dealt = base * (hero.curse > 0 ? hero.curseMul : 1);
    hero.hp -= dealt;
    if (hero.boss) Game.scoreBossDamage(Math.min(dealt, Math.max(0, hero.hp + dealt)));
    const p = heroWorld(hero);
    const small = !hero.boss && !hero.elite; // 떼로 나오는 일반 용사는 숫자를 띄우지 않아 화면을 가리지 않는다
    if (!small) Fx.number(hero, p.x, p.y - (hero.boss ? 300 : hero.elite ? 180 : 110), Math.round(dealt), color || '#ffe36b', dealt >= 30);
    if (!dot && small) {
        hero.flash = 0.09;
        Fx.burst(p.x, p.y - 22, color || '#ffd26a', 2, 200, 0.25, 4);
    } else if (!dot) {
        hero.flash = 0.09;
        Fx.burst(p.x, p.y - (hero.boss ? 140 : 45), color || '#ffd26a', 4, 260, 0.3, 6);
        Fx.anim(dealt >= 20 ? 'fx_hit_crit' : 'fx_hit_physical', p.x + randRange(-21, 21), p.y - (hero.boss ? 140 : 48) + randRange(-18, 18), dealt >= 20 ? 225 : 135, 0.26);
    }
    if (hero.hp <= 0) killHero(hero, p, attacker);
    return dealt;
}

function killHero(hero, pos, attacker) {
    hero.dead = true;
    if (attacker) monsterKilledHero(attacker, hero);
    const G = Game;
    // 처치 골드(마왕과 유물의 bounty 포함). 일반 용사는 1보다 작아 모아서 준다
    const goldTouch = hero.elite || hero.boss ? G.lordPassive('goldTouch') : null;
    G.goldLeft = (G.goldLeft || 0) + hero.bounty * G.mods.bounty * (goldTouch ? goldTouch.eliteGold : 1);
    const bounty = Math.floor(G.goldLeft + 1e-9);
    G.goldLeft -= bounty;
    G.gold += bounty;
    G.stats.kills++;
    G.scoreKill(hero);
    G.soulVolley();
    if (hero.elite) G.eliteDrop(pos.x, pos.y - 60); // 정예는 장비를 떨어뜨릴 수 있다(EQUIP_RULES)
    if (!hero.boss && !hero.elite) {
        // 떼로 터지는 일반 용사: 작은 폭발과 파편만. 많이 터져도 화면과 속도를 버티게 가볍게 그린다
        const y = pos.y - 24;
        if (bounty > 0) Fx.coin(pos.x, pos.y - 30, 1, 1);
        Fx.anim('fx_explosion', pos.x, y, 170, 0.3);
        Fx.burst(pos.x, y, '#ffffff', 5, 300, 0.35, 5);
        Fx.burst(pos.x, y, '#ff9d4d', 5, 240, 0.4, 4);
        Fx.addShake(1.5);
        G.streak = G.streakTimer > 0 ? G.streak + 1 : 1;
        G.streakTimer = 2.4;
        if (G.streak >= 2) G.streakPop = 1;
        // 연속 처치 글자는 10명마다
        if (G.streak % 10 === 0) Fx.number({}, pos.x, pos.y - 150, `${G.streak} 연속!`, G.streak >= 50 ? '#ff7a5c' : '#9fe0ff', G.streak % 50 === 0);
        Sfx.play('kill', G.streak);
        // 시체는 쓰러지는 장식이라 많으면 오래된 것부터 지운다
        const fall = HEROES[hero.type].anim && HEROES[hero.type].anim.death;
        const life = CORRUPTION_ENABLED ? COMBAT_RULES.corpseTime : (fall ? fall.frames / CORPSE_FALL_FPS : 0) + CORPSE_FADE_TIME;
        if (!CORRUPTION_ENABLED && G.corpses.length >= 40) G.corpses.shift();
        G.corpses.push({ type: hero.type, x: pos.x, y: pos.y, route: hero.route, d: hero.d, dir: hero.dir, age: 0, life, cost: bounty * COMBAT_RULES.corruptCostMul });
        return;
    }
    Fx.coin(pos.x, pos.y - 60, bounty);
    // 처치: 터지는 빛, 흰 불꽃과 주황 파편, 금화, 떠오르는 골드 글자(연출만, 계산과 무관)
    const cy = pos.y - (hero.boss ? 140 : 45);
    Fx.burst(pos.x, cy, hero.boss ? '#c893ff' : '#ffffff', hero.boss ? 70 : 20, hero.boss ? 680 : 380, 0.5, 7);
    Fx.burst(pos.x, cy, '#ff9d4d', hero.boss ? 36 : 12, 300, 0.45, 6);
    Fx.burst(pos.x, cy, '#ffd34d', hero.boss ? 24 : 8, 220, 0.6, 8);
    Fx.ring(pos.x, pos.y - 36, hero.boss ? 320 : 110, '#ffe9b0', 0.3);
    Fx.anim(hero.boss ? 'fx_adv_arcanist_thunderGod' : 'fx_explosion', pos.x, pos.y - (hero.boss ? 140 : 51), hero.boss ? 700 : 300, hero.boss ? 0.8 : 0.36);
    if (hero.elite || hero.boss) Fx.anim('fx_blastGold', pos.x, pos.y - 60, hero.boss ? 600 : 360, 0.5);
    Fx.glow(pos.x, pos.y - 45, hero.boss ? 480 : 170, 'rgba(255,190,110,1)', 0.25);
    Fx.number({}, pos.x, pos.y - (hero.boss ? 360 : 200), `+${bounty}G`, '#ffd34d', hero.boss || hero.elite);
    if (hero.boss) {
        if (G.challenge && G.challenge.kind === 'raid') G.raidTier++;
        G.bossDefeated = true; // 웨이브가 끝나면 보스 보상 3택(마지막 웨이브는 승리로 끝난다)
        Fx.addShake(26);
        Sfx.play('bossDown');
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '고생했다. 다음엔 예약하고 와.', 3);
    } else {
        Fx.addShake(hero.elite ? 9 : 3);
    }

    // 연속 처치
    G.streak = G.streakTimer > 0 ? G.streak + 1 : 1;
    G.streakTimer = 2.4;
    if (G.streak >= 2) G.streakPop = 1;
    // 연속 처치가 이어지면 처치 자리에 큰 글자(5, 10, 15...마다 더 크게)
    if (G.streak >= 3) Fx.number({}, pos.x, pos.y - (hero.boss ? 420 : 250), `${G.streak} 연속!`, G.streak >= 10 ? '#ff7a5c' : '#9fe0ff', G.streak % 5 === 0);
    Sfx.play('kill', G.streak);

    if (!hero.boss) {
        // 타락이 꺼져 있으면 시체는 쓰러지는 동작과 짧은 사라짐만 보여 주는 장식이다
        const fall = HEROES[hero.type].anim && HEROES[hero.type].anim.death;
        const life = CORRUPTION_ENABLED ? COMBAT_RULES.corpseTime : (fall ? fall.frames / CORPSE_FALL_FPS : 0) + CORPSE_FADE_TIME;
        G.corpses.push({
            type: hero.type, x: pos.x, y: pos.y, route: hero.route, d: hero.d, dir: hero.dir,
            age: 0, life, cost: bounty * COMBAT_RULES.corruptCostMul
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

// 사거리 안에서 왕좌에 가장 가까이 간 용사를 고른다(타워 디펜스의 기본 조준).
// 길이 여러 개라 d가 아니라 왕좌까지 남은 거리로 비교한다. 같으면 먼저 찾은 쪽
function foremostHero(x, y, rangePx) {
    let best = null;
    let bestLeft = Infinity;
    for (const h of Game.heroes) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(x, y, p.x, p.y) > rangePx) continue;
        const left = remainingDistance(h);
        if (left < bestLeft) { best = h; bestLeft = left; }
    }
    return best;
}

// onHit(hero)은 피해를 준 뒤 맞은 용사마다 부른다(몬스터 능력). attacker는 damageHero로 넘긴다. onDealt(준 피해)는 흡혈용
function splashDamage(x, y, radiusPx, damage, color, onHit, attacker, onDealt) {
    let hits = 0;
    for (const h of Game.heroes.slice()) {
        if (h.dead || h.waiting) continue;
        const p = heroWorld(h);
        if (distance(x, y, p.x, p.y) <= radiusPx) {
            const dealt = damageHero(h, damage, x, y, color, attacker);
            if (onDealt) onDealt(dealt);
            if (onHit) onHit(h);
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
    Fx.number('throne', tx, ty - 330, amount, '#ff5e73', true);
    Fx.burst(tx, ty - 120, '#ff5e73', 22, 420, 0.5, 7);
    Fx.anim('fx_hit_fire', tx, ty - 120, 400, 0.4);
    Fx.say(tx, ty - LORD_SAY_Y, lordLine('throneHit'), 1.8);
    if (G.hp <= 0) G.finish(false);
}

function corruptCorpse(corpse) {
    const G = Game;
    if (!CORRUPTION_ENABLED) return { ok: false, reason: 'disabled' };
    if (G.gold < corpse.cost) return { ok: false, reason: 'gold' };
    const alive = G.units.filter(u => u.kind === 'corrupt').length;
    if (alive >= COMBAT_RULES.corruptMax) return { ok: false, reason: 'limit' };
    G.gold -= corpse.cost;
    G.corpses = G.corpses.filter(c => c !== corpse);
    G.units.push(createCorruptUnit(corpse));
    G.stats.corrupted++;
    Fx.ring(corpse.x, corpse.y - 30, 120, '#c56bff', 0.5);
    Fx.anim('fx_adv_arcanist_lightning', corpse.x, corpse.y - 135, 360, 0.75);
    Fx.anim('fx_adv_doomMelody_requiem', corpse.x, corpse.y - 20, 260, 0.75);
    Fx.rise(corpse.x, corpse.y, '#c56bff', 46, 44, 0.9);
    Fx.rise(corpse.x, corpse.y, '#f1c8ff', 16, 26, 0.7);
    Fx.glow(corpse.x, corpse.y - 90, 240, 'rgba(180,90,255,1)', 0.65);
    Fx.beam(corpse.x, corpse.y, corpse.x, corpse.y - 900, '#c56bff', 40, 0.45);
    Fx.addShake(7);
    Fx.say(corpse.x, corpse.y - 150, randItem(SPEECH.corrupt), 2.2);
    Sfx.play('corrupt');
    return { ok: true };
}

function castLightning(x, y) {
    const G = Game;
    const rule = COMBAT_RULES.lightning;
    if (G.skills.lightning > 0) return false;
    G.skills.lightning = G.skillCooldown('lightning');
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
    splashDamage(strike.x, strike.y, rule.radius * TILE, Game.lightningDamage(), '#bfe9ff');
    // 균열의 군주: 번개에 맞은 용사에게 낙인
    const mark = Game.lordPassive('lightningCurse');
    if (mark) {
        for (const h of Game.heroes) {
            if (h.dead || h.waiting) continue;
            const p = heroWorld(h);
            if (distance(strike.x, strike.y, p.x, p.y) <= rule.radius * TILE) curseHero(h, mark.duration, mark.takenMul);
        }
    }
    Sfx.play('lightning');
}

function castRoar() {
    const G = Game;
    const rule = COMBAT_RULES.roar;
    if (G.roarLocked() || G.skills.roar > 0) return false;
    G.skills.roar = G.skillCooldown('roar');
    for (const h of G.heroes) if (!h.dead) h.stun = Math.max(h.stun, rule.duration);
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty, 1500, '#ff6e8a', 0.8);
    Fx.anim('fx_blastPink', tx, ty - 40, 760, 0.7);
    Fx.ring(tx, ty, 900, '#ffd0db', 0.6);
    Fx.dim = 0.7;
    Fx.addShake(30);
    Fx.say(tx, ty - LORD_SAY_Y, '조용히 해!!!', 2.4);
    Sfx.play('roar');
    return true;
}

// 정지·감전의 대상 목록: (x, y)에서 반경 rangePx 안의 방어 쪽 전부(몬스터와 타락 유닛). 쓰러진 몬스터는 뺀다.
// 돌려주는 대상은 x, y와 stun(남은 정지 초)을 가진다.
function stunTargets(x, y, rangePx) {
    const list = [];
    for (const m of Game.monsters) if (!(m.down > 0) && distance(x, y, m.x, m.y) <= rangePx) list.push(m);
    for (const u of Game.units) if (!u.removed && distance(x, y, u.x, u.y) <= rangePx) list.push(u);
    return list;
}

// 저주: 받는 피해 x mul. 겹치지 않고 남은 시간만 seconds로 다시 채운다
function curseHero(hero, seconds, mul) {
    hero.curse = seconds;
    hero.curseMul = mul;
}

// 화상: 초당 dps 지속 피해. 겹치지 않고 남은 시간만 seconds로 다시 채운다(피해는 마지막에 건 값). owner는 처치 경험치를 받는 몬스터
function burnHero(hero, seconds, dps, owner) {
    if (!(hero.burn > 0)) hero.burnTick = 0.5; // 새로 붙으면 0.5초 뒤 첫 피해
    hero.burn = seconds;
    hero.burnDps = dps;
    hero.burnOwner = owner || null;
}

// 빙결: 이동 속도 x mul. 겹치지 않고 남은 시간만 다시 채운다(배율은 더 느린 쪽)
function slowHero(hero, seconds, mul) {
    hero.slowMul = hero.slow > 0 ? Math.min(hero.slowMul, mul) : mul;
    hero.slow = seconds;
    const p = heroWorld(hero);
    Fx.anim('fx_snowflake', p.x, p.y - 60, 135);
}

// 더 긴 쪽 정지를 남긴다
function applyStun(target, seconds) {
    target.stun = Math.max(target.stun || 0, seconds);
}
