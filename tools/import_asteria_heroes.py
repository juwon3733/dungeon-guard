# Asteria 모험가 그림을 일반 용사의 생김새로 가져온다. assets/sprites/ast_hero_<이름>/와 js/data/asteria_heroes.js를 만든다.
# 실행: python tools/import_asteria_heroes.py
# 떼로 나올 때 작아 보이도록 줄이고, 그림 1px이 화면 1px(세계 배율 1.5)이 되게 한다.
import json, os, re, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WWW = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www')
OUT = os.path.join(ROOT, 'assets', 'sprites')
HEIGHT = 54  # 몸 높이(화면 px)

SKINS = {
    'warrior': ['guardianKnight', 'guardianKnight_female', 'wildBrawler', 'demolisher'],
    'rogue': ['bladeDancer', 'bladeDancer_female', 'windRanger', 'desperado'],
    'mage': ['arcanist_female', 'thunderSage', 'windSage', 'spiritShaman'],
}

html = open(os.path.join(WWW, 'index.html'), encoding='utf8', errors='replace').read()
i = html.index('var PLAY_ATLAS = '); j = k = html.index('[', i); depth = 0; instr = False
while True:
    c = html[k]
    if instr: instr = c != '"'
    elif c == '"': instr = True
    elif c == '[': depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0: break
    k += 1
atlases = json.loads(re.sub(r'([{,]\s*)([a-zA-Z_]+):', r'\1"\2":', html[j:k + 1]))
INDEX = {}
for a in atlases:
    it = a['items']
    for n in range(0, len(it), 5):
        INDEX[it[n].replace('assets/sprites/', '').replace('.png', '')] = (a['file'], *it[n + 1:n + 5])
cache = {}

def load(name):
    f, x, y, w, h = INDEX[name]
    if f not in cache: cache[f] = Image.open(os.path.join(WWW, f)).convert('RGBA')
    return cache[f].crop((x, y, x + w, y + h))

def alpha_bottom(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    return box

out = {}
for hero, names in SKINS.items():
    out[hero] = []
    for name in names:
        sprite = f'ast_hero_{name}'
        shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
        frames = {'south': [load(f'pcm_walk_adv_{name}_down{n}') for n in range(6)],
                  'east': [load(f'pcm_walk_adv_{name}_left{n}').transpose(Image.FLIP_LEFT_RIGHT) for n in range(6)],
                  'north': [load(f'pcm_walk_adv_{name}_up{n}') for n in range(6)]}
        # 한 방향의 모든 프레임을 같은 비율로 줄여 걸음이 흔들리지 않게 한다
        foot = {}
        for facing, list_ in frames.items():
            box = alpha_bottom(list_[0])
            k2 = HEIGHT / (box[3] - box[1])
            for n, im in enumerate(list_):
                small = im.resize((max(1, round(im.width * k2)), max(1, round(im.height * k2))), Image.LANCZOS)
                d = os.path.join(OUT, sprite, 'animations', 'walking', facing)
                os.makedirs(d, exist_ok=True)
                small.save(os.path.join(d, f'frame_{n:03d}.png'))
                if n == 0: foot[facing] = alpha_bottom(small)[3]
                if n == 0 and facing == 'south':
                    rot = os.path.join(OUT, sprite, 'rotations'); os.makedirs(rot, exist_ok=True)
                    small.save(os.path.join(rot, 'south.png'))
        out[hero].append({'sprite': sprite, 'scale': 1.2, 'anim': {'walk': {'folder': 'walking', 'frames': 6, 'dirs': ['south', 'east', 'north'], 'footPx': foot}}})
    print(hero, len(out[hero]))
with open(os.path.join(ROOT, 'js', 'data', 'asteria_heroes.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_heroes.py가 만든 표다. 일반 용사의 생김새(떼가 복사한 듯 보이지 않게 섞는다).\n')
    f.write('const ASTERIA_HERO_SKINS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
