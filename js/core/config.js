// 화면 규격은 Asteria와 같다: 1920x1080 가상 해상도, 도트 1칸 = 화면 2픽셀, 타일 48x48 → 96px.
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const TILE = 96; // 세계 좌표의 칸 크기. 화면에는 TILE * WORLD_ZOOM으로 보인다
const WORLD_ZOOM = 0.75; // 세계를 줄여 칸을 72px로 표시한다. UI는 줄이지 않는다
const WORLD_WIDTH = GAME_WIDTH / WORLD_ZOOM;
const WORLD_HEIGHT = GAME_HEIGHT / WORLD_ZOOM;
const MAP_COLS = 26;
const MAP_ROWS = 15;
const MAP_TOP = 0;
const HERO_SCALE = 1.25; // 일반 용사와 유닛의 표시 배율. 무리가 보이도록 원본 2배보다 줄였다
const BOSS_SCALE = 1.5;
const UI_FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";

function tileX(col) { return col * TILE + TILE / 2; }
function tileY(row) { return MAP_TOP + row * TILE + TILE / 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
function randItem(list) { return list[Math.floor(Math.random() * list.length)]; }
