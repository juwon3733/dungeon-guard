// 연출용 데이터만 만든다. 그리기는 render 파일이 맡고, 전투 결과에는 영향을 주지 않는다.

// 합치기 연출: 두 몬스터가 MERGE_REVEAL초 동안 빨려 들어간 뒤 빛이 터지고 결과가 나온다
const MERGE_REVEAL = 0.42;
// 등급별 연출 세기. pop은 소환·합치기 뒤 결과가 커졌다 돌아오는 시간, rays는 빛줄기 수, shake는 화면 흔들림
const GRADE_FX = {
    common: { pop: 0.6, rays: 0, sparks: 16, shake: 2, sheet: 'fx_explosion', size: 160 },
    rare: { pop: 0.95, rays: 10, sparks: 34, shake: 7, sheet: 'fx_blastViolet', size: 240 },
    epic: { pop: 1.5, rays: 18, sparks: 60, shake: 14, sheet: 'fx_hit_crit', size: 320 },
    legendary: { pop: 2.2, rays: 30, sparks: 96, shake: 22, sheet: 'fx_hit_crit', size: 420 },
    mythic: { pop: 3.0, rays: 44, sparks: 150, shake: 30, sheet: 'fx_hit_crit', size: 540 },
    transcendent: { pop: 3.4, rays: 56, sparks: 200, shake: 36, sheet: 'fx_hit_crit', size: 620 }
};

