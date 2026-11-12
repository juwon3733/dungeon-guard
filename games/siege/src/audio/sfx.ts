// 효과음: PC-98식 FM(2연산자) 소리를 Web Audio로 그때그때 만든다. 파일 없음.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
export let muted = false;
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('siege.mute', m ? '1' : '0'); } catch { /* 없음 */ } }
try { muted = localStorage.getItem('siege.mute') === '1'; } catch { /* 없음 */ }

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => ac(), { once: true });

/** FM 한 음: 반송파 freq, 변조 비율 ratio, 변조 깊이 index, 음높이 미끄러짐 slide(끝 주파수 배율) */
function fm(o: { freq: number; ratio: number; index: number; dur: number; vol: number; slide?: number; type?: OscillatorType; delay?: number }) {
  const a = ac(); if (!a || !master || muted) return;
  const t = a.currentTime + (o.delay ?? 0);
  const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
  car.type = o.type ?? 'sine'; mod.type = 'sine';
  car.frequency.setValueAtTime(o.freq, t); mod.frequency.setValueAtTime(o.freq * o.ratio, t);
  if (o.slide) { car.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.slide), t + o.dur); mod.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.ratio * o.slide), t + o.dur); }
  mg.gain.setValueAtTime(o.freq * o.index, t); mg.gain.exponentialRampToValueAtTime(1, t + o.dur);
  g.gain.setValueAtTime(o.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(master);
  car.start(t); mod.start(t); car.stop(t + o.dur + 0.02); mod.stop(t + o.dur + 0.02);
}
/** 짧은 잡음(타격의 '착') */
function noise(dur: number, vol: number, hp = 800, delay = 0) {
  const a = ac(); if (!a || !master || muted) return;
  const t = a.currentTime + delay, n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

const last: Record<string, number> = {};
const gap: Record<string, number> = { hit: 0.05, slash: 0.06, arrow: 0.07, die: 0.06 };
export type Sfx = 'hit' | 'big' | 'slash' | 'arrow' | 'die' | 'boom' | 'gate' | 'deploy' | 'skill' | 'release' | 'win' | 'lose';
export function sfx(k: Sfx) {
  const a = ac(); if (!a || muted) return;
  const now = a.currentTime;
  if (gap[k] && now - (last[k] ?? -1) < gap[k]) return;
  last[k] = now;
  const r = 0.94 + Math.random() * 0.12;
  switch (k) {
    case 'hit': fm({ freq: 140 * r, ratio: 1.4, index: 3, dur: 0.08, vol: 0.35, slide: 0.5 }); noise(0.04, 0.12, 1500); break;
    case 'big': fm({ freq: 90 * r, ratio: 1.41, index: 6, dur: 0.22, vol: 0.6, slide: 0.4 }); noise(0.1, 0.3, 600); break;
    case 'slash': noise(0.07, 0.18, 3000); fm({ freq: 900 * r, ratio: 2.01, index: 2, dur: 0.06, vol: 0.12, slide: 0.6 }); break;
    case 'arrow': fm({ freq: 1400 * r, ratio: 0.5, index: 1, dur: 0.05, vol: 0.06, slide: 0.7 }); break;
    case 'die': fm({ freq: 300 * r, ratio: 0.5, index: 4, dur: 0.25, vol: 0.18, slide: 0.3, type: 'square' }); break;
    case 'boom': fm({ freq: 60, ratio: 1.7, index: 9, dur: 0.6, vol: 0.8, slide: 0.35 }); noise(0.45, 0.45, 200); break;
    case 'gate': fm({ freq: 50, ratio: 1.3, index: 10, dur: 1.0, vol: 0.9, slide: 0.3 }); noise(0.8, 0.55, 120); fm({ freq: 220, ratio: 3.5, index: 3, dur: 0.5, vol: 0.2, slide: 0.5, delay: 0.05 }); break;
    case 'deploy': [0, 0.07, 0.14].forEach((d, i) => fm({ freq: [262, 330, 392][i], ratio: 2, index: 1.5, dur: 0.25, vol: 0.16, type: 'square', delay: d })); noise(0.2, 0.1, 2000, 0.1); break;
    case 'skill': fm({ freq: 180, ratio: 3, index: 4, dur: 0.7, vol: 0.25, slide: 2.4 }); break;
    case 'release': fm({ freq: 70, ratio: 2.1, index: 12, dur: 0.7, vol: 0.8, slide: 0.4 }); noise(0.4, 0.4, 400); fm({ freq: 660, ratio: 1.5, index: 2, dur: 0.5, vol: 0.15, type: 'square', delay: 0.02 }); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => fm({ freq: f, ratio: 2, index: 1.2, dur: 0.4, vol: 0.18, type: 'square', delay: i * 0.12 })); break;
    case 'lose': [392, 349, 311, 262].forEach((f, i) => fm({ freq: f, ratio: 1, index: 0.8, dur: 0.45, vol: 0.16, type: 'triangle', delay: i * 0.18 })); break;
  }
}
