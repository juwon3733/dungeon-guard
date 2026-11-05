// 효과음과 배경음을 Web Audio로 합성한다. 음원 파일은 3단계에서 교체한다.
const Sfx = {
    ctx: null,
    master: null,
    music: null,
    muted: false,
    last: {},
    step: 0,
    nextNote: 0,
    timer: null,

    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.music = this.ctx.createGain();
        this.music.gain.value = 0.16;
        this.music.connect(this.master);
        this.nextNote = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.scheduleMusic(), 60);
    },

    setMuted(on) {
        this.muted = on;
        if (this.master) this.master.gain.value = on ? 0 : 0.5;
    },

    tone(freq, dur, type, vol, slide, when, dest) {
        const t = (when || this.ctx.currentTime);
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        o.connect(g);
        g.connect(dest || this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    },

    noise(dur, vol, filterFreq) {
        const size = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq || 3000;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        src.start();
    },

    play(name, arg) {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const gap = name === 'kill' ? 0.03 : 0.05;
        if (this.last[name] && now - this.last[name] < gap) return;
        this.last[name] = now;
        const n = {
            arrow: () => this.tone(980, 0.07, 'square', 0.05, 0.5),
            snipe: () => { this.tone(1400, 0.16, 'sawtooth', 0.09, 0.2); this.noise(0.1, 0.1, 5000); },
            orb: () => this.tone(320, 0.2, 'triangle', 0.12, 2.2),
            beam: () => { this.tone(1200, 0.26, 'sawtooth', 0.09, 0.3); this.noise(0.2, 0.08, 6000); },
            blast: () => { this.noise(0.26, 0.2, 1400); this.tone(160, 0.22, 'square', 0.1, 0.4); },
            hit: () => this.noise(0.05, 0.08, 4200),
            slash: () => this.noise(0.08, 0.1, 2600),
            spawn: () => this.tone(240, 0.05, 'square', 0.02, 1.2),
            kill: () => this.tone(420 * Math.pow(1.06, Math.min(arg || 1, 16)), 0.12, 'square', 0.08, 1.6),
            unitDown: () => this.tone(190, 0.2, 'sawtooth', 0.09, 0.5),
            build: () => { this.tone(330, 0.09, 'square', 0.09); this.tone(494, 0.13, 'square', 0.08, 1, now + 0.08); },
            upgrade: () => [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.08, 1, now + i * 0.06)),
            sell: () => this.tone(520, 0.14, 'triangle', 0.1, 0.6),
            charge: () => this.tone(180, 0.2, 'sawtooth', 0.09, 3.4),
            lightning: () => { this.noise(0.55, 0.42, 7000); this.tone(90, 0.5, 'sawtooth', 0.2, 0.4); },
            roar: () => { this.tone(110, 0.8, 'sawtooth', 0.28, 0.55); this.tone(165, 0.8, 'square', 0.14, 0.55); this.noise(0.5, 0.18, 900); },
            corrupt: () => [233, 277, 349, 466].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.08, 1, now + i * 0.07)),
            stun: () => this.tone(1500, 0.22, 'triangle', 0.08, 0.35),
            throneHit: () => { this.tone(120, 0.32, 'square', 0.2, 0.5); this.noise(0.2, 0.2, 1500); },
            waveStart: () => [220, 277, 330].forEach((f, i) => this.tone(f, 0.16, 'square', 0.08, 1, now + i * 0.1)),
            waveClear: () => [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'square', 0.08, 1, now + i * 0.09)),
            bossIntro: () => [110, 104, 98, 82].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.2, 1, now + i * 0.28)),
            bossDown: () => { this.noise(0.9, 0.35, 3000); [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'square', 0.1, 1, now + i * 0.13)); },
            victory: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.1, 1, now + i * 0.14)),
            defeat: () => [330, 294, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.12, 1, now + i * 0.24)),
            click: () => this.tone(760, 0.05, 'square', 0.05)
        }[name];
        if (n) n();
    },

    // 어두운 단조 8비트 반복곡
    scheduleMusic() {
        if (!this.ctx) return;
        const beat = 0.2;
        const bass = [110, 110, 165, 110, 98, 98, 147, 98, 87, 87, 131, 87, 82, 82, 123, 104];
        const lead = [0, 440, 0, 523, 0, 659, 523, 0, 0, 392, 0, 494, 0, 587, 494, 0,
            0, 349, 0, 440, 0, 523, 440, 0, 0, 330, 0, 415, 494, 659, 0, 0];
        while (this.nextNote < this.ctx.currentTime + 0.2) {
            const i = this.step;
            if (i % 2 === 0) this.tone(bass[(i / 2) % bass.length], beat * 1.7, 'triangle', 0.5, 1, this.nextNote, this.music);
            const note = lead[i % lead.length];
            if (note) this.tone(note, beat * 0.9, 'square', 0.12, 1, this.nextNote, this.music);
            this.step++;
            this.nextNote += beat;
        }
    }
};