const Fx = {
    particles: [], numbers: [], rings: [], beams: [], bolts: [], coins: [], decals: [], speech: [], glows: [], anims: [],
    shake: 0,
    dim: 0,
    reduce: false,
    goldPulse: 0,
    banner: null,
    pops: [], // 소환과 합치기 연출. 다른 몬스터와 HUD 위에도 보이도록 UI가 화면 맨 위에 그린다
    discovery: null, // "히든 조합 발견!" 연출
    hpGlow: 0, // 제물로 체력 막대가 차오를 때 막대와 초상 액자 빛(1에서 0으로)
    drops: [], // 장비를 얻은 자리에서 떠오르는 장비 그림: { id, x, y(세계 좌표), age, life }
    notice: null, // 화면 아래에 띄울 알림 글자(장비 획득, 보관함 가득). UI가 가져가 비운다

    reset() {
        for (const key of ['particles', 'numbers', 'rings', 'beams', 'bolts', 'coins', 'decals', 'speech', 'glows', 'anims']) this[key] = [];
        this.shake = 0;
        this.dim = 0;
        this.goldPulse = 0;
        this.hpGlow = 0;
        this.banner = null;
        this.pops = [];
        this.discovery = null;
        this.drops = [];
        this.notice = null;
        this.pendingBursts = [];
        this.pendingShakes = [];
        this.pendingSacrifices = [];
    },

    // kind: 'summon' | 'merge' | 'sacrifice'(몬스터가 왕좌로 빨려 든다). to와 from의 점은 세계 좌표 { x, y }(몬스터가 서 있는 곳)
    pop(opts) {
        const g = GRADE_FX[opts.grade] || GRADE_FX.common;
        const delay = opts.kind === 'summon' ? 0 : MERGE_REVEAL;
        this.pops.push(Object.assign({ age: 0, delay, life: delay + g.pop + 0.4, seed: Math.random() * 10 }, opts));
        // 결과 자리에는 세계 효과도 함께 남긴다(빛이 터지는 순간에 맞춘다)
        this.pendingBursts.push({ t: delay, x: opts.to.x, y: opts.to.y, grade: opts.grade });
        if (delay > 0) this.pendingShakes.push({ t: delay, amount: g.shake });
        else this.addShake(g.shake * 0.6);
    },
    pendingBursts: [],
    pendingShakes: [],
    pendingSacrifices: [], // 제물이 왕좌에 닿는 순간: 마왕이 빛나고 회복 숫자가 뜨고 체력 막대가 빛난다

    // 효과 시트(FX_SHEETS)를 재생한다. size는 세계 px 기준 크기다
    // 시트에 정한 길이만큼 재생한다. 그림만 바뀌고 전투 계산과는 무관하다
    anim(name, x, y, size, life, angle) {
        if (this.reduce && this.anims.length > 24) return;
        if (this.anims.length > 90) this.anims.shift();
        const sheet = typeof FX_SHEETS !== 'undefined' ? FX_SHEETS[name] : null;
        this.anims.push({ name, x, y, size, age: 0, life: sheet ? sheet.life : life || 0.36, angle: angle || 0 });
    },

    burst(x, y, color, count, speed, life, size) {
        const n = this.reduce ? Math.ceil(count / 3) : count;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = randRange(speed * 0.35, speed);
            this.particles.push({
                x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25,
                life: randRange(life * 0.6, life), max: life, size: size || 6, color, gravity: 500
            });
        }
    },

    rise(x, y, color, count, spread, life) {
        const n = this.reduce ? Math.ceil(count / 3) : count;
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: x + randRange(-spread, spread), y: y + randRange(-10, 10),
                vx: randRange(-12, 12), vy: randRange(-240, -80),
                life: randRange(life * 0.5, life), max: life, size: randItem([4, 6, 8]), color, gravity: 0
            });
        }
    },

    // Why: 궁수탑이 빠르게 때리면 숫자가 겹쳐 읽히지 않아, 같은 대상의 짧은 연타는 한 숫자로 합친다.
    number(target, x, y, amount, color, big) {
        const recent = this.numbers.find(n => n.target === target && n.age < 0.16 && n.color === color);
        if (recent) {
            recent.amount += amount;
            recent.age = 0;
            return;
        }
        // 옆으로 조금 튀었다가 떠오른다(vx). 큰 숫자는 더 오래 남는다
        this.numbers.push({ target, x: x + randRange(-18, 18), y, vx: randRange(-40, 40), amount, color, big: !!big, age: 0, life: big ? 1 : 0.85 });
    },

    ring(x, y, radius, color, life) { this.rings.push({ x, y, radius, color, age: 0, life }); },
    beam(ax, ay, bx, by, color, width, life) { this.beams.push({ ax, ay, bx, by, color, width, age: 0, life }); },
    glow(x, y, radius, color, life) { this.glows.push({ x, y, radius, color, age: 0, life }); },
    // 큰 처치의 멈춤: 판 시간이 잠깐 멎는다. 화면 시간만 멈출 뿐 판 결과와 입력 재생은 그대로다(main.js)
    stop: 0,
    hitStop(sec) { if (!this.reduce) this.stop = Math.max(this.stop, sec); },

    addShake(amount) { if (!this.reduce) this.shake = Math.max(this.shake, amount); },

    // 번개는 위에서 아래로 내려오는 꺾은선. 매번 무작위 모양으로 만든다.
    bolt(x, y, color) {
        const points = [];
        let cx = x + randRange(-30, 30);
        for (let py = y - WORLD_HEIGHT; py < y; py += 60) {
            points.push([cx, py]);
            cx += randRange(-46, 46);
            cx = x + (cx - x) * 0.82;
        }
        points.push([x, y]);
        this.bolts.push({ points, color, age: 0, life: 0.28 });
    },

    coin(x, y, amount, count) {
        const n = count || Math.min(9, Math.max(3, Math.round(amount / 2)));
        for (let i = 0; i < n; i++) {
            // 동전은 HUD로 날아가므로 화면 좌표로 바꿔 둔다
            this.coins.push({ x: x * WORLD_ZOOM, y: y * WORLD_ZOOM, vx: randRange(-170, 170), vy: randRange(-420, -220), age: 0, delay: 0.42 + i * 0.03 });
        }
    },

    say(x, y, text, life, boss) {
        if (this.speech.length >= 3) this.speech.shift();
        this.speech.push({ x, y, text, age: 0, life: life || 2, boss: !!boss });
    },

    update(dt) {
        for (const p of this.particles) {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);
        if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);

        for (const list of [this.numbers, this.rings, this.beams, this.bolts, this.speech, this.glows, this.anims, this.drops]) {
            for (const item of list) item.age += dt;
        }
        for (const n of this.numbers) {
            n.y -= (n.age < 0.15 ? 220 : 52) * dt;
            n.x += (n.vx || 0) * dt;
        }
        this.numbers = this.numbers.filter(n => n.age < n.life);
        this.rings = this.rings.filter(r => r.age < r.life);
        this.beams = this.beams.filter(b => b.age < b.life);
        this.bolts = this.bolts.filter(b => b.age < b.life);
        this.speech = this.speech.filter(s => s.age < s.life);
        this.glows = this.glows.filter(g => g.age < g.life);
        this.anims = this.anims.filter(a => a.age < a.life);
        this.drops = this.drops.filter(d => d.age < d.life);

        for (const c of this.coins) {
            c.age += dt;
            if (c.age < c.delay) {
                c.x += c.vx * dt;
                c.y += c.vy * dt;
                c.vy += 1100 * dt;
            } else {
                // HUD의 골드 표시로 빨려 들어간다
                const pull = clamp((c.age - c.delay) * 3.4, 0, 1);
                c.x += (HUD_GOLD.x - c.x) * pull * 0.34;
                c.y += (HUD_GOLD.y - c.y) * pull * 0.34;
                if (distance(c.x, c.y, HUD_GOLD.x, HUD_GOLD.y) < 26) {
                    c.done = true;
                    this.goldPulse = 1;
                }
            }
        }
        this.coins = this.coins.filter(c => !c.done);

        for (const d of this.decals) d.age += dt;
        this.decals = this.decals.filter(d => d.age < d.life);

        this.shake = Math.max(0, this.shake - dt * 42);
        this.dim = Math.max(0, this.dim - dt * 1.8);
        this.goldPulse = Math.max(0, this.goldPulse - dt * 4);
        this.hpGlow = Math.max(0, this.hpGlow - dt * 0.8);
        for (const p of this.pops) p.age += dt;
        this.pops = this.pops.filter(p => p.age < p.life);
        if (this.discovery) {
            this.discovery.age += dt;
            if (this.discovery.age > this.discovery.life) this.discovery = null;
        }
        for (const b of this.pendingBursts) {
            b.t -= dt;
            if (b.t > 0) continue;
            const g = GRADE_FX[b.grade] || GRADE_FX.common;
            const color = MONSTER_GRADES[b.grade].color;
            this.anim(g.sheet, b.x, b.y - 30, g.size, 0.5);
            if (g.rays) this.anim('fx_blastGold', b.x, b.y - 40, g.size * 0.8, 0.5);
            this.ring(b.x, b.y + MONSTER_FOOT, 80 + g.rays * 10, color, 0.55);
            this.ring(b.x, b.y + MONSTER_FOOT, 40 + g.rays * 6, '#ffffff', 0.4);
            this.burst(b.x, b.y - 30, color, g.sparks, 420 + g.rays * 24, 0.7, 8);
            this.burst(b.x, b.y - 30, '#ffffff', Math.round(g.sparks / 2), 300 + g.rays * 16, 0.5, 6);
            this.rise(b.x, b.y + MONSTER_FOOT, '#ffffff', 10 + g.rays * 2, 50, 0.9);
            this.glow(b.x, b.y - 40, 160 + g.rays * 10, `rgba(${MONSTER_GRADES[b.grade].glow},1)`, 0.45);
        }
        this.pendingBursts = this.pendingBursts.filter(b => b.t > 0);
        for (const s of this.pendingShakes) {
            s.t -= dt;
            if (s.t <= 0) this.addShake(s.amount);
        }
        this.pendingShakes = this.pendingShakes.filter(s => s.t > 0);
        for (const s of this.pendingSacrifices) {
            s.t -= dt;
            if (s.t > 0) continue;
            this.glow(s.x, s.y - 60, 260, 'rgba(255,215,120,1)', 0.8);
            this.anim('fx_blastGold', s.x, s.y - 90, 510, 0.55);
            this.rise(s.x, s.y + 20, '#ffe08a', 30, 70, 1);
            this.rise(s.x, s.y + 20, '#ff7a9a', 14, 50, 0.9);
            if (s.heal > 0) this.number('throneHeal', s.x, s.y - 220, `+${s.heal}`, '#7dffa0', true);
            this.hpGlow = 1;
        }
        this.pendingSacrifices = this.pendingSacrifices.filter(s => s.t > 0);
        if (this.banner) {
            this.banner.age += dt;
            if (this.banner.age > this.banner.life) this.banner = null;
        }
    }
};

const HUD_GOLD = { x: 1490, y: 1024 }; // 하단 바 골드 아이콘 가운데(js/ui/ui.js가 여기에 그린다)
