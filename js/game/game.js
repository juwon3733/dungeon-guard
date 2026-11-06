// 게임 진행 상태와 프레임 순서. 화면 코드 없이도 돌아가서 tools/simulate.js로 밸런스를 시험할 수 있다.
const Game = {
    state: 'title', // title | prep | wave | victory | defeat
    gold: 0, hp: 0, waveIndex: 0, prepTimer: 0, speed: 1, paused: false,
    facilities: [], heroes: [], units: [], corpses: [], projectiles: [], telegraphs: [], pendingStrikes: [],
    skills: { lightning: 0, roar: 0 },
    streak: 0, streakTimer: 0, streakPop: 0, throneFlash: 0,
    stats: { kills: 0, corrupted: 0, built: 0, time: 0 },
    time: 0,

    reset() {
        this.gold = COMBAT_RULES.startGold;
        this.hp = COMBAT_RULES.maxHp;
        this.waveIndex = 0;
        this.prepTimer = COMBAT_RULES.firstPrepTime;
        this.paused = false;
        this.facilities = [];
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
        this.stats = { kills: 0, corrupted: 0, built: 0, time: 0 };
        Fx.reset();
        this.state = 'prep';
    },

    currentWave() { return WAVES[Math.min(this.waveIndex, WAVES.length - 1)]; },

    facilityAt(col, row) { return this.facilities.find(f => f.col === col && f.row === row) || null; },

    build(type, col, row) {
        const def = FACILITIES[type];
        if (!isBuildCell(col, row) || this.facilityAt(col, row)) return false;
        if (this.gold < def.cost) return false;
        this.gold -= def.cost;
        const f = createFacility(type, col, row);
        this.facilities.push(f);
        this.stats.built++;
        Fx.ring(f.x, f.y, 76, '#c79bff', 0.35);
        Fx.anim('fx_blastCyan', f.x, f.y - 20, 260, 0.45);
        Fx.burst(f.x, f.y, '#c79bff', 18, 300, 0.4, 6);
        Sfx.play('build');
        return f;
    },

    upgrade(f, branch) {
        const nextTier = f.tier + 1;
        if (nextTier > 3) return false;
        if (nextTier === 3 && !branch) return false;
        const cost = upgradeCost(f.type, nextTier);
        if (this.gold < cost) return false;
        this.gold -= cost;
        f.tier = nextTier;
        f.invested += cost;
        if (branch) f.branch = branch;
        if (f.type === 'barracks') {
            const stats = facilityStats(f);
            for (const u of this.units) {
                if (u.owner !== f) continue;
                const ratio = u.hp / u.maxHp;
                u.maxHp = stats.unitHp;
                u.hp = stats.unitHp * ratio;
                u.damage = stats.damage;
                u.interval = stats.interval;
                u.armor = stats.armor;
            }
        }
        Fx.ring(f.x, f.y, 110, '#ffe08a', 0.4);
        Fx.anim('fx_blastGold', f.x, f.y - 30, 320, 0.5);
        Fx.rise(f.x, f.y, '#ffe08a', 26, 34, 0.7);
        Sfx.play('upgrade');
        return true;
    },

    sell(f) {
        this.gold += Math.floor(f.invested * COMBAT_RULES.sellRefund);
        this.facilities = this.facilities.filter(x => x !== f);
        for (const u of this.units) if (u.owner === f) { u.removed = true; }
        for (const h of this.heroes) if (h.blocker && h.blocker.owner === f) h.blocker = null;
        Fx.burst(f.x, f.y, '#a9a2c4', 16, 280, 0.4, 6);
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

        for (const f of this.facilities) updateFacility(f, dt);
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
