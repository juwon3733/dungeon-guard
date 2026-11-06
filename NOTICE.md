# Notices

## pixelfx

`assets/fx/`의 전투 효과 시트(`pfx_*.png`)와 `js/data/fx_sheets.js`의 프레임 정보는
pixelfx(https://github.com/patch-gg/pixelfx, 커밋 `a841596`)의 효과를 렌더링해 프레임을 솎고 잘라 만든 것입니다.
pixelfx 소스 코드는 이 저장소에 들어 있지 않습니다. 사용한 효과와 옵션은 `docs/PIXELLAB_ASSETS.md`에 있습니다.

- `arcane/mana-burst`, `arcane/rune-circle`, `explosions/plasma-explosion`, `fire/fire-ring`, `fire/fireball`, `fire/spirit-flame`, `holy/heal-aoe`, `ice/ice-lance`, `ice/snowflake-burst`, `impacts/crit-hit`, `impacts/hit-spark`, `lightning/lightning-strike`, `lightning/thunderclap`, `lightning/zap-hit`, `melee/spin-slash`, `nature/thorns`, `pickups/collect-burst`, `projectiles/arrow`, `projectiles/energy-disc`, `scifi/emp-blast`, `spawn/poof`, `spawn/soul-rise`, `status/stunned`

시트를 다시 만드는 도구는 `tools/pfx_sheets.mjs`(pixelfx를 저장소 밖에서 불러 쓴다)입니다.

pixelfx의 NOTICE에 따라, 위 효과는 Hugo Duprez의 Sprite Fusion 오픈소스 픽셀 아트 VFX
(https://www.spritefusion.com/pixel-art-vfx, Copyright (c) 2026 Hugo Duprez, MIT License)를 바탕으로 합니다.

pixelfx 라이선스 원문:

```
MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
