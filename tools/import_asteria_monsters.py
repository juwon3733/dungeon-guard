# Asteria 빌드에서 몬스터 그림을 가져와 assets/sprites/ast_mon_<id>/에 PixelLab과 같은 폴더 구조로 저장하고
# js/data/asteria_art.js(프레임 수, 발끝, 크기)를 만든다. 실행: python tools/import_asteria_monsters.py
# 그림 1px이 화면 1px이 되도록(세계 배율 1.5) 칸 크기에 맞춰 미리 줄인다. 원본보다 키우지는 않는다.
import json, os, re, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WWW = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www')
LZ = os.path.join(WWW, 'lz')
OUT = os.path.join(ROOT, 'assets', 'sprites')
CELL = 64  # 칸 하나의 화면 px

# id: (원본, 칸 가로, 칸 세로)
#   e:이름 일반 몹(enemy_ 앞/옆, anim_ 걷기/공격) / b:이름 보스 그림(boss_ 앞, 있으면 옆/기술)
ART = {
    # 언데드
    'zombie': ('e:drownedPirate', 1, 1), 'grave_keeper': ('e:lanternWraith', 1, 1),
    'curse_shooter': ('e:pirateGunner', 1, 1), 'wraith_swordsman': ('e:shadowKnight', 1, 1), 'plague_ghoul': ('e:mistWraith', 1, 1),
    'bone_knight': ('b:mid_riftKnight', 2, 2), 'vampire': ('b:mid_vampireCount', 2, 2), 'bone_priest': ('b:bog_witch', 1, 2),
    'death_lord': ('b:fallen_knight', 2, 3), 'archlich': ('b:abyssJailer', 2, 3),
    # 오크(맞는 그림만)
    'orc_charger': ('a:boarWarrior', 1, 1), 'orc_high_chief': ('b:mid_boarWarlord', 3, 2), 'giant_king': ('b:fb_ashSmith', 3, 3),
    # 악마
    'fire_imp': ('e:fireImp', 1, 1), 'hellhound_warrior': ('e:lavaHound', 1, 1), 'flame_archer': ('e:emberKnight', 1, 1),
    'flame_demon': ('b:mid_infernalSmith', 2, 2), 'executioner': ('b:mid_shadowReaper', 2, 2), 'chaos_mage': ('b:abyssMirror', 1, 2),
    'hell_general': ('b:flame_lord', 3, 3), 'fallen_angel': ('b:eclipsa', 2, 3),
    # 야수
    'boar_warrior': ('e:rusher', 1, 1), 'spider_archer': ('e:gemBeetle', 1, 1), 'bear_warrior': ('e:yeti', 1, 1), 'eagle_hunter': ('e:featherArcher', 1, 1),
    'saber_warrior': ('e:crownLion', 2, 1), 'hydra_warrior': ('b:mid_bogHydra', 2, 2), 'earth_behemoth': ('b:thorn_king', 3, 2), 'phoenix_lord': ('b:mid_phoenix', 3, 2),
    # 정령
    'wisp_acolyte': ('e:frostWisp', 1, 1), 'rock_spirit': ('e:mudGolem', 1, 1), 'wind_sylph': ('e:gustSprite', 1, 1),
    'frost_witch': ('e:snowShaman', 1, 1), 'water_spirit': ('e:tideSkipper', 1, 1), 'lightning_spirit': ('e:voidOrb', 1, 1),
    'ancient_treant': ('b:mid_elderTreant', 2, 2), 'moon_priestess': ('e:moonPriestess', 1, 1), 'storm_archer': ('b:storm_griffin', 2, 2),
    'element_sage': ('b:fateGod', 2, 3), 'crystal_giant': ('b:crystal_colossus', 3, 3),
    # 신화
    'abyss_dragon_king': ('b:abyss_wyrm', 3, 3), 'time_witch': ('b:chronos', 2, 3), 'soul_devourer': ('b:abyssDevourer', 3, 2),
    'bone_dragon': ('b:mid_boneDragon', 3, 3), 'kraken': ('b:mid_kraken', 3, 3), 'frost_queen': ('b:mid_frostQueen', 2, 3),
    'star_whale': ('b:mid_starWhale', 3, 2), 'frost_drake': ('b:frost_drake', 3, 2),
    # 히든 신화
    'sun_god': ('b:sunGod', 2, 3), 'moon_god': ('b:moonGod', 3, 3), 'death_god': ('b:deathGod', 2, 3), 'god_king': ('b:godKing', 3, 3),
}
RANGED = {'curse_shooter', 'bone_priest', 'vampire', 'archlich', 'fire_imp', 'chaos_mage', 'fallen_angel', 'spider_archer', 'eagle_hunter', 'hydra_warrior',
          'phoenix_lord', 'wisp_acolyte', 'wind_sylph', 'frost_witch', 'water_spirit', 'lightning_spirit', 'moon_priestess', 'storm_archer', 'element_sage',
          'time_witch', 'abyss_dragon_king', 'soul_devourer', 'bone_dragon', 'frost_queen', 'star_whale', 'frost_drake', 'sun_god', 'moon_god'}

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
    p = os.path.join(LZ, name + '.png')
    if os.path.exists(p): return Image.open(p).convert('RGBA')
    if name not in INDEX: return None
    f, x, y, w, h = INDEX[name]
    if f not in cache: cache[f] = Image.open(os.path.join(WWW, f)).convert('RGBA')
    return cache[f].crop((x, y, x + w, y + h))

