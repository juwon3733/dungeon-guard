# Asteria 일러스트를 메뉴 바탕으로 가져온다. assets/sprites/ill_<이름>.png를 만든다. 실행: python tools/import_menu_art.py
# 원본 도트를 그대로 복사하고, 화면에는 정수 배율로 그린다(UI.drawIllust).
import os, shutil

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LZ = os.path.join(os.environ['USERPROFILE'], r'Downloads\Asteria-stove-3.2.0-win64\resources\www\lz')
ART = {
    'ill_title': 'illust_chapter_19', 'ill_worldmap': 'illust_worldmap_main', 'ill_select': 'illust_chapter_16',
    # 대화 바탕: 지역마다 하나
    'ill_moonGarden': 'illust_chapter_2', 'ill_coast': 'illust_chapter_18', 'ill_frost': 'illust_chapter_7', 'ill_skySea': 'illust_chapter_12',
    'ill_sunForge': 'illust_chapter_14', 'ill_warTemple': 'illust_chapter_9', 'ill_starChoir': 'illust_chapter_15', 'ill_ember': 'illust_chapter_8',
    # 도전의 문 카드
    'ill_daily': 'illust_chapter_3', 'ill_abyss': 'illust_chapter_10', 'ill_raid': 'illust_chapter_21',
}
for name, src in ART.items():
    shutil.copyfile(os.path.join(LZ, src + '.png'), os.path.join(ROOT, 'assets', 'sprites', name + '.png'))
    print(name, src)
print("js/core/assets.js의 MENU_ILLUSTS와 맞춘다:", list(ART))
