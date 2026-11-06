// 그림 불러오기와 색 입힌 사본 캐시. 색 입히기는 픽셀을 읽지 않아 index.html을 바로 열어도 동작한다.
// UI 아이콘(uiicon_<이름>, 48px). 지금은 마왕 탭의 스킬 칸만 쓴다
const UI_ICONS = ['bolt'];
// 맵 바닥 타일셋. 칸 정보(corners, bounding_box)는 js/data/map.js의 WANG_TILES
const MAP_TILESETS = ['tileset_path', 'tileset_water'];
const Assets = {
    images: {},
    tintCache: {},
    total: 0,
    loaded: 0,

    names() {
        const list = [];
        // 모든 캐릭터는 PixelLab 동작 그림이다: rotations/south 한 장과 동작(anim)마다 방향별 프레임
        const monsterArt = Object.values(MONSTERS).map(m => ({ sprite: m.sprite, anim: m.art.anim }));
        const bossArt = Object.values(BOSSES).map(b => b.art);
        for (const def of [...Object.values(HEROES), ...monsterArt, ...bossArt]) {
            list.push(`${def.sprite}/rotations/south`);
            for (const clip of Object.values(def.anim)) {
                for (const dir of clip.dirs || ['south', 'west', 'east', 'north']) {
                    for (let i = 0; i < clip.frames; i++) list.push(`${def.sprite}/animations/${clip.folder}/${dir}/frame_${String(i).padStart(3, '0')}`);
                }
            }
        }
        // 마왕 그림(128px)과 초상, 유물 그림(48px)
        for (const lord of Object.values(DEMON_LORDS)) list.push(lord.sprite, lord.portrait.sprite);
        for (const id of Object.keys(RELICS)) list.push(`relic_${id}`);
        for (const id of Object.keys(EQUIPMENT)) list.push(`equip_${id}`); // 장비 그림(48px)
        // 맵: 바닥 타일셋 둘(32px Wang 타일)과 소품(64px)
        list.push(...MAP_TILESETS, ...DECOR.map(p => p.sprite), 'prop2_throne');
        // 전투 효과는 모두 pixelfx 시트(assets/fx/)다
        for (const sheet of Object.values(FX_SHEETS)) list.push(sheet.image);
        list.push(...UI_ICONS.map(id => `uiicon_${id}`));
        return [...new Set(list)]; // 몬스터끼리 같은 그림을 써도 한 번만 불러온다
    },

    loadAll(onDone) {
        const names = this.names();
        this.total = names.length;
        let finished = 0;
        for (const name of names) {
            const img = new Image();
            const done = () => {
                finished++;
                this.loaded = finished;
                if (finished === names.length && onDone) onDone();
            };
            img.onload = () => { this.images[name] = img; done(); };
            img.onerror = () => { console.warn('그림을 찾지 못했습니다:', name); done(); };
            img.src = name.startsWith('pfx_') ? `assets/fx/${name}.png` : `assets/sprites/${name}.png`;
        }
    },

    get(name) { return this.images[name] || null; },

    // 그림 모양 그대로 색을 덮는다. 피격 섬광과 타락 유닛의 보라색에 쓴다.
    tinted(name, color, alpha) {
        const key = `${name}|${color}|${alpha}`;
        if (this.tintCache[key]) return this.tintCache[key];
        const img = this.get(name);
        if (!img) return null;
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = alpha;
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        this.tintCache[key] = c;
        return c;
    }
};
