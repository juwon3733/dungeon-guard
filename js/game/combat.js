// 피해, 처치, 타락처럼 여러 객체가 함께 쓰는 전투 규칙.

// attacker: 피해를 준 몬스터. 이 피해로 쓰러지면 그 몬스터가 처치 경험치를 받는다(번개, 타락 유닛은 넘기지 않는다)
// dot이 true면 지속 피해(화상, 불 장판): 방어력을 무시하고 타격 섬광 없이 숫자만 띄운다. 실제로 준 피해를 돌려준다(흡혈)
const HERO_KICK_TIME = 0.14; // 맞아서 밀렸다 돌아오는 시간(초)
const KILL_POWER = [
    { size: 110, sparks: 3, shake: 0 }, // 일반 몬스터의 처치
    { size: 130, sparks: 4, shake: 0 },
    { size: 160, sparks: 6, shake: 2 },
    { size: 210, sparks: 8, shake: 4 },
    { size: 260, sparks: 10, shake: 6 }, // 신화
    { size: 300, sparks: 12, shake: 7 } // 초월
];

function damageHero(hero, amount, fromX, fromY, color, attacker, dot) {
    if (hero.dead) return 0;
    // 보스 패턴 무적 방패: 막는 동안 피해 없음
    if (hero.shieldT > 0) {
        const p = heroWorld(hero);
        if (!dot && !Fx.noNumbers) Fx.number(hero, p.x, p.y - 300, '막음', '#ffe08a', true);
        return 0;
    }
    // 유물과 치명타(몬스터의 직접 공격만). 지속 피해와 튀김은 치명타가 없다
    const base0 = amount;
    let crit = false;
    if (!dot && attacker && attacker.kind === 'monster') {
        const r = relicHitDamage(hero, amount, attacker);
        amount = r.amount;
        crit = r.crit;
    }
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
    const big = hero.boss || hero.elite ? 1 + monsterEquip(attacker, 'bossDmg') : 1; // 장비: 정예와 보스 피해
    const sick = hero.poison > 0;
    const shred = hero.shredUntil > Game.time ? hero.shredMul : 1; // 웅덩이(공격 모양 puddle): 방어력이 준다
    const armor = sick && Game.power('venomPierce') ? 0 : (hero.armor || 0) * shred; // 권능 살을 파는 독
    const base = dot ? amount : Math.max(1, amount * big - armor);
    const rot = sick ? 1 + (Game.power('rotCurse') ? 0.15 : 0) + (Game.power('rotDeep') ? 0.3 : 0) : 1; // 권능 썩은 살, 깊은 부패
    const held = hero.bound > 0 ? 1 + (Game.power('execBound') ? 0.2 : 0) + (Game.power('execDeep') ? 0.4 : 0) : 1; // 권능 형틀, 고문
    const ring = Game.power('slowAura') && clockSlowMul(hero) < 1 ? 1.15 : 1; // 권능 시계 소리: 감속 중인 용사
    const guarded = guardReduce(hero); // 방패병 둘레
    const dealt = base * (hero.curse > 0 ? hero.curseMul : 1) * rot * held * ring * guarded;
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
    // 피해 숫자(2026-11-09, 11-11 고침): 치명타는 크고 주황 "N!", 보통 공격은 흰 숫자(일반 용사는 쓰러뜨린 한 방만), 지속 피해는 그 색(독 초록, 화상 주황)으로
    //   정예와 보스의 숫자만 크다. 떼로 오는 일반 용사의 지속 피해 숫자는 띄우지 않는다. 설정에서 끌 수 있다(Fx.noNumbers)
    const numY = p.y - (hero.boss ? 300 : hero.elite ? 180 : 110);
    if (crit) {
        if (!Fx.noNumbers) Fx.number(hero, p.x, numY, `${Math.round(dealt)}!`, '#ff8a2a', true);
        Fx.anim('fx_hit_crit', p.x, p.y - (hero.boss ? 140 : 46), hero.boss ? 260 : 170, 0.26);
    } else if (!Fx.noNumbers && !(dot && small) && (!small || hero.hp <= 0)) Fx.number(hero, p.x, numY, Math.round(dealt), dot ? (color || '#b6f07a') : '#ffffff', !small); // 떼로 오는 일반 용사는 쓰러뜨린 한 방만(숫자가 겹쳐 읽히지 않게)
    if (!dot && small) {
        hero.flash = 0.09;
        Fx.burst(p.x, p.y - 22, color || '#ffd26a', 2, 200, 0.25, 4);
    } else if (!dot) {
        hero.flash = 0.09;
        Fx.burst(p.x, p.y - (hero.boss ? 140 : 45), color || '#ffd26a', 4, 260, 0.3, 6);
        Fx.anim(dealt >= 20 ? 'fx_hit_crit' : 'fx_hit_physical', p.x + randRange(-21, 21), p.y - (hero.boss ? 140 : 48) + randRange(-18, 18), dealt >= 20 ? 225 : 135, 0.26);
    }
    // 권능 참수: 체력이 바닥인 묶인 일반 용사는 바로 쓰러진다
    if (hero.hp > 0 && hero.bound > 0 && small && Game.power('execLow') && hero.hp <= hero.maxHp * COMBAT_RULES.chain.lowBelow) hero.hp = 0;
    if (hero.hp <= 0) killHero(hero, p, attacker);
    // 잔혹한 칼날: 치명타로 쓰러뜨리면 둘레에 그 피해의 절반
    if (crit && hero.dead && Game.mods.critSplash) relicSplash(p.x, p.y, TILE, dealt * Game.mods.critSplash, '#ffd23d', attacker, hero);
    // 쌍날 검: 확률로 한 번 더(두 번째 공격은 다시 굴리지 않는다)
    if (!dot && attacker && attacker.kind === 'monster' && Game.mods.doubleHit && !hero.dead && !Game.doubleHitting && rng('battle') < Game.mods.doubleHit) {
        Game.doubleHitting = true;
        damageHero(hero, base0, fromX, fromY, color, attacker);
        Game.doubleHitting = false;
    }
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
    const byPoison = Game.poisonKill;
    if (hero.poison > 0 || byPoison) plagueSpread(hero, pos);
    if (byPoison) plagueKill(hero, pos);
    if (hero.bound > 0) chainKill(hero, pos);
    clockKill(hero);
    relicOnKill(hero, pos, attacker);
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
    if (hero.event) G.eventHeroGone(hero, false);
    // 처치 골드(마왕과 유물의 bounty 포함). 일반 용사는 1보다 작아 모아서 준다
    const goldTouch = hero.elite || hero.boss ? G.lordPassive('goldTouch') : null;
    G.goldLeft = (G.goldLeft || 0) + hero.bounty * (byPoison && G.power('spreadGold') ? 1.5 : 1) * (hero.bound > 0 && G.power('execGold') ? 1.5 : 1) * G.mods.bounty * (goldTouch ? goldTouch.eliteGold : 1) * (G.bombing && G.power('coinLoot') ? 2 : 1) * (G.bribing && G.power('bribeCheap') ? 2 : 1) * (hero.gildT > G.stats.time ? 2 : 1) * (1 + monsterEquip(attacker, 'gold')) * (hero.goldMul || 1);
    const bounty = Math.floor(G.goldLeft + 1e-9);
    G.goldLeft -= bounty;
    G.gold += bounty;
    G.stats.kills++;
    G.scoreKill(hero);
    G.soulVolley();
    if (hero.elite) G.eliteDrop(pos.x, pos.y - 60); // 정예는 장비를 떨어뜨릴 수 있다(EQUIP_RULES)
    if (hero.type === 'gold_goblin') {
        // 보물 고블린: 금화가 크게 터진다
        Fx.anim('fx_coin_blast', pos.x, pos.y - 40, 128 * 2 / WORLD_ZOOM, 0.6);
        Fx.burst(pos.x, pos.y - 30, '#ffd34d', 20, 320, 0.6, 7);
        Fx.number({}, pos.x, pos.y - 160, `+${bounty}G`, '#ffd34d', true);
        Fx.addShake(6);
    }
    if (!hero.boss && !hero.elite) {
        // 떼로 터지는 일반 용사: 작은 폭발과 파편만. 많이 터져도 화면과 속도를 버티게 가볍게 그린다
        const y = pos.y - 24;
        // 쓰러진 자리를 기억한다(뼈의 여왕 망령 깨우기, 무덤 폭발). 권능 시체 폭발은 몇 명째마다 그 자리가 터진다
        G.graves.push({ x: pos.x, y: pos.y, type: hero.type, route: hero.route, d: hero.d, dir: hero.dir });
        if (G.graves.length > COMBAT_RULES.graveBlast.count) G.graves.shift();
        if (G.power('corpseBlast')) {
            const rule = COMBAT_RULES.corpseBlast;
            G.corpseCount++;
            if (G.corpseCount % (G.power('corpseQuick') ? rule.quickEvery : rule.every) === 0) corpseExplode(pos.x, pos.y, rule.radius, rule.damageMul);
        }
        // 권능 과부하: 처치가 스킬 1(낙뢰)을 충전한다
        const charge = G.power('frenzy') ? 0.3 : (G.power('killCharge') ? 0.1 : 0);
        const q = G.skillKey(0);
        if (charge) G.skills[q] = Math.max(0, G.skills[q] - charge);
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
    if (hero.elite && G.power('eliteCharge')) G.skills[G.skillKey(0)] = 0;
    Fx.hitStop(hero.boss ? 0.2 : 0.06); // 큰 처치에는 시간이 잠깐 멎는다
    // 처치: 터지는 빛, 흰 불꽃과 주황 파편, 금화, 떠오르는 골드 글자(연출만, 계산과 무관)
    const cy = pos.y - (hero.boss ? 140 : 45);
    Fx.burst(pos.x, cy, hero.boss ? '#c893ff' : '#ffffff', hero.boss ? 70 : 20, hero.boss ? 680 : 380, 0.5, 7);
    Fx.burst(pos.x, cy, '#ff9d4d', hero.boss ? 36 : 12, 300, 0.45, 6);
    Fx.burst(pos.x, cy, '#ffd34d', hero.boss ? 24 : 8, 220, 0.6, 8);
    Fx.ring(pos.x, pos.y - 36, hero.boss ? 320 : 110, '#ffe9b0', 0.3);
    Fx.anim(hero.boss ? 'fx_adv_arcanist_thunderGod' : 'fx_explosion', pos.x, pos.y - (hero.boss ? 140 : 51), hero.boss ? 700 : 300, hero.boss ? 0.8 : 0.36);
    // 동전 폭발(Asteria, 128px 시트): 정예는 2배, 보스는 3배 크기(그림 1px의 정수배)
    if (hero.elite || hero.boss) Fx.anim('fx_coin_blast', pos.x, pos.y - 60, 128 * (hero.boss ? 3 : 2) / WORLD_ZOOM, 0.6);
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

function damageThrone(amount, heroName, boss) {
    const G = Game;
    // 반사막과 거울 방패: 보통 피해는 막고, 보스 도착 피해는 절반만 막는다(거울 마녀만 보스 벽을 건너뛰지 않게)
    if (boss) {
        if (mirrorWardBlocks() || mirrorShieldBlocks()) amount = Math.ceil(amount / 2);
    } else {
        if (mirrorWardBlocks()) return; // 거울 마녀 반사막(Q)
        if (mirrorShieldBlocks()) return; // 권능 거울 방패
    }
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
    clockThroneHit(amount);
    if (G.hp <= 0 && !clockSavesThrone() && !relicUndying()) G.finish(false); // 시계탑: 마지막 1초, 유물 불사의 왕관
    else mirrorThroneHit(); // 거울 마녀: 반사 갈래
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
    // 균열의 군주: 최대 체력에 비례한 추가 피해(깊은 층에서도 번개가 의미 있게)
    const mark = Game.lordPassive('lightningCurse');
    if (mark && mark.hpRatio) {
        Game.striking = true;
        for (const h of struck) {
            if (h.dead) continue;
            damageHero(h, h.maxHp * mark.hpRatio * (strike.mul || 1), strike.x, strike.y, '#bfe9ff', null, true);
        }
        Game.striking = false;
    }
    // 권능: 맞은 용사에게 붙는 효과
    const G = Game;
    for (const h of struck) {
        if (h.dead) continue;
        if (G.power('smite') && (h.boss || h.elite)) {
            const p = heroWorld(h);
            damageHero(h, G.lightningDamage() * (strike.mul || 1), strike.x, strike.y, '#bfe9ff');
            Fx.anim('fx_hit_crit', p.x, p.y - 30, 200, 0.3);
            if (h.dead) continue;
        }
        if (G.power('static')) slowHero(h, 3, 0.7);
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

// 왕좌에 가장 가까운 용사부터 n명(filter로 거른다)
function frontHeroes(n, filter) {
    return Game.heroes.filter(h => !h.dead && !h.waiting && (!filter || filter(h))).sort((a, b) => remainingDistance(a) - remainingDistance(b)).slice(0, n);
}

// 스킬 피해: 기본값에 라운드마다 perRound씩 더 곱한다(뒤 라운드에서도 쓸모 있게)
function skillPower(G, key) {
    const rule = COMBAT_RULES[key];
    return rule.damage * (1 + (rule.perRound || 0) * G.waveIndex);
}

// 마왕 말풍선(스킬을 쓸 때)
function lordSay(text) {
    Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, text, 2);
}

// 균열의 군주 W 균열 문: 왕좌에 가장 가까운 용사들을 뒤로 되돌린다(보스 제외). 권능 균열 갈래가 강화한다
function portalCount() { return COMBAT_RULES.portal.count + (Game.power('pull') ? COMBAT_RULES.portal.pullUp : 0); }
function castPortal() {
    const G = Game;
    const rule = COMBAT_RULES.portal;
    if (G.skills.portal > 0) return false;
    const list = frontHeroes(portalCount(), h => !h.boss);
    if (!list.length) return false;
    G.skills.portal = G.skillCooldown('portal');
    const stun = G.power('longTear') ? 2 : (G.power('tear') ? 1 : 0);
    for (const h of list) {
        const from = heroWorld(h);
        Fx.anim('fx_blastViolet', from.x, from.y - 20, 180, 0.4);
        h.d = Math.max(0, h.d - rule.back * TILE * (G.power('exile') ? 2 : 1));
        if (stun) applyStun(h, stun);
        if (G.power('abyss')) curseHero(h, 5, 1.4);
        const to = heroWorld(h);
        Fx.anim('fx_blastViolet', to.x, to.y - 20, 180, 0.4);
    }
    Fx.addShake(10);
    Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '다시 줄 서.', 2);
    Sfx.play('charge');
    return true;
}

// 균열의 군주 E 뇌우: 맨 앞 용사들에게 차례로 약한 낙뢰(메아리와 연쇄는 붙지 않는다)
function castThunder() {
    const G = Game;
    const rule = COMBAT_RULES.thunder;
    if (G.skills.thunder > 0) return false;
    const list = frontHeroes(rule.count);
    if (!list.length) return false;
    G.skills.thunder = G.skillCooldown('thunder');
    list.forEach((h, i) => { const p = heroWorld(h); G.pendingStrikes.push({ x: p.x, y: p.y, t: 0.16 + i * rule.gap, mul: rule.mul }); });
    Fx.dim = 0.75;
    lordSay('비 온다, 우산은 없다.');
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
    const grow = 1 + COMBAT_RULES.corpseBlast.perRound * G.waveIndex; // 뒤 라운드에서도 쓸모 있게
    splashDamage(x, y, r, G.lightningDamage() * damageMul * grow, '#c9a6ff', h => { if (!h.dead && G.power('corpseFrost')) slowHero(h, 2, 0.7); });
    G.blasting = false;
}

// 뼈의 여왕 E 무덤 폭발: 최근 쓰러진 자리가 한꺼번에 터진다
function castGraveBlast() {
    const G = Game;
    const rule = COMBAT_RULES.graveBlast;
    if (G.skills.graveBlast > 0 || !G.graves.length) return false;
    G.skills.graveBlast = G.skillCooldown('graveBlast');
    for (const g of G.graves.slice()) corpseExplode(g.x, g.y, rule.radius, rule.damageMul);
    G.graves = [];
    Fx.addShake(12);
    lordSay('일어나서 한 번 더 죽어.');
    Sfx.play('charge');
    return true;
}

// 뼈의 여왕 Q 뼈 창: 왕좌에서 맨 앞 용사로 창을 던져, 맨 앞 용사와 그 뒤 length칸 안의 용사를 모두 꿰뚫는다
function castBoneSpear() {
    const G = Game;
    const rule = COMBAT_RULES.boneSpear;
    if (G.skills.boneSpear > 0) return false;
    const front = frontHeroes(1)[0];
    if (!front) return false;
    G.skills.boneSpear = G.skillCooldown('boneSpear');
    const fp = heroWorld(front);
    const lead = remainingDistance(front);
    const reach = rule.length * TILE;
    const hit = G.heroes.filter(h => {
        if (h.dead || h.waiting) return false;
        const w = heroWorld(h);
        return remainingDistance(h) >= lead && remainingDistance(h) <= lead + reach && distance(w.x, w.y, fp.x, fp.y) <= reach;
    });
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row) - 60;
    Fx.beam(tx, ty, fp.x, fp.y - 30, '#efe6d0', 18, 0.3);
    Fx.anim('fx_arrowBig', fp.x, fp.y - 30, 220, 0.35, Math.atan2(fp.y - 30 - ty, fp.x - tx));
    const damage = skillPower(G, 'boneSpear');
    for (const h of hit) {
        const w = heroWorld(h);
        Fx.anim('fx_hit_crit', w.x, w.y - 30, 170, 0.3);
        damageHero(h, damage, fp.x, fp.y, '#efe6d0');
        if (!h.dead) damageHero(h, h.maxHp * rule.hpRatio, fp.x, fp.y, '#efe6d0', null, true);
    }
    Fx.addShake(8);
    lordSay('꼬치로 꿰어 주마.');
    Sfx.play('charge');
    return true;
}

// 뼈의 여왕 W 망령 깨우기: 최근 쓰러진 용사들이 타락 유닛처럼 일어나 잠깐 싸운다(시간이 다 되면 사라진다)
function castGhosts() {
    const G = Game;
    const rule = COMBAT_RULES.ghosts;
    if (G.skills.ghosts > 0 || !G.graves.length) return false;
    const list = G.graves.slice(-rule.count);
    G.graves = G.graves.slice(0, G.graves.length - list.length);
    G.skills.ghosts = G.skillCooldown('ghosts');
    for (const g of list) {
        const base = HEROES[g.type] && HEROES[g.type].base;
        const kind = CORRUPTED[g.type] ? g.type : (CORRUPTED[base] ? base : 'warrior');
        const u = createCorruptUnit({ type: kind, x: g.x, y: g.y, route: g.route, d: g.d, dir: g.dir });
        if (HEROES[g.type]) u.heroType = g.type; // 그림은 쓰러진 용사 그대로
        u.hp = u.maxHp = u.maxHp * (1 + rule.hpPerRound * G.waveIndex);
        u.damage *= 1 + rule.damagePerRound * G.waveIndex;
        u.life = rule.life;
        u.ghost = true;
        G.units.push(u);
        Fx.anim('fx_adv_doomMelody_requiem', g.x, g.y - 20, 220, 0.6);
        Fx.rise(g.x, g.y, '#c9a6ff', 18, 30, 0.7);
    }
    Fx.addShake(8);
    lordSay('일어나라, 내 아이들아.');
    Sfx.play('corrupt');
    return true;
}

// 황금 마왕 Q 금화 폭격: 골드 일부를 써서 맨 앞 용사 둘레를 때린다. 쓴 돈만큼 세다
function castGoldBomb() {
    const G = Game;
    const rule = COMBAT_RULES.goldBomb;
    if (G.skills.goldBomb > 0 || G.gold < rule.minGold) return false;
    const front = frontHeroes(1)[0];
    if (!front) return false;
    const rich = G.power('bombRich');
    const spend = Math.min(rule.maxSpend, Math.floor(G.gold * (rich ? rule.richSpend : rule.spend)));
    G.gold -= spend;
    G.skills.goldBomb = G.skillCooldown('goldBomb');
    const p = heroWorld(front);
    const r = (rule.radius + (G.power('coinWide') ? rule.wideUp : 0) + (G.power('bombBig') ? rule.bigRadius : 0)) * TILE;
    Fx.anim('fx_blastGold', p.x, p.y - 30, r * 1.6, 0.5);
    Fx.anim('fx_coin_blast', p.x, p.y - 30, r * 1.2, 0.5);
    Fx.ring(p.x, p.y, r, '#ffd34d', 0.4);
    Fx.addShake(14);
    G.bombing = true; // 권능 전리품(처치 골드 2배)
    const mul = (rich ? 2 : 1) * (G.power('goldFocus') ? 1.25 : 1);
    const hits = splashDamage(p.x, p.y, r, spend * rule.damagePerGold * mul, '#ffd34d', h => { if (!h.dead && rule.hpRatio) damageHero(h, h.maxHp * rule.hpRatio * mul, p.x, p.y, '#ffd34d', null, true); });
    G.bombing = false;
    if (G.power('coinRain')) G.gold += hits;
    lordSay('영수증은 안 줘.');
    Sfx.play('charge');
    return true;
}

// 황금 마왕 W 매수: 가장 앞선 정예(보스 제외)를 골드를 내고 바로 처치한다. 값은 남은 체력에 비례한다
function bribeTarget() { return frontHeroes(1, h => h.elite && !h.boss)[0] || null; }
function bribeCost(h) {
    const rule = COMBAT_RULES.bribe;
    return Math.max(rule.minCost, Math.ceil(h.hp * rule.goldPerHp * (Game.power('longRoar') ? 0.75 : 1)));
}
function castBribe() {
    const G = Game;
    const rule = COMBAT_RULES.bribe;
    if (G.skills.bribe > 0) return false;
    const h = bribeTarget();
    if (!h) return false;
    const cost = bribeCost(h);
    if (G.gold < cost) return false;
    G.gold -= cost;
    G.skills.bribe = G.skillCooldown('bribe');
    const p = heroWorld(h);
    if (G.power('traitor')) for (const o of G.heroes) if (!o.dead && !o.waiting) curseHero(o, 3, 1.3);
    if (G.power('bribeRoar')) {
        for (const o of G.heroes) {
            if (o === h || o.dead || o.waiting) continue;
            const w = heroWorld(o);
            if (distance(p.x, p.y, w.x, w.y) <= rule.stunRadius * TILE) applyStun(o, rule.stun);
        }
    }
    Fx.coin(p.x, p.y - 40, cost, 12);
    Fx.anim('fx_gold', p.x, p.y - 40, 240, 0.5);
    G.bribing = true; // 권능 단골(처치 골드 2배)
    h.hp = 0;
    killHero(h, p, null);
    G.bribing = false;
    Fx.number(h, p.x, p.y - 200, `-${cost}G`, '#ffd34d', true);
    lordSay('얼마면 돼?');
    Sfx.play('charge');
    return true;
}

// 황금 마왕 E 황금 손: 맨 앞 용사들이 잠깐 황금으로 굳는다(정지). 굳은 동안 처치하면 골드 두 배(killHero)
function castMidas() {
    const G = Game;
    const rule = COMBAT_RULES.midas;
    if (G.skills.midas > 0) return false;
    const list = frontHeroes(rule.count);
    if (!list.length) return false;
    G.skills.midas = G.skillCooldown('midas');
    for (const h of list) {
        const t = h.boss ? rule.bossDuration : rule.duration;
        applyStun(h, t);
        h.gildT = G.stats.time + t;
        const w = heroWorld(h);
        Fx.anim('fx_blastGold', w.x, w.y - 30, 200, 0.4);
    }
    Fx.addShake(8);
    lordSay('너희도 내 재산이다.');
    Sfx.play('charge');
    return true;
}

// ----- 역병의 군주 -----

// 독: seconds초 동안 초당 dps(배율 전). 이미 걸려 있으면 시간을 다시 채우고, 겹치는 독(권능)이면 3번까지 겹친다
function poisonHero(hero, seconds, dps, owner, spread) {
    if (hero.dead || !(dps > 0)) return;
    const G = Game;
    const time = seconds + (G.power('venomLong') ? 2 : 0);
    if (hero.poison > 0) {
        hero.poisonStacks = G.power('venomStack') ? Math.min(3, hero.poisonStacks + 1) : 1;
        hero.poisonDps = Math.max(hero.poisonDps, dps);
        if (!spread) hero.poisonSpread = false;
    } else {
        hero.poisonStacks = 1;
        hero.poisonDps = dps;
        hero.poisonTick = 0.5;
        hero.poisonSpread = !!spread;
    }
    hero.poison = Math.max(hero.poison, time);
    if (owner) hero.poisonOwner = owner;
}

// 독의 초당 피해(권능 배율 포함)
function poisonDps(h) {
    const G = Game;
    let d = h.poisonDps * Math.max(1, h.poisonStacks);
    if (G.power('venomStrong')) d *= 1.2;
    if (h.poisonSpread && G.power('spreadStrong')) d *= 1.5;
    if ((h.boss || h.elite) && G.power('venomBoss')) d *= 1.3;
    return d;
}

function poisonDamage(h, amount) {
    const w = heroWorld(h);
    const owner = h.poisonOwner && !h.poisonOwner.removed ? h.poisonOwner : null;
    Game.poisonKill = true;
    damageHero(h, amount, w.x, w.y, '#8eea3f', owner, true);
    Game.poisonKill = false;
}

function poisonTickDamage(h) {
    poisonDamage(h, poisonDps(h) * 0.5);
    // 권능 숨통: 체력이 바닥인 독 걸린 일반 용사는 바로 쓰러진다
    if (!h.dead && !h.boss && !h.elite && Game.power('venomDeath') && h.hp <= h.maxHp * COMBAT_RULES.plague.deathBelow) poisonDamage(h, h.hp + 1);
}

// 독이 끝남: 권능 독 폭발은 남은 2초치를 한 번에
function poisonEnds(h) {
    if (Game.power('venomBurst')) {
        const w = heroWorld(h);
        Fx.anim('fx_acid_splash', w.x, w.y - 10, 90, 0.5);
        poisonDamage(h, poisonDps(h) * COMBAT_RULES.plague.burstSeconds);
    }
    h.poisonStacks = 0;
}

// 독 걸린 채 쓰러짐: 둘레의 용사에게 옮는다(보스 제외, 정예는 권능 고열)
function plagueSpread(hero, pos) {
    const G = Game;
    const p = G.lordPassive('plague');
    if (!p || !(hero.poisonDps > 0)) return;
    const r = (p.radius + (G.power('spreadWide') ? 1 : 0)) * TILE;
    Fx.anim('fx_acid_splash', pos.x, pos.y - 6, r * 1.3, 0.5);
    for (const h of G.heroes) {
        if (h === hero || h.dead || h.waiting || h.boss || (h.elite && !G.power('spreadElite'))) continue;
        const w = heroWorld(h);
        if (distance(pos.x, pos.y, w.x, w.y) > r) continue;
        poisonHero(h, p.duration, hero.poisonDps, hero.poisonOwner, true);
        if (G.power('spreadChain')) slowHero(h, 2, 0.7);
    }
}

// 독으로 쓰러뜨림: 정수 추출(정예 마력), 시체 가스(자리 폭발), 대유행(모든 독을 처음부터)
function plagueKill(hero, pos) {
    const G = Game;
    const rule = COMBAT_RULES.plague;
    G.poisonKill = false; // 아래의 폭발 피해는 독이 아니다(연쇄 폭발을 막는다)
    if (hero.elite && G.power('rotMana')) G.addMana(1, pos.x, pos.y - 140);
    if (!hero.elite && !hero.boss && G.power('rotBlast')) {
        Fx.anim('fx_acid_splash', pos.x, pos.y - 6, rule.blastRadius * TILE * 1.6, 0.5);
        splashDamage(pos.x, pos.y, rule.blastRadius * TILE, hero.maxHp * rule.blastMul, '#8eea3f');
    }
    G.poisonKills++;
    if (G.power('pandemic') && G.poisonKills % rule.pandemicEvery === 0) {
        const p = G.lordPassive('plague');
        for (const h of G.heroes) if (!h.dead && h.poison > 0) h.poison = Math.max(h.poison, (p ? p.duration : 3) + (G.power('venomLong') ? 2 : 0));
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, '모두 다시 앓아라.', 2);
    }
    G.poisonKill = true;
}

