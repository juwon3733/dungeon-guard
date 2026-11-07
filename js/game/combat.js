// 피해, 처치, 타락처럼 여러 객체가 함께 쓰는 전투 규칙.

// attacker: 피해를 준 몬스터. 이 피해로 쓰러지면 그 몬스터가 처치 경험치를 받는다(번개, 타락 유닛은 넘기지 않는다)
// dot이 true면 지속 피해(화상, 불 장판): 방어력을 무시하고 타격 섬광 없이 숫자만 띄운다. 실제로 준 피해를 돌려준다(흡혈)
const HERO_KICK_TIME = 0.14; // 맞아서 밀렸다 돌아오는 시간(초)
const KILL_POWER = [
    { size: 110, sparks: 3, shake: 0 }, // 일반 몬스터의 처치
    { size: 130, sparks: 4, shake: 0 },
    { size: 160, sparks: 6, shake: 2 },
    { size: 210, sparks: 8, shake: 4 },
    { size: 260, sparks: 10, shake: 6 } // 신화
];

function damageHero(hero, amount, fromX, fromY, color, attacker, dot) {
    if (hero.dead) return 0;
    // 계약 조항 방패 든 용사: 첫 공격(지속 피해 제외)을 막고 방패가 깨진다
    if (hero.shield > 0 && !dot) {
        hero.shield = 0;
        hero.flash = 0.12;
        const w = heroWorld(hero);
        Fx.burst(w.x, w.y - 30, '#bfe6ff', 6, 240, 0.3, 4);
        Sfx.play('shieldBreak');
        return 0;
    }
    // Why: 고정 방어력은 약한 연타에 불리하고 한 방이 큰 공격에 유리해, 궁수만 놓는 배치를 스스로 깎는다.
    // 저주(curseShot)에 걸려 있으면 방어력을 뺀 뒤의 피해가 늘어난다
    const big = hero.boss || hero.elite ? 1 + equipEffect(attacker && attacker.equip, 'bossDmg') : 1; // 장비: 정예와 보스 피해
    const base = dot ? amount : Math.max(1, amount * big - (hero.armor || 0));
    const dealt = base * (hero.curse > 0 ? hero.curseMul : 1);
    hero.hp -= dealt;
    if (hero.boss) Game.scoreBossDamage(Math.min(dealt, Math.max(0, hero.hp + dealt)));
    const p = heroWorld(hero);
    const small = !hero.boss && !hero.elite; // 떼로 나오는 일반 용사는 숫자를 띄우지 않아 화면을 가리지 않는다
    // 맞으면 때린 쪽 반대로 잠깐 밀린다(연출만, 길 위 거리는 그대로다)
    if (!dot && !hero.boss && fromX !== undefined) {
        const kx = p.x - fromX;
        const ky = p.y - fromY;
        const len = Math.sqrt(kx * kx + ky * ky) || 1;
        hero.kick = HERO_KICK_TIME;
        hero.kickX = kx / len;
        hero.kickY = ky / len;
    }
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

// 쓰러진 자리(길 위 거리)에서 용사를 새로 세운다: 계약 조항 되살아나기와 분열. 바로 걷는다
function heroRises(src, type, hpFrac, lane) {
    const h = createHero(type, Game.waveLevel(Game.currentWave()), 0, false, src.route);
    h.d = src.d;
    h.lane = lane === undefined ? src.lane : lane;
    h.hp = h.maxHp * hpFrac;
    h.waiting = false;
    h.delay = 0;
    Game.heroes.push(h);
    return h;
}

function killHero(hero, pos, attacker) {
    hero.dead = true;
    // 계약 조항: 되살아나는 용사는 체력 절반으로 다시 일어나고, 분열하는 정예는 일반 용사 여럿으로 갈라진다
    if (hero.revive) {
        heroRises(hero, hero.type, 0.5);
        Fx.burst(pos.x, pos.y - 30, '#fff1b0', 10, 260, 0.45, 5);
    }
    if (hero.elite && Game.mods.eliteSplit) {
        const base = HEROES[hero.type].base || 'warrior';
        for (let i = 0; i < Game.mods.eliteSplit; i++) heroRises(hero, HEROES[base] ? base : 'warrior', 1, (i - (Game.mods.eliteSplit - 1) / 2) * 24);
        Fx.burst(pos.x, pos.y - 40, '#ffb49a', 14, 300, 0.45, 5);
    }
    if (attacker) monsterKilledHero(attacker, hero);
    const G = Game;
    // 처치 골드(마왕과 유물의 bounty 포함). 일반 용사는 1보다 작아 모아서 준다
    const goldTouch = hero.elite || hero.boss ? G.lordPassive('goldTouch') : null;
    G.goldLeft = (G.goldLeft || 0) + hero.bounty * G.mods.bounty * (goldTouch ? goldTouch.eliteGold : 1) * (G.striking && G.power('coinLoot') ? 2 : 1) * (1 + equipEffect(attacker && attacker.equip, 'gold'));
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
        // 권능 시체: 쓰러진 자리를 기억하고, 몇 명째마다 그 자리가 터진다
        G.graves.push({ x: pos.x, y: pos.y });
        if (G.graves.length > COMBAT_RULES.raise.count) G.graves.shift();
        if (G.power('corpseBlast')) {
            const rule = COMBAT_RULES.corpseBlast;
            G.corpseCount++;
            if (G.corpseCount % (G.power('corpseQuick') ? rule.quickEvery : rule.every) === 0) corpseExplode(pos.x, pos.y, rule.radius, rule.damageMul);
        }
        // 권능 과부하: 처치가 번개를 충전한다
        const charge = G.power('frenzy') ? 0.3 : (G.power('killCharge') ? 0.1 : 0);
        if (charge) G.skills.lightning = Math.max(0, G.skills.lightning - charge);
        if (bounty > 0) Fx.coin(pos.x, pos.y - 30, 1, 1);
        // 처치한 몬스터의 등급만큼 크게 터진다. 흔들림은 영웅 이상만: 약한 처치까지 흔들면 화면이 늘 떨린다
        const killer = attacker && MONSTERS[attacker.type];
        const power = KILL_POWER[killer ? Math.max(0, GRADE_ORDER.indexOf(killer.grade)) : 0];
        Fx.anim('fx_explosion', pos.x, y, power.size, 0.3);
        Fx.burst(pos.x, y, '#ffffff', power.sparks, 300, 0.35, 5);
        Fx.burst(pos.x, y, '#ff9d4d', power.sparks, 240, 0.4, 4);
        if (power.shake) Fx.addShake(power.shake);
        G.streak = G.streakTimer > 0 ? G.streak + 1 : 1;
        G.streakTimer = 2.4;
        if (G.streak >= 2) G.streakPop = 1;
        Sfx.play(hero.elite ? 'killElite' : 'kill', G.streak);
        // 시체는 쓰러지는 장식이라 많으면 오래된 것부터 지운다
        const fall = HEROES[hero.type].anim && HEROES[hero.type].anim.death;
        const life = CORRUPTION_ENABLED ? COMBAT_RULES.corpseTime : (fall ? fall.frames / CORPSE_FALL_FPS : 0) + CORPSE_FADE_TIME;
        if (!CORRUPTION_ENABLED && G.corpses.length >= 40) G.corpses.shift();
        G.corpses.push({ type: hero.type, skin: hero.skin, anim: hero.anim, kickX: hero.kickX, kickY: hero.kickY, x: pos.x, y: pos.y, route: hero.route, d: hero.d, dir: hero.dir, age: 0, life, cost: bounty * COMBAT_RULES.corruptCostMul });
        return;
    }
    Fx.coin(pos.x, pos.y - 60, bounty);
    G.addMana(hero.boss ? POWER_RULES.manaBoss : POWER_RULES.manaElite, pos.x, pos.y - (hero.boss ? 300 : 140));
    if (hero.elite && G.power('eliteCharge')) G.skills.lightning = 0;
    Fx.hitStop(hero.boss ? 0.2 : 0.06); // 큰 처치에는 시간이 잠깐 멎는다
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
    Sfx.play(hero.elite ? 'killElite' : 'kill', G.streak);

    if (!hero.boss) {
        // 타락이 꺼져 있으면 시체는 쓰러지는 동작과 짧은 사라짐만 보여 주는 장식이다
        const fall = HEROES[hero.type].anim && HEROES[hero.type].anim.death;
        const life = CORRUPTION_ENABLED ? COMBAT_RULES.corpseTime : (fall ? fall.frames / CORPSE_FALL_FPS : 0) + CORPSE_FADE_TIME;
        // 쓰러지는 동작이 없는 그림(Asteria 정예)은 걷는 그림을 납작하게 눕혀 보여 준다(Render.drawCorpse의 skin)
        const skin = fall ? null : HEROES[hero.type];
        G.corpses.push({
            type: hero.type, x: pos.x, y: pos.y, route: hero.route, d: hero.d, dir: hero.dir,
            skin, anim: hero.anim, kickX: hero.kickX, kickY: hero.kickY,
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
    G.roundHit = true;
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
    const radius = Game.lightningRadius() * TILE;
    Fx.ring(strike.x, strike.y, radius, '#d8f3ff', 0.34);
    Fx.glow(strike.x, strike.y, 330, 'rgba(180,220,255,1)', 0.3);
    Fx.burst(strike.x, strike.y, '#d8f3ff', 42, 620, 0.5, 7);
    Fx.decals.push({ kind: 'scorch', x: strike.x, y: strike.y, age: 0, life: 9, radius: radius * 0.72 });
    // 맞기 전에 대상을 정해 둔다(이 번개에 쓰러진 용사는 뒤의 효과에서 빠진다)
    const struck = Game.heroes.filter(h => !h.dead && !h.waiting && distance(strike.x, strike.y, heroWorld(h).x, heroWorld(h).y) <= radius);
    Game.striking = true;
    splashDamage(strike.x, strike.y, radius, Game.lightningDamage() * (strike.mul || 1), '#bfe9ff');
    Game.striking = false;
    if (Game.power('coinRain')) Game.gold += struck.length;
    // 권능: 맞은 용사에게 붙는 효과
    const G = Game;
    const stun = G.power('longTear') ? 2 : (G.power('tear') ? 1 : 0);
    for (const h of struck) {
        if (h.dead) continue;
        if (G.power('smite') && (h.boss || h.elite)) {
            const p = heroWorld(h);
            damageHero(h, G.lightningDamage() * (strike.mul || 1), strike.x, strike.y, '#bfe9ff');
            Fx.anim('fx_hit_crit', p.x, p.y - 30, 200, 0.3);
            if (h.dead) continue;
        }
        if (stun) h.stun = Math.max(h.stun, stun);
        if (G.power('static')) slowHero(h, 3, 0.7);
        if (G.power('pull') && !h.boss) h.d = Math.max(0, h.d - 2 * TILE * (G.power('exile') ? 2 : 1));
    }
    // 권능 메아리: 1초 뒤 같은 자리에 약한 번개(메아리는 다시 메아리를 만들지 않는다)
    if (G.power('echo') && !strike.mul) G.pendingStrikes.push({ x: strike.x, y: strike.y, t: 1, mul: 0.5 });
    // 권능 연쇄 낙뢰: 범위 밖에서 가장 가까운 용사들에게 작은 번개
    if (G.power('chain') && !strike.mul) {
        const chain = COMBAT_RULES.chainStrike;
        const rest = G.heroes.filter(h => !h.dead && !h.waiting && !struck.includes(h));
        const dist = h => { const p = heroWorld(h); return distance(strike.x, strike.y, p.x, p.y); };
        rest.sort((a, b) => dist(a) - dist(b));
        for (const h of rest.slice(0, chain.count)) {
            if (h.dead) continue;
            const p = heroWorld(h);
            Fx.bolt(p.x, p.y, '#d8f3ff');
            Fx.anim('fx_hit_lightning', p.x, p.y - 10, 200, 0.35);
            splashDamage(p.x, p.y, chain.radius * TILE, G.lightningDamage() * chain.damageMul, '#bfe9ff');
        }
    }
    // 균열의 군주: 번개에 맞은 용사에게 낙인
    const mark = Game.lordPassive('lightningCurse');
    if (mark) {
        for (const h of Game.heroes) {
            if (h.dead || h.waiting) continue;
            const p = heroWorld(h);
            if (distance(strike.x, strike.y, p.x, p.y) <= radius) curseHero(h, mark.duration + (Game.power('markLong') ? 3 : 0), mark.takenMul);
        }
    }
    // 권능 심연의 손길(낙인보다 뒤에 걸어 배율을 정한다)
    if (Game.power('abyss')) for (const h of struck) if (!h.dead) curseHero(h, 5, 1.4);
    Sfx.play('lightning');
}

// 권능 균열 열기: 왕좌에 가장 가까운 용사들을 뒤로 되돌린다(보스 제외)
function castPortal() {
    const G = Game;
    const rule = COMBAT_RULES.portal;
    if (!G.power('gate') || G.skills.portal > 0) return false;
    const list = G.heroes.filter(h => !h.dead && !h.waiting && !h.boss);
    if (!list.length) return false;
    G.skills.portal = G.skillCooldown('portal');
    list.sort((a, b) => remainingDistance(a) - remainingDistance(b));
    for (const h of list.slice(0, rule.count)) {
        const from = heroWorld(h);
        Fx.anim('fx_blastViolet', from.x, from.y - 20, 180, 0.4);
        h.d = Math.max(0, h.d - rule.back * TILE * (G.power('exile') ? 2 : 1));
        if (G.power('abyss')) curseHero(h, 5, 1.4);
        const to = heroWorld(h);
        Fx.anim('fx_blastViolet', to.x, to.y - 20, 180, 0.4);
    }
    Fx.addShake(10);
    Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '다시 줄 서.', 2);
    Sfx.play('charge');
    return true;
}

// 권능 시체 폭발: 폭발 안에서 쓰러진 용사가 또 폭발을 부르지 않게 막는다
function corpseExplode(x, y, radius, damageMul) {
    const G = Game;
    if (G.blasting) return;
    G.blasting = true;
    const r = radius * (G.power('corpseBig') ? 2 : 1) * TILE;
    Fx.anim('fx_blastViolet', x, y - 20, r * 1.4, 0.4);
    splashDamage(x, y, r, G.lightningDamage() * damageMul, '#c9a6ff', h => { if (!h.dead && G.power('corpseFrost')) slowHero(h, 2, 0.7); });
    G.blasting = false;
}

// 권능 시체 일으키기: 최근 쓰러진 자리가 한꺼번에 터진다
function castRaise() {
    const G = Game;
    const rule = COMBAT_RULES.raise;
    if (!G.power('raise') || G.skills.raise > 0 || !G.graves.length) return false;
    G.skills.raise = G.skillCooldown('raise');
    for (const g of G.graves.slice()) corpseExplode(g.x, g.y, rule.radius, rule.damageMul);
    G.graves = [];
    Fx.addShake(12);
    Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '일어나서 한 번 더 죽어.', 2);
    Sfx.play('charge');
    return true;
}

// 권능 금화 폭격: 골드 일부를 써서 맨 앞 용사 둘레를 때린다. 쓴 돈만큼 세다
function castGoldBomb() {
    const G = Game;
    const rule = COMBAT_RULES.goldBomb;
    if (!G.power('goldBomb') || G.skills.goldBomb > 0 || G.gold < rule.minGold) return false;
    const front = G.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => remainingDistance(a) - remainingDistance(b))[0];
    if (!front) return false;
    const rich = G.power('bombRich');
    const spend = Math.min(rule.maxSpend, Math.floor(G.gold * (rich ? rule.richSpend : rule.spend)));
    G.gold -= spend;
    G.skills.goldBomb = G.skillCooldown('goldBomb');
    const p = heroWorld(front);
    const r = (rule.radius + (G.power('bombBig') ? rule.bigRadius : 0)) * TILE;
    Fx.anim('fx_blastGold', p.x, p.y - 30, r * 1.6, 0.5);
    Fx.ring(p.x, p.y, r, '#ffd34d', 0.4);
    Fx.addShake(14);
    splashDamage(p.x, p.y, r, spend * rule.damagePerGold * (rich ? 2 : 1), '#ffd34d');
    Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '영수증은 안 줘.', 2);
    Sfx.play('charge');
    return true;
}

function castRoar() {
    const G = Game;
    const rule = COMBAT_RULES.roar;
    if (G.roarLocked() || G.skills.roar > 0) return false;
    if (G.power('bribeRoar')) {
        const cost = Math.floor(COMBAT_RULES.bribeRoar.cost * (G.power('bribeCheap') ? 0.5 : 1));
        if (G.gold < cost) return false;
        G.gold -= cost;
    }
    G.skills.roar = G.skillCooldown('roar');
    if (G.power('rally')) G.skills.lightning = 0;
    for (const h of G.heroes) {
        if (h.dead) continue;
        h.stun = Math.max(h.stun, rule.duration + (G.power('longRoar') ? 1 : 0));
        if (G.power('traitor')) curseHero(h, 3, 1.3);
    }
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
