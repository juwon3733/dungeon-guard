# 전설과 신화 몬스터 둘레를 도는 오브젝트 그림(24px)을 만든다. assets/sprites/orb_<몬스터>.png
# 실행: python tools/import_orbiters.py
# PixelLab에서 종족별로 고른 그림을 받아, 밝기에 따라 그 몬스터의 색(js/data/monsters.js의 MONSTER_PALETTES)으로 다시 칠한다.
# 그림 1px이 화면 1px이 되도록 크기는 바꾸지 않는다.
import io, json, os, re, subprocess, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OBJ = 'https://backblaze.pixellab.ai/file/pixellab-characters/objects/fd68a04a-60b9-47da-a03f-4fd57e331c5b/7d7a95f0-340c-4b9c-9035-70743a120de5/rotations/frame_{}.png'
PICK = {'demon': 3, 'undead': 6, 'spirit': 8, 'beast': 12, 'orc': 17}  # 종족별로 고른 후보 번호

JS = """const fs=require('fs'),vm=require('vm');const ctx=vm.createContext({console,Math,Set,Map,Object,Array,JSON});
for (const f of ['js/core/config.js','js/data/balance.js','js/data/asteria_art.js','js/data/asteria_heroes.js','js/data/hd_monster_art.js','js/data/monsters.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const out={}; for (const [k,m] of Object.entries(vm.runInContext('MONSTERS',ctx))) if (vm.runInContext('gradeInfo',ctx)(m.grade,'fx',0) >= 2) out[k]={family:m.family,palette:vm.runInContext('MONSTER_PALETTES',ctx)[k]};
console.log(JSON.stringify(out));"""

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'dungeon-guard-tools'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req).read())).convert('RGBA')

def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def recolor(im, pal):
    # 밝기 순서로 [테두리, 어두운, 중간, 밝은, 흰빛] 다섯 칸에 나눠 칠한다
    ramp = [(20, 12, 16), hexrgb(pal[0]), hexrgb(pal[1]), hexrgb(pal[2]), (255, 255, 255)]
    lums = sorted({round(0.3 * r + 0.59 * g + 0.11 * b) for r, g, b, a in im.getdata() if a > 40})
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a <= 40: continue
            l = round(0.3 * r + 0.59 * g + 0.11 * b)
            k = lums.index(l) / max(1, len(lums) - 1)
            idx = 0 if k < 0.12 else 1 if k < 0.4 else 2 if k < 0.72 else 3 if k < 0.95 else 4
            px[x, y] = ramp[idx] + (255,)
    return out

monsters = json.loads(subprocess.run(['node', '-e', JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
# 고른 원본은 tools/orbiter_base/<종족>.png에 둔다(없으면 PixelLab에서 받아 저장한다)
BASE = os.path.join(ROOT, 'tools', 'orbiter_base')
base = {}
for fam, i in PICK.items():
    path = os.path.join(BASE, fam + '.png')
    if not os.path.exists(path):
        os.makedirs(BASE, exist_ok=True)
        fetch(OBJ.format(i)).save(path)
    base[fam] = Image.open(path).convert('RGBA')
for mid, info in monsters.items():
    img = base.get(info['family']) or base['spirit']
    pal = info['palette'] or ['#5a3a6a', '#9a6cff', '#e2b0ff', '#ffffff']
    img = img.crop(img.getchannel('A').getbbox())
    recolor(img, pal).save(os.path.join(ROOT, 'assets', 'sprites', f'orb_{mid}.png'))
print(len(monsters), 'orbiters')
