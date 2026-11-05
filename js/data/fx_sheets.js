// pixelfx(https://github.com/patch-gg/pixelfx, MIT)로 만든 전투 효과 시트. 만든 방법은 docs/PIXELLAB_ASSETS.md
// 키는 바꿔 치울 옛 Asteria 효과 이름이다. 그림은 assets/fx/<image>.png, 한 줄에 cols칸씩 왼쪽 위부터 채운다.
// pivot은 Fx.anim에 넘긴 좌표가 닿는 그림 속 점, life는 재생 길이(초), fit은 화면 1배로 그리는 기준 size(화면 px)다.
const FX_SHEETS = {
    fx_hit_physical: { image: 'pfx_hit_spark', w: 122, h: 71, cols: 8, frames: 15, pivotX: 34, pivotY: 36, life: 0.5, fit: 110 }, // impacts/hit-spark
    fx_hit_crit: { image: 'pfx_crit_hit', w: 174, h: 131, cols: 8, frames: 18, pivotX: 77, pivotY: 76, life: 0.6, fit: 150 }, // impacts/crit-hit
    fx_explosion: { image: 'pfx_poof', w: 91, h: 76, cols: 8, frames: 18, pivotX: 43, pivotY: 40, life: 0.6, fit: 100 }, // spawn/poof
    fx_blastViolet: { image: 'pfx_mana_burst', w: 170, h: 146, cols: 8, frames: 16, pivotX: 85, pivotY: 93, life: 0.533, fit: 180 }, // arcane/mana-burst
};
