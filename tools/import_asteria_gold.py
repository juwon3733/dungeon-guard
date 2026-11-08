# 처치 골드 그림을 Asteria에서 가져온다.
# 실행: python tools/import_asteria_gold.py
#   assets/sprites/ast_coin.png: 금화 더미 아이콘(icon_item_gold)에서 오른쪽 아래 금화 한 닢(테두리 포함)을 잘라 낸다
#   assets/fx/pfx_coin_blast.png: 해적 선장 스킬의 동전 폭발(128px 8프레임, 검은 바탕이라 빛을 더해 그린다. 연기는 지운다)
# 원본은 이름만 .png인 WebP가 섞여 있어 PNG로 다시 저장한다. 크기는 바꾸지 않는다(그림 1px = 화면 1px)
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LZ = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')
COIN_BOX = (34, 24, 52, 41)  # icon_item_gold 안의 금화 한 닢 둘레
COIN_ELLIPSE = (9.5, 9, 8.6, 5.8)  # 그 안에서 금화만 남기는 타원(가운데 x, y, 가로, 세로 반지름). 옆 금화 조각을 지운다
OUTLINE = (26, 12, 4, 255)

pile = Image.open(os.path.join(LZ, 'icon_item_gold.png')).convert('RGBA')
coin = pile.crop(COIN_BOX)
cx, cy, rx, ry = COIN_ELLIPSE
px = coin.load()
for y in range(coin.height):
    for x in range(coin.width):
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1: px[x, y] = (0, 0, 0, 0)
# 옆 금화와 붙어 있던 쪽은 테두리가 없으므로 빈 칸에 진한 테두리를 두른다
edge = [(x, y) for y in range(coin.height) for x in range(coin.width) if px[x, y][3] < 40 and any(
    0 <= x + dx < coin.width and 0 <= y + dy < coin.height and px[x + dx, y + dy][3] >= 40 and max(px[x + dx, y + dy][:3]) >= 70
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for x, y in edge: px[x, y] = OUTLINE
coin = coin.crop(coin.getchannel('A').getbbox())
coin.save(os.path.join(ROOT, 'assets', 'sprites', 'ast_coin.png'))
# 동전 폭발: 회색 연기와 흰 섬광은 빛을 더하면 하얀 덩어리가 되므로 지우고 금화와 불꽃(채도가 높은 색)만 남긴다
blast = Image.open(os.path.join(LZ, 'fx_cos_pirateCaptain_coinBlast.png')).convert('RGB')
bp = blast.load()
for y in range(blast.height):
    for x in range(blast.width):
        r, g, b = bp[x, y]
        hi = max(r, g, b)
        if hi == 0 or (hi - min(r, g, b)) / hi < 0.45: bp[x, y] = (0, 0, 0)
blast.save(os.path.join(ROOT, 'assets', 'fx', 'pfx_coin_blast.png'), optimize=True)
print('coin', coin.size)
