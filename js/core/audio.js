// 효과음과 배경음: Asteria와 같은 합성 방식이다(소리 파일 없음). 소리 표는 js/data/asteria_audio.js(tools/import_asteria_audio.js)
//   효과음은 층(layers) 목록을 겹쳐 울리고, 배경음은 화음·멜로디 표를 16분음표 단위로 미리 예약한다.
//   이 게임의 효과음 이름은 SFX_MAP으로 Asteria 소리에 잇는다. 여러 소리를 시간차로 잇는 것도 있다.

// 이름 → [[Asteria 소리, 늦춤(초), 음 높이 배율], ...]. 함수면 arg(등급, 연속 처치 수 등)로 고른다
const SFX_MAP = {
    // 공격과 명중
    arrow: [['bowShot', 0, 1]],
    snipe: [['gunShot', 0, 1], ['chainZap', 0.02, 1.2]],
    orb: [['magic', 0, 0.8]],
    beam: [['laserCharge', 0, 1.6]],
    blast: [['hazardBlast', 0, 1]],
    hit: [['hit', 0, 1]],
    slash: [['slash', 0, 1]],
    hitFire: [['hitFire', 0, 1]],
    hitIce: [['hitIce', 0, 1]],
    hitLightning: [['hitLightning', 0, 1]],
    hitCurse: [['hitPoison', 0, 0.8]],
    hitHeavy: [['hitThump', 0, 1]],
    // 용사
    spawn: [['footstep', 0, 1]],
    kill: arg => [['enemyDie', 0, 1 + Math.min(arg || 1, 12) * 0.03]], // 연속 처치일수록 조금씩 높아진다
    killElite: [['enemyDieBig', 0, 1]],
    unitDown: [['hurtHeavy', 0, 1]],
    stun: [['hitHeavy', 0, 1.2]],
    throneHit: [['playerHurt', 0, 0.8], ['hurtHeavy', 0.03, 1]],
    // 소환과 합치기, 상점
    summon: arg => [[['summon', 'rareItem', 'legendaryDrop'][Math.min(arg || 0, 2)], 0, 1]],
    merge: arg => [['castCharge', 0, 0.8], [(arg || 0) >= 2 ? 'advanceBurst' : 'stackBurst', 0.42, 1]], // 결과가 나오는 순간(0.42초)에 터진다
    hidden: [['fanfare', 0.5, 1.2]],
    rankUp: arg => [[(arg || 0) >= 4 ? 'levelUp' : 'buff', 0, 1.2]],
    build: [['item', 0, 1]],
    upgrade: [['enhanceSuccess', 0, 1]],
    sell: [['gold', 0, 1]],
    pickup: [['lootDrop', 0, 1]],
    mergeFail: [['error', 0, 1]],
    click: [['click', 0, 1]],
    // 마왕 권능
    charge: [['castCharge', 0, 1]],
    lightning: [['thunder', 0, 1]],
    roar: [['bossRoar', 0, 1.3]],
    corrupt: [['sealUp', 0, 1]],
    // 라운드와 판
    waveStart: [['portal', 0, 1]],
    waveClear: [['questComplete', 0, 1]],
    bossIntro: [['bossPhase', 0, 1], ['bossRoar', 0.3, 1]],
    bossDown: [['bossDie', 0, 1]],
    victory: [['fanfare', 0, 1]],
    defeat: [['playerDie', 0, 1]]
};

// 크게 울리는 소리: 잠깐 배경음을 줄인다(밀리초, 줄인 비율)
const SFX_DUCK = { bossIntro: [1200, 0.3], bossDown: [1400, 0.25], victory: [2000, 0.15], defeat: [1800, 0.15], roar: [900, 0.35], lightning: [600, 0.5] };

// 음 이름(C4, F#3) → 주파수
const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function noteFreq(name) {
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE_INDEX[m[1]] + 12 * (Number(m[2]) + 1) - 69) / 12);
}