// 역병의 군주 Q 독 화살비: 고른 자리에 독 화살이 쏟아진다(피해와 중독)
function castVenomRain(x, y) {
    const G = Game;
    const rule = COMBAT_RULES.venomRain;
    if (G.skills.venomRain > 0 || !(x >= 0) || !(y >= 0)) return false;
    G.skills.venomRain = G.skillCooldown('venomRain');
    const r = rule.radius * TILE;
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        Fx.anim('fx_arrowPoison', x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.35 - 40, 120, 0.35, Math.PI / 2);
    }
    Fx.anim('fx_acid_splash', x, y - 6, r * 1.4, 0.5);
    Fx.ring(x, y, r, '#8eea3f', 0.35);
    const dps = rule.dps + rule.dpsPerRound * G.waveIndex;
    splashDamage(x, y, r, skillPower(G, 'venomRain'), '#8eea3f', h => { if (!h.dead) poisonHero(h, rule.poison, dps, null); });
    Fx.addShake(8);
    Sfx.play('lightning');
    return true;
}

// 역병의 군주 W 역병 구름: 맨 앞 용사 자리에 독 구름(장판). 안의 용사는 0.5초마다 독이 다시 걸린다
function castMiasma() {
    const G = Game;
    const rule = COMBAT_RULES.miasma;
    if (G.skills.miasma > 0) return false;
    const front = G.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => remainingDistance(a) - remainingDistance(b))[0];
    if (!front) return false;
    G.skills.miasma = G.skillCooldown('miasma');
    const p = heroWorld(front);
    const big = G.power('cloudBig');
    G.hazards.push({ kind: 'poison', x: p.x, y: p.y, radius: rule.radius * (big ? 2 : 1) * TILE, dps: rule.dps + rule.dpsPerRound * G.waveIndex, life: rule.duration + (big ? rule.bigDuration : 0), age: 0, tick: 0, owner: null });
    lordSay('숨 깊이 들이마셔.');
    Sfx.play('charge');
    return true;
}

