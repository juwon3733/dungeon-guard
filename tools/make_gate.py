# 용사 입구 문: PixelLab Pro 그림(문 안에 소용돌이가 그려진 한 장)을 돌 테와 소용돌이 두 겹으로 나누고,
# 소용돌이를 가운데 기준으로 돌린 프레임을 만든다(가까운 픽셀로 돌려 도트가 번지지 않는다).
# 실행: python tools/make_gate.py <원본 png>
# 결과: assets/sprites/gate_arch.png(문 안쪽이 투명한 테), assets/sprites/gate_vortex.png(16프레임 가로 한 줄)
import math, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FRAMES = 16
src = Image.open(sys.argv[1]).convert('RGBA')
W, H = src.size
px = src.load()

def stone(p):
    # 돌 테: 채도가 낮은 회색(소용돌이는 보라·분홍·남색으로 채도가 높다)
    r, g, b, a = p
    return a < 10 or (max(r, g, b) - min(r, g, b) < 28 and b < 140)

# 문 안쪽: 가운데 줄에서 좌우로 돌을 만날 때까지(줄마다)
cx = W // 2
rows = {}
for y in range(H):
    if stone(px[cx, y]):
        continue
    l = cx
    while l > 0 and not stone(px[l - 1, y]):
        l -= 1
    r = cx
    while r < W - 1 and not stone(px[r + 1, y]):
        r += 1
    rows[y] = (l, r)
ys = sorted(rows)
# 가운데 줄에서 끊기지 않은 가장 긴 구간만(위 장식의 작은 보라 점은 뺀다)
runs, cur = [], [ys[0]]
for y in ys[1:]:
    if y == cur[-1] + 1:
        cur.append(y)
    else:
        runs.append(cur); cur = [y]
runs.append(cur)
open_rows = max(runs, key=len)
y0, y1 = open_rows[0], open_rows[-1]
inside = {(x, y) for y in open_rows for x in range(rows[y][0], rows[y][1] + 1)}
print('opening y', y0, y1, 'x', min(x for x, _ in inside), max(x for x, _ in inside))

# 테: 문 안쪽을 비운다
arch = src.copy()
ap = arch.load()
for (x, y) in inside:
    ap[x, y] = (0, 0, 0, 0)
arch.save(os.path.join(ROOT, 'assets', 'sprites', 'gate_arch.png'))

# 소용돌이 중심: 가장 밝은 2% 픽셀의 가운데(소용돌이 눈)
top = sorted(inside, key=lambda q: -sum(px[q[0], q[1]][:3]))[:max(8, len(inside) // 50)]
ox = round(sum(x for x, _ in top) / len(top))
oy = round(sum(y for _, y in top) / len(top))
print('eye', ox, oy)

# 원 안쪽만 돌린다: 문 안에 다 들어가는 원(반지름 R) 안은 돌린 픽셀, 바깥은 원래 그림.
# 경계(R-4 ~ R+4)는 체크무늬로 섞어 이음매가 보이지 않게 한다
R = min(math.hypot(x - ox, y - oy) for x in range(W) for y in range(H) if (x, y) not in inside and abs(x - ox) < 60 and abs(y - oy) < 90) - 1
print('disk', round(R, 1))
sheet = Image.new('RGBA', (W * FRAMES, H), (0, 0, 0, 0))
for f in range(FRAMES):
    ang = f / FRAMES * math.tau
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fp = fr.load()
    for (x, y) in inside:
        dx, dy = x - ox, y - oy
        r = math.hypot(dx, dy)
        th = math.atan2(dy, dx) - ang
        sx, sy = round(ox + r * math.cos(th)), round(oy + r * math.sin(th))
        rotated = px[sx, sy] if (sx, sy) in inside else px[x, y]
        if r < R - 4:
            fp[x, y] = rotated
        elif r < R + 4:
            # 경계: 바깥으로 갈수록 원래 픽셀이 많아지는 체크무늬
            t = (r - (R - 4)) / 8
            fp[x, y] = px[x, y] if ((x * 7 + y * 13) % 8) / 8 < t else rotated
        else:
            fp[x, y] = px[x, y]
    sheet.alpha_composite(fr, (W * f, 0))
sheet.save(os.path.join(ROOT, 'assets', 'sprites', 'gate_vortex.png'))
print('frames', FRAMES, 'size', W, H)
