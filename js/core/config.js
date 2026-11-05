// 화면 규격은 Asteria와 같다: 1920x1080 가상 해상도, 도트 1칸 = 화면 2픽셀, 타일 48x48 → 96px.
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const TILE = 96;
const MAP_COLS = 20;
const MAP_ROWS = 11;
const MAP_TOP = 12; // 1080은 96으로 나누어떨어지지 않아 위아래 여백을 12px씩 둔다
const HERO_SCALE = 1.25; // 일반 용사와 유닛의 표시 배율. 무리가 보이도록 원본 2배보다 줄였다
const BOSS_SCALE = 1.5;
const PL_SCALE = 2; // PixelLab 그림은 정수 2배로 그려 도트 격자를 유지한다
const PL_DIRS = { down: 'south', up: 'north', left: 'west', right: 'east' };
const UI_FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";

function tileX(col) { return col * TILE + TILE / 2; }
function tileY(row) { return MAP_TOP + row * TILE + TILE / 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
function randItem(list) { return list[Math.floor(Math.random() * list.length)]; }