// 역병의 군주 E 창궐: 중독된 용사마다 남은 독 피해를 한 번에 받는다(독은 끝난다)
function castOutbreak() {
    const G = Game;
    const rule = COMBAT_RULES.outbreak;
    if (G.skills.outbreak > 0) return false;
    const sick = G.heroes.filter(h => !h.dead && !h.waiting && h.poison > 0);
    if (!sick.length) return false;
    G.skills.outbreak = G.skillCooldown('outbreak');
    for (const h of sick) {
        const amount = poisonDps(h) * h.poison * rule.mul;
        const w = heroWorld(h);
        Fx.anim('fx_acid_splash', w.x, w.y - 10, 150, 0.5);
        h.poison = 0;
        h.poisonStacks = 0;
        poisonDamage(h, amount);
    }
    Fx.addShake(10);
    lordSay('한꺼번에 앓아라.');
    Sfx.play('charge');
    return true;
}

// ----- 사슬의 군주 -----

// 묶기: seconds초 동안 멈춘다(정지). 묶인 동안 처형 갈래의 보너스가 붙고, 끌기 갈래는 뒤로 당긴다
function bindHero(h, seconds) {
    const G = Game;
    if (h.dead) return;
    const t = seconds * (G.power('shackleLock') && h.boundOnce ? 1.5 : 1); // 권능 단단한 자물쇠: 두 번째부터 1.5배
    h.boundOnce = true;
    h.bound = Math.max(h.bound || 0, t);
    applyStun(h, t);
    if (h.boss) return;
    const far = G.power('dragFar') ? 2 : 1;
    const back = (G.power('dragBack') ? 0.5 : 0) + (h.elite && G.power('dragHook') ? 2 : 0);
    if (back) h.d = Math.max(0, h.d - back * TILE * far);
    // 권능 구덩이: 묶인 일반 용사 5명째마다 입구로
    if (!h.elite && G.power('dragPit') && ++G.bindCount % COMBAT_RULES.chain.pitEvery === 0) h.d = 0;
}

