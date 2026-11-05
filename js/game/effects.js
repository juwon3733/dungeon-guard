// 연출용 데이터만 만든다. 그리기는 render 파일이 맡고, 전투 결과에는 영향을 주지 않는다.
const Fx = {
    particles: [], numbers: [], rings: [], beams: [], bolts: [], coins: [], decals: [], speech: [], glows: [], anims: [],
    shake: 0,
    dim: 0,
    reduce: false,
    goldPulse: 0,
    banner: null,

    reset() {
        for (const key of ['particles', 'numbers', 'rings', 'beams', 'bolts', 'coins', 'decals', 'speech', 'glows', 'anims']) this[key] = [];
        this.shake = 0;
        this.dim = 0;
        this.goldPulse = 0;
        this.banner = null;
    },

    // Asteria의 8프레임 효과 스트립을 재생한다. size는 화면에 그릴 한 변의 길이(px)
    anim(name, x, y, size, life, angle) {
        if (this.reduce && this.anims.length > 24) return;
        if (this.anims.length > 90) this.anims.shift();
        this.anims.push({ name, x, y, size, age: 0, life: life || 0.36, angle: angle || 0 });
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
        this.numbers.push({ target, x: x + randRange(-14, 14), y, amount, color, big: !!big, age: 0, life: 0.8 });
    },

    ring(x, y, radius, color, life) { this.rings.push({ x, y, radius, color, age: 0, life }); },
    beam(ax, ay, bx, by, color, width, life) { this.beams.push({ ax, ay, bx, by, color, width, age: 0, life }); },
    glow(x, y, radius, color, life) { this.glows.push({ x, y, radius, color, age: 0, life }); },
    addShake(amount) { if (!this.reduce) this.shake = Math.max(this.shake, amount); },

    // 번개는 위에서 아래로 내려오는 꺾은선. 매번 무작위 모양으로 만든다.
    bolt(x, y, color) {
        const points = [];
        let cx = x + randRange(-30, 30);
        for (let py = y - 900; py < y; py += 60) {
            points.push([cx, py]);
            cx += randRange(-46, 46);
            cx = x + (cx - x) * 0.82;
        }
        points.push([x, y]);
        this.bolts.push({ points, color, age: 0, life: 0.28 });
    },

    coin(x, y, amount) {
        const n = Math.min(6, Math.max(2, Math.round(amount / 3)));
        for (let i = 0; i < n; i++) {
            this.coins.push({ x, y, vx: randRange(-170, 170), vy: randRange(-420, -220), age: 0, delay: 0.42 + i * 0.03 });
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

        for (const list of [this.numbers, this.rings, this.beams, this.bolts, this.speech, this.glows, this.anims]) {
            for (const item of list) item.age += dt;
        }
        for (const n of this.numbers) n.y -= 52 * dt;
        this.numbers = this.numbers.filter(n => n.age < n.life);
        this.rings = this.rings.filter(r => r.age < r.life);
        this.beams = this.beams.filter(b => b.age < b.life);
        this.bolts = this.bolts.filter(b => b.age < b.life);
        this.speech = this.speech.filter(s => s.age < s.life);
        this.glows = this.glows.filter(g => g.age < g.life);
        this.anims = this.anims.filter(a => a.age < a.life);

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
        if (this.banner) {
            this.banner.age += dt;
            if (this.banner.age > this.banner.life) this.banner = null;
        }
    }
};

const HUD_GOLD = { x: 1708, y: 1020 };
