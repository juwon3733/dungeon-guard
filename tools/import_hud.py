# 전투 UI 재질(쇠와 뼈)과 맵 기믹 그림을 내려받아 assets/sprites/에 저장한다. 실행: python tools/import_hud.py
# PixelLab에서 만든 그림이고, 금화 아이콘만 Asteria 그림이다. 원본 도트를 그대로 쓰고 늘리지 않는다.
import io, os, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'sprites')
UI = 'https://api.pixellab.ai/mcp/ui-assets/{}/download'
OBJ = 'https://backblaze.pixellab.ai/file/pixellab-characters/objects/fd68a04a-60b9-47da-a03f-4fd57e331c5b/04f5afc8-1c1a-4b31-9417-3fe71a1b0f3c/rotations/frame_{}.png'
ASTERIA = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'dungeon-guard-tools'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req).read())).convert('RGBA')

def trim(im):
    return im.crop(im.getchannel('A').getbbox())

def save(im, name):
    im.save(os.path.join(OUT, name + '.png'))
    print(name, im.size)

save(trim(fetch(UI.format('9a9750ab-400e-4570-932a-430173af6f8f'))), 'hud_panel')  # 쇠와 뼈 창(9칸)
save(trim(fetch(UI.format('425b7935-5611-4ef8-9b39-be2b11ec58a7'))), 'hud_bossbar')  # 보스 체력 틀
save(fetch(UI.format('146b0ff6-09ae-4d22-a22a-b2ff6df7ee51')), 'hud_vessel')  # 체력 그릇(256px 캔버스, 가운데가 그릇 중심)
save(trim(fetch(UI.format('aca78022-8652-4d0e-9284-7d2e868a4f01'))), 'hud_slab')  # 소환 석판

# 칸(9칸): 가운데가 밝은 회색이라 어둡게 눌러 글자와 아이콘이 잘 보이게 한다
slot = trim(fetch(UI.format('958b2568-a906-4e98-82be-97836d63e5b0')))
px = slot.load()
for y in range(14, slot.height - 14):
    for x in range(14, slot.width - 14):
        r, g, b, a = px[x, y]
        px[x, y] = (r * 2 // 5, g * 2 // 5, b * 2 // 5, a)
save(slot, 'hud_slot')

save(fetch(OBJ.format(0)), 'decal_altar')  # 강화 제단
save(fetch(OBJ.format(5)), 'decal_cursed')  # 저주받은 땅
save(trim(Image.open(os.path.join(ASTERIA, 'icon_item_gold.png')).convert('RGBA')), 'hud_gold')
