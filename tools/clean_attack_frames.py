# PixelLab 공격 프레임에 바탕이 지워지지 않고 남은 회색 판을 지운다(흐릿한 가장자리의 몬스터에서 생긴다).
# 실행: python tools/clean_attack_frames.py <tools/attack_frames 아래 폴더...>   (없으면 모든 폴더를 검사만 한다)
# 1) 투명한 곳과 캔버스 가장자리에서 이어진, 가장 흔한 무채색과 비슷한 픽셀을 지운다
# 2) 캔버스 가장자리 줄의 회색과, 따로 떨어진 밋밋한 회색 덩어리(150px 이상)를 지운다
import glob, os, sys
from collections import Counter, deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attack_frames')
grey = lambda p: p[3] > 0 and max(p[:3]) - min(p[:3]) < 40

def flood_background(im):
    px = im.load(); W, H = im.size
    cnt = Counter((p[0] // 4, p[1] // 4, p[2] // 4) for p in im.getdata() if p[3] > 200 and max(p[:3]) - min(p[:3]) < 40)
    if not cnt or cnt.most_common(1)[0][1] < 400: return
    c = tuple(v * 4 + 2 for v in cnt.most_common(1)[0][0])
    near = lambda p: p[3] > 0 and sum(abs(p[i] - c[i]) for i in range(3)) < 36
    q = deque((x, y) for y in range(H) for x in range(W) if px[x, y][3] == 0 or x in (0, W - 1) or y in (0, H - 1))
    seen = set(q)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and near(px[nx, ny]):
                seen.add((nx, ny)); px[nx, ny] = (0, 0, 0, 0); q.append((nx, ny))

def flat_blobs(im):
    px = im.load(); W, H = im.size
    for x in range(W):
        for y in (0, H - 1):
            if grey(px[x, y]): px[x, y] = (0, 0, 0, 0)
    for y in range(H):
        for x in (0, W - 1):
            if grey(px[x, y]): px[x, y] = (0, 0, 0, 0)
    seen = set()
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if (x, y) in seen or not p[3] or max(p[:3]) - min(p[:3]) >= 30 or not 95 <= p[0] <= 175: continue
            comp = []; q = deque([(x, y)]); seen.add((x, y)); ref = p
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen:
                        r = px[nx, ny]
                        if r[3] and sum(abs(r[i] - ref[i]) for i in range(3)) < 30:
                            seen.add((nx, ny)); q.append((nx, ny))
            if len(comp) >= 150:
                for cx, cy in comp: px[cx, cy] = (0, 0, 0, 0)

def edge_grey(im):
    px = im.load(); W, H = im.size
    pts = [(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)]
    return sum(1 for x, y in pts if px[x, y][3] > 200 and max(px[x, y][:3]) - min(px[x, y][:3]) < 30 and 90 < px[x, y][0] < 180)

folders = sys.argv[1:]
if not folders:
    for d in sorted(glob.glob(os.path.join(ROOT, '*', ''))):
        n = sum(edge_grey(Image.open(f).convert('RGBA')) for f in glob.glob(d + 'frame_*.png'))
        if n > 20: print('grey edge', os.path.basename(d[:-1]), n)
    sys.exit()
for name in folders:
    for f in sorted(glob.glob(os.path.join(ROOT, name, 'frame_*.png'))):
        im = Image.open(f).convert('RGBA')
        flood_background(im)
        flat_blobs(im)
        im.save(f)
    print('cleaned', name)
