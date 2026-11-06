// 게임 진행 상태와 프레임 순서. 화면 코드 없이도 돌아가서 tools/simulate.js로 밸런스를 시험할 수 있다.
const Game = {
    state: 'title', // title | prep | wave | victory | defeat
    gold: 0, hp: 0, waveIndex: 0, prepTimer: 0, speed: 1, paused: false,
    monsters: [], heroes: [], units: [], corpses: [], projectiles: [], telegraphs: [], pendingStrikes: [],
    skills: { lightning: 0, roar: 0 },
    streak: 0, streakTimer: 0, streakPop: 0, throneFlash: 0,
    stats: { kills: 0, corrupted: 0, placed: 0, time: 0 },
    time: 0,

    reset() {
        this.gold = COMBAT_RULES.startGold;
        this.hp = COMBAT_RULES.maxHp;
        this.waveIndex = 0;
        this.prepTimer = COMBAT_RULES.firstPrepTime;
        this.paused = false;
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
        this.stats = { kills: 0, corrupted: 0, placed: 0, time: 0 };
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

    place(type, col, row) {
        const def = MONSTERS[type];
        if (!this.canPlace(type, col, row)) return false;
        if (this.gold < def.cost) return false;
        this.gold -= def.cost;
        const m = createMonster(type, col, row);
        this.monsters.push(m);
        this.stats.placed++;
        Fx.ring(m.x, m.y + MONSTER_FOOT, 76, '#c79bff', 0.35);
        Fx.anim('fx_blastCyan', m.x, m.y - 20, 260, 0.45);
        Fx.burst(m.x, m.y, '#c79bff', 18, 300, 0.4, 6);
        Sfx.play('build');
        return m;
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
        Fx.ring(m.x, m.y, 110, '#ffe08a', 0.4);
        Fx.anim('fx_blastGold', m.x, m.y - 30, 320, 0.5);
        Fx.rise(m.x, m.y, '#ffe08a', 26, 34, 0.7);
        Sfx.play('upgrade');
        return true;
    },

    sell(m) {
        this.gold += Math.floor(m.invested * COMBAT_RULES.sellRefund);
        this.monsters = this.monsters.filter(x => x !== m);
        m.removed = true;
        for (const h of this.heroes) if (h.blocker === m) h.blocker = null;
        Fx.burst(m.x, m.y, '#a9a2c4', 16, 280, 0.4, 6);
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
            const boss = createHero('warrior', this.waveIndex, queue.length * COMBAT_RULES.spawnGap + 1, true);
            this.heroes.push(boss);
            Fx.banner = { name: FLOOR_BOSS.name, sub: '층 보스', age: 0, life: 3.2 };
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
