// 자동 합치기 간격(틱). 30틱 = 0.5초
const AUTO_MERGE_TICKS = 30;

// 게임 진행 상태와 프레임 순서. 화면 코드 없이도 돌아가서 tools/simulate.js로 밸런스를 시험할 수 있다.
// 마왕 대사 한 줄: 공통 대사(SPEECH)에 이번 판 마왕의 대사를 더해 고른다(Math.random 한 번)
function lordLine(kind) {
    const own = Game.lordDef().speech || {};
    return randItem([...(SPEECH[kind] || []), ...(own[kind] || [])]);
}

const RUN_SAVE_KEY = 'dungeonGuard.run';
const Game = {
    state: 'title', // title | hq(본부) | story(스토리 지도) | select | prep | wave | victory | defeat
    gold: 0, hp: 0, waveIndex: 0, prepTimer: 0, speed: 1, paused: false,
    roundTimer: 0, // 이번 라운드의 남은 시간
    summonLevel: 0, // 소환 강화 레벨(SUMMON_LEVELS 번호). 판 안에서만 유지
    summonCount: 0, // 이번 판 소환 횟수. 소환 비용이 여기에 따라 오른다
    runResult: null, // 판이 끝날 때의 기록(Meta.finishRun): 처음 깼는지, 풀린 것. 결과 화면과 해금 카드가 보여 준다
    stage: null, // 이번 판 스테이지 id(STAGES). null이면 스토리 없이 WAVES 전부(tools/simulate.js와 시험 도구)
    waves: WAVES, // 이번 판 라운드 목록(stageWaves). 스테이지가 없으면 WAVES
    heroHpMul: 1, // 이번 판 용사 체력 배율(스테이지의 hpMul)
    bossDefeated: false, // 이번 라운드에 보스를 처치했는지. 라운드가 끝날 때 보상 카드로 바뀐다
    bossReward: null, // 고를 보스 보상: { cards: [{ kind: 'monster', type } | { kind: 'equip', id } | { kind: 'gold', gold }] }. 있는 동안 준비 시간이 멈춘다
    equipBag: [], // 보관함의 장비 id(최대 EQUIP_RULES.slots). 다시 시작하면 비우고 저장하지 않는다
    monsters: [], heroes: [], units: [], corpses: [], projectiles: [], telegraphs: [], pendingStrikes: [],
    hazards: [], // 땅에 남는 장판(불 장판 burnGround): { kind, x, y, radius(px), dps, life, age, tick, owner }
    skills: {}, // 스킬마다 남은 재사용 대기(초). 키는 LORD_SKILLS(freshSkills)
    towers: [], wardT: 0, accelT: 0, // 감속 시계탑, 반사막, 시간 가속(reset에서 다시 채운다)
    mana: 0, // 마력(권능을 찍는다). 판이 끝나면 사라진다
    powers: {}, // 찍은 권능: { 항목 id: true }
    powerSeed: '', // 권능 지도의 시드
    arrivals: 0, // 왕좌에 닿은 일반 용사 수(권능 문전박대)
    roundHit: false, // 이번 라운드에 왕좌가 맞았는지
    streak: 0, streakTimer: 0, streakPop: 0, throneFlash: 0, throneBless: 0, // throneBless: 제물을 받은 마왕이 빛나는 남은 시간
    stats: { kills: 0, corrupted: 0, placed: 0, summoned: 0, merged: 0, sacrificed: 0, time: 0 },
    time: 0,
    lord: null, // 이번 판 마왕 id(DEMON_LORDS). null이면 효과 없이 기본 마왕 그림을 쓴다(시험 도구)
    relics: [], // 이번 판 유물 id(RELICS). 판 중에는 바뀌지 않는다
    mods: emptyMods(), // 마왕과 유물의 효과를 합친 값(LORD_EFFECTS). 각 계산 지점이 읽는다

    // loadout: 선택 화면의 { lord, relics }. 없으면 효과 없이 시작한다(tools/simulate.js와 시험 도구)
    // stageId: 스토리 스테이지(STAGES의 id). 없으면 WAVES 전부를 체력 배율 1, 골드 보너스 없이 돈다
    // challenge가 있으면 그 도전의 시드와 조건으로 시작하고 입력을 기록한다
    reset(loadout, stageId, challenge) {
        this.challenge = challenge || null;
        this.holdPrep = false;
        this.tutorialCommons = 0;
        this.roundFull = 0;
        this.challengeResult = null;
        this.challengeBest = null;
        this.tick = 0;
        this.autoMerge = false; // 자동 합치기(입력으로 켜고 끈다)
        this.raidTier = 0; // 주간 토벌전에서 잡은 보스 수
        this.mutations = []; // 끝없는 심연에서 쌓인 변이(규칙 카드 id)
        this.leak = 0; // 아직 왕좌를 깎지 않은 일반 용사 피해
        this.goldLeft = 0; // 아직 주지 않은 처치 골드
        this.score = 0;
        this.nextUid = 1;
        this.record = null;
        if (!challenge) Rng.stop(); // 스토리와 시험 판은 Math.random
        if (challenge) {
            Rng.start(challenge.seed);
            this.record = { kind: challenge.kind, id: challenge.id, date: challenge.date, seed: challenge.seed, week: challenge.week, level: challenge.level, lord: challenge.lord, relics: challenge.relics.slice(), inputs: [] };
            this.lord = challenge.lord;
            this.relics = challenge.relics.slice();
            this.mods = buildMods(challenge.lord, challenge.relics, challenge.cards);
            if (challenge.base) { // 심연 난이도의 기본 배율
                this.mods.heroHp *= challenge.base.hp;
                this.mods.heroSpeed *= challenge.base.speed;
            }
        } else if (loadout) {
            const clean = cleanLoadout(loadout);
            this.lord = clean.lord;
            this.relics = clean.relics;
            this.mods = buildMods(clean.lord, clean.relics);
        } else {
            this.lord = null;
            this.relics = [];
            this.mods = emptyMods();
        }
        const stage = hasStage(stageId) ? stageDef(stageId) : null;
        this.stage = stage ? stage.id : null;
        setMap(challenge ? challenge.map : (stage ? stage.mapId : DEFAULT_MAP));
        this.zone = zoneOf(this.stage); // 맵 지역(js/data/map.js의 ZONES). 그리기만 바뀐다
        this.waves = stage ? stageWaves(stage) : WAVES;
        this.heroHpMul = stage ? stage.hpMul : 1;
        if (challenge) {
            this.zone = challenge.zone;
            this.waves = WAVES.map((w, i) => this.roundFor(i + 1, w));
            this.heroHpMul = this.mods.heroHp;
        }
        this.gold = COMBAT_RULES.startGold + this.mods.startGold + (stage ? stage.goldBonus || 0 : 0);
        this.hp = this.maxHp();
        this.waveIndex = 0;
        this.prepTimer = COMBAT_RULES.firstPrepTime;
        this.paused = false;
        this.summonCount = 0;
        this.familyLevels = {}; // 종족 강화 레벨(MONSTER_FAMILIES 열쇠 → 레벨)
        this.roundSummons = 0; // 이번 라운드에 소환한 수(계약 조항 소환 제한)
        this.summonLevel = 0;
        this.roundTimer = 0;
        this.bossDefeated = false;
        this.bossReward = null;
        this.equipBag = [];
        this.runResult = null;
        this.clearField();
        this.skills = freshSkills();
        this.towers = []; // 시계탑의 마왕 감속 시계탑: { x, y, radius(px), life, age }
        this.wardT = 0; // 거울 마녀 반사막 남은 초
        this.accelT = 0; // 시계탑의 마왕 시간 가속 남은 초
        this.graves = [];
        this.corpseCount = 0;
        this.poisonKills = 0; // 역병의 군주: 독으로 쓰러뜨린 수(대유행)
        this.poisonKill = false; // 지금 주는 피해가 독인지(처치 보너스를 고른다)
        this.bindCount = 0; // 사슬의 군주: 묶인 일반 용사 수(구덩이)
        this.mirrorBlocks = 0; // 거울 마녀: 이번 라운드에 거울 방패가 막은 수
        // 시계탑의 마왕: 늦춰진 시간, 몰아치기, 시간 정지 남은 초, 되감기 대기, 마지막 1초를 썼는지
        this.clockSlowT = 0;
        this.clockHasteT = 0;
        this.timeStopT = 0;
        this.rewinds = [];
        this.rewindDebt = 0;
        this.rewindUsed = false;
        // 유물: 학살의 종 게이지, 영혼 수확 낫 영혼, 불사의 왕관을 썼는지, 마나 결정의 남은 소수
        this.relicGauge = 0;
        this.relicSouls = 0;
        this.undyingUsed = false;
        this.manaLeft = 0;
        this.mana = 0;
        this.powers = {};
        this.awaken = 0; // 각성 횟수
        this.fieldBought = 0; // 골드로 넓힌 칸 수
        this.manaBought = 0; // 골드로 산 마력 수
        // 도전은 모두 같은 지도, 스토리는 판마다 다른 지도
        this.powerSeed = challenge ? String(challenge.seed) : String(Math.floor(Math.random() * 1e9));
        this.arrivals = 0;
        this.roundHit = false;
        this.bloodSummons = 0; // 유물 피의 계약서로 쓴 횟수
        this.earlyBoost = false; // 유물 깨진 모래시계: 이번 라운드를 일찍 불렀다
        this.streak = 0;
        this.streakTimer = 0;
        this.throneFlash = 0;
        this.throneBless = 0;
        this.stats = { kills: 0, corrupted: 0, placed: 0, summoned: 0, merged: 0, sacrificed: 0, time: 0 };
        this.state = 'prep';
    },

    // 맵 위의 몬스터, 용사, 연출을 비운다(판을 시작할 때와 스토리 지도·시작 전 대화로 돌아갈 때)
    clearField() {
        this.monsters = [];
        this.heroes = [];
        this.units = [];
        this.corpses = [];
        this.projectiles = [];
        this.telegraphs = [];
        this.pendingStrikes = [];
        this.hazards = [];
        Fx.reset();
    },

    // 이번 판 마왕(그림, 초상, 대사). 고르지 않았으면 기본 마왕
    lordDef() { return DEMON_LORDS[this.lord] || DEMON_LORDS[DEFAULT_LORD]; },

    // 마왕 최대 체력: 기본값에 마왕과 유물의 maxHp를 더한다(1 아래로는 내려가지 않는다)
    maxHp() { return Math.max(1, Math.floor((COMBAT_RULES.maxHp + this.mods.maxHp) * (this.mods.maxHpHalf ? 0.5 : 1))); }, // 저주받은 왕관: 절반

    // 이번 판 마왕의 스킬 1(Q)과 스킬 2(W) 키(LORD_SKILLS). slot 0 | 1
    lordSkills() { return this.lordDef().skills || ['lightning', 'roar']; },
    skillKey(slot) { return this.lordSkills()[slot]; },
    // 이번 판에 쓸 수 있는 스킬인지(마왕의 Q·W, 권능으로 연 E)
    hasSkill(key) {
        if (this.lordSkills().includes(key)) return true;
        const third = this.thirdSkill();
        return !!third && third.key === key;
    },
    // 지금 막힌 스킬인지: 권능 폭주는 스킬 2를 봉인한다. 옛 호통은 체력 조건이 있다
    skillLocked(key) {
        if (key === this.skillKey(1) && this.power('frenzy')) return true;
        return key === 'roar' && !this.mods.roarAnytime && this.hp > COMBAT_RULES.roar.unlockHp;
    },
    // 스킬 쓰기(Game.act가 부른다): 이 마왕의 스킬이 아니거나 막혔거나 대기 중이면 실패. 조준 스킬은 (x, y)
    useSkill(key, x, y) {
        if (!hasEntry(SKILL_CASTS, key) || !this.hasSkill(key) || this.skillLocked(key) || this.skills[key] > 0) return { ok: false };
        if (!SKILL_CASTS[key](x, y)) return { ok: false };
        if (key === this.skillKey(1) && this.power('rally')) this.skills[this.skillKey(0)] = 0; // 권능 맞불
        return { ok: true };
    },
    // 균열 문 대상 수(권능 넓은 문)
    portalCount() { return portalCount(); },

    // 스킬 재사용 대기(초). 스킬 1(Q)은 유물 폭풍의 병(lightningCooldown)이 줄인다
    skillCooldown(key) {
        let mul = this.mods.skillCooldown;
        if (key === this.skillKey(0)) mul *= this.mods.lightningCooldown;
        if (key === 'lightning' && this.power('quick')) mul *= 0.85;
        if (key === this.skillKey(1) && this.power('roarDrill')) mul *= 0.7;
        if (key === 'goldBomb' && this.power('coinCool')) mul *= 0.85;
        if (key === 'bribe' && this.power('contract')) mul *= 0.7;
        if (key === 'graveBlast' && this.power('raiseFast')) mul *= 0.6;
        return COMBAT_RULES[key].cooldown * mul;
    },

    // 이번 판 마왕의 패시브가 kind이면 그 표를, 아니면 null
    lordPassive(kind) {
        const lord = hasEntry(DEMON_LORDS, this.lord) ? DEMON_LORDS[this.lord] : null;
        return lord && lord.passive && lord.passive.kind === kind ? lord.passive : null;
    },

    // 뼈의 여왕: 처치 수마다 앞선 용사들을 망령이 때린다
    soulVolley(force) {
        const p = this.lordPassive('soulVolley');
        if (!p || this.volleying) return;
        const every = this.power('volleyFast') ? 20 : p.every;
        if (!force && this.stats.kills % every !== 0) return;
        this.volleying = true;
        const score = h => remainingDistance(h) - (this.power('volleyBoss') && (h.boss || h.elite) ? 1e6 : 0);
        const count = p.count + (this.power('volleyWide') ? 3 : 0);
        const list = this.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => score(a) - score(b)).slice(0, count);
        const damage = (p.base + p.perRound * this.waveIndex) * (this.power('volleyHeavy') ? 1.5 : 1);
        for (let shot = 0; shot < (this.power('volleyTwin') ? 2 : 1); shot++) {
            for (const h of list) {
                if (h.dead) continue;
                const w = heroWorld(h);
                Fx.anim('fx_blastViolet', w.x, w.y - 30, 200, 0.35);
                damageHero(h, damage, w.x, w.y, '#c9a6ff');
                if (h.dead) continue;
                if (this.power('volleyCurse')) curseHero(h, 3, 1.2);
                if (this.power('volleyFear')) h.stun = Math.max(h.stun, 1.5);
            }
        }
        if (this.power('volleyCharge')) for (const key of Object.keys(this.skills)) this.skills[key] = Math.max(0, this.skills[key] - 3);
        this.volleying = false;
    },

    // 옛 호통을 아직 쓸 수 없는지(체력 조건, 폭주). 옛 유물 광기의 북이 있으면 언제나 쓴다
    roarLocked() { return this.skillLocked('roar'); },

    // 이번 판 마왕의 권능 갈래 목록(없는 마왕은 빈 목록)
    lordPowers() { return LORD_POWERS[this.lord] || []; },
    // 항목을 찍었는지
    power(id) { return !!this.powers[id]; },
    powerCount() { return Object.keys(this.powers).length; },
    // 이번 판의 권능 지도(마왕과 시드가 같으면 다시 만들지 않는다)
    powerMap() {
        const key = `${this.lord}/${this.powerSeed}`;
        if (this.powerMapKey !== key) {
            this.powerMapKey = key;
            this.powerMapData = buildPowerMap(this.lord, this.powerSeed);
        }
        return this.powerMapData;
    },
    // 항목의 자리: { branch, tier, node }. 없으면 null
    powerNode(id) {
        for (const branch of this.lordPowers()) {
            for (let tier = 0; tier < branch.tiers.length; tier++) {
                const node = branch.tiers[tier].find(n => n.id === id);
                if (node) return { branch, tier, node };
            }
        }
        return null;
    },
    // 왕좌나 찍은 항목과 이어졌는지
    powerLinked(id) {
        return this.powerMap().edges.some(([a, b]) => (a === id && (b === 'core' || this.power(b))) || (b === id && (a === 'core' || this.power(a))));
    },
    // 찍을 수 있는지: { ok, cost, reason }. reason: none | owned | branch(다른 갈래를 찍음) | tier(그 겹에서 이미 고름) | locked(이어지지 않음) | limit | mana
    powerCheck(id) {
        const at = this.powerNode(id);
        if (!at) return { ok: false, reason: 'none' };
        if (this.power(id)) return { ok: false, reason: 'owned' };
        const cost = POWER_RULES.tierCost[at.tier];
        const other = this.lordPowers().find(b => b !== at.branch && b.tiers.some(t => t.some(n => this.power(n.id))));
        if (other) return { ok: false, cost, reason: 'branch' };
        if (!this.powerLinked(id)) return { ok: false, cost, reason: 'locked' };
        if (this.powerCount() >= POWER_RULES.maxNodes) return { ok: false, cost, reason: 'limit' };
        return { ok: this.mana >= cost, cost, reason: this.mana >= cost ? null : 'mana' };
    },
    // 지금 찍을 수 있는 항목이 있는지
    powerReady() { return this.lordPowers().some(b => b.tiers.some(t => t.some(n => this.powerCheck(n.id).ok))); },
    // 지금 열린 3번째 스킬: POWER_SKILLS의 한 줄. 없으면 null
    thirdSkill() {
        const id = Object.keys(POWER_SKILLS).find(k => this.power(k));
        return id ? POWER_SKILLS[id] : null;
    },
    // 항목의 수치 효과를 판의 효과표에 더한다
    addNodeMods(node) {
        for (const [key, v] of Object.entries(node.mods || {})) {
            if (LORD_EFFECTS[key].mode === 'mul') this.mods[key] *= v;
            else this.mods[key] += v;
        }
    },
    // 효과표를 새로 만든 뒤 찍은 항목을 모두 다시 더한다
    applyPowerMods() {
        for (const id of Object.keys(this.powers)) {
            const at = this.powerNode(id);
            if (at) this.addNodeMods(at.node);
        }
        this.mods.damage += this.awaken * POWER_RULES.awakenDamage;
    },
    // 각성: 고른 갈래를 모두 찍은 뒤 마력으로 몬스터 피해를 계속 올린다. { ok, cost, reason: 'branch' | 'mana' }
    awakenCheck() {
        const cost = POWER_RULES.awakenCost + POWER_RULES.awakenStep * this.awaken;
        const full = this.lordPowers().some(b => b.tiers.every(t => t.every(n => this.power(n.id))));
        if (!full) return { ok: false, cost, reason: 'branch' };
        return { ok: this.mana >= cost, cost, reason: this.mana >= cost ? null : 'mana' };
    },
    buyAwaken() {
        const c = this.awakenCheck();
        if (!c.ok) return c;
        this.mana -= c.cost;
        this.awaken++;
        this.mods.damage += POWER_RULES.awakenDamage;
        Sfx.play('charge');
        return c;
    },

    // 칸 넓히기: 다음 값(다 샀으면 null)과 사기
    fieldCost() {
        const F = GOLD_SHOP.field;
        return this.fieldBought >= F.max ? null : Math.round(F.cost * F.mul ** this.fieldBought);
    },
    buyField() {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        const cost = this.fieldCost();
        if (cost === null) return { ok: false, reason: 'max' };
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        this.fieldBought++;
        Sfx.play('upgrade');
        return { ok: true, cost };
    },
    // 마력 사기
    manaCost() { return GOLD_SHOP.mana.cost + GOLD_SHOP.mana.step * this.manaBought; },
    buyMana() {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!this.lordPowers().length || this.mods.powerSeal) return { ok: false, reason: 'seal' };
        const cost = this.manaCost();
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        this.manaBought++;
        this.mana++;
        Sfx.play('charge');
        return { ok: true, cost };
    },
    // 랭크 돌리기: 골드를 내고 D~S+ 중 무작위로 다시 정한다(내려갈 수도 있다). 비용은 등급별, 마왕과 유물이 깎는다
    rankRollCost(m) {
        if (!m) return null;
        const base = RANK_ROLL.cost[MONSTERS[m.type].grade];
        return base === undefined ? null : Math.max(1, Math.round(base * (1 - Math.min(0.9, this.mods.rankCost || 0))));
    },
    rankOdds() {
        const luck = 1 + (this.mods.rankLuck || 0);
        const odds = MONSTER_RANKS.map((r, i) => (i >= rankIndex('S') ? r.odds * luck : r.odds));
        const extra = odds.reduce((a, b) => a + b, 0) - 1;
        odds[0] = Math.max(0, odds[0] - extra); // 늘어난 만큼 D에서 뺀다
        return odds;
    },
    rollRank(m) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || m.removed || m.clone || !this.monsters.includes(m)) return { ok: false, reason: 'empty' };
        const cost = this.rankRollCost(m);
        if (cost === null) return { ok: false, reason: 'none' };
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        const odds = this.rankOdds();
        let r = rng('rank');
        let rank = 0;
        for (let i = 0; i < odds.length; i++) {
            if (r < odds[i]) { rank = i; break; }
            r -= odds[i];
            rank = i;
        }
        const before = m.rank || 0;
        setMonsterRank(m, rank);
        showRankChange(m, before);
        if (rank < before) Sfx.play('mergeFail');
        return { ok: true, rank, before, cost };
    },

    // 몬스터 바꾸기: 같은 등급에서 그 자리에 들어가는 다른 몬스터로. 비용은 등급별(신화는 null)
    rerollCost(m) { return m && GOLD_SHOP.reroll[MONSTERS[m.type].grade] !== undefined ? GOLD_SHOP.reroll[MONSTERS[m.type].grade] : null; },
    rerollPool(m) {
        const grade = MONSTERS[m.type].grade;
        return mergePool(grade).filter(t => t !== m.type && this.canPlace(t, m.col, m.row, [m]));
    },
    reroll(m) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || m.removed || m.clone || !this.monsters.includes(m)) return { ok: false, reason: 'empty' };
        const cost = this.rerollCost(m);
        if (cost === null) return { ok: false, reason: 'top' };
        const pool = this.rerollPool(m);
        if (!pool.length) return { ok: false, reason: 'room' };
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        const type = rngItem('merge', pool);
        const next = createMonster(type, m.col, m.row);
        setMonsterRank(next, m.rank || 0);
        next.kills = m.kills || 0;
        if (m.equip) setMonsterEquip(next, m.equip);
        if (m.equip2) setMonsterEquip2(next, m.equip2);
        m.equip = null;
        m.equip2 = null;
        this.removeMonster(m);
        this.monsters.push(next);
        Meta.seeMonster(type);
        Fx.pop({ kind: 'summon', to: { x: next.x, y: next.y }, type, grade: MONSTERS[type].grade });
        Sfx.play('summon', GRADE_ORDER.indexOf(MONSTERS[type].grade));
        return { ok: true, type, monster: next, cost };
    },
    buyPower(id) {
        const c = this.powerCheck(id);
        if (!c.ok) return c;
        this.mana -= c.cost;
        this.powers[id] = true;
        this.addNodeMods(this.powerNode(id).node);
        Sfx.play('charge');
        return c;
    },
    // 마력 얻기. 권능이 없는 마왕은 모으지 않는다
    addMana(n, x, y) {
        if (!this.lordPowers().length || this.mods.powerSeal) return; // 계약 조항 권능 봉인
        // 마나 결정: 얻는 양 +50%(소수는 모아 둔다)
        this.manaLeft = (this.manaLeft || 0) + n * (1 + this.mods.manaGain);
        const whole = Math.floor(this.manaLeft + 1e-9);
        this.manaLeft -= whole;
        this.mana += whole;
        if (x !== undefined && whole > 0) Fx.number({}, x, y, `+${whole} 마력`, '#c9a6ff', false);
    },
    lightningRadius() { return COMBAT_RULES.lightning.radius + (this.power('wide') ? 0.5 : 0); },

    // 유물의 조건부 몬스터 피해 합(비율). 판 상황에 따라 바뀌어 monsterStats가 매번 읽는다
    relicDamage(m) {
        const mods = this.mods;
        const L = RELIC_LIMITS;
        let bonus = 0;
        if (mods.goldDamage) bonus += Math.min(L.goldDamageMax, Math.floor(this.gold / L.goldStep) * mods.goldDamage);
        if (mods.altarDamage) bonus += Math.min(L.altarDamageMax, this.stats.sacrificed * mods.altarDamage);
        if (mods.fewDamage && this.monsters.length <= L.fewCount) bonus += mods.fewDamage;
        if (mods.commonDamage && MONSTERS[m.type].grade === 'common') bonus += mods.commonDamage;
        if (mods.fullHpDamage && this.hp >= this.maxHp()) bonus += mods.fullHpDamage;
        if (mods.perMonsterDamage) bonus += Math.min(L.perMonsterMax, this.monsters.filter(o => !o.removed && !o.clone).length * mods.perMonsterDamage); // 진군의 북
        if (mods.bigDamage && monsterCells(m.type).join() !== '1,1') bonus += mods.bigDamage; // 거인의 장갑
        if (mods.pureDamage || mods.allFamilies) {
            const fams = new Set(this.monsters.filter(o => !o.removed && !o.clone).map(o => MONSTERS[o.type].family));
            if (mods.pureDamage && fams.size === 1) bonus += mods.pureDamage; // 순혈의 왕관
            if (mods.allFamilies && fams.size >= Object.keys(MONSTER_FAMILIES).length) bonus += mods.allFamilies; // 균형의 저울
        }
        if (m.feast) bonus += m.feast; // 탐식의 위장
        return bonus;
    },

    // 유물 고리대금 장부: 라운드 보상을 받은 뒤 가진 골드의 이자
    payInterest() {
        const pay = Math.min(RELIC_LIMITS.interestMax * (this.power('compound') ? 2 : 1), Math.floor(this.gold * this.mods.interest));
        if (pay > 0) this.gold += pay;
    },

    // 유물 피의 계약서: 판에서 남은 체력 소환 횟수
    bloodSummonsLeft() { return Math.max(0, this.mods.hpSummon - this.bloodSummons); },

    // 지금 소환 값을 치를 수 있는지(골드, 또는 체력 1)
    canPaySummon() { return this.gold >= this.summonCost() || (this.bloodSummonsLeft() > 0 && this.hp > 1); },

    // 유물 대장장이의 망치: 돌아오는 장비가 확률로 한 등급 위 장비가 된다(Math.random은 유물이 있을 때만)
    returnedEquipId(id) {
        const mods = this.mods;
        if (!mods.equipUp || rng('merge') >= mods.equipUp) return id;
        const grades = ['common', 'rare', 'epic'];
        const next = grades[grades.indexOf(EQUIPMENT[id].grade) + 1];
        if (!next) return id;
        return rngItem('merge', Object.keys(EQUIPMENT).filter(k => EQUIPMENT[k].grade === next));
    },

    lightningDamage() { return COMBAT_RULES.lightning.damage * this.mods.lightningDamage * (this.power('focus') ? 1.3 : 1); },

    // 맵에 둘 수 있는 몬스터 수
    maxField() { return SUMMON_RULES.maxField + this.mods.fieldMax + (this.fieldBought || 0); },

    // 등급별 소환 확률: 희귀 확률(rareChance)을 일반에서 옮긴다
    summonOdds() {
        const odds = { ...SUMMON_LEVELS[this.summonLevel].odds };
        const shift = clamp(this.mods.rareChance, -(odds.rare || 0), odds.common || 0);
        if (shift) {
            odds.common = (odds.common || 0) - shift;
            odds.rare = (odds.rare || 0) + shift;
        }
        return odds;
    },

    // 제물 효과(마왕과 유물의 sacrifice 배율 포함, 최대치 제한 전)
    sacrificeGain(m) { return sacrificeGain(m, this.mods.sacrifice); },

    currentWave() { return this.waves[Math.min(this.waveIndex, this.waves.length - 1)]; },

    // 라운드의 용사 체력 단계: 스테이지 라운드는 원래 WAVES 인덱스(level), 아니면 지금 라운드 번호
    waveLevel(wave) { return wave.level !== undefined ? wave.level : this.waveIndex; },

    // 라운드의 일반과 정예 인원을 입구 비율(wave.entry)대로 나눈 수: { north, south }. 보스는 세지 않는다.
    // 내림한 뒤 남는 인원은 소수 부분이 큰 입구부터(같으면 ROUTE_IDS 순서) 하나씩 더해 합이 정확히 맞는다. 비율이 없으면 모두 north
    entryCounts(wave) {
        const total = [...Object.values(wave.members), ...Object.values(wave.elites || {})].reduce((a, b) => a + b, 0);
        const counts = {};
        for (const id of ROUTE_IDS) counts[id] = 0;
        const weights = ROUTE_IDS.map(id => Math.max(0, (wave.entry && wave.entry[id]) || 0));
        const sum = weights.reduce((a, b) => a + b, 0);
        if (!(sum > 0)) { counts[ROUTE_IDS[0]] = total; return counts; }
        const exact = weights.map(w => total * w / sum);
        exact.forEach((v, i) => { counts[ROUTE_IDS[i]] = Math.floor(v + 1e-9); });
        let left = total - Object.values(counts).reduce((a, b) => a + b, 0);
        const order = ROUTE_IDS.map((id, i) => ({ id, frac: exact[i] - counts[id] })).sort((a, b) => b.frac - a.frac);
        for (let i = 0; left > 0; i = (i + 1) % order.length, left--) counts[order[i].id]++;
        return counts;
    },

    // 입구의 첫 출발 시각(초): 북쪽 0, 둘째 입구부터 출발 간격의 절반씩 늦춰 엇갈리게 한다
    entryOffset(route) { return ROUTE_IDS.indexOf(route) * COMBAT_RULES.spawnGap / 2; },

    // 보스가 들어오는 입구(BOSSES의 entry, 없으면 north)
    bossEntry(key) {
        const def = BOSSES[key === true ? 'fallen_knight' : key];
        return def && ROUTES[def.entry] ? def.entry : 'north';
    },

    // 놓은 칸으로 찾는다. 길로 걸어 나간 몬스터도 놓은 칸을 차지한다
    monsterAt(col, row) { return this.monsters.find(m => monsterCovers(m, col, row)) || null; },

    // 세계 좌표 근처에 서 있는 몬스터(길로 나간 막는 몬스터를 누를 때)
    monsterNear(x, y) {
        let best = null;
        let bestDist = 44;
        for (const m of this.monsters) {
            if (m.down > 0) continue;
            const dd = distance(x, y, m.x, m.y - 10);
            if (dd < bestDist) { bestDist = dd; best = m; }
        }
        return best;
    },

    // 모든 몬스터는 길 옆 칸(BUILD_CELLS)에만 놓는다. 길 칸은 막는 몬스터도 안 된다. 칸 하나에 하나만
    // 큰 몬스터는 (col, row)를 왼쪽 아래로 monsterCells만큼 모두 비어 있어야 한다. ignore는 비어 있다고 볼 몬스터들(옮기기, 합치기 재료)
    canPlace(type, col, row, ignore) {
        if (!MONSTERS[type]) return false;
        const [w, h] = monsterCells(type);
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                if (!isBuildCell(col + dx, row - dy)) return false;
                const m = this.monsterAt(col + dx, row - dy);
                if (m && !(ignore && ignore.includes(m))) return false;
            }
        }
        return true;
    },

    // (col, row)에서 가장 가까운 놓을 수 있는 칸. 없으면 그 자리(합치기 결과는 겹쳐도 사라지지 않게 둔다)
    nearestFit(type, col, row, ignore) {
        let best = null;
        let bestDist = Infinity;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            const d = (c - col) ** 2 + (r - row) ** 2;
            if (d < bestDist && this.canPlace(type, c, r, ignore)) { bestDist = d; best = { col: c, row: r }; }
        }
        return best || { col, row };
    },

    // 몬스터를 칸에 바로 세운다(비용 없음). 시험 도구가 쓴다
    place(type, col, row) {
        if (!this.canPlace(type, col, row)) return false;
        const m = createMonster(type, col, row);
        this.monsters.push(m);
        this.stats.placed++;
        Fx.ring(m.x, m.y + MONSTER_FOOT, 100, '#c79bff', 0.35);
        Fx.anim('fx_blastCyan', m.x, m.y - 50, 390, 0.45);
        Fx.burst(m.x, m.y - 40, '#c79bff', 18, 300, 0.4, 6);
        Sfx.play('build');
        return m;
    },

    inPlay() { return this.state === 'prep' || this.state === 'wave'; },

    // 지금 소환 비용: 처음 cost(마왕과 유물의 summonBase를 더한다), 소환할 때마다 costStep씩 오른다. 상한이 없다(후반에 골드가 남지 않게)
    summonCost() {
        if (this.power('transFree') && this.roundSummons === 0 && this.inPlay()) return 0; // 권능 공짜 거울
        const r = SUMMON_RULES;
        return Math.max(0, r.cost + this.mods.summonBase + r.costStep * this.summonCount);
    },

    // 종족 강화 레벨과 올리기. 실패해도 골드를 쓴다. reason: 'state' | 'family' | 'gold'
    familyLevel(family) { return this.familyLevels[family] || 0; },
    upgradeFamily(family) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!hasEntry(MONSTER_FAMILIES, family)) return { ok: false, reason: 'family' };
        const level = this.familyLevel(family);
        const cost = familyUpgradeCost(level);
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        const success = rng('familyUp') < familyUpgradeChance(level);
        if (success) this.familyLevels[family] = level + 1;
        return { ok: true, success, level: this.familyLevel(family), cost };
    },

    // 맵에 더 둘 자리가 있는지(상한)
    fieldFull() { return this.monsters.filter(m => !m.clone).length >= this.maxField(); }, // 거울 분신은 세지 않는다

    // 소환 강화: 다음 레벨 비용(최고 레벨이면 null)과 올리기. 실패하면 reason: 'state' | 'max' | 'gold'
    summonUpgradeCost() {
        const next = SUMMON_LEVELS[this.summonLevel + 1];
        if (!next) return null;
        const gold = this.lordPassive('goldTouch');
        return gold ? Math.round(next.cost * gold.upgradeMul) : next.cost;
    },

    upgradeSummon() {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        const cost = this.summonUpgradeCost();
        if (cost === null) return { ok: false, reason: 'max' };
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        this.gold -= cost;
        this.summonLevel++;
        Fx.goldPulse = 1;
        Fx.banner = { name: `소환 강화 ${this.summonLevel + 1}단계`, sub: '더 좋은 등급이 잘 나옵니다', age: 0, life: 1.6, small: true };
        Sfx.play('upgrade');
        return { ok: true, level: this.summonLevel, cost };
    },

    // 등급을 summonOdds로 고른 뒤 그 등급 몬스터 중 하나를 고른다. Math.random을 두 번 쓴다
    rollSummon() {
        const odds = this.summonOdds();
        const grades = GRADE_ORDER.filter(g => odds[g] > 0 && summonPool(g).length);
        let r = rng('summon');
        let grade = grades[0];
        for (const g of grades) {
            if (r < odds[g]) { grade = g; break; }
            r -= odds[g];
        }
        // 튜토리얼 첫 판: 처음 몇 번은 가장 낮은 등급이라 합치기를 바로 해 볼 수 있다(스토리 판만)
        if (this.tutorialCommons > 0 && !this.challenge) {
            this.tutorialCommons--;
            grade = grades[0];
        }
        // 일곱 번째 별: 7번째 소환마다 영웅 이상
        if (this.mods.seventhStar && (this.summonCount + 1) % 7 === 0 && GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf('epic') && summonPool('epic').length) grade = 'epic';
        // 종족 유물: 그 종족이 나올 확률 +100%(같은 등급 안에서 가중치)
        const pool = summonPool(grade);
        const weight = id => 1 + (this.mods[MONSTERS[id].family + 'Odds'] || 0);
        let total = 0;
        for (const id of pool) total += weight(id);
        let pick = rng('summon') * total;
        for (const id of pool) {
            pick -= weight(id);
            if (pick < 0) return id;
        }
        return pool[pool.length - 1];
    },

    // 소환한 몬스터를 세울 칸. 없으면 null
    //   원거리: 칸에서 길까지 거리가 사거리 안인 칸만
    //   막는 몬스터: 길 지점(rally)이 이미 있는 막는 몬스터의 길 지점과 blockerSpacing칸 안으로 겹치지 않는 칸을 먼저. 없으면 아무 빈 칸
    //   그중 길에 가장 가까운 칸들에서 무작위로 하나(Math.random 한 번)
    // peek이면 자리가 있는지만 본다. 화면이 프레임마다 물어도 난수를 쓰지 않아 입력 재생이 어긋나지 않는다
    pickSummonCell(type, peek) {
        const blocks = monsterBlocks(type);
        const range = MONSTERS[type].stats.range * TILE;
        let cells = [];
        for (const key of BUILD_CELLS) {
            const [col, row] = key.split(',').map(Number);
            if (!this.canPlace(type, col, row)) continue;
            const x = monsterHomeX(type, col);
            const y = monsterHomeY(type, row);
            const gap = nearestPathPoint(x, y).gap; // 두 갈래 중 가까운 쪽 길까지
            if (!blocks && gap > range + 0.5) continue;
            cells.push({ col, row, gap });
        }
        if (blocks) {
            const spacing = SUMMON_RULES.blockerSpacing * TILE + 0.5;
            const rallies = this.monsters.filter(m => m.blocks).map(m => nearestPathPoint(m.homeX, m.homeY));
            const apart = cells.filter(c => {
                const r = nearestPathPoint(monsterHomeX(type, c.col), monsterHomeY(type, c.row));
                return rallies.every(o => distance(r.x, r.y, o.x, o.y) > spacing);
            });
            if (apart.length) cells = apart;
        }
        if (!cells.length) return null;
        const best = Math.min(...cells.map(c => c.gap));
        const near = cells.filter(c => c.gap <= best + 0.5);
        const pick = peek ? near[0] : rngItem('cell', near);
        return { col: pick.col, row: pick.row };
    },

    // 골드를 내고 무작위 몬스터 1마리를 맵의 빈 길 옆 칸에 바로 세운다. 실패하면 골드를 쓰지 않고
    // reason: 'full'(상한이나 빈 칸 없음) | 'gold' | 'state'
    summon() {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (this.fieldFull()) return { ok: false, reason: 'full' };
        const cost = this.summonCost();
        if (!this.canPaySummon()) return { ok: false, reason: 'gold' };
        if (this.mods.summonPerRound && this.roundSummons >= this.mods.summonPerRound) return { ok: false, reason: 'cap' }; // 계약 조항 소환 제한
        // 큰 몬스터가 나왔는데 자리가 없으면 다시 뽑는다(작은 몬스터가 들어갈 칸은 있을 수 있다)
        let type = this.rollSummon();
        let cell = this.pickSummonCell(type);
        for (let i = 0; i < 8 && !cell && monsterCells(type).join() !== '1,1'; i++) {
            type = this.rollSummon();
            cell = this.pickSummonCell(type);
        }
        if (!cell) return { ok: false, reason: 'full' };
        // 도박꾼의 동전: 15% 공짜, 10% 두 배(두 배를 못 내면 원래 값)
        let pay = cost;
        if (this.mods.gamble) {
            const r = rng('relic');
            if (r < 0.15) pay = 0;
            else if (r < 0.25 && this.gold >= cost * 2) pay = cost * 2;
        }
        if (this.gold >= pay) {
            this.gold -= pay;
        } else {
            this.hp -= 1; // 유물 피의 계약서
            this.bloodSummons++;
            Fx.addShake(4);
        }
        this.summonCount++;
        this.roundSummons++;
        const m = createMonster(type, cell.col, cell.row);
        this.monsters.push(m);
        this.stats.summoned++;
        if (this.mods.freshSpeed) { m.buffT = 10; m.buff = { speed: this.mods.freshSpeed }; } // 신속의 장화
        // 유물 거울 쌍둥이: 같은 몬스터가 공짜로 1마리 더
        if (this.mods.twinSummon && rng('relic') < this.mods.twinSummon && !this.fieldFull()) {
            const spot = this.pickSummonCell(type);
            if (spot) {
                const twin = createMonster(type, spot.col, spot.row);
                this.monsters.push(twin);
                this.stats.summoned++;
                Fx.pop({ kind: 'summon', to: { x: twin.x, y: twin.y }, type, grade: MONSTERS[type].grade });
            }
        }
        Meta.seeMonster(type);
        const grade = MONSTERS[type].grade;
        Fx.pop({ kind: 'summon', to: { x: m.x, y: m.y }, type, grade });
        Sfx.play('summon', GRADE_ORDER.indexOf(grade));
        return { ok: true, type, monster: m, cost };
    },

    // 보스 보상 카드: 서로 다른 몬스터 BOSS_REWARD_RULES.monsterCards장(희귀 또는 영웅), 장비 1장(희귀 또는 영웅), 골드 1장.
    // 몬스터 카드마다 Math.random을 두 번 쓴다(등급, 몬스터). 고른 등급 후보가 다 나왔으면 다른 등급에서 고른다.
    // 장비 카드도 두 번 쓴다(등급, 장비)
    rollBossReward() {
        const R = BOSS_REWARD_RULES;
        const used = [];
        const cards = [];
        for (let i = 0; i < R.monsterCards; i++) {
            const first = rng('reward') < R.epicChance ? 'epic' : 'rare';
            const second = first === 'epic' ? 'rare' : 'epic';
            const left = g => gradePool(g).filter(t => !used.includes(t));
            const pool = left(first).length ? left(first) : left(second);
            if (!pool.length) break;
            const type = rngItem('reward', pool);
            used.push(type);
            cards.push({ kind: 'monster', type });
        }
        const equipGrade = rng('reward') < EQUIP_RULES.rewardEpicChance ? 'epic' : 'rare';
        cards.push({ kind: 'equip', id: rngItem('reward', equipPool(equipGrade)) });
        cards.push({ kind: 'gold', gold: R.gold });
        return { cards };
    },

    // 보상 몬스터를 맵에 세울 수 있는지(상한과 빈 칸)
    canTakeRewardMonster(type) {
        return !this.fieldFull() && !!this.pickSummonCell(type, true);
    },

    // 보상 카드를 고를 수 있는지: 몬스터는 맵에 자리가 있어야, 장비는 보관함에 자리가 있어야 한다
    canTakeReward(card) {
        if (card.kind === 'monster') return this.canTakeRewardMonster(card.type);
        if (card.kind === 'equip') return !this.bagFull();
        return true;
    },

    // ----- 장비 -----

    bagFull() { return this.equipBag.length >= EQUIP_RULES.slots; },

    // 장비 하나를 보관함에 넣는다. 가득 차 있으면 EQUIP_RULES.fullGold 골드로 바꾸고 글자로 알린다.
    // (x, y)는 연출 위치(세계 좌표, 없으면 연출 없음). { kind: 'bag' | 'gold', id }
    gainEquip(id, x, y) {
        const def = EQUIPMENT[id];
        Meta.seeEquip(id); // 무기고 기록(골드로 바뀌어도 얻은 것으로 친다)
        if (!this.bagFull()) {
            this.equipBag.push(id);
            if (x !== undefined) Fx.drops.push({ id, x, y, age: 0, life: 1.3 });
            return { kind: 'bag', id };
        }
        this.gold += EQUIP_RULES.fullGold;
        Fx.goldPulse = 1;
        if (x !== undefined) Fx.coin(x, y, EQUIP_RULES.fullGold);
        Fx.notice = `보관함이 가득 차 ${def.name}을(를) ${EQUIP_RULES.fullGold}G로 바꿨습니다.`;
        return { kind: 'gold', id };
    },

    // 보관함 index번 장비를 맵의 몬스터에게 끼운다(라운드 중에도). 이미 끼고 있으면 맞바꿔 원래 장비가 그 칸으로 돌아간다.
    // 체력은 비율을 유지한다. 실패하면 { ok: false, reason: 'state' | 'empty' | 'index' }
    equipMonster(m, index) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || m.removed || !this.monsters.includes(m)) return { ok: false, reason: 'empty' };
        const id = this.equipBag[index];
        if (!id) return { ok: false, reason: 'index' };
        const old = m.equip;
        // 재료 위에 재료를 놓으면 완성 장비가 된다. 그 밖에는 맞바꾼다
        const crafted = old ? craftResult(old, id) : null;
        if (crafted) {
            this.equipBag.splice(index, 1);
            setMonsterEquip(m, crafted);
            Meta.seeEquip(crafted);
            Fx.notice = `조합: ${EQUIPMENT[crafted].name}`;
            const fx = (m.down > 0 ? m.homeY : m.y) + MONSTER_FOOT;
            Fx.anim('fx_blastGold', m.x, fx - 40, 180, 0.4);
            Sfx.play('upgrade');
            return { ok: true, id: crafted, crafted: true, swapped: null };
        }
        // 장비 먹는 괴물: 첫 칸이 차 있으면 둘째 칸에
        if (old && this.mods.equipSlots && !m.equip2) {
            this.equipBag.splice(index, 1);
            setMonsterEquip2(m, id);
            Sfx.play('upgrade');
            return { ok: true, id, swapped: null, second: true };
        }
        if (old) this.equipBag[index] = old;
        else this.equipBag.splice(index, 1);
        setMonsterEquip(m, id);
        const color = MONSTER_GRADES[EQUIPMENT[id].grade].color;
        const footY = (m.down > 0 ? m.homeY : m.y) + MONSTER_FOOT;
        const x = m.down > 0 ? m.homeX : m.x;
        Fx.ring(x, footY, 100, color, 0.35);
        Fx.rise(x, footY, color, 14, 30, 0.5);
        Sfx.play('upgrade');
        return { ok: true, id, swapped: old || null };
    },

    // 보관함의 재료 두 개를 합친다(a, b는 칸 번호). 실패하면 { ok: false, reason: 'state' | 'index' | 'recipe' }
    craftBag(a, b) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (a === b || !this.equipBag[a] || !this.equipBag[b]) return { ok: false, reason: 'index' };
        const id = craftResult(this.equipBag[a], this.equipBag[b]);
        if (!id) return { ok: false, reason: 'recipe' };
        this.equipBag[Math.min(a, b)] = id;
        this.equipBag.splice(Math.max(a, b), 1);
        Meta.seeEquip(id);
        Fx.notice = `조합: ${EQUIPMENT[id].name}`;
        Sfx.play('upgrade');
        return { ok: true, id };
    },

    // 낀 장비를 빼 보관함으로 돌려보낸다. 보관함이 가득 차면 빼지 않는다({ ok: false, reason: 'full' })
    unequipMonster(m) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || !m.equip) return { ok: false, reason: 'none' };
        if (this.bagFull()) return { ok: false, reason: 'full' };
        // 둘째 칸부터 뺀다
        const id = m.equip2 || m.equip;
        this.equipBag.push(id);
        if (m.equip2) setMonsterEquip2(m, null);
        else setMonsterEquip(m, null);
        Sfx.play('click');
        return { ok: true, id };
    },

    // 맵에서 사라지는 몬스터(제물, 판매)의 장비를 보관함으로 돌려보낸다(자리가 없으면 골드)
    returnEquip(m) {
        if (m.equip2) {
            const id2 = m.equip2;
            m.equip2 = null;
            this.gainEquip(this.returnedEquipId(id2), m.x, m.y - 40);
        }
        if (!m.equip) return null;
        const id = m.equip;
        m.equip = null;
        return this.gainEquip(this.returnedEquipId(id), m.x, m.y - 40);
    },

    // 합칠 때 장비: 등급이 높은 쪽 1개가 결과로 이어지고(같으면 끌어온 src 쪽), 나머지는 돌아간다
    mergeEquip(src, dst) { return this.mergeEquipAll([src, dst]); },

    // 재료 여럿의 장비: 가장 좋은 것 1개(같으면 앞쪽 재료)가 이어지고 나머지는 돌아간다
    mergeEquipAll(materials) {
        const back = materials.flatMap(m => [m.equip, m.equip2]).filter(Boolean);
        const keep = bestEquip(back);
        if (keep) back.splice(back.indexOf(keep), 1);
        const keep2 = this.mods.equipSlots ? bestEquip(back) : null;
        if (keep2) back.splice(back.indexOf(keep2), 1);
        return { keep, keep2, back };
    },

    // 정예 용사를 처치하면 EQUIP_RULES.eliteDrop(마왕과 유물의 eliteDrop을 더한다) 확률로 재료를 떨어뜨린다
    eliteDrop(x, y) {
        const R = EQUIP_RULES;
        if (rng('reward') >= R.eliteDrop + this.mods.eliteDrop) return null;
        const id = rngItem('reward', EQUIP_BASES);
        const res = this.gainEquip(id, x, y);
        if (res.kind === 'bag') Fx.notice = `재료: ${EQUIPMENT[id].name}`;
        return res;
    },

    // 보스 보상 카드 i번을 고른다. 몬스터는 소환처럼 맵의 빈 칸에 바로 나온다(소환 비용과 횟수는 그대로).
    // 실패하면 { ok: false, reason: 'none' | 'index' | 'full' }
    pickBossReward(i) {
        const reward = this.bossReward;
        if (!reward) return { ok: false, reason: 'none' };
        const card = reward.cards[i];
        if (!card) return { ok: false, reason: 'index' };
        if (card.kind === 'gold') {
            this.gold += card.gold;
            Fx.goldPulse = 1;
            Sfx.play('sell');
            this.bossReward = null;
            return { ok: true, card };
        }
        if (card.kind === 'equip') {
            if (this.bagFull()) return { ok: false, reason: 'bagFull' };
            this.equipBag.push(card.id);
            Meta.seeEquip(card.id);
            Sfx.play('upgrade');
            this.bossReward = null;
            return { ok: true, card };
        }
        if (this.fieldFull()) return { ok: false, reason: 'full' };
        const cell = this.pickSummonCell(card.type);
        if (!cell) return { ok: false, reason: 'full' };
        const m = createMonster(card.type, cell.col, cell.row);
        this.monsters.push(m);
        Meta.seeMonster(card.type);
        const grade = MONSTERS[card.type].grade;
        Fx.pop({ kind: 'summon', to: { x: m.x, y: m.y }, type: card.type, grade });
        Sfx.play('summon', GRADE_ORDER.indexOf(grade));
        this.bossReward = null;
        return { ok: true, card, monster: m };
    },

    // 맵의 몬스터를 다른 빈 길 옆 칸으로 옮긴다. 쓰러져 있으면 새 칸에서 마저 기다린다
    moveMonster(m, col, row) {
        if (m.col === col && m.row === row) return false;
        if (!this.canPlace(m.type, col, row, [m])) return false;
        this.releaseMonster(m);
        m.col = col;
        m.row = row;
        m.homeX = m.x = monsterHomeX(m.type, col);
        m.homeY = m.y = monsterHomeY(m.type, row);
        m.moving = false;
        m.shot = null;
        if (m.blocks) {
            const r = nearestPathPoint(m.homeX, m.homeY);
            m.rally = { route: r.route, d: r.d, x: r.x, y: r.y - MONSTER_FOOT + 10 };
        }
        Fx.ring(m.x, m.y + MONSTER_FOOT, 100, '#c79bff', 0.3);
        Fx.burst(m.x, m.y, '#c79bff', 10, 240, 0.35, 6);
        Sfx.play('build');
        return true;
    },

    // 붙잡던 용사를 놓아준다(옮기기, 판매, 합치기)
    releaseMonster(m) {
        m.target = null;
        for (const h of this.heroes) if (h.blocker === m) h.blocker = null;
    },

    removeMonster(m) {
        this.monsters = this.monsters.filter(x => x !== m);
        m.removed = true;
        this.releaseMonster(m);
    },

    // 자리: { monster: 맵의 몬스터 }
    typeAt(loc) {
        if (!loc || !loc.monster) return null;
        return loc.monster.removed ? null : loc.monster.type;
    },

    sameLoc(a, b) { return a.monster === b.monster; },

    // 연출 좌표: 세계 좌표(서 있는 곳)
    fxPoint(loc) { return { x: loc.monster.x, y: loc.monster.y }; },

    // 맵의 grade 등급 몬스터 수(exclude에 든 개체는 세지 않는다)
    gradeCount(grade, exclude) {
        return this.monsters.filter(m => !m.removed && !(exclude && exclude.includes(m)) && MONSTERS[m.type].grade === grade).length;
    },

    // 등급 합치기의 나머지 재료 후보: base와 같은 등급인 맵의 몬스터(exclude 제외)를
    // 랭크가 낮은 순, 장비가 없는 쪽 먼저, base(끄는 몬스터)와 가까운 순으로 늘어놓는다
    mergeCandidates(base, exclude) {
        const grade = MONSTERS[base.type].grade;
        const dist = m => distance(m.homeX, m.homeY, base.homeX, base.homeY);
        return this.monsters
            .filter(m => m !== base && !m.removed && !m.clone && !exclude.includes(m) && MONSTERS[m.type].grade === grade)
            .sort((x, y) => (x.rank || 0) - (y.rank || 0) || (x.equip ? 1 : 0) - (y.equip ? 1 : 0) || dist(x) - dist(y));
    },

    // 등급 합치기의 나머지 재료(a, b 말고 MERGE_RULES.gradeCount - 2마리). 고른 것(picked)이 쓸 수 있으면 먼저 쓰고 모자라면 자동으로 채운다.
    // 다 채우지 못하면 null
    mergeExtras(a, b, picked) {
        const need = MERGE_RULES.gradeCount - 2;
        const grade = MONSTERS[a.type].grade;
        const extra = [];
        for (const m of [].concat(picked || [])) {
            if (extra.length >= need) break;
            if (m && m !== a && m !== b && !m.removed && !m.clone && this.monsters.includes(m) && !extra.includes(m) && MONSTERS[m.type].grade === grade) extra.push(m);
        }
        for (const m of this.mergeCandidates(a, [b, ...extra])) {
            if (extra.length >= need) break;
            extra.push(m);
        }
        return extra.length >= need ? extra : null;
    },

    // 맵의 두 몬스터(개체)를 합칠 때의 판단. mergePlan(랭크 조건 포함)에 등급 합치기의 나머지 재료와 맵 수 제한(등급 fieldMax)을 더한다.
    //   a: 끄는 몬스터, b: 놓는 몬스터(결과 칸), picked: 나머지 재료로 고른 몬스터(없거나 못 쓰면 자동), gradeOnly: 조합식을 보지 않는다
    //   등급 합치기는 { kind: 'grade', grade, count, extra: [나머지 재료] }. 같은 등급이 모자라면 { kind: 'none', reason: 'count', grade, have, count }
    //   결과가 제한을 넘으면 { kind: 'none', reason: 'unique', grade, ... }. 사라지는 재료는 세지 않는다
    mergePlanFor(a, b, picked, gradeOnly) {
        const plan = mergePlan(a, b, gradeOnly);
        if (plan.kind === 'none') return plan;
        let materials = [a, b];
        if (plan.kind === 'grade') {
            const extra = this.mergeExtras(a, b, picked);
            if (!extra) return { kind: 'none', reason: 'count', grade: plan.grade, have: this.gradeCount(MONSTERS[a.type].grade), count: plan.count };
            plan.extra = extra;
            materials = materials.concat(extra);
        }
        const grade = plan.kind === 'recipe' ? MONSTERS[plan.result].grade : plan.grade;
        const max = MONSTER_GRADES[grade].fieldMax;
        if (max !== undefined && this.gradeCount(grade, materials) >= max) {
            return Object.assign({}, plan, { kind: 'none', reason: 'unique', grade, plan: plan.kind });
        }
        // 조합식 결과: 맵 제한이 있는 등급은 같은 종을 두 마리 둘 수 없다
        if (plan.kind === 'recipe' && max !== undefined) {
            if (this.monsters.some(m => !m.removed && !materials.includes(m) && m.type === plan.result)) {
                return Object.assign({}, plan, { kind: 'none', reason: 'unique', grade, plan: plan.kind, sameKind: true });
            }
        }
        return plan;
    },

    // 재료가 여럿인 히든 조합식(recipe.parts): m이 S랭크 핵심 재료(a)일 때 맵에서 나머지 재료를 고른다.
    // 랭크가 낮고 장비가 없는 몬스터를 먼저 쓴다. 조합식이 없거나 재료가 모자라면 { kind: 'none', reason: 'none' | 'rank' | 'count' }
    // 맵 제한에 걸리면 { kind: 'none', reason: 'unique', ... }. 합칠 수 있으면 merge에 그대로 넘기는 계획이다(dst가 m, src가 b)
    fullRecipePlan(m) {
        if (!m || m.removed || !this.monsters.includes(m)) return { kind: 'none', reason: 'none' };
        const recipe = MONSTER_RECIPES.find(r => r.parts && r.a === m.type);
        if (!recipe) return { kind: 'none', reason: 'none' };
        if ((m.rank || 0) < rankIndex(recipe.aRank)) return { kind: 'none', reason: 'rank', recipe };
        const used = [m];
        const pick = (type, count) => {
            const list = this.monsters.filter(o => o.type === type && !o.removed && !used.includes(o))
                .sort((x, y) => (x.rank || 0) - (y.rank || 0) || (x.equip ? 1 : 0) - (y.equip ? 1 : 0));
            if (list.length < count) return null;
            const got = list.slice(0, count);
            used.push(...got);
            return got;
        };
        const b = pick(recipe.b, 1);
        if (!b) return { kind: 'none', reason: 'count', recipe };
        const extra = [];
        for (const p of recipe.parts) {
            const got = pick(p.type, p.count);
            if (!got) return { kind: 'none', reason: 'count', recipe };
            extra.push(...got);
        }
        const grade = MONSTERS[recipe.result].grade;
        const others = this.monsters.filter(o => !o.removed && !used.includes(o));
        const max = MONSTER_GRADES[grade].fieldMax;
        if (max !== undefined && others.some(o => o.type === recipe.result)) return { kind: 'none', reason: 'unique', grade, sameKind: true, recipe };
        if (max !== undefined && others.filter(o => MONSTERS[o.type].grade === grade).length >= max) return { kind: 'none', reason: 'unique', grade, recipe };
        return { kind: 'recipe', recipe, result: recipe.result, src: b[0], dst: m, extra };
    },

    // 등급 합치기 결과 후보: 맵 제한이 있는 등급은 맵에 이미 있는 종을 뺀다(재료는 사라지므로 센다 않는다)
    mergeResultPool(grade, materials) {
        const pool = mergePool(grade);
        if (MONSTER_GRADES[grade].fieldMax === undefined) return pool;
        const free = pool.filter(t => !this.monsters.some(m => !m.removed && m.type === t && !materials.includes(m)));
        return free.length ? free : pool;
    },

    // 팝업의 합치기 버튼: m과 같은 등급 몬스터를 끌기와 같은 판단(랭크 낮음, 장비 없음, 가까움)으로 골라 gradeCount마리를 합친다.
    // 결과는 m의 칸. 조합식은 보지 않는다. { kind: 'grade', src, dst, extra, ... } 또는 { kind: 'none', reason }
    quickMergePlan(m) {
        if (!m || m.removed || !this.monsters.includes(m)) return { kind: 'none', reason: 'empty' };
        const next = nextGrade(MONSTERS[m.type].grade);
        if (!next) return { kind: 'none', reason: 'top' };
        const src = this.mergeCandidates(m, [])[0];
        if (!src) return { kind: 'none', reason: 'count', grade: next, have: 1, count: MERGE_RULES.gradeCount };
        return Object.assign(this.mergePlanFor(src, m, null, true), { src, dst: m });
    },

    // 자동 합치기 한 번: 가장 낮은 등급부터 같은 등급 3마리를 합친다.
    // S랭크는 히든 조합 재료이므로 쓰지 않는다. 합칠 수 있으면 { ok: true }
    autoMergeStep() {
        const free = m => !m.removed && !m.clone && (m.rank || 0) < rankIndex('S'); // S 이상은 자동 합치기 재료로 쓰지 않는다
        for (const grade of GRADE_ORDER) {
            if (!nextGrade(grade)) continue;
            const list = this.monsters.filter(m => free(m) && MONSTERS[m.type].grade === grade).sort((a, b) => (b.rank || 0) - (a.rank || 0));
            if (list.length < MERGE_RULES.gradeCount) continue;
            for (const dst of list) {
                const plan = this.quickMergePlan(dst);
                if (plan.kind === 'none' || !free(plan.src) || !(plan.extra || []).every(free)) continue;
                return this.merge({ monster: plan.src }, { monster: plan.dst }, plan.extra, true);
            }
        }
        return { ok: false };
    },

    // 무한 라운드: 다음 라운드가 늘 표에 있게 한다
    extendRounds() {
        if (!this.challenge) return;
        while (this.waves.length < this.waveIndex + 3) this.waves.push(this.roundFor(this.waves.length + 1, buildRound(this.waves.length + 1)));
    },

    // 도전의 r번째 라운드: 토벌전은 보스 자리에 이번 주 보스를 세운다
    roundFor(r, wave) {
        const c = this.challenge;
        // 계약 조항 잦은 보스: 10라운드 보스 사이(5, 15, 25...)에도 대마도사가 온다
        if (c && this.mods.bossEvery5 && !wave.boss && r % 5 === 0) return Object.assign({}, wave, { boss: 'archmage' });
        if (!c || c.kind !== 'raid' || !wave.boss) return wave;
        return Object.assign({}, wave, { boss: c.boss });
    },

    // 토벌전 보스 체력의 단계 배율. 곱셈을 되풀이한다(입력 재생)
    raidBossMul() {
        if (!this.challenge || this.challenge.kind !== 'raid') return 1;
        let mul = 1;
        for (let i = 0; i < this.raidTier; i++) mul *= RAID_RULES.tierHpGrowth;
        return mul;
    },

    // 토벌전: 보스에게 준 피해도 점수다
    scoreBossDamage(dealt) {
        if (!this.challenge || this.challenge.kind !== 'raid') return;
        this.addScore(dealt * RAID_RULES.bossDamageScore);
    },

    // 무한 라운드의 추가 체력 배율. 곱셈을 되풀이한다(Math.pow는 엔진마다 값이 다를 수 있어 입력 재생이 어긋난다)
    endlessHpMul(waveIndex) {
        if (!this.challenge) return 1;
        const from = this.challenge.hpFrom || ENDLESS_RULES.hpFrom;
        const growth = this.challenge.hpGrowth || ENDLESS_RULES.hpGrowth;
        let mul = 1;
        for (let r = from; r < waveIndex; r++) mul *= growth;
        return mul;
    },

    // 끝없는 심연: 층이 깊어지면 변이가 쌓이고 지역이 바뀐다. 라운드를 시작할 때 부른다
    abyssStep() {
        const c = this.challenge;
        if (!c || c.kind !== 'abyss') return;
        const want = Math.floor(this.waveIndex / ABYSS_RULES.mutateEvery);
        if (this.mutations.length >= want) return;
        while (this.mutations.length < want) this.mutations.push(abyssMutation(c.seed, this.mutations.length));
        this.mods = buildMods(c.lord, c.relics, c.cards.concat(this.mutations)); // 서명한 계약 조항은 끝까지 붙어 있다
        this.applyPowerMods(); // 다시 만든 표에 찍은 권능을 더한다
        // 약해지는 변이가 겹쳐도 몬스터가 아예 못 싸우게 되지는 않는다
        this.mods.attackSpeed = Math.max(-0.5, this.mods.attackSpeed);
        this.mods.damage = Math.max(-0.5, this.mods.damage);
        this.heroHpMul = this.mods.heroHp;
        this.zone = abyssZone(c.seed, this.mutations.length);
        const card = RULE_CARDS[this.mutations[this.mutations.length - 1]];
        Fx.banner = { name: `심연 ${this.waveIndex + 1}층`, sub: `변이: ${card.name} · ${effectLines(card.effects).join(', ')}`, age: 0, life: 2.4, small: true };
    },

    // 도전 점수: 처치와 라운드마다 라운드 배율만큼 쌓인다
    addScore(base) {
        if (!this.challenge) return 0;
        const gain = Math.floor(base * scoreMul(this.waveIndex + 1) * (1 + this.mutations.length * ABYSS_RULES.scorePerMutation));
        this.score += gain;
        return gain;
    },

    scoreKill(hero) {
        const S = SCORE_RULES;
        this.addScore(S.kill * (hero.boss ? S.bossMul : (hero.elite ? S.eliteMul : 1)));
    },

    // 입력 기록 한 줄: 몬스터는 개체 번호(uid)로 적는다. 실패한 입력도 적는다(소환 실패도 난수를 쓰므로 그대로 재생해야 같다)
    encodeInput(cmd) {
        const out = { t: this.tick };
        for (const [k, v] of Object.entries(cmd)) {
            if (k === 'monster' || k === 'src' || k === 'dst') out[k] = v ? v.uid : null;
            else if (k === 'extra') out[k] = v ? v.map(m => m.uid) : v;
            else out[k] = v;
        }
        return out;
    },

    // 기록 한 줄을 다시 실행한다. 없는 몬스터를 가리키면 건너뛴다
    applyInput(input) {
        const byUid = id => this.monsters.find(m => m.uid === id);
        const cmd = {};
        for (const [k, v] of Object.entries(input)) {
            if (k === 't') continue;
            if (k === 'monster' || k === 'src' || k === 'dst') {
                cmd[k] = byUid(v);
                if (!cmd[k]) return { ok: false, reason: 'missing' };
            } else if (k === 'extra') cmd[k] = v ? v.map(byUid).filter(Boolean) : v;
            else cmd[k] = v;
        }
        return this.act(cmd);
    },

    // 행동 하나: 입력(끌어 놓기, 버튼)과 처리를 이 함수로 모은다(뒤에 고정 난수와 입력 기록을 여기에 넣는다).
    //   { kind: 'merge', src, dst, extra? }  끌어 합치기(src, dst는 맵의 몬스터. extra는 고른 나머지 재료, 없으면 자동)
    //   { kind: 'quickMerge', monster }       팝업의 합치기 버튼
    //   { kind: 'fullRecipe', monster }       재료가 여럿인 히든 조합식(monster는 S랭크 전설)
    //   { kind: 'summon' } | { kind: 'sell', monster } | { kind: 'sacrifice', monster } | { kind: 'move', monster, col, row }
    act(cmd) {
        if (this.record && !this.replaying && this.inPlay()) this.record.inputs.push(this.encodeInput(cmd));
        if (hasEntry(SKILL_CASTS, cmd.kind)) return this.useSkill(cmd.kind, cmd.x, cmd.y); // 마왕 스킬(Q, W, E)
        switch (cmd.kind) {
            case 'autoMerge': this.autoMerge = !!cmd.on; return { ok: true };
            case 'pickReward': return this.pickBossReward(cmd.i);
            case 'equip': return this.equipMonster(cmd.monster, cmd.i);
            case 'craft': return this.craftBag(cmd.a, cmd.b);
            case 'unequip': return this.unequipMonster(cmd.monster);
            case 'upgrade': return { ok: !!this.upgrade(cmd.monster, cmd.branch) };
            case 'familyUp': return this.upgradeFamily(cmd.family);
            case 'relicFire': return { ok: !!fireRelic(cmd.id) };
            case 'power': return this.buyPower(cmd.id);
            case 'corrupt': return corruptCorpse(this.corpses[cmd.i]);
            case 'startWave': this.startWave(); return { ok: true };
            case 'surrender': {
                // 항복: 마왕 체력을 0으로(남은 체력이 순위에 득이 되지 않게) 하고 진 판으로 끝낸다
                if (!this.inPlay()) return { ok: false, reason: 'state' };
                this.hp = 0;
                this.finish(false);
                return { ok: true };
            }
            case 'nextRound': return { ok: !!this.nextRound() };
            case 'merge': return this.merge({ monster: cmd.src }, { monster: cmd.dst }, cmd.extra);
            case 'quickMerge': {
                if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
                const plan = this.quickMergePlan(cmd.monster);
                if (plan.kind === 'none') return { ok: false, reason: plan.reason, plan };
                return this.merge({ monster: plan.src }, { monster: plan.dst }, plan.extra, true);
            }
            case 'fullRecipe': {
                if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
                const plan = this.fullRecipePlan(cmd.monster);
                if (plan.kind === 'none') return { ok: false, reason: plan.reason, plan };
                return this.merge({ monster: plan.src }, { monster: plan.dst }, null, false, plan);
            }
            case 'summon': return this.summon();
            case 'buyField': return this.buyField();
            case 'buyMana': return this.buyMana();
            case 'awaken': return this.buyAwaken();
            case 'reroll': return this.reroll(cmd.monster);
            case 'rollRank': return this.rollRank(cmd.monster);
            case 'upgradeSummon': return this.upgradeSummon();
            case 'sell': this.sell(cmd.monster); return { ok: true };
            case 'sacrifice': return this.sacrifice(cmd.monster);
            case 'move': return { ok: this.moveMonster(cmd.monster, cmd.col, cmd.row) };
        }
        return { ok: false, reason: 'kind' };
    },

    // 끌어온 몬스터(src)를 다른 몬스터(dst) 위에 놓아 합친다. 결과는 dst 자리에 남고 다른 재료 자리는 빈다.
    //   조합식: src와 dst 2마리. 등급 합치기: 같은 등급 gradeCount마리(나머지는 extra, 못 쓰면 자동으로 고른다)
    //   랭크는 재료 중 가장 낮은 값, 장비는 가장 좋은 것 하나를 잇고(같으면 끌어온 쪽, 놓은 쪽, 나머지 순) 나머지는 보관함으로
    // 실패하면 { ok: false, reason: 'same' | 'empty' | 'top' | 'mismatch' | 'unique' | 'count' | 'room' }
    merge(src, dst, extra, gradeOnly, fullPlan) {
        const a = this.typeAt(src);
        const b = this.typeAt(dst);
        if (!a || !b) return { ok: false, reason: 'empty' };
        if (this.sameLoc(src, dst)) return { ok: false, reason: 'same' };
        if ((src.monster && src.monster.clone) || (dst.monster && dst.monster.clone)) return { ok: false, reason: 'clone' }; // 거울 분신은 합치지 못한다
        const plan = fullPlan || this.mergePlanFor(src.monster, dst.monster, extra, gradeOnly);
        if (plan.kind === 'none') return { ok: false, reason: plan.reason, plan };
        // 유물 미치광이의 주사위: 등급 합치기가 확률로 두 등급 오른다(전설까지)
        let resultGrade = plan.grade;
        if (plan.kind === 'grade' && this.mods.mergeJump && rng('merge') < this.mods.mergeJump) {
            const higher = nextGrade(plan.grade);
            if (higher && higher !== 'mythic') resultGrade = higher;
        }
        // 결과는 재료가 비울 자리를 포함해 맵 어딘가에 들어가는 몬스터만(큰 몬스터가 겹쳐 서지 않게). 하나도 없으면 합치지 않는다
        const leaving = [src.monster, dst.monster, ...(plan.extra || [])];
        const fits = t => [...BUILD_CELLS].some(k => { const [c, r] = k.split(',').map(Number); return this.canPlace(t, c, r, leaving); });
        const pool = (plan.kind === 'recipe' ? [plan.result] : this.mergeResultPool(resultGrade, leaving)).filter(fits);
        if (!pool.length) return { ok: false, reason: 'room', plan: { kind: 'none', reason: 'room' } };
        const type = plan.kind === 'recipe' ? plan.result : rngItem('merge', pool);
        const hidden = !!(plan.recipe && plan.recipe.hidden);
        // 조합식은 영구 기록(도감)에 한 번만 남는다. 히든 발견 연출은 기록에 처음 남을 때만 띄운다
        const found = plan.recipe ? Meta.findRecipe(plan.recipe) : false;
        const discovered = hidden && found;
        Meta.seeMonster(type);
        const old = dst.monster;
        const materials = [src.monster, old, ...(plan.extra || [])];
        const from = materials.map(m => this.fxPoint({ monster: m }));
        for (const m of materials) if (m !== old) this.removeMonster(m);
        // 결과가 더 크면 재료가 비운 자리를 포함해 가장 가까운 빈 곳에 선다
        const spot = this.nearestFit(type, old.col, old.row, materials);
        const monster = createMonster(type, spot.col, spot.row);
        // 랭크는 재료 중 가장 낮은 값을 이어받는다(합치기로 랭크가 오르지는 않는다)
        // 재료가 여럿인 히든 조합식은 핵심 재료(놓은 쪽)의 랭크를 잇는다
        setMonsterRank(monster, fullPlan ? (old.rank || 0) : Math.min(...materials.map(m => m.rank || 0)));
        // 장비는 가장 좋은 것 1개를 이어받고, 나머지는 보관함으로(자리가 없으면 골드)
        const equip = this.mergeEquipAll(materials);
        if (equip.keep) setMonsterEquip(monster, equip.keep);
        if (equip.keep2) setMonsterEquip2(monster, equip.keep2); // 장비 먹는 괴물: 둘째 칸도 이어진다
        for (const m of materials) { m.equip = null; m.equip2 = null; }
        // 유물: 신속의 장화, 탐식의 위장(재료 중 가장 큰 값 + 5%), 신화의 파편
        if (this.mods.freshSpeed) { monster.buffT = 10; monster.buff = { speed: this.mods.freshSpeed }; }
        if (this.mods.feast) monster.feast = Math.max(0, ...materials.map(o => o.feast || 0)) + this.mods.feast;
        if (this.mods.mythicGold && MONSTERS[type].grade === 'mythic') this.gold += this.mods.mythicGold;
        const returned = equip.back.map(id => this.gainEquip(this.returnedEquipId(id), monster.x, monster.y - 40));
        monster.reveal = MERGE_REVEAL; // 빨려 들어가는 연출이 끝난 뒤 나타난다
        this.monsters[this.monsters.indexOf(old)] = monster;
        old.removed = true;
        this.releaseMonster(old);
        const to = { x: monster.x, y: monster.y };
        this.stats.merged++;
        // 거울 마녀: 거울상(끌어온 재료가 돌아옴)과 은 세공(결과 등급만큼 골드)
        mirrorAfterMerge(src.monster, plan, resultGrade);
        if (this.power('transGold')) this.gold += COMBAT_RULES.mirror.transGold[MONSTERS[type].grade] || 0;
        const grade = MONSTERS[type].grade;
        Fx.pop({ kind: 'merge', from, fromTypes: materials.map(m => m.type), to, type, grade, hidden });
        Sfx.play('merge', GRADE_ORDER.indexOf(grade));
        if (discovered) {
            // 재료 줄에는 조합식의 랭크 조건도 적는다. 높은 등급(등급 표의 fx)은 더 오래 보여 준다
            const r = plan.recipe;
            const fx = gradeInfo(grade, 'fx', 0);
            Fx.discovery = { a: r.a, aRank: r.aRank || null, b: r.b, bRank: r.bRank || null, parts: r.parts || null, type, grade,
                age: -MERGE_REVEAL, life: fx >= 3 ? 5.4 : (fx >= 2 ? 4.6 : 3.6) };
            Sfx.play('hidden');
        }
        return { ok: true, type, kind: plan.kind, hidden, discovered, monster, equip: equip.keep, returned, materials };
    },

    // 판매 환불: 등급별 고정값에 마왕과 유물의 refund를 곱한다
    sellValue(type) { return Math.round((SUMMON_RULES.refund[MONSTERS[type].grade] || 0) * this.mods.refund); },

    // 세계 좌표가 왕좌(마왕) 위인지: 왕좌 칸 둘레 3x3과 마왕 그림이 서 있는 위쪽 한 칸
    onThrone(wx, wy) {
        const col = Math.floor(wx / TILE);
        const row = Math.floor((wy - MAP_TOP) / TILE);
        return isThroneArea(col, row);
    },

    // 제물: 맵의 몬스터를 왕좌에 바친다. 몬스터는 사라지고(칸이 비고 붙잡던 용사가 풀린다) 마왕 체력과 번개 대기가 좋아진다.
    // 체력이 가득해도 번개 감소를 위해 바칠 수 있다. 환불은 없다. 실패하면 { ok: false, reason: 'state' | 'empty' }
    sacrifice(m) {
        if (!this.inPlay()) return { ok: false, reason: 'state' };
        if (!m || m.removed || !this.monsters.includes(m)) return { ok: false, reason: 'empty' };
        if (m.clone) return { ok: false, reason: 'clone' }; // 거울 분신은 바칠 수 없다
        const gain = this.sacrificeGain(m);
        const heal = Math.min(gain.heal, Math.max(0, this.maxHp() - this.hp));
        this.hp += heal;
        const q = this.skillKey(0); // 제물은 스킬 1(Q)의 대기를 줄인다
        this.skills[q] = Math.max(0, this.skills[q] - gain.lightning * (this.power('sacCharge') ? 2 : 1));
        const grade = MONSTERS[m.type].grade;
        const from = { x: m.x, y: m.y };
        this.removeMonster(m);
        const equip = this.returnEquip(m); // 장비는 보관함으로(자리가 없으면 골드)
        this.stats.sacrificed++;
        // 권능 제물 갈래
        if (this.power('sacRage')) {
            for (const o of this.monsters) {
                if (o.removed) continue;
                o.buffT = 8;
                o.buff = { speed: 0.25 };
            }
        }
        if (this.power('sacMana')) this.addMana(1);
        if (this.power('sacGold')) this.gold += this.summonCost() * 2;
        if (this.power('sacRoar')) this.skills[this.skillKey(1)] = 0; // 여왕의 외침: 스킬 2(W)
        if (this.power('sacSoul')) this.soulVolley(true);
        if (this.power('rotSac')) {
            // 역병 제물: 맵의 모든 용사에게 독
            const rule = COMBAT_RULES.plague;
            const p = this.lordPassive('plague');
            for (const h of this.heroes) if (!h.dead && !h.waiting) poisonHero(h, p ? p.duration : 3, rule.sacDps + rule.sacDpsPerRound * this.waveIndex, null);
        }
        // 연출: 몬스터가 왕좌로 빨려 들어간 뒤(MERGE_REVEAL) 마왕이 빛나고 체력 막대가 차오른다
        const tx = tileX(THRONE_TILE.col);
        const ty = tileY(THRONE_TILE.row);
        Fx.pop({ kind: 'sacrifice', from: [from], fromTypes: [m.type], to: { x: tx, y: ty - 40 }, type: m.type, grade });
        Fx.pendingSacrifices.push({ t: MERGE_REVEAL, x: tx, y: ty, heal });
        this.throneBless = MERGE_REVEAL + 1.1;
        Fx.say(tx, ty - LORD_SAY_Y, lordLine('sacrifice'), 2);
        Sfx.play('merge', GRADE_ORDER.indexOf(grade));
        return { ok: true, heal, lightning: gain.lightning, gain, equip };
    },

    upgrade(m, branch) {
        const nextTier = m.tier + 1;
        if (nextTier > 3) return false;
        if (nextTier === 3 && !branch) return false;
        const cost = upgradeCost(m.type, nextTier);
        if (this.gold < cost) return false;
        this.gold -= cost;
        m.tier = nextTier;
        m.invested += cost;
        if (branch) m.branch = branch;
        applyMonsterStats(m);
        Fx.ring(m.x, m.y, 150, '#ffe08a', 0.4);
        Fx.anim('fx_blastGold', m.x, m.y - 66, 480, 0.5);
        Fx.rise(m.x, m.y, '#ffe08a', 26, 34, 0.7);
        Sfx.play('upgrade');
        return true;
    },

    // 판매 환불은 등급별 고정값(SUMMON_RULES.refund)이다. 장비는 보관함으로(자리가 없으면 골드)
    sell(m) {
        if (m.clone) return; // 거울 분신은 팔 수 없다
        this.gold += this.sellValue(m.type);
        this.removeMonster(m);
        this.returnEquip(m);
        Fx.burst(m.x, m.y, '#a9a2c4', 16, 280, 0.4, 6);
        Fx.goldPulse = 1;
        Sfx.play('sell');
    },

    startWave() {
        if (this.state === 'prep' && !this.bossReward) this.mirrorBlocks = 0; // 거울 방패는 라운드마다 다시
        if (this.state === 'prep' && !this.bossReward) this.roundHit = false;
        this.earlyBoost = this.state === 'prep' && this.prepTimer > 0;
        if (this.state === 'prep' && !this.bossReward) this.abyssStep();
        if (this.state !== 'prep' || this.bossReward) return false; // 보스 보상을 고르기 전에는 시작하지 않는다
        const bonus = Math.floor(Math.max(0, this.prepTimer)) * COMBAT_RULES.earlyGoldPerSecond;
        if (bonus > 0 && this.waveIndex > 0) {
            this.gold += bonus;
            Fx.goldPulse = 1;
        }
        const wave = this.currentWave();
        const queue = [];
        for (const [type, count] of [...Object.entries(wave.members), ...Object.entries(wave.elites || {})]) {
            for (let i = 0; i < count; i++) queue.push(type);
        }
        // 직업이 섞여 파티처럼 보이도록 순서를 섞는다
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(rng('spawn') * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        // 섞인 순서의 앞에서부터 입구별 인원(entryCounts)만큼 나눠 준다. 출발 간격은 입구마다 따로 센다
        const counts = this.entryCounts(wave);
        let next = 0;
        let lastStart = 0;
        const gap = Math.min(COMBAT_RULES.spawnGap, COMBAT_RULES.spawnWindow / Math.max(1, ...ROUTE_IDS.map(r => counts[r])));
        for (const route of ROUTE_IDS) {
            const offset = this.entryOffset(route);
            for (let i = 0; i < counts[route]; i++) {
                const delay = offset + i * gap;
                const h = createHero(queue[next++], this.waveLevel(wave), delay, false, route);
                // 계약 조항: 일반 용사 일부가 방패를 들거나 한 번 되살아난다(시드 난수라 모두 같다)
                if (!h.elite && this.mods.heroShield && rng('pact') < this.mods.heroShield) h.shield = 1;
                if (!h.elite && this.mods.heroRevive && rng('pact') < this.mods.heroRevive) h.revive = 1;
                this.heroes.push(h);
                lastStart = Math.max(lastStart, delay + gap);
            }
        }
        if (wave.boss) {
            const route = this.bossEntry(wave.boss);
            const boss = createHero(null, this.waveLevel(wave), lastStart + 1, wave.boss, route);
            this.heroes.push(boss);
            const def = BOSSES[boss.bossKey];
            Fx.banner = { name: def.name, sub: `층 보스 · ${ROUTE_NAMES[route]}쪽 입구`, portrait: def.portrait, age: 0, life: 3.2 };
            Fx.dim = 0.9;
            Sfx.play('bossIntro');
        }
        this.state = 'wave';
        this.roundTimer = (wave.boss ? COMBAT_RULES.bossRoundTime + this.mods.bossTime : COMBAT_RULES.roundTime) * this.mods.roundTime; // 시간 도둑의 모래
        this.roundFull = this.roundTimer; // 다음 라운드 잠금(nextRoundLocked)이 시작 시각으로 쓴다
        this.roundSummons = 0;
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, lordLine('waveStart'), 2);
        Sfx.play('waveStart');
        return true;
    },

    // 판 끝: 판 수, 승리 수와 깬 스테이지를 남긴다(Meta.finishRun, 해금은 처음 깰 때만). 한 판에 한 번만
    finish(victory) {
        if (this.state === 'victory' || this.state === 'defeat') return;
        this.state = victory ? 'victory' : 'defeat';
        if (this.challenge) {
            // 도전은 스토리 저장을 건드리지 않고 최고 기록만 남긴다
            const c = this.challenge;
            const r = { rounds: this.waveIndex, kills: this.stats.kills, time: this.stats.time, victory, score: this.score, tier: this.raidTier, hp: Math.max(0, this.hp) };
            this.challengeResult = r;
            if (!this.replaying) this.challengeBest = c.kind === 'raid' ? Meta.finishRaid(c.week, r, this.record) : (c.kind === 'abyss' ? Meta.finishAbyss(c.seed, c.level, r, this.record) : Meta.finishDaily(c.date, r, this.record));
            if (!this.replaying) Sfx.play(victory ? 'victory' : 'defeat');
            return;
        }
        this.clearRunSave();
        this.runResult = Meta.finishRun(this.stage, victory, victory ? this.waves.length : this.waveIndex);
        Sfx.play(victory ? 'victory' : 'defeat');
    },

    update(dt) {
        this.time += dt;
        if (this.inPlay()) this.tick++;
        Fx.update(dt);
        this.throneFlash = Math.max(0, this.throneFlash - dt);
        this.throneBless = Math.max(0, this.throneBless - dt);
        this.streakPop = Math.max(0, this.streakPop - dt * 4);
        if (this.state !== 'prep' && this.state !== 'wave') return;
        if (this.bossReward) return; // 보상을 고르는 동안 전투도 멈춘다
        this.stats.time += dt;
        if (this.autoMerge && this.tick % AUTO_MERGE_TICKS === 0) this.autoMergeStep();

        for (const key of Object.keys(this.skills)) this.skills[key] = Math.max(0, this.skills[key] - dt);
        this.streakTimer = Math.max(0, this.streakTimer - dt);
        if (this.streakTimer === 0) this.streak = 0;

        if (this.state === 'prep' && !this.bossReward) {
            if (!this.holdPrep) this.prepTimer -= dt; // 튜토리얼이 첫 라운드 전에 붙잡는다(스토리 판만)
            if (this.prepTimer <= 0) this.startWave();
        }

        // 권능 폭풍의 눈: 번개가 준비되면 맨 앞 용사에게 저절로 떨어진다
        if (this.power('auto') && this.state === 'wave' && this.skills.lightning <= 0) {
            const front = this.heroes.filter(h => !h.dead && !h.waiting).sort((a, b) => remainingDistance(a) - remainingDistance(b))[0];
            if (front) {
                const p = heroWorld(front);
                castLightning(p.x, p.y);
            }
        }
        for (const s of this.pendingStrikes) s.t -= dt;
        for (const s of this.pendingStrikes.filter(x => x.t <= 0)) resolveStrike(s);
        this.pendingStrikes = this.pendingStrikes.filter(s => s.t > 0);

        updateAuras(this.monsters); // 지원 몬스터의 오라를 먼저 정한다(같은 프레임의 공격 속도와 피해에 쓴다)
        for (const m of this.monsters) updateMonster(m, dt);
        // 시계탑의 마왕: 타이머와 되감기(늦게 돌아오는 체력)
        this.clockSlowT = Math.max(0, this.clockSlowT - dt);
        this.clockHasteT = Math.max(0, this.clockHasteT - dt);
        this.timeStopT = Math.max(0, this.timeStopT - dt);
        this.wardT = Math.max(0, this.wardT - dt);
        this.accelT = Math.max(0, this.accelT - dt);
        for (const t of this.towers) t.age += dt;
        this.towers = this.towers.filter(t => t.age < t.life);
        if (this.rewinds.length) {
            for (let i = 0; i < this.rewinds.length; i++) this.rewinds[i] -= dt;
            while (this.rewinds.length && this.rewinds[0] <= 0) {
                this.rewinds.shift();
                if (this.hp > 0) this.hp = Math.min(this.maxHp(), this.hp + 1);
            }
        }
        // 거울 분신: 시간이 다 되면 깨져 사라진다
        for (const m of this.monsters.slice()) {
            if (!m.clone) continue;
            m.clone -= dt;
            if (m.clone <= 0) {
                Fx.burst(m.x, m.y - 40, '#bff6ff', 16, 280, 0.4, 5);
                this.removeMonster(m);
            }
        }
        for (const u of this.units) updateUnit(u, dt);
        for (const h of this.heroes) if (!h.dead) updateHero(h, dt);
        for (const p of this.projectiles) updateProjectile(p, dt);
        for (const z of this.hazards) updateHazard(z, dt);
        for (const t of this.telegraphs) t.age += dt;
        for (const c of this.corpses) c.age += dt;

        this.projectiles = this.projectiles.filter(p => !p.done);
        this.telegraphs = this.telegraphs.filter(t => t.age < t.life);
        this.hazards = this.hazards.filter(z => z.age < z.life);
        this.corpses = this.corpses.filter(c => c.age < c.life);
        this.units = this.units.filter(u => !u.removed);
        this.heroes = this.heroes.filter(h => !h.dead);

        if (this.state === 'wave') {
            this.roundTimer = Math.max(0, this.roundTimer - dt);
            if (this.heroes.length === 0) this.endWave();
            else if (this.roundTimer === 0 && this.waveIndex + 1 < this.waves.length) this.nextRound();
        }
    },

    // 중간 저장: 라운드가 끝나 준비 단계에 들어갈 때 판을 저장한다. 저장소가 없어도 게임은 돈다.
    // 뒤에 입력 기록으로 바꿀 수 있게 저장과 복원을 이 세 함수에 모은다
    saveRun() {
        if (this.challenge) return; // 도전은 한 번에 끝낸다(시도는 무제한이다)
        const data = { v: 1, lord: this.lord, relics: this.relics, stage: this.stage, gold: this.gold, hp: this.hp, waveIndex: this.waveIndex,
            prepTimer: this.prepTimer, summonCount: this.summonCount, summonLevel: this.summonLevel, familyLevels: this.familyLevels, equipBag: this.equipBag, bossReward: this.bossReward,
            skills: this.skills, stats: this.stats, mana: this.mana, powers: this.powers, powerSeed: this.powerSeed, arrivals: this.arrivals,
            awaken: this.awaken, fieldBought: this.fieldBought, manaBought: this.manaBought,
            monsters: this.monsters.filter(m => !m.removed && !m.clone).map(m => ({ type: m.type, col: m.col, row: m.row, rank: m.rank || 0, kills: m.kills || 0, equip: m.equip || null, equip2: m.equip2 || null })) };
        try { localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 저장을 못 해도 판은 계속된다 */ }
    },

    clearRunSave() {
        try { localStorage.removeItem(RUN_SAVE_KEY); } catch (e) { /* 저장소 없음 */ }
    },

    readRunSave() {
        try {
            const d = JSON.parse(localStorage.getItem(RUN_SAVE_KEY) || 'null');
            return d && d.v === 1 && Array.isArray(d.monsters) && typeof d.waveIndex === 'number' ? d : null;
        } catch (e) { return null; }
    },

    // 저장한 판으로 돌아간다. 값이 이상하면 false(저장을 지운다)
    loadRun(d) {
        try {
            this.reset(d.lord ? { lord: d.lord, relics: d.relics || [] } : undefined, d.stage);
            if (d.waveIndex < 0 || d.waveIndex >= this.waves.length) throw new Error('wave');
            this.gold = +d.gold || 0;
            this.hp = clamp(+d.hp || 1, 1, this.maxHp());
            this.waveIndex = d.waveIndex;
            this.prepTimer = +d.prepTimer || COMBAT_RULES.prepTime;
            this.summonCount = d.summonCount || 0;
            this.summonLevel = clamp(d.summonLevel || 0, 0, SUMMON_LEVELS.length - 1);
            this.familyLevels = {};
            for (const f of Object.keys(MONSTER_FAMILIES)) if (d.familyLevels && Number.isInteger(d.familyLevels[f]) && d.familyLevels[f] > 0) this.familyLevels[f] = d.familyLevels[f];
            this.equipBag = (d.equipBag || []).filter(id => EQUIPMENT[id]);
            this.bossReward = d.bossReward || null;
            if (d.skills) for (const k of Object.keys(this.skills)) if (+d.skills[k] > 0) this.skills[k] = +d.skills[k];
            this.mana = d.mana || 0;
            this.powers = d.powers || {};
            this.awaken = Math.max(0, d.awaken | 0);
            this.fieldBought = clamp(d.fieldBought | 0, 0, GOLD_SHOP.field.max);
            this.manaBought = Math.max(0, d.manaBought | 0);
            this.applyPowerMods();
            if (d.powerSeed) this.powerSeed = d.powerSeed;
            this.arrivals = d.arrivals || 0;
            if (d.stats) this.stats = d.stats;
            for (const o of d.monsters) {
                if (!MONSTERS[o.type] || !this.canPlace(o.type, o.col, o.row)) continue;
                const m = createMonster(o.type, o.col, o.row);
                setMonsterRank(m, clamp(o.rank || 0, 0, MONSTER_RANKS.length - 1));
                m.kills = o.kills || 0;
                if (o.equip && EQUIPMENT[o.equip]) setMonsterEquip(m, o.equip);
                if (o.equip2 && EQUIPMENT[o.equip2]) setMonsterEquip2(m, o.equip2);
                this.monsters.push(m);
            }
            return true;
        } catch (e) {
            this.clearRunSave();
            return false;
        }
    },

    // 라운드 시간이 다 됐거나 플레이어가 불렀다: 남은 용사를 그대로 두고 다음 라운드를 시작한다.
    // 일찍 부르면 남은 시간만큼 골드를 받는다. 마지막 라운드는 다 잡아야 끝난다
    // 라운드가 막 시작했다: 다음 라운드를 부르지 못한다
    // 이번 라운드가 시작되고 지난 판 시간(초). 라운드 중이 아니면 0
    roundAge() { return this.state === 'wave' && this.roundFull > 0 ? this.roundFull - this.roundTimer : 0; },

    nextRoundLocked() {
        return this.state === 'wave' && this.roundFull > 0 && this.roundFull - this.roundTimer < COMBAT_RULES.nextRoundLock; // 이어하기로 불러온 판은 roundFull이 없어 잠기지 않는다
    },

    nextRound() {
        if (this.state !== 'wave' || this.waveIndex + 1 >= this.waves.length) return false;
        if (this.nextRoundLocked()) return false;
        const n = this.waveIndex + 1;
        const early = this.roundTimer * COMBAT_RULES.earlyGoldPerSecond * (this.power('rewindGold') ? 1.5 : 1); // 권능 이른 종
        const reward = COMBAT_RULES.waveBaseReward + COMBAT_RULES.waveStepReward * n + Math.floor(early);
        const calledEarly = this.roundTimer > 0;
        if (calledEarly && this.mods.earlyGold) this.gold += this.mods.earlyGold; // 깨진 모래시계
        this.addScore(SCORE_RULES.earlySecond * Math.floor(this.roundTimer));
        const bossDown = this.bossDefeated;
        this.bossDefeated = false;
        this.gold += reward;
        this.payInterest();
        Fx.goldPulse = 1;
        this.waveIndex = n;
        this.extendRounds();
        if (bossDown || n % BOSS_REWARD_RULES.roundEvery === 0) this.bossReward = this.rollBossReward();
        this.saveRun();
        this.state = 'prep'; // startWave는 준비 단계에서 시작한다
        this.prepTimer = 1;  // 카드를 고르는 중이면 고른 뒤 1초 뒤에 시작한다
        this.startWave();
        this.earlyBoost = calledEarly; // 유물 깨진 모래시계
        return true;
    },

    endWave() {
        const n = this.waveIndex + 1;
        const reward = COMBAT_RULES.waveBaseReward + COMBAT_RULES.waveStepReward * n + Math.floor(this.roundTimer * COMBAT_RULES.earlyGoldPerSecond);
        const bossDown = this.bossDefeated;
        this.bossDefeated = false;
        // 왕좌가 맞지 않고 다 잡은 라운드는 마력을 준다
        if (!this.roundHit) this.addMana(POWER_RULES.manaCleanRound + (this.power('circuit') || this.power('rewindMana') ? 1 : 0));
        if (this.power('rewindHeal')) this.hp = Math.min(this.maxHp(), this.hp + 1); // 권능 수리공
        if (this.power('goldMana') && this.gold >= 500) this.addMana(1);
        // 다 잡고 끝낸 라운드: 완료 점수와 남은 시간 점수
        const scored = this.addScore(SCORE_RULES.clear + SCORE_RULES.earlySecond * Math.floor(this.roundTimer));
        this.extendRounds();
        if (n >= this.waves.length) {
            this.finish(true); // 마지막 보스는 보상 없이 승리
            return;
        }
        this.gold += reward;
        this.payInterest();
        Fx.goldPulse = 1;
        Fx.banner = { name: `라운드 ${n} 완료`, sub: scored ? `+${reward} 골드 · +${scored.toLocaleString()}점` : `+${reward} 골드`, age: 0, life: 1.6, small: true };
        Sfx.play('waveClear');
        this.waveIndex = n;
        this.prepTimer = COMBAT_RULES.prepTime;
        this.state = 'prep';
        // 보스를 처치한 라운드: 준비 단계에 들어가며 보상 3택을 띄운다(전투 중에는 띄우지 않는다)
        if (bossDown || n % BOSS_REWARD_RULES.roundEvery === 0) this.bossReward = this.rollBossReward();
        this.saveRun();
    }
};
