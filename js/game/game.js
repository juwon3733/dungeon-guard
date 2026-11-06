// 게임 진행 상태와 프레임 순서. 화면 코드 없이도 돌아가서 tools/simulate.js로 밸런스를 시험할 수 있다.
// 마왕 대사 한 줄: 공통 대사(SPEECH)에 이번 판 마왕의 대사를 더해 고른다(Math.random 한 번)
function lordLine(kind) {
    const own = Game.lordDef().speech || {};
    return randItem([...(SPEECH[kind] || []), ...(own[kind] || [])]);
}

const Game = {
    state: 'title', // title | hq(본부) | story(스토리 지도) | select | prep | wave | victory | defeat
    gold: 0, hp: 0, waveIndex: 0, prepTimer: 0, speed: 1, paused: false,
    summonCount: 0, // 이번 판 소환 횟수. 소환 비용이 여기에 따라 오른다
    runResult: null, // 판이 끝날 때의 기록(Meta.finishRun): 처음 깼는지, 풀린 것. 결과 화면과 해금 카드가 보여 준다
    stage: null, // 이번 판 스테이지 id(STAGES). null이면 스토리 없이 WAVES 전부(tools/simulate.js와 시험 도구)
    waves: WAVES, // 이번 판 웨이브 목록(stageWaves). 스테이지가 없으면 WAVES
    heroHpMul: 1, // 이번 판 용사 체력 배율(스테이지의 hpMul)
    bossDefeated: false, // 이번 웨이브에 보스를 처치했는지. 웨이브가 끝날 때 보상 카드로 바뀐다
    bossReward: null, // 고를 보스 보상: { cards: [{ kind: 'monster', type } | { kind: 'equip', id } | { kind: 'gold', gold }] }. 있는 동안 준비 시간이 멈춘다
    equipBag: [], // 보관함의 장비 id(최대 EQUIP_RULES.slots). 다시 시작하면 비우고 저장하지 않는다
    monsters: [], heroes: [], units: [], corpses: [], projectiles: [], telegraphs: [], pendingStrikes: [],
    hazards: [], // 땅에 남는 장판(불 장판 burnGround): { kind, x, y, radius(px), dps, life, age, tick, owner }
    skills: { lightning: 0, roar: 0 },
    streak: 0, streakTimer: 0, streakPop: 0, throneFlash: 0, throneBless: 0, // throneBless: 제물을 받은 마왕이 빛나는 남은 시간
    stats: { kills: 0, corrupted: 0, placed: 0, summoned: 0, merged: 0, sacrificed: 0, time: 0 },
    time: 0,
    lord: null, // 이번 판 마왕 id(DEMON_LORDS). null이면 효과 없이 기본 마왕 그림을 쓴다(시험 도구)
    relics: [], // 이번 판 유물 id(RELICS). 판 중에는 바뀌지 않는다
    mods: emptyMods(), // 마왕과 유물의 효과를 합친 값(LORD_EFFECTS). 각 계산 지점이 읽는다

    // loadout: 선택 화면의 { lord, relics }. 없으면 효과 없이 시작한다(tools/simulate.js와 시험 도구)
    // stageId: 스토리 스테이지(STAGES의 id). 없으면 WAVES 전부를 체력 배율 1, 골드 보너스 없이 돈다
    reset(loadout, stageId) {
        if (loadout) {
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
        this.waves = stage ? stageWaves(stage) : WAVES;
        this.heroHpMul = stage ? stage.hpMul : 1;
        this.gold = COMBAT_RULES.startGold + this.mods.startGold + (stage ? stage.goldBonus || 0 : 0);
        this.hp = this.maxHp();
        this.waveIndex = 0;
        this.prepTimer = COMBAT_RULES.firstPrepTime;
        this.paused = false;
        this.summonCount = 0;
        this.bossDefeated = false;
        this.bossReward = null;
        this.equipBag = [];
        this.runResult = null;
        this.clearField();
        this.skills = { lightning: 0, roar: 0 };
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
    maxHp() { return Math.max(1, COMBAT_RULES.maxHp + this.mods.maxHp); },

    // 마왕 스킬('lightning' | 'roar') 재사용 대기(초)
    skillCooldown(key) { return COMBAT_RULES[key].cooldown * this.mods.skillCooldown; },

    lightningDamage() { return COMBAT_RULES.lightning.damage * this.mods.lightningDamage; },

    // 맵에 둘 수 있는 몬스터 수
    maxField() { return SUMMON_RULES.maxField + this.mods.fieldMax; },

    // 등급별 소환 확률: 희귀 확률(rareChance)을 일반에서 옮긴다
    summonOdds() {
        const odds = { ...SUMMON_RULES.odds };
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

    // 웨이브의 용사 체력 단계: 스테이지 웨이브는 원래 WAVES 인덱스(level), 아니면 지금 웨이브 번호
    waveLevel(wave) { return wave.level !== undefined ? wave.level : this.waveIndex; },

    // 웨이브의 일반과 정예 인원을 입구 비율(wave.entry)대로 나눈 수: { north, south }. 보스는 세지 않는다.
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
    monsterAt(col, row) { return this.monsters.find(m => m.col === col && m.row === row) || null; },

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
    canPlace(type, col, row) {
        if (!MONSTERS[type] || this.monsterAt(col, row)) return false;
        return isBuildCell(col, row);
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

    // 지금 소환 비용: 처음 cost(마왕과 유물의 summonBase를 더한다), 소환할 때마다 costStep씩 올라 maxCost에서 멈춘다
    summonCost() {
        const r = SUMMON_RULES;
        return Math.max(0, Math.min(r.maxCost, r.cost + this.mods.summonBase + r.costStep * this.summonCount));
    },

    // 맵에 더 둘 자리가 있는지(상한)
    fieldFull() { return this.monsters.length >= this.maxField(); },

    // 등급을 summonOdds로 고른 뒤 그 등급 몬스터 중 하나를 고른다. Math.random을 두 번 쓴다
    rollSummon() {
        const odds = this.summonOdds();
        const grades = GRADE_ORDER.filter(g => odds[g] > 0 && gradePool(g).length);
        let r = Math.random();
        let grade = grades[0];
        for (const g of grades) {
            if (r < odds[g]) { grade = g; break; }
            r -= odds[g];
        }
        return randItem(gradePool(grade));
    },

    // 소환한 몬스터를 세울 칸. 없으면 null
    //   원거리: 칸에서 길까지 거리가 사거리 안인 칸만
    //   막는 몬스터: 길 지점(rally)이 이미 있는 막는 몬스터의 길 지점과 blockerSpacing칸 안으로 겹치지 않는 칸을 먼저. 없으면 아무 빈 칸
    //   그중 길에 가장 가까운 칸들에서 무작위로 하나(Math.random 한 번)
    pickSummonCell(type) {
        const blocks = monsterBlocks(type);
        const range = MONSTERS[type].stats.range * TILE;
        let cells = [];
        for (const key of BUILD_CELLS) {
            const [col, row] = key.split(',').map(Number);
            if (this.monsterAt(col, row)) continue;
            const x = tileX(col);
            const y = tileY(row);
            const gap = nearestPathPoint(x, y).gap; // 두 갈래 중 가까운 쪽 길까지
            if (!blocks && gap > range + 0.5) continue;
            cells.push({ col, row, gap });
        }
        if (blocks) {
            const spacing = SUMMON_RULES.blockerSpacing * TILE + 0.5;
            const rallies = this.monsters.filter(m => m.blocks).map(m => rallyPoint(m.col, m.row));
            const apart = cells.filter(c => {
                const r = rallyPoint(c.col, c.row);
                return rallies.every(o => distance(r.x, r.y, o.x, o.y) > spacing);
            });
            if (apart.length) cells = apart;
        }
        if (!cells.length) return null;
        const best = Math.min(...cells.map(c => c.gap));
        const pick = randItem(cells.filter(c => c.gap <= best + 0.5));
        return { col: pick.col, row: pick.row };
    },

    // 골드를 내고 무작위 몬스터 1마리를 맵의 빈 길 옆 칸에 바로 세운다. 실패하면 골드를 쓰지 않고
    // reason: 'full'(상한이나 빈 칸 없음) | 'gold' | 'state'
    summon() {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (this.fieldFull()) return { ok: false, reason: 'full' };
        const cost = this.summonCost();
        if (this.gold < cost) return { ok: false, reason: 'gold' };
        const type = this.rollSummon();
        const cell = this.pickSummonCell(type);
        if (!cell) return { ok: false, reason: 'full' };
        this.gold -= cost;
        this.summonCount++;
        const m = createMonster(type, cell.col, cell.row);
        this.monsters.push(m);
        this.stats.summoned++;
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
            const first = Math.random() < R.epicChance ? 'epic' : 'rare';
            const second = first === 'epic' ? 'rare' : 'epic';
            const left = g => gradePool(g).filter(t => !used.includes(t));
            const pool = left(first).length ? left(first) : left(second);
            if (!pool.length) break;
            const type = randItem(pool);
            used.push(type);
            cards.push({ kind: 'monster', type });
        }
        const equipGrade = Math.random() < EQUIP_RULES.rewardEpicChance ? 'epic' : 'rare';
        cards.push({ kind: 'equip', id: randItem(equipPool(equipGrade)) });
        cards.push({ kind: 'gold', gold: R.gold });
        return { cards };
    },

    // 보상 몬스터를 맵에 세울 수 있는지(상한과 빈 칸)
    canTakeRewardMonster(type) {
        return !this.fieldFull() && !!this.pickSummonCell(type);
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

    // 보관함 index번 장비를 맵의 몬스터에게 끼운다(웨이브 중에도). 이미 끼고 있으면 맞바꿔 원래 장비가 그 칸으로 돌아간다.
    // 체력은 비율을 유지한다. 실패하면 { ok: false, reason: 'state' | 'empty' | 'index' }
    equipMonster(m, index) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || m.removed || !this.monsters.includes(m)) return { ok: false, reason: 'empty' };
        const id = this.equipBag[index];
        if (!id) return { ok: false, reason: 'index' };
        const old = m.equip;
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

    // 낀 장비를 빼 보관함으로 돌려보낸다. 보관함이 가득 차면 빼지 않는다({ ok: false, reason: 'full' })
    unequipMonster(m) {
        if (!this.inPlay() || this.bossReward) return { ok: false, reason: 'state' };
        if (!m || !m.equip) return { ok: false, reason: 'none' };
        if (this.bagFull()) return { ok: false, reason: 'full' };
        const id = m.equip;
        this.equipBag.push(id);
        setMonsterEquip(m, null);
        Sfx.play('click');
        return { ok: true, id };
    },

    // 맵에서 사라지는 몬스터(제물, 판매)의 장비를 보관함으로 돌려보낸다(자리가 없으면 골드)
    returnEquip(m) {
        if (!m.equip) return null;
        const id = m.equip;
        m.equip = null;
        return this.gainEquip(id, m.x, m.y - 40);
    },

    // 합칠 때 장비: 등급이 높은 쪽 1개가 결과로 이어지고(같으면 끌어온 src 쪽), 나머지는 돌아간다
    mergeEquip(src, dst) {
        const keep = betterEquip(src.equip, dst.equip);
        const back = [src.equip, dst.equip].filter(Boolean);
        back.splice(back.indexOf(keep), 1);
        return { keep, back };
    },

    // 정예 용사를 처치하면 EQUIP_RULES.eliteDrop(마왕과 유물의 eliteDrop을 더한다) 확률로 장비(일반 또는 희귀)를 떨어뜨린다.
    // Math.random을 세 번까지 쓴다
    eliteDrop(x, y) {
        const R = EQUIP_RULES;
        if (Math.random() >= R.eliteDrop + this.mods.eliteDrop) return null;
        const grade = Math.random() < R.eliteRareChance ? 'rare' : 'common';
        const id = randItem(equipPool(grade));
        const res = this.gainEquip(id, x, y);
        if (res.kind === 'bag') Fx.notice = `장비 획득: ${EQUIPMENT[id].name}`;
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
        if (!this.canPlace(m.type, col, row)) return false;
        this.releaseMonster(m);
        m.col = col;
        m.row = row;
        m.homeX = m.x = tileX(col);
        m.homeY = m.y = tileY(row);
        m.moving = false;
        m.shot = null;
        if (m.blocks) {
            const r = rallyPoint(col, row);
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

    // 맵의 두 몬스터(개체)를 합칠 때의 판단. mergePlan(랭크 조건 포함)에 맵 수 제한(등급 fieldMax)을 더한다.
    // 조합식 결과가 제한을 넘으면 { kind: 'none', reason: 'unique', recipe, result }. 재료 두 마리는 사라지니 세지 않는다
    mergePlanFor(a, b) {
        const plan = mergePlan(a, b);
        if (plan.kind !== 'recipe') return plan;
        const grade = MONSTERS[plan.result].grade;
        const max = MONSTER_GRADES[grade].fieldMax;
        if (max === undefined) return plan;
        const count = this.monsters.filter(m => m !== a && m !== b && !m.removed && MONSTERS[m.type].grade === grade).length;
        return count >= max ? { kind: 'none', reason: 'unique', recipe: plan.recipe, result: plan.result } : plan;
    },

    // 끌어온 몬스터(src)를 다른 몬스터(dst) 위에 놓아 합친다. 결과는 dst 자리에 남고 src 자리는 빈다.
    // 실패하면 { ok: false, reason: 'same' | 'empty' | 'top' | 'mismatch' | 'unique' }
    merge(src, dst) {
        const a = this.typeAt(src);
        const b = this.typeAt(dst);
        if (!a || !b) return { ok: false, reason: 'empty' };
        if (this.sameLoc(src, dst)) return { ok: false, reason: 'same' };
        const plan = this.mergePlanFor(src.monster, dst.monster);
        if (plan.kind === 'none') return { ok: false, reason: plan.reason };
        const type = plan.kind === 'recipe' ? plan.result : randItem(gradePool(plan.grade));
        const hidden = !!(plan.recipe && plan.recipe.hidden);
        // 조합식은 영구 기록(도감)에 한 번만 남는다. 히든 발견 연출은 기록에 처음 남을 때만 띄운다
        const found = plan.recipe ? Meta.findRecipe(plan.recipe) : false;
        const discovered = hidden && found;
        Meta.seeMonster(type);
        const from = [this.fxPoint(src), this.fxPoint(dst)];
        this.removeMonster(src.monster);
        const old = dst.monster;
        const monster = createMonster(type, old.col, old.row);
        // 랭크는 재료 중 낮은 쪽을 이어받는다(합치기로 랭크가 오르지는 않는다)
        setMonsterRank(monster, Math.min(src.monster.rank || 0, old.rank || 0));
        // 장비는 등급이 높은 쪽 1개를 이어받고(같으면 끌어온 쪽), 나머지는 보관함으로(자리가 없으면 골드)
        const equip = this.mergeEquip(src.monster, old);
        if (equip.keep) setMonsterEquip(monster, equip.keep);
        src.monster.equip = null;
        old.equip = null;
        const returned = equip.back.map(id => this.gainEquip(id, monster.x, monster.y - 40));
        monster.reveal = MERGE_REVEAL; // 빨려 들어가는 연출이 끝난 뒤 나타난다
        this.monsters[this.monsters.indexOf(old)] = monster;
        old.removed = true;
        this.releaseMonster(old);
        const to = { x: monster.x, y: monster.y };
        this.stats.merged++;
        const grade = MONSTERS[type].grade;
        Fx.pop({ kind: 'merge', from, fromTypes: [a, b], to, type, grade, hidden });
        Sfx.play('merge', GRADE_ORDER.indexOf(grade));
        if (discovered) {
            // 재료 줄에는 조합식의 랭크 조건도 적는다. 전설은 더 오래 보여 준다
            const r = plan.recipe;
            Fx.discovery = { a: r.a, aRank: r.aRank || null, b: r.b, bRank: r.bRank || null, type, grade,
                age: -MERGE_REVEAL, life: grade === 'legendary' ? 4.6 : 3.6 };
            Sfx.play('hidden');
        }
        return { ok: true, type, kind: plan.kind, hidden, discovered, monster, equip: equip.keep, returned };
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
        const gain = this.sacrificeGain(m);
        const heal = Math.min(gain.heal, Math.max(0, this.maxHp() - this.hp));
        this.hp += heal;
        this.skills.lightning = Math.max(0, this.skills.lightning - gain.lightning);
        const grade = MONSTERS[m.type].grade;
        const from = { x: m.x, y: m.y };
        this.removeMonster(m);
        const equip = this.returnEquip(m); // 장비는 보관함으로(자리가 없으면 골드)
        this.stats.sacrificed++;
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
        this.gold += this.sellValue(m.type);
        this.removeMonster(m);
        this.returnEquip(m);
        Fx.burst(m.x, m.y, '#a9a2c4', 16, 280, 0.4, 6);
        Fx.goldPulse = 1;
        Sfx.play('sell');
    },

    startWave() {
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
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        // 섞인 순서의 앞에서부터 입구별 인원(entryCounts)만큼 나눠 준다. 출발 간격은 입구마다 따로 센다
        const counts = this.entryCounts(wave);
        let next = 0;
        let lastStart = 0;
        for (const route of ROUTE_IDS) {
            const offset = this.entryOffset(route);
            for (let i = 0; i < counts[route]; i++) {
                const delay = offset + i * COMBAT_RULES.spawnGap;
                this.heroes.push(createHero(queue[next++], this.waveLevel(wave), delay, false, route));
                lastStart = Math.max(lastStart, delay + COMBAT_RULES.spawnGap);
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
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, lordLine('waveStart'), 2);
        Sfx.play('waveStart');
        return true;
    },

    // 판 끝: 판 수, 승리 수와 깬 스테이지를 남긴다(Meta.finishRun, 해금은 처음 깰 때만). 한 판에 한 번만
    finish(victory) {
        if (this.state === 'victory' || this.state === 'defeat') return;
        this.state = victory ? 'victory' : 'defeat';
        this.runResult = Meta.finishRun(this.stage, victory, victory ? this.waves.length : this.waveIndex);
        Sfx.play(victory ? 'victory' : 'defeat');
    },

    update(dt) {
        this.time += dt;
        Fx.update(dt);
        this.throneFlash = Math.max(0, this.throneFlash - dt);
        this.throneBless = Math.max(0, this.throneBless - dt);
        this.streakPop = Math.max(0, this.streakPop - dt * 4);
        if (this.state !== 'prep' && this.state !== 'wave') return;
        this.stats.time += dt;

        for (const key of ['lightning', 'roar']) this.skills[key] = Math.max(0, this.skills[key] - dt);
        this.streakTimer = Math.max(0, this.streakTimer - dt);
        if (this.streakTimer === 0) this.streak = 0;

        if (this.state === 'prep' && !this.bossReward) {
            this.prepTimer -= dt;
            if (this.prepTimer <= 0) this.startWave();
        }

        for (const s of this.pendingStrikes) s.t -= dt;
        for (const s of this.pendingStrikes.filter(x => x.t <= 0)) resolveStrike(s);
        this.pendingStrikes = this.pendingStrikes.filter(s => s.t > 0);

        updateAuras(this.monsters); // 지원 몬스터의 오라를 먼저 정한다(같은 프레임의 공격 속도와 피해에 쓴다)
        for (const m of this.monsters) updateMonster(m, dt);
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

        if (this.state === 'wave' && this.heroes.length === 0) this.endWave();
    },

    endWave() {
        const n = this.waveIndex + 1;
        const reward = COMBAT_RULES.waveBaseReward + COMBAT_RULES.waveStepReward * n;
        const bossDown = this.bossDefeated;
        this.bossDefeated = false;
        if (n >= this.waves.length) {
            this.finish(true); // 마지막 보스는 보상 없이 승리
            return;
        }
        this.gold += reward;
        Fx.goldPulse = 1;
        Fx.banner = { name: `웨이브 ${n} 완료`, sub: `+${reward} 골드`, age: 0, life: 1.6, small: true };
        Sfx.play('waveClear');
        this.waveIndex = n;
        this.prepTimer = COMBAT_RULES.prepTime;
        this.state = 'prep';
        // 보스를 처치한 웨이브: 준비 단계에 들어가며 보상 3택을 띄운다(전투 중에는 띄우지 않는다)
        if (bossDown) this.bossReward = this.rollBossReward();
    }
};
