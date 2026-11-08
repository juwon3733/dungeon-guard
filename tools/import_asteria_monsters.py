# Asteria 빌드에서 몬스터 그림을 가져와 assets/sprites/ast_mon_<id>/에 PixelLab과 같은 폴더 구조로 저장하고
# js/data/asteria_art.js(프레임 수, 발끝, 크기)를 만든다. 실행: python tools/import_asteria_monsters.py
# 그림 1px이 화면 1px이 되도록 칸 크기에 맞춰 미리 줄인다. 원본보다 키우지는 않는다.
import json, os, re, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WWW = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www')
LZ = os.path.join(WWW, 'lz')
OUT = os.path.join(ROOT, 'assets', 'sprites')
CELL = 80  # 칸 하나의 화면 px

# id: (원본, 칸 가로, 칸 세로)
#   e:이름 일반 몹(enemy_ 앞/옆, anim_ 걷기/공격) / b:이름 보스 그림(boss_ 앞, 있으면 옆/기술)
ART = {
    # 언데드
    'zombie': ('e:drownedPirate', 1, 1), 'grave_keeper': ('e:lanternWraith', 1, 1),
    'curse_shooter': ('e:pirateGunner', 1, 1), 'wraith_swordsman': ('e:shadowKnight', 1, 1), 'plague_ghoul': ('e:mistWraith', 1, 1),
    'bone_knight': ('b:mid_riftKnight', 1, 1), 'vampire': ('b:mid_vampireCount', 1, 1), 'bone_priest': ('b:bog_witch', 1, 2),
    'death_lord': ('b:fallen_knight', 2, 3), 'archlich': ('b:abyssJailer', 2, 3),
    # 오크(맞는 그림만)
    'orc_charger': ('a:boarWarrior', 1, 1), 'orc_high_chief': ('b:mid_boarWarlord', 3, 2), 'giant_king': ('b:fb_ashSmith', 3, 3),
    # 악마
    'fire_imp': ('e:fireImp', 1, 1), 'hellhound_warrior': ('e:lavaHound', 1, 1), 'flame_archer': ('e:emberKnight', 1, 1),
    'flame_demon': ('b:mid_infernalSmith', 1, 1), 'executioner': ('b:mid_shadowReaper', 1, 1), 'chaos_mage': ('b:abyssMirror', 1, 2),
    'hell_general': ('b:flame_lord', 3, 3), 'fallen_angel': ('b:eclipsa', 2, 3),
    # 야수
    'boar_warrior': ('e:rusher', 1, 1), 'spider_archer': ('e:gemBeetle', 1, 1), 'bear_warrior': ('e:yeti', 1, 1), 'eagle_hunter': ('e:featherArcher', 1, 1),
    'saber_warrior': ('e:crownLion', 2, 1), 'hydra_warrior': ('b:mid_bogHydra', 1, 1), 'earth_behemoth': ('b:thorn_king', 3, 2), 'phoenix_lord': ('b:mid_phoenix', 3, 2),
    # 정령
    'wisp_acolyte': ('e:frostWisp', 1, 1), 'rock_spirit': ('e:mudGolem', 1, 1), 'wind_sylph': ('e:gustSprite', 1, 1),
    'frost_witch': ('e:snowShaman', 1, 1), 'water_spirit': ('e:tideSkipper', 1, 1), 'lightning_spirit': ('e:voidOrb', 1, 1),
    'ancient_treant': ('b:mid_elderTreant', 1, 1), 'moon_priestess': ('e:moonPriestess', 1, 1), 'storm_archer': ('b:storm_griffin', 1, 1),
    'element_sage': ('b:fateGod', 2, 3), 'crystal_giant': ('b:crystal_colossus', 3, 3),
    # 신화
    'abyss_dragon_king': ('b:abyss_wyrm', 3, 3), 'time_witch': ('b:chronos', 2, 3), 'soul_devourer': ('b:abyssDevourer', 3, 2),
    'bone_dragon': ('b:mid_boneDragon', 3, 3), 'kraken': ('b:mid_kraken', 3, 3), 'frost_queen': ('b:mid_frostQueen', 2, 3),
    'star_whale': ('b:mid_starWhale', 3, 2), 'frost_drake': ('b:frost_drake', 3, 2),
    # 히든 신화
    'sun_god': ('b:sunGod', 2, 3), 'moon_god': ('b:moonGod', 3, 3), 'death_god': ('b:deathGod', 2, 3), 'god_king': ('b:godKing', 3, 3),
}
# 1칸을 차지하지만 일반보다 조금 크게 그리는 영웅(화면 px)
EPIC_BOX = {k: 140 for k in ('bone_knight', 'vampire', 'flame_demon', 'executioner', 'hydra_warrior', 'ancient_treant', 'storm_archer')}
current = None
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

def fit_k(im, w_cells, h_cells):
    # 가로는 칸 너비의 1.25배, 세로는 칸 높이에 머리 위 여유를 둔다
    box_w = w_cells * CELL * 1.25
    box_h = h_cells * CELL + 50
    if current in EPIC_BOX: box_w = box_h = EPIC_BOX[current]  # 1칸 영웅: 일반보다 조금 크게
    return min(1.5 if w_cells * h_cells >= 4 else 1, box_w / im.width, box_h / im.height)