// 몬스터에게 맞음: 확률로 묶는다(보스와 정예는 절반, 권능 무거운 족쇄면 정예도 그대로)
function chainOnHit(hero) {
    const G = Game;
    const p = G.lordPassive('shackle');
    if (!p || hero.dead || hero.bound > 0) return;
    let chance = p.chance + (G.power('shackleChance') ? COMBAT_RULES.chain.chanceUp : 0);
    // 보스는 맞는 횟수가 많아 거의 계속 묶이지 않게 확률 1/5, 시간 절반. 정예는 확률 절반(무거운 족쇄면 그대로)
    if (hero.boss) chance *= 0.2;
    else if (hero.elite && !G.power('shackleElite')) chance *= 0.5;
    if (rng('battle') >= chance) return;
    const time = (p.duration + (G.power('shackleLong') ? COMBAT_RULES.chain.longUp : 0)) * (hero.boss ? 0.5 : 1);
    bindHero(hero, time);
    const w = heroWorld(hero);
    Fx.ring(w.x, w.y - 10, 60, '#c9c2b8', 0.25);
    // 권능 사슬 엮기: 1칸 안의 다른 용사 1명도 묶인다
    if (G.power('shackleChain')) {
        const other = G.heroes.find(h => h !== hero && !h.dead && !h.waiting && !h.boss && !(h.bound > 0) && distance(w.x, w.y, heroWorld(h).x, heroWorld(h).y) <= TILE);
        if (other) bindHero(other, time);
    }
}

