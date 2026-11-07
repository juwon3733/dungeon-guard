# 몬스터 그림에서 주변 효과에 쓸 색을 뽑아 js/data/monsters.js의 MONSTER_PALETTES 블록에 적는다.
# 실행: node로 몬스터 그림 이름을 뽑은 뒤 python tools/monster_palettes.py
#   node -e "..."(아래 main이 직접 부른다)
# 색: 그림에서 채도와 밝기가 있는 픽셀을 색상 칸으로 모아 가장 많은 색상의 어두운/중간/밝은 색, 그다음 색상의 강조색
import colorsys, json, os, re, subprocess
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
JS = """const fs=require('fs'),vm=require('vm');const ctx=vm.createContext({console,Math,Set,Map,Object,Array,JSON});
for (const f of ['js/core/config.js','js/data/balance.js','js/data/asteria_art.js','js/data/asteria_heroes.js','js/data/hd_monster_art.js','js/data/monsters.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const out={}; for (const [k,m] of Object.entries(vm.runInContext('MONSTERS',ctx))) out[k]=m.art.sprite||m.sprite; console.log(JSON.stringify(out));"""

def hexc(rgb):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in rgb)

def palette(path):
    im = Image.open(path).convert('RGBA')
    bins = {}
    for r, g, b, a in im.getdata():
        if a < 200: continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < 0.25 or v < 0.2: continue
        k = int(h * 12) % 12
        bins.setdefault(k, []).append((v, (r, g, b), s * v))
    if not bins: return None
    order = sorted(bins, key=lambda k: -sum(x[2] for x in bins[k]))
    main = sorted(bins[order[0]], key=lambda x: x[0])
    pick = lambda q: main[min(len(main) - 1, int(len(main) * q))][1]
    dark, mid, light = pick(0.2), pick(0.55), pick(0.92)
    accent = sorted(bins[order[1]], key=lambda x: x[0])[-1][1] if len(order) > 1 else light
    return [hexc(dark), hexc(mid), hexc(light), hexc(accent)]

sprites = json.loads(subprocess.run(['node', '-e', JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
out = {}
for mid, sprite in sprites.items():
    p = os.path.join(ROOT, 'assets', 'sprites', sprite, 'rotations', 'south.png')
    if os.path.exists(p):
        pal = palette(p)
        if pal: out[mid] = pal
path = os.path.join(ROOT, 'js', 'data', 'monsters.js')
src = open(path, encoding='utf8', newline='').read()
crlf = '\r\n' in src
src = src.replace('\r\n', '\n')
block = ('// <palettes> tools/monster_palettes.py가 만든 표: 몬스터 그림에서 뽑은 [어두운, 중간, 밝은, 강조] 색(주변 효과에 쓴다)\n'
         'const MONSTER_PALETTES = ' + json.dumps(out, separators=(',', ':')) + ';\n// </palettes>')
if '// <palettes>' in src:
    src = re.sub(r'// <palettes>.*?// </palettes>', lambda m: block, src, flags=re.S)
else:
    src = src.rstrip('\n') + '\n\n' + block + '\n'
if crlf: src = src.replace('\n', '\r\n')
open(path, 'w', encoding='utf8', newline='').write(src)
print(len(out), 'palettes')
