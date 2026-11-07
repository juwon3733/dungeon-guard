// Asteria의 합성 효과음 표와 배경음악 표를 꺼내 js/data/asteria_audio.js로 적는다.
// 실행: node tools/import_asteria_audio.js
// Asteria도 소리 파일 없이 Web Audio로 합성한다. 게임 코드(game.js) 안의 두 표를 그대로 옮긴다:
//   효과음: { 이름: { minGap, jitter, layers: [{ type: 'tone'|'noise', wave, freq, freqEnd, dur, gain, attack, delay, filter }] } }
//   배경음악: { 이름: { bpm, lead, arp, drums, fastBass, pad, chords: [[음, ...], ...], melody: '음 . - ...' } }
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(process.env.USERPROFILE, 'Downloads', 'Asteria-stove-3.2.0-win64', 'resources', 'www', 'game.js');
const code = fs.readFileSync(src, 'utf8');

// name={...} 꼴 객체 글자를 괄호 짝을 맞춰 잘라낸다. 같은 이름이 여럿이면 표시(mark)가 든 것을 고른다
function grab(name, mark) {
    const re = new RegExp(`[,;\\s]${name}=\\{`, 'g');
    let m;
    while ((m = re.exec(code))) {
        const start = m.index + m[0].length - 1;
        let depth = 0;
        let k = start;
        let quote = null;
        for (; k < code.length; k++) {
            const c = code[k];
            if (quote) { if (c === quote && code[k - 1] !== '\\') quote = null; continue; }
            if (c === '"' || c === "'") quote = c;
            else if (c === '{') depth++;
            else if (c === '}' && --depth === 0) break;
        }
        const body = code.slice(start, k + 1);
        if (body.includes(mark)) return body;
    }
    throw new Error(`${name} 표를 찾지 못했다`);
}

// 데이터뿐인 객체 글자다(함수 없음). 순수 값으로 읽는다
const read = body => Function(`"use strict"; return (${body});`)();
const sfx = read(grab('li', 'layers'));
const music = read(grab('ui', 'melody'));

const out = [
    '// tools/import_asteria_audio.js가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.',
    '// Asteria의 합성 효과음(층 목록)과 배경음악(화음, 멜로디, 빠르기). 재생은 js/core/audio.js',
    `const ASTERIA_SFX = ${JSON.stringify(sfx)};`,
    `const ASTERIA_MUSIC = ${JSON.stringify(music)};`,
    ''
].join('\n');
fs.writeFileSync(path.join(root, 'js', 'data', 'asteria_audio.js'), out);
console.log(Object.keys(sfx).length, 'sfx,', Object.keys(music).length, 'tracks');
