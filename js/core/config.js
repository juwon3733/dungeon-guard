// 화면 규격: 1920x1080 가상 해상도. 세계는 WORLD_ZOOM배로 줄여 그리고, 칸(TILE 96)은 화면에서 80px이다.
// 그림 배율은 화면 기준 정수배다: ART_SCALE은 그림 1px = 화면 1px, PIXEL_SCALE은 그림 1px = 화면 2px.
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const TILE = 96; // 세계 좌표의 칸 크기. 화면에는 TILE * WORLD_ZOOM으로 보인다
const WORLD_ZOOM = 5 / 6; // 세계를 줄여 칸을 80px로 표시한다. UI는 줄이지 않는다
const WORLD_WIDTH = GAME_WIDTH / WORLD_ZOOM;
const WORLD_HEIGHT = GAME_HEIGHT / WORLD_ZOOM;
const MAP_COLS = 24; // 24 x 12칸 = 화면 1920 x 960. 아래는 하단 바다
const MAP_ROWS = 12;
const MAP_TOP = 0;
const ART_SCALE = 1 / WORLD_ZOOM; // 그림 1px을 화면 1px로 그리는 세계 배율
const PIXEL_SCALE = 2 / WORLD_ZOOM; // 그림 1px을 화면 2px로 그리는 세계 배율
const HERO_SCALE = PIXEL_SCALE; // 용사, 정예, 타락 유닛
const BOSS_SCALE = PIXEL_SCALE; // 보스와 마왕도 같은 도트 크기다(그림 자체가 크다)
const GAME_VERSION = '0.9.0'; // 타이틀 오른쪽 아래 빌드 표시
const UI_FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";

function tileX(col) { return col * TILE + TILE / 2; }
function tileY(row) { return MAP_TOP + row * TILE + TILE / 2; }
// 세계 좌표를 화면 정수 픽셀에 맞춘다(도트가 고르게 보이게)
function snapWorld(v) { return Math.round(v * WORLD_ZOOM) / WORLD_ZOOM; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// 제곱근은 어느 브라우저에서나 같은 값이 나온다(Math.hypot은 엔진마다 다를 수 있어 입력 재생이 어긋난다)
function distance(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
function randItem(list) { return list[Math.floor(Math.random() * list.length)]; }

// randRange와 randItem은 연출용이다(판 결과에 영향이 없다). 판 결과를 바꾸는 난수는 아래 rng를 쓴다.
// 도전 콘텐츠는 게임을 고정 시간 단위(GAME_TICK)로 돌리고 난수를 시드로 고정해 같은 입력이면 같은 판이 나오게 한다.
// 난수 흐름(stream)을 소환, 칸, 합치기, 보상, 등장, 전투로 나눈다. 앞선 행동이 뒤 소환 결과를 흔들지 않아 N번째 소환이 모두에게 같다
const GAME_TICK = 1 / 60;

function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h | 0;
}

const Rng = {
    on: false,
    seed: '',
    streams: {},
    start(seed) { this.on = true; this.seed = String(seed); this.streams = {}; },
    stop() { this.on = false; this.streams = {}; },
    next(stream) {
        const cur = this.streams[stream] === undefined ? hashSeed(`${this.seed}/${stream}`) : this.streams[stream];
        const s = (cur + 0x6D2B79F5) | 0;
        this.streams[stream] = s;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
};

// 시드가 없는 판(스토리)은 그대로 Math.random이다
function rng(stream) { return Rng.on ? Rng.next(stream) : Math.random(); }
function rngRange(stream, lo, hi) { return lo + rng(stream) * (hi - lo); }
function rngItem(stream, list) { return list[Math.floor(rng(stream) * list.length)]; }
