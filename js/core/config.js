// 화면 규격: 1920x1080 가상 해상도. 세계는 WORLD_ZOOM배로 줄여 그리고, 칸(TILE 96)은 화면에서 64px이다.
// 도트 1칸 = 화면 2픽셀: 캐릭터와 소품은 세계 배율 3(PIXEL_SCALE)으로 그려 화면에서 정확히 2배가 된다.
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const TILE = 96; // 세계 좌표의 칸 크기. 화면에는 TILE * WORLD_ZOOM으로 보인다
const WORLD_ZOOM = 2 / 3; // 세계를 줄여 칸을 64px로 표시한다. UI는 줄이지 않는다
const WORLD_WIDTH = GAME_WIDTH / WORLD_ZOOM;
const WORLD_HEIGHT = GAME_HEIGHT / WORLD_ZOOM;
const MAP_COLS = 30; // 30 x 15칸 = 화면 1920 x 960. 아래는 하단 바다
const MAP_ROWS = 15;
const MAP_TOP = 0;
const PIXEL_SCALE = 3; // 그림 1px을 화면 2px로 그리는 세계 배율(3 x WORLD_ZOOM = 2)
const HERO_SCALE = PIXEL_SCALE; // 용사, 정예, 타락 유닛
const BOSS_SCALE = PIXEL_SCALE; // 보스와 마왕도 같은 도트 크기다(그림 자체가 크다)
const UI_FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";

function tileX(col) { return col * TILE + TILE / 2; }
function tileY(row) { return MAP_TOP + row * TILE + TILE / 2; }
// 세계 좌표를 화면 정수 픽셀에 맞춘다(도트가 고르게 보이게)
function snapWorld(v) { return Math.round(v * WORLD_ZOOM) / WORLD_ZOOM; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
function randItem(list) { return list[Math.floor(Math.random() * list.length)]; }
