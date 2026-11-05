// 그림 불러오기와 색 입힌 사본 캐시. 색 입히기는 픽셀을 읽지 않아 index.html을 바로 열어도 동작한다.
const Assets = {
    images: {},
    tintCache: {},
    total: 0,
    loaded: 0,

    names() {
        const list = [];
        for (const base of ['swordsman', 'swordsman_female', 'beast_tamer', 'beast_tamer_female', 'stormcaller', 'stormcaller_female']) {
            for (const dir of ['down', 'up', 'left', 'right']) {
                for (let i = 0; i < 4; i++) list.push(`${base}_walk_${dir}${i}`);
                for (let i = 0; i < 2; i++) list.push(`${base}_act_${dir}_atk${i}`, `${base}_act_${dir}_cast${i}`);
            }
        }
        for (const pose of ['down', 'left', 'cast', 'slam', 'windup']) {
            list.push(`boss_fallen_knight_${pose}`, `boss_rift_lord_${pose}`);
        }
        list.push('island_shadow', 'void_shadow', 'bridgedeck_shadow', 'prop_fieldPortal');
        for (const fx of ['hit_physical', 'hit_crit', 'hit_fire', 'hit_lightning', 'blastViolet', 'blastPink', 'blastCyan', 'blastGold', 'explosion',
            'adv_arcanist_lightning', 'adv_arcanist_thunderGod', 'adv_doomMelody_requiem', 'arrowBig', 'arrowPoison', 'slash']) list.push(`fx_${fx}`);
        list.push('portrait_riftLord', 'portrait_fallenKnight', 'facility_archer', 'prop_shard', 'prop_crystal', 'prop_pillarShadow',
            'anim_boarWarrior_walk0', 'anim_boarWarrior_walk1', 'anim_boarWarrior_attack',
            'tile_shadow_plain', 'tile_shadow_detailA', 'tile_shadow_detailB', 'tile_shadow_rare',
            'tile_void_plain', 'tile_void_detailA', 'tile_void_detailB', 'tile_void_rare',
            'wall_shadow_block', 'wall_shadow_corner', 'wall_shadow_doorOpen',
            'ui_button', 'ui_buttonHover', 'ui_skillSlot', 'ui_window', 'ui_itemSlot', 'icon_power_thunderStrike');
        return list;
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
            img.src = `assets/sprites/${name}${/^(island|void|bridgedeck)_/.test(name) ? '.webp' : '.png'}`;
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