// 묶임이 풀림: 권능 찢기는 사슬(최대 체력 5% 피해), 저린 다리(2초간 이동 -25%)
function chainReleased(h) {
    const G = Game;
    if (G.power('shackleBreak')) {
        const w = heroWorld(h);
        damageHero(h, h.maxHp * COMBAT_RULES.chain.breakDamage, w.x, w.y, '#c9c2b8', null, true);
    }
    if (!h.dead && G.power('dragSlow')) slowHero(h, 2, 0.75);
}

// 묶인 채 쓰러짐: 권능 몸값(골드는 killHero), 형틀(정예 마력), 연쇄 형벌(1칸 안 1명 묶음)
function chainKill(hero, pos) {
    const G = Game;
    if (hero.elite && G.power('execMana')) G.addMana(1, pos.x, pos.y - 140);
    if (G.power('execChainKill')) {
        const p = G.lordPassive('shackle');
        const other = G.heroes.find(h => h !== hero && !h.dead && !h.waiting && !h.boss && distance(pos.x, pos.y, heroWorld(h).x, heroWorld(h).y) <= TILE);
        if (other) bindHero(other, p ? p.duration : 0.6);
    }
}

// 사슬의 군주 Q 사슬 끌기: 맨 앞 용사 몇 명을 사슬로 끌어 뒤로 당기고 묶는다(보스는 묶기만 짧게)
function castChainPull() {
    const G = Game;
    const rule = COMBAT_RULES.chainPull;
    if (G.skills.chainPull > 0) return false;
    const list = frontHeroes(rule.count);
    if (!list.length) return false;
    G.skills.chainPull = G.skillCooldown('chainPull');
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row) - 60;
    for (const h of list) {
        const from = heroWorld(h);
        Fx.beam(tx, ty, from.x, from.y - 30, '#c9c2b8', 10, 0.3);
        if (!h.boss) h.d = Math.max(0, h.d - rule.back * TILE);
        bindHero(h, h.boss ? rule.bossBind : rule.bind);
        const to = heroWorld(h);
        Fx.ring(to.x, to.y - 10, 70, '#c9c2b8', 0.3);
    }
    Fx.addShake(8);
    lordSay('이리 와.');
    Sfx.play('charge');
    return true;
}

