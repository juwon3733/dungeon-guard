# Asteria 보스 그림을 주간 토벌전 보스로 가져온다. assets/sprites/ast_boss_<id>/와 js/data/asteria_bosses.js를 만든다.
# 실행: python tools/import_asteria_bosses.py
# 그림 1px이 화면 1px이다. 프레임이 적어 걸을 때는 코드가 흔든다(Render.drawArtBoss).
import json, os, shutil
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LZ = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')
OUT = os.path.join(ROOT, 'assets', 'sprites')
HEIGHT = 262  # 화면 px
# 이야기 보스(용사단): (Asteria 이름, 화면 높이, 공격 자세). 원본보다 키우지 않는다
STORY = {'story_captain': ('fb_haloWarden', 224, ('windup', 'slam')), 'story_archmage': ('requia', 240, ('windup', 'cast'))}
BOSSES = {'war_avatar': 'warGod', 'sea_king': 'tideGod', 'judge': 'judgeGod', 'gatekeeper': 'gateGod', 'golden_boar': 'golden_boar', 'star_herald': 'starGod'}

def load(name):
    p = os.path.join(LZ, f'boss_{name}.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA')
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())

def fit(im, height=HEIGHT):
    k = min(height / im.height, 1) if height != HEIGHT else height / im.height
    return im.resize((max(1, round(im.width * k)), round(im.height * k)), Image.LANCZOS if k < 1 else Image.NEAREST)

def save(im, sprite, folder, facing, n):
    d = os.path.join(OUT, sprite, 'animations', folder, facing)
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'frame_{n:03d}.png'))

art = {}
JOBS = [(bid, src, HEIGHT, ('windup', 'slam')) for bid, src in BOSSES.items()] + [(bid, *v) for bid, v in STORY.items()]
for bid, src, height, acts in JOBS:
    sprite = f'ast_boss_{bid}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    front = fit(load(f'{src}_down'), height)
    side = load(f'{src}_left')
    # 옆모습은 앞모습과 같은 키로 맞춘다(원본마다 배율이 다르다)
    side = fit(side, front.height).transpose(Image.FLIP_LEFT_RIGHT) if side else front
    save(front, sprite, 'walking', 'south', 0)
    save(side, sprite, 'walking', 'east', 0)
    poses = [load(f'{src}_{p}') for p in acts]
    poses = [fit(p, front.height).transpose(Image.FLIP_LEFT_RIGHT) for p in poses if p]
    if not poses: poses = [side]
    for n, p in enumerate(poses): save(p, sprite, 'attack', 'east', n)
    os.makedirs(os.path.join(OUT, sprite, 'rotations'), exist_ok=True)
    front.save(os.path.join(OUT, sprite, 'rotations', 'south.png'))
    # 초상: 머리 쪽 정사각형
    size = min(front.width, front.height // 2)
    HEIGHT_OF = front.height
    art[bid] = {'sprite': sprite, 'scale': 1.2, 'height': HEIGHT_OF, 'crop': [max(0, (front.width - size) // 2), 0, size],
                'anim': {'walk': {'folder': 'walking', 'frames': 1, 'dirs': ['south', 'east'], 'footPx': {'south': HEIGHT_OF, 'east': side.height}},
                         'attack': {'folder': 'attack', 'frames': len(poses), 'dirs': ['east'], 'footPx': {'east': poses[0].height if poses else HEIGHT_OF}}}}
    print(bid, front.size, len(poses))
with open(os.path.join(ROOT, 'js', 'data', 'asteria_bosses.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_asteria_bosses.py가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.\n')
    f.write('const ASTERIA_BOSS_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n')