def scaled(im, k):
    if k == 1: return im
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS if k < 1 else Image.NEAREST)

def save(im, sprite, folder, facing, i):
    d = os.path.join(OUT, sprite, 'animations', folder, facing)
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'frame_{i:03d}.png'))

def clip_of(sprite, folder, frames_by_dir, k):
    # frames_by_dir: { facing: [그림...] }. 한 몬스터의 모든 그림은 같은 배율 k로 줄인다(자세가 바뀔 때 몸 크기가 튀지 않게)
    foot = {}
    for facing, frames in frames_by_dir.items():
        for n, im in enumerate(frames):
            out = scaled(trimmed(im), k)
            save(out, sprite, folder, facing, n)
            if n == 0: foot[facing] = out.height
    return {'folder': folder, 'frames': len(next(iter(frames_by_dir.values()))), 'dirs': list(frames_by_dir), 'footPx': foot}

def flip(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)

# PixelLab으로 대기 그림에서 만든 공격 프레임(tools/attack_frames/<id>/frame_1..8.png, 캔버스 안 자리와 배율은 meta.json).
# 있으면 그 8장을 공격 동작으로 쓴다. 256px을 넘는 큰 그림은 줄여서 만들었으므로 원래 배율로 되돌린다
ATTACK_SRC = os.path.join(ROOT, 'tools', 'attack_frames')
ATTACK_META = json.load(open(os.path.join(ATTACK_SRC, 'meta.json'), encoding='utf8')) if os.path.exists(os.path.join(ATTACK_SRC, 'meta.json')) else {}

def attack_clip(mid, sprite):
    am = ATTACK_META[mid]
    inv = 1 / am['k']
    n = 0
    for i in range(1, 9):
        path = os.path.join(ATTACK_SRC, mid, f'frame_{i}.png')
        if not os.path.exists(path): break
        im = Image.open(path).convert('RGBA')
        if am['k'] < 1: im = im.resize((round(im.width * inv), round(im.height * inv)), Image.NEAREST)
        save(im, sprite, 'attack', am['facing'], n)
        n += 1
    foot = round((am['y0'] + am['h']) * inv)  # 캔버스 안 발끝(대기 그림을 놓은 자리의 아래)
    return {'folder': 'attack', 'frames': n, 'dirs': [am['facing']], 'footPx': {am['facing']: foot}}

art = {}
for mid, (src, w, h) in ART.items():
    current = mid
    kind, name = src.split(':')
    sprite = f'ast_mon_{mid}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    if kind == 'b':
        # 보스 그림은 정면만 해상도가 높고 옆모습과 기술 자세(windup, slam)는 절반 남짓한 다른 그림이다.
        # 섞으면 자세가 바뀔 때 몸 크기가 절반으로 튀므로 정면 한 장만 쓰고 공격은 코드 동작으로 한다
        front = load(f'boss_{name}_down')
        side = None
        poses = []
        walk = None
    else:
        pre = 'enemy' if kind == 'e' else 'pet'
        pname = name if kind == 'e' else name + '_evo'
        front = load(f'{pre}_{pname}_down')
        side = load(f'{pre}_{pname}_left')
        # 일반 적의 공격·걷기 그림(anim_)은 해상도가 낮은 작은 그림이라 대기 그림과 크기가 맞지 않는다(키 45px 대 75px).
        # 쓰지 않고, 큰 옆모습 한 장에 코드가 돌진·반동 동작을 준다(Render.monsterPose)
        poses = []
        walk = None
    assert front is not None, mid
    idle = {'south': [front]}
    if side is not None: idle['east'] = [flip(side)]
    k = fit_k(trimmed(front), w, h)  # 정면 그림으로 정한 배율 하나를 옆모습과 공격 그림에도 쓴다
    anim = {'idle': clip_of(sprite, 'idle', idle, k)}
    poses = [p for p in poses if p is not None]
    # 앞모습 그림은 머리 쪽 여유가 달라 공격 그림이 없으면 한 장을 쓰고 코드가 앞으로 내지른다
    still = not poses
    if poses:
        anim['attack'] = clip_of(sprite, 'attack', {'east': [flip(p) for p in poses]}, k)
    else:
        anim['attack'] = anim['idle']
    if walk:
        anim['walk'] = clip_of(sprite, 'walking', {'east': [flip(p) for p in walk]}, k)
    if mid in ATTACK_META:
        anim['attack'] = attack_clip(mid, sprite)
        still = False
    rot = os.path.join(OUT, sprite, 'rotations'); os.makedirs(rot, exist_ok=True)
    first = scaled(trimmed(front), k)
    first.save(os.path.join(rot, 'south.png'))
    art[mid] = {'sprite': sprite, 'cells': [w, h], 'height': first.height, 'width': first.width, 'still': still, 'anim': anim}
    print(mid, src, f'{w}x{h}', first.size, 'poses', len(poses), 'walk', bool(walk))

with open(os.path.join(ROOT, 'js', 'data', 'asteria_art.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_monsters.py가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.\n')
    f.write('// sprite 폴더, 칸 크기(cells), 그림 크기, still(공격 그림 없음), 동작(anim)\n')
    f.write('const ASTERIA_ART = ' + json.dumps(art, ensure_ascii=False, indent=0, separators=(',', ':')).replace('\n', '') + ';\n')
print('total', len(art))
