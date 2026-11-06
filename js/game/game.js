// 게임 진행 상태와 프레임 순서. 화면 코드 없이도 돌아가서 tools/simulate.js로 밸런스를 시험할 수 있다.
const Game = {
    state: 'title', // title | prep | wave | victory | defeat
    gold: 0, hp: 0, waveIndex: 0, prepTimer: 0, speed: 1, paused: false,
    summonCount: 0, // 이번 판 소환 횟수. 소환 비용이 여기에 따라 오른다
    discovered: new Set(), // 찾은 히든 조합식(재료 열쇠). 이번 시험판은 저장하지 않고 창을 닫으면 사라진다
    monsters: [], heroes: [], units: [], corpses: [], projectiles: [], telegraphs: [], pendingStrikes: [],
    skills: { lightning: 0, roar: 0 },
    streak: 0, streakTimer: 0, streakPop: 0, throneFlash: 0,
    stats: { kills: 0, corrupted: 0, placed: 0, summoned: 0, merged: 0, time: 0 },
    time: 0,

    reset() {
        this.gold = COMBAT_RULES.startGold;
        this.hp = COMBAT_RULES.maxHp;
        this.waveIndex = 0;
        this.prepTimer = COMBAT_RULES.firstPrepTime;
        this.paused = false;
        this.summonCount = 0;
        this.monsters = [];
        this.heroes = [];
        this.units = [];
        this.corpses = [];
        this.projectiles = [];
        this.telegraphs = [];
        this.pendingStrikes = [];
        this.skills = { lightning: 0, roar: 0 };
        this.streak = 0;
        this.streakTimer = 0;
        this.throneFlash = 0;
        this.stats = { kills: 0, corrupted: 0, placed: 0, summoned: 0, merged: 0, time: 0 };
        Fx.reset();
        this.state = 'prep';
    },

    currentWave() { return WAVES[Math.min(this.waveIndex, WAVES.length - 1)]; },

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
        Fx.ring(m.x, m.y + MONSTER_FOOT, 76, '#c79bff', 0.35);
        Fx.anim('fx_blastCyan', m.x, m.y - 20, 260, 0.45);
        Fx.burst(m.x, m.y, '#c79bff', 18, 300, 0.4, 6);
        Sfx.play('build');
        return m;
    },

    inPlay() { return this.state === 'prep' || this.state === 'wave'; },

    // 지금 소환 비용: 처음 cost, 소환할 때마다 costStep씩 올라 maxCost에서 멈춘다
    summonCost() {
        const r = SUMMON_RULES;
        return Math.min(r.maxCost, r.cost + r.costStep * this.summonCount);
    },

    // 맵에 더 둘 자리가 있는지(상한)
    fieldFull() { return this.monsters.length >= SUMMON_RULES.maxField; },

    // 등급을 SUMMON_RULES.odds로 고른 뒤 그 등급 몬스터 중 하나를 고른다. Math.random을 두 번 쓴다
    rollSummon() {
        const grades = GRADE_ORDER.filter(g => SUMMON_RULES.odds[g] > 0 && gradePool(g).length);
        let r = Math.random();
        let grade = grades[0];
        for (const g of grades) {
            if (r < SUMMON_RULES.odds[g]) { grade = g; break; }
            r -= SUMMON_RULES.odds[g];
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
            const p = pathAt(nearestPathDistance(x, y));
            const gap = distance(x, y, p.x, p.y);
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
        if (!this.inPlay()) return { ok: false, reason: 'state' };
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
        const grade = MONSTERS[type].grade;
        Fx.pop({ kind: 'summon', to: { x: m.x, y: m.y }, type, grade });
        Sfx.play('summon', GRADE_ORDER.indexOf(grade));
        return { ok: true, type, monster: m, cost };
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
            m.rally = { d: r.d, x: r.x, y: r.y - MONSTER_FOOT + 10 };
        }
        Fx.ring(m.x, m.y + MONSTER_FOOT, 70, '#c79bff', 0.3);
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
        let discovered = false;
        if (hidden) {
            const key = [plan.recipe.a, plan.recipe.b].sort().join('+');
            discovered = !this.discovered.has(key);
            this.discovered.add(key);
        }
        const from = [this.fxPoint(src), this.fxPoint(dst)];
        this.removeMonster(src.monster);
        const old = dst.monster;
        const monster = createMonster(type, old.col, old.row);
        // 랭크는 재료 중 낮은 쪽을 이어받는다(합치기로 랭크가 오르지는 않는다)
        setMonsterRank(monster, Math.min(src.monster.rank || 0, old.rank || 0));
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
        return { ok: true, type, kind: plan.kind, hidden, discovered, monster };
    },

    sellValue(type) { return SUMMON_RULES.refund[MONSTERS[type].grade] || 0; },

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
        Fx.ring(m.x, m.y, 110, '#ffe08a', 0.4);
        Fx.anim('fx_blastGold', m.x, m.y - 30, 320, 0.5);
        Fx.rise(m.x, m.y, '#ffe08a', 26, 34, 0.7);
        Sfx.play('upgrade');
        return true;
    },

    // 판매 환불은 등급별 고정값(SUMMON_RULES.refund)이다
    sell(m) {
        this.gold += this.sellValue(m.type);
        this.removeMonster(m);
        Fx.burst(m.x, m.y, '#a9a2c4', 16, 280, 0.4, 6);
        Fx.goldPulse = 1;
        Sfx.play('sell');
    },

    startWave() {
        if (this.state !== 'prep') return false;
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
        queue.forEach((type, i) => this.heroes.push(createHero(type, this.waveIndex, i * COMBAT_RULES.spawnGap, false)));
        if (wave.boss) {
            const boss = createHero(null, this.waveIndex, queue.length * COMBAT_RULES.spawnGap + 1, wave.boss);
            this.heroes.push(boss);
            const def = BOSSES[boss.bossKey];
            Fx.banner = { name: def.name, sub: '층 보스', portrait: def.portrait, age: 0, life: 3.2 };
            Fx.dim = 0.9;
            Sfx.play('bossIntro');
        }
        this.state = 'wave';
        Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - 190, randItem(SPEECH.waveStart), 2);
        Sfx.play('waveStart');
        return true;
    },

    finish(victory) {
        if (this.state === 'victory' || this.state === 'defeat') return;
        this.state = victory ? 'victory' : 'defeat';
        Sfx.play(victory ? 'victory' : 'defeat');
    },

    update(dt) {
        this.time += dt;
        Fx.update(dt);
        this.throneFlash = Math.max(0, this.throneFlash - dt);
        this.streakPop = Math.max(0, this.streakPop - dt * 4);
        if (this.state !== 'prep' && this.state !== 'wave') return;
        this.stats.time += dt;

        for (const key of ['lightning', 'roar']) this.skills[key] = Math.max(0, this.skills[key] - dt);
        this.streakTimer = Math.max(0, this.streakTimer - dt);
        if (this.streakTimer === 0) this.streak = 0;

        if (this.state === 'prep') {
            this.prepTimer -= dt;
            if (this.prepTimer <= 0) this.startWave();
        }

        for (const s of this.pendingStrikes) s.t -= dt;
        for (const s of this.pendingStrikes.filter(x => x.t <= 0)) resolveStrike(s);
        this.pendingStrikes = this.pendingStrikes.filter(s => s.t > 0);

        for (const m of this.monsters) updateMonster(m, dt);
        for (const u of this.units) updateUnit(u, dt);
        for (const h of this.heroes) if (!h.dead) updateHero(h, dt);
        for (const p of this.projectiles) updateProjectile(p, dt);
        for (const t of this.telegraphs) t.age += dt;
        for (const c of this.corpses) c.age += dt;

        this.projectiles = this.projectiles.filter(p => !p.done);
        this.telegraphs = this.telegraphs.filter(t => t.age < t.life);
        this.corpses = this.corpses.filter(c => c.age < c.life);
        this.units = this.units.filter(u => !u.removed);
        this.heroes = this.heroes.filter(h => !h.dead);

        if (this.state === 'wave' && this.heroes.length === 0) this.endWave();
    },

    endWave() {
        const n = this.waveIndex + 1;
        const reward = COMBAT_RULES.waveBaseReward + COMBAT_RULES.waveStepReward * n;
        if (n >= WAVES.length) {
            this.finish(true);
            return;
        }
        this.gold += reward;
        Fx.goldPulse = 1;
        Fx.banner = { name: `웨이브 ${n} 완료`, sub: `+${reward} 골드`, age: 0, life: 1.6, small: true };
        Sfx.play('waveClear');
        this.waveIndex = n;
        this.prepTimer = COMBAT_RULES.prepTime;
        this.state = 'prep';
    }
};