def trimmed(im):
    box = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    return im.crop(box)

def fit(im, w_cells, h_cells):
    # 가로는 칸 너비의 1.25배, 세로는 칸 높이에 머리 위 여유를 둔다
    box_w = w_cells * CELL * 1.25
    box_h = h_cells * CELL + 40
    k = min(1.5 if w_cells * h_cells >= 4 else 1, box_w / im.width, box_h / im.height)
    if k == 1: return im
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS if k < 1 else Image.NEAREST)

def save(im, sprite, folder, facing, i):
    d = os.path.join(OUT, sprite, 'animations', folder, facing)
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'frame_{i:03d}.png'))

def clip_of(sprite, folder, frames_by_dir, w, h):
    # frames_by_dir: { facing: [그림...] }. 같은 동작은 첫 프레임으로 크기를 정해 발끝을 맞춘다
    foot = {}
    for facing, frames in frames_by_dir.items():
        for n, im in enumerate(frames):
            out = fit(trimmed(im), w, h)
            save(out, sprite, folder, facing, n)
            if n == 0: foot[facing] = out.height
    return {'folder': folder, 'frames': len(next(iter(frames_by_dir.values()))), 'dirs': list(frames_by_dir), 'footPx': foot}

def flip(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

art = {}
for mid, (src, w, h) in ART.items():
    kind, name = src.split(':')
    sprite = f'ast_mon_{mid}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    if kind == 'b':
        front = load(f'boss_{name}_down')
        side = load(f'boss_{name}_left')
        poses = [load(f'boss_{name}_{p}') for p in (('windup', 'cast') if mid in RANGED else ('windup', 'slam'))]
        walk = None
    else:
        pre = 'enemy' if kind == 'e' else 'pet'
        pname = name if kind == 'e' else name + '_evo'
        front = load(f'{pre}_{pname}_down')
        side = load(f'{pre}_{pname}_left')
        at = load(f'anim_{name}_attack')
        poses = [at] if at else [None]
        w0, w1 = load(f'anim_{name}_walk0'), load(f'anim_{name}_walk1')
        walk = [w0, w1] if w0 and w1 else None
    assert front is not None, mid
    idle = {'south': [front]}
    if side is not None: idle['east'] = [flip(side)]
    anim = {'idle': clip_of(sprite, 'idle', idle, w, h)}
    poses = [p for p in poses if p is not None]
    # 앞모습 그림은 머리 쪽 여유가 달라 공격 그림이 없으면 한 장을 쓰고 코드가 앞으로 내지른다
    still = not poses
    if poses:
        anim['attack'] = clip_of(sprite, 'attack', {'east': [flip(p) for p in poses]}, w, h)
    else:
        anim['attack'] = anim['idle']
    if walk:
        anim['walk'] = clip_of(sprite, 'walking', {'east': [flip(p) for p in walk]}, w, h)
    rot = os.path.join(OUT, sprite, 'rotations'); os.makedirs(rot, exist_ok=True)
    first = fit(trimmed(front), w, h)
    first.save(os.path.join(rot, 'south.png'))
    art[mid] = {'sprite': sprite, 'cells': [w, h], 'height': first.height, 'width': first.width, 'still': still, 'anim': anim}
    print(mid, src, f'{w}x{h}', first.size, 'poses', len(poses), 'walk', bool(walk))

with open(os.path.join(ROOT, 'js', 'data', 'asteria_art.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_monsters.py가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.\n')
    f.write('// sprite 폴더, 칸 크기(cells), 그림 크기, still(공격 그림 없음), 동작(anim)\n')
    f.write('const ASTERIA_ART = ' + json.dumps(art, ensure_ascii=False, indent=0, separators=(',', ':')).replace('\n', '') + ';\n')
print('total', len(art))