const Sfx = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    noiseBuffer: null,
    muted: false,
    volume: { master: 80, sfx: 80, bgm: 60 }, // 0~100
    lastPlayed: {},
    duckUntil: 0,
    duckLevel: 1,

    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.bgmBus = this.ctx.createGain();
        this.bgmBus.connect(this.master);
        const n = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, n, n);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        this.updateVolumes();
        Music.nextTime = this.ctx.currentTime + 0.1;
    },

    // 음량은 제곱으로 줄인다(귀에 고르게 들린다). 배경음은 효과음보다 작게 깔린다
    updateVolumes() {
        if (!this.ctx) return;
        const curve = v => Math.pow(clamp(v, 0, 100) / 100, 2);
        this.master.gain.value = this.muted ? 0 : curve(this.volume.master);
        this.sfxBus.gain.value = curve(this.volume.sfx);
        const duck = performance.now() < this.duckUntil ? this.duckLevel : 1;
        this.bgmBus.gain.value = 0.55 * curve(this.volume.bgm) * duck;
    },

    setMuted(on) {
        this.muted = on;
        this.updateVolumes();
    },

    setVolume(kind, value) {
        this.volume[kind] = clamp(Math.round(value), 0, 100);
        this.updateVolumes();
    },

    play(name, arg) {
        if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
        let list = SFX_MAP[name];
        if (typeof list === 'function') list = list(arg);
        if (!list) return;
        const duck = SFX_DUCK[name];
        if (duck) {
            this.duckUntil = performance.now() + duck[0];
            this.duckLevel = duck[1];
        }
        for (const [id, delay, pitch] of list) this.playAsteria(id, delay, pitch);
    },

    // Asteria 소리 하나: 같은 소리는 최소 간격(minGap) 안에 다시 울리지 않는다(수십 마리가 동시에 때려도 시끄럽지 않다)
    playAsteria(id, delay, pitch) {
        const def = ASTERIA_SFX[id];
        if (!def) return;
        const now = performance.now() + (delay || 0) * 1000;
        if (now - (this.lastPlayed[id] || -1e9) < (def.minGap || 40)) return;
        this.lastPlayed[id] = now;
        const p = (pitch || 1) * (1 + (Math.random() - 0.5) * (def.jitter || 0));
        const t = this.ctx.currentTime + (delay || 0);
        for (const layer of def.layers) this.playLayer(layer, t + (layer.delay || 0), p, this.sfxBus);
    },

    playLayer(layer, t, pitch, dest) {
        const ctx = this.ctx;
        const gain = ctx.createGain();
        const peak = layer.gain || 0.3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + (layer.attack || 0.005));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + layer.dur);
        let src;
        if (layer.type === 'noise') {
            src = ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
        } else {
            src = ctx.createOscillator();
            src.type = layer.wave || 'square';
            src.frequency.setValueAtTime(layer.freq * pitch, t);
            if (layer.freqEnd) src.frequency.exponentialRampToValueAtTime(layer.freqEnd * pitch, t + layer.dur);
        }
        let out = src;
        if (layer.filter) {
            const f = ctx.createBiquadFilter();
            f.type = layer.filter.type;
            f.frequency.setValueAtTime(layer.filter.freq * pitch, t);
            if (layer.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(layer.filter.freqEnd * pitch, t + layer.dur);
            f.Q.value = layer.filter.q || 1;
            out.connect(f);
            out = f;
        }
        out.connect(gain);
        gain.connect(dest);
        src.start(t);
        src.stop(t + layer.dur + 0.05);
    }
};

