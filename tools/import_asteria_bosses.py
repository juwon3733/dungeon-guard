# Asteria 보스 그림을 주간 토벌전 보스로 가져온다. assets/sprites/ast_boss_<id>/와 js/data/asteria_bosses.js를 만든다.
# 실행: python tools/import_asteria_bosses.py
# 그림 1px이 화면 1px(세계 배율 1.5)이다. 프레임이 적어 걸을 때는 코드가 흔든다(Render.drawArtBoss).
import json, os, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LZ = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')
OUT = os.path.join(ROOT, 'assets', 'sprites')
HEIGHT = 210  # 화면 px
BOSSES = {'war_avatar': 'warGod', 'sea_king': 'tideGod', 'judge': 'judgeGod', 'gatekeeper': 'gateGod', 'golden_boar': 'golden_boar', 'star_herald': 'starGod'}

def load(name):
    p = os.path.join(LZ, f'boss_{name}.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())

def fit(im):
    k = HEIGHT / im.height
    return im.resize((max(1, round(im.width * k)), HEIGHT), Image.LANCZOS if k < 1 else Image.NEAREST)

def save(im, sprite, folder, facing, n):
    d = os.path.join(OUT, sprite, 'animations', folder, facing)
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'frame_{n:03d}.png'))

art = {}
for bid, src in BOSSES.items():
    sprite = f'ast_boss_{bid}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    front = fit(load(f'{src}_down'))
    side = load(f'{src}_left')
    side = fit(side).transpose(Image.FLIP_LEFT_RIGHT) if side else front
    save(front, sprite, 'walking', 'south', 0)
    save(side, sprite, 'walking', 'east', 0)
    poses = [load(f'{src}_{p}') for p in ('windup', 'slam')]
    poses = [fit(p).transpose(Image.FLIP_LEFT_RIGHT) for p in poses if p]
    if not poses: poses = [side]
    for n, p in enumerate(poses): save(p, sprite, 'attack', 'east', n)
    os.makedirs(os.path.join(OUT, sprite, 'rotations'), exist_ok=True)
    front.save(os.path.join(OUT, sprite, 'rotations', 'south.png'))
    # 초상: 머리 쪽 정사각형
    size = min(front.width, front.height // 2)
    art[bid] = {'sprite': sprite, 'scale': 1.5, 'height': HEIGHT, 'crop': [max(0, (front.width - size) // 2), 0, size],
                'anim': {'walk': {'folder': 'walking', 'frames': 1, 'dirs': ['south', 'east'], 'footPx': {'south': HEIGHT, 'east': HEIGHT}},
                         'attack': {'folder': 'attack', 'frames': len(poses), 'dirs': ['east'], 'footPx': {'east': HEIGHT}}}}
    print(bid, front.size, len(poses))
with open(os.path.join(ROOT, 'js', 'data', 'asteria_bosses.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_bosses.py가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.\n')
    f.write('const ASTERIA_BOSS_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n')
