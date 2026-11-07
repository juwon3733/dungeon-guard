# PixelLab에서 88px로 새로 그린 몬스터를 내려받아 assets/sprites/hd_mon_<id>/와 js/data/hd_monster_art.js를 만든다.
# 실행: python tools/import_hd_monsters.py
# 몬스터는 걷지 않으므로 앞모습과 옆모습 한 장씩만 쓰고 숨 쉬기와 내지르기는 코드가 그린다. 그림 1px이 화면 1px(세계 배율 1.5)이다.
import io, json, os, shutil, urllib.request, zipfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'sprites')
IDS = {
    'orc_guard': '325a85f2-37a4-4878-91d4-b87ea0ba3b59', 'skeleton_archer': 'bb570c03-dfd1-4f8d-8f5b-3736048f2ecb',
    'dark_mage': '332757f3-339e-4295-80a4-173c251a5b9c', 'orc_berserker': 'f0383f2b-1304-494a-b285-335b5328858d',
    'goblin_spearman': '2ce1ecca-380f-4d8e-a4e6-a2643e2b353d', 'gnoll_hunter': '2afda31d-959f-4c8a-bc8a-38910a69177b',
    'werewolf': 'ecf813ab-336b-4f0c-a4d9-d5e4ed5e3f74', 'troll': '01855934-acba-4feb-8cfb-56371fc6e98e',
    'nightmare_jester': '292d033a-56fa-4def-b034-579152b141af', 'orc_shaman': '4f677b9a-3ead-4d61-a5c5-a31144c2ce8c',
    'goblin_thrower': 'cc457a35-a356-41cd-a0cd-0ad68c67abe9', 'war_drummer': '1053d397-5cb4-4ae8-8206-fab345ddc18e',
    'ogre_crusher': '93f4a78e-008a-4247-a87e-41b72e27241b', 'succubus': 'c23eb138-397d-4adb-8821-f2f58764647b',
    'minotaur': '14571f08-d4db-47c3-b2f4-ddc9ec95eadc',
}

def trimmed(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())

art = {}
for mid, cid in IDS.items():
    req = urllib.request.Request(f'https://api.pixellab.ai/mcp/characters/{cid}/download', headers={'User-Agent': 'dungeon-guard-assets'})
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=120).read()))
    names = z.namelist()
    def rot(d):
        n = next(x for x in names if x.endswith(f'rotations/{d}.png'))
        return trimmed(Image.open(io.BytesIO(z.read(n))).convert('RGBA'))
    sprite = f'hd_mon_{mid}'
    shutil.rmtree(os.path.join(OUT, sprite), ignore_errors=True)
    foot = {}
    for facing in ('south', 'east'):
        im = rot(facing)
        d = os.path.join(OUT, sprite, 'animations', 'idle', facing)
        os.makedirs(d, exist_ok=True)
        im.save(os.path.join(d, 'frame_000.png'))
        foot[facing] = im.height
    south = rot('south')
    os.makedirs(os.path.join(OUT, sprite, 'rotations'), exist_ok=True)
    south.save(os.path.join(OUT, sprite, 'rotations', 'south.png'))
    clip = {'folder': 'idle', 'frames': 1, 'dirs': ['south', 'east'], 'footPx': foot}
    art[mid] = {'sprite': sprite, 'cells': [1, 1], 'height': south.height, 'width': south.width, 'still': True, 'anim': {'idle': clip, 'attack': clip}}
    print(mid, south.size)
with open(os.path.join(ROOT, 'js', 'data', 'hd_monster_art.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// tools/import_hd_monsters.py가 만든 표다. 고치지 말고 스크립트를 다시 실행한다.\n')
    f.write('const HD_MONSTER_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n')