// 배경음: 곡 표(ASTERIA_MUSIC)를 16분음표마다 예약한다. 베이스, 패드, 아르페지오, 멜로디, 드럼
const Music = {
    trackId: null,
    step: 0,
    nextTime: 0,
    melody: [],

    // 곡을 바꾼다(같은 곡이면 그대로 이어 간다). null이면 멈춘다
    play(id) {
        if (this.trackId === id) return;
        this.trackId = id;
        this.melody = id && ASTERIA_MUSIC[id] ? ASTERIA_MUSIC[id].melody.split(/\s+/) : [];
        this.step = 0;
        if (Sfx.ctx) this.nextTime = Sfx.ctx.currentTime + 0.1;
    },

    // 매 프레임: 지금 상황의 곡을 고르고, 앞으로 0.25초 안의 음을 예약한다
    update() {
        this.play(musicFor());
        Sfx.updateVolumes();
        const ctx = Sfx.ctx;
        const track = ASTERIA_MUSIC[this.trackId];
        if (!ctx || ctx.state !== 'running' || !track) return;
        const sixteenth = 60 / track.bpm / 4;
        if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
        while (this.nextTime < ctx.currentTime + 0.25) {
            this.scheduleStep(track, this.step, this.nextTime, sixteenth);
            this.step = (this.step + 1) % (16 * track.chords.length);
            this.nextTime += sixteenth;
        }
    },

    scheduleStep(track, step, t, len) {
        const out = Sfx.bgmBus;
        const chord = track.chords[Math.floor(step / 16)];
        const i = step % 16;
        const bassEvery = track.fastBass ? 2 : 4;
        if (i % bassEvery === 0) this.tone('triangle', noteFreq(chord[0]) / 2, t, len * bassEvery * 0.9, 0.32, out);
        if (track.pad && i === 0) this.padChord(chord, t, len * 16, out);
        if (track.arp) this.tone('square', noteFreq(chord[i % chord.length]) * 2, t, len * 0.8, 0.045, out);
        if (i % 2 === 0 && this.melody.length) {
            const n = Math.floor(step / 2) % this.melody.length;
            const note = this.melody[n];
            if (note && note !== '-' && note !== '.') {
                let hold = 1;
                while (this.melody[(n + hold) % this.melody.length] === '.') hold++;
                this.tone(track.lead, noteFreq(note), t, len * 2 * hold * 0.92, 0.09, out);
            }
        }
        if (track.drums) {
            if (i % 8 === 0) Sfx.playLayer({ type: 'tone', wave: 'sine', freq: 140, freqEnd: 40, dur: 0.18, gain: 0.5 }, t, 1, out);
            if (i % 8 === 4) Sfx.playLayer({ type: 'noise', dur: 0.12, gain: 0.22, filter: { type: 'highpass', freq: 1500 } }, t, 1, out);
            if (i % 2 === 1) Sfx.playLayer({ type: 'noise', dur: 0.04, gain: 0.08, filter: { type: 'highpass', freq: 7000 } }, t, 1, out);
        }
    },

    tone(wave, freq, t, dur, vol, out) {
        if (!freq) return;
        const ctx = Sfx.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + dur + 0.02);
    },

    padChord(chord, t, dur, out) {
        const ctx = Sfx.ctx;
        for (const name of chord) {
            const f = noteFreq(name);
            if (!f) continue;
            for (const detune of [-6, 6]) {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(f, t);
                o.detune.setValueAtTime(detune, t);
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(0.03, t + dur * 0.3);
                g.gain.linearRampToValueAtTime(0.022, t + dur * 0.8);
                g.gain.linearRampToValueAtTime(0.0001, t + dur);
                o.connect(g);
                g.connect(out);
                o.start(t);
                o.stop(t + dur + 0.05);
            }
        }
    }
};

// 지역별 전투 곡
const ZONE_MUSIC = { moonGarden: 'mystic', coast: 'tide', frost: 'frost', skySea: 'windy', sunForge: 'rift', warTemple: 'dark', starChoir: 'crystal', ember: 'ember' };

// 지금 상황의 곡: 타이틀, 본부와 메뉴, 판 중(지역 곡, 보스 곡, 토벌전), 결과 화면은 조용히(팡파르가 들리게)
function musicFor() {
    const state = Game.state;
    if (state === 'title') return 'title';
    if (state === 'victory' || state === 'defeat') return null;
    if (!Game.inPlay()) return 'town';
    if (Game.challenge && Game.challenge.kind === 'raid') return 'raid';
    const boss = Game.heroes.find(h => h.boss && !h.dead && !h.waiting);
    if (boss) {
        if (boss.bossKey === 'archmage') return 'requia';
        return Game.waveIndex >= Game.waves.length - 1 ? 'finalBoss' : 'boss';
    }
    return ZONE_MUSIC[Game.zone] || 'dark';
}
