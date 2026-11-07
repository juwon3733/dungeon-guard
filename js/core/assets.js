// 그림 불러오기와 색 입힌 사본 캐시. 색 입히기는 픽셀을 읽지 않아 index.html을 바로 열어도 동작한다.
// UI 아이콘(uiicon_<이름>, 48px)과 UI 재질 그림(48px 9칸 원본: js/ui/uikit.js의 UI_SLICES가 잘라 쓴다)
const UI_ICONS = ['summon', 'lord', 'attack', 'gold', 'soul', 'lock', 'book', 'bag', 'close', 'fast', 'pause', 'sound', 'gear', 'wave', 'retry', 'bolt'];
const UI_SHEETS = ['ui_window', 'ui_button', 'ui_buttonHover', 'ui_closeButton', 'ui_itemSlot', 'ui_skillSlot'];
// 지역 그림(webp): 지역마다 우주 배경, 섬, 다리. 지역 표는 js/data/map.js의 ZONES
const ZONE_ART = ['void', 'island', 'bridgedeck'];
// 본부(js/ui/hq.js): 물건 그림(64px)과 바닥 타일셋(tileset_hq, 칸 정보는 hq.js의 WANG_TILES)
const HQ_SPRITES = ['hq_wartable', 'hq_bookshelf', 'hq_relic_case', 'hq_portal', 'hq_weapon_rack', 'hq_dummy', 'hq_vault', 'hq_throne', 'hq_fireplace',
    'hq_notice_board', 'hq_plant', 'hq_window', 'hq_wall_banner', 'hq_crates', 'hq_tea_table', 'hq_goblin_desk', 'tileset_hq'];
// 그림 이름의 파일 경로. 효과 시트는 assets/fx, 지역 그림은 webp
function assetPath(name) {
    if (name.startsWith('pfx_')) return `assets/fx/${name}.png`;
    const zoneArt = ZONE_ART.some(kind => name.startsWith(kind + '_'));
    return `assets/sprites/${name}.${zoneArt ? 'webp' : 'png'}`;
}

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
        const skins = Object.values(ASTERIA_HERO_SKINS).flat();
        for (const def of [...Object.values(HEROES), ...monsterArt, ...bossArt, ...skins]) {
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
        // 맵: 지역 8곳의 배경, 섬, 다리와 지역 소품(64px), 왕좌 의자
        for (const id of ZONE_IDS) list.push(...ZONE_ART.map(kind => `${kind}_${id}`), ...ZONES[id].props.map(p => p[0]));
        list.push('prop2_throne');
        // 전투 효과는 모두 pixelfx 시트(assets/fx/)다
        for (const sheet of Object.values(FX_SHEETS)) list.push(sheet.image);
        list.push(...UI_ICONS.map(id => `uiicon_${id}`), ...UI_SHEETS, ...HQ_SPRITES);
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
            img.src = assetPath(name);
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
