# 조합 장비의 그림을 Asteria 세트 아이콘에서 가져와 assets/sprites/equip_<id>.png(48px)로 저장한다. 실행: python tools/import_equip_icons.py
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LZ = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')
SIZE = 48
ICONS = sorted(f for f in os.listdir(LZ) if f.startswith('icon_set_') and f.endswith('.png'))
ART = {'frostArmor': 31, 'stormBoots': 50, 'moonCharm': 12, 'hunterHelm': 53, 'windBoots': 2, 'sageOrb': 3,
       'curseGlove': 46, 'goldHelm': 41, 'fireCrown': 27, 'bloodPlate': 55, 'boarBoots': 38}
for eid, i in ART.items():
    im = Image.open(os.path.join(LZ, ICONS[i])).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    k = min(SIZE / im.width, SIZE / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(small, ((SIZE - small.width) // 2, (SIZE - small.height) // 2), small)
    out.save(os.path.join(ROOT, 'assets', 'sprites', f'equip_{eid}.png'))
    print(eid, ICONS[i])