// 사슬의 군주 E 처형대: 묶인 용사 모두에게 최대 체력 비례 피해(방어력 무시)
function castGallows() {
    const G = Game;
    const rule = COMBAT_RULES.gallows;
    if (G.skills.gallows > 0) return false;
    const list = G.heroes.filter(h => !h.dead && !h.waiting && h.bound > 0);
    if (!list.length) return false;
    G.skills.gallows = G.skillCooldown('gallows');
    for (const h of list) {
        const w = heroWorld(h);
        Fx.anim('fx_cleave', w.x, w.y - 30, 200, 0.35);
        damageHero(h, h.maxHp * (h.boss ? rule.bossRatio : rule.hpRatio), w.x, w.y, '#c9c2b8', null, true);
    }
    Fx.addShake(12);
    lordSay('형을 집행한다.');
    Sfx.play('charge');
    return true;
}

// 사슬의 군주 W 사슬 감옥: 맨 앞 용사 둘레의 용사를 묶는다(보스는 짧게). 권능 쇠사슬 회수면 2칸 뒤로
function castJail() {
    const G = Game;
    const rule = COMBAT_RULES.jail;
    if (G.skills.jail > 0) return false;
    const front = G.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => remainingDistance(a) - remainingDistance(b))[0];
    if (!front) return false;
    G.skills.jail = G.skillCooldown('jail');
    const c = heroWorld(front);
    const big = G.power('jailBig');
    const r = (rule.radius + (big ? 1 : 0)) * TILE;
    const time = rule.duration + (big ? 1 : 0);
    for (const h of G.heroes) {
        if (h.dead || h.waiting) continue;
        const w = heroWorld(h);
        if (distance(c.x, c.y, w.x, w.y) > r) continue;
        bindHero(h, h.boss ? rule.bossDuration : time);
        if (!h.boss && G.power('dragAll')) h.d = Math.max(0, h.d - 2 * TILE * (G.power('dragFar') ? 2 : 1));
    }
    Fx.ring(c.x, c.y, r, '#c9c2b8', 0.45);
    Fx.addShake(8);
    lordSay('면회는 금지다.');
    Sfx.play('charge');
    return true;
}

// ----- 거울 마녀 -----

// 거울상: 합친 뒤 확률로 재료 하나(끌어온 몬스터)가 제자리에 다시 선다. 권능으로 확률·랭크·골드·등급이 바뀐다
function mirrorAfterMerge(src, plan, resultGrade) {
    const G = Game;
    const p = G.lordPassive('reflection');
    if (!p || !src || G.fieldFull()) return null;
    const rule = COMBAT_RULES.mirror;
    let chance = p.chance + (G.power('reflectUp') ? rule.reflectUp : 0);
    if (G.power('copyHigh') && GRADE_ORDER.indexOf(MONSTERS[src.type].grade) >= GRADE_ORDER.indexOf('epic')) chance *= 2;
    if (G.power('transRecipe') && plan.kind === 'recipe') chance *= 2;
    if (rng('merge') >= chance) return null;
    let type = src.type;
    // 권능 금빛 거울: 돌아오는 재료가 한 등급 위(신화 제외)
    if (G.power('transUp')) {
        const up = nextGrade(MONSTERS[type].grade);
        if (up && up !== 'mythic') {
            const pool = summonPool(up);
            if (pool.length) type = rngItem('merge', pool);
        }
    }
    const spot = G.canPlace(type, src.col, src.row) ? { col: src.col, row: src.row } : G.pickSummonCell(type);
    if (!spot) return null;
    const m = createMonster(type, spot.col, spot.row);
    if (G.power('copyRank') && type === src.type) setMonsterRank(m, src.rank || 0);
    G.monsters.push(m);
    m.reveal = MERGE_REVEAL;
    if (G.power('copyGold')) G.gold += G.summonCost();
    Fx.anim('fx_blastCyan', m.x, m.y - 50, 300, 0.45);
    Fx.burst(m.x, m.y - 40, '#bff6ff', 14, 260, 0.4, 5);
    return m;
}

