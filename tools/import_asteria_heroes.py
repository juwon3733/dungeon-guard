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

# 정예: Asteria 모험가(걷기와 공격 동작이 있는 것)를 원본 크기로 쓴다(그림 1px = 화면 1px). 일반 용사보다 조금 크다
ELITE_SKINS = {
    'elite_swordsman': ('adv_nightExecutioner', 'atk'), 'elite_tamer': ('adv_mistBlade', 'atk'),
    'elite_stormcaller': ('adv_twilightSage_sol', 'cast'), 'elite_rhapsodist': ('adv_eclipseArchsage_luna', 'cast'),
}
DIRS = {'south': 'down', 'east': 'left', 'north': 'up'}
elites = {}
for etype, (name, act) in ELITE_SKINS.items():
    sprite = f'ast_elite_{name}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    anim = {}
    for clip, folder, frames in (('walk', 'walking', [f'pcm_walk_{name}_{{d}}{n}' for n in range(6)]), ('attack', 'attack', [f'pcm_act_{name}_{{d}}_{act}{n}' for n in range(2)])):
        foot = {}
        for facing, d in DIRS.items():
            for n, pattern in enumerate(frames):
                im = load(pattern.format(d=d))
                if facing == 'east': im = im.transpose(Image.FLIP_LEFT_RIGHT)
                dd = os.path.join(OUT, sprite, 'animations', folder, facing)
                os.makedirs(dd, exist_ok=True)
                im.save(os.path.join(dd, f'frame_{n:03d}.png'))
                if n == 0: foot[facing] = alpha_bottom(im)[3]
                if clip == 'walk' and n == 0 and facing == 'south':
                    rot = os.path.join(OUT, sprite, 'rotations'); os.makedirs(rot, exist_ok=True)
                    im.save(os.path.join(rot, 'south.png'))
        anim[clip] = {'folder': folder, 'frames': len(frames), 'dirs': list(DIRS), 'footPx': foot}
    elites[etype] = {'sprite': sprite, 'scale': 1.2, 'barY': 96, 'anim': anim}
    print(etype, name)
with open(os.path.join(ROOT, 'js', 'data', 'asteria_heroes.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_heroes.py가 만든 표다. 일반 용사의 생김새(떼가 복사한 듯 보이지 않게 섞는다).\n')
    f.write('const ASTERIA_HERO_SKINS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('// 정예 용사의 그림. balance.js의 HEROES에 덮어쓴다(쓰러지는 동작은 없어 걷기 그림으로 쓰러진다)\n')
    f.write('const ASTERIA_ELITE_ART = ' + json.dumps(elites, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('for (const [type, a] of Object.entries(ASTERIA_ELITE_ART)) if (HEROES[type]) Object.assign(HEROES[type], { sprite: a.sprite, scale: a.scale, barY: a.barY, anim: a.anim });\n')

# 정예 오라: Asteria 모험가의 회전 오라(128px 8프레임)를 그대로 옮긴다. assets/fx/pfx_aura_<이름>.png, 표는 js/data/fx_sheets.js의 fx_aura_<정예>
ELITE_AURA = {'elite_swordsman': 'nightExecutioner', 'elite_tamer': 'mistBlade', 'elite_stormcaller': 'thunderSage', 'elite_rhapsodist': 'sunMoonDance'}
for etype, name in ELITE_AURA.items():
    # 원본은 이름만 .png인 WebP(검은 바탕)라 PNG로 다시 저장한다. 게임은 빛을 더해(lighter) 그려 검은 바탕을 지운다
    Image.open(os.path.join(WWW, 'lz', f'fx_aura_{name}.png')).convert('RGB').save(os.path.join(ROOT, 'assets', 'fx', f'pfx_aura_{name}.png'), optimize=True)
print('auras', len(ELITE_AURA))