// 거울 마녀 W 거울 분신: 가장 높은 등급 몬스터의 분신이 잠깐 빈 칸에 선다. 분신은 합치기·판매·제물이 안 된다
function castMirrorClone() {
    const G = Game;
    const rule = COMBAT_RULES.mirrorClone;
    if (G.skills.mirrorClone > 0) return false;
    // 등급이 높은 몬스터부터, 분신이 설 빈자리가 있는 첫 몬스터(큰 몬스터는 자리가 없을 수 있다)
    const best = G.monsters.filter(m => !m.removed && !m.clone).sort((a, b) => GRADE_ORDER.indexOf(MONSTERS[b.type].grade) - GRADE_ORDER.indexOf(MONSTERS[a.type].grade)).find(m => G.pickSummonCell(m.type, true));
    if (!best) return false;
    const n = G.power('cloneTwo') ? 2 : 1;
    let made = 0;
    for (let i = 0; i < n; i++) {
        const cell = G.pickSummonCell(best.type);
        if (!cell) break;
        const m = createMonster(best.type, cell.col, cell.row);
        setMonsterRank(m, best.rank || 0);
        m.clone = rule.duration * (G.power('cloneLong') ? 2 : 1);
        G.monsters.push(m);
        Fx.anim('fx_blastCyan', m.x, m.y - 50, 360, 0.45);
        made++;
    }
    if (!made) return false;
    G.skills.mirrorClone = G.skillCooldown('mirrorClone');
    lordSay('거울아, 하나 더.');
    Sfx.play('charge');
    return true;
}

// 거울 마녀 Q 반사막: 잠깐 왕좌가 받는 피해를 막는다(damageThrone이 mirrorWardBlocks로 묻는다)
function castMirrorWard() {
    const G = Game;
    if (G.skills.mirrorWard > 0) return false;
    G.skills.mirrorWard = G.skillCooldown('mirrorWard');
    G.wardT = COMBAT_RULES.mirrorWard.duration;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 80, 260, '#bff6ff', 0.5);
    Fx.anim('fx_blastCyan', tx, ty - 80, 420, 0.5);
    lordSay('거울 뒤로 숨어야지.');
    Sfx.play('charge');
    return true;
}

// 반사막이 켜져 있으면 왕좌 피해를 막고 맨 앞 용사에게 낙뢰 기본 피해를 되돌린다. 막았으면 true
function mirrorWardBlocks() {
    const G = Game;
    if (!(G.wardT > 0)) return false;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 120, 180, '#bff6ff', 0.3);
    Fx.number('throne', tx, ty - 330, '막음', '#bff6ff', true);
    const front = frontHeroes(1)[0];
    if (front) {
        const w = heroWorld(front);
        Fx.beam(tx, ty - 120, w.x, w.y - 30, '#bff6ff', 10, 0.25);
        damageHero(front, G.lightningDamage(), tx, ty, '#bff6ff');
    }
    Sfx.play('shieldBreak');
    return true;
}

// 거울 마녀 E 깨진 거울: 용사마다 잃은 체력의 일부만큼 피해(방어력 무시)
function castShatter() {
    const G = Game;
    const rule = COMBAT_RULES.shatter;
    if (G.skills.shatter > 0) return false;
    const list = G.heroes.filter(h => !h.dead && !h.waiting && h.hp < h.maxHp);
    if (!list.length) return false;
    G.skills.shatter = G.skillCooldown('shatter');
    for (const h of list) {
        const w = heroWorld(h);
        Fx.anim('fx_blastCyan', w.x, w.y - 30, 160, 0.35);
        damageHero(h, (h.maxHp - h.hp) * (h.boss ? rule.bossRatio : rule.ratio), w.x, w.y, '#bff6ff', null, true);
    }
    Fx.addShake(10);
    lordSay('금 간 곳부터 깨진다.');
    Sfx.play('charge');
    return true;
}

// 왕좌가 맞음: 반사 갈래(맨 앞 용사들에게 번개, 모든 용사 피해 증가, 호통 단축)
function mirrorThroneHit() {
    const G = Game;
    if (!G.lordPassive('reflection')) return;
    const rule = COMBAT_RULES.mirror;
    if (G.power('reflectThrone') || G.power('reflectAll')) {
        const mul = G.power('reflectAll') ? 1 : 0.5;
        const front = G.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => remainingDistance(a) - remainingDistance(b)).slice(0, rule.reflectCount);
        for (const h of front) {
            const w = heroWorld(h);
            Fx.anim('fx_hit_lightning', w.x, w.y - 40, 160, 0.3);
            damageHero(h, G.lightningDamage() * mul, w.x, w.y, '#bff6ff');
        }
    }
    if (G.power('reflectCurse')) for (const h of G.heroes) if (!h.dead && !h.waiting) curseHero(h, 2, 1.2);
    if (G.power('reflectRoar')) { const q = G.skillKey(0); G.skills[q] = Math.max(0, G.skills[q] - 10); } // 날 선 거울: 반사막(Q)
}

// 권능 거울 방패: 라운드마다 왕좌 피해를 1(큰 방패 2)번 막는다. 막았으면 true
function mirrorShieldBlocks() {
    const G = Game;
    const n = G.power('shieldBig') ? 2 : (G.power('mirrorShield') ? 1 : 0);
    if (!n || (G.mirrorBlocks || 0) >= n) return false;
    G.mirrorBlocks = (G.mirrorBlocks || 0) + 1;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 120, 160, '#bff6ff', 0.35);
    Fx.number('throne', tx, ty - 330, '막음', '#bff6ff', true);
    Sfx.play('shieldBreak');
    return true;
}

// ----- 시계탑의 마왕 -----

// 용사 이동 배율(멈춘 초침, 늦춰진 시간, 시계탑 그림자). 다른 마왕이면 1
function clockSlowMul(h) {
    const G = Game;
    let mul = 1;
    // 감속 시계탑(Q): 둘레 안의 용사
    if (G.towers.length) {
        const w = heroWorld(h);
        if (G.towers.some(t => distance(t.x, t.y, w.x, w.y) <= t.radius)) mul *= COMBAT_RULES.clockTower.slow;
    }
    const p = G.lordPassive('stopwatch');
    if (!p) return mul;
    const rule = COMBAT_RULES.clock;
    if (G.state === 'wave' && G.roundAge() < p.duration + (G.power('slowLong') ? rule.slowLong : 0)) {
        const cut = G.power('slowDeep') ? rule.deepCut : p.cut;
        mul *= 1 - (h.boss && !G.power('slowBoss') ? cut / 2 : cut);
    }
    if (G.clockSlowT > 0) mul *= rule.eliteSlow;
    return mul;
}

// 몬스터 공격 속도 보너스(가속 갈래). 더할 값
function clockHaste() {
    const G = Game;
    const accel = G.accelT > 0 ? COMBAT_RULES.accel.haste : 0; // 시간 가속(E)
    if (!G.lordPassive('stopwatch')) return accel;
    const rule = COMBAT_RULES.clock;
    const age = G.roundAge();
    let add = 0;
    if (G.state === 'wave' && G.power('hasteStart') && age < rule.hasteStartTime) add += rule.haste;
    if (G.clockHasteT > 0) add += rule.haste;
    if (G.state === 'wave' && G.power('overclock') && age % rule.overclockEvery < rule.overclockTime) add += rule.overclock;
    if (G.timeStopT > 0 && G.power('timeStopHaste')) add += rule.overclock;
    return add * (G.power('hasteMax') ? 2 : 1) + accel;
}

// 정예 처치: 늦춰진 시간(모든 용사 2초 감속), 몰아치기(5초 공격 속도), 보스 처치: 되감기(스킬 즉시 충전)
function clockKill(hero) {
    const G = Game;
    if (!G.lordPassive('stopwatch')) return;
    const rule = COMBAT_RULES.clock;
    if (hero.elite && G.power('slowElite')) G.clockSlowT = rule.eliteSlowTime;
    if (hero.elite && G.power('hasteKill')) G.clockHasteT = rule.hasteKillTime;
    if (hero.boss && G.power('rewindSkill')) for (const k of Object.keys(G.skills)) G.skills[k] = 0;
}

// 시계탑의 마왕 Q 감속 시계탑: 고른 자리에 시계탑을 세운다. 둘레의 용사는 느려진다(clockSlowMul)
function castClockTower(x, y) {
    const G = Game;
    const rule = COMBAT_RULES.clockTower;
    if (G.skills.clockTower > 0 || !(x >= 0) || !(y >= 0)) return false;
    G.skills.clockTower = G.skillCooldown('clockTower');
    G.towers.push({ x, y, radius: rule.radius * TILE, life: rule.duration, age: 0 });
    Fx.ring(x, y, rule.radius * TILE, '#ffcf6b', 0.5);
    Fx.anim('fx_blastGold', x, y - 40, 260, 0.45);
    lordSay('여기서는 천천히.');
    Sfx.play('charge');
    return true;
}

// 시계탑의 마왕 E 시간 가속: 잠깐 모든 몬스터의 공격 속도가 오른다(clockHaste)
function castAccel() {
    const G = Game;
    if (G.skills.accel > 0) return false;
    G.skills.accel = G.skillCooldown('accel');
    G.accelT = COMBAT_RULES.accel.duration;
    for (const m of G.monsters) if (!m.removed) Fx.anim('fx_rune_attackSpeed', m.x, m.y + MONSTER_FOOT, 120, 0.6);
    lordSay('바늘을 돌려라.');
    Sfx.play('charge');
    return true;
}

// 시계탑의 마왕 W 시간 정지: 모든 용사를 멈춘다(보스는 짧게)
function castTimeStop() {
    const G = Game;
    const rule = COMBAT_RULES.timeStop;
    if (G.skills.timeStop > 0) return false;
    const live = G.heroes.filter(h => !h.dead && !h.waiting);
    if (!live.length) return false;
    G.skills.timeStop = G.skillCooldown('timeStop');
    const t = rule.duration + (G.power('stopLong') ? rule.longUp : 0);
    for (const h of live) applyStun(h, h.boss ? rule.bossDuration : t);
    G.timeStopT = t;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 60, 900, '#ffcf6b', 0.6);
    Fx.addShake(10);
    Fx.say(tx, ty - LORD_SAY_Y, '멈춰라.', 2);
    Sfx.play('charge');
    return true;
}

// 왕좌가 맞음: 되감기(2 피해마다 3초 뒤 체력 1), 마지막 1초(판당 한 번 체력 0에서 5로)
function clockThroneHit(amount) {
    const G = Game;
    if (!G.lordPassive('stopwatch')) return;
    const rule = COMBAT_RULES.clock;
    if (G.power('rewindThrone')) {
        G.rewindDebt = (G.rewindDebt || 0) + amount;
        while (G.rewindDebt >= rule.rewindPer) {
            G.rewindDebt -= rule.rewindPer;
            G.rewinds.push(rule.rewindDelay);
        }
    }
}

function clockSavesThrone() {
    const G = Game;
    if (G.hp > 0 || !G.power('rewindDeath') || G.rewindUsed) return false;
    G.rewindUsed = true;
    G.hp = COMBAT_RULES.clock.rewindDeathHp;
    const tx = tileX(THRONE_TILE.col);
    const ty = tileY(THRONE_TILE.row);
    Fx.ring(tx, ty - 120, 300, '#ffcf6b', 0.6);
    Fx.say(tx, ty - LORD_SAY_Y, '아직 내 시간이다.', 2.5);
    return true;
}

function castRoar() {
    const G = Game;
    const rule = COMBAT_RULES.roar;
    if (G.roarLocked() || G.skills.roar > 0) return false;
    G.skills.roar = G.skillCooldown('roar');
    for (const h of G.heroes) {
        if (h.dead) continue;
        h.stun = Math.max(h.stun, rule.duration);
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

// 스킬 키(LORD_SKILLS)마다 시전 함수. Game.useSkill이 그 마왕의 스킬인지 본 뒤 부른다. 조준 스킬은 (x, y)를 받는다
const SKILL_CASTS = {
    lightning: castLightning, roar: castRoar, portal: castPortal,
    boneSpear: castBoneSpear, ghosts: castGhosts, goldBomb: castGoldBomb, bribe: castBribe,
    venomRain: castVenomRain, miasma: castMiasma, chainPull: castChainPull, jail: castJail,
    mirrorWard: castMirrorWard, mirrorClone: castMirrorClone, clockTower: castClockTower, timeStop: castTimeStop,
    thunder: castThunder, graveBlast: castGraveBlast, midas: castMidas, outbreak: castOutbreak, gallows: castGallows, shatter: castShatter, accel: castAccel
};
