// 클릭 흐름 자동 시험: 화면 없이 실제 입력 함수를 호출해 한 판을 끝까지 진행한다. 실행: node tools/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/asteria_heroes.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/story.js', 'js/data/asteria_bosses.js', 'js/data/challenge.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/relics.js', 'js/game/meta.js', 'js/core/server_config.js', 'js/core/account.js', 'js/game/game.js', 'js/ui/ui.js', 'js/ui/hq.js', 'js/ui/title.js', 'js/ui/tutorial.js', 'js/ui/account_ui.js', 'js/ui/menu.js'];
const ctx = vm.createContext({ console, assert, Math, Set, Object, Array, Infinity, Number, String, JSON,
    Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume(k, v) { this.volume[k] = Math.max(0, Math.min(100, v)); } }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
// 옛 시험은 칸 번호를 직접 적어 두었으므로 옛 배치(30x15칸, tools/legacy_map.js)로 돌린다. 지금 맵은 맨 끝의 tools/smoke_maps.js가 시험한다
function legacyLayout(f) {
    if (f === 'js/data/map.js') return fs.readFileSync(path.join(root, 'tools/legacy_map.js'), 'utf8');
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    if (f !== 'js/core/config.js') return src;
    return src.replace('const WORLD_ZOOM = 5 / 6;', 'const WORLD_ZOOM = 2 / 3;').replace('const MAP_COLS = 24;', 'const MAP_COLS = 30;').replace('const MAP_ROWS = 12;', 'const MAP_ROWS = 15;');
}
for (const f of files) vm.runInContext(legacyLayout(f), ctx, { filename: f });
vm.runInContext('UI.tutorialOff = true', ctx); // 튜토리얼은 맨 끝에서 따로 본다
// 옛 시험은 마왕이 스테이지 3, 5에서 풀리던 표를 기준으로 적혀 있다. 지금 해금 순서는 맨 끝에서 따로 본다
vm.runInContext(`{
    const move = (from, to, id, at) => {
        const a = STAGES.find(s => s.id === from), b = STAGES.find(s => s.id === to);
        a.unlocks = a.unlocks.filter(u => !(u.kind === 'lord' && u.id === id));
        b.unlocks.splice(at, 0, { kind: 'lord', id });
    };
    // 옛 시험은 마왕 셋의 표다: 스토리 3~6의 새 마왕은 빼고 본다(새 마왕은 맨 끝에서 따로)
    const later = Object.keys(DEMON_LORDS).filter(id => !['rift', 'bone_queen', 'gold_king'].includes(id));
    for (const id of later) {
        for (const br of LORD_POWERS[id] || []) for (const t of br.tiers) for (const n of t) delete POWER_SKILLS[n.id];
        delete DEMON_LORDS[id]; delete LORD_POWERS[id]; delete STORY_CAST[id];
    }
    for (const st of STAGES) {
        st.unlocks = st.unlocks.filter(u => !(u.kind === 'lord' && later.includes(u.id)));
        st.outro = st.outro.filter(l => !later.includes(l[0]));
    }
    move('s1', 's3', 'bone_queen', 0);
    move('s2', 's5', 'gold_king', 1);
    // 옛 시험은 유물 19종 표다: 옛 유물과 옛 해금, 옛 상한, 치명타 없음으로 돌린다(새 유물은 맨 끝에서 따로)
    const OLD = { greedy_vault: ['탐욕의 금주머니', { goldDamage: 0.01 }], legion_banner: ['군단의 깃발', { fieldMax: 3 }], glass_heart: ['유리 심장', { fullHpDamage: 0.1 }],
        usury_ledger: ['고리대금 장부', { interest: 0.03 }], mad_dice: ['미치광이의 주사위', { mergeJump: 0.05 }], dead_horn: ['망자의 뿔피리', { meleeDamage: 0.15 }], sniper_mark: ['저격수의 표식', { range: 0.1 }],
        iron_oath: ['철벽 서약', { meleeRange: 0.5 }], blood_altar: ['피의 제단', { altarDamage: 0.005 }], broken_hourglass: ['깨진 모래시계', { earlyAttackSpeed: 0.1 }],
        storm_bottle: ['폭풍의 병', { lightningCooldown: 0.75 }], mad_drum: ['광기의 북', { roarAnytime: 1 }], smith_hammer: ['대장장이의 망치', { equipUp: 0.1 }],
        equip_eater: ['장비 먹는 괴물', { equipPower: 0.2 }], mirror_twin: ['거울 쌍둥이', { twinSummon: 0.05 }], lone_crown: ['고독한 왕관', { fewDamage: 0.25 }],
        pauper_helm: ['빈민의 투구', { commonDamage: 0.2 }], blood_contract: ['피의 계약서', { hpSummon: 3 }], shaky_bridge: ['흔들리는 다리', { mergedSlow: 0.92 }] };
    for (const id of Object.keys(RELICS)) delete RELICS[id];
    for (const [id, [name, effects]] of Object.entries(OLD)) RELICS[id] = { id, name, effects, desc: name };
    Object.assign(RELIC_LIMITS, { goldStep: 200, goldDamageMax: 0.15 });
    COMBAT_RULES.crit.chance = 0;
    const OLD_UNLOCK = { s1: ['greedy_vault', 'legion_banner', 'glass_heart'], s2: ['usury_ledger', 'mad_dice', 'dead_horn', 'sniper_mark'], s3: ['iron_oath', 'blood_altar', 'broken_hourglass'],
        s4: ['storm_bottle', 'mad_drum', 'smith_hammer'], s5: ['equip_eater', 'mirror_twin', 'lone_crown'], s6: ['pauper_helm', 'blood_contract', 'shaky_bridge'] };
    for (const st of STAGES) {
        const rest = st.unlocks.filter(u => u.kind !== 'relic');
        st.unlocks = rest.filter(u => u.kind !== 'ending').concat(OLD_UNLOCK[st.id].map(id => ({ kind: 'relic', id })), rest.filter(u => u.kind === 'ending'));
    }
}`, ctx);

// 장비 그림 16종: 파일(48px PNG)이 있고 불러오기 목록(Assets.names)에 들어 있다
{
    const actx = vm.createContext({ console });
    for (const f of ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/asteria_heroes.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/map.js', 'js/data/fx_sheets.js', 'js/core/assets.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), actx, { filename: f });
    }
    const ids = vm.runInContext('Object.keys(EQUIPMENT)', actx);
    const names = vm.runInContext('Assets.names()', actx);
    assert.strictEqual(ids.length, 27, 'six materials and twenty-one crafted items');
    for (const id of ids) {
        const file = path.join(root, 'assets/sprites', `equip_${id}.png`);
        assert(fs.existsSync(file), 'missing picture ' + file);
        const png = fs.readFileSync(file);
        assert(png.readUInt32BE(16) === 48 && png.readUInt32BE(20) === 48, `equip_${id}.png is 48px`);
        assert(names.includes(`equip_${id}`), `equip_${id} in Assets.names()`);
    }
    // 마왕과 유물 그림: 표에 적은 그림 파일이 있고(마왕 128px, 유물 48px) 불러오기 목록에 들어 있다
    const pngSize = name => {
        const file = path.join(root, 'assets/sprites', `${name}.png`);
        assert(fs.existsSync(file), 'missing picture ' + file);
        const png = fs.readFileSync(file);
        return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    const lords = vm.runInContext('Object.values(DEMON_LORDS)', actx);
    assert.strictEqual(lords.length, 7, 'seven lords'); // 기본 1 + 스토리 1~6 클리어마다 1
    for (const lord of lords) {
        for (const name of [lord.sprite, lord.cast].filter(Boolean)) {
            assert.deepStrictEqual(pngSize(name), [128, 128], name + ' is 128px');
            assert(names.includes(name), name + ' in Assets.names()');
        }
        assert(names.includes(lord.portrait.sprite) && pngSize(lord.portrait.sprite), 'portrait ' + lord.portrait.sprite);
        if (lord.portrait.crop) {
            const [x, y, s] = lord.portrait.crop;
            assert(x >= 0 && y >= 0 && x + s <= 128 && y + s <= 128, 'portrait crop inside the picture');
        }
    }
    const relicIds = vm.runInContext('Object.keys(RELICS)', actx);
    assert.strictEqual(relicIds.length, 47, 'forty-seven relics');
    for (const id of relicIds) {
        assert.deepStrictEqual(pngSize(`relic_${id}`), [48, 48], `relic_${id}.png is 48px`);
        assert(names.includes(`relic_${id}`), `relic_${id} in Assets.names()`);
    }
    // 몬스터 그림: 표의 동작마다 방향(PL_DIRS) 폴더에 프레임 수만큼 그림이 있고(더 많지도 않다), 불러오기 목록에 들어 있다.
    // 그림은 PixelLab(pl_) 또는 Asteria(ast_mon_). 폴더 구조는 같다
    const monsters = vm.runInContext('MONSTERS', actx);
    assert.strictEqual(Object.values(monsters).filter(m => m.grade !== 'mythic').length, 55, 'fifty-five monsters');
    assert.strictEqual(Object.values(monsters).filter(m => m.grade === 'mythic').length, 12, 'twelve mythics');
    for (const def of Object.values(monsters)) {
        assert(fs.existsSync(path.join(root, 'assets/sprites', def.sprite, 'rotations/south.png')), def.id + ' rotation');
        assert(names.includes(`${def.sprite}/rotations/south`));
        assert(def.art.anim.idle && def.art.anim.attack, def.id + ' idle and attack clips');
    }
    for (const def of Object.values(monsters)) {
        for (const clip of Object.values(def.art.anim)) {
            for (const dir of clip.dirs) {
                const dirPath = path.join(root, 'assets/sprites', def.sprite, 'animations', clip.folder, dir);
                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.png'));
                assert.strictEqual(files.length, clip.frames, `${def.id} ${clip.folder} ${dir} frame count`);
                for (let i = 0; i < clip.frames; i++) {
                    const name = `${def.sprite}/animations/${clip.folder}/${dir}/frame_${String(i).padStart(3, '0')}`;
                    assert(fs.existsSync(path.join(root, 'assets/sprites', name + '.png')), 'missing ' + name);
                    assert(names.includes(name), name + ' in Assets.names()');
                }
                // 첫 프레임 발끝(footPx)이 그림 높이 안에 있다
                const png = fs.readFileSync(path.join(dirPath, 'frame_000.png'));
                assert(clip.footPx[dir] > 0 && clip.footPx[dir] <= png.readUInt32BE(20), `${def.id} ${clip.folder} ${dir} foot inside`);
            }
        }
    }
    assert(!fs.existsSync(path.join(root, 'docs/monster_art_16.json')), 'art notes moved into the table');
    // 전투 효과: 모두 pixelfx 시트. 시트 크기가 표와 맞고 합계 15MB 아래. 이전 fx_ 그림은 불러오지 않는다
    const sheets = vm.runInContext('FX_SHEETS', actx);
    let total = 0;
    const images = new Set();
    for (const [key, s] of Object.entries(sheets)) {
        const file = path.join(root, 'assets/fx', s.image + '.png');
        assert(fs.existsSync(file), 'missing sheet ' + file);
        const png = fs.readFileSync(file);
        assert.strictEqual(png.readUInt32BE(16), s.w * s.cols, key + ' sheet width');
        assert.strictEqual(png.readUInt32BE(20), s.h * Math.ceil(s.frames / s.cols), key + ' sheet height');
        assert(names.includes(s.image), s.image + ' in Assets.names()');
        if (!images.has(s.image)) total += png.length;
        images.add(s.image);
    }
    for (const f of fs.readdirSync(path.join(root, 'assets/fx'))) assert(images.has(f.replace('.png', '')), 'unused sheet ' + f);
    assert(total < 15 * 1024 * 1024, 'fx sheets under 15MB: ' + total);
    assert(!names.some(n => n.startsWith('fx_')), 'old fx pictures not loaded');
    for (const key of ['fx_hit_fire', 'fx_hit_lightning', 'fx_blastGold', 'fx_blastPink', 'fx_blastCyan', 'fx_adv_arcanist_lightning',
        'fx_adv_arcanist_thunderGod', 'fx_adv_doomMelody_requiem', 'fx_arrowBig', 'fx_arrowPoison']) assert(sheets[key], key + ' replaced by pixelfx');
    // 능력 효과와 투사체 효과가 시트에 있다
    for (const key of ['fx_burning', 'fx_snowflake', 'fx_stunned', 'fx_lifesteal', 'fx_heal', 'fx_heal_aoe', 'fx_rune_heal', 'fx_rune_damage',
        'fx_rune_attackSpeed', 'fx_cleave', 'fx_thorns', 'fx_fire_ground', 'fx_gold']) assert(sheets[key], key + ' sheet');
    for (const def of Object.values(monsters)) {
        if (def.art.shot && def.art.shot !== 'bolt') assert(sheets[def.art.shot] && sheets[def.art.shot].shot, def.id + ' shot sheet');
        if (def.art.impact) assert(sheets[def.art.impact], def.id + ' impact sheet');
    }

    // 본부 그림: 물건 16장(64px)과 바닥 타일셋(128px, 32px 타일 16칸)이 있고 불러오기 목록에 들어 있다. 타일 좌표 JSON은 코드(WANG_TILES)로 옮겨 지웠다
    const hqSprites = vm.runInContext('HQ_SPRITES', actx);
    assert.strictEqual(hqSprites.length, 17, 'sixteen hq pictures and the tileset');
    for (const name of hqSprites) {
        assert(names.includes(name), name + ' in Assets.names()');
        assert.deepStrictEqual(pngSize(name), name === 'tileset_hq' ? [128, 128] : [64, 64], name + ' size');
    }
    assert(!fs.existsSync(path.join(root, 'docs/hq_tileset.json')), 'hq tileset json moved into code');
    globalThis.HQ_SPRITE_NAMES = hqSprites;
    // 불러오는 그림은 모두 파일이 있다(지운 그림을 부르는 곳이 없다)
    for (const n of names) assert(fs.existsSync(path.join(root, vm.runInContext(`assetPath(${JSON.stringify(n)})`, actx))), 'loaded picture exists: ' + n);
    // 용사, 정예, 보스: 동작마다 방향 폴더에 프레임 수만큼 그림이 있고 첫 프레임 발끝이 캔버스 안이다
    const heroes = vm.runInContext('HEROES', actx);
    const bosses = vm.runInContext('BOSSES', actx);
    for (const def of [...Object.values(heroes), ...Object.values(bosses).map(b => b.art)]) {
        assert(def.scale === vm.runInContext("PIXEL_SCALE", actx) || def.scale === vm.runInContext("SWARM_RULES.scale", actx), def.sprite + " scale");
        assert(names.includes(`${def.sprite}/rotations/south`), def.sprite + ' rotation');
        for (const clip of Object.values(def.anim)) {
            for (const dir of clip.dirs || ['south', 'west', 'east', 'north']) {
                const dirPath = path.join(root, 'assets/sprites', def.sprite, 'animations', clip.folder, dir);
                assert.strictEqual(fs.readdirSync(dirPath).filter(f => f.endsWith('.png')).length, clip.frames, `${def.sprite} ${clip.folder} ${dir} frames`);
                const png = fs.readFileSync(path.join(dirPath, 'frame_000.png'));
                const foot = typeof clip.footPx === 'number' ? clip.footPx : clip.footPx[dir];
                assert(foot > 0 && foot <= png.readUInt32BE(20), `${def.sprite} ${clip.folder} ${dir} foot inside`);
            }
        }
    }
    for (const id of ['elite_swordsman', 'elite_tamer', 'elite_stormcaller', 'elite_rhapsodist']) {
        assert(heroes[id].sprite.startsWith('ast_elite_') && !heroes[id].anim.death, id + ' uses Asteria art and falls flat');
    }
    // 지역 8곳: 우주 배경, 섬, 다리 그림(webp)이 있고 불러오기 목록에 들어 있다. 다리 자르기 범위는 원본(1024px) 안이다.
    // 지역 소품은 64px 그림이고 발끝 높이가 있다
    const zones = vm.runInContext('ZONES', actx);
    assert.deepStrictEqual(Object.keys(zones), ['moonGarden', 'coast', 'frost', 'skySea', 'sunForge', 'warTemple', 'starChoir', 'ember'], 'eight zones');
    const webpSize = file => {
        const b = fs.readFileSync(file);
        assert.strictEqual(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12), 'RIFFWEBP', file + ' is webp');
        const t = b.toString('ascii', 12, 16);
        if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
        if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
        return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    };
    for (const [id, z] of Object.entries(zones)) {
        for (const kind of ['void', 'island', 'bridgedeck']) {
            const name = `${kind}_${id}`;
            const file = path.join(root, 'assets/sprites', name + '.webp');
            assert(fs.existsSync(file), 'zone art ' + name);
            assert(names.includes(name), name + ' in Assets.names()');
            const [w, h] = webpSize(file);
            assert(w >= 1000 && h >= 900, name + ' size');
            if (kind === 'bridgedeck') assert(z.deck[0] >= 0 && z.deck[1] <= h && z.deck[1] - z.deck[0] >= 300, id + ' deck crop inside');
        }
        assert(typeof z.name === 'string' && z.name.length > 1, id + ' name');
        assert(z.vignette.length === 4 && z.vignette[3] <= 0.2, id + ' light and a light vignette');
        assert(z.gate.length === 3 && z.post.length === 3, id + ' gate and post colors');
        assert(z.props.length >= 1 && z.props.length <= 4, id + ' few props');
        for (const [sprite] of z.props) {
            assert.deepStrictEqual(pngSize(sprite), [64, 64], sprite + ' is 64px');
            assert(names.includes(sprite), sprite + ' in Assets.names()');
            assert(typeof vm.runInContext(`propFootPx('${sprite}')`, actx) === 'number', sprite + ' foot');
        }
    }
    assert.deepStrictEqual(pngSize('prop2_throne'), [64, 64], 'throne chair');
    // 맵 타일셋은 지웠다(본부 바닥 tileset_hq만 남는다)
    for (const t of ['tileset_path', 'tileset_water']) assert(!fs.existsSync(path.join(root, 'assets/sprites', t + '.png')), t + ' removed');
    // UI 재질: 48px 9칸 원본 6장. 양피지와 나무판(ui_kit, ui_buttons)은 쓰지 않는다
    for (const n of vm.runInContext('UI_SHEETS', actx)) {
        assert.deepStrictEqual(pngSize(n), [48, 48], n + ' is 48px');
        assert(names.includes(n), n + ' in Assets.names()');
    }
    assert(!names.includes('ui_kit') && !names.includes('ui_buttons'), 'no parchment or wood kit');
    for (const f of ['js/ui/uikit.js', 'js/ui/ui.js', 'js/ui/hq.js']) assert(!/ui_kit|ui_buttons|UI_HP_BAR/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' does not use the old kit');
}
// 옛 시험은 조합 전의 장비 표(16종, 재료를 겹치면 맞바꿈)로 돌린다. 조합은 맨 끝의 시험에서 지금 표로 본다
ctx.LEGACY_EQUIP = JSON.parse(fs.readFileSync(path.join(root, 'tools/legacy_equipment.json'), 'utf8'));
vm.runInContext(`
var REAL_EQUIP = { table: JSON.parse(JSON.stringify(EQUIPMENT)), rules: Object.assign({}, EQUIP_RULES), recipes: EQUIP_RECIPES.slice() };
function useEquip(table, rules, recipes) {
    for (const k of Object.keys(EQUIPMENT)) delete EQUIPMENT[k];
    Object.assign(EQUIPMENT, table);
    for (const k of Object.keys(EQUIP_RULES)) delete EQUIP_RULES[k];
    Object.assign(EQUIP_RULES, rules);
    EQUIP_RECIPES.length = 0;
    EQUIP_RECIPES.push(...recipes);
}
useEquip(LEGACY_EQUIP.equipment, LEGACY_EQUIP.rules, []);
`, ctx);
ctx.LEGACY_RULES = JSON.parse(fs.readFileSync(path.join(root, 'tools/legacy_block_rules.json'), 'utf8'));
vm.runInContext(`
// 옛 시험은 길을 막던 때의 표로 돌린다(유물 시험 앞에서 지금 표로 되돌린다)
var REAL_RULES = { monsters: {}, equip: {}, lords: {}, roles: JSON.parse(JSON.stringify(MONSTER_ROLES)) };
for (const m of Object.values(MONSTERS)) { REAL_RULES.monsters[m.id] = { stats: m.stats, abilities: m.abilities, skills: m.skills, desc: m.desc }; Object.assign(m, LEGACY_RULES.monsters[m.id]); }
for (const e of Object.values(EQUIPMENT)) { REAL_RULES.equip[e.id] = e.effects; e.effects = LEGACY_RULES.equip[e.id] || e.effects; }
for (const l of Object.values(DEMON_LORDS)) { REAL_RULES.lords[l.id] = l.effects; l.effects = LEGACY_RULES.lords[l.id]; }
Object.assign(MONSTER_ROLES, LEGACY_RULES.roles);
// 칸 모양은 맨 끝 시험에서 본다. 그 앞 시험은 모두 1칸으로 돌린다
var SAVED_CELLS = {};
// 신화 표와 특수 스킬도 맨 끝 시험에서 본다. 그 앞 시험은 신화가 비어 있고 스킬이 없는 표로 돌린다(신화 제한도 1마리)
var SAVED_MYTHICS = {}, SAVED_SKILLS = {}, SAVED_RECIPES = [];
for (const id of Object.keys(MONSTERS)) if (MONSTERS[id].grade === 'mythic') { SAVED_MYTHICS[id] = MONSTERS[id]; delete MONSTERS[id]; }
for (let i = MONSTER_RECIPES.length - 1; i >= 0; i--) if (SAVED_MYTHICS[MONSTER_RECIPES[i].result]) SAVED_RECIPES.unshift(MONSTER_RECIPES.splice(i, 1)[0]);
for (const id of Object.keys(MONSTERS)) if (MONSTERS[id].skills) { SAVED_SKILLS[id] = MONSTERS[id].skills; delete MONSTERS[id].skills; }
var SAVED_TILES = { altars: MAPS.merge.altars, cursed: MAPS.merge.cursed };
MAPS.merge.altars = [];
MAPS.merge.cursed = [];
var SAVED_STAGE_MAPS = STAGES.map(st => st.mapId);
for (const st of STAGES) st.mapId = 'merge';
setMap('merge');
var SAVED_PASSIVES = {};
for (const l of Object.values(DEMON_LORDS)) { SAVED_PASSIVES[l.id] = l.passive; delete l.passive; }
var SAVED_RAID = {};
for (const id of Object.keys(RAID_BOSSES)) { SAVED_RAID[id] = BOSSES[id]; delete BOSSES[id]; }
var SAVED_SWARM = Object.assign({}, SWARM_RULES);
Object.assign(SWARM_RULES, { hpMul: 1, bountyMul: 1, leak: 1 });
var SAVED_FIELD_MAX = MONSTER_GRADES.mythic.fieldMax;
MONSTER_GRADES.mythic.fieldMax = 1;
for (const id of Object.keys(MONSTERS)) { SAVED_CELLS[id] = MONSTERS[id].art.cells; delete MONSTERS[id].art.cells; }

// 입력은 main.js와 같은 길로 넣는다: 누름(onDown) → 움직임(onMove) → 뗌(onUp). 마우스와 터치가 같은 pointer 이벤트다
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const worldClick = (x, y) => click(x * WORLD_ZOOM, y * WORLD_ZOOM);
const cellClick = (c, r) => worldClick(tileX(c), tileY(r));
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btn = id => { UI.update(0); const b = UI.buttons.find(b => b.id === id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const tick = s => { for (let i = 0; i < s * 30; i++) { UI.update(1 / 30); Game.update(1 / 30); } };
// 끌기: 누른 채로 몇 번에 나눠 움직인 뒤 뗀다
const dragTo = (from, to) => {
    UI.update(0);
    UI.onMove(from[0], from[1]);
    UI.onDown(from[0], from[1]);
    for (let i = 1; i <= 4; i++) UI.onMove(from[0] + (to[0] - from[0]) * i / 4, from[1] + (to[1] - from[1]) * i / 4);
    UI.onUp(to[0], to[1]);
};
const cellXY = (c, r) => [tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM];
const monXY = m => [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
// Math.random을 고정한다. 배열이면 부를 때마다 차례로 돌려주고, 다 쓰면 0을 돌려준다
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};

// 영구 수집은 저장소 없이 초기값에서 시작한다(시험끼리 기록이 이어지지 않게 블록마다 처음 상태로 둔다)
assert(typeof localStorage === 'undefined', 'smoke runs without storage');
Meta.data = Meta.fresh();
// 시작: 타이틀 → 본부. 이 묶음은 스토리 없이 WAVES 전부로 도는 판(시험 도구용 고르기 화면 → 시작)을 쓴다.
// 스토리 흐름은 아래 smoke-story, 본부는 smoke-hq 묶음에서 본다
assert.strictEqual(Game.state, 'title');
btn('start');
assert.strictEqual(Game.state, 'hq');
UI.openSelect(null);
assert.strictEqual(Game.state, 'select');
assert.strictEqual(JSON.stringify(UI.loadout), '{"lord":"rift","relics":[]}', 'default loadout');
btn('begin');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.lord, 'rift');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
// 소환 비용: 25G에서 시작해 소환할 때마다 1G씩 오르고 상한이 없다. 맵에는 24마리까지
assert.strictEqual(SUMMON_RULES.cost, 25);
assert.strictEqual(SUMMON_RULES.costStep, 1);
assert.strictEqual(SUMMON_RULES.maxCost, undefined, 'no summon cost cap');
assert.strictEqual(SUMMON_RULES.maxField, 24);
assert.strictEqual(Game.summonCost(), 25);
assert(BUILD_CELLS.size > SUMMON_RULES.maxField, 'enough build cells for the cap');

// 몬스터 탭: 소환 버튼만 있다. 대기 칸과 예전 몬스터 슬롯, 스킬 슬롯은 없다
assert.strictEqual(UI.tab, 'monster');
assert(hasBtn('summon'));
assert(!UI.buttons.some(b => b.id.startsWith('bench')), 'no bench slots');
assert(!('bench' in Game) && !Game.deploy && !Game.sellBench, 'bench removed');
assert(!hasBtn('place_orc_guard'));
assert(!hasBtn('lightning') && !hasBtn('roar'));

// 탭 전환: 클릭과 Tab 키
btn('tab_demon');
assert.strictEqual(UI.tab, 'demon');
assert(hasBtn('lightning') && hasBtn('roar') && !hasBtn('summon'));
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');

// 빈 길 옆 칸을 누르면 소환하라는 안내만 뜬다
UI.toast = null;
cellClick(3, 4);
assert.strictEqual(Game.monsters.length, 0);
assert(UI.toast && UI.toast.text.includes('소환'), 'empty cell hint');

// 몬스터 표와 확률 데이터: 23종, 일반 70% 희귀 25% 영웅 5%. 전설(죽음의 군주, 지옥 대장군, 대리치)은 조합식으로만 나와 소환 후보가 비어 있다
for (const fam of Object.keys(MONSTER_FAMILIES)) for (const [g, n] of [['common', 3], ['rare', 3], ['epic', 3], ['legendary', 2]]) assert.strictEqual(Object.values(MONSTERS).filter(m => m.family === fam && m.grade === g).length, n, fam + ' ' + g);
assert.strictEqual(SUMMON_RULES.odds.common, 0.70);
assert.strictEqual(SUMMON_RULES.odds.rare, 0.25);
assert.strictEqual(SUMMON_RULES.odds.epic, 0.05);
assert(!SUMMON_RULES.odds.legendary && gradePool('legendary').length === 0, 'legendary not summoned');
// 등급 표: 일반 < 희귀 < 영웅 < 전설 < 신화. 전설과 신화는 소환 없음, 신화만 맵에 1마리. 등급 합치기는 같은 등급 3마리
assert.strictEqual(GRADE_ORDER.join(), 'common,rare,epic,legendary,mythic', 'grade order');
assert.strictEqual(GRADE_ORDER.map(g => MONSTER_GRADES[g].name).join(), '일반,희귀,영웅,전설,신화');
assert.strictEqual(GRADE_ORDER.filter(g => MONSTER_GRADES[g].summon === false).join(), 'legendary,mythic', 'not summoned grades');
assert.strictEqual(GRADE_ORDER.filter(g => MONSTER_GRADES[g].fieldMax !== undefined).map(g => g + ':' + MONSTER_GRADES[g].fieldMax).join(), 'mythic:1', 'only mythic is limited');
assert.strictEqual(MERGE_RULES.gradeCount, 3);
assert(MONSTER_GRADES.mythic.color !== MONSTER_GRADES.legendary.color && MONSTER_GRADES.mythic.rainbow.length >= 3, 'mythic has its own rainbow color');
assert.deepStrictEqual(SACRIFICE_RULES.mythic, { heal: 20, lightning: 60 });
assert.strictEqual(SUMMON_RULES.refund.mythic, 800);
assert.strictEqual(gradePool('mythic').length, 0);
assert.strictEqual(mergePool('legendary').length, 10, 'legendary merge pool');
assert.strictEqual(mergePool('mythic').length, 0, 'no mythic monster yet');
assert.strictEqual(nextGrade('legendary'), null, 'legendary is the top grade until a mythic monster is in the table');
for (const id of ['death_lord', 'hell_general', 'archlich']) {
    assert(MONSTERS[id].summon === false && MONSTERS[id].grade === 'legendary', id + ' legendary, not summoned');
}
assert.strictEqual(nextGrade('epic'), 'legendary', 'three epics make a legendary');
for (let i = 0; i < 400; i++) {
    const t = Game.rollSummon();
    assert(MONSTERS[t].grade !== 'legendary' && MONSTERS[t].summon !== false, 'legendary never summoned: ' + t);
}
// 표에 한 줄 넣은 희귀·영웅은 등급 합치기와 소환 후보에 저절로 들어간다
assert.strictEqual(gradePool('common').length, 15);
assert.strictEqual(gradePool('rare').length, 15);
assert.strictEqual(gradePool('epic').length, 15);
assert.strictEqual(MONSTERS.orc_berserker.role, 'melee');
assert.strictEqual(MONSTERS.bone_knight.stats.block, 5);
assert.strictEqual(MONSTERS.curse_shooter.stats.range, 4);
// 새 16종 수치 초안(표 그대로)
{
    const want = {
        goblin_spearman: ['common', 'melee', 'orc', 70, 12, 0.7, 0.9, 1, 6], zombie: ['common', 'tank', 'undead', 170, 6, 1.2, 0.8, 3, 7],
        fire_imp: ['common', 'ranged', 'demon', 30, 7, 1.0, 2.5], gnoll_hunter: ['common', 'ranged', 'beast', 40, 14, 1.3, 3],
        wisp_acolyte: ['common', 'support', 'spirit', 30, 3, 1.5, 2], werewolf: ['rare', 'melee', 'beast', 170, 24, 0.6, 0.8, 2, 7],
        troll: ['rare', 'tank', 'orc', 320, 14, 1.2, 0.8, 4, 7], frost_witch: ['rare', 'area', 'spirit', 40, 14, 2.0, 3],
        nightmare_jester: ['rare', 'ranged', 'demon', 40, 12, 1.2, 3.5], orc_shaman: ['rare', 'support', 'orc', 50, 5, 1.5, 2.5],
        minotaur: ['epic', 'melee', 'beast', 480, 50, 1.2, 1, 3, 6], vampire: ['epic', 'ranged', 'undead', 70, 40, 1.0, 4],
        flame_demon: ['epic', 'area', 'demon', 80, 45, 2.2, 3], ancient_treant: ['epic', 'tank', 'spirit', 700, 20, 1.3, 0.9, 6, 6],
        hell_general: ['legendary', 'melee', 'demon', 800, 110, 0.8, 1, 4, 5], archlich: ['legendary', 'area', 'undead', 120, 100, 1.8, 4.5]
    };
    for (const [id, w] of Object.entries(want)) {
        const d = MONSTERS[id];
        const s = d.stats;
        assert.deepStrictEqual([d.grade, d.role, d.family, s.hp, s.damage, s.interval, s.range, s.block, s.respawn].slice(0, w.length), w, id);
        assert(MONSTER_FAMILIES[d.family] && MONSTER_ROLES[d.role], id + ' role and family');
        assert.strictEqual(d.art.scale, d.art.breathe ? ART_SCALE : PIXEL_SCALE, id + ' scale');
        assert(d.art.glow.split(',').length === 3 && d.art.glow.split(',').every(v => Number(v) >= 0 && Number(v) <= 255), id + ' glow');
        if (!monsterBlocks(id)) assert(d.art.hand && d.art.hand.x >= 0, id + ' hand');
    }
    // 새 몬스터마다 빛 색이 다르다(몬스터 자체 색)
    const glows = Object.keys(want).map(id => MONSTERS[id].art.glow);
    assert.strictEqual(new Set(glows).size, glows.length, 'distinct glow');
    assert.strictEqual(MONSTERS.frost_witch.stats.splash, 1);
    assert.strictEqual(MONSTERS.flame_demon.stats.splash, 1.5);
    assert.strictEqual(MONSTERS.archlich.stats.splash, 2);
}
// 소환 확률: 첫 난수로 등급, 둘째 난수로 그 등급 안의 몬스터를 고른다
assert.strictEqual(withRandom([0, 0], () => Game.rollSummon()), 'orc_guard');
assert.strictEqual(withRandom([0.69, 0.99], () => Game.rollSummon()), gradePool('common').at(-1));
assert.strictEqual(withRandom([0.70, 0.01], () => Game.rollSummon()), gradePool('rare')[0]);
assert.strictEqual(withRandom([0.94, 0.99], () => Game.rollSummon()), gradePool('rare').at(-1));
assert.strictEqual(withRandom([0.95, 0.01], () => Game.rollSummon()), gradePool('epic')[0]);
assert.strictEqual(withRandom([0.999, 0.99], () => Game.rollSummon()), gradePool('epic').at(-1));

// 칸에서 길까지 거리(px)
const pathGap = (c, r) => nearestPathPoint(tileX(c), tileY(r)).gap; // 두 갈래 중 가까운 길까지

// 소환: 버튼을 누르면 25골드를 내고 맵의 빈 길 옆 칸에 바로 나온다. 길에 가장 가까운 칸(바로 옆)을 고른다
withRandom([0.1, 0.03], () => btn('summon'));
assert.strictEqual(Game.monsters.length, 1, 'summoned onto the map');
const s1 = Game.monsters[0];
assert.strictEqual(s1.type, 'orc_guard');
assert(isBuildCell(s1.col, s1.row) && Game.monsterAt(s1.col, s1.row) === s1, 'on a build cell');
assert(Math.abs(pathGap(s1.col, s1.row) - TILE) < 1, 'nearest cell to the path');
assert(s1.blocks && s1.rally, 'summoned blocker walks out');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 25);
assert.strictEqual(Game.stats.summoned, 1);
assert.strictEqual(Game.summonCost(), 26, 'cost +1');
assert(Fx.pops.some(p => p.kind === 'summon' && p.to.x === s1.x && p.to.y === s1.y && p.grade === 'common'), 'summon effect on the cell');
// S 키도 같다. 비용은 26, 27로 오른다
withRandom([0.5, 0.1], () => UI.onKey('KeyS'));
withRandom([0.1, 0.17], () => UI.onKey('KeyS'));
assert.strictEqual(Game.monsters.map(m => m.type).join(), 'orc_guard,skeleton_archer,dark_mage');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold - 25 - 26 - 27);
assert.strictEqual(Game.summonCost(), 28);
// 같은 거리의 칸에서는 무작위로 고른다: 칸을 고르는 난수가 다르면 다른 칸
{
    const a = withRandom(0, () => Game.pickSummonCell('skeleton_archer'));
    const b = withRandom(0.99, () => Game.pickSummonCell('skeleton_archer'));
    assert(a && b && (a.col !== b.col || a.row !== b.row), 'random among equally near cells');
}
// 소환 버튼과 하단 표시: 현재 비용과 맵 몬스터 수(현재 수/상한)
UI.update(0);
assert(!UI.buttons.find(b => b.id === 'summon').disabled);
// 골드가 모자라면 소환하지 않고 안내한다
Game.gold = 27;
UI.toast = null;
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').disabled, 'summon dimmed without gold');
UI.onKey('KeyS');
assert.strictEqual(Game.monsters.length, 3);
assert.strictEqual(Game.gold, 27);
assert(UI.toast && UI.toast.text.includes('28G'), 'gold toast shows current cost');
// 희귀·영웅 소환 연출은 등급을 따른다
Game.gold = 1000;
withRandom([0.97, 0], () => UI.onKey('KeyS'));
const k1 = Game.monsters[3];
assert.strictEqual(k1.type, 'bone_knight');
assert(Fx.pops.some(p => p.kind === 'summon' && p.grade === 'epic' && p.to.x === k1.x), 'epic summon effect on the cell');
assert.strictEqual(Game.summonCost(), 29);

// 비용은 멈추지 않고 계속 오른다
Game.summonCount = 35;
assert.strictEqual(Game.summonCost(), 60);
Game.summonCount = 200;
assert.strictEqual(Game.summonCost(), 225, 'no cap');

// 원거리 몬스터는 사거리 안에 길이 들어오는 칸에만 나온다.
// 건설 칸은 길에서 가로세로 2칸 안이라 어느 길에서든 대각선 2칸(2.83칸) 안이다. 이 시험 동안만 암흑 마법사 사거리를 1.5칸으로 줄인다
assert(![...BUILD_CELLS].some(k => { const [c, r] = k.split(',').map(Number); return pathGap(c, r) > 2 * Math.SQRT2 * TILE + 1e-6; }), 'every build cell within 2 diagonal tiles of a path');
const mageRange = MONSTERS.dark_mage.stats.range;
MONSTERS.dark_mage.stats.range = 1.5;
const farCells = [...BUILD_CELLS].map(k => k.split(',').map(Number)).filter(([c, r]) => pathGap(c, r) > MONSTERS.dark_mage.stats.range * TILE);
assert(farCells.length > 0, 'test needs a cell out of dark mage range');
Game.monsters = [];
SUMMON_RULES.maxField = 999; // 빈 칸이 없는 경우를 상한과 따로 시험한다
for (const key of BUILD_CELLS) {
    const [c, r] = key.split(',').map(Number);
    if (!farCells.some(([fc, fr]) => fc === c && fr === r)) Game.place('skeleton_archer', c, r);
}
let g0 = Game.gold;
UI.toast = null;
withRandom([0.69, 0.17], () => UI.onKey('KeyS')); // 암흑 마법사: 남은 칸은 모두 사거리 밖
assert.strictEqual(Game.gold, g0, 'no cell in range: no gold spent');
assert(UI.toast && UI.toast.text.includes('자리 없음'), 'no cell toast');
assert(!Game.monsters.some(m => m.type === 'dark_mage'), 'dark mage not placed out of range');
MONSTERS.dark_mage.stats.range = mageRange;
withRandom([0.1, 0.03], () => UI.onKey('KeyS')); // 오크 경비병(막는 몬스터)은 사거리 조건 없이 남은 칸에 나온다
const farOrc = Game.monsters.find(m => m.type === 'orc_guard');
assert(farOrc && farCells.some(([c, r]) => c === farOrc.col && r === farOrc.row), 'blocker uses the far cell');
// 막는 몬스터 지점이 모두 겹쳐도 빈 칸이 있으면 그 칸을 쓴다. 빈 칸이 하나도 없으면 거부하고 골드를 쓰지 않는다
for (const [c, r] of farCells) Game.place('orc_guard', c, r);
Game.removeMonster(Game.monsterAt(3, 4));
withRandom([0, 0], () => UI.onKey('KeyS'));
assert.strictEqual(Game.monsterAt(3, 4).type, 'orc_guard', 'blocker falls back to any free cell');
g0 = Game.gold;
UI.toast = null;
withRandom([0, 0], () => UI.onKey('KeyS'));
assert.strictEqual(Game.gold, g0, 'no free cell: no gold spent');
assert(UI.toast && UI.toast.text.includes('자리 없음'));
SUMMON_RULES.maxField = 24;
// 원거리로 나온 몬스터는 모두 사거리 안에 길이 있다
Game.monsters = [];
Game.summonCount = 0;
Game.gold = 5000;
for (let i = 0; i < 20; i++) assert(Game.summon().ok);
for (const m of Game.monsters) {
    if (!m.blocks) assert(pathGap(m.col, m.row) <= MONSTERS[m.type].stats.range * TILE + 0.5, 'ranged in range ' + m.type);
}

// 막는 몬스터는 길 지점이 서로 1칸 안으로 겹치지 않게 퍼진다
Game.monsters = [];
for (let i = 0; i < 10; i++) assert(withRandom([0, 0, Math.random()], () => Game.summon()).ok);
{
    const orcs = Game.monsters.filter(m => m.type === 'orc_guard');
    assert.strictEqual(orcs.length, 10);
    for (let i = 0; i < orcs.length; i++) {
        for (let j = i + 1; j < orcs.length; j++) {
            const a = rallyPoint(orcs[i].col, orcs[i].row);
            const b = rallyPoint(orcs[j].col, orcs[j].row);
            assert(distance(a.x, a.y, b.x, b.y) > TILE * SUMMON_RULES.blockerSpacing, 'blocker rally points spread');
        }
    }
}

// 상한 24마리: 더 소환하면 거부하고 골드를 쓰지 않는다. 버튼은 "자리 없음"
Game.monsters = [];
Game.gold = 5000;
for (let i = 0; i < 30 && Game.monsters.length < 24; i++) Game.summon();
assert.strictEqual(Game.monsters.length, 24, 'filled to the cap');
assert.strictEqual(new Set(Game.monsters.map(m => m.col + ',' + m.row)).size, 24, 'one monster per cell');
assert(Game.monsters.every(m => isBuildCell(m.col, m.row)));
g0 = Game.gold;
UI.toast = null;
btn('summon');
assert.strictEqual(Game.monsters.length, 24, 'cap holds');
assert.strictEqual(Game.gold, g0, 'no gold spent at cap');
assert(UI.toast && UI.toast.text.includes('자리 없음'), 'cap toast');
assert.strictEqual(Game.summon().reason, 'full');
UI.update(0);
assert(UI.buttons.find(b => b.id === 'summon').full, 'summon button shows full');
// 합쳐서 자리가 나면 다시 소환할 수 있다
{
    let pair = null;
    for (const a of Game.monsters) for (const b of Game.monsters) {
        const plan = Game.mergePlanFor(a, b); // 같은 등급이 3마리 있어야 하므로 맵 상태로 판단한다
        // 히든 조합식은 아래에서 처음 발견을 시험하므로 피한다
        if (!pair && a !== b && plan.kind !== 'none' && !(plan.recipe && plan.recipe.hidden)) pair = [a, b];
    }
    assert(pair, 'some pair can merge among 24');
    const res = Game.merge({ monster: pair[0] }, { monster: pair[1] });
    assert(res.ok, 'merge failed ' + JSON.stringify({ ok: res.ok, reason: res.reason, a: pair[0].type, b: pair[1].type }));
    assert.strictEqual(Game.monsters.length, 24 - res.materials.length + 1, 'merge frees a spot');
    assert.strictEqual(res.materials.length, res.kind === 'grade' ? 3 : 2, 'grade merge uses 3, recipe 2');
    while (Game.monsters.length < 23) Game.place('orc_guard', ...[...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r)));
}
assert.strictEqual(Game.monsters.length, 23, 'merge frees a spot');
g0 = Game.gold;
const costNow = Game.summonCost();
assert(Game.summon().ok, 'summon again after merge');
assert.strictEqual(Game.monsters.length, 24);
assert.strictEqual(Game.gold, g0 - costNow);
tick(1);

// 아래는 끌기·합치기 시험. 맵을 비우고 정한 칸에 몬스터를 놓는다
Game.monsters = [];
Fx.pops = [];
Game.gold = 1000;
Game.place('skeleton_archer', 3, 4);
Game.place('dark_mage', 7, 4);
Game.place('orc_guard', 9, 4);

// 맵의 몬스터를 누르면(끌지 않고 떼면) 정보 팝업: 공개 조합식과 판매가 나오고 강화 버튼은 없다
const mage0 = Game.monsterAt(7, 4);
click(...monXY(mage0));
assert.strictEqual(UI.selectedMonster, mage0);
UI.update(0);
assert(UI.popup && UI.popup.type === 'dark_mage');
assert.strictEqual(UI.popup.recipes.map(r => r.partner + '>' + r.result).join(), 'skeleton_archer>curse_shooter,orc_guard>orc_berserker,fire_imp>nightmare_jester,goblin_spearman>orc_shaman');
assert(hasBtn('sell') && !hasBtn('up2') && !hasBtn('up3A'), 'sell only, upgrade hidden');
assert.strictEqual(MONSTER_UPGRADE_ENABLED, false);
// 고른 몬스터와 합칠 수 있는 대상: 조합식이면 결과, 같은 등급이면 다음 등급
assert.strictEqual(UI.shownPlan({ type: 'dark_mage' }, { type: 'skeleton_archer' }).result, 'curse_shooter');
assert.strictEqual(UI.shownPlan({ type: 'dark_mage' }, { type: 'dark_mage' }).grade, 'rare');
// 히든 조합식은 미리 보이지 않는다: 공개 목록에 없고, 화면에는 합칠 수 없는 쌍으로 보인다
assert(!publicRecipesFor('orc_berserker').some(r => r.partner === 'skeleton_archer'), 'hidden recipe not listed');
assert.notStrictEqual(UI.shownPlan({ type: 'orc_berserker' }, { type: 'skeleton_archer' }).kind, 'recipe');
assert.strictEqual(mergePlan('orc_berserker', 'skeleton_archer').kind, 'recipe');
// 서로 다른 일반 몬스터 중 조합식이 없는 쌍은 등급 합치기다
assert.strictEqual(mergePlan('orc_guard', 'skeleton_archer').kind, 'grade');
click(...monXY(mage0)); // 같은 몬스터를 다시 누르면 닫는다
assert.strictEqual(UI.selectedMonster, null);

// 끌기를 시작하면 놓을 칸 미리보기가 나온다. 길 칸은 빨간색, 길 옆 칸은 놓을 수 있다
const archer1 = Game.monsterAt(3, 4);
UI.onMove(...monXY(archer1));
UI.onDown(...monXY(archer1));
assert(!UI.drag, 'press alone is not a drag');
UI.onMove(monXY(archer1)[0] + 4, monXY(archer1)[1] - 4);
assert(!UI.drag, 'tiny move is not a drag');
UI.onMove(...cellXY(2, 3));
assert(UI.drag && UI.drag.type === 'skeleton_archer', 'dragging');
assert(UI.hoverCell && UI.hoverCell.col === 2 && UI.hoverCell.row === 3);
assert(!UI.canPlaceAt(2, 3), 'path cell is red');
UI.onMove(...cellXY(4, 5));
assert(UI.canPlaceAt(4, 5), 'build cell ok');
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'place');
// Esc로 끌기를 그만두면 제자리에 그대로 남는다
UI.onKey('Escape');
assert(!UI.drag);
UI.onUp(...cellXY(4, 5));
assert.strictEqual(Game.monsterAt(3, 4), archer1);
assert.strictEqual(Game.monsterAt(4, 5), null);

// 놓을 수 없는 곳에 놓으면 안내하고 제자리로 돌아간다: 길 칸, 건설 칸이 아닌 곳, 하단 바
UI.toast = null;
dragTo(monXY(archer1), cellXY(2, 3));
assert.strictEqual(Game.monsterAt(3, 4), archer1, 'not on path');
assert(UI.toast && UI.toast.text.includes('길'), 'path toast');
assert(UI.returning.length > 0, 'fly back effect');
UI.toast = null;
dragTo(monXY(archer1), cellXY(12, 13));
assert(!isBuildCell(12, 13) && Game.monsterAt(3, 4) === archer1);
assert(UI.toast && UI.toast.text.includes('길 옆'), 'not build cell toast');
dragTo(monXY(archer1), [BAR_SLOT_X + 20, GAME_HEIGHT - 40]);
assert.strictEqual(Game.monsterAt(3, 4), archer1, 'dropped on bar');
// 이미 몬스터가 있는 칸 위에 놓으면 합치기로 본다(일반끼리라 등급 합치기 미리보기)
const orc9 = Game.monsterAt(9, 4);
UI.onMove(...monXY(orc9));
UI.onDown(...monXY(orc9));
UI.onMove(...monXY(archer1));
assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'merge');
UI.cancel();
UI.onUp(...monXY(archer1));
assert(Game.monsterAt(9, 4) === orc9 && Game.monsterAt(3, 4) === archer1);

// 끌어 옮기기: 맵의 몬스터를 다른 빈 길 옆 칸으로. 원래 칸은 빈다(비용 없음)
const goldBeforeMove = Game.gold;
dragTo(monXY(archer1), cellXY(4, 5));
assert.strictEqual(Game.monsterAt(4, 5), archer1, 'moved');
assert.strictEqual(Game.monsterAt(3, 4), null, 'old cell freed');
assert(archer1.x === tileX(4) && archer1.homeY === tileY(5));
assert.strictEqual(Game.gold, goldBeforeMove, 'move is free');
// 길로는 옮길 수 없고 제자리에 남는다
UI.toast = null;
dragTo(monXY(archer1), cellXY(5, 7));
assert.strictEqual(Game.monsterAt(4, 5), archer1, 'stays');
assert(UI.toast && UI.toast.text.includes('길'));
// 맵의 몬스터를 누르면 정보 팝업
click(...monXY(archer1));
assert.strictEqual(UI.selectedMonster, archer1);
UI.update(0);
assert(UI.popup && UI.popup.monster === archer1 && hasBtn('sell') && !hasBtn('up2'));
UI.clearSelection();

// 조합식: 암흑 마법사를 스켈레톤 궁수 위에 → 저주 사수가 궁수 자리에 남고 마법사 자리는 빈다
Fx.pops = [];
const mergedBefore = Game.stats.merged;
dragTo(monXY(mage0), monXY(archer1));
const shooter = Game.monsterAt(4, 5);
assert(shooter && shooter.type === 'curse_shooter', 'recipe result at target');
assert(archer1.removed && !Game.monsters.includes(archer1));
assert(mage0.removed && Game.monsterAt(7, 4) === null, 'source freed');
assert(shooter.reveal > 0, 'result appears after suck-in');
assert(Fx.pops.some(p => p.kind === 'merge' && p.type === 'curse_shooter' && p.grade === 'rare' && !p.hidden));
assert.strictEqual(Fx.discovery, null, 'public recipe: no discovery');
assert.strictEqual(Game.stats.merged, mergedBefore + 1);
tick(0.5);
assert(!(shooter.reveal > 0), 'revealed');
// 순서는 상관없다: 궁수를 마법사 위에 놓아도 같은 결과(마법사 자리에 남는다)
Game.place('dark_mage', 7, 4);
Game.place('skeleton_archer', 3, 4);
dragTo(monXY(Game.monsterAt(3, 4)), monXY(Game.monsterAt(7, 4)));
assert.strictEqual(Game.monsterAt(7, 4).type, 'curse_shooter', 'reverse order recipe');
assert.strictEqual(Game.monsterAt(3, 4), null, 'source freed');
const shooter2 = Game.monsterAt(7, 4);

// 히든 조합식: 오크 광전사 + 스켈레톤 궁수 → 해골 기사. 처음이면 "히든 조합 발견!"
Game.place('orc_berserker', 3, 2);
Game.place('skeleton_archer', 4, 4);
tick(0.1);
dragTo(monXY(Game.monsterAt(3, 2)), monXY(Game.monsterAt(4, 4)));
assert.strictEqual(Game.monsterAt(4, 4).type, 'bone_knight', 'hidden recipe result');
assert.strictEqual(Game.monsterAt(3, 2), null);
assert(Fx.discovery && Fx.discovery.type === 'bone_knight', 'hidden discovered');
assert(Meta.data.recipes.includes('orc_berserker+skeleton_archer') && Meta.hasSeen('bone_knight'), 'hidden recipe and result kept in the meta record');
assert(Fx.pops.some(p => p.kind === 'merge' && p.hidden && p.grade === 'epic'));
tick(4.2);
assert.strictEqual(Fx.discovery, null);
// 두 번째부터는 발견 연출이 없다
Game.place('skeleton_archer', 3, 2);
Game.place('orc_berserker', 7, 6);
tick(0.1);
dragTo(monXY(Game.monsterAt(7, 6)), monXY(Game.monsterAt(3, 2)));
assert.strictEqual(Game.monsterAt(3, 2).type, 'bone_knight');
assert.strictEqual(Fx.discovery, null, 'discovered only once');
assert.strictEqual(Meta.data.recipes.filter(k => k === 'orc_berserker+skeleton_archer').length, 1, 'recorded once');
tick(0.5);

// 같은 등급이 3마리 미만이면 합치지 않는다(영웅 2마리뿐): 안내하고 둘 다 그대로
const kA = Game.monsterAt(3, 2), kB = Game.monsterAt(4, 4);
UI.toast = null;
dragTo(monXY(kA), [kB.homeX * WORLD_ZOOM, (kB.homeY - 10) * WORLD_ZOOM]);
assert(Game.monsterAt(3, 2) === kA && Game.monsterAt(4, 4) === kB, 'two epics refused');
assert(UI.toast && UI.toast.text.includes('3마리') && UI.toast.text.includes('2마리'), 'count toast: ' + (UI.toast && UI.toast.text));
assert.strictEqual(Game.mergePlanFor(kA, kB).reason, 'count');
assert.strictEqual(mergePlan('bone_knight', 'bone_knight').grade, 'legendary', 'epics now merge into legendary');

// 합칠 수 없는 경우: 등급이 다르고 조합식도 없다
UI.toast = null;
Game.place('skeleton_archer', 7, 6);
dragTo(monXY(Game.monsterAt(7, 6)), [kB.homeX * WORLD_ZOOM, (kB.homeY - 10) * WORLD_ZOOM]);
assert(Game.monsterAt(7, 6).type === 'skeleton_archer' && Game.monsterAt(4, 4) === kB, 'mismatch refused');
assert(UI.toast && UI.toast.text.includes('합칠 수 없'));
assert.strictEqual(mergePlan('skeleton_archer', 'curse_shooter').reason, 'mismatch');
Game.removeMonster(Game.monsterAt(7, 6));

// 등급 합치기: 같은 등급 3마리(조합식 없음) → 상위 등급 중 무작위. 셋째 재료(9,4 오크 경비병)는 자동으로 정한다
Game.place('orc_guard', 3, 6);
Game.place('orc_guard', 9, 6);
const orcGuard = Game.monsterAt(3, 6);
const orc94 = Game.monsterAt(9, 4);
withRandom(0.01, () => dragTo(monXY(Game.monsterAt(9, 6)), monXY(orcGuard)));
const berserker = Game.monsterAt(3, 6);
assert(berserker && berserker.type === 'orc_berserker', 'grade merge picks rare[0] with random 0.1');
assert(orc94.removed && !Game.monsterAt(9, 4) && !Game.monsterAt(9, 6), 'three materials used, result on the dropped cell');
assert(berserker.blocks && berserker.rally, 'berserker walks out to block');
assert.strictEqual(monsterStats(berserker).block, 2);
// 무작위 값이 크면 같은 등급의 다른 몬스터
Game.place('dark_mage', 9, 6);
Game.place('dark_mage', 9, 2);
Game.place('zombie', 7, 6);
withRandom(0.1, () => dragTo(monXY(Game.monsterAt(9, 6)), monXY(Game.monsterAt(9, 2))));
assert.strictEqual(Game.monsterAt(9, 2).type, 'curse_shooter');
tick(0.5);
// 희귀 2마리 조합식(오크 광전사 + 저주 사수 → 해골 기사). 조합식은 등급 합치기보다 먼저다
dragTo(monXY(shooter), [berserker.homeX * WORLD_ZOOM, (berserker.homeY - 10) * WORLD_ZOOM]);
const knight = Game.monsterAt(3, 6);
assert(knight && knight.type === 'bone_knight', 'field + field recipe');
assert.strictEqual(Game.monsterAt(4, 5), null);
assert.strictEqual(monsterStats(knight).hp, 500);
// 희귀 2마리, 조합식 없음 → 영웅 등급 합치기
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').kind, 'grade');
assert.strictEqual(mergePlan('curse_shooter', 'curse_shooter').grade, 'epic');
tick(0.5);

// 랭크 조건 조합식(히든, 전설): 해골 기사 A 이상 + 저주 사수 A 이상 → 죽음의 군주
{
    const freeCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
    const put = (type, rank) => {
        const [c, r] = freeCell();
        const m = Game.place(type, c, r);
        setMonsterRank(m, rankIndex(rank));
        return m;
    };
    const kA = { type: 'bone_knight', rank: rankIndex('A') }, kB = { type: 'bone_knight', rank: rankIndex('B') }, kS = { type: 'bone_knight', rank: rankIndex('S') };
    const sA = { type: 'curse_shooter', rank: rankIndex('A') }, sB = { type: 'curse_shooter', rank: rankIndex('B') };
    // 충족: 재료 순서를 바꿔도 같다. 더 높은 랭크도 된다
    assert.strictEqual(mergePlan(kA, sA).result, 'death_lord', 'rank condition met');
    assert.strictEqual(mergePlan(sA, kA).result, 'death_lord', 'reverse order');
    assert.strictEqual(mergePlan(kS, sA).result, 'death_lord', 'higher rank ok');
    // 미달: 조합식이 없는 것처럼 평소 규칙(영웅 + 희귀는 등급이 달라 합칠 수 없다). 랭크 없는 문자열은 D로 본다
    assert.strictEqual(mergePlan(kB, sA).reason, 'mismatch', 'a side below rank');
    assert.strictEqual(mergePlan(kS, sB).reason, 'mismatch', 'b side below rank');
    assert.strictEqual(mergePlan(sB, kS).reason, 'mismatch', 'reverse order below rank');
    assert.strictEqual(mergePlan('bone_knight', 'curse_shooter').reason, 'mismatch');
    // 조건 없는 조합식은 랭크와 관계없이 그대로
    assert.strictEqual(mergePlan({ type: 'skeleton_archer', rank: 4 }, { type: 'dark_mage', rank: 0 }).result, 'curse_shooter');
    assert.strictEqual(mergePlan({ type: 'orc_berserker', rank: 2 }, 'skeleton_archer').result, 'bone_knight');
    assert.strictEqual(mergePlan('orc_berserker', 'curse_shooter').result, 'bone_knight');
    // 히든은 미리 보여 주지 않는다: 공개 목록에 없고 화면에는 '???'(등급이 달라 등급 합치기도 아님)
    assert(!publicRecipesFor('bone_knight').some(r => r.result === 'death_lord') && !publicRecipesFor('curse_shooter').some(r => r.result === 'death_lord'));
    assert.strictEqual(UI.shownPlan(kA, sA).kind, 'unknown', 'hidden legend not shown');
    assert.strictEqual(UI.shownPlan(kB, sA).kind, 'none', 'below rank: cannot merge');

    // 끌어 합치기(맵): 저주 사수 A를 해골 기사 S 위에 → 죽음의 군주가 기사 자리에, 랭크는 낮은 쪽 A
    Fx.pops = [];
    const knight = put('bone_knight', 'S');
    const shooter = put('curse_shooter', 'A');
    // 끌기 미리보기도 같은 판단을 쓴다(합칠 수 있지만 히든이라 '???')
    UI.onMove(...monXY(shooter));
    UI.onDown(...monXY(shooter));
    UI.onMove(...monXY(knight));
    const act = UI.dropAction(UI.dropTarget);
    assert(act.action === 'merge' && act.plan.kind === 'unknown', 'drag preview hides legend');
    UI.cancel();
    UI.onUp(...monXY(knight));
    dragTo(monXY(shooter), monXY(knight));
    const lord = Game.monsterAt(knight.col, knight.row);
    assert(lord && lord.type === 'death_lord', 'legend merged');
    assert(shooter.removed && Game.monsterAt(shooter.col, shooter.row) === null);
    assert.strictEqual(lord.rank, rankIndex('A'), 'result inherits lower rank');
    assert.strictEqual(monsterStats(lord).hp, 900 * MONSTER_RANKS[rankIndex('A')].mul);
    assert.strictEqual(monsterStats(lord).block, 8);
    assert(lord.blocks, 'tank walks out');
    assert.strictEqual(monsterAbility('death_lord', 'deathStun').radius, 3);
    assert.strictEqual(monsterAbility('death_lord', 'deathStun').duration, 2);
    // 처음 발견: 히든 연출, 재료 줄에 랭크 조건, 전설은 더 길게
    const d = Fx.discovery;
    assert(d && d.type === 'death_lord' && d.grade === 'legendary', 'legend discovered');
    assert(d.a === 'bone_knight' && d.aRank === 'A' && d.b === 'curse_shooter' && d.bRank === 'A', 'discovery shows ranks');
    assert(d.life > 3.6, 'legend discovery is longer');
    assert(Meta.data.recipes.includes('bone_knight:A+curse_shooter:A') && Meta.hasSeen('death_lord'), 'legend recipe kept in the meta record');
    assert(Fx.pops.some(p => p.kind === 'merge' && p.hidden && p.grade === 'legendary'));
    tick(5.5);
    assert.strictEqual(Fx.discovery, null);

    // 전설은 맵 제한이 없다(맵 제한은 신화 1마리뿐): 두 번째 죽음의 군주도 만든다. 두 번째부터는 발견 연출이 없다
    const k2 = put('bone_knight', 'A');
    const s2 = put('curse_shooter', 'A');
    assert.strictEqual(Game.mergePlanFor(s2, k2).kind, 'recipe');
    dragTo(monXY(k2), monXY(s2));
    assert.strictEqual(Game.monsterAt(s2.col, s2.row).type, 'death_lord');
    assert.strictEqual(Game.monsters.filter(m => m.type === 'death_lord').length, 2, 'two legends allowed');
    assert.strictEqual(Fx.discovery, null, 'legend discovered only once');
    tick(0.5);
    Game.removeMonster(Game.monsterAt(s2.col, s2.row));
    Game.removeMonster(lord);
}

// 판매: 등급별 고정 환불(일반 20, 희귀 60, 영웅 150)
assert.strictEqual(SUMMON_RULES.refund.common, 20);
g0 = Game.gold;
click(...monXY(shooter2)); // 저주 사수(희귀)
btn('sell');
assert.strictEqual(Game.gold, g0 + 60);
assert.strictEqual(Game.monsterAt(7, 4), null);
g0 = Game.gold;
click(...monXY(kA)); // 해골 기사(영웅)
btn('sell');
assert.strictEqual(Game.gold, g0 + 150);
g0 = Game.gold;
const orc9b = Game.monsterAt(9, 4) || Game.place('orc_guard', 9, 4); // 9,4 오크는 위 등급 합치기의 셋째 재료로 쓰였다
click(...monXY(orc9b)); // 오크 경비병(일반)
assert.strictEqual(UI.selectedMonster, orc9b);
btn('sell');
assert.strictEqual(Game.gold, g0 + 20);
Game.monsters = [];
UI.clearSelection();
Game.gold = 2000;

// 모든 몬스터는 길 칸에 놓을 수 없다
assert(!Game.canPlace('orc_guard', 30, 30) && !Game.canPlace('skeleton_archer', 0, 0), 'off map rejected');
for (const key of PATH_CELLS) {
    const [c, r] = key.split(',').map(Number);
    for (const t of Object.keys(MONSTERS)) assert(!Game.canPlace(t, c, r), 'no monster on path ' + key);
}

// 근접 몬스터를 길 옆에 놓으면 가장 가까운 길 지점으로 걸어 나간다
assert(Game.place('orc_guard', 3, 4));
const orc = Game.monsterAt(3, 4);
assert(orc && orc.blocks && orc.rally, 'orc placed beside path');
assert.strictEqual(orc.x, tileX(3));
assert.strictEqual(orc.rally.d, nearestPathPoint(tileX(3), tileY(4)).d);
assert.strictEqual(orc.rally.route, 'north');
assert(distance(orc.rally.x, orc.rally.y + MONSTER_FOOT - 10, pathAt(orc.rally.d).x, pathAt(orc.rally.d).y) < 1, 'rally on path');
tick(0.1);
assert(orc.moving, 'orc walks');
tick(1.5);
assert(!orc.moving && distance(orc.x, orc.y, orc.rally.x, orc.rally.y) <= 6, 'orc reached rally');
assert.strictEqual(Game.monsterAt(3, 4), orc, 'home cell stays taken');
assert(!Game.canPlace('skeleton_archer', 3, 4));
// 원거리 몬스터는 놓은 칸에 그대로 선다
Game.place('skeleton_archer', 4, 5);
Game.place('skeleton_archer', 5, 5);
Game.place('dark_mage', 3, 6);
tick(1);
const archer = Game.monsterAt(4, 5);
assert(!archer.blocks && archer.x === tileX(4) && archer.y === tileY(5), 'ranged stays on its cell');

// 정보 창: 놓은 칸을 눌러도, 길로 나간 몬스터를 눌러도 뜬다
UI.clearSelection();
cellClick(3, 4);
assert.strictEqual(UI.selectedMonster, orc, 'click home cell');
UI.clearSelection();
worldClick(orc.x, orc.y - 10);
assert.strictEqual(UI.selectedMonster, orc, 'click walked-out monster');
UI.update(0);
assert(UI.popup && UI.popup.monster === orc);
UI.clearSelection();
// 길로 나간 막는 몬스터도 끌어 옮길 수 있다: 새 칸에서 다시 걸어 나간다
dragTo([orc.x * WORLD_ZOOM, (orc.y - 10) * WORLD_ZOOM], cellXY(3, 2));
assert.strictEqual(Game.monsterAt(3, 2), orc, 'walked-out orc moved');
assert(orc.x === tileX(3) && orc.y === tileY(2) && orc.rally.d === nearestPathPoint(tileX(3), tileY(2)).d);
dragTo(monXY(orc), cellXY(3, 4));
assert.strictEqual(Game.monsterAt(3, 4), orc);
tick(1.6);

// 쓰러지면 8초 뒤 놓은 칸에서 다시 나와 길로 걸어간다
damageUnit(orc, 9999);
assert(orc.down > 0 && orc.hp === 0);
assert.strictEqual(orc.down, MONSTERS.orc_guard.stats.respawn);
assert(orc.x === orc.homeX && orc.y === orc.homeY, 'down at home cell');
tick(7.5);
assert(orc.down > 0, 'still waiting');
tick(0.6);
assert.strictEqual(orc.down, 0);
assert.strictEqual(orc.hp, orc.maxHp);
tick(0.1);
assert(orc.moving && distance(orc.x, orc.y, orc.homeX, orc.homeY) < 40, 'revived at home, walking out');
tick(1.5);
assert(distance(orc.x, orc.y, orc.rally.x, orc.rally.y) <= 6, 'back on rally');

// 다음 웨이브 시작
UI.onKey('Space');
assert.strictEqual(Game.state, 'wave');
tick(14);
assert(Game.stats.kills > 0 || Game.heroes.length > 0);

// 번개: Q는 몬스터 탭에서도 동작하고 마왕 탭으로 바꾼다. 끄던 몬스터는 제자리에 남는다
UI.onMove(...monXY(archer));
UI.onDown(...monXY(archer));
UI.onMove(...cellXY(7, 5));
assert(UI.drag && UI.tab === 'monster');
UI.onKey('KeyQ');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(UI.drag, null);
UI.onUp(...cellXY(7, 5));
assert.strictEqual(Game.monsterAt(4, 5), archer);
assert.strictEqual(Game.monsterAt(7, 5), null);
assert.strictEqual(UI.targeting, true);
UI.onKey('KeyQ');
assert.strictEqual(UI.targeting, false);
btn('lightning');
assert.strictEqual(UI.targeting, true);
worldClick(tileX(4), tileY(5));
assert.strictEqual(UI.targeting, false);
assert.strictEqual(Game.skills.lightning, COMBAT_RULES.lightning.cooldown * DEMON_LORDS.rift.effects.skillCooldown);
tick(0.5);

// 호통은 체력이 충분하면 막히고, 낮으면 쓸 수 있다. W도 마왕 탭으로 바꾼다
UI.onKey('Tab');
assert.strictEqual(UI.tab, 'monster');
UI.onKey('KeyW');
assert.strictEqual(UI.tab, 'demon');
assert.strictEqual(Game.skills.roar, 0);
Game.hp = 8;
UI.onKey('KeyW');
assert.strictEqual(Game.skills.roar, COMBAT_RULES.roar.cooldown * DEMON_LORDS.rift.effects.skillCooldown);
Game.hp = 20;

// 타락은 꺼져 있다: 시체를 눌러도 아무 일이 없고, 시체는 쓰러지는 동작 뒤 1초쯤 사라지며, 몬스터 끌기를 가로막지 않는다
assert.strictEqual(CORRUPTION_ENABLED, false);
{
    Game.corpses.length = 0;
    const h = createHero('warrior', 0, 0, false);
    h.waiting = false;
    Game.heroes.push(h);
    const goldBefore = Game.gold;
    damageHero(h, 9999);
    assert.strictEqual(Game.gold, goldBefore + h.bounty, 'bounty unchanged');
    const c = Game.corpses[0];
    assert(c && Math.abs(c.life - (HEROES.warrior.anim.death.frames / CORPSE_FALL_FPS + CORPSE_FADE_TIME)) < 1e-9, 'corpse fades after fall');
    const gold = Game.gold, units = Game.units.length;
    worldClick(c.x, c.y - 20);
    assert.strictEqual(Game.gold, gold, 'corpse click ignored');
    assert.strictEqual(Game.units.length, units);
    assert.strictEqual(UI.corpseAt(c.x, c.y - 20), null);
    assert.strictEqual(corruptCorpse(c).reason, 'disabled');
    UI.clearSelection();
    // 시체를 몬스터 바로 위에 두어도 몬스터를 끌 수 있다
    const m = Game.monsters[0];
    assert(m, 'a monster to drag');
    const c2 = { ...c, x: m.x, y: m.y + 10, age: 0 };
    Game.corpses.push(c2);
    UI.update(0);
    UI.onMove(...monXY(m));
    UI.onDown(...monXY(m));
    assert(UI.press && UI.press.src.monster === m, 'corpse does not block monster press');
    UI.onMove(monXY(m)[0] + 200, monXY(m)[1]);
    assert(UI.drag, 'drag starts over corpse');
    UI.cancelDrag();
    UI.press = null;
    UI.update(0);
    tick(c.life + 0.2);
    assert(!Game.corpses.includes(c) && !Game.corpses.includes(c2), 'corpses fade out'); // 전투 중이라 새 시체는 생길 수 있다
}
// 쓰러지는 동작이 없는 정예(Asteria 그림)의 시체는 걷는 그림을 눕혀 그린다: skin이 있어야 그리기가 멈추지 않는다
{
    const e = createHero('elite_swordsman', 0, 0, false);
    e.waiting = false;
    Game.heroes.push(e);
    const before = Game.corpses.length;
    damageHero(e, 1e9);
    const ec = Game.corpses[Game.corpses.length - 1];
    assert(Game.corpses.length === before + 1 && ec.type === 'elite_swordsman', 'elite leaves a corpse');
    assert(!HEROES.elite_swordsman.anim.death && ec.skin === HEROES.elite_swordsman && ec.skin.anim.walk.frames > 0, 'elite corpse uses its walking art');
}

// 타락: 비용 차감, 부하 생성, 최대 인원 제한. 꺼 둔 기능도 계속 검증하도록 잠시 켠다
CORRUPTION_ENABLED = true;
Game.corpses.length = 0; // 전투로 생긴 시체가 클릭 위치에 겹치면 그쪽이 먼저 선택된다
Game.corpses.push({ type: 'warrior', female: false, x: tileX(4), y: tileY(5), d: 800, dir: 'down', age: 0, life: 5, cost: 15 });
const goldBefore = Game.gold;
worldClick(tileX(4), tileY(5) - 30);
assert.strictEqual(Game.gold, goldBefore - 15);
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 1);
for (let i = 0; i < 2; i++) corruptCorpse({ type: 'rogue', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 18 });
assert.strictEqual(Game.units.filter(u => u.kind === 'corrupt').length, 3);
assert.strictEqual(corruptCorpse({ type: 'mage', female: true, x: 400, y: 300, d: 300, dir: 'down', cost: 24 }).reason, 'limit');
CORRUPTION_ENABLED = false;

// 정예: 같은 직업 기준 배율, 왕좌 피해 3, 시체와 타락
const ew = HEROES.elite_swordsman, et = HEROES.elite_tamer, es = HEROES.elite_stormcaller;
assert.strictEqual(ew.hp, HEROES.warrior.hp * 4);
assert.strictEqual(ew.armor, 4);
assert.strictEqual(et.speed, 1.3);
assert.strictEqual(es.stunEvery, 4);
assert.strictEqual(es.stunRange, 4);
assert.strictEqual(es.bounty, HEROES.mage.bounty * 3);
assert(ew.anim && ew.sprite === 'ast_elite_adv_nightExecutioner' && ew.anim.attack.frames === 2 && !ew.anim.death, 'elite uses Asteria art');
assert.strictEqual(CORRUPTED.elite_tamer.hp, CORRUPTED.rogue.hp * 2);
assert.strictEqual(CORRUPTED.elite_tamer.damage, CORRUPTED.rogue.damage * 2);
assert(!WAVES[0].elites && !WAVES[1].elites && WAVES[2].elites && WAVES.filter(w => w.elites).length >= 12, 'elites from wave 3, then every 5 rounds');
{
    const hpBefore = Game.hp;
    const e = createHero('elite_swordsman', 3, 0, false);
    e.waiting = false;
    e.d = ROUTES.north.length - 57;
    Game.heroes.push(e);
    updateHero(e, 0.1);
    assert(e.arrived, 'elite reached throne');
    assert.strictEqual(Game.hp, hpBefore - 3);
    Game.hp = 20;
    const k = createHero('elite_stormcaller', 4, 0, false);
    k.waiting = false;
    Game.heroes.push(k);
    CORRUPTION_ENABLED = true;
    const corpsesBefore = Game.corpses.length;
    damageHero(k, 9999);
    const corpse = Game.corpses[Game.corpses.length - 1];
    assert.strictEqual(Game.corpses.length, corpsesBefore + 1);
    assert.strictEqual(corpse.type, 'elite_stormcaller');
    Game.units = Game.units.filter(u => u.kind !== 'corrupt');
    Game.gold += corpse.cost;
    assert(corruptCorpse(corpse).ok);
    const cu = Game.units.find(u => u.heroType === 'elite_stormcaller');
    assert.strictEqual(cu.maxHp, CORRUPTED.mage.hp * 2);
    assert(cu.ranged);
    CORRUPTION_ENABLED = false;
}

// 정예 직업 능력. 아래 블록은 Game 목록을 직접 바꾸고, 다음 '다시 시작'에서 모두 초기화된다.
const er = HEROES.elite_rhapsodist;
assert(er.anim && er.sprite === 'ast_elite_adv_eclipseArchsage_luna' && er.song && !er.stunEvery, 'rhapsodist: Asteria art, song, no stun');
assert(WAVES.some(w => w.elites && w.elites.elite_rhapsodist), 'rhapsodist appears in some wave');
// 용사 하나를 길 위 거리 d, 길 한가운데(lane 0)에 세운다
const place = (type, d, bossKey) => {
    const h = createHero(type, 0, 0, bossKey);
    Object.assign(h, { waiting: false, d, lane: 0, cast: 99, song: 99 });
    Game.heroes.push(h);
    return h;
};
const fakeOrc = (x, y) => {
    const u = createMonster('orc_guard', 1, 1);
    Object.assign(u, { x, y, homeX: x, homeY: y, rally: { route: nearestPathPoint(x, y).route, d: nearestPathPoint(x, y).d, x, y }, hp: 9999, maxHp: 9999 });
    Game.monsters.push(u);
    return u;
};
const fakeFacility = (x, y) => { const f = { x, y, stun: 0 }; Game.monsters.push(f); return f; };
const clearBoard = () => { Game.heroes = []; Game.units = []; Game.monsters = []; Game.telegraphs = []; };
{
    // 음유시인: 반경 3 안 용사(자신 포함) 가속 25%, 3초 뒤 풀린다. 반경 밖은 받지 않는다
    clearBoard();
    const bard = place('elite_rhapsodist', 300);
    const near = place('warrior', 300 + 2 * TILE);
    const far = place('warrior', 300 + 9 * TILE);
    const gap = (a, b) => distance(heroWorld(a).x, heroWorld(a).y, heroWorld(b).x, heroWorld(b).y) / TILE;
    assert(gap(bard, near) < er.song.radius && gap(bard, far) > er.song.radius + 0.5, 'test layout');
    bard.song = 0.01;
    updateHero(bard, 0.02);
    assert.strictEqual(near.haste, er.song.duration, 'near hero buffed');
    assert.strictEqual(near.hasteMul, er.song.speedMul);
    assert(bard.haste > 0, 'bard buffs itself');
    assert.strictEqual(far.haste, 0, 'far hero not buffed');
    let d0 = near.d;
    updateHero(near, 0.1);
    assert(Math.abs((near.d - d0) - near.speed * 1.25 * 0.1) < 1e-6, 'buffed speed x1.25');
    for (let i = 0; i < 31; i++) updateHero(near, 0.1);
    assert.strictEqual(near.haste, 0, 'buff expired');
    d0 = near.d;
    updateHero(near, 0.1);
    assert(Math.abs((near.d - d0) - near.speed * 0.1) < 1e-6, 'speed back to normal');
    // 혼자면 노래를 아낀다
    clearBoard();
    const alone = place('elite_rhapsodist', 300);
    alone.song = 0.01;
    updateHero(alone, 0.02);
    assert.strictEqual(alone.haste, 0, 'lonely bard waits');
}
{
    // 뇌술사: 경고 원 0.5초 → 사거리 4 안 몬스터 전부 1.5초 정지. 경고 동안 걷지 않는다
    clearBoard();
    const es = HEROES.elite_stormcaller;
    const k = place('elite_stormcaller', 600);
    const w = heroWorld(k);
    const f1 = fakeFacility(w.x + 2 * TILE, w.y);
    const f2 = fakeFacility(w.x, w.y + 3.5 * TILE);
    const fOut = fakeFacility(w.x + 4.5 * TILE, w.y);
    const orc = fakeOrc(w.x - TILE, w.y + TILE);
    assert.strictEqual(stunTargets(w.x, w.y, es.stunRange * TILE).length, 3, 'stunTargets: facilities and monsters in range');
    k.cast = 0.01;
    updateHero(k, 0.02);
    assert(k.windup > 0 && Game.telegraphs.length === 1, 'shock warning circle');
    assert.strictEqual(Game.telegraphs[0].radius, es.stunRange * TILE);
    assert(Game.telegraphs[0].color, 'shock warning is blue');
    assert(f1.stun === 0 && orc.stun === 0, 'not stunned during warning');
    const dWarn = k.d;
    for (let i = 0; i < 4; i++) updateHero(k, 0.1);
    assert.strictEqual(k.d, dWarn, 'caster stands still while warning');
    for (let i = 0; i < 2; i++) updateHero(k, 0.1);
    assert(f1.stun > 1 && f2.stun > 1 && orc.stun > 1, 'all in range stunned');
    assert(f1.stun <= es.stunTime && orc.stun <= es.stunTime);
    assert.strictEqual(fOut.stun, 0, 'out of range not stunned');
    // 정지한 몬스터는 때리지 않는다
    const atkBefore = orc.atk;
    updateMonster(orc, 0.1);
    assert.strictEqual(orc.atk, atkBefore, 'stunned orc idle');
    // 일반 마법사는 그대로 한 대상만 정지시킨다(대상 목록은 같은 함수에서 얻는다)
    clearBoard();
    const m = place('mage', 600);
    const mw = heroWorld(m);
    const a = fakeFacility(mw.x + TILE, mw.y);
    const b2 = fakeOrc(mw.x - 2 * TILE, mw.y);
    m.cast = 0.01;
    updateHero(m, 0.02);
    assert(a.stun > 0 && !(b2.stun > 0), 'mage stuns only the nearest');
}
{
    // 검사: 막힌 뒤 2초가 지나면 막은 유닛을 밀치고 지나간다
    clearBoard();
    const br = HEROES.elite_swordsman.breakthrough;
    const s = place('elite_swordsman', 600);
    const w = heroWorld(s);
    const orc = fakeOrc(w.x + 20, w.y + 30);
    s.blocker = orc;
    orc.target = s;
    updateHero(s, br.after - 0.1);
    assert.strictEqual(s.blocker, orc, 'still blocked before 2s');
    const ox = orc.x, oy = orc.y;
    updateHero(s, 0.2);
    assert.strictEqual(s.blocker, null, 'broke through');
    assert(distance(ox, oy, orc.x, orc.y) > br.push * TILE * 0.99, 'orc pushed aside');
    assert(orc.stun > 0 && s.slip > 0, 'orc stunned, swordsman slips');
    assert(!canBlockHero(orc, s), 'cannot re-block while slipping');
    const d0 = s.d;
    updateHero(s, 0.5);
    assert(s.d > d0, 'swordsman walks on');
    // 일반 전사는 돌파하지 않는다
    const wr = place('warrior', 600);
    wr.blocker = orc;
    updateHero(wr, 5);
    assert.strictEqual(wr.blocker, orc, 'warrior stays blocked');
}
{
    // 조련사: 오크에게 막히지 않고 지나간다. 타락 유닛에게는 막힌다
    clearBoard();
    const p = pathAt(900);
    const orc = fakeOrc(p.x, p.y);
    const tamer = place('elite_tamer', 900 - 2 * TILE);
    const rogue = place('rogue', 900 - 2 * TILE);
    assert(!canBlockHero(orc, tamer) && canBlockHero(orc, rogue));
    assert(canBlockHero({ kind: 'corrupt' }, tamer), 'corrupt units still block tamer');
    let tamerBlocked = false;
    for (let i = 0; i < 90; i++) {
        updateMonster(orc, 1 / 30);
        updateHero(tamer, 1 / 30);
        updateHero(rogue, 1 / 30);
        if (tamer.blocker) tamerBlocked = true;
    }
    assert(!tamerBlocked && tamer.d > 900 + TILE, 'tamer walked past orc');
    assert.strictEqual(rogue.blocker, orc, 'rogue blocked by orc');
}
{
    // 대마도사: 부대장과 같은 체력 체계, 50%에 범위 감전, 25%에 넓은 범위 감전(경고 표시)
    clearBoard();
    const def = BOSSES.archmage;
    const boss = place(null, 700, 'archmage');
    const knight = createHero(null, 0, 0, 'fallen_knight');
    assert(boss.boss && !boss.elite && boss.bossKey === 'archmage' && boss.name === def.name);
    assert.strictEqual(boss.maxHp, knight.maxHp * def.waveHpMul, 'fallen knight hp x waveHpMul');
    assert.strictEqual(boss.throneDamage, def.throneDamage);
    // 이야기 보스는 Asteria 그림이고 경고 중에는 시전 자세를 반복한다
    assert(def.art.sprite === 'ast_boss_story_archmage' && def.art.anim.attack.frames === 2 && def.art.windupLoop);
    assert(BOSSES.fallen_knight.art.sprite === 'ast_boss_story_captain' && !BOSSES.fallen_knight.art.windupLoop);
    assert(STORY_CAST.archmage.portrait.sprite === 'ast_boss_story_archmage/rotations/south' && STORY_CAST.captain.portrait.sprite === 'ast_boss_story_captain/rotations/south');
    const [p1, p2] = def.patterns;
    assert(p1.at === 0.5 && p1.kind === 'shock' && p2.at === 0.25 && p2.kind === 'shock' && p2.range > p1.range);
    const w = heroWorld(boss);
    const fNear = fakeFacility(w.x + (p1.range - 0.5) * TILE, w.y);
    const fWide = fakeFacility(w.x, w.y + (p2.range - 0.5) * TILE);
    const orc = fakeOrc(w.x - TILE, w.y);
    updateHero(boss, 0.1);
    assert.strictEqual(boss.windup, 0, 'no pattern at full hp');
    boss.hp = boss.maxHp * 0.49;
    updateHero(boss, 0.05);
    assert(boss.windup > 0 && Game.telegraphs.length === 1 && Game.telegraphs[0].radius === p1.range * TILE, 'first shock warning');
    for (let i = 0; i < Math.ceil(p1.windup / 0.1) + 1; i++) updateHero(boss, 0.1);
    assert(fNear.stun > 0 && orc.stun > 0, 'first shock hits near');
    assert.strictEqual(fWide.stun, 0, 'first shock does not reach wide');
    boss.hp = boss.maxHp * 0.24;
    updateHero(boss, 0.05);
    const t2 = Game.telegraphs[Game.telegraphs.length - 1];
    assert(boss.windup > 0 && t2.radius === p2.range * TILE && t2.color, 'second wide shock warning');
    for (let i = 0; i < Math.ceil(p2.windup / 0.1) + 1; i++) updateHero(boss, 0.1);
    assert(fWide.stun > 0, 'wide shock hits far');
    assert(boss.patternsDone[0] && boss.patternsDone[1]);
    // 웨이브 표의 boss 한 칸만 바꾸면 대마도사가 나온다. 이름 배너와 보스 체력바가 쓰는 값도 확인한다
    clearBoard();
    const last = WAVES[WAVES.length - 1];
    assert.strictEqual(last.boss, 'fallen_knight', 'boss wave keeps fallen knight');
    last.boss = 'archmage';
    Game.waveIndex = WAVES.length - 1;
    Game.state = 'prep';
    Game.startWave();
    const spawned = Game.heroes.find(h => h.boss);
    assert(spawned && spawned.bossKey === 'archmage' && spawned.name === def.name);
    assert.strictEqual(Fx.banner.name, def.name);
    assert.strictEqual(Fx.banner.portrait, def.portrait);
    last.boss = 'fallen_knight';
}

// 몬스터 능력: 표의 abilities(종류와 값)로 동작한다. 처음 일반 3종은 능력이 없다
assert.strictEqual(gradePool('common').slice(0, 3).map(t => MONSTERS[t].abilities.length).join(), '0,0,0', 'first common monsters have no ability');
// 능력 종류 14개가 모두 표의 어딘가에 쓰이고, 설명 문구는 표(ABILITY_KINDS)에서 만든다
{
    const used = new Set();
    for (const t of Object.keys(MONSTERS)) for (const a of MONSTERS[t].abilities) used.add(a.kind);
    assert.strictEqual([...used].sort().join(), Object.keys(ABILITY_KINDS).filter(k => k !== 'frenzy').sort().join(), 'every ability kind used');
    assert.strictEqual(Object.keys(ABILITY_KINDS).length, 15);
    assert.strictEqual(ABILITY_KINDS.burnShot.desc(monsterAbility('fire_imp', 'burnShot')), '맞은 용사가 2초간 초당 3 화상 피해');
    assert.strictEqual(ABILITY_KINDS.aura.desc(monsterAbility('orc_shaman', 'aura')), '2.5칸 안 몬스터 피해 +20%(겹치지 않음)');
    assert.strictEqual(ABILITY_KINDS.aura.desc(monsterAbility('wisp_acolyte', 'aura')), '2칸 안 몬스터 체력 회복 초당 3(겹치지 않음)');
    assert.strictEqual(ABILITY_KINDS.stunShot.desc(monsterAbility('nightmare_jester', 'stunShot')), '맞으면 20% 확률로 1초 기절(보스 제외)');
    assert.strictEqual(MONSTERS.archlich.abilities.map(a => a.kind).join(), 'chain,aura');
    assert.strictEqual(MONSTERS.hell_general.abilities.map(a => a.kind).join(), 'cleave,enrage');
}
// 코드에 몬스터 이름별 분기가 없다(새 16종 id는 데이터에만)
{
    const code = ${JSON.stringify(['js/game/monster.js', 'js/game/combat.js', 'js/game/hero.js', 'js/game/unit.js', 'js/game/game.js', 'js/game/render.js', 'js/ui/ui.js']
        .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'))};
    for (const id of ['goblin_spearman', 'zombie', 'fire_imp', 'gnoll_hunter', 'wisp_acolyte', 'werewolf', 'troll', 'frost_witch', 'nightmare_jester',
        'orc_shaman', 'minotaur', 'vampire', 'flame_demon', 'ancient_treant', 'hell_general', 'archlich']) {
        assert(!new RegExp("['\\"\`]" + id + "['\\"\`]").test(code), 'no code branch on ' + id);
    }
}
for (const t of Object.keys(MONSTERS)) for (const a of MONSTERS[t].abilities) {
    assert(ABILITY_KINDS[a.kind], 'known ability kind ' + a.kind);
    assert(ABILITY_KINDS[a.kind].desc(a).length > 0, 'popup line for ' + a.kind);
}
assert.strictEqual(monsterAbility('orc_berserker', 'enrage').below, 0.5);
assert.strictEqual(monsterAbility('curse_shooter', 'curseShot').duration, 3);
assert.strictEqual(monsterAbility('bone_knight', 'deathStun').radius, 2);
// 몬스터 하나를 길 위 거리 d에 세운다(발끝이 길 선 위)
const putMonster = (type, d) => {
    const p = pathAt(d);
    const m = createMonster(type, 1, 1);
    const y = p.y - MONSTER_FOOT;
    Object.assign(m, { x: p.x, y, homeX: p.x, homeY: y, rally: m.blocks ? { d, x: p.x, y } : null });
    Game.monsters.push(m);
    return m;
};
const tough = h => { h.hp = h.maxHp = 9999; return h; };
{
    // 광폭화: 체력 50% 이하면 공격 간격 절반, 다시 나오면 풀린다
    clearBoard();
    const bz = putMonster('orc_berserker', 900);
    assert.strictEqual(monsterStats(bz).interval, 0.7);
    assert.strictEqual(monsterStats({ type: 'orc_berserker', tier: 1, branch: null }).interval, 0.7, 'popup preview not enraged');
    bz.hp = bz.maxHp * 0.51;
    assert(!monsterEnrage(bz) && monsterStats(bz).interval === 0.7, 'not enraged above half');
    bz.hp = bz.maxHp * 0.5;
    assert(monsterEnrage(bz), 'enraged at half');
    assert(Math.abs(monsterStats(bz).interval - 0.35) < 1e-9, 'interval halved');
    // 실제 공격 간격도 짧아진다
    const foe = tough(place('warrior', 900));
    bz.atk = 0;
    updateMonster(bz, 1 / 30);
    assert.strictEqual(foe.blocker, bz);
    assert(Math.abs(bz.atk - 0.35) < 1e-9, 'enraged attack timer ' + bz.atk);
    // 쓰러지면 풀리고, 다시 나오면(체력 가득) 원래 간격
    damageUnit(bz, 9999);
    assert(bz.down > 0 && !monsterEnrage(bz));
    assert.strictEqual(foe.stun, 0, 'berserker has no death stun');
    updateMonster(bz, MONSTERS.orc_berserker.stats.respawn + 0.1);
    assert(bz.hp === bz.maxHp && !monsterEnrage(bz) && monsterStats(bz).interval === 0.7, 'enrage released after revive');
}
{
    // 저주: 맞은 용사는 3초 동안 받는 피해 +25%. 다시 맞으면 겹치지 않고 시간만 3초로 돌아간다
    clearBoard();
    Game.projectiles = [];
    const cs = putMonster('curse_shooter', 700);
    const h = tough(place('warrior', 700 + TILE));
    assert(h.curse === 0 && h.curseMul === 1);
    const shoot = (m, target) => {
        fireMonsterShot(m, monsterStats(m), target);
        const p = Game.projectiles[Game.projectiles.length - 1];
        for (let i = 0; i < 120 && !p.done; i++) updateProjectile(p, 1 / 60);
        assert(p.done, 'arrow landed');
    };
    shoot(cs, h);
    assert.strictEqual(h.hp, 9999 - (22 - h.armor), 'cursing arrow itself is not amplified');
    assert.strictEqual(h.curse, 3);
    assert.strictEqual(h.curseMul, 1.25);
    let hp0 = h.hp;
    damageHero(h, 10);
    assert(Math.abs(hp0 - h.hp - (10 - h.armor) * 1.25) < 1e-9, 'cursed hero takes +25%');
    updateHero(h, 1);
    assert(Math.abs(h.curse - 2) < 1e-9, 'curse ticks down');
    shoot(cs, h);
    assert.strictEqual(h.curse, 3, 'refreshed to full duration');
    assert.strictEqual(h.curseMul, 1.25, 'does not stack');
    hp0 = h.hp;
    damageHero(h, 10);
    assert(Math.abs(hp0 - h.hp - (10 - h.armor) * 1.25) < 1e-9, 'still +25% after refresh, not +56%');
    for (let i = 0; i < 31; i++) updateHero(h, 0.1);
    assert.strictEqual(h.curse, 0, 'curse expired');
    hp0 = h.hp;
    damageHero(h, 10);
    assert.strictEqual(hp0 - h.hp, 10 - h.armor, 'normal damage after expiry');
    // 능력 없는 궁수의 화살과 암흑 마법사의 구체는 저주를 걸지 않는다
    const archer = putMonster('skeleton_archer', 700);
    const h2 = tough(place('warrior', 700 + TILE));
    shoot(archer, h2);
    assert.strictEqual(h2.curse, 0, 'plain arrow no curse');
    assert.strictEqual(h2.hp, 9999 - (MONSTERS.skeleton_archer.stats.damage - h2.armor), 'plain arrow damage unchanged');
    const mage = putMonster('dark_mage', 700);
    shoot(mage, h2);
    assert.strictEqual(h2.curse, 0, 'orb no curse');
}
{
    // 해골 기사가 쓰러지면 반경 2칸 안 용사 1.5초 기절. 보스와 반경 밖은 제외
    clearBoard();
    const bk = putMonster('bone_knight', 1200);
    const near = tough(place('warrior', 1200 + 1.2 * TILE));
    const far = tough(place('warrior', 1200 + 8 * TILE));
    const boss = place(null, 1200 + 0.5 * TILE, 'fallen_knight');
    const gap = h => distance(bk.x, bk.y + MONSTER_FOOT, heroWorld(h).x, heroWorld(h).y) / TILE;
    assert(gap(near) < 2 && gap(boss) < 2 && gap(far) > 2.5, 'test layout');
    damageUnit(bk, 9999);
    assert(bk.down > 0);
    assert.strictEqual(near.stun, 1.5, 'near hero stunned');
    assert.strictEqual(boss.stun, 0, 'boss not stunned');
    assert.strictEqual(far.stun, 0, 'far hero not stunned');
    const d0 = near.d;
    updateHero(near, 1.4);
    assert.strictEqual(near.d, d0, 'stunned hero stands');
    updateHero(near, 0.2);
    updateHero(near, 0.1);
    assert(near.d > d0, 'walks after stun');
    // 능력 없는 오크 경비병은 쓰러져도 기절시키지 않는다. 광폭화도 없다
    clearBoard();
    const og = putMonster('orc_guard', 1200);
    const h = tough(place('warrior', 1200 + 0.5 * TILE));
    og.hp = og.maxHp * 0.2;
    assert(!monsterEnrage(og) && monsterStats(og).interval === MONSTERS.orc_guard.stats.interval, 'orc guard no enrage');
    damageUnit(og, 9999);
    assert.strictEqual(h.stun, 0, 'orc guard no death stun');
}

// ----- 몬스터 확장 능력 종류(능력마다 실제 경로로 시험한다) -----
const near6 = (a, b, msg) => assert(Math.abs(a - b) < 1e-6, (msg || '') + ': ' + a + ' != ' + b);
// 투사체 하나를 쏴 끝까지 날린다(화살과 구체)
const shootAll = (m, target) => {
    const n = Game.projectiles.length;
    fireMonsterShot(m, monsterStats(m), target);
    const p = Game.projectiles[n];
    for (let i = 0; i < 120 && !p.done; i++) updateProjectile(p, 1 / 60);
    assert(p.done, 'projectile landed');
    Game.projectiles = Game.projectiles.filter(x => !x.done);
    return p;
};
{
    // 화상: 맞은 용사가 2초간 0.5초마다 1.5(초당 3) 피해, 방어력 무시. 다시 맞으면 겹치지 않고 시간만 2초로
    clearBoard();
    Game.projectiles = [];
    const imp = putMonster('fire_imp', 700);
    const h = tough(place('warrior', 700 + TILE));
    h.armor = 5;
    shootAll(imp, h);
    assert.strictEqual(h.hp, 9999 - (7 - 5), 'imp bolt damage');
    assert.strictEqual(h.burn, 2);
    assert.strictEqual(h.burnDps, 3);
    assert.strictEqual(h.burnOwner, imp);
    const hp0 = h.hp;
    for (let i = 0; i < 60; i++) updateHero(h, 1 / 30);
    near6(hp0 - h.hp, 6, 'burn total 3/s x 2s ignoring armor');
    assert.strictEqual(h.burn, 0, 'burn over');
    shootAll(imp, h);
    updateHero(h, 1);
    shootAll(imp, h);
    assert.strictEqual(h.burn, 2, 'burn refreshed to full duration');
    assert.strictEqual(h.burnDps, 3, 'burn does not stack');
    // 화상으로 쓰러뜨리면 건 몬스터가 처치 경험치를 받는다
    h.hp = 1;
    const xp0 = imp.xp;
    updateHero(h, 0.6);
    assert(h.dead, 'burned to death');
    assert.strictEqual(imp.xp, xp0 + RANK_KILL_XP.normal, 'burn kill gives xp to the imp');
    // 능력 없는 그놀 사냥꾼은 화상을 걸지 않는다(도끼 투사체)
    const gnoll = putMonster('gnoll_hunter', 700);
    const h2 = tough(place('warrior', 700 + TILE));
    const p = shootAll(gnoll, h2);
    assert.strictEqual(p.shot, 'fx_shot_axe', 'gnoll throws an axe');
    assert.strictEqual(h2.burn, 0);
}
{
    // 빙결: 서리 마녀의 구체에 맞은 무리가 2초간 이동 속도 x0.6, 끝나면 원래 속도
    clearBoard();
    Game.projectiles = [];
    const witch = putMonster('frost_witch', 900);
    const a = tough(place('warrior', 900 + TILE));
    const b = tough(place('warrior', 900 + TILE + 30));
    const far = tough(place('warrior', 900 + 6 * TILE));
    shootAll(witch, a);
    assert(a.slow === 2 && b.slow === 2 && a.slowMul === 0.6, 'splash slows the group');
    assert.strictEqual(far.slow, 0, 'outside splash not slowed');
    const d0 = a.d;
    updateHero(a, 0.5);
    const slowStep = a.d - d0;
    a.slow = 0;
    const d1 = a.d;
    updateHero(a, 0.5);
    near6(slowStep / (a.d - d1), 0.6, 'moves at 60% speed');
}
{
    // 악몽: 20% 확률로 1초 기절. 보스는 걸리지 않고 난수도 쓰지 않는다
    clearBoard();
    Game.projectiles = [];
    const jester = putMonster('nightmare_jester', 900);
    const h = tough(place('warrior', 900 + TILE));
    withRandom(0.5, () => shootAll(jester, h));
    assert.strictEqual(h.stun, 0, 'no stun at 0.5');
    withRandom(0.01, () => shootAll(jester, h));
    assert.strictEqual(h.stun, 1, 'stun at 0.1');
    const boss = place(null, 900 + TILE, 'fallen_knight');
    boss.hp = boss.maxHp = 99999;
    const left = [0, 0, 0, 0, 0];
    const old = Math.random;
    let calls = 0;
    Math.random = () => { calls++; return 0; };
    try { monsterHitHero('nightmare_jester', boss, jester); } finally { Math.random = old; }
    assert.strictEqual(boss.stun, 0, 'boss never stunned');
    assert.strictEqual(calls, 0, 'no random roll for the boss');
}
{
    // 흡혈: 늑대인간이 준 피해의 30%를 회복한다(최대 체력까지)
    clearBoard();
    const wolf = putMonster('werewolf', 1200);
    const h = tough(place('warrior', 1200 + 0.3 * TILE));
    h.armor = 4;
    wolf.hp = 50;
    wolf.atk = 0;
    updateMonster(wolf, 1 / 30);
    assert.strictEqual(h.blocker, wolf);
    near6(wolf.hp, 50 + (24 - 4) * 0.3, 'lifesteal 30% of dealt');
    wolf.hp = wolf.maxHp - 1;
    wolf.atk = 0;
    updateMonster(wolf, 1 / 30);
    assert.strictEqual(wolf.hp, wolf.maxHp, 'capped at max hp');
}
{
    // 재생: 좀비 초당 3, 트롤 초당 10. 쓰러진 동안은 회복하지 않고 최대 체력을 넘지 않는다
    clearBoard();
    const z = putMonster('zombie', 1200);
    const t = putMonster('troll', 1200);
    z.hp = 100;
    t.hp = 100;
    updateAuras(Game.monsters);
    updateMonster(z, 1);
    updateMonster(t, 1);
    near6(z.hp, 103, 'zombie regen');
    near6(t.hp, 110, 'troll regen');
    z.hp = z.maxHp - 1;
    updateMonster(z, 1);
    assert.strictEqual(z.hp, z.maxHp, 'regen capped');
    damageUnit(z, 99999);
    assert(z.down > 0 && z.hp === 0);
    updateMonster(z, 1);
    assert.strictEqual(z.hp, 0, 'no regen while down');
    // 능력 없는 오크 경비병은 회복하지 않는다
    const og = putMonster('orc_guard', 1200);
    og.hp = 50;
    updateAuras(Game.monsters);
    updateMonster(og, 1);
    assert.strictEqual(og.hp, 50, 'no regen without ability');
}
{
    // 오라: 반경 안 몬스터(자신 포함). 같은 종류는 가장 큰 값 하나만. 피해와 공격 속도는 monsterStats에서 곱하고 체력 비율은 그대로
    clearBoard();
    const guard = putMonster('orc_guard', 1500);
    const shaman = putMonster('orc_shaman', 1500);
    shaman.x += 2 * TILE; // 2칸 떨어진 곳(반경 2.5 안)
    const base = monsterStats(guard).damage;
    updateAuras(Game.monsters);
    near6(monsterStats(guard).damage, base * 1.2, 'damage aura +20%');
    assert.strictEqual(shaman.aura.damage, 0.2, 'aura reaches its own source');
    // 둘째 주술사: 더하지 않고 큰 값 하나
    const shaman2 = putMonster('orc_shaman', 1500);
    updateAuras(Game.monsters);
    near6(monsterStats(guard).damage, base * 1.2, 'same aura does not stack');
    // 반경 밖이면 없다
    shaman.x += 3 * TILE;
    Game.monsters = Game.monsters.filter(m => m !== shaman2);
    updateAuras(Game.monsters);
    near6(monsterStats(guard).damage, base, 'out of aura range');
    // 대리치: 공격 속도 +20%(간격 / 1.2)
    const lich = putMonster('archlich', 1500);
    updateAuras(Game.monsters);
    near6(monsterStats(guard).interval, MONSTERS.orc_guard.stats.interval / 1.2, 'attack speed aura');
    // 팝업 미리보기(오라 없는 개체)는 그대로
    assert.strictEqual(monsterStats({ type: 'orc_guard', tier: 1 }).damage, MONSTERS.orc_guard.stats.damage, 'preview without aura');
    // 체력 비율: 오라 안팎을 매 프레임 오가도 최대 체력과 현재 체력이 흔들리지 않는다
    guard.hp = guard.maxHp * 0.5;
    const max0 = guard.maxHp;
    for (let i = 0; i < 30; i++) {
        lich.x = 1e6 * (i % 2);
        updateAuras(Game.monsters);
        updateMonster(guard, 1 / 30);
    }
    assert.strictEqual(guard.maxHp, max0, 'aura never touches max hp');
    near6(guard.hp / guard.maxHp, 0.5, 'hp ratio kept');
    // 회복 오라: 도깨비불 수련사 2칸 안 초당 3. 둘이어도 3(큰 값 하나)
    clearBoard();
    const g2 = putMonster('orc_guard', 1500);
    const w1 = putMonster('wisp_acolyte', 1500);
    const w2 = putMonster('wisp_acolyte', 1500);
    g2.hp = 50;
    updateAuras(Game.monsters);
    updateMonster(g2, 1);
    near6(g2.hp, 53, 'heal aura 3/s, not 6');
    // 쓰러진 지원 몬스터는 오라를 내지 않는다
    w1.down = 5;
    w2.down = 5;
    updateAuras(Game.monsters);
    assert.strictEqual(g2.aura.heal, 0, 'downed source gives no aura');
    // 지원 역할: 막지 않고 놓은 칸에서 약하게 공격한다
    assert(!monsterBlocks('wisp_acolyte') && !monsterBlocks('orc_shaman'), 'support does not block');
    w1.down = 0;
    const foe = tough(place('warrior', 1500 + TILE));
    Game.projectiles = [];
    w1.atk = 0;
    updateMonster(w1, 1 / 30);
    updateMonster(w1, ATTACK_POSE_TIME);
    assert(Game.projectiles.some(p => p.owner === w1), 'support shoots from its cell');
}
{
    // 가르기: 미노타우로스가 붙잡은 용사를 벨 때 1.5칸 안 다른 용사에게 피해의 60%
    clearBoard();
    const mino = putMonster('minotaur', 1200);
    const t = tough(place('warrior', 1200 + 0.3 * TILE));
    const near = tough(place('rogue', 1200 + 1.2 * TILE));
    const far = tough(place('warrior', 1200 + 4 * TILE));
    t.armor = near.armor = far.armor = 0;
    mino.atk = 0;
    updateMonster(mino, 1 / 30);
    assert.strictEqual(t.blocker, mino);
    const hitT = 9999 - t.hp;
    assert.strictEqual(hitT, 50, 'main target full damage');
    near6(9999 - near.hp, 30, 'cleave 60% on a near hero');
    assert.strictEqual(far.hp, 9999, 'far hero untouched');
}
{
    // 가시: 고대 나무 정령을 때린 용사가 받은 피해의 30%를 돌려받는다(방어력 뺀 뒤)
    clearBoard();
    const tree = putMonster('ancient_treant', 1200);
    const h = tough(place('warrior', 1200 + 0.3 * TILE));
    h.armor = 2;
    h.atk = 0;
    updateMonster(tree, 1 / 30);
    assert.strictEqual(h.blocker, tree);
    const hp0 = h.hp;
    const treeHp = tree.hp;
    updateHero(h, 1 / 30);
    near6(treeHp - tree.hp, h.damage, 'tree took the hit');
    near6(hp0 - h.hp, Math.max(1, h.damage * 0.3 - 2), 'thorns reflect 30%');
    // 가시 없는 오크 경비병은 반사하지 않는다
    const og = putMonster('orc_guard', 2000);
    const h2 = tough(place('warrior', 2000));
    damageUnit(og, 50, h2);
    assert.strictEqual(h2.hp, 9999, 'no thorns without ability');
}
{
    // 연쇄 번개: 대리치 구체가 맞은 용사에서 2.5칸 안 다음 용사로 3번 이어진다(이미 맞은 용사는 건너뜀), 피해 60%
    clearBoard();
    Game.projectiles = [];
    const lich = putMonster('archlich', 600);
    // 같은 길 지점에서 길과 수직으로(lane) 2.2칸씩 떨어뜨려 일직선으로 세운다(이웃끼리만 2.5칸 안)
    const d0 = 600 + 6 * TILE;
    const line = [0, 2.2, 4.4, 6.6, 8.8].map(k => { const h = tough(place('warrior', d0)); h.lane = k * TILE; h.armor = 0; return h; });
    const gap = (a, b) => distance(heroWorld(a).x, heroWorld(a).y, heroWorld(b).x, heroWorld(b).y) / TILE;
    for (let i = 1; i < line.length; i++) assert(gap(line[i - 1], line[i]) < 2.5 && gap(line[i - 1], line[i]) > 2.05, 'test layout ' + gap(line[i - 1], line[i]));
    monsterChain(lich, line[0], 100);
    assert.deepStrictEqual(line.map(h => 9999 - h.hp), [0, 60, 60, 60, 0], 'three jumps of 60%');
    // 다른 몬스터에는 연쇄가 없다
    const mage = putMonster('dark_mage', 600);
    monsterChain(mage, line[0], 100);
    assert.deepStrictEqual(line.map(h => 9999 - h.hp), [0, 60, 60, 60, 0], 'no chain without ability');
    // 실제 구체 경로: 대리치가 쏘면 광역 뒤에 이어진다
    clearBoard();
    Game.monsters.push(lich);
    const solo = tough(place('warrior', 600 + 12 * TILE));
    const next = tough(place('warrior', 600 + 12 * TILE));
    next.lane = 2.4 * TILE; // 광역(2칸) 밖, 연쇄(2.5칸) 안
    solo.armor = next.armor = 0;
    lich.x = heroWorld(solo).x;
    shootAll(lich, solo);
    assert.strictEqual(9999 - solo.hp, 100, 'orb hit');
    assert.strictEqual(9999 - next.hp, 60, 'chained from the orb target');
}
{
    // 약탈: 뱀파이어가 쓰러뜨리면 처치 골드에 3G를 더 받는다
    clearBoard();
    Game.projectiles = [];
    const vamp = putMonster('vampire', 900);
    const h = place('warrior', 900 + TILE);
    h.hp = 1;
    const g0 = Game.gold;
    shootAll(vamp, h);
    assert(h.dead);
    assert.strictEqual(Game.gold, g0 + Math.round(h.bounty * Game.mods.bounty) + 3, 'bounty + 3 loot');
    // 다른 몬스터는 처치 골드만
    const archer = putMonster('skeleton_archer', 900);
    const h2 = place('warrior', 900 + TILE);
    h2.hp = 1;
    const g1 = Game.gold;
    shootAll(archer, h2);
    assert.strictEqual(Game.gold, g1 + Math.round(h2.bounty * Game.mods.bounty), 'no loot without ability');
}
{
    // 용암 장판: 용암 악마의 구체가 떨어진 자리에 3초간 1칸 장판. 0.5초마다 5(초당 10), 방어력 무시
    clearBoard();
    Game.projectiles = [];
    Game.hazards = [];
    const demon = putMonster('flame_demon', 900);
    const h = tough(place('warrior', 900 + TILE));
    h.armor = 10;
    h.speed = 0;
    shootAll(demon, h);
    assert.strictEqual(Game.hazards.length, 1, 'fire ground left behind');
    const z = Game.hazards[0];
    assert(z.radius === TILE && z.dps === 10 && z.life === 3 && z.owner === demon);
    Game.monsters = []; // 장판만 남기고 시간을 돌린다(악마가 다시 쏘지 않게)
    const hp0 = h.hp;
    for (let i = 0; i < 92; i++) Game.update(1 / 30);
    near6(hp0 - h.hp, 30, '6 ticks of 5 over 3 s');
    assert.strictEqual(Game.hazards.length, 0, 'fire ground gone after 3 s');
    // 다른 광역 몬스터는 장판을 남기지 않는다
    const mage = putMonster('dark_mage', 900);
    shootAll(mage, h);
    assert.strictEqual(Game.hazards.length, 0, 'no ground without ability');
}
{
    // 지옥 대장군: 가르기 2칸 70%와 광폭화(체력 50% 이하 간격 x0.6)를 함께 쓴다
    clearBoard();
    const gen = putMonster('hell_general', 1200);
    assert.strictEqual(monsterStats(gen).interval, 0.8);
    gen.hp = gen.maxHp * 0.5;
    near6(monsterStats(gen).interval, 0.48, 'enrage x0.6');
    assert.strictEqual(monsterAbility('hell_general', 'cleave').ratio, 0.7);
}
Game.hazards = [];
Game.projectiles = [];

// ----- 확장 조합식: 공개 8개, 히든 3개(대장군과 대리치는 재료 랭크 A 이상) -----
{
    const pub = [
        ['goblin_spearman', 'fire_imp', 'werewolf'], ['zombie', 'wisp_acolyte', 'troll'], ['gnoll_hunter', 'wisp_acolyte', 'frost_witch'],
        ['fire_imp', 'dark_mage', 'nightmare_jester'], ['goblin_spearman', 'dark_mage', 'orc_shaman'], ['werewolf', 'troll', 'minotaur'],
        ['frost_witch', 'nightmare_jester', 'flame_demon'], ['orc_shaman', 'troll', 'ancient_treant']
    ];
    for (const [a, b, r] of pub) {
        for (const [x, y] of [[a, b], [b, a]]) {
            const plan = mergePlan(x, y);
            assert(plan.kind === 'recipe' && plan.result === r && !plan.recipe.hidden, x + ' + ' + y + ' -> ' + r);
        }
        assert(publicRecipesFor(a).some(p => p.partner === b && p.result === r), 'popup lists ' + r);
    }
    // 재료 쌍은 모두 다르다(기존 조합식과 겹치지 않는다)
    assert.strictEqual(new Set(MONSTER_RECIPES.map(recipeKey)).size, MONSTER_RECIPES.length, 'no duplicate recipe keys');
    assert.strictEqual(new Set(MONSTER_RECIPES.map(r => [r.a, r.b].sort().join('+'))).size, MONSTER_RECIPES.length, 'no duplicate material pairs');
    // 히든: 저주 사수 + 악몽 광대 → 뱀파이어(랭크 조건 없음). 공개 목록과 화면에는 드러나지 않는다
    const v = mergePlan('nightmare_jester', 'curse_shooter');
    assert(v.kind === 'recipe' && v.result === 'vampire' && v.recipe.hidden);
    assert(!publicRecipesFor('curse_shooter').some(p => p.result === 'vampire'), 'vampire recipe hidden');
    // 랭크 조건: 용암 악마 A + 미노타우로스 A → 지옥 대장군. 하나라도 모자라면 영웅 등급 합치기(3마리 → 전설)로 본다
    const R = n => rankIndex(n);
    assert.strictEqual(mergePlan({ type: 'flame_demon', rank: R('A') }, { type: 'minotaur', rank: R('A') }).result, 'hell_general');
    assert.strictEqual(mergePlan({ type: 'minotaur', rank: R('S') }, { type: 'flame_demon', rank: R('A') }).result, 'hell_general', 'order free, S counts');
    assert.strictEqual(mergePlan({ type: 'flame_demon', rank: R('B') }, { type: 'minotaur', rank: R('A') }).grade, 'legendary', 'B is not enough: grade merge');
    assert.strictEqual(mergePlan('flame_demon', 'minotaur').kind, 'grade');
    // 뱀파이어 A + 해골 기사 A → 대리치. 해골 기사 A + 저주 사수 A(죽음의 군주)와는 다른 조합식
    assert.strictEqual(mergePlan({ type: 'vampire', rank: R('A') }, { type: 'bone_knight', rank: R('A') }).result, 'archlich');
    assert.strictEqual(mergePlan({ type: 'vampire', rank: R('C') }, { type: 'bone_knight', rank: R('A') }).kind, 'grade');
    assert.strictEqual(mergePlan({ type: 'bone_knight', rank: R('A') }, { type: 'curse_shooter', rank: R('A') }).result, 'death_lord');
    // 실제 합치기: 결과 랭크는 낮은 쪽, 전설은 맵 제한이 없다
    clearBoard();
    const freeCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
    const put = (type, rank) => { const m = Game.place(type, ...freeCell()); setMonsterRank(m, R(rank)); return m; };
    let res = Game.merge({ monster: put('flame_demon', 'S') }, { monster: put('minotaur', 'A') });
    assert(res.ok && res.type === 'hell_general' && res.hidden && res.monster.rank === R('A'), 'hell general merged');
    const vp = put('vampire', 'A');
    const bk = put('bone_knight', 'A');
    assert.strictEqual(Game.mergePlanFor(vp, bk).kind, 'recipe', 'legendary has no map limit');
    res = Game.merge({ monster: vp }, { monster: bk });
    assert(res.ok && res.type === 'archlich', 'archlich merged');
    // 등급 합치기: 희귀(조합식 없음) → 영웅 5종 중 하나, 영웅 → 전설 3종 중 하나, 전설은 신화 몬스터가 없어 최고 등급
    assert.strictEqual(mergePlan('werewolf', 'orc_berserker').grade, 'epic');
    assert.strictEqual(mergePlan('minotaur', 'vampire').grade, 'legendary');
    assert.strictEqual(mergePlan('death_lord', 'archlich').reason, 'top');
    clearBoard();
}

// ----- 몬스터 팝업: 23종 모두 화면 안에 들어간다(능력 줄과 조합식 줄이 가장 많은 경우도) -----
{
    clearBoard();
    for (const type of Object.keys(MONSTERS)) {
        const [c, r] = [...BUILD_CELLS].map(k => k.split(',').map(Number))[0];
        Game.monsters = [];
        const m = Game.place(type, c, r);
        setMonsterEquip(m, 'crown');
        UI.selectedMonster = m;
        UI.update(0);
        const p = UI.popup;
        assert(p && p.type === type, 'popup for ' + type);
        assert(p.y >= 0 && p.y + p.h <= GAME_HEIGHT && p.x >= 0 && p.x + p.w <= GAME_WIDTH, 'popup inside the screen: ' + type + ' h=' + p.h);
        UI.clearSelection();
    }
    Game.monsters = [];
}

// 랭크: D~S, 처치 경험치로만 오른다. 마지막 공격을 넣은 몬스터가 받는다(번개, 타락 유닛 제외)
assert.strictEqual(MONSTER_RANKS.map(r => r.name).join(), 'D,C,B,A,S');
assert.strictEqual(MONSTER_RANKS.map(r => r.xp).join(), '0,5,15,35,70');
assert.strictEqual(MONSTER_RANKS.map(r => r.mul).join(), '1,1.25,1.5,1.75,2');
assert.strictEqual(JSON.stringify(RANK_KILL_XP), '{"normal":1,"elite":3,"boss":10}');
{
    const frail = h => { h.hp = 1; h.armor = 0; return h; };
    const land = () => { for (let i = 0; i < 180 && Game.projectiles.some(p => !p.done); i++) for (const p of Game.projectiles) if (!p.done) updateProjectile(p, 1 / 60); };
    // 원거리 화살
    clearBoard();
    Game.projectiles = [];
    const archer = putMonster('skeleton_archer', 700);
    assert(archer.rank === 0 && archer.xp === 0, 'summoned at D');
    const h1 = frail(place('warrior', 700 + TILE));
    fireMonsterShot(archer, monsterStats(archer), h1);
    land();
    assert(h1.dead && archer.xp === 1, 'arrow kill credited');
    // 근접: 막는 몬스터가 붙잡고 때려 쓰러뜨린다
    clearBoard();
    const orc = putMonster('orc_guard', 900);
    const h2 = frail(place('warrior', 900 + 0.3 * TILE));
    for (let i = 0; i < 90 && !h2.dead; i++) updateMonster(orc, 1 / 30);
    assert(h2.dead && orc.xp === 1, 'melee kill credited');
    // 광역 구체: 맞아 쓰러진 용사마다 경험치
    clearBoard();
    Game.projectiles = [];
    const mage = putMonster('dark_mage', 1100);
    const group = [0, 0.2, 0.4].map(k => frail(place('warrior', 1100 + (1 + k) * TILE)));
    fireMonsterShot(mage, monsterStats(mage), group[0]);
    land();
    assert(group.every(h => h.dead) && mage.xp === 3, 'orb splash kills credited: ' + mage.xp);
    // 빔(관통 갈래)
    clearBoard();
    const beamer = putMonster('dark_mage', 1100);
    Object.assign(beamer, { tier: 3, branch: 'B' });
    const h3 = frail(place('warrior', 1100 + TILE));
    fireMonsterShot(beamer, monsterStats(beamer), h3);
    assert(h3.dead && beamer.xp === 1, 'beam kill credited');
    // 처치는 마지막 공격을 넣은 몬스터만 받는다
    clearBoard();
    const a1 = putMonster('skeleton_archer', 700);
    const a2 = putMonster('skeleton_archer', 700);
    const h4 = tough(place('warrior', 700 + TILE));
    h4.armor = 0;
    damageHero(h4, 9000, 0, 0, null, a1);
    damageHero(h4, 9000, 0, 0, null, a2);
    assert(h4.dead && a1.xp === 0 && a2.xp === 1, 'last hit only');
    // 정예 3, 보스 10
    const elite = tough(place('elite_swordsman', 700 + TILE));
    damageHero(elite, 99999, 0, 0, null, a1);
    assert(elite.dead && a1.xp === 3, 'elite counts 3');
    const boss = place(null, 700 + TILE, 'fallen_knight');
    damageHero(boss, 1e7, 0, 0, null, a1);
    assert(boss.dead && a1.xp === 13, 'boss counts 10');
    assert.strictEqual(a1.rank, 1, 'C at 13 xp');
    assert.strictEqual(monsterXpToNext(a1), 2, '2 kills to B');
    // 번개와 타락 유닛의 처치는 몬스터 경험치가 아니다. 사라진 몬스터의 투사체 처치도 아무도 받지 않는다
    clearBoard();
    Game.projectiles = [];
    Game.pendingStrikes = [];
    const watcher = putMonster('skeleton_archer', 700);
    const h5 = frail(place('warrior', 700 + TILE));
    const w5 = heroWorld(h5);
    resolveStrike({ x: w5.x, y: w5.y });
    const h6 = frail(place('warrior', 700 + TILE));
    damageHero(h6, 5, 0, 0, '#ffb76b'); // 타락 유닛은 공격자를 넘기지 않는다
    const h7 = frail(place('warrior', 700 + TILE));
    fireMonsterShot(watcher, monsterStats(watcher), h7);
    Game.removeMonster(watcher);
    land();
    assert(h5.dead && h6.dead && h7.dead && watcher.xp === 0, 'lightning, corrupt, removed shooter give no xp');
}
{
    // 랭크 상승과 수치: 랭크마다 체력과 피해 25%씩(S는 2배). 체력은 비율을 유지한다
    clearBoard();
    const og = putMonster('orc_guard', 900);
    const base = MONSTERS.orc_guard.stats;
    og.hp = og.maxHp * 0.5;
    og.xp = 4;
    const kill = (m, type, bossKey) => { const h = tough(place(type || 'warrior', 900 + TILE, bossKey)); damageHero(h, 1e7, 0, 0, null, m); };
    kill(og);
    assert.strictEqual(og.rank, 1, 'C at 5 kills');
    assert(og.rankUp > 0, 'rank up effect');
    assert(Math.abs(monsterStats(og).damage - base.damage * 1.25) < 1e-9 && og.maxHp === base.hp * 1.25, 'C stats +25%');
    assert(Math.abs(og.hp / og.maxHp - 0.5) < 1e-9, 'hp ratio kept on rank up');
    // 경험치가 넘치면 여러 단계를 한 번에 오른다. S에서 멈춘다
    og.xp = 30;
    kill(og, null, 'fallen_knight');
    assert.strictEqual(og.rank, 3, 'A at 40');
    og.xp = 69;
    kill(og);
    assert.strictEqual(og.rank, 4, 'S at 70');
    assert(Math.abs(monsterStats(og).damage - base.damage * 2) < 1e-9 && og.maxHp === base.hp * 2, 'S doubles');
    assert.strictEqual(monsterXpToNext(og), 0, 'S is top');
    kill(og, null, 'fallen_knight');
    assert.strictEqual(og.rank, 4, 'stays S');
    // 쓰러졌다 다시 나와도 랭크 유지, 체력은 랭크 기준 최대치로
    damageUnit(og, 1e6);
    assert(og.down > 0);
    for (let i = 0; i < 40 && og.down > 0; i++) updateMonster(og, 0.25);
    assert(og.down <= 0 && og.rank === 4 && og.hp === base.hp * 2, 'rank kept after respawn');
    // 합치면 재료 중 낮은 랭크, 경험치는 그 랭크의 시작값
    clearBoard();
    const m1 = Game.place('orc_guard', 3, 6);
    const m2 = Game.place('orc_guard', 3, 4) || Game.place('orc_guard', 5, 5);
    assert(m1 && m2, 'merge test cells');
    setMonsterRank(m1, 3);
    m1.xp = 50;
    setMonsterRank(m2, 1);
    m2.xp = 12;
    const m3 = Game.place('orc_guard', ...[...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r)));
    setMonsterRank(m3, 2); // 등급 합치기 셋째 재료(랭크 B)
    const res = Game.merge({ monster: m2 }, { monster: m1 });
    assert(res.ok, 'merged');
    assert.strictEqual(res.monster.rank, 1, 'lower rank inherited');
    assert.strictEqual(res.monster.xp, 5, 'xp at rank start');
    assert.strictEqual(res.monster.maxHp, MONSTERS[res.type].stats.hp * 1.25, 'inherited rank stats');
    // 옮겨도 유지
    const free = [[5, 5], [7, 6], [9, 5], [11, 4]].find(([c, r]) => Game.canPlace(res.type, c, r));
    assert(Game.moveMonster(res.monster, free[0], free[1]) && res.monster.rank === 1, 'rank kept after move');
    clearBoard();
}

{
    // 제물: 등급별 표(체력, 번개 감소)
    assert.deepStrictEqual(sacrificeGain('orc_guard'), { heal: 1, lightning: 2 }, 'common');
    assert.deepStrictEqual(sacrificeGain('curse_shooter'), { heal: 2, lightning: 5 }, 'rare');
    assert.deepStrictEqual(sacrificeGain('bone_knight'), { heal: 5, lightning: 10 }, 'epic');
    assert.deepStrictEqual(sacrificeGain('death_lord'), { heal: 10, lightning: 30 }, 'legendary');
    // 랭크 보정: 랭크마다 +25%, S는 2배. 체력은 내림
    assert.deepStrictEqual(sacrificeGain({ type: 'curse_shooter', rank: 1 }), { heal: 2, lightning: 6.25 }, 'rare C');
    assert.deepStrictEqual(sacrificeGain({ type: 'curse_shooter', rank: 2 }), { heal: 3, lightning: 7.5 }, 'rare B');
    assert.deepStrictEqual(sacrificeGain({ type: 'bone_knight', rank: 3 }), { heal: 8, lightning: 17.5 }, 'epic A');
    assert.deepStrictEqual(sacrificeGain({ type: 'orc_guard', rank: 4 }), { heal: 2, lightning: 4 }, 'common S');
    assert.deepStrictEqual(sacrificeGain({ type: 'death_lord', rank: 4 }), { heal: 20, lightning: 60 }, 'legendary S');
    assert.strictEqual(sacrificeText(sacrificeGain('curse_shooter')), '체력 +2, 번개 -5초');
    assert.strictEqual(sacrificeText({ heal: 2, lightning: 6.25 }), '체력 +2, 번개 -6.25초');

    clearBoard();
    Game.state = 'prep';
    Game.prepTimer = 999;
    // 직접 호출: 체력 회복, 번개 대기 감소, 칸이 빔
    const k = Game.place('bone_knight', 3, 6);
    setMonsterRank(k, 3);
    Game.hp = 5;
    Game.skills.lightning = 25;
    const r1 = Game.sacrifice(k);
    assert(r1.ok && Game.hp === 13 && Game.skills.lightning === 7.5, 'epic A sacrifice: hp ' + Game.hp + ' cd ' + Game.skills.lightning);
    assert(!Game.monsters.includes(k) && k.removed && !Game.monsterAt(3, 6), 'cell freed');
    assert(!Game.sacrifice(k).ok, 'cannot sacrifice twice');
    // 다시 소환(놓기) 가능
    assert(Game.canPlace('orc_guard', 3, 6), 'cell usable again');
    assert(withRandom([0, 0, 0], () => Game.summon()).ok, 'summon after sacrifice');
    // 체력 최대치를 넘지 않고, 번개 대기는 0 아래로 내려가지 않는다. 체력이 가득해도 바칠 수 있다
    clearBoard();
    const d1 = Game.place('death_lord', 3, 6);
    Game.hp = COMBAT_RULES.maxHp - 3;
    Game.skills.lightning = 4;
    const r2 = Game.sacrifice(d1);
    assert(r2.ok && r2.heal === 3 && Game.hp === COMBAT_RULES.maxHp && Game.skills.lightning === 0, 'clamped');
    const c1 = Game.place('orc_guard', 3, 6);
    Game.skills.lightning = 10;
    assert(Game.sacrifice(c1).ok && Game.hp === COMBAT_RULES.maxHp && Game.skills.lightning === 8, 'full hp still cuts lightning');
    // 판매 환불 없음
    const g0 = Game.gold;
    assert(Game.sacrifice(Game.place('skeleton_archer', 3, 4)).ok && Game.gold === g0, 'no gold from sacrifice');

    // 웨이브 중, 막고 있던 용사가 풀린다
    clearBoard();
    Game.state = 'wave';
    const blocker = putMonster('orc_guard', 900);
    const held = tough(place('warrior', 900 + 10));
    held.blocker = blocker;
    blocker.target = held;
    assert(Game.sacrifice(blocker).ok, 'sacrifice during wave');
    assert(held.blocker === null, 'blocked hero released');
    Game.update(1 / 30);
    assert(held.blocker !== blocker, 'not re-blocked by sacrificed monster');

    // 끌기로 바치기: 왕좌 위에 놓으면 제물, 왕좌 밖(길 등)에 놓으면 제물이 안 된다
    clearBoard();
    Game.state = 'prep';
    Game.hp = 10;
    Game.skills.lightning = 20;
    const throneXY = [tileX(THRONE_TILE.col) * WORLD_ZOOM, (tileY(THRONE_TILE.row) - 40) * WORLD_ZOOM];
    const a1 = Game.place('curse_shooter', 21, 5) || Game.place('curse_shooter', 19, 6);
    assert(a1, 'archer near throne');
    const sacBefore = Game.stats.sacrificed;
    // 끄는 중 미리보기 동작
    UI.update(0);
    UI.onMove(...monXY(a1));
    UI.onDown(...monXY(a1));
    for (let i = 1; i <= 4; i++) UI.onMove(monXY(a1)[0] + (throneXY[0] - monXY(a1)[0]) * i / 4, monXY(a1)[1] + (throneXY[1] - monXY(a1)[1]) * i / 4);
    assert(UI.dropTarget && UI.dropTarget.throne, 'throne is drop target');
    assert.strictEqual(UI.dropAction(UI.dropTarget).action, 'sacrifice');
    UI.onUp(...throneXY);
    assert(!Game.monsters.includes(a1) && Game.hp === 12 && Game.skills.lightning === 15, 'drag sacrifice: hp ' + Game.hp);
    assert.strictEqual(Game.stats.sacrificed, sacBefore + 1, 'sacrifice count');
    // 왕좌 밖(왕좌에서 떨어진 길 칸)에 놓으면 그대로 남는다
    const a2 = Game.place('curse_shooter', 3, 4);
    const pathCell = [...Array(MAP_COLS).keys()].flatMap(c => [...Array(MAP_ROWS).keys()].map(r => [c, r]))
        .find(([c, r]) => isPathCell(c, r) && Math.abs(c - THRONE_TILE.col) > 3);
    dragTo(monXY(a2), cellXY(pathCell[0], pathCell[1]));
    assert(Game.monsters.includes(a2) && Game.hp === 12 && Game.skills.lightning === 15, 'off-throne drop is not a sacrifice');
    // 바로 옆 칸(왕좌 영역 밖)도 아니다
    assert(!Game.onThrone(tileX(THRONE_TILE.col - 2), tileY(THRONE_TILE.row)), 'two tiles left is off throne');
    assert(!Game.onThrone(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row + 2)), 'two tiles below is off throne');
    assert(Game.onThrone(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row)), 'throne tile');
    // 새 맵: 30 x 15칸, 경로 칸 수(북 49, 남 47)와 합류점, 건설 칸 줄 2~12
    assert(MAP_COLS === 30 && MAP_ROWS === 15 && TILE * WORLD_ZOOM === 64, '30 x 15 cells of 64px');
    assert.strictEqual(JSON.stringify(MAPS.merge.routes.north), '[[0,3],[5,3],[5,8],[10,8],[10,3],[15,3],[15,11],[21,11],[21,7],[27,7]]');
    assert.strictEqual(JSON.stringify(MAPS.merge.routes.south), '[[0,11],[10,11],[10,8],[10,3],[15,3],[15,11],[21,11],[21,7],[27,7]]');
    assert(MERGE_TILE.col === 10 && MERGE_TILE.row === 8 && THRONE_TILE.col === 27 && THRONE_TILE.row === 7);
    for (const key of BUILD_CELLS) { const r = Number(key.split(',')[1]); assert(r >= 2 && r <= 12, 'build rows 2..12: ' + key); }
    // 건설 칸은 지역과 관계없이 그대로다(179칸, 이전 맵과 같은 칸). 소품 자리(PROP_CELLS)는 건설 칸이 아니다
    assert.strictEqual(BUILD_CELLS.size, 179, 'build cell count');
    assert.strictEqual([...BUILD_CELLS].sort().join(' '), '1,10 1,12 1,2 1,4 1,5 1,9 10,12 10,2 11,10 11,11 11,12 11,2 11,4 11,5 11,6 11,7 11,8 11,9 12,10 12,11 12,12 12,2 12,4 12,5 12,6 12,7 12,8 12,9 13,10 13,11 13,12 13,2 13,4 13,5 13,6 13,7 13,8 13,9 14,10 14,11 14,12 14,2 14,4 14,5 14,6 14,7 14,8 14,9 15,12 15,2 16,10 16,12 16,2 16,3 16,4 16,5 16,6 16,7 16,8 16,9 17,10 17,12 17,2 17,3 17,4 17,5 17,6 17,7 17,8 17,9 18,10 18,12 18,9 19,10 19,12 19,5 19,6 19,7 19,8 19,9 2,10 2,12 2,2 2,4 2,5 2,9 20,10 20,12 20,5 20,6 20,7 20,8 20,9 21,12 21,5 21,6 22,10 22,11 22,12 22,5 22,6 22,8 22,9 23,10 23,11 23,12 23,5 23,6 23,8 23,9 24,5 24,6 24,8 24,9 25,5 25,6 25,8 25,9 26,9 27,9 28,9 3,10 3,12 3,2 3,4 3,5 3,6 3,7 3,8 3,9 4,10 4,12 4,2 4,4 4,5 4,6 4,7 4,8 4,9 5,10 5,12 5,2 5,9 6,10 6,12 6,2 6,3 6,4 6,5 6,6 6,7 6,9 7,10 7,12 7,2 7,3 7,4 7,5 7,6 7,7 7,9 8,10 8,12 8,2 8,3 8,4 8,5 8,6 8,7 8,9 9,10 9,12 9,2 9,3 9,4 9,5 9,6 9,7 9,9', 'build cells unchanged');
    for (const [c, r] of PROP_CELLS) assert(!isBuildCell(c, r) && !isPathCell(c, r) && !isThroneArea(c, r), 'prop cell ' + c + ',' + r);
    // 지역 소품은 건설 칸, 길, 왕좌 둘레에 놓이지 않는다
    for (const id of ZONE_IDS) {
        for (const [sprite, c, r] of ZONES[id].props) {
            assert(!isBuildCell(c, r) && !isPathCell(c, r) && !isThroneArea(c, r), id + ' prop on free land ' + sprite + ' ' + c + ',' + r);
            assert(c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS, id + ' prop inside the map');
        }
    }
    // 왕좌 둘레(제물 판정)는 건설 칸이 아니다
    for (let c = 0; c < MAP_COLS; c++) for (let r = 0; r < MAP_ROWS; r++) {
        if (isThroneArea(c, r)) assert(!isBuildCell(c, r) && Game.onThrone(tileX(c), tileY(r)), 'throne area ' + c + ',' + r);
    }
    // 연출 진행 중 예외 없음
    tick(1.5);
    clearBoard();
    Game.hp = COMBAT_RULES.maxHp;
    Game.skills.lightning = 0;
}

// 중간 보스와 보스 보상 3택
{
    clearBoard();
    Game.hp = COMBAT_RULES.maxHp;
    // 5번째 웨이브: 기존 파티 그대로 대마도사가 나온다. 마지막 웨이브는 부대장 그대로
    // 표에는 10라운드마다 보스가 있다. 아래 시험은 5번째 라운드에 임시로 대마도사를 넣어 중간 보스 규칙을 본다
    assert.strictEqual(WAVES[9].boss, 'archmage');
    assert.strictEqual(WAVES[19].boss, 'fallen_knight');
    assert.strictEqual(WAVES[WAVES.length - 1].boss, 'fallen_knight');
    assert.strictEqual(WAVES.length, 60);
    assert.strictEqual(WAVES.filter(w => w.boss).length, 6, 'six boss rounds');
    const w5 = WAVES[4];
    w5.boss = 'archmage';
    // 체력: 부대장과 같은 계산(전사 x 15 x 웨이브 배율)에 waveHpMul(초안 0.6)
    assert.strictEqual(BOSSES.archmage.waveHpMul, 0.6);
    assert(!BOSSES.fallen_knight.waveHpMul, 'fallen knight keeps full hp');
    assert(Math.abs(createHero(null, 4, 0, 'archmage').maxHp - createHero(null, 4, 0, 'fallen_knight').maxHp * 0.6) < 1e-9);
    // 발끝: 보스마다 걷기와 공격 동작이 가진 방향(없으면 PL_DIRS)마다 값이 있다. 없는 방향은 Render.plPick이 있는 방향으로 그린다
    for (const boss of Object.values(BOSSES)) for (const clip of [boss.art.anim.walk, boss.art.anim.attack]) for (const dir of clip.dirs || PL_DIRS) {
        assert(typeof clip.footPx[dir] === 'number', boss.name + ' foot ' + clip.folder + ' ' + dir);
    }

    // 보상 표: 몬스터 1장(희귀 또는 영웅, 영웅 40%), 장비 1장(희귀 또는 영웅, 영웅 40%), 골드 300G 1장
    assert.strictEqual(JSON.stringify(BOSS_REWARD_RULES), '{"roundEvery":5,"monsterCards":1,"epicChance":0.4,"gold":300}');
    assert.strictEqual(EQUIP_RULES.rewardEpicChance, 0.4);
    const kinds = r => r.cards.map(c => c.kind === 'gold' ? 'gold' + c.gold : (c.kind === 'equip' ? c.id : c.type)).join();
    // 난수 순서: 몬스터 등급, 몬스터, 장비 등급, 장비
    assert.strictEqual(withRandom([0.39, 0, 0.39, 0], () => kinds(Game.rollBossReward())), 'bone_knight,gauntlet,gold300', 'epic under 40%');
    assert.strictEqual(withRandom([0.4, 0.1, 0.4, 0.99], () => kinds(Game.rollBossReward())), 'curse_shooter,tome,gold300', 'rare from 40%');
    const seenEquip = new Set();
    for (let i = 0; i < 300; i++) {
        const r = Game.rollBossReward();
        assert.strictEqual(r.cards.length, 3);
        const [a, e, g] = r.cards;
        assert(a.kind === 'monster', 'first card monster');
        const def = MONSTERS[a.type];
        assert((def.grade === 'rare' || def.grade === 'epic') && def.summon !== false, 'rare or epic only: ' + a.type);
        assert(e.kind === 'equip' && EQUIPMENT[e.id] && EQUIPMENT[e.id].grade !== 'common', 'second card rare or epic equipment: ' + e.id);
        seenEquip.add(EQUIPMENT[e.id].grade);
        assert(g.kind === 'gold' && g.gold === 300);
    }
    assert(seenEquip.has('rare') && seenEquip.has('epic'), 'both equipment grades appear');

    // 5번째 웨이브 시작: 대마도사가 파티 뒤에 나온다
    Game.state = 'prep';
    Game.waveIndex = 4;
    assert(Game.startWave());
    const mb = Game.heroes.find(h => h.boss);
    assert(mb && mb.bossKey === 'archmage', 'archmage in wave 5');
    assert.strictEqual(Game.heroes.length, [...Object.values(w5.members), ...Object.values(w5.elites || {})].reduce((a, b) => a + b, 0) + 1);
    assert(Math.abs(mb.maxHp - HEROES.warrior.hp * 15 * (1 + COMBAT_RULES.hpPerWave * 4) * 0.6) < 1e-9, 'wave 5 archmage hp');
    // 보스를 처치해도 전투 중에는 카드를 띄우지 않는다
    const keep = Game.place('orc_guard', 1, 4); // 길로 나가도 보상 카드(x 346부터)에 가리지 않는 자리
    Game.heroes = [mb];
    mb.waiting = false;
    damageHero(mb, 1e9);
    assert(mb.dead && Game.bossDefeated && !Game.bossReward && Game.state === 'wave', 'no reward during battle');
    // 웨이브가 끝나 준비 단계에 들어가면 카드 3장
    Game.update(1 / 30);
    assert.strictEqual(Game.state, 'prep');
    assert.strictEqual(Game.waveIndex, 5);
    assert(Game.bossReward && Game.bossReward.cards.length === 3 && !Game.bossDefeated, 'reward after wave');
    UI.update(0);
    assert(['reward0', 'reward1', 'reward2'].every(id => UI.buttons.some(b => b.id === id && !b.disabled)), 'three cards');
    // 고르기 전: 준비 시간이 멈추고 다음 웨이브가 시작되지 않는다. 소환 버튼과 다음 웨이브 버튼도 없다
    const prep0 = Game.prepTimer;
    tick(COMBAT_RULES.prepTime + 2);
    assert.strictEqual(Game.state, 'prep', 'wave does not auto start');
    assert.strictEqual(Game.prepTimer, prep0, 'prep timer paused');
    assert(!Game.startWave(), 'startWave refused');
    UI.onKey('Space');
    assert.strictEqual(Game.state, 'prep');
    assert(!hasBtn('next') && !hasBtn('summon') && !hasBtn('tab_demon'), 'bar buttons hidden while choosing');
    // 맵을 바꾸는 입력은 막는다: 소환(S, 직접 호출), 끌어 옮기기, 몬스터 누르기
    const count0 = Game.monsters.length;
    UI.onKey('KeyS');
    assert(!Game.summon().ok && Game.monsters.length === count0, 'no summon while choosing');
    const home = [keep.col, keep.row];
    dragTo(monXY(keep), cellXY(5, 5));
    assert(keep.col === home[0] && keep.row === home[1] && !UI.drag, 'no drag while choosing');
    click(...monXY(keep));
    assert(!UI.selectedMonster && !UI.popup, 'no monster popup while choosing');
    // 1 키로 첫 카드(몬스터)를 고르면 맵의 빈 칸에 소환처럼 나온다. 소환 비용과 횟수는 그대로
    const pick = Game.bossReward.cards[0];
    const cost0 = Game.summonCost();
    const gold0 = Game.gold;
    UI.onKey('Digit1');
    assert(!Game.bossReward, 'reward closed');
    assert.strictEqual(Game.monsters.length, count0 + 1);
    const got = Game.monsters[Game.monsters.length - 1];
    assert(got.type === pick.type && isBuildCell(got.col, got.row) && Game.monsterAt(got.col, got.row) === got, 'reward monster on map');
    assert(Fx.pops.some(p => p.kind === 'summon' && p.type === pick.type && p.to.x === got.x), 'summon effect');
    assert(Game.summonCost() === cost0 && Game.gold === gold0, 'reward is free');
    // 고른 뒤에는 준비 시간이 다시 흐르고 입력이 돌아온다
    tick(1);
    assert(Game.prepTimer < prep0, 'prep timer resumes');
    assert(hasBtn('next') && hasBtn('tab_monster'), 'bar buttons back');
    // 골드 카드를 누르면 300G
    Game.bossReward = Game.rollBossReward();
    btn('reward2');
    assert(!Game.bossReward && Game.gold === gold0 + 300, 'gold card');
    // 상한(24마리)이 차 있으면 몬스터 카드가 꺼지고 골드만 고를 수 있다
    for (const key of BUILD_CELLS) {
        if (Game.fieldFull()) break;
        const [c, r] = key.split(',').map(Number);
        Game.place('skeleton_archer', c, r);
    }
    assert(Game.fieldFull());
    Game.bossReward = Game.rollBossReward();
    UI.update(0);
    const rb = id => UI.buttons.find(b => b.id === id);
    assert(rb('reward0').disabled && !rb('reward1').disabled && !rb('reward2').disabled, 'monster card dimmed at cap, equipment card stays');
    UI.toast = null;
    UI.onKey('Digit1');
    btn('reward0');
    assert(Game.bossReward && Game.monsters.length === SUMMON_RULES.maxField, 'monster card refused at cap');
    assert(UI.toast && UI.toast.text.includes('자리 없음'), 'cap toast');
    UI.onKey('Digit3');
    assert(!Game.bossReward && Game.gold === gold0 + 600, 'gold at cap');
    // 마지막 보스는 보상 없이 승리
    clearBoard();
    Game.state = 'wave';
    Game.waveIndex = WAVES.length - 1;
    const lastBoss = place(null, 700, 'fallen_knight');
    damageHero(lastBoss, 1e9);
    Game.update(1 / 30);
    assert(Game.state === 'victory' && !Game.bossReward && !Game.bossDefeated, 'last boss: victory without reward');
    // 다시 시작하면 보상 상태도 처음으로
    btn('retry');
    btn('begin');
    Game.bossReward = Game.rollBossReward();
    Game.bossDefeated = true;
    Game.hp = 1;
    damageThrone(1);
    assert.strictEqual(Game.state, 'defeat');
    btn('retry');
    assert(Game.state === 'select', 'retry opens the select screen');
    btn('begin');
    assert(Game.state === 'prep' && !Game.bossReward && !Game.bossDefeated, 'reward state reset on retry');
    const t0 = Game.prepTimer;
    Game.update(0.1);
    assert(Game.prepTimer < t0, 'prep timer runs after retry');
}

// 장비: 표 16종, 보관함 6칸, 끼우기·빼기·맞바꾸기, 합치기 승계, 제물·판매 반환, 가득 차면 골드, 보상 카드, 정예 드롭
{
    assert.strictEqual(Game.state, 'prep');
    Game.monsters = [];
    Game.heroes = [];
    Game.equipBag = [];
    Game.gold = 1000;
    // 표: id, 이름, 등급, 효과
    const table = Object.values(EQUIPMENT).map(e => [e.id, e.name, e.grade, equipEffectText(e.id)].join('|')).join('\\n');
    assert.strictEqual(table, [
        'sword|저주받은 검|common|피해 +20%', 'bow|뼈 활|common|사거리 +15%', 'armor|강철 흉갑|common|체력 +30%',
        'ring|보랏빛 반지|common|공격 속도 +15%', 'boots|날개 장화|common|공격 속도 +10%, 사거리 +5%',
        'elixir|초록 비약|common|체력 +15%, 피해 +10%', 'axe|룬 전투 도끼|rare|피해 +40%', 'shield|해골 방패|rare|체력 +60%',
        'helmet|뿔 투구|rare|체력 +30%, 피해 +20%', 'amulet|핏빛 목걸이|rare|공격 속도 +30%', 'tome|고대 주문서|rare|피해 +15%, 사거리 +25%',
        'gauntlet|악마 손아귀|epic|피해 +60%, 공격 속도 +15%', 'staff|해골 지팡이|epic|피해 +40%, 사거리 +30%',
        'cape|어둠의 망토|epic|체력 +80%, 공격 속도 +15%', 'crystal|영혼 수정|epic|공격 속도 +30%, 처치 경험치 +100%',
        'crown|뼈 왕관|epic|체력 +40%, 피해 +40%, 처치 경험치 +50%'].join('\\n'));
    assert.strictEqual(JSON.stringify(EQUIP_RULES), '{"slots":6,"fullGold":30,"rewardEpicChance":0.4,"eliteDrop":0.25,"eliteRareChance":0.25}');
    // 하단 바: 보관함 6칸이 늘 있고(두 탭 모두), 소환 버튼·스킬 칸·다음 웨이브 버튼과 겹치지 않는다
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const tab of ['monster', 'demon']) {
        UI.setTab(tab);
        UI.update(0);
        const bags = UI.buttons.filter(b => b.bagSlot !== undefined);
        assert.strictEqual(bags.length, 6, 'six bag slots on ' + tab + ' tab');
        for (const b of bags) for (const o of UI.buttons.filter(o => o.bagSlot === undefined)) assert(!overlap(b, o), 'bag slot overlaps ' + o.id);
    }
    UI.setTab('monster');
    const bagXY = i => { const r = UI.bagRect(i); return [r.x + r.w / 2, r.y + r.h / 2]; };
    const near = (a, b) => Math.abs(a - b) < 1e-9;

    // 끼우기: 보관함 칸을 몬스터 위로 끈다. 끄는 동안 몬스터 강조 대상과 놓을 몬스터가 잡힌다
    const archer = Game.place('skeleton_archer', 4, 5);
    const base = monsterStats(archer);
    Game.equipBag = ['sword'];
    UI.update(0);
    const [bx, by] = bagXY(0);
    UI.onMove(bx, by);
    UI.onDown(bx, by);
    const to = monXY(archer);
    for (let i = 1; i <= 4; i++) UI.onMove(bx + (to[0] - bx) * i / 4, by + (to[1] - by) * i / 4);
    assert(UI.equipDrag && UI.equipDrag.id === 'sword' && UI.equipTarget === archer, 'equip drag targets the monster');
    UI.onUp(to[0], to[1]);
    assert(!UI.equipDrag && archer.equip === 'sword' && Game.equipBag.length === 0, 'equipped from bag');
    assert(near(monsterStats(archer).damage, base.damage * 1.2), 'sword +20% damage');
    assert(near(monsterStats(archer).range, base.range) && near(monsterStats(archer).interval, base.interval), 'other stats unchanged');
    // 보관함 칸을 끌지 않고 누르면 안내만
    Game.equipBag = ['bow'];
    UI.toast = null;
    click(...bagXY(0));
    assert(Game.equipBag[0] === 'bow' && UI.toast && UI.toast.text.includes('위에 놓기'), 'bag click hint');
    // 몬스터가 없는 곳에 놓으면 보관함에 그대로
    dragTo(bagXY(0), cellXY(13, 2));
    assert(Game.equipBag.join() === 'bow', 'dropped on nothing stays in bag');
    // 맞바꾸기: 끼고 있으면 원래 장비가 그 칸으로 돌아간다
    Game.equipBag = ['ring', 'bow'];
    dragTo(bagXY(1), monXY(archer));
    assert(archer.equip === 'bow' && Game.equipBag.join() === 'ring,sword', 'swap returns old equipment to the bag');
    assert(near(monsterStats(archer).range, base.range * 1.15) && near(monsterStats(archer).damage, base.damage), 'bow +15% range, sword gone');
    dragTo(bagXY(0), monXY(archer));
    assert(archer.equip === 'ring' && near(monsterStats(archer).interval, base.interval / 1.15), 'ring +15% attack speed');
    // 팝업: 장비 줄과 빼기 버튼. 빼면 수치가 그대로 돌아온다
    click(...monXY(archer));
    assert(UI.selectedMonster === archer && hasBtn('unequip'), 'unequip button in popup');
    btn('unequip');
    assert(!archer.equip && Game.equipBag.join() === 'bow,sword,ring', 'unequip back to bag');
    const after = monsterStats(archer);
    assert(after.damage === base.damage && after.range === base.range && after.interval === base.interval && after.hp === base.hp, 'stats restored');
    UI.clearSelection();
    // 보관함이 가득 차면 빼지 못한다
    setMonsterEquip(archer, 'sword');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    click(...monXY(archer));
    UI.toast = null;
    btn('unequip');
    assert(archer.equip === 'sword' && Game.equipBag.length === 6 && UI.toast.text.includes('가득'), 'unequip refused when bag full');
    UI.clearSelection();
    setMonsterEquip(archer, null);

    // 랭크 배율과 겹쳐도 곱해진다: 랭크 B(x1.5) + 뿔 투구(체력 +30%, 피해 +20%)
    const orc = Game.place('orc_guard', 3, 4);
    setMonsterRank(orc, 2);
    setMonsterEquip(orc, 'helmet');
    assert(near(orc.maxHp, 120 * 1.5 * 1.3) && near(monsterStats(orc).damage, 8 * 1.5 * 1.2), 'rank and equipment multiply');
    setMonsterEquip(orc, null);
    assert(near(orc.maxHp, 120 * 1.5) && near(monsterStats(orc).damage, 8 * 1.5), 'rank stays after unequip');
    // 체력 비율 유지: 절반 체력에서 강철 흉갑을 끼고 빼도 절반
    orc.hp = orc.maxHp / 2;
    Game.equipBag = ['armor'];
    dragTo(bagXY(0), monXY(orc));
    assert(orc.equip === 'armor' && near(orc.maxHp, 180 * 1.3) && near(orc.hp / orc.maxHp, 0.5), 'hp ratio kept on equip');
    assert(Game.unequipMonster(orc).ok && near(orc.maxHp, 180) && near(orc.hp, 90), 'hp ratio kept on unequip');
    // 웨이브 중에도 끼운다. 보상을 고르는 동안은 안 된다
    Game.state = 'wave';
    Game.equipBag = ['shield'];
    assert(Game.equipMonster(orc, 0).ok && orc.equip === 'shield', 'equip during wave');
    Game.state = 'prep';
    Game.bossReward = Game.rollBossReward();
    Game.equipBag = ['sword'];
    assert(!Game.equipMonster(archer, 0).ok && !archer.equip, 'no equip while choosing reward');
    Game.bossReward = null;
    // 처치 경험치: 영혼 수정 +100%, 뼈 왕관 +50%
    setMonsterRank(orc, 0);
    setMonsterEquip(orc, 'crystal');
    monsterKilledHero(orc, { boss: false, elite: false });
    assert.strictEqual(orc.xp, 2, 'crystal doubles kill xp');
    setMonsterEquip(orc, 'crown');
    monsterKilledHero(orc, { boss: false, elite: false });
    assert.strictEqual(orc.xp, 3.5, 'crown +50% xp');
    assert.strictEqual(monsterXpToNext(orc), 2, 'xp to next rounds up');
    setMonsterEquip(orc, null);

    // 합치기: 등급이 높은 쪽 장비 1개가 이어지고, 나머지는 보관함으로
    Game.equipBag = [];
    let mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(mage, 'sword');
    setMonsterEquip(archer, 'axe');
    assert.strictEqual(Game.mergeEquip(mage, archer).keep, 'axe', 'preview: higher grade');
    dragTo(monXY(mage), monXY(archer));
    let res = Game.monsterAt(4, 5);
    assert(res.type === 'curse_shooter' && res.equip === 'axe' && Game.equipBag.join() === 'sword', 'merge keeps higher grade, returns the other');
    assert(near(monsterStats(res).damage, MONSTERS.curse_shooter.stats.damage * 1.4), 'merged monster has the equipment effect');
    // 등급이 같으면 끌어온 쪽 것
    Game.monsters = [];
    Game.equipBag = [];
    let a = Game.place('skeleton_archer', 4, 5);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'bow');
    setMonsterEquip(mage, 'armor');
    assert.strictEqual(Game.mergeEquip(mage, a).keep, 'armor', 'preview: tie keeps dragged');
    dragTo(monXY(mage), monXY(a));
    res = Game.monsterAt(4, 5);
    assert(res.equip === 'armor' && Game.equipBag.join() === 'bow', 'tie: dragged monster equipment');
    // 한쪽만 있으면 그것이 이어진다
    a = Game.place('skeleton_archer', 3, 4);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'gauntlet');
    assert(Game.merge({ monster: mage }, { monster: a }).monster.equip === 'gauntlet', 'single equipment carried');
    // 보관함이 가득 차 있으면 나머지는 30G
    Game.monsters = [];
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    a = Game.place('skeleton_archer', 4, 5);
    mage = Game.place('dark_mage', 7, 4);
    setMonsterEquip(a, 'crown');
    setMonsterEquip(mage, 'sword');
    let gold0 = Game.gold;
    Fx.notice = null;
    UI.toast = null;
    res = Game.merge({ monster: mage }, { monster: a });
    assert(res.ok && res.monster.equip === 'crown' && Game.equipBag.length === 6 && Game.gold === gold0 + 30, 'merge leftover becomes 30G when bag full');
    UI.update(0);
    assert(UI.toast && UI.toast.text.includes('30G') && UI.toast.text.includes('저주받은 검'), 'full bag notice');

    // 제물과 판매: 장비는 보관함으로, 자리가 없으면 30G
    Game.equipBag = [];
    const s1 = Game.monsterAt(4, 5);
    assert(Game.sacrifice(s1).ok && Game.equipBag.join() === 'crown', 'sacrifice returns equipment');
    const s2 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s2, 'axe');
    click(...monXY(s2));
    btn('sell');
    assert(!Game.monsters.includes(s2) && Game.equipBag.join() === 'crown,axe', 'sell returns equipment');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    const s3 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s3, 'axe');
    gold0 = Game.gold;
    Game.sell(s3);
    assert(Game.gold === gold0 + Game.sellValue('orc_guard') + 30 && Game.equipBag.length === 6, 'sell with full bag: 30G');
    const s4 = Game.place('orc_guard', 3, 4);
    setMonsterEquip(s4, 'axe');
    gold0 = Game.gold;
    assert(Game.sacrifice(s4).ok && Game.gold === gold0 + 30 && Game.equipBag.length === 6, 'sacrifice with full bag: 30G');

    // 보스 보상: 장비 카드를 고르면 보관함으로. 보관함이 가득 차면 장비 카드만 꺼진다
    Game.equipBag = [];
    const kinds2 = r => r.cards.map(c => c.kind === 'gold' ? 'gold' + c.gold : (c.kind === 'equip' ? c.id : c.type)).join();
    Game.bossReward = withRandom([0.5, 0, 0.1, 0], () => Game.rollBossReward());
    assert.strictEqual(kinds2(Game.bossReward), 'orc_berserker,gauntlet,gold300');
    UI.onKey('Digit2');
    assert(!Game.bossReward && Game.equipBag.join() === 'gauntlet', 'equipment card goes to the bag');
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    Game.bossReward = Game.rollBossReward();
    UI.update(0);
    const rb = id => UI.buttons.find(b => b.id === id);
    assert(!rb('reward0').disabled && rb('reward1').disabled && !rb('reward2').disabled, 'equipment card dimmed when bag full');
    UI.toast = null;
    UI.onKey('Digit2');
    assert(Game.bossReward && Game.equipBag.length === 6 && UI.toast.text.includes('보관함'), 'equipment card refused when bag full');
    UI.onKey('Digit3');
    assert(!Game.bossReward);

    // 정예 드롭: 25% 확률, 일반 75% 희귀 25%. 난수 순서: 드롭, 등급, 장비
    Game.equipBag = [];
    assert(withRandom([0.25], () => Game.eliteDrop(0, 0)) === null && Game.equipBag.length === 0, 'no drop from 25%');
    assert(withRandom([0.24, 0], () => Game.eliteDrop(0, 0)).id === 'sword', 'drop is a material');
    assert.strictEqual(Game.equipBag.join(), 'sword');
    for (let i = 0; i < 200; i++) {
        Game.equipBag = [];
        const d = Game.eliteDrop(0, 0);
        assert(!d || EQUIPMENT[d.id].grade !== 'epic', 'elite never drops epic');
    }
    // 실제 처치: 정예를 쓰러뜨리면 떨어뜨리고 알린다. 일반 용사는 떨어뜨리지 않는다
    Game.state = 'wave';
    Game.equipBag = [];
    const elite = createHero('elite_swordsman', 2, 0, false);
    elite.waiting = false;
    Game.heroes = [elite];
    Fx.notice = null;
    withRandom(0, () => damageHero(elite, 1e9));
    assert(elite.dead && Game.equipBag.join() === 'sword' && Fx.drops.some(d => d.id === 'sword'), 'elite kill drops equipment');
    UI.update(0);
    assert(UI.toast && UI.toast.text.includes('저주받은 검'), 'drop notice');
    const grunt = createHero('warrior', 2, 0, false);
    grunt.waiting = false;
    Game.heroes = [grunt];
    withRandom(0, () => damageHero(grunt, 1e9));
    assert.strictEqual(Game.equipBag.length, 1, 'normal hero drops nothing');
    // 보관함이 가득 차면 드롭은 30G로 바뀐다
    Game.equipBag = ['bow', 'bow', 'bow', 'bow', 'bow', 'bow'];
    const elite2 = createHero('elite_tamer', 2, 0, false);
    elite2.waiting = false;
    Game.heroes = [elite2];
    gold0 = Game.gold;
    withRandom(0, () => damageHero(elite2, 1e9));
    assert(Game.gold === gold0 + elite2.bounty + 30 && Game.equipBag.length === 6, 'full bag drop becomes 30G');
    UI.update(0);
    assert(UI.toast.text.includes('30G'), 'full bag drop notice');
    Game.heroes = [];
    Game.corpses = [];
    Game.state = 'prep';
    Game.monsters = [];
    Game.gold = COMBAT_RULES.startGold;
}

// ----- 두 입구(합류형, docs/MULTI_PATH.md) -----
// 준비 상태에서 준비 시간을 길게 두고 시험한다(웨이브 중이면 용사가 없을 때 웨이브가 끝난다)
{
    const savedWave = Game.waveIndex;
    const prep = () => { Game.state = 'prep'; Game.prepTimer = 9999; Game.bossReward = null; };
    const placeOn = (type, route, d) => {
        const h = createHero(type, 0, 0, false, route);
        Object.assign(h, { waiting: false, d, lane: 0, cast: 99, song: 99 });
        Game.heroes.push(h);
        return h;
    };
    // 시험 동안 서로 쓰러뜨리지 않는다
    const sturdy = h => { h.hp = h.maxHp = 1e6; h.damage = 0; return h; };
    const mN = mergeDistance('north');
    const mS = mergeDistance('south');
    clearBoard();
    prep();

    // 길: 합류점 (10,8)에서 만나고, 그 뒤로는 두 길의 좌표와 방향, 남은 거리가 같다. 남쪽이 2칸 짧다
    assert.strictEqual(mN - mS, 2 * TILE, 'south is two tiles shorter');
    assert.strictEqual(ROUTES.north.length - mN, ROUTES.south.length - mS, 'same distance after the merge');
    for (let t = 0; t <= ROUTES.north.length - mN; t += TILE / 4) {
        const a = pathAt(mN + t, 'north');
        const b = pathAt(mS + t, 'south');
        // 합류점 바로 그 점에서는 들어오던 방향이 달라 좌표만 본다
        assert(distance(a.x, a.y, b.x, b.y) < 1e-6 && (t === 0 || (a.dx === b.dx && a.dy === b.dy)), 'merged section coincides at ' + t);
    }
    const mp = pathAt(mS, 'south');
    assert(mp.x === tileX(MERGE_TILE.col) && mp.y === tileY(MERGE_TILE.row), 'merge at (10,8)');
    assert(pathAt(0, 'south').x < 0 && pathAt(0, 'south').y === tileY(11), 'south walks in from outside the gate');
    assert(pathAt(500).x === pathAt(500, 'north').x && pathAt(500).y === pathAt(500, 'north').y, 'route defaults to north');
    // 길 칸은 합집합: 남쪽 갈래 (0..10, 11), (10, 9..10)도 길이라 지을 수 없다
    for (let c = 0; c <= 10; c++) assert(isPathCell(c, 11) && !isBuildCell(c, 11), 'south path cell ' + c);
    assert(isPathCell(10, 9) && isPathCell(10, 10) && !Game.canPlace('orc_guard', 10, 10));
    for (const id of ROUTE_IDS) for (const k of ROUTES[id].cells) assert(PATH_CELLS.has(k), 'union has ' + k);
    // 남쪽 갈래 위아래 줄도 건설 칸이다(아래는 12줄까지)
    assert(isBuildCell(3, 12) && isBuildCell(3, 10) && isBuildCell(7, 9), 'cells around the south branch');

    // 입구 배분: 일반과 정예를 비율대로 정확히 나눈다. 비율이 없으면 전부 북쪽
    for (const w of WAVES) {
        const c = Game.entryCounts(w);
        const total = [...Object.values(w.members), ...Object.values(w.elites || {})].reduce((a, b) => a + b, 0);
        assert.strictEqual(c.north + c.south, total, 'split adds up ' + w.party);
        if (!w.entry) assert.strictEqual(c.south, 0, 'no entry: all north ' + w.party);
        else assert(Math.abs(c.south - total * w.entry.south / (w.entry.north + w.entry.south)) <= 0.5 + 1e-9, 'split follows ratio ' + w.party);
    }
    assert(!WAVES[0].entry && !WAVES[1].entry && WAVES[2].entry.south === 0.3 && WAVES[4].entry.south === 0.4 && WAVES[7].entry.south === 0.5, 'entry table');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 10 }, entry: { north: 0.7, south: 0.3 } })), '{"north":7,"south":3}');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 9 }, entry: { north: 0.5, south: 0.5 } })), '{"north":5,"south":4}', 'tie goes north');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 6, rogue: 3 } })), '{"north":9,"south":0}', 'no ratio: all north');
    assert.strictEqual(JSON.stringify(Game.entryCounts({ members: { warrior: 6 }, entry: { south: 1 } })), '{"north":0,"south":6}');

    // 웨이브 시작: 입구별 인원이 정확히 맞고, 직업 수는 그대로다. 출발 간격은 입구마다 따로 세고 남쪽은 절반 늦게 출발한다
    const gap = COMBAT_RULES.spawnGap;
    for (const wi of [0, 3, 8]) {
        clearBoard();
        prep();
        Game.waveIndex = wi;
        assert(Game.startWave());
        const w = WAVES[wi];
        const c = Game.entryCounts(w);
        const of = r => Game.heroes.filter(h => h.route === r && !h.boss);
        assert.strictEqual(of('north').length, c.north, 'north count wave ' + (wi + 1));
        assert.strictEqual(of('south').length, c.south, 'south count wave ' + (wi + 1));
        const types = {};
        for (const h of Game.heroes) types[h.type] = (types[h.type] || 0) + 1;
        for (const [t, n] of [...Object.entries(w.members), ...Object.entries(w.elites || {})]) assert.strictEqual(types[t], n, 'type count ' + t);
        const delays = r => of(r).map(h => h.delay).sort((a, b) => a - b);
        delays('north').forEach((d, i) => assert(Math.abs(d - i * gap) < 1e-9, 'north gap'));
        delays('south').forEach((d, i) => assert(Math.abs(d - (gap / 2 + i * gap)) < 1e-9, 'south gap, half offset'));
        if (wi === 0) assert(Game.heroes.every(h => h.route === 'north'), 'first wave all north');
    }
    // 보스는 북쪽 입구로, 모든 용사가 출발한 뒤에 온다. 예고 글자에 입구를 적는다. BOSSES의 entry를 바꾸면 그 입구로
    clearBoard();
    prep();
    Game.waveIndex = 4;
    Game.startWave();
    {
        const boss = Game.heroes.find(h => h.boss);
        assert(boss && boss.route === 'north', 'boss from the north gate');
        assert(Game.heroes.every(h => h === boss || h.delay < boss.delay), 'boss comes last');
        assert(Fx.banner.sub.includes('북쪽 입구'), 'boss banner names the gate');
        assert(Game.heroes.some(h => h.elite && h.route) && Game.heroes.filter(h => h.route === 'south').length === Game.entryCounts(WAVES[4]).south);
    }
    BOSSES.archmage.entry = 'south';
    clearBoard();
    prep();
    Game.startWave();
    assert.strictEqual(Game.heroes.find(h => h.boss).route, 'south', 'boss entry from the table');
    assert(Fx.banner.sub.includes('남쪽 입구'));
    BOSSES.archmage.entry = 'north';
    assert.strictEqual(Game.bossEntry('fallen_knight'), 'north');

    // 남쪽 용사는 남쪽 갈래를 지나 합류점에서 북쪽 길로 이어 걸어 왕좌에 닿는다(북쪽 갈래 칸은 지나지 않는다)
    clearBoard();
    prep();
    Game.hp = 20;
    {
        const h = placeOn('warrior', 'south', 0);
        h.speed = 12 * TILE;
        const cells = new Set();
        for (let i = 0; i < 300 && !h.dead; i++) {
            Game.update(1 / 30);
            const w = heroWorld(h);
            cells.add(Math.floor(w.x / TILE) + ',' + Math.floor((w.y - MAP_TOP) / TILE));
        }
        assert(h.dead && h.arrived, 'south hero reached the throne');
        assert.strictEqual(Game.hp, 19, 'south hero hits the throne');
        assert(cells.has('4,11') && cells.has('10,10') && cells.has('12,3') && cells.has('21,9'), 'walked the south branch and the shared path');
        assert(!cells.has('5,5') && !cells.has('2,3'), 'never on the north branch');
    }

    // 가장 앞선 용사: d가 아니라 왕좌까지 남은 거리로 비교한다
    clearBoard();
    prep();
    {
        const n = sturdy(placeOn('warrior', 'north', mN - TILE));
        const s = sturdy(placeOn('warrior', 'south', mS - 0.5 * TILE));
        assert(n.d > s.d && remainingDistance(s) < remainingDistance(n));
        assert.strictEqual(foremostHero(tileX(6), tileY(8), 5 * TILE), s, 'south hero is closer to the throne');
        s.d = mS - 1.5 * TILE;
        assert.strictEqual(foremostHero(tileX(6), tileY(8), 5 * TILE), n, 'north hero is closer now');
        // 낀 칸의 궁수도 같은 규칙으로 쏜다
        n.speed = s.speed = 0;
        s.d = mS - 0.5 * TILE;
        const archer = Game.place('skeleton_archer', 8, 10);
        archer.atk = 0;
        for (let i = 0; i < 20 && !Game.projectiles.length; i++) Game.update(1 / 30);
        assert(Game.projectiles.length && Game.projectiles[0].target === s, 'archer shoots the foremost (south) hero');
        Game.projectiles = [];
    }

    // 막기와 풀림: 북쪽 갈래, 남쪽 갈래 따로
    clearBoard();
    prep();
    {
        const oN = Game.place('orc_guard', 2, 2);
        const oS = Game.place('orc_guard', 3, 10);
        assert.strictEqual(oN.rally.route, 'north');
        assert.strictEqual(oS.rally.route, 'south', 'rally on the south branch');
        assert(Math.abs(oS.rally.y + MONSTER_FOOT - 10 - tileY(11)) < 1e-6 && oS.rally.x === tileX(3), 'south rally under the cell');
        for (const o of [oN, oS]) { o.hp = o.maxHp = 1e6; o.damage = 0; }
        tick(1.6);
        assert(!oN.moving && !oS.moving, 'both walked out');
        const hN = sturdy(placeOn('warrior', 'north', oN.rally.d - 1.5 * TILE));
        const hS = sturdy(placeOn('warrior', 'south', oS.rally.d - 1.5 * TILE));
        tick(2);
        assert.strictEqual(hN.blocker, oN, 'north branch blocked');
        assert.strictEqual(hS.blocker, oS, 'south branch blocked');
        const dS = hS.d;
        tick(0.5);
        assert.strictEqual(hS.d, dS, 'blocked hero stands');
        // 풀림: 남쪽 오크를 옮기면 놓아주고 다시 걷는다. 북쪽 오크가 쓰러져도 놓아준다
        assert(Game.moveMonster(oS, 3, 6));
        assert.strictEqual(oS.rally.route, 'north', 'moved orc rallies on the north branch');
        assert(!hS.blocker);
        knockDownMonster(oN);
        assert(!hN.blocker);
        tick(0.5);
        assert(hS.d > dS && hN.d > oN.rally.d - 1.5 * TILE, 'both walk on after release');
    }

    // 합류점 근처: (11,8)의 오크는 합류점 (10,8)에 서서 두 갈래에서 오는 용사를 모두 붙잡는다.
    // (11,9)의 오크는 남쪽 갈래 (10,9)에 서고 북쪽 용사는 붙잡지 않는다
    clearBoard();
    prep();
    {
        const o = Game.place('orc_guard', 11, 8);
        assert(o.rally.route === 'north' && o.rally.x === tileX(10) && Math.abs(o.rally.y + MONSTER_FOOT - 10 - tileY(8)) < 1e-6, 'rally on the merge point');
        o.hp = o.maxHp = 1e6;
        o.damage = 0;
        tick(1.6);
        const hN = sturdy(placeOn('warrior', 'north', mN - 1.5 * TILE));
        const hS = sturdy(placeOn('warrior', 'south', mS - 1.5 * TILE));
        tick(2);
        assert(hN.blocker === o && hS.blocker === o, 'merge orc holds both branches');
        Game.removeMonster(o);
        assert(!hN.blocker && !hS.blocker);
        clearBoard();
        const o2 = Game.place('orc_guard', 11, 9);
        assert(o2.rally.route === 'south' && o2.rally.d < mS, 'rally on the south branch before the merge');
        o2.hp = o2.maxHp = 1e6;
        o2.damage = 0;
        tick(1.6);
        const n2 = sturdy(placeOn('warrior', 'north', mN - 1.5 * TILE));
        const s2 = sturdy(placeOn('warrior', 'south', mS - 2 * TILE));
        tick(2);
        assert.strictEqual(s2.blocker, o2, 'south hero held at (10,9)');
        assert(n2.blocker !== o2 && n2.d > mN, 'north hero passes the merge');
    }

    // 낀 칸 (9,9): 북쪽 갈래 (9,8)와 남쪽 갈래 (10,9)에서 모두 1칸. 소환과 끌기로 놓을 수 있다
    clearBoard();
    prep();
    {
        const gapTo = (route, c, r) => Math.min(...ROUTES[route].segments.map(s => {
            const t = clamp((tileX(c) - s.ax) * s.dx + (tileY(r) - s.ay) * s.dy, 0, s.len);
            return distance(tileX(c), tileY(r), s.ax + s.dx * t, s.ay + s.dy * t);
        }));
        assert(isBuildCell(9, 9), 'between cell');
        assert(gapTo('north', 9, 9) === TILE && gapTo('south', 9, 9) === TILE, 'one tile from both branches');
        // 다른 빈 칸을 모두 채우면 소환은 낀 칸에 나온다(오크 경비병, 암흑 마법사)
        SUMMON_RULES.maxField = 999;
        for (const key of BUILD_CELLS) {
            const [c, r] = key.split(',').map(Number);
            if (key !== '9,9') Game.place('skeleton_archer', c, r);
        }
        Game.gold = 5000;
        const r1 = withRandom([0.1, 0.03], () => Game.summon());
        assert(r1.ok && r1.type === 'orc_guard' && r1.monster.col === 9 && r1.monster.row === 9, 'blocker summoned into the between cell');
        assert(r1.monster.rally.route === 'north' && Math.abs(r1.monster.rally.y + MONSTER_FOOT - 10 - tileY(8)) < 1e-6, 'tie goes to the north branch');
        Game.removeMonster(r1.monster);
        const r2 = withRandom([0.69, 0.17], () => Game.summon());
        assert(r2.ok && r2.type === 'dark_mage' && r2.monster.col === 9 && r2.monster.row === 9, 'ranged summoned into the between cell');
        SUMMON_RULES.maxField = 24;
        // 끌기: 남쪽 갈래 아래 칸의 오크를 낀 칸으로 옮기면 집결 지점이 바뀐다
        Game.monsters = [];
        const o = Game.place('orc_guard', 3, 10);
        assert.strictEqual(o.rally.route, 'south');
        UI.clearSelection();
        dragTo(monXY(o), cellXY(9, 9));
        assert.strictEqual(Game.monsterAt(9, 9), o, 'dragged into the between cell');
        assert(o.rally.route === 'north' && o.rally.x === tileX(9), 'rally moved to the north branch');
        // 남쪽 길 칸으로는 끌어 놓지 못한다
        dragTo(monXY(o), cellXY(5, 11));
        assert.strictEqual(Game.monsterAt(9, 9), o, 'south path cell rejected');
    }

    // 시체와 타락 유닛에도 길을 남긴다(타락은 꺼 두었지만 켰을 때를 위해)
    clearBoard();
    prep();
    {
        Game.corpses = [];
        const h = placeOn('warrior', 'south', 3 * TILE);
        damageHero(h, 1e9);
        const corpse = Game.corpses[Game.corpses.length - 1];
        assert(corpse && corpse.route === 'south' && corpse.d === 3 * TILE, 'corpse keeps the route');
        const u = createCorruptUnit(corpse);
        assert(u.route === 'south' && u.d === corpse.d, 'corrupt unit keeps the route');
        Game.corpses = [];
    }

    clearBoard();
    Game.projectiles = [];
    Game.waveIndex = savedWave;
    prep();
    Game.prepTimer = COMBAT_RULES.prepTime;
    UI.clearSelection();
    UI.toast = null;
}

// 패배 후 다시 시작하면 모두 초기화(소환 비용도 처음으로)
assert(Game.summon().ok && Game.summonCost() > SUMMON_RULES.cost, 'cost rose before retry');
setMonsterRank(Game.monsters[0], 4);
setMonsterEquip(Game.monsters[0], 'crown');
Game.equipBag = ['sword', 'axe'];
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'select');
btn('begin');
assert.strictEqual(Game.state, 'prep');
assert.strictEqual(Game.equipBag.length, 0, 'bag emptied on retry');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert.strictEqual(Game.monsters.length, 0);
assert.strictEqual(UI.tab, 'monster', 'retry starts on monster tab');
assert(Game.summonCount === 0 && Game.summonCost() === SUMMON_RULES.cost, 'summon cost reset');
assert.strictEqual(Game.units.length, 0);
{
    // 랭크도 처음으로: 다시 소환한 몬스터는 D
    const r = Game.summon();
    assert(r.ok && r.monster.rank === 0 && r.monster.xp === 0 && !r.monster.equip, 'rank and equipment reset on retry');
    Game.removeMonster(r.monster);
    Game.gold = COMBAT_RULES.startGold;
    Game.summonCount = 0;
}

delete WAVES[4].boss; // 앞 시험에서 넣은 임시 보스
// 한 판 끝까지: 보스 패턴 포함, 예외 없이 승리 화면까지 간다
Game.gold = 6000;
[[3,4,'skeleton_archer'],[4,5,'dark_mage'],[3,2,'orc_guard'],[7,5,'skeleton_archer'],[9,5,'dark_mage'],[6,10,'skeleton_archer'],[12,4,'orc_guard'],[13,5,'dark_mage'],[14,7,'dark_mage'],[16,7,'skeleton_archer'],[12,6,'dark_mage'],[16,5,'dark_mage'],
    // 길 뒤쪽: 돌진하는 보스를 붙잡을 오크와 마무리 화력
    [17,10,'orc_guard'],[20,9,'orc_guard'],[22,8,'orc_guard'],[19,10,'skeleton_archer'],[20,6,'dark_mage'],[23,6,'skeleton_archer']].forEach(([c,r,t]) => assert(Game.place(t,c,r), 'place ' + t + ' ' + c + ',' + r));
for (const x of Game.monsters) { Game.upgrade(x); Game.upgrade(x, 'A'); }
Game.heroHpMul = 0.03; // 규칙이 끝까지 도는지 보는 시험이라 난이도는 낮춘다(용사가 떼로 나온다)
SWARM_RULES.leak = 0.02;
let guard = 0, sawCharge = false, sawStomp = false, rewards = 0, sawArchmage = false, equipped = 0;
const eliteWaves = new Set();
while (Game.state !== 'victory' && Game.state !== 'defeat' && guard++ < 60000) {
    // 보스 보상: 둘째 카드(장비)를 고르고, 보관함이 가득 차면 골드
    if (Game.bossReward) {
        rewards++;
        assert(!Game.startWave(), 'no wave before reward');
        UI.onKey('Digit2');
        if (Game.bossReward) UI.onKey('Digit3');
        assert(!Game.bossReward);
    }
    // 보관함의 장비는 바로 맵의 몬스터에게 끼운다(웨이브 중에도)
    if (Game.equipBag.length && Game.inPlay()) {
        const free = Game.monsters.find(m => !m.equip);
        if (free && Game.equipMonster(free, 0).ok) equipped++;
    }
    if (Game.state === 'prep') Game.startWave();
    if (Game.heroes.some(h => h.bossKey === 'archmage')) sawArchmage = true;
    UI.update(1 / 30);
    Game.update(1 / 30);
    if (Game.heroes.some(h => h.elite)) eliteWaves.add(Game.waveIndex);
    const b = Game.heroes.find(h => h.boss);
    if (b && b.chargeTime > 0) sawCharge = true;
    if (b && b.patternsDone[1]) sawStomp = true;
}
assert.strictEqual(Game.state, 'victory', 'wave ' + (Game.waveIndex + 1) + ' hp ' + Game.hp + ' heroes ' + Game.heroes.map(h => h.type + (h.boss ? 'B' : '') + ':' + Math.round(h.d)).join(' '));
assert(sawCharge && sawStomp, 'boss patterns fired');
assert(sawArchmage && rewards >= 11, 'archmage, a card reward every 5 rounds (rewards ' + rewards + ')');
assert(eliteWaves.size >= 12, 'elites appeared every 5 rounds');
assert(equipped >= 1, 'boss reward equipment was equipped');
SWARM_RULES.leak = 1;
console.log('smoke ok: waves', Game.waveIndex + 1, 'kills', Game.stats.kills, 'hp', Game.hp, 'time', Math.round(Game.stats.time));
`, ctx, { filename: 'smoke' });

// 마왕과 유물: 표, 선택 화면, 효과 키, 유물 칸 수, 다시 시작, 저장소. 위의 한 판 시험이 끝난 뒤 같은 환경에서 이어 돈다
vm.runInContext(`{ // 위 시험과 이름이 겹치지 않게 블록으로 감싼다
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, (msg || '') + ': ' + a + ' != ' + b);
// 저장소 흉내: 값을 담는 것, 읽기와 쓰기에서 예외를 내는 것
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
// 기록을 이 시험용으로: 스토리 스테이지를 앞에서부터 n개 깬 상태(저장소는 건드리지 않는다).
// 6개(전부)면 마왕 3명, 유물 16종, 칸 3개. 3개면 균열의 군주와 뼈의 여왕, 유물 10종, 칸 1개
const progress = n => { Meta.data = Meta.sanitize({ version: META_VERSION, cleared: STAGES.slice(0, n).map(s => s.id) }); };
// 스토리 없는 판의 고르기 화면(시험 도구용)
const toSelect = () => { Game.state = 'title'; UI.openSelect(null); };
progress(STAGES.length);

// ----- 표 -----
same(Object.keys(DEMON_LORDS), ['rift', 'bone_queen', 'gold_king'], 'three lords');
same(DEMON_LORDS.rift.effects, { lightningDamage: 1.25, skillCooldown: 0.9 }, 'rift');
same(DEMON_LORDS.bone_queen.effects, { respawn: 0.6, xp: 0.25, maxHp: -3 }, 'bone queen');
same(DEMON_LORDS.gold_king.effects, { startGold: 100, bounty: 1.2, maxHp: -5 }, 'gold king');
assert.strictEqual(Object.keys(RELICS).length, 19, 'nineteen relics');
assert(typeof RELIC_RULES === 'undefined', 'relic slots come from Meta, not a fixed table');
for (const src of [...Object.values(DEMON_LORDS), ...Object.values(RELICS)]) {
    for (const key of Object.keys(src.effects)) assert(LORD_EFFECTS[key], 'known effect key ' + key + ' in ' + src.name);
}
// 설명 문구는 효과 표에서 만든다
same(effectLines(DEMON_LORDS.rift.effects), ['번개 피해 +25%', '스킬 재사용 ×0.9']);
same(effectLines(DEMON_LORDS.bone_queen.effects), ['부활 시간 ×0.6', '처치 경험치 +25%', '최대 체력 -3']);
same(effectLines(DEMON_LORDS.gold_king.effects), ['시작 골드 +100G', '처치 골드 ×1.2', '최대 체력 -5']);
for (const r of Object.values(RELICS)) assert(effectLines(r.effects).length === 1 && effectLines(r.effects)[0].length > 3, r.id + ' text');
assert(effectGood('maxHp', -3) === false && effectGood('respawn', 0.6) && effectGood('skillCooldown', 0.9) && effectGood('startGold', 100), 'good/bad colors');
// 합치기: 더하는 키는 더하고 곱하는 키는 곱한다
{
    near(buildMods('bone_queen', ['dead_horn']).meleeDamage, 0.15, 'relic ratio');
    near(buildMods('rift', ['storm_bottle']).lightningCooldown, 0.75, 'lightning cooldown');
    near(buildMods('rift', ['sniper_mark']).range, 0.1, 'ratio');
    assert.strictEqual(buildMods('rift', ['legion_banner']).fieldMax, 3, 'adds');
    same(buildMods('nobody', ['nothing', 'toString']), emptyMods(), 'unknown ids ignored');
}

// ----- 코드에 마왕이나 유물 이름별 분기가 없다(id 문자열은 데이터에만) -----
{
    const src = ${JSON.stringify(['js/game/game.js', 'js/game/combat.js', 'js/game/hero.js', 'js/game/monster.js', 'js/game/render.js', 'js/ui/ui.js', 'js/main.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'))};
    for (const id of [...Object.keys(DEMON_LORDS), ...Object.keys(RELICS)]) {
        assert(!new RegExp("['\\"\`]" + id + "['\\"\`]").test(src), 'no branch on id ' + id);
    }
}

// ----- 값이 없으면 지금과 같다: 효과 없는 시작(시험 도구와 tools/simulate.js) -----
Game.reset();
same(Game.mods, emptyMods(), 'no mods');
assert(Game.lord === null && Game.relics.length === 0 && Game.lordDef() === DEMON_LORDS.rift, 'default lord art');
assert.strictEqual(Game.gold, COMBAT_RULES.startGold);
assert(Game.hp === COMBAT_RULES.maxHp && Game.maxHp() === COMBAT_RULES.maxHp, 'max hp');
assert(Game.skillCooldown('lightning') === COMBAT_RULES.lightning.cooldown && Game.skillCooldown('roar') === COMBAT_RULES.roar.cooldown, 'cooldowns');
assert.strictEqual(Game.lightningDamage(), COMBAT_RULES.lightning.damage);
assert.strictEqual(Game.maxField(), SUMMON_RULES.maxField);
same(Game.summonOdds(), SUMMON_RULES.odds, 'odds');
assert.strictEqual(Game.summonCost(), SUMMON_RULES.cost);
for (const t of Object.keys(MONSTERS)) {
    assert.strictEqual(Game.sellValue(t), SUMMON_RULES.refund[MONSTERS[t].grade], 'refund ' + t);
    for (let r = 0; r < MONSTER_RANKS.length; r++) same(Game.sacrificeGain({ type: t, rank: r }), sacrificeGain({ type: t, rank: r }), 'sacrifice ' + t);
}
// 몬스터 수치: 기본 수치 x 랭크 x 장비 그대로
{
    const m = createMonster('orc_guard', 3, 4);
    setMonsterRank(m, 2);
    setMonsterEquip(m, 'helmet');
    const s = monsterStats(m);
    const b = MONSTERS.orc_guard.stats;
    near(s.hp, b.hp * 1.5 * 1.3, 'hp');
    near(s.damage, b.damage * 1.5 * 1.2, 'damage');
    assert(s.interval === b.interval && s.range === b.range && s.respawn === b.respawn, 'interval, range, respawn');
}

// ----- 효과 키마다 적용 -----
// 효과 하나만 넣고 시작한다(다른 키는 기본값)
const only = (key, value) => { Game.reset(); Game.mods[key] = value; };
const firstEmptyCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
{
    // startGold, maxHp: 선택한 마왕과 유물로 시작
    Game.reset({ lord: 'gold_king', relics: ['greedy_vault'] });
    assert(Game.gold === COMBAT_RULES.startGold + 100 && Game.hp === 15 && Game.maxHp() === 15, 'gold king: gold ' + Game.gold + ' hp ' + Game.hp);
    Game.reset({ lord: 'bone_queen', relics: [] });
    assert(Game.hp === 17 && Game.maxHp() === 17, 'bone queen: hp 17');
    // 제물 회복도 바뀐 최대 체력까지
    Game.hp = 16;
    const r = Game.sacrifice(Game.place('bone_knight', ...firstEmptyCell()));
    assert(r.ok && r.heal === 1 && Game.hp === 17, 'sacrifice clamps at modded max hp');

    // skillCooldown, lightningDamage
    only('skillCooldown', 0.8);
    assert(castLightning(500, 500) && Game.skills.lightning === 24, 'lightning cooldown x0.8');
    Game.hp = 5;
    assert(castRoar() && Game.skills.roar === 48, 'roar cooldown x0.8');
    only('lightningDamage', 1.5);
    {
        const h = createHero('rogue', 0, 0, false);
        Object.assign(h, { waiting: false, d: 900, lane: 0 });
        Game.heroes.push(h);
        const p = heroWorld(h);
        const before = h.hp = 1000;
        resolveStrike({ x: p.x, y: p.y });
        assert.strictEqual(before - h.hp, 60, 'lightning damage x1.5');
    }

    // heroSpeed
    only('heroSpeed', 0.92);
    near(createHero('rogue', 0, 0, false).speed, HEROES.rogue.speed * TILE * 0.92, 'hero speed');
    near(createHero(null, 0, 0, 'archmage').speed, BOSSES.archmage.speed * TILE * 0.92, 'boss speed');

    // damage, hp, attackSpeed, range: 장비 다음에 곱한다
    only('damage', 0.1);
    Game.mods.hp = 0.15;
    Game.mods.attackSpeed = 0.1;
    Game.mods.range = 0.1;
    const m = createMonster('skeleton_archer', 3, 4);
    setMonsterEquip(m, 'bow');
    const s = monsterStats(m);
    const b = MONSTERS.skeleton_archer.stats;
    near(s.damage, b.damage * 1.1, 'damage +10%');
    near(s.hp, b.hp * 1.15, 'hp +15%');
    near(s.interval, b.interval / 1.1, 'attack speed +10%');
    near(s.range, b.range * 1.15 * 1.1, 'range after equipment');
    near(m.maxHp, b.hp * 1.15, 'max hp follows');

    // xp
    only('xp', 0.5);
    const killer = Game.place('skeleton_archer', ...firstEmptyCell());
    monsterKilledHero(killer, { elite: false, boss: false });
    near(killer.xp, 1.5, 'xp +50%');
    setMonsterEquip(killer, 'crystal');
    monsterKilledHero(killer, { elite: true, boss: false });
    near(killer.xp, 1.5 + 3 * 2 * 1.5, 'xp with equipment');

    // bounty
    only('bounty', 1.2);
    {
        const h = createHero('warrior', 0, 0, false);
        Object.assign(h, { waiting: false, d: 900, lane: 0 });
        Game.heroes.push(h);
        const g0 = Game.gold;
        damageHero(h, 1e9);
        assert.strictEqual(Game.gold - g0, Math.floor(HEROES.warrior.bounty * 1.2), 'bounty x1.2, the rest carries over');
    }

    // rareChance: 일반에서 희귀로 옮긴다
    only('rareChance', 0.05);
    const odds = Game.summonOdds();
    near(odds.common, 0.65, 'common');
    near(odds.rare, 0.30, 'rare');
    assert.strictEqual(odds.epic, 0.05);
    assert.strictEqual(SUMMON_RULES.odds.common, 0.70, 'table untouched');
    assert.strictEqual(MONSTERS[withRandom([0.66, 0], () => Game.rollSummon())].grade, 'rare', '0.66 is rare now');
    Game.mods.rareChance = 0;
    assert.strictEqual(MONSTERS[withRandom([0.66, 0], () => Game.rollSummon())].grade, 'common', '0.66 is common by default');

    // summonBase
    only('summonBase', -5);
    assert.strictEqual(Game.summonCost(), 20, 'start cost -5');
    Game.summonCount = 100;
    assert.strictEqual(Game.summonCost(), SUMMON_RULES.cost - 5 + SUMMON_RULES.costStep * 100, 'cost keeps rising');

    // fieldMax
    only('fieldMax', 4);
    assert.strictEqual(Game.maxField(), 28);
    Game.gold = 99999;
    for (let i = 0; i < 24; i++) assert(Game.place('orc_guard', ...firstEmptyCell()), 'fill');
    assert(!Game.fieldFull() && Game.summon().ok, 'room beyond 24');
    for (let i = 0; i < 3; i++) Game.summon();
    assert(Game.monsters.length === 28 && Game.fieldFull() && Game.summon().reason === 'full', 'cap 28');

    // respawn
    only('respawn', 0.6);
    {
        const o = Game.place('orc_guard', ...firstEmptyCell());
        knockDownMonster(o);
        near(o.down, MONSTERS.orc_guard.stats.respawn * 0.6, 'respawn x0.6');
    }

    // eliteDrop
    only('eliteDrop', 0.15);
    assert(withRandom([0.3, 0, 0], () => Game.eliteDrop(0, 0)), 'drop at 0.3 with +15%');
    Game.mods.eliteDrop = 0;
    assert.strictEqual(withRandom([0.3, 0, 0], () => Game.eliteDrop(0, 0)), null, 'no drop at 0.3 by default');

    // refund
    only('refund', 1.5);
    assert(Game.sellValue('orc_guard') === 30 && Game.sellValue('bone_knight') === 225, 'refund x1.5');
    {
        const o = Game.place('orc_guard', ...firstEmptyCell());
        const g0 = Game.gold;
        Game.sell(o);
        assert.strictEqual(Game.gold - g0, 30, 'sell pays refund');
    }

    // sacrifice: 체력은 내림
    only('sacrifice', 1.5);
    same(Game.sacrificeGain('orc_guard'), { heal: 1, lightning: 3 }, 'common x1.5');
    same(Game.sacrificeGain('bone_knight'), { heal: 7, lightning: 15 }, 'epic x1.5');
    Game.hp = 1;
    Game.skills.lightning = 20;
    const r2 = Game.sacrifice(Game.place('bone_knight', ...firstEmptyCell()));
    assert(r2.ok && Game.hp === 8 && Game.skills.lightning === 5, 'sacrifice applied');
}

// ----- 선택 화면: 고르고 시작, 다시 시작, 저장소(스테이지 3까지 깸: 마왕 2명, 유물 칸 1개) -----
progress(3);
globalThis.localStorage = memoryStorage();
UI.loadout = null; // 창을 새로 연 것처럼
toSelect();
assert.strictEqual(Game.state, 'select');
same(UI.loadout, { lord: 'rift', relics: [] }, 'empty storage: default');
// 마왕 카드 3장, 유물 19칸, 고른 칸 1개, 시작 버튼
assert(['lord_rift', 'lord_bone_queen', 'lord_gold_king', 'begin', 'picked0'].every(hasBtn) && !hasBtn('picked1'), 'select buttons');
assert.strictEqual(UI.buttons.filter(b => b.relicId).length, 19, 'relic grid');
// 유물 격자 칸은 48px 그림이 원래 크기로 들어간다
assert(UI.buttons.filter(b => b.relicId).every(b => b.w >= 48 && b.h >= 48), 'relic cell fits 48px');
btn('lord_bone_queen');
assert.strictEqual(UI.loadout.lord, 'bone_queen');
UI.onKey('Digit1');
assert.strictEqual(UI.loadout.lord, 'rift', 'key 1');
UI.toast = null;
UI.onKey('Digit3');
assert(UI.loadout.lord === 'rift' && UI.toast.text.includes('스테이지 5에서 해금'), 'key 3: locked gold king says where it unlocks');
btn('lord_bone_queen');
// 유물: 눌러 넣고, 다른 것을 누르면 바꾸고(칸 1개), 다시 누르면 뺀다. 고른 칸을 눌러도 뺀다
btn('relic_greedy_vault');
same(UI.loadout.relics, ['greedy_vault']);
btn('relic_broken_hourglass');
same(UI.loadout.relics, ['broken_hourglass'], 'swap with one slot');
btn('relic_broken_hourglass');
same(UI.loadout.relics, [], 'tap again removes');
btn('relic_broken_hourglass');
btn('picked0');
same(UI.loadout.relics, [], 'picked slot removes');
btn('picked0');
same(UI.loadout.relics, [], 'empty picked slot does nothing');
btn('relic_broken_hourglass');
// 마우스를 올리면(터치는 누른 곳) 설명이 나오는 버튼이다
{
    const b = btnOf('relic_broken_hourglass');
    UI.onMove(b.x + 10, b.y + 10);
    assert(UI.hoverButton && UI.hoverButton.relicId === 'broken_hourglass', 'hover shows relic');
}
btn('begin');
assert(Game.state === 'prep' && Game.lord === 'bone_queen' && Game.relics.join() === 'broken_hourglass', 'started with choice');
near(Game.mods.xp, 0.25, 'mods from choice');
assert.strictEqual(Game.hp, 17, 'bone queen hp');
assert.strictEqual(Game.lordDef(), DEMON_LORDS.bone_queen, 'throne art');
same(JSON.parse(localStorage.data['dungeonGuard.loadout']), { lord: 'bone_queen', relics: ['broken_hourglass'] }, 'saved');
// 판 중: 마왕 탭에 유물 칸, 스킬 칸과 겹치지 않는다
UI.setTab('demon');
UI.update(0);
{
    const r0 = btnOf('barRelic0');
    const roar = btnOf('roar');
    const bag = btnOf('bag0');
    assert(r0 && !hasBtn('barRelic1'), 'one relic slot in the demon tab');
    assert(roar.x + roar.w <= r0.x && r0.x + r0.w <= bag.x, 'relic slot between roar and bag');
    UI.onMove(r0.x + 10, r0.y + 10);
    assert(UI.hoverButton.id === 'barRelic0' && Game.relics[UI.hoverButton.barRelic] === 'broken_hourglass', 'hover relic in bar');
    click(r0.x + 10, r0.y + 10); // 눌러도 아무 일 없다
    assert(Game.state === 'prep' && Game.relics.join() === 'broken_hourglass');
}
// 다시 시작: 선택 화면으로, 직전 선택이 남아 있다
Game.hp = 1;
damageThrone(1);
assert.strictEqual(Game.state, 'defeat');
btn('retry');
assert.strictEqual(Game.state, 'select');
same(UI.loadout, { lord: 'bone_queen', relics: ['broken_hourglass'] }, 'kept on retry');
UI.onKey('Enter');
assert(Game.state === 'prep' && Game.lord === 'bone_queen' && Game.relics.join() === 'broken_hourglass', 'Enter starts');
// 창을 새로 열어도 저장소에서 읽는다
UI.loadout = null;
toSelect();
same(UI.loadout, { lord: 'bone_queen', relics: ['broken_hourglass'] }, 'loaded from storage');

// 저장소를 못 읽거나 못 쓸 때: 기본 선택으로 동작하고 시작할 수 있다
globalThis.localStorage = brokenStorage;
UI.loadout = null;
toSelect();
same(UI.loadout, { lord: 'rift', relics: [] }, 'broken storage: default');
btn('relic_greedy_vault');
btn('begin');
assert(Game.state === 'prep' && Game.relics.join() === 'greedy_vault', 'starts without storage');
Game.hp = 1;
damageThrone(1);
btn('retry');
same(UI.loadout, { lord: 'rift', relics: ['greedy_vault'] }, 'kept in memory without storage');
btn('begin');
// 저장소가 아예 없을 때(file:// 등)
delete globalThis.localStorage;
UI.loadout = null;
toSelect();
btn('begin');
assert(Game.state === 'prep' && Game.lord === 'rift', 'no storage at all');
// 저장된 값이 이상할 때: 고쳐 쓴다
for (const [raw, want] of [
    ['not json', { lord: 'rift', relics: [] }],
    ['null', { lord: 'rift', relics: [] }],
    ['"x"', { lord: 'rift', relics: [] }],
    ['{"lord":"toString","relics":"greedy_vault"}', { lord: 'rift', relics: [] }],
    ['{"lord":"bone_queen","relics":["nope","toString","mad_dice","mad_dice","broken_hourglass"]}', { lord: 'bone_queen', relics: ['mad_dice'] }],
    ['{"lord":"gold_king","relics":["pauper_helm","broken_hourglass"]}', { lord: 'rift', relics: ['broken_hourglass'] }] // 잠긴 마왕과 유물은 기본값으로
]) {
    globalThis.localStorage = memoryStorage();
    localStorage.data['dungeonGuard.loadout'] = raw;
    UI.loadout = null;
    toSelect();
    same(UI.loadout, want, 'clean ' + raw);
}
delete globalThis.localStorage;

// ----- 유물 칸 3개(스토리를 다 깸): 화면과 게임이 동작한다 -----
progress(STAGES.length);
UI.loadout = { lord: 'rift', relics: [] };
toSelect();
assert(['picked0', 'picked1', 'picked2', 'picked3'].every(hasBtn) && !hasBtn('picked4'), 'four picked slots');
{
    const rects = ['picked0', 'picked1', 'picked2', 'picked3', 'begin'].map(btnOf);
    const grid = UI.buttons.filter(b => b.relicId);
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const r of rects) for (const g of grid) assert(!overlap(r, g), 'picked slots clear of the grid');
    assert(rects.every(r => r.x + r.w <= GAME_WIDTH && r.y + r.h <= GAME_HEIGHT), 'on screen');
}
btn('relic_greedy_vault');
btn('relic_mad_drum');
btn('relic_mirror_twin');
btn('relic_broken_hourglass');
UI.toast = null;
btn('relic_mad_dice');
same(UI.loadout.relics, ['greedy_vault', 'mad_drum', 'mirror_twin', 'broken_hourglass'], 'fifth refused');
assert(UI.toast && UI.toast.text.includes('가득'), 'full toast');
btn('relic_mad_drum');
btn('relic_mad_dice');
same(UI.loadout.relics, ['greedy_vault', 'mirror_twin', 'broken_hourglass', 'mad_dice']);
btn('picked0');
same(UI.loadout.relics, ['mirror_twin', 'broken_hourglass', 'mad_dice'], 'picked slot removes');
btn('relic_greedy_vault');
btn('begin');
assert(Game.relics.join() === 'mirror_twin,broken_hourglass,mad_dice,greedy_vault', 'four relics apply');
near(Game.mods.twinSummon, 0.05, 'relic in mods');
near(Game.lightningDamage(), COMBAT_RULES.lightning.damage * 1.25, 'rift');
UI.setTab('demon');
UI.update(0);
{
    const slots = ['barRelic0', 'barRelic1', 'barRelic2', 'barRelic3'].map(btnOf);
    const roar = btnOf('roar');
    const light = btnOf('lightning');
    const bag = btnOf('bag0');
    assert(slots.every(Boolean) && !hasBtn('barRelic4'), 'four relic slots in the bar');
    assert(light.x + light.w <= roar.x && slots.every(s => roar.x + roar.w <= s.x && s.x + s.w <= bag.x && s.y + s.h <= GAME_HEIGHT), 'bar layout fits');
    assert(light.w >= 180, 'skill buttons stay readable');
}
// 칸이 1개인 기록(스테이지 3까지)으로 돌아가면 잠긴 유물(번개 병)은 빠지고 앞의 1개만 쓴다
progress(3);
Game.hp = 1;
damageThrone(1);
btn('retry');
same(UI.loadout.relics, ['broken_hourglass'], 'locked relic dropped, trimmed to one slot');
btn('begin');
assert(Game.relics.join() === 'broken_hourglass');

// 마왕 대사: 공통 대사에 고른 마왕의 대사가 더해진다
progress(STAGES.length);
Game.reset({ lord: 'gold_king', relics: [] });
assert.strictEqual(withRandom(0.9999, () => lordLine('waveStart')), DEMON_LORDS.gold_king.speech.waveStart.slice(-1)[0], 'gold king line');
assert(SPEECH.waveStart.includes(withRandom(0, () => lordLine('waveStart'))), 'common lines stay');
for (const lord of Object.values(DEMON_LORDS)) {
    const n = Object.values(lord.speech).reduce((a, l) => a + l.length, 0);
    assert(n >= 2 && n <= 3, lord.name + ' has 2~3 own lines');
}
console.log('smoke ok: demon lords and relics');
}`, ctx, { filename: 'smoke-lords' });

// 등급 틀과 3마리 합치기: 등급 순서, 자동 셋째 재료, 재료 교체, 3마리 미만 거절, 조합식 우선, 랭크와 장비 승계,
// 영웅 3마리 → 전설, 전설 3마리 → 신화(시험용 신화 항목), 신화 1마리 제한, 소환에 안 나옴, 히든 조건, 팝업 합치기 버튼
vm.runInContext(`{
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const tick = s => { for (let i = 0; i < s * 30; i++) { UI.update(1 / 30); Game.update(1 / 30); } };
const monXY = m => [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};
// 끌기를 시작해(끄는 몬스터 위에서 조금 움직임) 몬스터들 위를 차례로 지난다. 떼지는 않는다
const dragOver = (src, ...over) => {
    UI.update(0);
    const [x, y] = monXY(src);
    UI.onMove(x, y);
    UI.onDown(x, y);
    UI.onMove(x + 14, y);
    assert(UI.drag && UI.drag.src.monster === src, 'drag started');
    for (const m of over) UI.onMove(...monXY(m));
};
const release = m => UI.onUp(...monXY(m));
const dragTo = (src, dst) => { dragOver(src, dst); release(dst); };
const clear = () => { Game.monsters = []; Game.heroes = []; Game.units = []; Game.equipBag = []; UI.cancel(); UI.toast = null; Fx.pops = []; Fx.discovery = null; };
const put = (type, col, row, rank, equip) => {
    const m = Game.place(type, col, row);
    assert(m, 'place ' + type + ' ' + col + ',' + row);
    if (rank) setMonsterRank(m, rank);
    if (equip) setMonsterEquip(m, equip);
    return m;
};
Game.reset();
Game.gold = 5000;

// 셋째 재료 자동 선택: 랭크 낮은 순 → 장비 없는 쪽 → 끄는 몬스터와 가까운 순
clear();
const src = put('orc_guard', 3, 6);
const dst = put('zombie', 9, 6);
const near = put('gnoll_hunter', 3, 4);
const far = put('fire_imp', 9, 2);
assert.strictEqual(Game.mergeCandidates(src, [dst])[0], near, 'closest first');
setMonsterEquip(near, 'sword');
assert.strictEqual(Game.mergeCandidates(src, [dst])[0], far, 'no equipment first');
setMonsterRank(far, 2);
assert.strictEqual(Game.mergeCandidates(src, [dst])[0], near, 'low rank first');
setMonsterEquip(near, null);
setMonsterRank(far, 0);
assert.strictEqual(Game.mergePlanFor(src, dst).extra[0], near, 'plan picks the third');

// 끌기 시작하면 셋째 재료를 정해 강조하고, 놓을 몬스터 위에서는 재료 3마리와 결과를 미리 보여 준다
dragOver(src);
assert.strictEqual(UI.drag.extra.length, 1);
assert.strictEqual(UI.drag.extra[0], near, 'third chosen at drag start');
UI.onMove(...monXY(dst));
let act = UI.dropAction(UI.dropTarget);
assert(act.action === 'merge' && act.plan.kind === 'grade' && act.plan.grade === 'rare', 'grade merge preview');
assert.strictEqual(act.materials.map(m => m.type).join(), 'orc_guard,zombie,gnoll_hunter', 'three materials shown');
// 재료 교체: 셋째 재료(near) 위로 올리면 near가 놓을 대상이 되고 셋째는 다른 몬스터로 바뀐다
UI.onMove(...monXY(near));
assert(UI.drag.extra[0] !== near, 'hovered third is replaced');
// 다른 몬스터(far) 위에 올렸다가 dst에 놓으면 먼저 올린 far가 셋째 재료가 된다
UI.onMove(...monXY(far));
UI.onMove(...monXY(dst));
assert.strictEqual(UI.drag.extra[0], far, 'hovered monster becomes the material');
act = UI.dropAction(UI.dropTarget);
assert.strictEqual(act.materials.map(m => m.type).join(), 'orc_guard,zombie,fire_imp');
withRandom(0, () => release(dst));
let res = Game.monsterAt(9, 6);
assert(res && res.type === mergePool('rare')[0], 'result on the dropped cell');
assert(src.removed && far.removed && !near.removed && Game.monsterAt(3, 6) === null && Game.monsterAt(9, 2) === null, 'three used, near kept');
assert(Fx.pops.some(p => p.kind === 'merge' && p.from.length === 3 && p.fromTypes.join() === 'orc_guard,zombie,fire_imp'), 'three monsters sucked in');
tick(0.5);

// 같은 등급이 3마리 미만이면 안내만 하고 합치지 않는다
clear();
const c1 = put('orc_guard', 3, 6);
const c2 = put('zombie', 9, 6);
put('orc_berserker', 3, 4); // 다른 등급은 세지 않는다
dragOver(c1);
assert.strictEqual(UI.drag.extra.length, 0, 'no third');
UI.onMove(...monXY(c2));
act = UI.dropAction(UI.dropTarget);
assert(act.action === 'invalid' && act.reason === 'count' && act.real.have === 2 && act.real.count === 3, 'count preview');
release(c2);
assert(Game.monsterAt(3, 6) === c1 && Game.monsterAt(9, 6) === c2, 'two refused');
assert(UI.toast && UI.toast.text.includes('3마리') && UI.toast.text.includes('2마리'), 'count toast');

// 조합식이 맞으면 조합식이 먼저(재료 2마리, 셋째 후보는 그대로)
clear();
const archer = put('skeleton_archer', 3, 6);
const mage = put('dark_mage', 9, 6);
const spare = put('zombie', 3, 4);
dragTo(archer, mage);
assert.strictEqual(Game.monsterAt(9, 6).type, 'curse_shooter', 'recipe first');
assert(!spare.removed && Game.monsterAt(3, 4) === spare, 'third not used by a recipe');
tick(0.5);

// 랭크는 재료 중 가장 낮은 값, 장비는 가장 좋은 것 하나(나머지는 보관함으로)
clear();
const r1 = put('orc_guard', 3, 6, 3, 'sword');
const r2 = put('zombie', 9, 6, 2, 'axe');
const r3 = put('fire_imp', 3, 4, 1, 'gauntlet');
dragOver(r1, r2);
act = UI.dropAction(UI.dropTarget);
assert.strictEqual(Game.mergeEquipAll(act.materials).keep, 'gauntlet', 'preview keeps the best equipment');
release(r2);
res = Game.monsterAt(9, 6);
assert(res && res.rank === 1 && res.equip === 'gauntlet', 'lowest rank, best equipment: ' + (res && res.rank + ' ' + res.equip));
assert.strictEqual(Game.equipBag.slice().sort().join(), 'axe,sword', 'others returned');
assert(r3.removed);
tick(0.5);

// 영웅 3마리 → 전설 3종 중 무작위(소환에 나오지 않는 전설도 합치기 결과가 된다. 겹쳐도 된다)
clear();
const e1 = put('minotaur', 3, 6);
const e2 = put('ancient_treant', 9, 6);
put('flame_demon', 3, 4);
withRandom(0.15, () => dragTo(e1, e2));
res = Game.monsterAt(9, 6);
assert(res && res.type === 'hell_general' && MONSTERS[res.type].grade === 'legendary', 'three epics make a legendary');
assert(Fx.pops.some(p => p.kind === 'merge' && p.grade === 'legendary'));
tick(0.5);
// 전설은 맵 제한이 없다
put('vampire', 3, 6); put('bone_knight', 3, 4); put('minotaur', 9, 2);
withRandom(0.15, () => dragTo(Game.monsterAt(3, 6), Game.monsterAt(3, 4)));
assert.strictEqual(Game.monsters.filter(m => m.type === 'hell_general').length, 2, 'two legendaries allowed');
tick(0.5);
// 신화 몬스터가 표에 없으면 전설은 최고 등급
clear();
const l1 = put('death_lord', 3, 6);
const l2 = put('archlich', 9, 6);
put('hell_general', 3, 4);
assert.strictEqual(Game.mergePlanFor(l1, l2).reason, 'top', 'no mythic yet');
dragTo(l1, l2);
assert(UI.toast && UI.toast.text.includes('최고 등급'), 'top toast');

// ----- 시험용 신화 항목: 표에 넣으면 바로 동작한다(등급 표의 summon: false라 몬스터에 summon을 적지 않아도 소환에 안 나온다) -----
const myth = Object.assign({}, MONSTERS.death_lord, { id: 'test_mythic', name: '시험 신화', grade: 'mythic' });
delete myth.summon;
MONSTERS.test_mythic = myth;
try {
    assert.strictEqual(nextGrade('legendary'), 'mythic', 'legendary merges into mythic');
    assert.strictEqual(mergePool('mythic').join(), 'test_mythic');
    // 소환과 보스 보상에 나오지 않는다
    assert.strictEqual(gradePool('mythic').length, 0, 'mythic not in the summon pool');
    for (let i = 0; i < 400; i++) assert(MONSTERS[Game.rollSummon()].grade !== 'mythic', 'mythic never summoned');
    for (let i = 0; i < 100; i++) for (const c of Game.rollBossReward().cards) assert(c.kind !== 'monster' || MONSTERS[c.type].grade !== 'mythic', 'mythic never a reward');
    // 전설 3마리 → 신화
    clear();
    const a1 = put('death_lord', 3, 6, 2);
    const a2 = put('archlich', 9, 6, 4);
    put('hell_general', 3, 4, 3);
    dragOver(a1, a2);
    act = UI.dropAction(UI.dropTarget);
    assert(act.action === 'merge' && act.plan.grade === 'mythic', 'mythic preview');
    release(a2);
    const m1 = Game.monsterAt(9, 6);
    assert(m1 && m1.type === 'test_mythic' && m1.rank === 2, 'three legendaries make a mythic');
    assert(Fx.pops.some(p => p.kind === 'merge' && p.grade === 'mythic'), 'mythic pop');
    assert(GRADE_FX.mythic.rays > GRADE_FX.legendary.rays && GRADE_FX.mythic.pop > GRADE_FX.legendary.pop, 'mythic show is bigger');
    tick(0.5);
    // 신화는 맵에 1마리: 또 만들려 하면 막고 안내한다. 재료는 그대로
    const b1 = put('death_lord', 3, 6);
    const b2 = put('archlich', 9, 2);
    const b3 = put('hell_general', 3, 4);
    assert.strictEqual(Game.mergePlanFor(b1, b2).reason, 'unique');
    dragTo(b1, b2);
    assert(!b1.removed && !b2.removed && !b3.removed, 'second mythic refused');
    assert(UI.toast && UI.toast.text.includes('신화') && UI.toast.text.includes('1마리'), 'unique toast: ' + (UI.toast && UI.toast.text));
    // 신화 3마리는 합칠 수 없다(최고 등급)
    assert.strictEqual(mergePlan('test_mythic', 'test_mythic').reason, 'top');
    // 신화가 사라지면 다시 만들 수 있다
    Game.removeMonster(m1);
    assert.strictEqual(Game.mergePlanFor(b1, b2).kind, 'grade');
    // 판매와 제물은 표의 값
    assert.strictEqual(Game.sellValue('test_mythic'), 800);
    assert.deepStrictEqual(sacrificeGain('test_mythic'), { heal: 20, lightning: 60 });

    // 히든 조합식(랭크 조건): 죽음의 군주 A + 대리치 A → 신화. 셋째 전설이 있어도 조합식이 먼저, 화면에는 드러나지 않는다
    MONSTER_RECIPES.push({ a: 'death_lord', aRank: 'A', b: 'archlich', bRank: 'A', result: 'test_mythic', hidden: true });
    clear();
    const h1 = put('death_lord', 3, 6, rankIndex('B'));
    const h2 = put('archlich', 9, 6, rankIndex('A'));
    assert.strictEqual(Game.mergePlanFor(h1, h2).reason, 'count', 'below rank: grade merge needs three');
    setMonsterRank(h1, rankIndex('A'));
    const h3 = put('hell_general', 3, 4);
    const plan = Game.mergePlanFor(h1, h2);
    assert(plan.kind === 'recipe' && plan.result === 'test_mythic' && plan.recipe.hidden, 'hidden recipe first');
    assert.strictEqual(UI.shownPlan(h1, h2).kind, 'grade', 'hidden shown as the grade merge');
    assert(!publicRecipesFor('death_lord').some(r => r.result === 'test_mythic'), 'hidden not listed');
    dragTo(h1, h2);
    const hm = Game.monsterAt(9, 6);
    assert(hm && hm.type === 'test_mythic' && !h3.removed, 'hidden mythic made with two');
    assert(Fx.discovery && Fx.discovery.grade === 'mythic' && Fx.discovery.life > 4.6, 'mythic discovery is the longest');
    tick(6);
} finally {
    delete MONSTERS.test_mythic;
    const i = MONSTER_RECIPES.findIndex(r => r.result === 'test_mythic');
    if (i >= 0) MONSTER_RECIPES.splice(i, 1);
    Meta.data.seen = Meta.data.seen.filter(t => t !== 'test_mythic');
    Meta.data.recipes = Meta.data.recipes.filter(k => k !== 'archlich:A+death_lord:A');
}
assert.strictEqual(nextGrade('legendary'), null, 'test entry removed');

// 팝업 합치기 버튼: 같은 판단(랭크 낮음, 장비 없음, 가까움)으로 3마리를 골라 누른 몬스터 칸에서 합친다. 조합식은 보지 않는다
clear();
const p1 = put('dark_mage', 9, 6);
const p2 = put('skeleton_archer', 9, 2); // 마법사와 조합식이 있지만 버튼은 등급 합치기
const p3 = put('zombie', 3, 4, 0, 'sword'); // 장비가 있어 뒤로
const p4 = put('fire_imp', 3, 6);
click(...monXY(p1));
assert.strictEqual(UI.selectedMonster, p1);
let b = btnOf('quickMerge');
assert(b && !b.disabled && b.label.includes('3마리') && b.label.includes('희귀'), 'merge button: ' + (b && b.label));
const quick = Game.quickMergePlan(p1);
assert.strictEqual([quick.src, ...quick.extra].map(m => m.type).sort().join(), 'fire_imp,skeleton_archer', 'no-equipment monsters first');
withRandom(0, () => btn('quickMerge'));
res = Game.monsterAt(9, 6);
assert(res && res.type === mergePool('rare')[0], 'grade merge on the clicked cell, not the recipe');
assert(p2.removed && p4.removed && !p3.removed && UI.selectedMonster === null, 'two picked, popup closed');
tick(0.5);
// 같은 등급이 모자라면 버튼은 꺼져 있고 누르면 안내만
click(...monXY(p3));
b = btnOf('quickMerge');
assert(b && b.disabled, 'merge button disabled');
UI.toast = null;
click(b.x + 5, b.y + 5);
assert(!p3.removed && UI.toast && UI.toast.text.includes('3마리'), 'count toast from the button');
UI.clearSelection();
clear();
console.log('smoke ok: grades and three-monster merge');
}`, ctx, { filename: 'smoke-grades' });

// 판을 넘어 남는 기록(버전 2): 깬 스테이지에서 계산하는 해금, 저장과 다시 읽기, 버전 1 이전, 망가진 값, 도감 기록, 기록 지우기.
// 블록마다 빈 저장소(memoryStorage)와 초기 기록에서 시작해 위 시험의 기록에 기대지 않는다
vm.runInContext(`{
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const noTime = (k, v) => (k === 'savedAt' ? undefined : v); // 저장 시각은 저장할 때마다 바뀌므로 비교에서 뺀다
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a, noTime), JSON.stringify(b, noTime), msg);
const withRandom = (v, fn) => {
    const old = Math.random;
    const list = Array.isArray(v) ? v.slice() : null;
    Math.random = () => (list ? (list.length ? list.shift() : 0) : v);
    try { return fn(); } finally { Math.random = old; }
};
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const stored = () => JSON.parse(localStorage.data['dungeonGuard.meta']);
// 창을 새로 연 것처럼: 기록과 직전 선택을 저장소(없으면 빈 저장소)에서 다시 읽는다
const freshWindow = storage => {
    globalThis.localStorage = storage || memoryStorage();
    Meta.load();
    UI.loadout = null;
    UI.collection = null;
    UI.dialogue = null;
    UI.unlockCards = null;
    UI.afterRun = null;
    UI.stageId = null;
    Game.state = 'title';
};
const ids = list => list.map(s => s.id);

// ----- 표: 영혼석과 가격은 없다 -----
assert(typeof META_RULES === 'undefined', 'no soul rules');
assert(Object.values(DEMON_LORDS).every(l => !('unlock' in l)) && Object.values(RELICS).every(r => !('unlock' in r)), 'no prices');
assert(typeof Meta.buy === 'undefined' && typeof Meta.buySlot === 'undefined' && typeof Meta.price === 'undefined', 'no buying');
assert.strictEqual(META_VERSION, 3);
assert.strictEqual(Meta.maxSlots(), 4);

// ----- 첫 실행: 균열의 군주만, 유물 0종, 유물 칸 0개, 첫 스테이지만 열림 -----
freshWindow();
same(Meta.data, Meta.fresh(), 'empty storage: fresh record');
same(Meta.fresh(), { version: 3, daily: {}, abyss: { week: '', levels: {} }, raid: { week: '', bestTier: 0, bestScore: 0 }, cleared: [], seen: [], recipes: [], equips: [], runs: 0, wins: 0, bestStage: 0, tutorial: { hq: false, battle: false }, savedAt: 0 }, 'record fields');
same(Meta.lordsOwned(), ['rift'], 'lords at start');
same(Meta.relicsOwned(), [], 'no relics at start');
assert.strictEqual(Meta.relicSlots(), 0, 'no relic slot at start');
same(ids(STAGES.filter(s => Meta.isOpen(s.id))), ['s1'], 'only the first stage is open');
assert(!Meta.hasLord('nope') && !Meta.hasLord('toString') && !Meta.hasRelic('toString') && !Meta.isOpen('nope'), 'unknown ids');

// ----- 해금은 깬 스테이지에서 계산한다(저장하지 않는다) -----
Meta.data.cleared = ['s1'];
assert(Meta.relicSlots() === 1 && Meta.hasRelic('greedy_vault') && Meta.hasRelic('legion_banner') && Meta.hasRelic('glass_heart') && !Meta.hasRelic('usury_ledger'), 'stage 1: slot, pouch, horn, heart');
assert(Meta.isOpen('s2') && !Meta.isOpen('s3'), 'stage 2 opens after stage 1');
Meta.data.cleared = ['s1', 's2', 's3'];
assert(Meta.hasLord('bone_queen') && !Meta.hasLord('gold_king') && Meta.hasRelic('iron_oath'), 'stage 3: bone queen');
Meta.data.cleared = ids(STAGES);
same(Meta.lordsOwned(), Object.keys(DEMON_LORDS), 'all lords after the story');
same(Meta.relicsOwned(), Object.keys(RELICS), 'all relics after the story');
assert.strictEqual(Meta.relicSlots(), 4);
// 깬 목록 순서와 상관없이(이상하게 저장돼도) 계산은 같다
Meta.data.cleared = ['s5'];
assert(Meta.hasLord('gold_king') && Meta.hasRelic('equip_eater') && Meta.isOpen('s6') && !Meta.isOpen('s2'), 'computed per stage');
assert(!('lords' in Meta.data) && !('relics' in Meta.data) && !('slots' in Meta.data) && !('souls' in Meta.data), 'unlocks are not stored');

// ----- 판 결과: 판 수, 승리 수, 깬 스테이지, 최고 스테이지. 처음 깰 때만 해금 -----
freshWindow();
{
    const r0 = Meta.finishRun('s1', false, 2);
    same(r0, { stage: 's1', victory: false, waves: 2, firstClear: false, unlocks: [], bestStage: false }, 'defeat');
    const r1 = Meta.finishRun('s1', true, 3);
    same(r1, { stage: 's1', victory: true, waves: 3, firstClear: true, unlocks: STAGES[0].unlocks, bestStage: true }, 'first clear');
    const r2 = Meta.finishRun('s1', true, 3);
    assert(!r2.firstClear && r2.unlocks.length === 0 && !r2.bestStage, 'replay gives nothing');
    const r3 = Meta.finishRun(null, true, WAVES.length);
    assert(r3.stage === null && !r3.firstClear, 'run without a stage (test tools) counts only');
    same(Meta.data.cleared, ['s1'], 'cleared once');
    assert(Meta.data.runs === 4 && Meta.data.wins === 3 && Meta.data.bestStage === 1, 'run records');
    same(stored(), Meta.data, 'saved after each run');
    assert.strictEqual(stored().version, 3, 'version saved');
    // 다시 열어도 그대로
    const before = JSON.stringify(Meta.data);
    freshWindow(localStorage);
    assert.strictEqual(JSON.stringify(Meta.data), before, 'reloaded record');
}

// ----- 버전 1 저장 이전: 몬스터와 조합식 기록과 판 수만 옮기고, 산 항목과 영혼석은 버린다 -----
{
    const storage = memoryStorage();
    storage.data['dungeonGuard.meta'] = JSON.stringify({ version: 1, souls: 82, lords: ['gold_king', 'bone_queen'], relics: ['broken_hourglass', 'mirror_twin', 'greedy_vault'], slots: 3,
        seen: ['orc_guard', 'bone_knight', 'nope'], recipes: ['orc_berserker+skeleton_archer', 'bad'], runs: 9, wins: 4, bestWave: 10 });
    storage.data['dungeonGuard.loadout'] = JSON.stringify({ lord: 'gold_king', relics: ['mirror_twin', 'greedy_vault'] });
    freshWindow(storage);
    same(Meta.data, Object.assign(Meta.fresh(), { seen: ['orc_guard', 'bone_knight'], recipes: ['orc_berserker+skeleton_archer'], runs: 9, tutorial: { hq: true, battle: true } }), 'v1 migrated');
    same(Meta.lordsOwned(), ['rift'], 'bought lords dropped');
    assert(Meta.relicsOwned().length === 0 && Meta.relicSlots() === 0, 'bought relics and slots dropped');
    // 직전 선택의 산 마왕과 유물도 기본값으로
    UI.openSelect(null);
    same(UI.loadout, { lord: 'rift', relics: [] }, 'v1 loadout cleaned');
    btn('begin');
    assert(Game.state === 'prep' && Game.lord === 'rift' && Game.relics.length === 0, 'plays after migration');
    // 저장할 때는 지금 버전으로
    Meta.save();
    assert(stored().version === 3 && !('souls' in stored()) && !('lords' in stored()), 'saved as v3');
}

// ----- 버전 2 저장 이전(12스테이지 때): 깬 스테이지와 최고 스테이지를 새 표로(옛 번호 N → 새 번호 ceil(N / 2)), 나머지는 그대로 -----
{
    const storage = memoryStorage();
    storage.data['dungeonGuard.meta'] = JSON.stringify({ version: 2, cleared: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'], seen: ['orc_guard'],
        recipes: ['orc_berserker+skeleton_archer'], runs: 11, wins: 7, bestStage: 7 });
    freshWindow(storage);
    same(Meta.data, Object.assign(Meta.fresh(), { cleared: ['s1', 's2', 's3', 's4'], seen: ['orc_guard'], recipes: ['orc_berserker+skeleton_archer'], runs: 11, wins: 7, bestStage: 4, tutorial: { hq: true, battle: true } }), 'v2 migrated');
    assert(Meta.hasLord('bone_queen') && !Meta.hasLord('gold_king') && Meta.relicSlots() === 2 && Meta.isOpen('s5') && !Meta.isOpen('s6'), 'v2 progress kept');
    // 옛 표에만 있던 id(s7~s12)도 버리지 않고 옮긴다: 12번까지 깼으면 6번까지
    for (const [old, want, best] of [[['s12'], ['s6'], 6], [['s9', 's10', 's11', 's12'], ['s5', 's6'], 6], [['s2'], ['s1'], 1], [['s3', 's13', 's0'], ['s2'], 2]]) {
        const st = memoryStorage();
        st.data['dungeonGuard.meta'] = JSON.stringify({ version: 2, cleared: old, runs: 3, wins: 3, bestStage: 0 });
        freshWindow(st);
        same(Meta.data.cleared, want, 'v2 ' + old.join());
        assert.strictEqual(Meta.data.bestStage, best, 'v2 best ' + old.join());
    }
    // 다 깬 옛 기록은 새 표도 다 깬 것으로(엔딩까지)
    const all = memoryStorage();
    all.data['dungeonGuard.meta'] = JSON.stringify({ version: 2, cleared: Array.from({ length: 12 }, (_, i) => 's' + (i + 1)), runs: 12, wins: 12, bestStage: 12 });
    freshWindow(all);
    assert(STAGES.every(st => Meta.isCleared(st.id)) && Meta.data.bestStage === STAGES.length && Meta.relicSlots() === 4, 'v2 complete story stays complete');
    Meta.save();
    assert.strictEqual(stored().version, 3, 'saved as v3');
}

// ----- 망가진 값: 고쳐 쓰고 모르는 id는 버린다 -----
for (const [raw, want] of [
    ['not json', {}],
    ['null', {}],
    ['[1,2]', {}],
    ['"x"', {}],
    ['7', {}],
    [JSON.stringify({ version: 3, cleared: ['s2', 'nope', 's2', 'toString', 5], seen: ['orc_guard', 'toString', 7],
        recipes: ['bad', 'orc_berserker+skeleton_archer', 'orc_berserker+skeleton_archer'], equips: ['sword', 'nope', 'sword', 'toString', 3],
        runs: '3', wins: 5, bestStage: 999, extra: 1 }),
        { cleared: ['s2'], seen: ['orc_guard'], recipes: ['orc_berserker+skeleton_archer'], equips: ['sword'], bestStage: 6 }],
    [JSON.stringify({ version: 3, cleared: 's1', equips: 'sword', runs: 4.7, wins: 2, bestStage: 3.5 }), { runs: 4, wins: 2, bestStage: 3 }],
    [JSON.stringify({ version: 3, cleared: ['s3'], runs: Infinity, wins: 9, bestStage: -1 }), { cleared: ['s3'], bestStage: 3 }],
    [JSON.stringify({ version: 2, cleared: ['s2', 'nope', 's2', 'toString', 5], equips: ['sword'], runs: '3', wins: 5, bestStage: 999 }), { cleared: ['s1'], bestStage: 6 }],
    [JSON.stringify({ version: 2, cleared: 's1', runs: 4.7, wins: 2, bestStage: 3.5 }), { runs: 4, wins: 2, bestStage: 2 }],
    [JSON.stringify({ version: 2, cleared: ['s3'], runs: Infinity, wins: 9, bestStage: -1 }), { cleared: ['s2'], bestStage: 2 }],
    [JSON.stringify({ version: 99, cleared: ['s1'], runs: 2 }), { runs: 2 }],
    [JSON.stringify({ souls: 12.7, slots: 2, runs: 4, wins: 2 }), { runs: 4 }]
]) {
    const storage = memoryStorage();
    storage.data['dungeonGuard.meta'] = raw;
    freshWindow(storage);
    same(Meta.data, Object.assign(Meta.fresh(), { tutorial: { hq: Meta.data.runs > 0, battle: Meta.data.runs > 0 } }, want), 'clean ' + raw);
    UI.openHQ();
    UI.update(0);
    assert(Game.state === 'hq' && UI.buttons.filter(b => b.facility).length === HQ_FACILITIES.length, 'hq with ' + raw);
    UI.openStoryMap();
    assert(Game.state === 'story' && Meta.isOpen('s1'), 'story map with ' + raw);
    UI.openSelect(null);
    btn('begin');
    assert(Game.state === 'prep', 'plays with ' + raw);
}

// ----- 저장소 예외와 저장소가 없을 때(file://): 초기값으로 돌고, 이번 창에서는 기록이 남는다 -----
for (const storage of [brokenStorage, undefined]) {
    if (storage) globalThis.localStorage = storage;
    else delete globalThis.localStorage;
    Meta.load();
    same(Meta.data, Meta.fresh(), 'fresh without storage');
    const r = Meta.finishRun('s1', true, 3);
    assert(r.firstClear && Meta.relicSlots() === 1 && Meta.hasRelic('greedy_vault'), 'clear kept in memory');
    Meta.wipe();
    same(Meta.data, Meta.fresh(), 'wipe works without storage');
}

// ----- 몬스터와 히든 기록: 소환, 합치기, 보스 보상으로 본 몬스터와 찾은 조합식이 한 번씩 남는다 -----
freshWindow();
Game.reset();
Game.gold = 9999;
assert.strictEqual(withRandom([0, 0, 0], () => Game.summon()).type, 'orc_guard');
assert(Meta.hasSeen('orc_guard') && Meta.data.seen.length === 1, 'summon records');
withRandom([0, 0, 0], () => Game.summon());
assert.strictEqual(Meta.data.seen.length, 1, 'seen once');
// 시험 도구의 place는 기록하지 않는다
const freeCell = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => !Game.monsterAt(c, r));
const a = Game.place('orc_berserker', ...freeCell());
const b = Game.place('skeleton_archer', ...freeCell());
assert(!Meta.hasSeen('orc_berserker') && !Meta.hasSeen('skeleton_archer'), 'place is not recorded');
let res = Game.merge({ monster: a }, { monster: b });
assert(res.ok && res.hidden && res.discovered && Meta.hasSeen('bone_knight'), 'hidden merge records');
same(Meta.data.recipes, ['orc_berserker+skeleton_archer']);
// 다시 찾아도 기록은 한 번, 발견 연출도 다시 나오지 않는다(지금 동작 그대로)
Fx.discovery = null;
res = Game.merge({ monster: Game.place('skeleton_archer', ...freeCell()) }, { monster: Game.place('orc_berserker', ...freeCell()) });
assert(res.ok && res.hidden && !res.discovered && Fx.discovery === null, 'second find: no fanfare');
same(Meta.data.recipes, ['orc_berserker+skeleton_archer'], 'recipe recorded once');
// 공개 조합식도 찾은 기록에 남는다(도감에서 전설 결과를 가리는 데 쓴다)
res = Game.merge({ monster: Game.place('skeleton_archer', ...freeCell()) }, { monster: Game.place('dark_mage', ...freeCell()) });
assert(res.ok && !res.hidden && Meta.hasRecipe(MONSTER_RECIPES[0]) && Meta.hasSeen('curse_shooter'), 'public recipe recorded');
// 보스 보상 몬스터
Game.bossReward = { cards: [{ kind: 'monster', type: 'dark_mage' }] };
assert(Game.pickBossReward(0).ok && Meta.hasSeen('dark_mage'), 'boss reward records');
same(stored().seen, ['orc_guard', 'bone_knight', 'curse_shooter', 'dark_mage'], 'seen saved');
// 장비 기록(무기고): 정예 드롭, 보스 보상, 돌아온 장비, 보관함이 가득 차 골드로 바뀐 장비도 얻은 것으로 한 번씩 남는다
assert(Meta.data.equips.length === 0 && !Meta.seeEquip('nope') && !Meta.seeEquip('toString'), 'no equipment yet, unknown ids ignored');
Game.gainEquip('sword');
same(Meta.data.equips, ['sword'], 'bag gain records');
Game.gainEquip('sword');
same(Meta.data.equips, ['sword'], 'recorded once');
Game.bossReward = { cards: [{ kind: 'equip', id: 'crown' }] };
assert(Game.pickBossReward(0).ok && Meta.hasEquip('crown'), 'boss reward equipment records');
withRandom([0, 0.2], () => Game.eliteDrop(100, 100)); // 두 번째 재료(보랏빛 반지)
assert.strictEqual(Meta.data.equips.length, 3, 'elite drop records');
while (!Game.bagFull()) Game.equipBag.push('bow');
Game.gainEquip('cape');
assert(Meta.hasEquip('cape') && !Game.equipBag.includes('cape'), 'converted to gold still counts');
assert(!Meta.hasEquip('bow'), 'only gained equipment');
Game.equipBag = [];
same(stored().equips, Meta.data.equips, 'equipment saved');
// 다시 열어도 남는다
freshWindow(localStorage);
assert(Meta.hasSeen('bone_knight') && Meta.hasRecipe(MONSTER_RECIPES[3]) && Meta.hasEquip('crown') && Meta.data.equips.length === 4, 'records survive reload');

// ----- 도감 화면: 본부 서재, 스토리 지도, 선택 화면에서 연다. 탭 2개(기록은 본부 고블린 비서), 표를 읽어 칸을 만든다 -----
assert(!hasBtn('collection'), 'no collection button on the title');
btn('start');
btn('hq_bookshelf');
assert(UI.collection && UI.collection.tab === 'monster' && Game.state === 'hq', 'opened from the hq bookshelf');
assert(['col_tab_monster', 'col_tab_recipe', 'col_close'].every(hasBtn) && !hasBtn('col_tab_record') && !hasBtn('hq_wartable'), 'collection buttons');
// 55종은 한 쪽 12칸씩 다섯 쪽이다
assert.strictEqual(Object.keys(MONSTERS).length, 55);
assert.strictEqual(UI.collectionPages('monster'), 5, 'five monster pages');
assert.strictEqual(UI.collectionCells().length, 12, 'first page full');
assert(hasBtn('col_prev') && hasBtn('col_next') && btnOf('col_prev').disabled, 'page buttons');
UI.onKey('Space');
UI.onKey('Digit1');
assert(Game.state === 'hq' && UI.collection && !UI.hqView, 'hq keys do nothing while the collection is open');
btn('col_next');
assert(UI.collection.page === 1 && UI.collectionCells().length === 12, 'second page');
for (let i = 0; i < 3; i++) btn('col_next');
assert(UI.collection.page === 4 && UI.collectionCells().length === 7, 'last page holds the rest');
assert.strictEqual(UI.collectionCells()[6].item, 'crystal_giant', 'table order');
btn('col_next');
assert.strictEqual(UI.collection.page, 4, 'stops at the last page');
UI.onKey('ArrowLeft');
assert.strictEqual(UI.collection.page, 3);
UI.collection.page = 0;
// 칸은 모두 화면 안, 쪽 넘김 버튼과 겹치지 않는다
for (const page of [0, 4]) {
    UI.collection.page = page;
    for (const c of UI.collectionCells()) assert(c.x >= 0 && c.x + c.w <= GAME_WIDTH && c.y + c.h <= btnOf('col_prev').y, 'cell inside screen');
}
UI.collection.page = 0;
// 조합식 32개: 6줄 x 2칸 = 12개씩 세 쪽
btn('col_tab_recipe');
assert.strictEqual(MONSTER_RECIPES.length, 32);
assert.strictEqual(UI.collectionPages('recipe'), 3, 'three recipe pages');
assert.strictEqual(UI.collectionCells().length, 12, 'recipe page full');
btn('col_next');
btn('col_next');
assert.strictEqual(UI.collectionCells().length, 8, 'recipe last page');
for (const c of UI.collectionCells()) assert(c.y + c.h <= btnOf('col_prev').y, 'recipe row above the page buttons');
UI.onKey('Digit1');
assert.strictEqual(UI.collection.tab, 'monster', 'key 1');
UI.onKey('Digit3');
assert.strictEqual(UI.collection.tab, 'monster', 'no third tab');
UI.onKey('Escape');
assert(UI.collection === null && Game.state === 'hq' && hasBtn('hq_bookshelf'), 'Esc back to the hq');
// 스토리 지도에서도 연다
UI.openStoryMap();
btn('collection');
assert(UI.collection && Game.state === 'story', 'opened from the story map');
UI.onKey('Escape');
assert(UI.collection === null && hasBtn('stage_go'), 'back to the map');
Game.state = 'title';
// 쪽 넘김: 몬스터가 더 늘면 쪽이 더 생긴다(표에 줄을 더해 본다)
{
    const extra = [];
    for (let i = 0; i < 6; i++) {
        const id = 'test_mon_' + i;
        MONSTERS[id] = Object.assign({}, MONSTERS.orc_guard, { id, name: id });
        extra.push(id);
    }
    UI.openCollection();
    assert.strictEqual(UI.collectionPages('monster'), 6, 'six pages');
    for (let i = 0; i < 5; i++) btn('col_next');
    assert(UI.collection.page === 5 && UI.collectionCells().length === 1, 'sixth page');
    for (const id of extra) delete MONSTERS[id];
    UI.closeCollection();
}

// ----- 기록 지우기(본부 고블린 비서의 장부): 두 번 눌러야 지우고, 지운 뒤 바로 처음 상태 -----
{
    Meta.data.cleared = ids(STAGES).slice(0, 3); // 스테이지 3까지: 뼈의 여왕, 유물 칸 1개
    Meta.data.runs = 6;
    Meta.save();
    UI.openSelect('s4');
    btn('lord_bone_queen');
    btn('relic_smith_hammer'); // 아직 잠김(스테이지 4)
    btn('relic_dead_horn');
    same(UI.loadout, { lord: 'bone_queen', relics: ['dead_horn'] });
    btn('collection');
    assert(UI.collection && Game.state === 'select', 'opened from select');
    assert(!hasBtn('col_wipe'), 'no wipe in the collection');
    UI.onKey('Escape');
    UI.openHQ();
    btn('hq_goblin_desk');
    assert(UI.hqView === 'record' && hasBtn('hq_close'), 'record book');
    btn('col_wipe');
    assert(Meta.hasLord('bone_queen') && UI.wipeArmed > 0, 'first press only arms');
    assert(btnOf('col_wipe').sub.includes('스테이지'), 'wipe warns about story progress');
    // 시간이 지나면 다시 두 번 눌러야 한다
    UI.update(WIPE_ARM_TIME + 0.1);
    btn('col_wipe');
    assert(Meta.hasLord('bone_queen'), 'expired arm does not wipe');
    btn('col_wipe');
    same(Meta.data, Meta.fresh(), 'wiped');
    same(stored(), Meta.fresh(), 'wiped in storage');
    same(UI.loadout, { lord: 'rift', relics: [] }, 'loadout back to defaults');
    assert(UI.hqView === 'record' && UI.toast.text.includes('삭제'), 'stays on the record book');
    assert.strictEqual(UI.stageId, 's1', 'locked stage falls back to the first stage');
    UI.onKey('Escape');
    assert(Game.state === 'hq' && !UI.hqView, 'Esc closes the book');
    UI.openSelect(UI.stageId);
    assert(btnOf('lord_bone_queen').locked && !hasBtn('picked0') && hasBtn('slotLocked0'), 'select screen back to the first state');
}

delete globalThis.localStorage;
Meta.data = Meta.fresh();
console.log('smoke ok: meta record');
}`, ctx, { filename: 'smoke-meta' });

// 메인 스토리: 표, 흐름(본부 → 지도 → 대화 → 고르기 → 전투 → 승리 대화 → 해금 카드 → 결과 → 본부), 열림 순서, 다시 깨기, 패배,
// 웨이브 목록과 보스 덮어쓰기, 체력 배율, 대화 넘기기와 건너뛰기, 고르기 건너뛰기, 유물 칸 0개, 6번까지 끝까지 깨기
vm.runInContext(`{
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, (msg || '') + ': ' + a + ' != ' + b);
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const freshWindow = () => {
    globalThis.localStorage = memoryStorage();
    Meta.load();
    UI.loadout = null;
    UI.collection = null;
    UI.dialogue = null;
    UI.unlockCards = null;
    UI.afterRun = null;
    UI.stageId = null;
    UI.toast = null;
    Game.state = 'title';
};
const ids = list => list.map(s => s.id);
// 이번 판을 이긴다: 마지막 웨이브를 막은 것처럼(실제 endWave 경로)
const winRun = () => {
    Game.waveIndex = Game.waves.length - 1;
    Game.state = 'wave';
    Game.heroes = [];
    Game.bossDefeated = false;
    Game.update(1 / 30);
    assert.strictEqual(Game.state, 'victory', 'won');
    UI.update(0);
};
const loseRun = () => { Game.hp = 1; damageThrone(1); assert.strictEqual(Game.state, 'defeat'); UI.update(0); };
// 대화를 끝까지 넘긴다(클릭으로). 넘긴 클릭 수를 돌려준다
const clickThrough = () => {
    let n = 0;
    while (UI.dialogue && n < 100) { click(GAME_WIDTH / 2, 500); n++; }
    return n;
};

// ----- 표: 6스테이지, 장 구분 없음 -----
assert(typeof STORY_CHAPTERS === 'undefined' && STAGES.every(s => !('chapter' in s)), 'no chapters');
assert(STORY_TITLE.name && STORY_TITLE.sub, 'one story title');
same(STAGES.map(s => s.no), [1, 2, 3, 4, 5, 6], 'six stages');
same(STAGES.map(s => s.name), ['첫 손님', '도굴꾼 소동', '건너편 세입자', '왕국 정찰대', '수금하러 왔다', '부대장의 최후'], 'stage names');
assert.strictEqual(new Set(ids(STAGES)).size, 6, 'unique ids');
// 장 N은 1라운드부터 N*10라운드까지 한 판이다
same(STAGES.map(s => s.waves.length), [10, 20, 30, 40, 50, 60], 'rounds per chapter');
assert(STAGES.every(s => s.waves.every((w, i) => w === i)), 'rounds start at 1');
// 보스는 10라운드마다, 번갈아
const bosses = s => stageWaves(s).map(w => w.boss || null);
const before = JSON.stringify(WAVES);
assert(STAGES.every(s => bosses(s).every((b, i) => (b !== null) === ((i + 1) % 10 === 0))), 'boss every 10 rounds');
assert.strictEqual(JSON.stringify(WAVES), before, 'WAVES untouched');
// 나머지 값은 WAVES 그대로(파티, 인원, 정예, 입구). 같은 웨이브를 두 번 써도 따로 복사한다
for (const s of STAGES) {
    stageWaves(s).forEach((w, i) => {
        const src = WAVES[s.waves[i]];
        assert.strictEqual(w.level, s.waves[i]);
        for (const k of ['party', 'members', 'elites', 'entry']) same(w[k], src[k], s.id + ' wave ' + i + ' ' + k);
    });
}
{
    const w6 = stageWaves(STAGES[5]);
}
// 체력 배율: 표대로 0.5에서 0.8까지 오른다. 시작 골드 보너스는 줄지 않는다
same(STAGES.map(s => s.hpMul), [0.5, 0.6, 0.7, 0.8, 0.9, 1], 'hp multipliers');
for (let i = 1; i < STAGES.length; i++) assert(STAGES[i].goldBonus >= STAGES[i - 1].goldBonus && STAGES[i].goldBonus >= 0, 'gold bonus');
// 해금 표: 스테이지마다 표대로, 마왕 2명과 유물 19종이 한 번씩, 칸 3개(1·4·6번), 엔딩은 6번
const un = s => s.unlocks.map(u => u.kind === 'slot' || u.kind === 'ending' ? u.kind : u.kind + ':' + u.id);
same(STAGES.map(un), [
    ['slot', 'relic:greedy_vault', 'relic:legion_banner', 'relic:glass_heart'],
    ['relic:usury_ledger', 'relic:mad_dice', 'relic:dead_horn', 'relic:sniper_mark'],
    ['lord:bone_queen', 'relic:iron_oath', 'relic:blood_altar', 'relic:broken_hourglass'],
    ['slot', 'relic:storm_bottle', 'relic:mad_drum', 'relic:smith_hammer'],
    ['slot', 'lord:gold_king', 'relic:equip_eater', 'relic:mirror_twin', 'relic:lone_crown'],
    ['slot', 'relic:pauper_helm', 'relic:blood_contract', 'relic:shaky_bridge', 'ending']], 'unlock table');
{
    const all = STAGES.flatMap(s => s.unlocks);
    const relics = all.filter(u => u.kind === 'relic').map(u => u.id);
    const lords = all.filter(u => u.kind === 'lord').map(u => u.id);
    same(relics.slice().sort(), Object.keys(RELICS).sort(), 'every relic exactly once');
    assert.strictEqual(new Set(relics).size, 19);
    same(lords, ['bone_queen', 'gold_king'], 'two lords');
    assert(!lords.includes(DEFAULT_LORD), 'default lord is free');
    assert.strictEqual(all.filter(u => u.kind === 'slot').length, 4, 'four slots');
    same([1, 2, 3, 4].map(n => unlockStage('slot', n).no), [1, 4, 5, 6], 'slot stages');
    assert(unlockStage('relic', 'pauper_helm').no === 6 && unlockStage('lord', 'gold_king').no === 5 && unlockStage('lord', 'bone_queen').no === 3 && unlockStage('lord', 'rift') === null, 'unlock stage lookup');
}
// 대화: 스테이지마다 시작 전과 승리 2~4줄, 말하는 사람은 등장인물 표에 있고 초상이 있다
for (const s of STAGES) {
    for (const lines of [s.intro, s.outro]) {
        assert(lines.length >= 2 && lines.length <= 4, s.id + ' 2~4 lines');
        for (const [who, text] of lines) {
            assert(STORY_CAST[who] && castPortrait(who), s.id + ' cast ' + who);
            assert(typeof text === 'string' && text.length > 0 && text.length <= 60, s.id + ' line length');
        }
    }
    assert(Array.isArray(s.map) && s.map[0] > 60 + STAMP_R && s.map[0] < 1860 - STAMP_R && s.map[1] > 110 + 140 && s.map[1] < 770 - STAMP_R - 40, s.id + ' stamp on the map');
}
// 도장끼리 겹치지 않는다
for (let i = 0; i < STAGES.length; i++) {
    for (let j = i + 1; j < STAGES.length; j++) {
        const [a, b] = [STAGES[i].map, STAGES[j].map];
        assert(Math.hypot(a[0] - b[0], a[1] - b[1]) > STAMP_R * 4, 'stamps apart ' + i + ' ' + j);
    }
}
same(Object.keys(STORY_CAST), ['rift', 'bone_queen', 'gold_king', 'goblin', 'warrior', 'archmage', 'captain'], 'cast');
for (const c of Object.values(STORY_CAST)) {
    const p = c.lord ? DEMON_LORDS[c.lord].portrait : c.portrait;
    assert(p && p.sprite && p.crop.length === 3, c.name + ' portrait crop');
}
// 동료가 되는 마왕은 자기 스테이지 대화에 나오고, 엔딩 대화는 도전의 문으로 이어 준다
assert(STAGES[2].intro.some(l => l[0] === 'bone_queen') && STAGES[4].intro.some(l => l[0] === 'gold_king'), 'lords join in their stage');
assert(STAGES[5].outro.some(l => l[1].includes('도전의 문')), 'ending points to the challenge gate');
// 타이틀의 설명은 1번 스테이지 대화로 옮겼다: 소환, 합치기, 번개
assert(['소환', '합쳐', '번개'].every(w => STAGES[0].intro.some(l => l[1].includes(w))), 'tutorial in stage 1');
// 코드에 스테이지별 분기가 없다(id 문자열은 데이터에만)
{
    const src = ${JSON.stringify(['js/game/game.js', 'js/game/meta.js', 'js/game/hero.js', 'js/ui/ui.js', 'js/ui/hq.js', 'js/main.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'))};
    for (const s of STAGES) assert(!new RegExp("['\\"\`]" + s.id + "['\\"\`]").test(src), 'no branch on stage ' + s.id);
}

// ----- 스토리 없는 판(시험 도구, tools/simulate.js)은 지금 그대로 -----
Game.reset();
assert(Game.stage === null && Game.waves === WAVES && Game.heroHpMul === 1 && Game.gold === COMBAT_RULES.startGold, 'no story: WAVES as is');
near(createHero('warrior', 3, 0, false).hp, HEROES.warrior.hp * (1 + COMBAT_RULES.hpPerWave * 3), 'hero hp unchanged');

// ----- 스테이지 판: 웨이브 목록, 체력 배율, 시작 골드 보너스 -----
freshWindow();
Meta.data.cleared = ids(STAGES); // 모두 열어 둔다(판 값만 본다)
for (const s of STAGES) {
    Game.reset(null, s.id);
    assert(Game.stage === s.id && Game.waves.length === s.waves.length && Game.heroHpMul === s.hpMul, s.id + ' run');
    assert.strictEqual(Game.gold, COMBAT_RULES.startGold + s.goldBonus, s.id + ' start gold');
}
Game.reset(null, 's1');
near(createHero('warrior', 0, 0, false).hp, HEROES.warrior.hp * 0.5, 'stage 1 hero hp x0.5');
near(createHero(null, 0, 0, 'archmage').hp, HEROES[BOSSES.archmage.base].hp * BOSSES.archmage.hpMultiplier * 0.5 * (BOSSES.archmage.waveHpMul || 1), 'boss hp x0.5');
// 웨이브를 시작하면 용사 체력은 원래 웨이브 단계(level)와 스테이지 배율로
Game.reset(null, 's2');
Game.startWave();
{
    const w = Game.waves[0];
    assert.strictEqual(w.level, 0);
    const h = Game.heroes[0];
    near(h.maxHp, HEROES[h.type].hp * 0.6, 's2 round 1');
}
// 마지막 웨이브의 보스는 스테이지 보스. 그 웨이브가 끝나면 보상 없이 승리(3, 5, 6번 모두)
for (const st of STAGES.filter(x => x.boss)) {
    Game.reset(null, st.id);
    Game.waveIndex = st.waves.length - 1;
    Game.startWave();
    const boss = Game.heroes.find(h => h.boss);
    assert(boss && boss.bossKey === st.boss, st.id + ' last wave boss');
    const lv = st.waves[st.waves.length - 1];
    const B = BOSSES[st.boss];
    near(boss.maxHp, HEROES[B.base].hp * B.hpMultiplier * (1 + COMBAT_RULES.hpPerWave * lv) * st.hpMul * (B.waveHpMul || 1), st.id + ' boss hp with stage');
    damageHero(boss, 1e9);
    Game.heroes = [];
    Game.update(1 / 30);
    assert(Game.state === 'victory' && !Game.bossReward, st.id + ' last-wave boss: victory without reward');
}
// 카드 보상: 5라운드마다, 마지막 라운드는 카드 없이 승리
{
    const st = STAGES[0];
    Game.reset(null, st.id);
    for (let i = 0; i < st.waves.length - 1; i++) {
        Game.waveIndex = i;
        Game.state = 'prep';
        Game.bossReward = null;
        Game.startWave();
        Game.heroes = [];
        Game.bossDefeated = false;
        Game.update(1 / 30);
        assert(Game.state === 'prep', 'round ' + (i + 1) + ' cleared');
        assert.strictEqual(!!Game.bossReward, (i + 1) % BOSS_REWARD_RULES.roundEvery === 0, 'round ' + (i + 1) + ' card');
    }
}
// 마지막 웨이브가 아닌 보스(스토리 없는 판의 5번째 웨이브): 지금 규칙대로 보상 3택
Game.reset();
Game.waveIndex = 9;
Game.startWave();
{
    const boss = Game.heroes.find(h => h.boss);
    assert(boss && boss.bossKey === 'archmage', 'mid boss without a story');
    damageHero(boss, 1e9);
    Game.heroes = [];
    Game.update(1 / 30);
    assert(Game.state === 'prep' && Game.bossReward && Game.bossReward.cards.length === 3, 'mid boss reward');
}
Meta.data = Meta.fresh();

// ----- 첫 실행 흐름: 타이틀 → 본부 → 작전 테이블(지도) → 대화 → (고르기 건너뜀) → 전투 → 승리 대화 → 해금 카드 → 결과 → 본부 -----
freshWindow();
UI.update(0);
assert.strictEqual(btnOf('start').label, '시작하기', 'title says start on a fresh record');
btn('start');
assert.strictEqual(Game.state, 'hq');
btn('hq_wartable');
assert.strictEqual(Game.state, 'story');
assert.strictEqual(UI.storyPick, 's1', 'first stage picked');
UI.update(0);
assert.strictEqual(UI.buttons.filter(b => b.stamp).length, 6, 'six stamps');
assert(!btnOf('stage_go').disabled && btnOf('stage_go').label === '출전', 'go');
// 잠긴 도장은 고르지 못하고 조건을 알린다
btn('stage_s3');
assert(UI.storyPick === 's1' && UI.toast.text.includes('스테이지 2'), 'locked stamp');
UI.onKey('ArrowRight');
assert.strictEqual(UI.storyPick, 's1', 'arrow stays on open stages');
// 출전: 시작 전 대화. 맵은 비우고 위에 대화
Game.monsters.push(createMonster('orc_guard', 3, 4)); // 이전 판의 흔적
btn('stage_go');
assert(UI.dialogue && UI.dialogue.index === 0 && UI.dialogue.chars === 0, 'intro dialogue starts');
assert.strictEqual(Game.monsters.length, 0, 'field cleared before the intro');
assert.strictEqual(UI.dialogue.lines, STAGES[0].intro);
UI.update(0);
same(UI.buttons.map(b => b.id), ['dlg_skip'], 'only the skip button during dialogue');
// 글자는 한 글자씩: 시간이 지나면 늘고, 클릭하면 끝까지, 다시 클릭하면 다음 줄
UI.update(0.1);
assert(UI.dialogue.chars > 0 && UI.dialogue.chars < STAGES[0].intro[0][1].length, 'typing');
click(900, 400);
assert(UI.dialogue.index === 0 && UI.dialogue.chars === STAGES[0].intro[0][1].length, 'click finishes the line');
click(900, 400);
assert(UI.dialogue.index === 1 && UI.dialogue.chars === 0, 'click goes to the next line');
UI.onKey('Space');
UI.onKey('Space');
assert.strictEqual(UI.dialogue.index, 2, 'Space works the same');
UI.update(10);
assert.strictEqual(UI.dialogue.chars, STAGES[0].intro[2][1].length, 'typing stops at the end');
// 대화 중에는 판의 단축키를 받지 않는다
UI.onKey('KeyS');
assert(UI.dialogue && Game.state === 'story', 'no game keys during dialogue');
// Esc 건너뛰기 → 쓸 수 있는 마왕이 하나이고 유물이 없어 고르기를 건너뛰고 바로 판
UI.onKey('Escape');
assert(!UI.dialogue && Game.state === 'prep' && Game.stage === 's1', 'skip → straight to the run');
assert(Game.lord === 'rift' && Game.relics.length === 0 && Meta.relicSlots() === 0, 'zero slots');
// 칸 0개로도 판이 돈다: 마왕 탭에 유물 칸이 없고 스킬 칸이 넓다
UI.setTab('demon');
UI.update(0);
assert(!UI.buttons.some(b => b.barRelic !== undefined) && hasBtn('lightning') && hasBtn('roar'), 'no relic slot in the bar');
assert(btnOf('roar').x + btnOf('roar').w <= btnOf('bag0').x, 'skills fit');
UI.setTab('monster');
assert(Game.summon().ok, 'summon works');
UI.update(0);
assert.strictEqual(Game.waves.length, 10, 'chapter 1 has ten rounds');
// 진다 → 다시 도전(대화 없이, 고르기도 건너뛰고) 또는 지도
loseRun();
assert(hasBtn('retry') && hasBtn('to_hq') && !hasBtn('next_stage'), 'defeat buttons');
assert(!Meta.isCleared('s1') && Meta.data.runs === 1 && Meta.data.wins === 0 && !UI.dialogue, 'defeat keeps nothing');
btn('retry');
assert(Game.state === 'prep' && Game.stage === 's1' && !UI.dialogue && Game.monsters.length === 0, 'retry skips the dialogue');
// 이긴다 → 승리 대화 → 해금 카드(유물 칸, 황금 주머니) → 결과(다음 스테이지)
winRun();
assert(UI.dialogue && UI.dialogue.lines === STAGES[0].outro, 'victory dialogue');
assert(Meta.isCleared('s1') && Meta.relicSlots() === 1 && Meta.hasRelic('greedy_vault'), 'unlocked on first clear');
assert(!hasBtn('next_stage'), 'result buttons wait for the dialogue');
clickThrough();
assert(UI.unlockCards && UI.unlockCards.index === 0, 'unlock cards');
same(UI.unlockCards.list, STAGES[0].unlocks);
assert.strictEqual(btnOf('unlock_ok').label, '다음');
UI.onKey('Space');
assert(UI.unlockCards.index === 1 && btnOf('unlock_ok').label === '다음', 'second card');
UI.onKey('Space');
UI.onKey('Space');
assert(UI.unlockCards.index === 3 && btnOf('unlock_ok').label === '확인', 'last card');
btn('unlock_ok');
assert(!UI.unlockCards && hasBtn('next_stage') && hasBtn('to_hq'), 'result after the cards');
assert(btnOf('next_stage').sub.includes('도굴꾼 소동'), 'next stage button names it');
// 본부로: 판을 비우고, 작전 테이블에 다음 스테이지 느낌표. 지도에서 깬 스테이지는 붉은 밀랍, 다음이 열린다
btn('to_hq');
assert(Game.state === 'hq' && !UI.hqView, 'back to the hq after the run');
assert.strictEqual(Game.monsters.length, 0, 'field cleared in the hq');
assert(UI.hqHasNews(HQ_FACILITIES.find(f => f.id === 'wartable')), 'next stage badge');
btn('hq_wartable');
assert(!UI.hqHasNews(HQ_FACILITIES.find(f => f.id === 'wartable')), 'badge gone after entering');
assert(Game.state === 'story' && UI.storyPick === 's2' && Meta.isOpen('s2') && !Meta.isOpen('s3'), 'map after the first clear');
// 다시 깨기: 대화는 다시 나오고 건너뛸 수 있다. 해금 카드는 없다
btn('stage_s1');
assert.strictEqual(btnOf('stage_go').label, '다시 하기', 'replay label');
btn('stage_go');
assert(UI.dialogue, 'replay dialogue');
btn('dlg_skip');
// 이제 유물 칸 1개와 황금 주머니가 있어 고르기 화면이 나온다
assert(Game.state === 'select' && UI.stageId === 's1', 'select screen with a relic to pick');
assert(hasBtn('picked0') && hasBtn('slotLocked1') && hasBtn('slotLocked2') && hasBtn('select_back'), 'one slot, two locked slots');
assert(['relic_greedy_vault', 'relic_legion_banner', 'relic_glass_heart'].every(id => btnOf(id).locked === false) && btnOf('relic_usury_ledger').locked, 'stage 1 relics');
UI.toast = null;
btn('relic_usury_ledger');
assert(UI.toast.text.includes('스테이지 2에서 해금') && UI.loadout.relics.length === 0, 'locked relic says its stage');
btn('lord_gold_king');
assert(UI.toast.text.includes('스테이지 5에서 해금') && UI.loadout.lord === 'rift', 'locked lord says its stage');
btn('relic_greedy_vault');
assert(btnOf('begin').sub.includes('첫 손님'), 'begin names the stage');
btn('begin');
assert(Game.state === 'prep' && Game.relics.join() === 'greedy_vault' && Game.gold === COMBAT_RULES.startGold, 'pouch applies');
const runs = Meta.data.runs;
winRun();
clickThrough();
assert(!UI.unlockCards && Meta.data.cleared.length === 1 && Meta.data.runs === runs + 1, 'replay: no unlock cards');
assert(Game.runResult.firstClear === false && Game.runResult.unlocks.length === 0, 'replay result');
// 결과 화면에서 Space는 다음 스테이지(시작 전 대화)
UI.onKey('Space');
assert(UI.dialogue && UI.stageId === 's2' && UI.dialogue.lines === STAGES[1].intro, 'next stage from the result');
// 고르기 화면 Esc는 지도로
UI.onKey('Escape');
assert(Game.state === 'select' && UI.stageId === 's2');
UI.onKey('Escape');
assert(Game.state === 'story', 'Esc back to the map');
UI.onKey('Escape');
assert(Game.state === 'hq', 'Esc from the map to the hq');
btn('hq_wartable');
btn('map_close');
assert(Game.state === 'hq', 'map close button to the hq');
UI.onKey('Escape');
assert(Game.state === 'title', 'Esc from the hq to the title');
UI.update(0);
assert.strictEqual(btnOf('start').label, '이어하기', 'title says continue');

// ----- 6번까지 끝까지 깬다: 표대로 마왕 2명, 유물 16종, 칸 3개가 모두 풀리고 엔딩. 판이 끝날 때마다 본부로 돌아온다 -----
freshWindow();
{
    const seenCards = [];
    const decor = () => HQ_ROOM.decor.filter(d => !d.unlockStage || Meta.isCleared(STAGES.find(x => x.no === d.unlockStage).id)).length;
    btn('start');
    assert.strictEqual(decor(), HQ_ROOM.decor.filter(d => !d.unlockStage).length, 'base decor');
    for (const s of STAGES) {
        assert(Game.state === 'hq', 'in the hq before ' + s.id);
        btn('hq_wartable');
        assert.strictEqual(UI.storyPick, s.id, 'map picks the next stage ' + s.id);
        assert(Meta.isOpen(s.id) && !Meta.isCleared(s.id), s.id + ' open');
        if (s.no < STAGES.length) assert(!Meta.isOpen(STAGES[s.no].id), 'stage after ' + s.id + ' still locked');
        btn('stage_go');
        assert(UI.dialogue && UI.dialogue.lines === s.intro);
        clickThrough();
        if (Game.state === 'select') {
            // 고를 수 있는 것은 모두 골라 시작한다(칸 수만큼)
            UI.loadout.relics = [];
            const owned = Meta.relicsOwned();
            for (const id of owned.slice(0, Meta.relicSlots())) btn('relic_' + id);
            const lords = Meta.lordsOwned();
            btn('lord_' + lords[lords.length - 1]);
            btn('begin');
        }
        assert(Game.state === 'prep' && Game.stage === s.id && Game.waves.length === s.waves.length, s.id + ' started');
        assert(Game.relics.length <= Meta.relicSlots() && Game.relics.every(id => Meta.hasRelic(id)), s.id + ' relics fit');
        // 판 위 표지판에 스테이지 이름을 쓴다(Game.stage에서)
        assert(stageDef(Game.stage).name === s.name);
        winRun();
        clickThrough();
        assert(UI.unlockCards, s.id + ' unlock cards');
        while (UI.unlockCards) { seenCards.push(UI.unlockCards.list[UI.unlockCards.index]); btn('unlock_ok'); }
        assert(Meta.isCleared(s.id), s.id + ' cleared');
        if (s.no < STAGES.length) {
            assert(hasBtn('next_stage') && hasBtn('to_hq'));
        } else {
            assert(!hasBtn('next_stage') && hasBtn('to_hq') && btnOf('to_hq').theme === 'gold', 'last stage: hq is the main button');
        }
        btn('to_hq');
        assert(Game.state === 'hq' && Game.monsters.length === 0, 'back to the hq after ' + s.id);
        // 해금이 늘면 장식이 늘어난다(2, 4, 6번)
        assert.strictEqual(decor(), HQ_ROOM.decor.filter(d => !d.unlockStage || d.unlockStage <= s.no).length, 'decor after ' + s.id);
    }
    same(HQ_ROOM.decor.filter(d => d.unlockStage).map(d => d.unlockStage), [2, 4, 6], 'decor at stages 2, 4, 6');
    same(Meta.lordsOwned(), ['rift', 'bone_queen', 'gold_king'], 'three lords');
    same(Meta.relicsOwned(), Object.keys(RELICS), 'nineteen relics');
    assert.strictEqual(Meta.relicSlots(), 4, 'four slots');
    same(seenCards, STAGES.flatMap(s => s.unlocks), 'every unlock card shown once in order');
    assert(seenCards[seenCards.length - 1].kind === 'ending', 'ending card last');
    assert(Meta.data.cleared.length === 6 && Meta.data.bestStage === 6 && Meta.data.wins === 6 && Meta.data.runs === 6, 'records');
    assert(hqGoblinLine().includes('도전의 문'), 'goblin points to the challenge gate after the story');
    btn('hq_wartable');
    assert(Game.state === 'story' && UI.storyPick === 's6' && STAGES.every(s => Meta.isCleared(s.id)), 'all cleared');
    // 다 깬 뒤 고르기 화면: 잠긴 것이 없다
    UI.openSelect('s6');
    UI.update(0);
    assert(!UI.buttons.some(b => b.locked) && !UI.buttons.some(b => b.lockedSlot) && ['picked0', 'picked1', 'picked2'].every(hasBtn), 'nothing locked');
}

// ----- 유물 칸 0개인데 마왕이 둘(이상한 저장): 고르기 화면이 동작한다 -----
freshWindow();
Meta.data.cleared = ['s3']; // 뼈의 여왕만(칸 없음)
assert(Meta.relicSlots() === 0 && Meta.lordsOwned().length === 2 && !UI.canSkipSelect(), 'select shown');
UI.openSelect('s4');
assert(!hasBtn('picked0') && ['slotLocked0', 'slotLocked1', 'slotLocked2'].every(hasBtn), 'all slots locked');
UI.toast = null;
btn('relic_iron_oath');
assert(UI.loadout.relics.length === 0 && UI.toast.text.includes('스테이지 1'), 'no slot: says where slots unlock');
btn('lord_bone_queen');
btn('begin');
assert(Game.state === 'prep' && Game.lord === 'bone_queen' && Game.relics.length === 0, 'plays with zero slots');

delete globalThis.localStorage;
Meta.data = Meta.fresh();
UI.stageId = null;
Game.state = 'title';
console.log('smoke ok: story');
}`, ctx, { filename: 'smoke-story' });

// 본부: 타이틀 → 본부, 시설 6개 들어가고 나오기(클릭, 숫자 키), 느낌표 표시와 사라짐, 첫 실행의 도전의 문,
// 콘텐츠 열림 조건(unlockStage), 장식, 고블린 대사, 설정, 전투 뒤 본부 복귀, 저장 이전 뒤 이어하기
vm.runInContext(`{
const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
const hasBtn = id => { UI.update(0); return UI.buttons.some(b => b.id === id); };
const btnOf = id => { UI.update(0); return UI.buttons.find(b => b.id === id); };
const btn = id => { const b = btnOf(id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const memoryStorage = () => {
    const data = {};
    return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const freshWindow = storage => {
    globalThis.localStorage = storage || memoryStorage();
    Meta.load();
    UI.loadout = null;
    UI.collection = null;
    UI.dialogue = null;
    UI.unlockCards = null;
    UI.afterRun = null;
    UI.stageId = null;
    UI.hqView = null;
    UI.hqSettings = false;
    UI.hqSeen = null;
    UI.toast = null;
    Game.state = 'title';
};
const fac = id => HQ_FACILITIES.find(f => f.id === id);
const news = id => UI.hqHasNews(fac(id));

// ----- 표 -----
same(HQ_FACILITIES.map(f => f.id), ['wartable', 'bookshelf', 'relic_case', 'weapon_rack', 'goblin_desk', 'portal'], 'six facilities');
same(HQ_FACILITIES.map(f => f.name), ['작전 테이블', '서재', '보물 진열장', '무기고', '고블린 비서', '도전의 문'], 'facility names');
for (const f of HQ_FACILITIES) {
    assert(!!f.action !== !!f.view, f.id + ' opens one thing');
    assert(!f.action || typeof UI[f.action] === 'function', f.id + ' action');
    assert(f.desc && f.desc.length <= 24, f.id + ' short desc');
    assert(Number.isInteger(f.scale) && f.scale >= 2, f.id + ' integer scale');
}
// 도전의 문은 가장 크고 가운데
{
    const portal = fac('portal');
    assert(HQ_FACILITIES.every(f => f === portal || f.scale < portal.scale), 'portal is the biggest');
    assert.strictEqual(portal.x + 32 * portal.scale, GAME_WIDTH / 2, 'portal in the middle');
}
// 그림: 방과 시설이 쓰는 그림은 모두 불러오기 목록(HQ_SPRITES)에 있고, 16장을 모두 쓴다
{
    const used = [...HQ_ROOM.wall, HQ_ROOM.throne.sprite, ...HQ_ROOM.decor.map(d => d.sprite), ...HQ_FACILITIES.map(f => f.sprite)];
    const loaded = ${JSON.stringify(globalThis.HQ_SPRITE_NAMES)};
    for (const n of used) assert(loaded.includes(n), n + ' loaded');
    same([...new Set(used)].sort(), loaded.filter(n => n !== 'tileset_hq').sort(), 'every hq picture used');
    assert(HQ_ROOM.decor.every(d => Number.isInteger(d.scale)), 'decor integer scale');
    assert(HQ_ROOM.wall.length * 192 >= GAME_WIDTH, 'wall covers the width');
}
assert(Array.isArray(HQ_CONTENTS) && HQ_CONTENTS.map(c => c.id).join() === 'daily,abyss,raid', 'contents in the portal');

// ----- 첫 실행: 타이틀 → 본부. 작전 테이블에 느낌표, 도전의 문은 처음부터 들어간다(준비 중) -----
freshWindow();
UI.update(0);
assert(!hasBtn('collection') && hasBtn('start'), 'title: start only');
assert(['title_account', 'title_full', 'title_settings', 'title_book'].every(hasBtn), 'title: account, full screen, settings, book');
btn('title_settings');
assert(UI.hqSettings && hasBtn('set_close') && !hasBtn('set_title') && !hasBtn('start'), 'title settings: no "to the title"');
UI.onKey('Enter');
assert(Game.state === 'title', 'title keys wait while settings are open');
UI.onKey('Escape');
assert(!UI.hqSettings && hasBtn('start'), 'Esc closes the title settings');
btn('title_book');
assert(UI.collection && Game.state === 'title', 'title: the book opens over the title');
UI.onKey('Escape');
assert(!UI.collection && Game.state === 'title' && hasBtn('start'), 'closing the book goes back to the title');
btn('title_account');
assert(UI.accountView === 'signIn' && ['acc_tab_in', 'acc_tab_up', 'acc_submit', 'acc_google', 'acc_guest'].every(hasBtn) && !hasBtn('start'), 'account: the sign-in panel');
UI.onKey('Escape');
assert(!UI.accountView && hasBtn('start'), 'Esc closes the account panel');
btn('start');
assert(Game.state === 'hq' && !UI.hqView, 'title to the hq');
UI.update(0);
same(UI.buttons.filter(b => b.facility).map(b => b.key), [1, 2, 3, 4, 5, 6], 'number keys on the plates');
assert(news('wartable'), 'first stage badge on the war table');
assert(['bookshelf', 'relic_case', 'weapon_rack', 'goblin_desk'].every(id => !news(id)) && news('portal'), 'only the first stage and the open daily challenge are new');
assert(hqGoblinLine().includes('작전 테이블'), 'goblin tells what to do first');
btn('hq_portal');
assert(UI.hqView === 'portal' && hasBtn('hq_close'), 'portal open on the first run');
UI.update(0);
same(UI.buttons.filter(b => b.content).map(b => b.id), ['content_daily', 'content_abyss', 'content_raid'], 'challenge cards');
UI.onKey('Escape');
assert(Game.state === 'hq' && !UI.hqView, 'Esc closes the portal');

// ----- 시설 6개: 누르면 들어가고 닫기(Esc)로 본부. 숫자 키도 같다 -----
const enterAndLeave = (how, id) => {
    const f = fac(id);
    if (how === 'click') btn('hq_' + id);
    else UI.onKey('Digit' + (HQ_FACILITIES.indexOf(f) + 1));
    if (f.action === 'openStoryMap') {
        assert(Game.state === 'story' && hasBtn('map_close'), id + ': story map');
    } else if (f.action === 'openCollection') {
        assert(Game.state === 'hq' && UI.collection && hasBtn('col_close'), id + ': collection');
    } else {
        assert(Game.state === 'hq' && UI.hqView === f.view && hasBtn('hq_close') && !hasBtn('hq_wartable'), id + ': ' + f.view);
    }
    if (how === 'click') {
        const close = ['map_close', 'col_close', 'hq_close'].find(hasBtn);
        btn(close);
    } else {
        UI.onKey('Escape');
    }
    assert(Game.state === 'hq' && !UI.hqView && !UI.collection && hasBtn('hq_wartable'), id + ': back to the hq (' + how + ')');
};
for (const how of ['click', 'key']) for (const f of HQ_FACILITIES) enterAndLeave(how, f.id);
UI.onKey('Numpad6');
assert.strictEqual(UI.hqView, 'portal', 'numpad keys too');
UI.onKey('Escape');
UI.onKey('Digit7');
UI.onKey('Digit0');
assert(Game.state === 'hq' && !UI.hqView, 'other keys do nothing');
// 터치(마우스 이동 없이 누르기)도 된다
{
    const b = btnOf('hq_relic_case');
    UI.onDown(b.x + b.w / 2, b.y + b.h / 2);
    UI.onUp(b.x + b.w / 2, b.y + b.h / 2);
    assert.strictEqual(UI.hqView, 'relics', 'touch opens');
    UI.closeHqView();
}
// 이름표까지 누르는 자리다
{
    const b = btnOf('hq_bookshelf');
    click(b.x + b.w / 2, b.y + b.h - 4);
    assert(UI.collection, 'plate opens');
    UI.closeCollection();
}
// 마우스를 올리면 그 시설이 hover
{
    const b = btnOf('hq_weapon_rack');
    UI.onMove(b.x + 40, b.y + 40);
    assert(UI.hoverButton && UI.hoverButton.facility === fac('weapon_rack'), 'hover a facility');
    UI.onMove(5, 1070);
}
// 소리 버튼과 설정
{
    const muted = Sfx.muted;
    btn('mute');
    assert.strictEqual(Sfx.muted, !muted, 'mute toggles');
    btn('mute');
    btn('hq_settings');
    assert(UI.hqSettings && ['set_sound', 'set_fx', 'set_title', 'set_close'].every(hasBtn) && !hasBtn('hq_wartable'), 'settings');
    UI.onKey('Digit1');
    assert(UI.hqSettings && Game.state === 'hq', 'keys wait while settings are open');
    UI.onKey('Escape');
    assert(!UI.hqSettings && hasBtn('hq_wartable'), 'Esc closes settings');
    btn('hq_settings');
    btn('set_title');
    assert(Game.state === 'title', 'settings: to the title');
    btn('start');
}

// ----- 느낌표: 새 해금, 다음 스테이지, 본 몬스터, 얻은 장비. 시설에 들어가면 사라진다 -----
freshWindow();
btn('start');
btn('hq_wartable');
assert(!news('wartable'), 'gone after entering');
UI.openHQ();
Meta.finishRun('s1', true, 3);
assert(news('wartable') && news('relic_case'), 'stage 1 clear: next stage and new relics');
Meta.seeMonster('orc_guard');
Meta.seeEquip('sword');
assert(news('bookshelf') && news('weapon_rack') && !news('goblin_desk'), 'new monster and equipment');
for (const id of ['relic_case', 'bookshelf', 'weapon_rack']) {
    btn('hq_' + id);
    UI.onKey('Escape');
    assert(!news(id), id + ' badge gone');
}
Meta.seeEquip('sword');
assert(!news('weapon_rack'), 'same equipment: no badge');
Meta.seeEquip('axe');
assert(news('weapon_rack'), 'another equipment: badge again');
// 본 값은 따로 저장해 창을 다시 열어도 남는다(게임 기록 Meta와는 따로)
{
    const raw = JSON.parse(localStorage.data[HQ_SEEN_KEY]);
    assert(raw.relic_case && raw.wartable, 'seen values stored');
    assert(!('hqSeen' in Meta.data), 'not in the game record');
    freshWindow(localStorage);
    assert(!news('relic_case') && !news('bookshelf') && news('weapon_rack'), 'seen values survive reload');
}
// 망가진 값이나 저장소가 없어도 돈다
for (const raw of ['not json', '[1]', '7', JSON.stringify({ wartable: 5, toString: 'x' })]) {
    const st = memoryStorage();
    st.data[HQ_SEEN_KEY] = raw;
    freshWindow(st);
    btn('start');
    assert(Game.state === 'hq' && news('wartable'), 'broken seen values: ' + raw);
    btn('hq_wartable');
    assert(!news('wartable'), 'enter works with ' + raw);
}
delete globalThis.localStorage;
UI.hqSeen = null;
UI.openHQ();
btn('hq_wartable');
UI.openHQ();
assert(!news('wartable'), 'no storage: kept in memory');

// ----- 도전의 문 콘텐츠: unlockStage가 없으면 처음부터, 있으면 그 스테이지를 깨야 열린다 -----
freshWindow();
const dailyContent = HQ_CONTENTS.splice(0); // 이 시험은 시험용 항목만 둔다
HQ_CONTENTS.push({ id: 'test_open', name: '시험 처음', desc: '처음부터 열림' }, { id: 'test_s2', name: '시험 둘', desc: '2번 뒤', unlockStage: 2 },
    { id: 'test_s6', name: '시험 여섯', desc: '6번 뒤', unlockStage: 6 });
{
    btn('start');
    assert(news('portal'), 'open content: badge on the portal');
    btn('hq_portal');
    assert(!news('portal'), 'badge gone');
    UI.update(0);
    same(UI.buttons.filter(b => b.content).map(b => [b.id, b.locked]), [['content_test_open', false], ['content_test_s2', true], ['content_test_s6', true]], 'first run');
    UI.toast = null;
    btn('content_test_s2');
    assert(UI.toast.text.includes('스테이지 2'), 'locked content says its stage');
    UI.toast = null;
    btn('content_test_open');
    assert(UI.toast.text.includes('준비'), 'open content without a mode: notice');
    let entered = 0;
    HQ_CONTENTS[0].enter = () => { entered++; };
    btn('content_test_open');
    assert.strictEqual(entered, 1, 'enter hook');
    UI.closeHqView();
    Meta.finishRun('s1', true, 3);
    Meta.finishRun('s2', true, 3);
    assert(news('portal'), 'new content opened: badge');
    btn('hq_portal');
    UI.update(0);
    same(UI.buttons.filter(b => b.content).map(b => b.locked), [false, false, true], 'stage 2 cleared');
    Meta.data.cleared = STAGES.map(s => s.id);
    same(HQ_CONTENTS.map(hqContentOpen), [true, true, true], 'story done: all open');
    // 열린 콘텐츠 버튼끼리와 닫기 버튼은 겹치지 않고 화면 안
    UI.update(0);
    const list = UI.buttons;
    for (const a of list) {
        assert(a.x >= 0 && a.y >= 0 && a.x + a.w <= GAME_WIDTH && a.y + a.h <= GAME_HEIGHT, a.id + ' inside');
        for (const b of list) assert(a === b || !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), a.id + ' overlaps ' + b.id);
    }
}
HQ_CONTENTS.length = 0;
HQ_CONTENTS.push(...dailyContent);

// ----- 장식과 고블린 대사: 진행에 따라 -----
freshWindow();
{
    const placed = () => HQ_ROOM.decor.filter(d => !d.unlockStage || Meta.isCleared(STAGES.find(x => x.no === d.unlockStage).id)).length;
    const base = HQ_ROOM.decor.filter(d => !d.unlockStage).length;
    const lines = new Set();
    for (let n = 0; n <= STAGES.length; n++) {
        Meta.data.cleared = STAGES.slice(0, n).map(s => s.id);
        assert.strictEqual(placed(), base + [0, 0, 1, 1, 2, 2, 3][n], 'decor after ' + n);
        const line = hqGoblinLine();
        assert(line.length > 0 && !line.includes('{'), 'goblin line ' + n);
        if (n < STAGES.length) assert(line.includes(String(n + 1)) || n === 0, 'goblin names the next stage ' + n);
        lines.add(line);
    }
    assert.strictEqual(lines.size, STAGES.length + 1, 'a different line for each step');
}

// ----- 전투 뒤 본부 복귀: 결과의 본부로, Esc. 다음 스테이지는 바로 그 스테이지 대화 -----
freshWindow();
{
    btn('start');
    UI.enterStage('s1');
    UI.endDialogue();
    assert(Game.state === 'prep' && Game.stage === 's1', 'run');
    Game.hp = 1;
    damageThrone(1);
    UI.update(0);
    UI.onKey('Escape');
    assert(Game.state === 'hq' && Game.monsters.length === 0, 'Esc on the result: hq');
    UI.enterStage('s1');
    UI.endDialogue();
    Game.waveIndex = Game.waves.length - 1;
    Game.state = 'wave';
    Game.heroes = [];
    Game.update(1 / 30);
    UI.update(0);
    UI.endDialogue();
    while (UI.unlockCards) btn('unlock_ok');
    btn('next_stage');
    assert(UI.dialogue && UI.stageId === 's2' && UI.dialogue.lines === STAGES[1].intro, 'next stage goes straight in');
}

// ----- 저장 이전 뒤 이어하기: 옛 12스테이지 기록으로 열어도 본부와 지도가 돈다 -----
{
    const st = memoryStorage();
    st.data['dungeonGuard.meta'] = JSON.stringify({ version: 2, cleared: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'], runs: 20, wins: 9, bestStage: 9 });
    freshWindow(st);
    UI.update(0);
    assert.strictEqual(btnOf('start').label, '이어하기', 'continue');
    btn('start');
    assert(Game.state === 'hq' && Meta.data.cleared.length === 5 && Meta.hasLord('gold_king'), 'migrated save in the hq');
    btn('hq_wartable');
    assert(UI.storyPick === 's6', 'next stage on the map');
}

delete globalThis.localStorage;
Meta.data = Meta.fresh();
UI.hqSeen = null;
UI.stageId = null;
Game.state = 'title';
console.log('smoke ok: hq');
}`, ctx, { filename: 'smoke-hq' });

// UI 배치: 모든 화면과 탭에서 버튼이 화면 안에 있고 서로 겹치지 않는다. 왼쪽 아래 체력 막대는 체력 값을 따라간다
vm.runInContext(`{
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// allow(a, b)가 참이면 일부러 포갠 버튼이다
const check = (name, allow) => {
    UI.update(0);
    const list = UI.buttons;
    assert(list.length > 0, name + ': buttons');
    for (const b of list) assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= GAME_WIDTH && b.y + b.h <= GAME_HEIGHT, name + ': ' + b.id + ' inside the screen');
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            if (allow && (allow(a, b) || allow(b, a))) continue;
            assert(!overlap(a, b), name + ': ' + a.id + ' overlaps ' + b.id);
        }
    }
    return list;
};
const ids = () => { UI.update(0); return UI.buttons.map(b => b.id); };
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
delete globalThis.localStorage;
Meta.data = Meta.fresh();
UI.loadout = null;
UI.collection = null;
UI.dialogue = null;
UI.unlockCards = null;
UI.afterRun = null;
Game.paused = false;
Game.state = 'title';
check('title');
// 본부: 방(시설 6개, 소리와 설정), 설정 창, 안 화면 4개. 시설 버튼은 서로, 오른쪽 위 버튼과 겹치지 않는다
for (const n of [0, 3, STAGES.length]) {
    Meta.data.cleared = STAGES.slice(0, n).map(s => s.id);
    UI.openHQ();
    same(check('hq, ' + n + ' cleared').map(b => b.id), [...HQ_FACILITIES.map(f => 'hq_' + f.id), 'hq_settings', 'mute'], 'hq buttons');
}
UI.hqSettings = true;
check('hq settings');
UI.hqSettings = false;
for (const view of ['relics', 'armory', 'record', 'portal']) {
    UI.hqView = view;
    check('hq ' + view);
}
const portalContents = HQ_CONTENTS.splice(0); // 칸이 넘치지 않게 시험 항목만 둔다
HQ_CONTENTS.push({ id: 'test_a', name: '시험 A', desc: '처음부터' }, { id: 'test_b', name: '시험 B', desc: '스테이지 4', unlockStage: 4 }, { id: 'test_c', name: '시험 C', desc: '스테이지 6', unlockStage: 6 });
check('hq portal with contents');
HQ_CONTENTS.length = 0;
HQ_CONTENTS.push(...portalContents);
UI.closeHqView();
Meta.data = Meta.fresh();
// 스토리 지도, 시작 전 대화, 해금 카드
UI.openStoryMap();
check('story map');
Meta.data.cleared = STAGES.slice(0, 3).map(s => s.id);
UI.openStoryMap();
check('story map, three cleared');
UI.enterStage('s4');
check('dialogue');
UI.endDialogue();
check('select from a stage');
assert(ids().includes('select_back'), 'back to the map');
UI.unlockCards = { list: STAGES[3].unlocks.slice(), index: 0 };
check('unlock card');
UI.unlockCards = null;
Meta.data = Meta.fresh();
UI.openCollection();
for (const t of COL_TABS) {
    UI.setCollectionTab(t.key);
    check('collection ' + t.key);
}
UI.closeCollection();
UI.openSelect(null);
check('select, zero slots');
UI.pickLord('bone_queen');
UI.toggleRelic('pauper_helm');
assert(!ids().includes('unlock') && !ids().includes('buy_slot'), 'no unlock or slot buying buttons');
Meta.data.cleared = STAGES.map(s => s.id);
check('select, three slots');
UI.openCollection();
check('collection from select');
UI.closeCollection();
Meta.data.cleared = ['s1'];
UI.beginRun();
assert.strictEqual(Game.state, 'prep');
for (const tab of ['monster', 'demon']) {
    UI.setTab(tab);
    check('prep ' + tab);
}
UI.setTab('monster');
// 체력 막대: 시작하면 가득, 깎이면 바로 줄고, 회복하면 천천히 차올라 값에 닿는다
UI.update(0);
assert(UI.hpShown === Game.hp && UI.hpRatio() === 1, 'hp bar full at start');
damageThrone(5);
UI.update(0);
assert(UI.hpShown === Game.hp && Math.abs(UI.hpRatio() - Game.hp / Game.maxHp()) < 1e-9, 'hp bar drops at once');
const before = Game.hp;
Game.hp = Math.min(Game.maxHp(), Game.hp + 3);
UI.update(0.1);
assert(UI.hpShown > before && UI.hpShown < Game.hp, 'hp bar fills up slowly');
UI.update(1);
assert(UI.hpShown === Game.hp, 'hp bar reaches the value');
// 팝업이 열린 상태(장비를 낀 몬스터): 판매와 빼기 버튼이 하단 바, 오른쪽 위 버튼과 겹치지 않는다
const m = Game.summon().monster;
m.equip = 'sword';
UI.selectedMonster = m;
check('popup');
assert(ids().includes('sell') && ids().includes('unequip'), 'popup buttons');
// 정보 창은 다시 배치돼도 여는 연출이 처음으로 돌아가지 않는다(돌아가면 창이 내내 투명하다)
UI.update(0.5);
UI.layout();
assert(UI.popupAge >= 0.5, 'popup keeps opening across layouts');
// 정보 창은 맵 어느 칸에서 열어도 다른 버튼과 겹치지 않는다
{
    const [hx, hy] = [m.x, m.y];
    for (const key of BUILD_CELLS) {
        const [c, r] = key.split(',').map(Number);
        m.x = tileX(c);
        m.y = tileY(r);
        check('popup at ' + key);
    }
    // 창 높이는 몬스터마다 다르다: 오른쪽 칸에서 모든 몬스터로 본다(소환 운에 따라 가끔만 실패하던 경우)
    const ht = m.type;
    const right = [...BUILD_CELLS].filter(k => Number(k.split(',')[0]) >= 20);
    for (const type of Object.keys(MONSTERS)) {
        m.type = type;
        for (const key of right) {
            const [c, r] = key.split(',').map(Number);
            m.x = tileX(c);
            m.y = tileY(r);
            check('popup of ' + type + ' at ' + key);
        }
    }
    m.type = ht;
    m.x = hx;
    m.y = hy;
}
UI.clearSelection();
Game.paused = true;
check('paused');
Game.paused = false;
Game.startWave();
check('wave');
Game.bossReward = Game.rollBossReward();
check('boss reward');
Game.bossReward = null;
Game.finish(true);
check('victory');
Game.state = 'defeat';
check('defeat');
// 스테이지 결과: 승리(다음 스테이지와 본부), 마지막 스테이지 승리(본부만), 패배(다시 도전과 본부)
Meta.data.cleared = ['s1'];
for (const [stage, state, want] of [['s1', 'victory', ['next_stage', 'to_hq']], ['s6', 'victory', ['to_hq']], ['s2', 'defeat', ['retry', 'to_hq']]]) {
    Game.reset(null, stage);
    UI.afterRun = null;
    Game.state = state;
    Game.runResult = Meta.finishRun(stage, state === 'victory', 1);
    same(check('result ' + stage + ' ' + state).map(b => b.id), want, 'result buttons ' + stage);
}
Meta.data = Meta.fresh();
UI.openSelect(null);
console.log('smoke ok: ui layout');
}`, ctx, { filename: 'smoke-ui' });

// 지역: 스테이지 표의 zone, 판을 시작하면 Game.zone이 바뀐다. 스토리 없는 판(시험 도구)은 ember
vm.runInContext(`{
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
same(STAGES.map(s => s.zone), ['moonGarden', 'coast', 'frost', 'skySea', 'sunForge', 'warTemple'], 'stage zones');
assert(STAGES.every(s => ZONES[s.zone]), 'every stage zone exists');
assert.strictEqual(DEFAULT_ZONE, 'ember', 'no-story zone');
for (const s of STAGES) {
    Game.reset(null, s.id);
    assert.strictEqual(Game.zone, s.zone, s.id + ' zone');
    assert.strictEqual(zoneOf(s.id), s.zone);
}
Game.reset();
assert(Game.stage === null && Game.zone === 'ember', 'test run is ember');
assert.strictEqual(zoneOf('nope'), 'ember', 'unknown stage falls back');
assert.strictEqual(Object.keys(WANG_TILES).length, 16, 'sixteen hq wang tiles');
console.log('smoke ok: zones');
}`, ctx, { filename: 'smoke-zones' });

// 맵 그리기: 지역 8곳을 차례로 바꿔 다시 그려도 오류가 없고, 바꾼 지역의 섬·배경·다리 그림을 부른다(가짜 캔버스).
// 판 중에는 Game.zone, 그 밖에는 고른 스테이지(UI.stageId)의 지역을 그린다
{
    const calls = [];
    const fakeCtx = () => new Proxy({}, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
            if (k === 'measureText') return s => ({ width: String(s).length * 10 });
            return (...args) => { if (k === 'drawImage') calls.push(args[0] && args[0].name); };
        },
        set(t, k, v) { t[k] = v; return true; }
    });
    const document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
    const rctx = vm.createContext({ console, Math, Set, Map, Object, Array, Number, String, JSON, document });
    for (const f of ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/asteria_heroes.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/story.js', 'js/data/asteria_bosses.js', 'js/data/challenge.js', 'js/data/map.js', 'js/data/fx_sheets.js', 'js/ui/uikit.js', 'js/game/render.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), rctx, { filename: f });
    }
    vm.runInContext(`
        var loadedNames = [];
        var Assets = { get(name) { loadedNames.push(name); return { name, width: name.startsWith('bridgedeck_') ? 1536 : 1254, height: 1024 }; }, tinted() { return null; } };
        var Game = { state: 'prep', zone: 'ember', time: 1, inPlay() { return this.state === 'prep' || this.state === 'wave'; } };
        var UI = { stageId: null };
    `, rctx);
    for (const id of vm.runInContext('ZONE_IDS', rctx)) {
        calls.length = 0;
        vm.runInContext(`Game.zone = '${id}'; Render.buildMap(Render.zoneNow());`, rctx);
        assert.strictEqual(vm.runInContext('Render.mapZone', rctx), id, id + ' map built');
        for (const kind of ['void', 'island', 'bridgedeck']) assert(calls.includes(`${kind}_${id}`), id + ' draws ' + kind);
        assert(calls.filter(n => n === `bridgedeck_${id}`).length > 20, id + ' deck along the path');
        // 문과 소품 그리기도 오류가 없다
        vm.runInContext(`for (const g of Render.gates()) Render.drawGate(document.createElement('canvas').getContext('2d'), g, ZONES['${id}']);`, rctx);
    }
    // 판 밖(타이틀, 시작 전 대화)은 고른 스테이지의 지역
    vm.runInContext(`Game.state = 'story'; UI.stageId = 's2';`, rctx);
    assert.strictEqual(vm.runInContext('Render.zoneNow()', rctx), 'coast', 'story screen uses the picked stage zone');
    vm.runInContext(`UI.stageId = null;`, rctx);
    assert.strictEqual(vm.runInContext('Render.zoneNow()', rctx), 'ember', 'title uses ember');
    // 꺾이는 곳: 합류점(8,6)은 세 쪽(왼쪽, 아래, 위)이 열린 T자
    const corners = vm.runInContext('Render.deckCorners().map(c => ({ x: c.x, y: c.y, open: [...c.open].sort() }))', rctx);
    const merge = corners.find(c => c.x === 8 * 96 + 48 && c.y === 6 * 96 + 48);
    assert(merge && JSON.stringify(merge.open) === JSON.stringify(['-1,0', '0,-1', '0,1']), 'merge tile is a T junction');
    assert(corners.every(c => c.open.length >= 2), 'every corner joins two ways');
    console.log('smoke ok: zone maps');
}

// ----- 소환 강화, 라운드 타이머, 중간 저장 -----
vm.runInContext(`{
assert.strictEqual(STAGES.length, 6);
for (const L of SUMMON_LEVELS) assert(Math.abs(Object.values(L.odds).reduce((a, b) => a + b, 0) - 1) < 1e-9, 'odds sum to 1');
assert(SUMMON_LEVELS.every(L => !L.odds.mythic), 'mythic is never summoned');
Game.reset();
assert.strictEqual(Game.summonLevel, 0);
Game.gold = 50;
assert.strictEqual(Game.upgradeSummon().reason, 'gold');
Game.gold = 100000;
for (let i = 1; i < SUMMON_LEVELS.length; i++) assert(Game.upgradeSummon().ok, 'level ' + i);
assert.strictEqual(Game.upgradeSummon().reason, 'max');
assert.strictEqual(Game.summonUpgradeCost(), null);
const top = SUMMON_LEVELS[SUMMON_LEVELS.length - 1].odds;
assert.strictEqual(Game.summonOdds().legendary, top.legendary, 'odds follow the level');
const seen = new Set();
for (let i = 0; i < 2000; i++) seen.add(MONSTERS[Game.rollSummon()].grade);
assert(seen.has('legendary') && !seen.has('mythic'), 'legendary can be summoned at a high level');
Game.reset();
assert.strictEqual(Game.summonLevel, 0, 'level resets');

// 라운드: 시간이 지나면 남은 용사와 함께 다음 라운드, 다 잡으면 준비 뒤 다음 라운드, 일찍 부르면 골드
Game.reset();
Game.startWave();
const firstCount = Game.heroes.length;
assert.strictEqual(Game.roundTimer, COMBAT_RULES.roundTime);
assert(Game.heroes.every(h => (h.waiting ? h.delay : 0) <= COMBAT_RULES.spawnWindow + 1), 'round spawns inside the window');
for (const h of Game.heroes) h.speed = 0;
Game.roundTimer = 0.01;
Game.update(0.05);
assert.strictEqual(Game.waveIndex, 1, 'timer starts the next round');
assert.strictEqual(Game.state, 'wave');
assert(Game.heroes.length > firstCount, 'leftover heroes stay');
const g = Game.gold;
Game.roundTimer = 10;
assert(Game.nextRound(), 'call the next round early');
assert(Game.gold > g + 10 - 1, 'early call pays');
Game.waveIndex = Game.waves.length - 1;
assert.strictEqual(Game.nextRound(), false, 'last round must be cleared');

// 중간 저장과 이어하기
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
Game.reset({ lord: DEFAULT_LORD, relics: [] }, 's2');
Game.gold = 777;
Game.summonLevel = 3;
Game.waveIndex = 7;
const m = Game.place('orc_guard', ...[...BUILD_CELLS][0].split(',').map(Number));
setMonsterRank(m, 2);
Game.state = 'wave';
Game.saveRun();
const d = Game.readRunSave();
assert(d && d.waveIndex === 7, 'saved');
Game.reset();
assert(Game.loadRun(d), 'loaded');
assert(Game.stage === 's2' && Game.gold === 777 && Game.summonLevel === 3 && Game.waveIndex === 7 && Game.monsters.length === 1 && Game.monsters[0].rank === 2 && Game.state === 'prep', 'restored');
Game.finish(false);
assert.strictEqual(Game.readRunSave(), null, 'finish clears the save');
store[RUN_SAVE_KEY] = '{bad';
assert.strictEqual(Game.readRunSave(), null, 'broken save ignored');
delete globalThis.localStorage;
assert.strictEqual(Game.readRunSave(), null, 'no storage');
console.log('smoke ok: summon level, rounds, save');
}`, ctx, { filename: 'smoke-rounds' });

// ----- 몬스터 칸 모양 -----
vm.runInContext(`{
for (const id of Object.keys(SAVED_CELLS)) if (SAVED_CELLS[id]) MONSTERS[id].art.cells = SAVED_CELLS[id];
assert.deepStrictEqual([...monsterCells('crystal_giant')], [3, 3]);
assert.deepStrictEqual([...monsterCells('orc_guard')], [1, 1]);
const shapes = new Set(Object.keys(MONSTERS).map(id => monsterCells(id).join('x')));
assert(['1x1', '2x1', '1x2', '3x2', '2x3', '3x3'].every(x => shapes.has(x)), 'shapes vary by monster');
assert(Object.values(MONSTERS).filter(m => m.grade === 'epic').every(m => monsterCells(m.id).join() !== '2,2'), 'no 2x2 epics');
// 모든 칸 모양이 맵에 놓일 자리가 있다
const fit = (type) => [...BUILD_CELLS].filter(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(type, c, r); });
Game.reset();
for (const id of Object.keys(MONSTERS)) assert(fit(id).length > 0, id + ' fits somewhere');
// 놓으면 차지한 칸 전부가 그 몬스터를 찾고, 겹쳐 놓을 수 없다
const [c, r] = fit('crystal_giant')[0].split(',').map(Number);
const big = Game.place('crystal_giant', c, r);
assert(big, 'placed');
for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) assert.strictEqual(Game.monsterAt(c + dx, r - dy), big);
assert.strictEqual(Game.monsterAt(c + 3, r), null);
assert.strictEqual(big.x, tileX(c + 1), 'centered on its cells');
assert(!Game.canPlace('orc_guard', c + 1, r - 1), 'cannot place on the giant');
assert(!Game.canPlace('crystal_giant', c + 1, r), 'cannot overlap');
// 한 칸 옆으로 옮길 때 자기 자리는 빈 것으로 본다
const near = fit('crystal_giant').map(k => k.split(',').map(Number)).concat([[c + 1, r], [c - 1, r], [c, r - 1], [c, r + 1]]).find(([a, b]) => Math.abs(a - c) + Math.abs(b - r) === 1 && Game.canPlace('crystal_giant', a, b, [big]));
if (near) { assert(Game.moveMonster(big, near[0], near[1]), 'nudge over itself'); assert.strictEqual(big.col, near[0]); }
// 합치기 결과가 더 크면 가까운 빈 곳에, 재료가 비운 자리도 쓴다
Game.reset();
const cells = fit('orc_guard').map(k => k.split(',').map(Number));
const ms = cells.slice(0, 3).map(([a, b]) => Game.place('orc_guard', a, b));
const mergeSpot = Game.nearestFit('crystal_giant', ms[0].col, ms[0].row, ms);
assert(Game.canPlace('crystal_giant', mergeSpot.col, mergeSpot.row, ms), 'merge result fits');
const saved = MONSTERS.troll.art.cells;
MONSTERS.troll.art.cells = [3, 3];
const res = withRandom([0.01], () => Game.merge({ monster: ms[0] }, { monster: ms[1] }, [ms[2]]));
if (res.ok) {
    const [w, h] = monsterCells(res.type);
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) assert(isBuildCell(res.monster.col + dx, res.monster.row - dy) || !Game.canPlace(res.type, res.monster.col, res.monster.row), 'result on build cells');
}
if (saved) MONSTERS.troll.art.cells = saved; else delete MONSTERS.troll.art.cells;
// 자리가 없을 때 큰 몬스터 대신 작은 몬스터가 나온다
Game.reset();
const cost = Game.summonCost();
Game.gold = cost;
assert.strictEqual(Game.pickSummonCell('crystal_giant') !== null, true);
// 저장했다 불러와도 칸 모양을 지킨다
const st = {};
globalThis.localStorage = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = v; }, removeItem: k => { delete st[k]; } };
Game.reset({ lord: DEFAULT_LORD, relics: [] });
const [c2, r2] = fit('crystal_giant')[0].split(',').map(Number);
Game.place('crystal_giant', c2, r2);
Game.state = 'wave';
Game.saveRun();
const d = Game.readRunSave();
Game.reset();
assert(Game.loadRun(d), 'load');
assert.strictEqual(Game.monsterAt(c2 + 2, r2 - 2).type, 'crystal_giant');
Game.finish(false);
delete globalThis.localStorage;
console.log('smoke ok: monster cells');
}`, ctx, { filename: 'smoke-cells' });

// ----- 신화와 특수 스킬 -----
vm.runInContext(`{
for (const id of Object.keys(SAVED_MYTHICS)) MONSTERS[id] = SAVED_MYTHICS[id];
MONSTER_RECIPES.push(...SAVED_RECIPES);
for (const id of Object.keys(SAVED_SKILLS)) MONSTERS[id].skills = SAVED_SKILLS[id];
MONSTER_GRADES.mythic.fieldMax = SAVED_FIELD_MAX;
assert.strictEqual(MONSTER_GRADES.mythic.fieldMax, 3);
const mythics = Object.values(MONSTERS).filter(m => m.grade === 'mythic');
const hiddenM = mythics.filter(m => m.hiddenMythic);
assert.strictEqual(mythics.length, 12);
assert.strictEqual(hiddenM.length, 4);
assert.strictEqual(mergePool('mythic').length, 8, 'hidden mythics are not grade merge results');
assert.strictEqual(nextGrade('legendary'), 'mythic');
// 전설과 신화는 모두 스킬이 있고 히든은 2개, 표의 종류와 설명이 있다
for (const m of Object.values(MONSTERS)) {
    if (m.grade === 'legendary' || m.grade === 'mythic') assert((m.skills || []).length === (m.grade === 'mythic' ? 2 : 1), m.id + ' skills');
    else assert(!m.skills, m.id + ' has no skill');
    for (const s of m.skills || []) { assert(SKILL_KINDS[s.kind], s.kind); assert(s.name && s.cooldown > 0, m.id); assert(skillDesc(s).length > 5); }
    for (const a of m.abilities) assert(ABILITY_KINDS[a.kind], m.id + ' ' + a.kind);
}
// 히든 신화 조합식: S랭크 전설 + 영웅 + 일반 2마리
for (const m of hiddenM) {
    const r = MONSTER_RECIPES.filter(x => x.result === m.id);
    assert(r.length === 1 && r[0].hidden && r[0].aRank === 'S', m.id + ' recipe');
    assert.strictEqual(MONSTERS[r[0].a].grade, 'legendary');
    assert.strictEqual(MONSTERS[r[0].b].grade, 'epic');
    assert(r[0].parts.length === 1 && r[0].parts[0].count === 2 && MONSTERS[r[0].parts[0].type].grade === 'common', m.id + ' parts');
}
// 능력 이름은 몬스터별로 바꿀 수 있고 효과는 같다
assert.strictEqual(abilityName(MONSTERS.phoenix_lord.abilities[0]), '불바다');
assert.strictEqual(abilityName(MONSTERS.flame_demon.abilities[0]), '용암 장판');
// 합성 신화보다 히든이 강하다
const power = m => m.stats.damage;
const best = Math.max(...mythics.filter(m => !m.hiddenMythic && m.role !== 'melee').map(power));
assert(hiddenM.filter(m => m.role !== 'melee').every(m => power(m) > best), 'hidden mythics are stronger');

// 스킬: 대기가 차면 쓰고, 용사가 없으면 기다린다
function field(type) {
    Game.reset();
    Game.state = 'wave';
    const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(type, c, r); });
    const [c, r] = key.split(',').map(Number);
    return Game.place(type, c, r);
}
function hero(m, near) {
    const h = createHero('warrior', 1, 0, null, 'north');
    h.waiting = false;
    h.delay = 0;
    h.hp = h.maxHp = 100000;
    h.speed = 0;
    let best = 0, bd = Infinity;
    const len = ROUTES.north.length;
    for (let d = 0; d < len; d += 20) { h.d = d; const p = heroWorld(h); const dd = distance(p.x, p.y, m.x, m.y); if (dd < bd) { bd = dd; best = d; } }
    h.d = near === false ? 0 : best;
    Game.heroes.push(h);
    return h;
}
const cast = (m, s) => castMonsterSkill(m, s, monsterStats(m));
let m = field('giant_king');
const sk = MONSTERS.giant_king.skills[0];
assert.strictEqual(cast(m, sk), false, 'no hero, no cast');
updateMonsterSkills(m, 0);
m.skillCd[0] = 0.01;
updateMonsterSkills(m, 0.05);
assert.strictEqual(m.skillCd[0], 0, 'waits at zero without a target');
let h = hero(m);
let hp = h.hp;
updateMonsterSkills(m, 0.05);
assert.strictEqual(m.skillCd[0], sk.cooldown, 'cooldown restarts after a cast');
assert(h.hp < hp && h.stun > 0, 'nova hits and stuns');
assert(!h.dead);
// 기절은 보스 제외
h.boss = true; h.stun = 0;
cast(m, sk);
assert.strictEqual(h.stun, 0, 'boss not stunned');
h.boss = false;
// meteor: 효과와 피해
m = field('hell_general'); h = hero(m); hp = h.hp;
assert(cast(m, MONSTERS.hell_general.skills[0]) && h.hp < hp && h.burn > 0, 'meteor burns');
// barrage: count번
m = field('star_whale'); h = hero(m); hp = h.hp;
const whale = MONSTERS.star_whale.skills[0];
assert(cast(m, whale));
assert(hp - h.hp > 0);
// harvest: 약한 용사만, 보스 제외, 골드
m = field('soul_devourer');
const strong = hero(m);
const weak = hero(m); weak.hp = weak.maxHp * 0.1;
const bossy = hero(m); bossy.boss = true; bossy.hp = bossy.maxHp * 0.1;
const g0 = Game.gold;
assert(cast(m, MONSTERS.soul_devourer.skills[0]));
assert(weak.dead && !strong.dead && !bossy.dead, 'harvest takes only the weak');
assert(Game.gold >= g0 + 2, 'harvest pays');
Game.heroes = Game.heroes.filter(x => x === strong);
strong.hp = strong.maxHp;
assert.strictEqual(cast(m, MONSTERS.soul_devourer.skills[0]), false, 'nobody to harvest');
// timeStop: 보스는 느려지기만
m = field('time_witch');
const a1 = hero(m, false), b1 = hero(m, false); b1.boss = true;
assert(cast(m, MONSTERS.time_witch.skills[0]));
assert(a1.stun >= 3 && !b1.stun && b1.slow > 0, 'time stop');
// push: 뒤로 밀고 보스는 그대로
m = field('abyss_dragon_king');
const p1 = hero(m), p2 = hero(m); p2.boss = true;
p1.d = p2.d = 1000;
assert(cast(m, MONSTERS.abyss_dragon_king.skills[0]));
assert(p1.d === 1000 - 2.5 * TILE && p2.d === 1000, 'push');
// buff: 수치가 오르고 시간이 끝나면 돌아온다
m = field('orc_high_chief');
const ally = Game.place('orc_guard', ...[...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => Game.canPlace('orc_guard', c, r)));
hero(m, false);
const d0 = monsterStats(ally).damage;
assert(cast(m, MONSTERS.orc_high_chief.skills[0]));
assert(Math.abs(monsterStats(ally).damage - d0 * 1.3) < 1e-6, 'war cry');
updateMonster(ally, 9);
assert(Math.abs(monsterStats(ally).damage - d0) < 1e-6, 'buff ends');
// armor buff
m = field('crystal_giant'); hero(m, false);
assert(cast(m, MONSTERS.crystal_giant.skills[0]));
assert(Math.abs(monsterStats(m).armor - 0.3) < 1e-6, 'armor buff');
// heal: 회복과 부활
m = field('phoenix_lord');
const hurt = Game.place('orc_guard', ...[...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => Game.canPlace('orc_guard', c, r)));
assert.strictEqual(cast(m, MONSTERS.phoenix_lord.skills[0]), false, 'nobody hurt');
hurt.hp = 1;
assert(cast(m, MONSTERS.phoenix_lord.skills[0]) && hurt.hp > 1, 'heals');
hurt.down = 5;
assert(cast(m, MONSTERS.phoenix_lord.skills[0]) && !(hurt.down > 0), 'revives');

// 맵 제한: 서로 다른 신화면 3마리까지(히든도 같다), 같은 종은 1마리
Game.reset();
Game.state = 'prep';
const seat = t => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => Game.canPlace(t, c, r));
const legend = t => { const mm = Game.place(t, ...seat(t)); setMonsterRank(mm, 4); return mm; };
const myth1 = Game.place('time_witch', ...seat('time_witch'));
// 결과 후보에서 맵에 있는 종은 빠진다
assert(!Game.mergeResultPool('mythic', []).includes('time_witch'), 'same species excluded');
assert.strictEqual(Game.mergeResultPool('mythic', [myth1]).length, 8, 'a material does not count');
// S랭크 조합식으로 히든 신화
const put1 = t => Game.place(t, ...seat(t));
const s1 = legend('death_lord');
let plan = Game.fullRecipePlan(s1);
assert(plan.kind === 'none' && plan.reason === 'count', 'materials missing');
const vamp = put1('vampire'), g1 = put1('grave_keeper');
assert.strictEqual(Game.fullRecipePlan(s1).reason, 'count', 'one common is not enough');
const g2 = put1('grave_keeper');
plan = Game.fullRecipePlan(s1);
assert(plan.kind === 'recipe' && plan.result === 'death_god' && plan.extra.length === 2, 'hidden recipe');
assert.strictEqual(mergePlan(s1, vamp).kind, 'none', 'dragging two materials does not use it');
assert.strictEqual(findRecipe(s1, vamp), null, 'not a two-monster recipe');
setMonsterRank(s1, 3);
assert.strictEqual(Game.fullRecipePlan(s1).reason, 'rank', 'rank A is not enough');
assert.strictEqual(Game.fullRecipePlan(vamp).reason, 'none', 'only the legendary starts it');
setMonsterRank(s1, 4);
Game.state = 'wave';
const res = Game.act({ kind: 'fullRecipe', monster: s1 });
assert(res.ok && res.type === 'death_god' && res.hidden && res.discovered, 'made');
assert(s1.removed && vamp.removed && g1.removed && g2.removed, 'all four used');
assert.strictEqual(res.monster.rank, 4, 'rank from the legendary');
assert(Fx.discovery && Fx.discovery.parts, 'discovery shows parts');
assert(Meta.hasRecipe(MONSTER_RECIPES.find(r => r.result === 'death_god')), 'recorded');
// 다른 히든 신화는 함께 둘 수 있다
const s3 = legend('giant_king');
put1('war_drummer'); put1('orc_guard'); put1('orc_guard');
plan = Game.fullRecipePlan(s3);
assert(plan.kind === 'recipe' && plan.result === 'god_king', 'second hidden mythic allowed');
// 같은 히든 신화는 또 만들 수 없다
const s6 = legend('death_lord');
put1('vampire'); put1('grave_keeper'); put1('grave_keeper');
plan = Game.fullRecipePlan(s6);
assert(plan.reason === 'unique' && plan.sameKind, 'same mythic refused');
// 3마리를 채우면 더 못 만든다
put1('kraken');
assert.strictEqual(Game.fullRecipePlan(s3).reason, 'unique', 'three mythics max');
// 정보 창: 재료가 모인 S랭크 전설에만 버튼이 뜬다
UI.selectedMonster = s3;
UI.layout();
assert(UI.buttons.some(b => b.id === 'fullRecipe'), 'button on the legendary');
UI.selectedMonster = Game.monsters.find(x => x.type === 'kraken');
UI.layout();
assert(!UI.buttons.some(b => b.id === 'fullRecipe'), 'no button elsewhere');
UI.clearSelection();
// 저장된 기록의 조합식 열쇠가 살아 있다
assert(Meta.sanitize({ version: META_VERSION, recipes: [recipeKey(MONSTER_RECIPES.find(r => r.result === 'sun_god'))] }).recipes.length === 1, 'recipe key kept');
// 저장과 팝업: 스킬이 있는 몬스터의 팝업이 오류 없이 만들어진다
const pm = Game.monsters.find(x => x.type === 'death_god');
assert(MONSTERS[pm.type].skills.length === 2);
console.log('smoke ok: mythics and skills');
}`, ctx, { filename: 'smoke-mythic' });

// ----- 유물 19종의 효과 -----
vm.runInContext(`{
for (const l of Object.values(DEMON_LORDS)) l.passive = SAVED_PASSIVES[l.id];
MAPS.merge.altars = SAVED_TILES.altars;
MAPS.merge.cursed = SAVED_TILES.cursed;
STAGES.forEach((st, i) => { st.mapId = SAVED_STAGE_MAPS[i]; });
setMap('merge');
for (const m of Object.values(MONSTERS)) if (REAL_RULES.monsters[m.id]) { m.stats = REAL_RULES.monsters[m.id].stats; m.abilities = REAL_RULES.monsters[m.id].abilities; m.desc = REAL_RULES.monsters[m.id].desc; if (REAL_RULES.monsters[m.id].skills) m.skills = REAL_RULES.monsters[m.id].skills; }
for (const e of Object.values(EQUIPMENT)) e.effects = REAL_RULES.equip[e.id];
for (const l of Object.values(DEMON_LORDS)) l.effects = REAL_RULES.lords[l.id];
Object.assign(MONSTER_ROLES, REAL_RULES.roles);
const seed = (id) => {
    const save = Meta.hasRelic;
    Meta.hasRelic = () => true;
    Meta.relicSlots = (orig => { const f = () => 4; f.orig = orig; return f; })(Meta.relicSlots);
    Game.reset({ lord: 'rift', relics: id ? [id] : [] });
    Meta.hasRelic = save;
    Meta.relicSlots = Meta.relicSlots.orig;
    Game.state = 'wave';
    assert.deepStrictEqual([...Game.relics], id ? [id] : [], 'relic taken ' + id);
};
const spot = t => [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => Game.canPlace(t, c, r));
const put = t => Game.place(t, ...spot(t));
// 모든 유물이 그림과 해금 자리, 효과 키를 가진다
const unlocks = STAGES.flatMap(s => s.unlocks).filter(u => u.kind === 'relic').map(u => u.id);
for (const id of Object.keys(RELICS)) {
    assert(unlocks.includes(id), id + ' unlocks');
    for (const k of Object.keys(RELICS[id].effects)) assert(LORD_EFFECTS[k], id + ' key ' + k);
}
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-6, msg + ': ' + a + ' vs ' + b);

// 탐욕의 금주머니: 200G당 1%, 최대 15%
seed('greedy_vault');
let m = put('orc_guard');
const base = MONSTERS.orc_guard.stats.damage;
Game.gold = 399;
near(monsterStats(m).damage, base * 1.01, '1 step');
Game.gold = 100000;
near(monsterStats(m).damage, base * 1.15, 'capped');
// 유리 심장: 체력이 가득할 때만
seed('glass_heart');
m = put('orc_guard');
near(monsterStats(m).damage, base * 1.1, 'full hp');
Game.hp -= 1;
near(monsterStats(m).damage, base, 'hurt');
// 고독한 왕관: 6마리 이하
seed('lone_crown');
m = put('orc_guard');
near(monsterStats(m).damage, base * 1.25, 'few');
for (let i = 0; i < 6; i++) put('orc_guard');
near(monsterStats(m).damage, base, 'many');
// 빈민의 투구: 일반만
seed('pauper_helm');
m = put('orc_guard');
const rare = put('troll');
near(monsterStats(m).damage, base * 1.2, 'common');
near(monsterStats(rare).damage, MONSTERS.troll.stats.damage, 'rare');
// 피의 제단: 제물당, 최대 15%
seed('blood_altar');
m = put('orc_guard');
Game.stats.sacrificed = 2;
near(monsterStats(m).damage, base * 1.01, 'two sacrifices');
Game.stats.sacrificed = 100;
near(monsterStats(m).damage, base * 1.15, 'altar cap');
// 철벽 서약과 망자의 뿔피리: 근접 몬스터만
seed('iron_oath');
near(monsterStats(put('orc_guard')).range, MONSTERS.orc_guard.stats.range + 0.5, 'melee range');
near(monsterStats(put('skeleton_archer')).range, MONSTERS.skeleton_archer.stats.range, 'ranged stays');
seed('dead_horn');
near(monsterStats(put('orc_guard')).damage, base * 1.15, 'melee damage');
// 장비 먹는 괴물
seed('equip_eater');
m = put('orc_guard');
m.equip = 'sword';
near(monsterStats(m).damage, base * (1 + EQUIPMENT.sword.effects.damage * 1.2), 'equip power');
// 고리대금 장부: 3%, 최대 15G
seed('usury_ledger');
Game.gold = 100;
Game.payInterest();
assert.strictEqual(Game.gold, 103);
Game.gold = 100000;
Game.payInterest();
assert.strictEqual(Game.gold, 100015, 'interest cap');
seed(null);
Game.gold = 100;
Game.payInterest();
assert.strictEqual(Game.gold, 100, 'no relic no interest');
// 폭풍의 병: 번개만
seed('storm_bottle');
near(Game.skillCooldown('lightning'), COMBAT_RULES.lightning.cooldown * 0.75, 'lightning');
near(Game.skillCooldown('roar'), COMBAT_RULES.roar.cooldown, 'roar same');
// 광기의 북
seed(null);
assert(Game.roarLocked(), 'roar locked at full hp');
seed('mad_drum');
assert(!Game.roarLocked(), 'roar free');
// 흔들리는 다리: 합류점을 지난 뒤에만 느려진다
seed('shaky_bridge');
const hb = createHero('warrior', 1, 0, null, 'north');
hb.waiting = false; hb.delay = 0;
Game.heroes.push(hb);
const md = mergeDistance('north');
assert(md > 100, 'routes merge');
hb.d = md - 100;
let d0 = hb.d;
updateHero(hb, 0.1);
const before = hb.d - d0;
hb.d = md + 50;
d0 = hb.d;
updateHero(hb, 0.1);
near((hb.d - d0) / before, 0.92, 'slower after the merge');
// 깨진 모래시계: 일찍 부른 라운드만
seed('broken_hourglass');
m = put('orc_guard');
const iv = MONSTERS.orc_guard.stats.interval;
Game.waveIndex = 0;
Game.roundTimer = 10;
assert(Game.nextRound());
near(monsterStats(m).interval, iv / 1.1, 'early');
Game.roundTimer = 0;
assert(Game.nextRound());
near(monsterStats(m).interval, iv, 'on time');
// 피의 계약서: 골드가 없으면 체력 1로 3번, 체력 1이면 못 한다
seed('blood_contract');
Game.gold = 0;
const hp0 = Game.hp;
for (let i = 0; i < 3; i++) assert(Game.summon().ok, 'blood summon ' + i);
assert.strictEqual(Game.hp, hp0 - 3);
assert.strictEqual(Game.gold, 0);
assert.strictEqual(Game.summon().reason, 'gold', 'three per run');
seed('blood_contract');
Game.gold = 0;
Game.hp = 1;
assert.strictEqual(Game.summon().reason, 'gold', 'never at 1 hp');
Game.hp = 5;
Game.gold = 1000;
assert(Game.summon().ok);
assert.strictEqual(Game.hp, 5, 'gold first');
// 거울 쌍둥이
seed('mirror_twin');
Game.gold = 1000;
{
    const orig = Math.random;
    Math.random = () => 0;
    const r = Game.summon();
    Math.random = orig;
    assert(r.ok && Game.monsters.length === 2 && Game.monsters[0].type === Game.monsters[1].type, 'twin');
}
// 미치광이의 주사위: 일반 3마리가 영웅
seed('mad_dice');
const ga = put('orc_guard'), gb = put('orc_guard'), gc = put('orc_guard');
{
    const orig = Math.random;
    Math.random = () => 0;
    const r = Game.merge({ monster: ga }, { monster: gb }, [gc]);
    Math.random = orig;
    assert(r.ok && MONSTERS[r.type].grade === 'epic', 'two grades up: ' + r.type);
}
// 대장장이의 망치: 등급이 오르고, 최고 등급은 그대로
seed('smith_hammer');
{
    const orig = Math.random;
    Math.random = () => 0;
    assert.strictEqual(EQUIPMENT[Game.returnedEquipId('sword')].grade, 'rare', 'up');
    assert.strictEqual(Game.returnedEquipId('crown'), 'crown', 'epic stays');
    Math.random = () => 0.5;
    assert.strictEqual(Game.returnedEquipId('sword'), 'sword', 'miss');
    Math.random = orig;
}
console.log('smoke ok: relic effects');

// ----- 근접 몬스터: 설치한 자리에서 때린다 -----
{
    for (const m of Object.values(MONSTERS)) {
        assert(!monsterBlocks(m.id), m.id + ' does not block');
        if (MONSTER_ROLES[m.role].melee) assert(m.stats.block >= 1 && m.stats.range >= 2, m.id + ' melee reach');
        for (const a of m.abilities) assert(!['regen', 'thorns', 'lifesteal', 'enrage', 'deathStun'].includes(a.kind) && !(a.kind === 'aura' && a.stat === 'heal'), m.id + ' no hp ability');
        for (const k of m.skills || []) assert(k.kind !== 'heal' && !k.armor, m.id + ' no hp skill');
    }
    for (const e of Object.values(EQUIPMENT)) assert(!e.effects.hp, e.id + ' no hp');
    assert(monsterReach('crystal_giant') > MONSTERS.crystal_giant.stats.range, 'big body reaches further');
    Game.reset();
    Game.state = 'wave';
    const g = Game.place('orc_guard', ...spot('orc_guard'));
    const hx = g.x, hy = g.y;
    const makeHero = () => {
        const h = createHero('warrior', 0, 0, null, 'north');
        h.waiting = false; h.delay = 0; h.speed = 0; h.hp = h.maxHp = 100000;
        let best = 0, bd = Infinity;
        for (let d = 0; d < ROUTES.north.length; d += 10) { h.d = d; const p = heroWorld(h); const dd = distance(p.x, p.y, g.x, g.y); if (dd < bd) { bd = dd; best = d; } }
        h.d = best;
        Game.heroes.push(h);
        return h;
    };
    const hs = [makeHero(), makeHero(), makeHero(), makeHero(), makeHero()];
    if (distance(...Object.values((({ x, y }) => ({ x, y }))(heroWorld(hs[0]))), g.x, g.y) <= monsterStats(g).range * TILE) {
        for (let i = 0; i < 90; i++) { Fx.update(GAME_TICK); updateMonster(g, GAME_TICK); }
        assert.strictEqual(g.x, hx, 'stays in place');
        assert.strictEqual(g.y, hy, 'stays in place');
        assert(hs.every(h => !h.blocker), 'nobody is held');
        assert.strictEqual(hs.filter(h => h.hp < h.maxHp).length, 3, 'hits block count at once');
    }
    // 격분: 쓰러뜨리면 잠시 빨라진다
    Game.reset();
    Game.state = 'wave';
    const w = Game.place('werewolf', ...spot('werewolf'));
    const iv = monsterStats(w).interval;
    const v = createHero('warrior', 0, 0, null, 'north');
    v.waiting = false;
    Game.heroes.push(v);
    damageHero(v, 1e6, 0, 0, null, w);
    near(monsterStats(w).interval, iv * 0.6, 'frenzy');
    updateMonster(w, 3.1);
    near(monsterStats(w).interval, iv, 'frenzy ends');
    Game.heroes = [];
}
// ----- 맵 표 -----
{
    assert(MAP_IDS.length >= 3, 'maps');
    for (const id of MAP_IDS) {
        const map = MAPS[id];
        setMap(id);
        assert.strictEqual(currentMap, id);
        for (const r of ROUTE_IDS) {
            const t = map.routes[r];
            assert.strictEqual(t[t.length - 1].join(), THRONE_TILE.col + ',' + THRONE_TILE.row, id + ' ends at the throne');
            for (let i = 1; i < t.length; i++) assert(t[i][0] === t[i - 1][0] || t[i][1] === t[i - 1][1], id + ' straight segments');
            assert(ROUTES[r].length > 30 * TILE && ROUTES[r].length < 70 * TILE, id + ' route length ' + ROUTES[r].length / TILE);
        }
        assert.strictEqual(map.routes.north[0][1], 3);
        assert.strictEqual(map.routes.south[0][1], 11);
        assert(mergeDistance('north') > 0 && mergeDistance('south') > 0, id + ' merge point on both routes');
        assert(Math.abs((ROUTES.north.length - mergeDistance('north')) - (ROUTES.south.length - mergeDistance('south'))) < 1, id + ' same distance after merge');
        for (const [c, r] of map.altars) assert(isBuildCell(c, r), id + ' altar ' + c + ',' + r);
        for (const [c, r] of map.cursed) { assert(!isBuildCell(c, r), id + ' cursed ' + c + ',' + r); assert(!isPathCell(c, r), id + ' cursed off the path'); }
        assert(map.altars.length >= 2 && map.cursed.length >= 2, id + ' gimmicks');
        Game.monsters = [];
        for (const t of Object.keys(MONSTERS)) assert([...BUILD_CELLS].some(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); }), id + ' fits ' + t);
    }
    setMap('merge');
    Game.reset();
    const [ac, ar] = MAPS.merge.altars[0];
    const onIt = Game.place('orc_guard', ac, ar);
    near(monsterStats(onIt).damage, MONSTERS.orc_guard.stats.damage * 1.3, 'altar damage');
    near(monsterStats(onIt).range, MONSTERS.orc_guard.stats.range + 0.5, 'altar range');
    assert(onAltar('crystal_giant', ac - 1, ar + 1), 'big body covers the altar');
    assert(!onAltar('orc_guard', ac - 1, ar), 'neighbor cell is not');
    const free = [...BUILD_CELLS].map(k => k.split(',').map(Number)).find(([c, r]) => Game.canPlace('orc_guard', c, r) && !onAltar('orc_guard', c, r));
    assert(Game.moveMonster(onIt, free[0], free[1]));
    near(monsterStats(onIt).damage, MONSTERS.orc_guard.stats.damage, 'off the altar');
    const [cc, cr] = MAPS.merge.cursed[0];
    assert(!Game.canPlace('orc_guard', cc, cr), 'cursed ground');
    Game.reset({ lord: DEFAULT_LORD, relics: [] }, 's2');
    assert.strictEqual(currentMap, 'parallel', 'story map');
    Game.reset();
    assert.strictEqual(currentMap, DEFAULT_MAP);
    const dm = dailyChallenge('2026-11-07');
    Game.reset(null, null, dm);
    assert.strictEqual(currentMap, dm.map, 'daily map');
    const used = new Set();
    for (let i = 1; i <= 28; i++) used.add(dailyChallenge('2026-12-' + String(i).padStart(2, '0')).map);
    assert.strictEqual(used.size, MAP_IDS.length, 'every map comes up');
    for (const kind of [abyssChallenge('w', 'rift', []), raidChallenge('w')]) assert(MAPS[kind.map], kind.kind + ' map');
    Game.reset();
}
console.log('smoke ok: melee in place');
}`, ctx, { filename: 'smoke-relics' });

// ----- 고정 난수, 입력 기록, 일일 도전 -----
vm.runInContext(`{
Object.assign(SWARM_RULES, SAVED_SWARM);
Object.assign(BOSSES, SAVED_RAID);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-9, msg + ': ' + a + ' vs ' + b);
// 난수: 시드가 같으면 같고, 흐름끼리 서로 흔들지 않는다
Rng.start('a');
const s1 = [rng('summon'), rng('summon')];
Rng.start('a');
rng('battle'); rng('battle'); rng('merge');
assert.strictEqual(rng('summon'), s1[0], 'streams are independent');
assert.strictEqual(rng('summon'), s1[1]);
Rng.start('b');
assert.notStrictEqual(rng('summon'), s1[0], 'other seed');
for (let i = 0; i < 2000; i++) { const v = rng('x'); assert(v >= 0 && v < 1, 'range'); }
Rng.stop();
{
    const orig = Math.random;
    Math.random = () => 0.25;
    assert.strictEqual(rng('summon'), 0.25, 'no seed: Math.random');
    Math.random = orig;
}
// 일일 도전: 날짜가 같으면 같고, 날짜가 다르면 달라진다
assert.strictEqual(kstDate(Date.UTC(2026, 10, 7, 14, 59)), '2026-11-07');
assert.strictEqual(kstDate(Date.UTC(2026, 10, 7, 15, 0)), '2026-11-08', 'midnight KST');
const c = dailyChallenge('2026-11-07');
assert.strictEqual(JSON.stringify(c), JSON.stringify(dailyChallenge('2026-11-07')));
const seen = new Set();
for (let d = 1; d <= 28; d++) seen.add(JSON.stringify(dailyChallenge('2026-11-' + String(d).padStart(2, '0')).cards));
assert(seen.size > 15, 'cards change by day');
for (let d = 1; d <= 28; d++) {
    const x = dailyChallenge('2026-12-' + String(d).padStart(2, '0'));
    assert(DEMON_LORDS[x.lord] && x.relics.length === 2 && new Set(x.relics).size === 2 && x.relics.every(r => RELICS[r]), 'lord and relics');
    assert(x.cards.length === 3 && new Set(x.cards).size === 3 && x.cards.every(r => RULE_CARDS[r]), 'cards');
    assert(ZONES[x.zone], 'zone');
}
for (const card of Object.values(RULE_CARDS)) for (const k of Object.keys(card.effects)) assert(LORD_EFFECTS[k], card.id + ' key');
// 조건 적용: 잠긴 마왕과 유물도 쓴다(모두 같은 조건)
Game.reset(null, null, c);
assert.strictEqual(Game.lord, c.lord);
assert.strictEqual(Game.relics.join(), c.relics.join());
assert(Game.waves.length >= 60, 'rounds table');
assert.strictEqual(Game.zone, c.zone);
assert(Rng.on && Game.record && Game.tick === 0);
Game.reset();
assert(!Rng.on && !Game.record && !Game.challenge, 'story run has no seed');
// 점수: 뒤 라운드일수록 커진다. 처치와 라운드 완료로 쌓인다
assert(scoreMul(50) > scoreMul(10) * 20, 'score grows fast');
assert.strictEqual(scoreMul(1), 1.04);
Game.reset(null, null, c);
Game.state = 'wave';
const gHero = createHero('warrior', 0, 0, null, 'north');
gHero.waiting = false;
Game.heroes.push(gHero);
const s0 = Game.score;
Game.scoreKill(gHero);
assert.strictEqual(Game.score - s0, Math.floor(1000 * scoreMul(1)), 'kill score');
gHero.elite = true;
const s2 = Game.score;
Game.scoreKill(gHero);
assert.strictEqual(Game.score - s2, Math.floor(5000 * scoreMul(1)), 'elite score');
gHero.elite = false;
// 무한 라운드: 표 끝을 넘어 계속 이어지고, 체력이 늘고, 인원은 상한에서 멈춘다
Game.heroes = [];
Game.waveIndex = 58;
Game.state = 'wave';
Game.roundTimer = 0;
assert(Game.nextRound(), 'next round near the end of the table');
assert.strictEqual(Game.waveIndex, 59);
Game.heroes = [];
Game.roundTimer = 0;
assert(Game.nextRound(), 'next round past the table');
assert(Game.waves.length >= 63 && Game.waveIndex === 60, 'rounds extended');
Game.heroes = [];
assert(Game.endlessHpMul(100) > 10 && Game.endlessHpMul(20) === 1, 'hp grows after hpFrom');
assert(Object.values(buildRound(500).members).reduce((a, b) => a + b, 0) <= ENDLESS_RULES.maxCount + 2, 'count capped');
assert.strictEqual(buildRound(30).party, WAVES[29].party, 'same table');
Game.reset();
assert.strictEqual(Game.endlessHpMul(100), 1, 'story has no endless hp');
Game.scoreKill(gHero);
assert.strictEqual(Game.score, 0, 'story has no score');

// 입력 기록: 봇으로 끝까지 둔 판을 난수를 망가뜨린 채 재생해도 결과가 같다
function botPlay(date) {
    const C = dailyChallenge(date);
    Game.reset(null, null, C);
    Game.state = 'prep';
    let guard = 0;
    while (Game.inPlay() && guard++ < 60 * 60 * 120) {
        if (Game.bossReward) Game.act({ kind: 'pickReward', i: Game.bossReward.cards.findIndex(x => Game.canTakeReward(x)) });
        if (Game.tick % 20 === 0 && Game.waveIndex < 14) {
            if (!Game.fieldFull() && Game.canPaySummon()) Game.act({ kind: 'summon' });
            const ms = Game.monsters.filter(m => !m.removed);
            for (const a of ms) {
                const b = ms.find(o => o !== a && MONSTERS[o.type].grade === MONSTERS[a.type].grade && Game.mergePlanFor(a, o).kind !== 'none');
                if (b) { Game.act({ kind: 'merge', src: a, dst: b }); break; }
            }
            if (ms[0] && Game.tick % 200 === 0) Game.act({ kind: 'lightning', x: 700, y: 500 });
        }
        Game.update(GAME_TICK);
    }
    return { result: Game.challengeResult, record: Game.record, gold: Game.gold, kills: Game.stats.kills, types: Game.monsters.map(m => m.type + ':' + m.col + ',' + m.row).join() };
}
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
store['dungeonGuard.runSave'] = 'keep';
const before = JSON.stringify(store[RUN_SAVE_KEY]);
const A = botPlay('2026-11-07');
assert(A.result && A.record.inputs.length > 20 && A.result.score > 100000, 'bot played to the end');
assert.strictEqual(A.result.victory, false, 'endless has no victory');
assert.strictEqual(JSON.stringify(store[RUN_SAVE_KEY]), before, 'story save untouched');
assert(Meta.data.daily['2026-11-07'].score === A.result.score && Game.challengeBest.isBest, 'best kept');
const saved = JSON.parse(store[DAILY_RECORD_KEY]);
assert(saved.date === '2026-11-07' && saved.score === A.result.score, 'record saved');
const runsBefore = Meta.data.runs;
{
    const orig = Math.random;
    let x = 0.123;
    Math.random = () => { x = (x * 9301 + 0.49297) % 1; return x; };
    const R = replayChallenge(JSON.parse(JSON.stringify(A.record)));
    Math.random = orig;
    assert.strictEqual(JSON.stringify(R), JSON.stringify(A.result), 'replay gives the same result');
    assert.strictEqual(Game.gold, A.gold, 'same gold');
    assert.strictEqual(Game.monsters.map(m => m.type + ':' + m.col + ',' + m.row).join(), A.types, 'same field');
}
assert.strictEqual(Meta.data.runs, runsBefore, 'replay leaves no record');
// 같은 날 N번째 소환은 누구에게나 같다(앞서 합쳤든 안 합쳤든)
const firstSummons = doMerge => {
    Game.reset(null, null, dailyChallenge('2026-11-09'));
    Game.state = 'wave';
    Game.gold = 99999;
    const out = [];
    for (let i = 0; i < 6; i++) {
        out.push(Game.act({ kind: 'summon' }).type);
        if (doMerge) rng('merge');
    }
    return out.join();
};
assert.strictEqual(firstSummons(true), firstSummons(false), 'nth summon');
// 낮은 점수는 최고 기록을 덮지 않는다
const b0 = Meta.data.daily['2026-11-07'].score;
assert.strictEqual(Meta.finishDaily('2026-11-07', { score: b0 - 1, rounds: 1, victory: false }, { inputs: [] }).isBest, false);
assert.strictEqual(Meta.data.daily['2026-11-07'].score, b0);
// 기록 정리: 깨진 값은 버린다
assert.strictEqual(JSON.stringify(Meta.sanitize({ version: META_VERSION, daily: { 'x': { score: 1, rounds: 1 }, '2026-01-01': { score: 'a', rounds: 1 }, '2026-01-02': { score: 5, rounds: 2 } } }).daily), JSON.stringify({ '2026-01-02': { score: 5, rounds: 2, victory: false } }));
delete globalThis.localStorage;
Game.reset();
// ----- 끝없는 심연 -----
{
    const A1 = abyssChallenge('77', 'rift', ['sniper_mark']);
    assert.strictEqual(JSON.stringify(A1), JSON.stringify(abyssChallenge('77', 'rift', ['sniper_mark'])), 'same seed, same run');
    assert(ZONES[A1.zone]);
    // 변이: 어려운 카드만, 좁은 전장은 한 번만
    const ms = Array.from({ length: 40 }, (_, i) => abyssMutation('77', i));
    assert(ms.every(m => RULE_CARDS[m] && RULE_CARDS[m].kind === 'hard'), 'hard cards');
    assert.strictEqual(ms.filter(m => m === 'narrow_field').length, 1, 'narrow field once');
    Game.reset(null, null, A1);
    Game.state = 'prep';
    assert.strictEqual(Game.lord, 'rift');
    assert.strictEqual(Game.record.kind, 'abyss');
    assert.strictEqual(Game.record.seed, '77');
    near(Game.mods.range, 0.1, 'chosen relic');
    Game.startWave();
    assert.strictEqual(Game.mutations.length, 0, 'no mutation on floor 1');
    // 10층에 들어가면 변이가 쌓이고 지역이 바뀌고 점수 배율이 오른다
    const z0 = Game.zone;
    const s0 = Game.addScore(1000);
    Game.heroes = [];
    Game.state = 'prep';
    Game.waveIndex = 10;
    Game.bossReward = null;
    Game.startWave();
    assert.strictEqual(Game.mutations.length, 1, 'mutation at floor 10');
    assert.notStrictEqual(Game.zone, z0, 'zone changes');
    assert(Fx.banner && Fx.banner.name.includes('심연'), 'banner');
    const card = RULE_CARDS[Game.mutations[0]];
    for (const [k, v] of Object.entries(card.effects)) {
        const base = buildMods('rift', ['sniper_mark']);
        assert(Math.abs(Game.mods[k] - (LORD_EFFECTS[k].mode === 'mul' ? base[k] * v : base[k] + v)) < 1e-9, 'mutation applied ' + k);
    }
    assert.strictEqual(Game.addScore(1000), Math.floor(1000 * scoreMul(11) * 1.25), 'score bonus per mutation');
    // 건너뛰어도 빠짐없이 쌓이고, 다시 불러도 늘지 않는다
    Game.heroes = [];
    Game.state = 'prep';
    Game.waveIndex = 35;
    Game.abyssStep();
    Game.abyssStep();
    assert.strictEqual(Game.mutations.length, 3, 'catch up once');
    // 약해지는 변이가 겹쳐도 하한이 있다
    Game.mutations = Array(29).fill('dull_hands');
    Game.waveIndex = 300;
    Game.abyssStep();
    assert(Game.mods.attackSpeed >= -0.5 && Game.mods.damage >= -0.5, 'floor on weakening');
    // 일일 도전보다 체력이 가파르다
    Game.reset(null, null, abyssChallenge('77', 'rift', []));
    const ha = Game.endlessHpMul(60);
    Game.reset(null, null, dailyChallenge('2026-11-07'));
    assert(ha > Game.endlessHpMul(60), 'steeper than daily');
    // 판 끝: 난이도마다 가장 깊은 층(같은 층이면 남은 왕좌 체력), 얕은 판은 덮지 않는다
    Meta.data.abyss = { week: '', levels: {} };
    assert(Meta.finishAbyss('w1', 9, { rounds: 30, hp: 3 }, { inputs: [] }).isBest);
    assert(!Meta.finishAbyss('w1', 9, { rounds: 20, hp: 20 }, { inputs: [] }).isBest, 'shallower is not better');
    assert(Meta.finishAbyss('w1', 9, { rounds: 30, hp: 4 }, { inputs: [] }).isBest, 'same floor, more throne hp');
    assert(!Meta.finishAbyss('w1', 9, { rounds: 30, hp: 4 }, { inputs: [] }).isBest, 'a tie is not a new best');
    assert(Meta.finishAbyss('w1', 0, { rounds: 12, hp: 20 }, { inputs: [] }).isBest, 'each level has its own board');
    assert.strictEqual(Meta.abyssBest('w1', 9).floor, 30);
    assert.strictEqual(Meta.abyssBest('w1', 0).floor, 12);
    assert(Meta.finishAbyss('w2', 9, { rounds: 5, hp: 1 }, { inputs: [] }).isBest, 'new week starts over');
    assert.strictEqual(Meta.abyssBest('w2', 0).floor, 0);
    // 예전 기록(난이도 없음)은 조항이 없던 판이라 노말로 옮긴다
    assert.strictEqual(JSON.stringify(Meta.sanitize({ version: META_VERSION, abyss: { week: 'w', bestFloor: 12, bestScore: 34 } }).abyss), JSON.stringify({ week: 'w', levels: { [DEFAULT_ABYSS_LEVEL]: { floor: 12, hp: 0 } } }));
    assert.strictEqual(JSON.stringify(Meta.sanitize({ version: META_VERSION, abyss: { week: 'w', levels: { 9: { floor: 7, hp: 2 }, 42: { floor: 9 } } } }).abyss), JSON.stringify({ week: 'w', levels: { 9: { floor: 7, hp: 2 } } }), 'unknown levels dropped');
    // 이번 주 시드: 일주일 동안 같고 월요일 한국 시간 0시에 바뀐다(2026-11-09가 월요일)
    assert.strictEqual(abyssWeek(Date.UTC(2026, 10, 8, 15, 0)), '2026-11-09', 'monday midnight KST');
    assert.strictEqual(abyssWeek(Date.UTC(2026, 10, 8, 14, 59)), '2026-11-02', 'still last week');
    assert.strictEqual(abyssWeek(Date.UTC(2026, 10, 15, 14, 59)), '2026-11-09', 'same all week');
    // 고른 마왕과 유물이 달라도 변이, 지역, N번째 소환은 같다
    const first = (lord, relics) => {
        Game.reset(null, null, abyssChallenge('w9', lord, relics));
        Game.state = 'wave';
        Game.gold = 99999;
        const list = [];
        for (let i = 0; i < 5; i++) list.push(Game.act({ kind: 'summon' }).type);
        return list.join() + '|' + Game.zone + '|' + abyssMutation('w9', 0) + abyssMutation('w9', 1);
    };
    assert.strictEqual(first('rift', []), first('rift', ['sniper_mark']), 'same run for everyone');
    // 입력 재생: 심연도 시드와 고른 조건으로 같은 결과가 나온다
    const play = () => {
        Game.reset(null, null, abyssChallenge('4242', 'gold_king', ['legion_banner', 'mad_dice']));
        Game.state = 'prep';
        let guard = 0;
        while (Game.inPlay() && guard++ < 60 * 60 * 120) {
            if (Game.bossReward) Game.act({ kind: 'pickReward', i: Game.bossReward.cards.findIndex(x => Game.canTakeReward(x)) });
            if (Game.tick % 20 === 0 && Game.waveIndex < 14) {
                if (!Game.fieldFull() && Game.canPaySummon()) Game.act({ kind: 'summon' });
                const list = Game.monsters.filter(m => !m.removed);
                for (const a of list) {
                    const b = list.find(o => o !== a && MONSTERS[o.type].grade === MONSTERS[a.type].grade && Game.mergePlanFor(a, o).kind !== 'none');
                    if (b) { Game.act({ kind: 'merge', src: a, dst: b }); break; }
                }
            }
            Game.update(GAME_TICK);
        }
        return { r: JSON.stringify(Game.challengeResult), record: JSON.parse(JSON.stringify(Game.record)), muts: Game.mutations.join(), zone: Game.zone };
    };
    const P = play();
    assert(P.record.inputs.length > 5, 'bot played: ' + P.r);
    const orig = Math.random;
    let x = 0.31;
    Math.random = () => { x = (x * 9301 + 0.49297) % 1; return x; };
    const R2 = replayChallenge(P.record);
    Math.random = orig;
    assert.strictEqual(JSON.stringify(R2), P.r, 'abyss replay gives the same result');
    assert.strictEqual(Game.mutations.join(), P.muts, 'same mutations');
    assert.strictEqual(Game.zone, P.zone, 'same zone');
}
Game.reset();

// ----- 주간 토벌전 -----
{
    const R1 = raidChallenge('2026-11-09');
    assert.strictEqual(JSON.stringify(R1), JSON.stringify(raidChallenge('2026-11-09')), 'same week, same raid');
    assert(BOSSES[R1.boss] && RAID_BOSSES[R1.boss], 'raid boss');
    assert(R1.relics.length === 2 && R1.cards.length === 2 && R1.cards.every(k => RULE_CARDS[k].kind === 'hard'), 'conditions');
    const weeks = new Set();
    for (let i = 0; i < 40; i++) weeks.add(raidChallenge('w' + i).boss);
    assert(weeks.size === Object.keys(RAID_BOSSES).length, 'every boss comes up');
    Game.reset(null, null, R1);
    assert.strictEqual(Game.waves[9].boss, R1.boss, 'weekly boss in the boss rounds');
    assert.strictEqual(Game.waves[19].boss, R1.boss);
    assert.strictEqual(WAVES[9].boss, 'archmage', 'the story table is untouched');
    assert.strictEqual(Game.raidBossMul(), 1);
    // 보스를 잡으면 단계가 오르고 다음 보스 체력이 2배
    Game.state = 'wave';
    const b1 = createHero(null, 9, 0, R1.boss, 'north');
    const hp1 = b1.maxHp;
    b1.waiting = false;
    Game.heroes.push(b1);
    const sBefore = Game.score;
    damageHero(b1, 100, 0, 0);
    assert(Game.score > sBefore, 'damage scores');
    damageHero(b1, 1e9, 0, 0);
    assert.strictEqual(Game.raidTier, 1, 'tier up');
    near(createHero(null, 9, 0, R1.boss, 'north').maxHp, hp1 * 2, 'next boss is twice as hard');
    // 과하게 때려도 남은 체력만큼만 점수가 오른다
    Game.heroes = [];
    const sc = () => { Game.score = 0; Game.raidTier = 1; const h = createHero(null, 0, 0, R1.boss, 'north'); h.waiting = false; Game.heroes.push(h); damageHero(h, h.hp * 1000, 0, 0); return Game.score; };
    assert.strictEqual(sc(), sc(), 'overkill capped');
    // 표에 없는 라운드도 보스가 이어진다
    Game.heroes = [];
    Game.state = 'wave';
    Game.waveIndex = 58;
    Game.roundTimer = 0;
    Game.nextRound();
    Game.heroes = [];
    Game.state = 'wave';
    Game.bossReward = null;
    Game.nextRound();
    Game.waves = Game.waves.slice(0, 62);
    while (Game.waves.length < 75) Game.waves.push(Game.roundFor(Game.waves.length + 1, buildRound(Game.waves.length + 1)));
    assert.strictEqual(Game.waves[69].boss, R1.boss, 'boss past the table');
    // 기록: 단계가 먼저, 같으면 점수, 주가 바뀌면 새로
    Meta.data.raid = { week: '', bestTier: 0, bestScore: 0 };
    assert(Meta.finishRaid('w1', { tier: 3, score: 100 }, { inputs: [] }).isBest);
    assert(!Meta.finishRaid('w1', { tier: 2, score: 9999 }, { inputs: [] }).isBest, 'lower tier');
    assert(Meta.finishRaid('w1', { tier: 3, score: 101 }, { inputs: [] }).isBest, 'same tier, more score');
    assert(Meta.finishRaid('w2', { tier: 1, score: 1 }, { inputs: [] }).isBest, 'new week');
    assert.strictEqual(JSON.stringify(Meta.sanitize({ version: META_VERSION, raid: { week: 'w', bestTier: 2, bestScore: 3 } }).raid), JSON.stringify({ week: 'w', bestTier: 2, bestScore: 3 }));
    // 다른 콘텐츠와 스토리에는 단계 배율과 피해 점수가 없다
    Game.reset(null, null, dailyChallenge('2026-11-07'));
    Game.raidTier = 5;
    assert.strictEqual(Game.raidBossMul(), 1);
    Game.scoreBossDamage(100);
    assert.strictEqual(Game.score, 0);
    // 입력 재생
    const play = () => {
        Game.reset(null, null, raidChallenge('w5'));
        Game.state = 'prep';
        let guard = 0;
        while (Game.inPlay() && guard++ < 60 * 60 * 120) {
            if (Game.bossReward) Game.act({ kind: 'pickReward', i: Game.bossReward.cards.findIndex(x => Game.canTakeReward(x)) });
            if (Game.tick % 20 === 0 && Game.waveIndex < 14) {
                if (!Game.fieldFull() && Game.canPaySummon()) Game.act({ kind: 'summon' });
                const list = Game.monsters.filter(m => !m.removed);
                for (const a of list) {
                    const b = list.find(o => o !== a && MONSTERS[o.type].grade === MONSTERS[a.type].grade && Game.mergePlanFor(a, o).kind !== 'none');
                    if (b) { Game.act({ kind: 'merge', src: a, dst: b }); break; }
                }
            }
            Game.update(GAME_TICK);
        }
        return { r: JSON.stringify(Game.challengeResult), record: JSON.parse(JSON.stringify(Game.record)) };
    };
    const P = play();
    assert(P.record.inputs.length > 5, 'bot played: ' + P.r);
    const orig = Math.random;
    let x = 0.31;
    Math.random = () => { x = (x * 9301 + 0.49297) % 1; return x; };
    const R2 = replayChallenge(P.record);
    Math.random = orig;
    assert.strictEqual(JSON.stringify(R2), P.r, 'raid replay gives the same result');
}
Game.reset();

// ----- 자동 합치기 -----
{
    Game.reset();
    Game.state = 'wave';
    const cells = () => [...BUILD_CELLS].map(k => k.split(',').map(Number)).filter(([c, r]) => Game.canPlace('orc_guard', c, r));
    const put = t => Game.place(t, ...cells()[0]);
    for (let i = 0; i < 3; i++) put('orc_guard');
    for (let i = 0; i < 3; i++) put('troll');
    assert.strictEqual(Game.autoMerge, false, 'off by default');
    Game.update(GAME_TICK * 2);
    assert.strictEqual(Game.monsters.length, 6, 'nothing merges when off');
    assert(Game.act({ kind: 'autoMerge', on: true }).ok);
    assert(Game.autoMergeStep().ok);
    assert.strictEqual(Game.monsters.filter(m => MONSTERS[m.type].grade === 'common').length, 0, 'lowest grade first');
    // S랭크는 재료로 쓰지 않는다
    Game.reset();
    Game.state = 'wave';
    const a = put('troll'), b = put('troll'), c2 = put('troll');
    setMonsterRank(a, 4);
    assert.strictEqual(Game.autoMergeStep().ok, false, 'S rank is kept');
    assert(!a.removed && !b.removed && !c2.removed);
    // 켜 두면 0.5초마다 저절로 합친다
    Game.reset();
    Game.state = 'wave';
    for (let i = 0; i < 3; i++) put('orc_guard');
    Game.act({ kind: 'autoMerge', on: true });
    for (let i = 0; i < AUTO_MERGE_TICKS + 1; i++) Game.update(GAME_TICK);
    assert.strictEqual(Game.monsters.length, 1, 'merged on its own');
    Game.reset();
    assert.strictEqual(Game.autoMerge, false, 'reset clears it');
    // 입력 재생
    Game.reset(null, null, dailyChallenge('2026-11-11'));
    Game.state = 'prep';
    Game.act({ kind: 'autoMerge', on: true });
    let guard = 0;
    while (Game.inPlay() && guard++ < 60 * 60 * 120) {
        if (Game.bossReward) Game.act({ kind: 'pickReward', i: Game.bossReward.cards.findIndex(x => Game.canTakeReward(x)) });
        if (Game.tick % 20 === 0 && Game.waveIndex < 12 && !Game.fieldFull() && Game.canPaySummon()) Game.act({ kind: 'summon' });
        Game.update(GAME_TICK);
    }
    const first = JSON.stringify(Game.challengeResult);
    assert(Game.stats.merged > 0, 'auto merge merged');
    const rec = JSON.parse(JSON.stringify(Game.record));
    const orig = Math.random;
    let x = 0.31;
    Math.random = () => { x = (x * 9301 + 0.49297) % 1; return x; };
    const again = replayChallenge(rec);
    Math.random = orig;
    assert.strictEqual(JSON.stringify(again), first, 'auto merge replays the same');
}
// ----- 마왕 패시브 -----
{
    for (const l of Object.values(DEMON_LORDS)) assert(l.passive && l.passive.name && l.passive.desc, l.id + ' passive');
    assert.strictEqual(new Set(Object.values(DEMON_LORDS).map(l => l.passive.kind)).size, 3, 'all different');
    const makeHero = t => { const h = createHero(t || 'warrior', 0, 0, null, 'north'); h.waiting = false; h.delay = 0; h.d = 200; h.hp = h.maxHp = 1e6; Game.heroes.push(h); return h; };
    const start = lord => { Game.reset(null, null, { kind: 'test', id: 't', seed: 's', lord, relics: [], cards: [], map: 'merge', zone: 'ember' }); Game.state = 'wave'; };
    // 균열의 군주: 번개에 맞으면 저주
    start('rift');
    let h = makeHero();
    const p = heroWorld(h);
    resolveStrike({ x: p.x, y: p.y });
    assert(h.curse > 0 && h.curseMul === DEMON_LORDS.rift.passive.takenMul, 'lightning curse');
    start('gold_king');
    h = makeHero();
    resolveStrike({ x: heroWorld(h).x, y: heroWorld(h).y });
    assert(!(h.curse > 0), 'only the rift lord');
    // 황금 마왕: 소환 강화 할인, 정예 처치 골드 2배
    assert.strictEqual(Game.summonUpgradeCost(), Math.round(SUMMON_LEVELS[1].cost * 0.75), 'upgrade discount');
    let e = createHero('elite_swordsman', 0, 0, null, 'north');
    e.waiting = false;
    Game.heroes.push(e);
    let g0 = Game.gold;
    Game.goldLeft = 0;
    damageHero(e, 1e9, 0, 0);
    const twice = Game.gold - g0;
    start('rift');
    e = createHero('elite_swordsman', 0, 0, null, 'north');
    e.waiting = false;
    Game.heroes.push(e);
    g0 = Game.gold;
    Game.goldLeft = 0;
    damageHero(e, 1e9, 0, 0);
    assert(twice > Game.gold - g0, 'elite gold doubled');
    assert.strictEqual(Game.summonUpgradeCost(), SUMMON_LEVELS[1].cost, 'no discount for others');
    // 뼈의 여왕: 25명마다 망령이 앞선 용사를 때린다
    start('bone_queen');
    const front = makeHero();
    Game.stats.kills = 24;
    const v = makeHero();
    v.hp = 1;
    damageHero(v, 10, 0, 0);
    assert.strictEqual(Game.stats.kills, 25);
    assert(front.hp < front.maxHp, 'soul volley hits');
    const hp1 = front.hp;
    const w2 = makeHero();
    w2.hp = 1;
    damageHero(w2, 10, 0, 0);
    assert.strictEqual(front.hp, hp1, 'only on the 25th');
    Game.heroes = [];
    Game.reset();
}
// 떼로 나오는 일반 용사
Game.reset();
Game.state = 'wave';
{
    const w = createHero('warrior', 0, 0, null, 'north');
    assert.strictEqual(w.bounty, HEROES.warrior.bounty * SWARM_RULES.bountyMul, 'small bounty');
    near(w.maxHp, HEROES.warrior.hp * SWARM_RULES.hpMul, 'small hp');
    assert.strictEqual(HEROES.warrior.scale, SWARM_RULES.scale, 'small picture');
    const e = createHero('elite_swordsman', 0, 0, null, 'north');
    assert.strictEqual(e.throneDamage, HEROES.elite_swordsman.throneDamage, 'elites stay whole');
    assert(HEROES.elite_swordsman.anim.walk.footPx.south > ASTERIA_HERO_SKINS.warrior[0].anim.walk.footPx.south, 'elites stay bigger than the swarm');
    // 왕좌 피해와 골드는 모아서: 일반 용사 3명이 도착하면 약 1 깎인다
    const hp0 = Game.hp;
    for (let i = 0; i < 3; i++) {
        const h = createHero('warrior', 0, 0, null, 'north');
        h.waiting = false;
        h.delay = 0;
        h.d = ROUTES.north.length;
        Game.heroes.push(h);
        updateHero(h, GAME_TICK);
    }
    assert.strictEqual(Game.hp, hp0 - 1, 'three leaks cost one hp');
    Game.heroes = [];
    const g0 = Game.gold;
    for (let i = 0; i < 3; i++) {
        const h = createHero('rogue', 0, 0, null, 'north');
        h.waiting = false;
        Game.heroes.push(h);
        damageHero(h, 1e6, 0, 0);
    }
    assert.strictEqual(Game.gold, g0 + 2, 'gold adds up: 2 x 0.35 x 3 = 2.1');
    // 인원은 라운드가 늘수록 많고 상한에서 멈춘다
    const cnt = r => Object.values(buildRound(r).members).reduce((a, b) => a + b, 0);
    assert(cnt(1) >= 24 && cnt(60) > cnt(10), 'many heroes');
    assert(cnt(500) <= ENDLESS_RULES.maxCount + 2, 'capped');
}
Game.reset();
console.log('smoke ok: seeded runs and daily challenge');
}`, ctx, { filename: 'smoke-daily' });

// ----- 마왕 권능 나무와 마력 -----
vm.runInContext(`{
const fresh = (mana) => { Game.reset({ lord: 'rift', relics: [] }); Game.mana = mana; };
// 효과 시험은 지도와 상관없이 항목을 켠다. 찍기 규칙은 아래에서 따로 본다
const buy = (...ids) => { for (const id of ids) Game.powers[id] = true; };
// 표: 3갈래, 4겹, 겹마다 2개, 겹치지 않는 id
const branches = LORD_POWERS.rift;
assert.strictEqual(branches.length, 3);
const ids = branches.flatMap(b => b.tiers.flat().map(n => n.id));
assert.strictEqual(ids.length, 24);
assert.strictEqual(new Set(ids).size, 24, 'node ids are unique');
for (const b of branches) { assert.strictEqual(b.tiers.length, POWER_RULES.tierCost.length); for (const t of b.tiers) assert.strictEqual(t.length, 2); }
// 지도: 같은 시드는 같고 시드가 다르면 달라지며, 어떤 시드든 모든 항목에 닿을 수 있고 왕좌와 이어진 곳이 있다
const mapText = seed => JSON.stringify(buildPowerMap('rift', seed));
assert.strictEqual(mapText('a'), mapText('a'), 'same seed, same map');
const shapes = new Set();
for (let i = 0; i < 40; i++) {
    const map = buildPowerMap('rift', 'seed' + i);
    shapes.add(JSON.stringify(map.edges));
    assert.strictEqual(map.nodes.length, 24);
    const seen = new Set(['core']);
    for (let grew = true; grew;) {
        grew = false;
        for (const [a, b] of map.edges) {
            if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
        }
    }
    assert.strictEqual(seen.size, 25, 'every node is reachable');
    for (const n of map.nodes) assert(Math.abs(n.x) < 1.1 && Math.abs(n.y) < 1.1, 'node inside the map');
}
assert(shapes.size > 20, 'maps differ by seed: ' + shapes.size);
assert.strictEqual(buildPowerMap('nobody', 'a').nodes.length, 0, 'lord without powers');
// 지도를 만들어도 판의 난수는 그대로다
Rng.start('x');
const r0 = rng('summon');
Rng.start('x');
buildPowerMap('rift', 'y');
assert.strictEqual(rng('summon'), r0, 'map uses its own numbers');
Rng.stop();
// 도전은 시드가 같으면 지도가 같다
{
    const C = dailyChallenge('2026-11-07');
    Game.reset(null, null, C);
    const A = Game.powerSeed;
    Game.reset(null, null, C);
    assert.strictEqual(Game.powerSeed, A, 'challenge map is fixed');
    assert.strictEqual(A, String(C.seed));
}
// 찍기 규칙: 이어진 곳, 비용, 맨 끝 택1, 개수 상한, 없는 항목
fresh(0);
assert.strictEqual(Game.powerCheck('nope').reason, 'none');
{
    const map = Game.powerMap();
    const next = (from) => map.edges.filter(e => e.includes(from)).map(e => (e[0] === from ? e[1] : e[0])).filter(x => x !== 'core');
    const start = map.edges.find(e => e[0] === 'core')[1];
    assert.strictEqual(Game.powerCheck(start).reason, 'mana', 'linked to the throne but no mana');
    const far = map.nodes.find(n => n.tier === 3);
    assert.strictEqual(Game.powerCheck(far.id).reason, 'locked', 'far node is not linked');
    Game.mana = 100;
    assert(Game.act({ kind: 'power', id: start }).ok);
    assert.strictEqual(Game.mana, 100 - POWER_RULES.tierCost[map.nodes.find(n => n.id === start).tier], 'cost by ring');
    assert.strictEqual(Game.powerCheck(start).reason, 'owned');
    const up = next(start).find(id => map.nodes.find(n => n.id === id).tier === 1);
    assert(up && Game.powerCheck(up).ok, 'owning a node opens its links');
    // 한 겹에서 하나만
    fresh(100);
    const br = branches[0];
    Game.powers[br.tiers[0][0].id] = true;
    assert.strictEqual(Game.powerCheck(br.tiers[0][1].id).reason, 'tier', 'one per tier');
    // 한 판에 한 갈래만
    assert.strictEqual(Game.powerCheck(branches[1].tiers[0][0].id).reason, 'branch', 'one branch per run');
    for (const b of buildPowerMap('rift', 'x').edges) {
        const tierOf = id => (id === 'core' ? -1 : Game.powerNode(id).tier);
        const brOf = id => (id === 'core' ? null : Game.powerNode(id).branch);
        assert(b.includes('core') || brOf(b[0]) === brOf(b[1]), 'no bridges between branches');
        assert(Math.abs(tierOf(b[0]) - tierOf(b[1])) <= 1);
    }
    // 4개를 찍으면 갈래가 끝난다
    fresh(100);
    const pathIds = [];
    for (let t = 0; t < 4; t++) {
        const next = Game.powerMap().nodes.find(n => Game.powerCheck(n.id).ok);
        assert(next, 'a node is open at tier ' + t);
        Game.act({ kind: 'power', id: next.id });
        pathIds.push(next.id);
    }
    assert.strictEqual(Game.powerCount(), 4);
    assert(!Game.powerReady(), 'nothing to buy after a full branch');
    assert(new Set(pathIds.map(id => Game.powerNode(id).branch.id)).size === 1, 'all from one branch');
}
// 수치 효과
fresh(100);
const dmg = Game.lightningDamage();
const cd = Game.skillCooldown('lightning');
const roarCd = Game.skillCooldown('roar');
buy('wide', 'focus', 'quick', 'roarDrill');
assert.strictEqual(Game.lightningRadius(), COMBAT_RULES.lightning.radius + 0.5);
assert(Math.abs(Game.lightningDamage() - dmg * 1.3) < 1e-9, 'focus');
assert(Math.abs(Game.skillCooldown('lightning') - cd * 0.85) < 1e-9, 'quick');
assert(Math.abs(Game.skillCooldown('roar') - roarCd * 0.7) < 1e-9, 'roarDrill');
// 번개 시험 준비: 용사 하나를 정해진 자리에 세운다
const arena = () => {
    Game.state = 'prep'; Game.startWave();
    const list = Game.heroes.filter(h => !h.boss && !h.elite);
    Game.heroes = list.slice(0, 6);
    Game.heroes.forEach((h, i) => { h.waiting = false; h.hp = h.maxHp = 1e6; h.armor = 0; h.lane = 0; h.route = 'north'; h.d = 1000 + i * 480; });
    return Game.heroes;
};
const strikeAt = (h, extra) => { const p = heroWorld(h); resolveStrike(Object.assign({ x: p.x, y: p.y, t: 0 }, extra)); };
// 폭풍
fresh(100); buy('focus', 'static'); let hs = arena();
let hp = hs[0].hp; strikeAt(hs[0]);
assert(Math.abs(hp - hs[0].hp - Game.lightningDamage()) < 1e-6, 'strike hits');
assert(hs[0].slow > 0 && hs[0].slowMul === 0.7, 'static slows');
assert(hs[5].hp === hs[5].maxHp, 'far hero untouched without chain');
fresh(100); hs = arena(); strikeAt(hs[0]); const baseCurse = hs[0].curse;
fresh(100); buy('wide', 'markLong'); hs = arena(); strikeAt(hs[0]);
assert.strictEqual(hs[0].curse, baseCurse + 3, 'markLong');
fresh(100); buy('wide', 'static', 'chain'); hs = arena(); strikeAt(hs[0]);
assert.strictEqual(hs.filter(h => h.hp < h.maxHp).length, 4, 'chain hits three more');
fresh(100); buy('wide', 'static', 'echo'); hs = arena(); strikeAt(hs[0]);
assert.strictEqual(Game.pendingStrikes.length, 1, 'echo queued');
assert.strictEqual(Game.pendingStrikes[0].mul, 0.5);
hp = hs[0].hp; resolveStrike(Game.pendingStrikes[0]);
assert(Math.abs(hp - hs[0].hp - Game.lightningDamage() * 0.5 * hs[0].curseMul) < 1e-6, 'echo half damage');
assert.strictEqual(Game.pendingStrikes.length, 1, 'echo makes no new echo');
fresh(100); buy('wide', 'static', 'echo', 'smite'); hs = arena(); hs[0].elite = true;
hp = hs[0].hp; strikeAt(hs[0]);
assert(hp - hs[0].hp > Game.lightningDamage() * 1.9, 'smite doubles on elite');
fresh(100); buy('wide', 'static', 'echo', 'auto'); hs = arena();
Game.skills.lightning = 0; Game.update(GAME_TICK);
assert(Game.skills.lightning > 0 && Game.pendingStrikes.length === 1, 'auto casts by itself');
// 균열
fresh(100); buy('tear'); hs = arena(); strikeAt(hs[0]);
assert(hs[0].stun >= 1 && hs[0].stun < 2 && hs[0].d === 1000, 'tear stuns without moving');
fresh(100); buy('tear', 'pull'); hs = arena(); strikeAt(hs[0]);
assert.strictEqual(hs[0].d, 1000 - 2 * TILE, 'pull');
fresh(100); buy('tear', 'pull', 'longTear', 'exile'); hs = arena(); strikeAt(hs[0]);
assert.strictEqual(hs[0].stun, 2, 'longTear');
assert.strictEqual(hs[0].d, 1000 - 4 * TILE, 'exile doubles pull');
fresh(100); buy('tear', 'pull', 'longTear', 'abyss'); hs = arena(); strikeAt(hs[0]);
assert(hs[0].curse === 5 && hs[0].curseMul === 1.4, 'abyss');
// 왕좌 결계와 문전박대
fresh(100); buy('ward'); hs = arena(); hs[0].d = ROUTES[hs[0].route].length; Game.leak = 0;
updateHero(hs[0], GAME_TICK);
assert(hs[0].dead && Math.abs(Game.leak - hs[0].throneDamage * 0.8) < 1e-9, 'ward');
fresh(100); buy('ward', 'turnback'); hs = arena();
for (let i = 0; i < 5; i++) { hs[i].d = ROUTES[hs[i].route].length; updateHero(hs[i], GAME_TICK); }
assert(hs[4].d < 100 && !hs[4].dead, 'fifth arrival goes back to the gate');
assert(hs[0].dead && hs[3].dead, 'others still arrive');
// 균열 열기
fresh(100);
assert(!Game.act({ kind: 'portal' }).ok, 'gate needs the node');
buy('tear', 'pull', 'gate');
assert(!Game.act({ kind: 'portal' }).ok, 'gate needs heroes');
hs = arena();
const near = hs[5].d, far = hs[0].d;
assert(Game.act({ kind: 'portal' }).ok);
assert.strictEqual(hs[5].d, near - COMBAT_RULES.portal.back * TILE, 'nearest pushed back');
assert.strictEqual(Game.skills.portal, Game.skillCooldown('portal'));
assert(!Game.act({ kind: 'portal' }).ok, 'gate on cooldown');
assert(far >= 0);
// 과부하
const killOne = (h) => { h.hp = 1; damageHero(h, 10, 0, 0); assert(h.dead, 'killed'); };
fresh(100); buy('quick', 'killCharge'); hs = arena(); Game.skills.lightning = 10; killOne(hs[0]);
assert(Math.abs(Game.skills.lightning - 9.9) < 1e-9, 'killCharge');
fresh(100); buy('quick', 'killCharge', 'circuit', 'frenzy'); hs = arena(); Game.skills.lightning = 10; killOne(hs[0]);
assert(Math.abs(Game.skills.lightning - 9.7) < 1e-9, 'frenzy charges more');
Game.hp = 1;
assert(Game.roarLocked(), 'frenzy locks roar');
fresh(100); buy('quick', 'killCharge', 'eliteCharge'); hs = arena(); hs[0].elite = true; Game.skills.lightning = 10; killOne(hs[0]);
assert.strictEqual(Game.skills.lightning, 0, 'eliteCharge');
fresh(100); buy('quick', 'killCharge', 'circuit', 'rally'); arena(); Game.hp = 1; Game.skills.lightning = 10;
assert(Game.act({ kind: 'roar' }).ok);
assert.strictEqual(Game.skills.lightning, 0, 'rally');
fresh(100); buy('quick', 'sacCharge'); Game.gold = 9999; Game.state = 'prep';
const sac = Game.place('orc_guard', 3, 6);
assert(sac, 'placed a sacrifice');
const sacGain = Game.sacrificeGain(sac);
Game.skills.lightning = 100;
assert(Game.sacrifice(sac).ok);
assert(Math.abs(Game.skills.lightning - (100 - sacGain.lightning * 2)) < 1e-9, 'sacCharge');
// 모든 마왕: 3갈래 4겹 2개, 항목 id와 효과 키가 맞고, 3번째 스킬은 표에 있다
{
    const all = [];
    for (const lord of Object.keys(DEMON_LORDS)) {
        const list = LORD_POWERS[lord];
        assert(list && list.length === 3, lord + ' has three branches');
        for (const b of list) {
            assert.strictEqual(b.tiers.length, 4);
            for (const t of b.tiers) { assert.strictEqual(t.length, 2); for (const n of t) { all.push(n.id); for (const k of Object.keys(n.mods || {})) assert(LORD_EFFECTS[k], 'effect key ' + k); } }
        }
        assert.strictEqual(buildPowerMap(lord, 'a').nodes.length, 24);
    }
    assert.strictEqual(new Set(all).size, 72, 'node ids are unique across lords');
    for (const [id, sk] of Object.entries(POWER_SKILLS)) { assert(all.includes(id), id); assert(COMBAT_RULES[sk.key].cooldown > 0, sk.key); }
}
// 다른 마왕의 항목은 찍을 수 없고, 권능이 없는 마왕은 마력을 모으지 않는다
fresh(100);
assert.strictEqual(Game.powerCheck('volleyFast').reason, 'none');
Game.lord = 'nobody';
Game.addMana(3);
assert.strictEqual(Game.mana, 100);
const lordFresh = (lord, mana) => { Game.reset({ lord: 'rift', relics: [] }); Game.lord = lord; Game.mods = buildMods(lord, []); Game.mana = mana; };
const takeNode = id => { assert(Game.powerNode(id), 'node ' + id); Game.powers[id] = true; Game.addNodeMods(Game.powerNode(id).node); };
const volleyTargets = (hs) => hs.filter(h => h.hp < h.maxHp).length;
// 뼈의 여왕: 망령
lordFresh('bone_queen', 0); hs = arena(); Game.soulVolley(true);
assert.strictEqual(volleyTargets(hs), 6, 'volley base count');
const volleyBase = hs[5].maxHp - hs[5].hp;
Game.stats.kills = 20;
hs.forEach(h => { h.hp = h.maxHp; }); Game.soulVolley();
assert.strictEqual(volleyTargets(hs), 0, 'no volley at 20 without volleyFast');
lordFresh('bone_queen', 0); takeNode('volleyFast'); hs = arena(); Game.stats.kills = 20; Game.soulVolley();
assert.strictEqual(volleyTargets(hs), 6, 'volleyFast');
lordFresh('bone_queen', 0); takeNode('volleyHeavy'); hs = arena(); Game.soulVolley(true);
assert(Math.abs((hs[5].maxHp - hs[5].hp) - volleyBase * 1.5) < 1e-6, 'volleyHeavy');
lordFresh('bone_queen', 0); takeNode('volleyCurse'); takeNode('volleyFear'); hs = arena(); Game.soulVolley(true);
assert(hs[5].curse === 3 && hs[5].curseMul === 1.2 && hs[5].stun === 1.5, 'volleyCurse and volleyFear');
lordFresh('bone_queen', 0); takeNode('volleyTwin'); hs = arena(); Game.soulVolley(true);
assert(Math.abs((hs[5].maxHp - hs[5].hp) - volleyBase * 2) < 1e-6, 'volleyTwin');
lordFresh('bone_queen', 0); takeNode('volleyCharge'); hs = arena(); Game.skills.lightning = 10; Game.soulVolley(true);
assert.strictEqual(Game.skills.lightning, 7, 'volleyCharge');
lordFresh('bone_queen', 0); takeNode('volleyBoss'); hs = arena(); hs[0].elite = true; Game.soulVolley(true);
assert(hs[0].hp < hs[0].maxHp, 'volleyBoss aims at the farthest elite');
lordFresh('bone_queen', 0); takeNode('volleyWide'); hs = arena();
for (let i = 0; i < 4; i++) { const extra = Game.heroes[0]; Game.heroes.push(Object.assign({}, extra, { d: 100 + i })); }
Game.soulVolley(true);
assert.strictEqual(Game.heroes.filter(h => h.hp < h.maxHp).length, 9, 'volleyWide');
// 뼈의 여왕: 시체
const blast = (id2) => { lordFresh('bone_queen', 0); takeNode('corpseBlast'); if (id2) takeNode(id2); const list = arena(); list[1].d = list[0].d + 30; return list; };
hs = blast(); for (let i = 0; i < 4; i++) { hs[0].hp = 1; damageHero(Object.assign(hs[0], { dead: false }), 10, 0, 0); hs[0].dead = false; hs[0].hp = hs[0].maxHp; }
assert.strictEqual(hs[1].hp, hs[1].maxHp, 'no blast before the fifth');
hs[0].hp = 1; damageHero(hs[0], 10, 0, 0);
assert(hs[1].hp < hs[1].maxHp, 'corpseBlast on the fifth');
hs = blast('corpseQuick'); for (let i = 0; i < 2; i++) { hs[0].hp = 1; damageHero(hs[0], 10, 0, 0); hs[0].dead = false; hs[0].hp = hs[0].maxHp; }
hs[0].hp = 1; damageHero(hs[0], 10, 0, 0);
assert(hs[1].hp < hs[1].maxHp, 'corpseQuick on the third');
hs = blast('corpseFrost'); Game.corpseCount = 4; hs[0].hp = 1; damageHero(hs[0], 10, 0, 0);
assert(hs[1].slow > 0, 'corpseFrost');
hs = blast('corpseBig'); hs[2].d = hs[0].d + 200; Game.corpseCount = 4; hs[0].hp = 1; damageHero(hs[0], 10, 0, 0);
assert(hs[2].hp < hs[2].maxHp, 'corpseBig reaches further');
lordFresh('bone_queen', 0); takeNode('raise');
assert(!Game.act({ kind: 'raise' }).ok, 'raise needs graves');
hs = arena(); hs[1].d = hs[0].d + 20; hs[0].hp = 1; damageHero(hs[0], 10, 0, 0);
assert.strictEqual(hs[1].hp, hs[1].maxHp);
assert(Game.act({ kind: 'raise' }).ok);
assert(hs[1].hp < hs[1].maxHp && Game.graves.length === 0, 'raise explodes graves');
assert.strictEqual(Game.skills.raise, Game.skillCooldown('raise'));
const raiseCd = Game.skillCooldown('raise');
takeNode('raiseFast');
assert(Math.abs(Game.skillCooldown('raise') - raiseCd * 0.6) < 1e-9, 'raiseFast');
assert.strictEqual(Game.thirdSkill().key, 'raise');
lordFresh('bone_queen', 0); const xp0 = Game.mods.xp, dmg0 = Game.mods.damage; takeNode('xpUp'); takeNode('boneEdge');
assert(Math.abs(Game.mods.xp - xp0 - 0.3) < 1e-9 && Math.abs(Game.mods.damage - dmg0 - 0.08) < 1e-9, 'bone mods');
// 뼈의 여왕: 제물
const offer = (...nodes) => { lordFresh('bone_queen', 0); nodes.forEach(takeNode); Game.gold = 9999; Game.state = 'prep'; const a = Game.place('orc_guard', 3, 6); const b = Game.place('orc_guard', 7, 4); assert(a && b, 'placed'); return { a, b }; };
let pair = offer('sacRage'); assert(Game.sacrifice(pair.a).ok);
assert(pair.b.buffT === 8 && pair.b.buff.speed === 0.25, 'sacRage');
pair = offer('sacMana'); Game.sacrifice(pair.a); assert.strictEqual(Game.mana, 1, 'sacMana');
pair = offer('sacGold'); { const g = Game.gold, cost = Game.summonCost(); Game.sacrifice(pair.a); assert.strictEqual(Game.gold, g + cost * 2, 'sacGold'); }
pair = offer('sacRoar'); Game.skills.roar = 30; Game.sacrifice(pair.a); assert.strictEqual(Game.skills.roar, 0, 'sacRoar');
pair = offer('sacSoul'); hs = arena(); Game.sacrifice(pair.a); assert(hs[5].hp < hs[5].maxHp, 'sacSoul fires the volley');
lordFresh('bone_queen', 0); { const a = Game.mods.sacrifice, b = Game.mods.refund, d = Game.mods.altarDamage; takeNode('sacBoost'); takeNode('sacSell'); takeNode('altar'); assert(Game.mods.sacrifice === a * 1.5 && Game.mods.refund === b * 1.3 && Game.mods.altarDamage === d + 0.02, 'offering mods'); }
// 황금 마왕: 투자
lordFresh('gold_king', 0); { const m = Object.assign({}, Game.mods); ['interestUp', 'bountyUp', 'summonCheap', 'sellUp', 'goldEdge', 'twin'].forEach(takeNode);
    assert(Math.abs(Game.mods.interest - m.interest - 0.03) < 1e-9 && Math.abs(Game.mods.bounty - m.bounty * 1.2) < 1e-9 && Game.mods.summonBase === m.summonBase - 5 && Math.abs(Game.mods.refund - m.refund * 1.3) < 1e-9 && Game.mods.goldDamage === m.goldDamage + 0.01 && Game.mods.twinSummon === m.twinSummon + 0.08, 'invest mods'); }
lordFresh('gold_king', 0); takeNode('interestUp'); Game.gold = 100000; { const g = Game.gold; Game.payInterest(); assert.strictEqual(Game.gold, g + RELIC_LIMITS.interestMax, 'interest cap'); }
takeNode('compound'); { const g = Game.gold; Game.payInterest(); assert.strictEqual(Game.gold, g + RELIC_LIMITS.interestMax * 2, 'compound'); }
lordFresh('gold_king', 0); takeNode('goldMana'); Game.gold = 500; Game.state = 'prep'; Game.startWave(); Game.heroes = []; Game.endWave();
assert.strictEqual(Game.mana, POWER_RULES.manaCleanRound + 1, 'goldMana');
// 황금 마왕: 매수
lordFresh('gold_king', 0); takeNode('goldWard'); hs = arena(); hs[0].d = ROUTES[hs[0].route].length; Game.leak = 0; updateHero(hs[0], GAME_TICK);
assert(Math.abs(Game.leak - hs[0].throneDamage * 0.8) < 1e-9, 'goldWard');
lordFresh('gold_king', 0); { const m = Object.assign({}, Game.mods); ['dropUp', 'heroSlow', 'contract'].forEach(takeNode); assert(Math.abs(Game.mods.eliteDrop - m.eliteDrop - 0.1) < 1e-9 && Math.abs(Game.mods.heroSpeed - m.heroSpeed * 0.93) < 1e-9 && Game.mods.roarAnytime, 'bribe mods'); assert(!Game.roarLocked(), 'contract unlocks roar'); }
lordFresh('gold_king', 0); takeNode('longRoar'); takeNode('traitor'); Game.hp = 1; hs = arena(); assert(Game.act({ kind: 'roar' }).ok);
assert(hs[0].stun === COMBAT_RULES.roar.duration + 1 && hs[0].curseMul === 1.3, 'longRoar and traitor');
lordFresh('gold_king', 0); takeNode('bribeRoar'); hs = arena(); Game.hp = Game.maxHp(); Game.gold = 100;
assert(!Game.roarLocked(), 'bribeRoar has no hp condition');
assert(!Game.act({ kind: 'roar' }).ok, 'bribeRoar needs gold');
Game.gold = 1000; assert(Game.act({ kind: 'roar' }).ok);
assert(Game.gold === 700 && Game.skills.roar === COMBAT_RULES.bribeRoar.cooldown, 'bribeRoar pays gold');
takeNode('bribeCheap'); Game.skills.roar = 0; assert(Game.act({ kind: 'roar' }).ok); assert.strictEqual(Game.gold, 550, 'bribeCheap');
// 황금 마왕: 금화 폭격
lordFresh('gold_king', 0); { const d = Game.lightningDamage(), cd2 = Game.skillCooldown('lightning'); takeNode('goldFocus'); takeNode('coinCool'); takeNode('coinWide');
    assert(Math.abs(Game.lightningDamage() - d * 1.25) < 1e-9 && Math.abs(Game.skillCooldown('lightning') - cd2 * 0.85) < 1e-9 && Game.lightningRadius() === COMBAT_RULES.lightning.radius + 0.5, 'bomb number nodes'); }
lordFresh('gold_king', 0); takeNode('coinRain'); hs = arena(); hs[1].d = hs[0].d + 30; Game.gold = 0; strikeAt(hs[0]); assert.strictEqual(Game.gold, 2, 'coinRain');
lordFresh('gold_king', 0); hs = arena(); hs[0].hp = 1; hs[0].bounty = 10; Game.gold = 0; Game.goldLeft = 0; strikeAt(hs[0]); { const plain = Game.gold;
    lordFresh('gold_king', 0); takeNode('coinLoot'); hs = arena(); hs[0].hp = 1; hs[0].bounty = 10; Game.gold = 0; Game.goldLeft = 0; strikeAt(hs[0]); assert.strictEqual(Game.gold, plain * 2, 'coinLoot'); }
lordFresh('gold_king', 0); takeNode('goldBomb'); Game.gold = 10;
assert(!Game.act({ kind: 'goldBomb' }).ok, 'goldBomb needs heroes and gold');
hs = arena(); assert(!Game.act({ kind: 'goldBomb' }).ok, 'goldBomb needs gold');
Game.gold = 1000; assert(Game.act({ kind: 'goldBomb' }).ok);
assert(Game.gold === 900 && hs[5].maxHp - hs[5].hp === 100 * COMBAT_RULES.goldBomb.damagePerGold, 'goldBomb spends and hits the front');
assert.strictEqual(hs[0].hp, hs[0].maxHp, 'bomb stays around the front');
assert.strictEqual(Game.thirdSkill().key, 'goldBomb');
lordFresh('gold_king', 0); takeNode('goldBomb'); takeNode('bombRich'); takeNode('bombBig'); hs = arena(); hs[3].d = hs[5].d - 380; Game.gold = 1000; assert(Game.act({ kind: 'goldBomb' }).ok);
assert(Game.gold === 800 && hs[5].maxHp - hs[5].hp === 200 * COMBAT_RULES.goldBomb.damagePerGold * 2, 'bombRich');
assert(hs[3].hp < hs[3].maxHp, 'bombBig reaches further');
// 효과표를 다시 만들어도 찍은 항목이 남는다
lordFresh('gold_king', 0); takeNode('summonCheap'); { const before = Game.mods.summonBase; Game.mods = buildMods('gold_king', []); Game.applyPowerMods(); assert.strictEqual(Game.mods.summonBase, before, 'applyPowerMods'); }
// 왕좌가 맞지 않은 라운드만 마력을 주고, 마력 회로는 하나 더 준다
Game.reset({ lord: 'rift', relics: [] });
Game.state = 'prep'; Game.startWave();
Game.heroes = [];
Game.endWave();
assert.strictEqual(Game.mana, POWER_RULES.manaCleanRound, 'clean round');
Game.state = 'prep'; Game.startWave();
damageThrone(1);
Game.heroes = [];
Game.endWave();
assert.strictEqual(Game.mana, POWER_RULES.manaCleanRound, 'hit round gives nothing');
fresh(0); Game.powers.circuit = true;
Game.state = 'prep'; Game.startWave();
Game.heroes = [];
Game.endWave();
assert.strictEqual(Game.mana, POWER_RULES.manaCleanRound + 1, 'circuit');
// 권능을 찍고 쓴 판도 입력 재생 결과가 같다(번 마력으로만 찍는다). 마왕마다 그 마왕으로 정해지는 날을 고른다
for (const lord of Object.keys(DEMON_LORDS)) {
    let date = null;
    for (let d = 1; d <= 60 && !date; d++) {
        const text = '2026-' + String(9 + Math.floor((d - 1) / 28)).padStart(2, '0') + '-' + String((d - 1) % 28 + 1).padStart(2, '0');
        if (dailyChallenge(text).lord === lord) date = text;
    }
    assert(date, 'a day for ' + lord);
    Game.reset(null, null, dailyChallenge(date));
    Game.state = 'prep';
    assert.strictEqual(Game.lord, lord);
    // 3번째 스킬이 든 갈래부터 찍는다
    const thirdId = Object.keys(POWER_SKILLS).find(k => Game.powerNode(k));
    // 새 스킬까지 가장 짧은 길의 다음 항목. 새 스킬을 찍은 뒤에는 찍을 수 있는 아무 항목
    const stepTo = target => {
        const edges = Game.powerMap().edges;
        const seen = new Set(['core', ...Object.keys(Game.powers)]);
        const queue = [...seen].map(id => ({ id, first: null }));
        while (queue.length) {
            const q = queue.shift();
            if (q.id === target) return q.first;
            for (const [a, b] of edges) {
                const to = a === q.id ? b : (b === q.id ? a : null);
                // 갈래 안에서 바깥 겹으로만 나아간다(겹마다 하나라 옆 칸으로는 못 간다)
                const tier = id => (id === 'core' ? -1 : Game.powerNode(id).tier);
                if (to && !seen.has(to) && tier(to) === tier(q.id) + 1) { seen.add(to); queue.push({ id: to, first: q.first || to }); }
            }
        }
        return null;
    };
    let guard = 0;
    while (Game.inPlay() && guard++ < 60 * 60 * 120) {
        if (Game.bossReward) Game.act({ kind: 'pickReward', i: Game.bossReward.cards.findIndex(x => Game.canTakeReward(x)) });
        if (Game.tick % 20 === 0 && Game.waveIndex < 14) {
            if (!Game.fieldFull() && Game.canPaySummon()) Game.act({ kind: 'summon' });
            const ms = Game.monsters.filter(m => !m.removed);
            for (const a of ms) {
                const b = ms.find(o => o !== a && MONSTERS[o.type].grade === MONSTERS[a.type].grade && Game.mergePlanFor(a, o));
                if (b) { Game.act({ kind: 'merge', src: a, dst: b }); break; }
            }
        }
        const wanted = Game.power(thirdId) ? (Game.powerMap().nodes.find(n => Game.powerCheck(n.id).ok) || {}).id : stepTo(thirdId);
        if (wanted && Game.powerCheck(wanted).ok) Game.act({ kind: 'power', id: wanted });
        if (Game.tick % 300 === 0 && Game.state === 'wave' && !Game.power('auto')) Game.act({ kind: 'lightning', x: 700, y: 500 });
        if (Game.tick % 400 === 0 && Game.thirdSkill()) Game.act({ kind: Game.thirdSkill().key });
        Game.update(GAME_TICK);
    }
    const record = JSON.parse(JSON.stringify(Game.record));
    const result = Game.challengeResult;
    const built = Object.assign({}, Game.powers);
    const buys = record.inputs.filter(x => x.kind === 'power').length;
    assert(result && buys >= 4, lord + ' bot earned mana and bought powers: ' + buys);
    const skillKey = POWER_SKILLS[thirdId].key;
    const uses = record.inputs.filter(i => i.kind === skillKey).length;
    assert(built[thirdId] && uses > 0, lord + ' bot reached its new skill');
    const orig = Math.random;
    let x = 0.321;
    Math.random = () => { x = (x * 9301 + 0.49297) % 1; return x; };
    const R = replayChallenge(record);
    Math.random = orig;
    assert.strictEqual(JSON.stringify(R), JSON.stringify(result), lord + ' replay with powers gives the same result');
    assert.strictEqual(JSON.stringify(Game.powers), JSON.stringify(built), lord + ' replay builds the same powers');
    console.log('smoke power replay: ' + lord + ' ' + date + ' buys ' + buys + ' uses ' + uses + ' ' + Object.keys(built).join(',') + ' score ' + result.score);
}
Game.reset();
console.log('smoke ok: lord powers');
}`, ctx, { filename: 'smoke-powers' });

// ----- 장비 조합 -----
vm.runInContext(`{
useEquip(REAL_EQUIP.table, REAL_EQUIP.rules, REAL_EQUIP.recipes);
assert.strictEqual(EQUIP_BASES.length, 6);
assert.strictEqual(EQUIP_RECIPES.length, 21);
const made = new Set(EQUIP_RECIPES.map(r => r[2]));
assert.strictEqual(made.size, 21, 'each pair makes its own item');
for (const a of EQUIP_BASES) for (const b of EQUIP_BASES) { const r = craftResult(a, b); assert(r && EQUIPMENT[r], a + '+' + b); assert.strictEqual(r, craftResult(b, a)); assert(EQUIPMENT[r].grade !== 'common', r); }
assert.strictEqual(Object.keys(EQUIPMENT).filter(id => EQUIPMENT[id].grade === 'common').length, 6, 'only materials are common');
assert.strictEqual(craftResult('axe', 'sword'), null, 'crafted items do not craft');
for (const id of Object.keys(EQUIPMENT)) assert(equipEffectText(id).length > 0, id + ' has text');
// 몬스터 위에서 조합: 재료 + 재료
Game.reset({ lord: 'rift', relics: [] }); Game.state = 'prep'; Game.gold = 9999;
const m = Game.place('orc_guard', 3, 6);
Game.equipBag = ['sword', 'ring', 'axe', 'bow'];
assert(Game.act({ kind: 'equip', monster: m, i: 0 }).ok && m.equip === 'sword', 'fit a material');
const res = Game.act({ kind: 'equip', monster: m, i: 0 });
assert(res.ok && res.crafted && m.equip === 'gauntlet', 'material on material crafts');
assert.strictEqual(JSON.stringify(Game.equipBag), JSON.stringify(['axe', 'bow']), 'used material leaves the bag');
// 완성 장비는 맞바꾼다
const swap = Game.act({ kind: 'equip', monster: m, i: 1 });
assert(swap.ok && !swap.crafted && swap.swapped === 'gauntlet' && m.equip === 'bow', 'crafted item swaps');
// 보관함에서 조합
Game.equipBag = ['bow', 'axe', 'boots'];
assert(!Game.act({ kind: 'craft', a: 0, b: 1 }).ok, 'crafted item is not a material');
assert(!Game.act({ kind: 'craft', a: 0, b: 0 }).ok, 'same slot');
assert(Game.act({ kind: 'craft', a: 2, b: 0 }).ok);
assert.strictEqual(JSON.stringify(Game.equipBag), JSON.stringify(['windBoots', 'axe']), 'bag craft');
// 효과: 정예 피해, 처치 골드, 적중 효과
Game.state = 'prep'; Game.startWave();
const hero = Game.heroes.find(h => !h.boss);
hero.waiting = false; hero.armor = 0; hero.hp = hero.maxHp = 1e6;
hero.elite = true;
damageHero(hero, 100, 0, 0, null, { equip: 'fireCrown', type: 'orc_guard' });
assert(Math.abs(hero.maxHp - hero.hp - 170) < 1e-6, 'bossDmg on elite');
hero.elite = false; hero.hp = hero.maxHp;
damageHero(hero, 100, 0, 0, null, { equip: 'fireCrown', type: 'orc_guard' });
assert(Math.abs(hero.maxHp - hero.hp - 100) < 1e-6, 'no bossDmg on normal');
monsterHitHero('orc_guard', hero, { equip: 'fireCrown', type: 'orc_guard' });
assert(hero.burn === 3, 'fire crown burns');
monsterHitHero('orc_guard', hero, { equip: 'frostArmor', type: 'orc_guard' });
assert(hero.slow > 0 && hero.slowMul === 0.8, 'frost armor slows');
monsterHitHero('orc_guard', hero, { equip: 'curseGlove', type: 'orc_guard' });
assert(hero.curse === 3 && hero.curseMul === 1.15, 'curse glove');
const killGold = (equip) => { const h = Game.heroes.find(x => !x.dead && !x.boss); h.waiting = false; h.elite = false; h.bounty = 10; h.hp = 1; h.armor = 0; Game.goldLeft = 0; Game.gold = 0; damageHero(h, 10, 0, 0, null, { equip, type: 'orc_guard' }); return Game.gold; };
const g0 = killGold(null), g1 = killGold('boarBoots');
assert.strictEqual(g1, g0 * 2, 'gold effect doubles the bounty');
// 정예 드롭은 재료만
Game.mods.eliteDrop = 1;
for (let i = 0; i < 30; i++) { Game.equipBag = []; Game.eliteDrop(0, 0); assert(EQUIP_BASES.includes(Game.equipBag[0]), 'drop is a material'); }
Game.reset();
console.log('smoke ok: equipment crafting');
}`, ctx, { filename: 'smoke-craft' });

// 지금 해금 순서(옛 시험용으로 바꾸지 않은 표)
{
    const real = vm.createContext({ console, assert, Math, Set, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume(k, v) { this.volume[k] = Math.max(0, Math.min(100, v)); } }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), real, { filename: f });
    vm.runInContext('UI.tutorialOff = true', real);
    vm.runInContext(`
    Meta.data.cleared = [];
    assert(Meta.hasLord('rift') && !Meta.hasLord('bone_queen') && !Meta.hasLord('gold_king'), 'one lord at the start');
    Meta.data.cleared = ['s1'];
    assert(Meta.hasLord('bone_queen') && !Meta.hasLord('gold_king'), 'stage 1 opens the bone queen');
    Meta.data.cleared = ['s1', 's2'];
    assert(Meta.hasLord('gold_king'), 'stage 2 opens the gold king');
    // 스토리 3~6: 한 명씩
    const order = STAGES.map(st => (st.unlocks.find(u => u.kind === 'lord') || {}).id || null);
    assert.strictEqual(JSON.stringify(order), JSON.stringify(['bone_queen', 'gold_king', 'plague', 'chain', 'mirror', 'clock']), 'one lord per story stage');
    for (const id of Object.keys(DEMON_LORDS)) if (id !== DEFAULT_LORD) assert(order.includes(id), id + ' opens at a stage');
    assert.strictEqual(LORD_POWERS.plague.length, 3, 'plague: three branches');
    for (const br of LORD_POWERS.plague) assert(br.tiers.length === 4 && br.tiers.every(t => t.length === 2), br.id + ': 4 tiers of 2');
    assert(STORY_CAST.plague && castPortrait('plague'), 'plague speaks in the story');
    `, real);
    console.log('smoke ok: lord unlock order');
}

// 금단의 계약: 끝없는 심연의 난이도 10단계. 위 난이도는 아래 조항을 물려받는다(새 실행 환경에서)
{
    const pctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), pctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', pctx);
    vm.runInContext('(' + (() => {
    assert.deepStrictEqual(ABYSS_LEVELS.map(L => L.name), ['베이직', '베리 이지', '이지', '노말', '하드', '베리 하드', '익스퍼트', '익스트림', '나이트메어', '헬']);
    assert.strictEqual(ABYSS_LEVELS[DEFAULT_ABYSS_LEVEL].cards.length, 0, 'normal has no clauses');
    for (let i = 4; i < ABYSS_LEVELS.length; i++) {
        const pact = ABYSS_LEVELS[i].cards;
        assert(pact.every(id => RULE_CARDS[id] && RULE_CARDS[id].kind === 'pact'), ABYSS_LEVELS[i].name + ' only pact clauses');
        assert(pact.length > ABYSS_LEVELS[i - 1].cards.filter(id => RULE_CARDS[id].kind === 'pact').length, ABYSS_LEVELS[i].name + ' adds clauses');
        if (i < ABYSS_LEVELS.length - 1) assert(ABYSS_LEVELS[i].cards.filter(id => id !== 'pact_throne').every(id => ABYSS_LEVELS[i + 1].cards.includes(id)), ABYSS_LEVELS[i].name + ' inherited');
    }
    const hell = ABYSS_LEVELS[9].cards;
    assert(hell.includes('pact_crumble') && !hell.includes('pact_throne'), 'hell swaps the cracked throne for the crumbling one');
    assert(ABYSS_LEVELS.slice(0, 3).every(L => L.cards.every(id => RULE_CARDS[id].kind === 'boon')), 'easy levels only give boons');
    assert(!ABYSS_LEVELS.some(L => L.cards.some(id => /hidden/.test(id))), 'no hidden-recipe ban');
    // 일일 도전과 심연 변이는 계약 조항을 고르지 않는다
    for (let i = 0; i < 40; i++) assert(RULE_CARDS[abyssMutation('m' + i, i % 12)].kind === 'hard');
    for (const d of ['2026-11-01', '2026-11-02', '2026-11-03']) assert(dailyChallenge(d).cards.every(id => RULE_CARDS[id].kind !== 'pact'));
    // 조항은 판 내내 붙어 있다(변이가 쌓여도)
    const hc = abyssChallenge('pact-w', 'rift', [], 9);
    assert.strictEqual(hc.level, 9);
    assert.strictEqual(abyssChallenge('pact-w', 'rift', []).level, DEFAULT_ABYSS_LEVEL, 'no level is normal');
    assert.strictEqual(challengeFromRecord({ kind: 'abyss', seed: 'pact-w', lord: 'rift', relics: [], level: 9 }).level, 9, 'record keeps the level');
    Game.reset(null, null, hc);
    assert.strictEqual(Game.record.level, 9);
    assert.strictEqual(Game.maxHp(), COMBAT_RULES.maxHp - 15, 'hell throne');
    assert(Game.mods.heroHp >= 2.5 && Game.mods.powerSeal && Game.mods.bossFury && Game.mods.summonPerRound === 8);
    Game.waveIndex = 10;
    Game.abyssStep();
    assert(Game.mutations.length === 1 && Game.mods.powerSeal && Game.maxHp() === COMBAT_RULES.maxHp - 15, 'clauses survive mutations');
    // 잦은 보스: 5, 15, 25라운드에도 보스
    assert(Game.waves[4].boss === 'archmage' && Game.waves[14].boss === 'archmage' && Game.waves[9].boss, 'boss every five');
    Game.reset(null, null, abyssChallenge('pact-w', 'rift', [], 3));
    assert(!Game.waves[4].boss, 'normal keeps bosses every ten');
    // 권능 봉인: 마력을 얻지 못한다
    Game.reset(null, null, abyssChallenge('pact-w', 'rift', [], 8));
    Game.addMana(5);
    assert.strictEqual(Game.mana, 0, 'sealed powers');
    // 소환 제한: 라운드마다 8번, 다음 라운드에 다시
    Game.state = 'wave';
    Game.gold = 1e6;
    let made = 0;
    for (let i = 0; i < 12; i++) if (Game.act({ kind: 'summon' }).ok) made++;
    assert.strictEqual(made, 8, 'summon cap per round');
    assert.strictEqual(Game.summon().reason, 'cap');
    Game.startWave && (Game.roundSummons = 0);
    assert(Game.summon().ok || Game.fieldFull(), 'cap resets each round');
    // 방패: 첫 공격을 막는다. 되살아나기: 체력 절반으로 한 번 다시 선다. 분열: 정예가 일반 용사 셋으로
    Game.reset(null, null, abyssChallenge('pact-w', 'rift', [], 9));
    Game.state = 'wave';
    Game.heroes.length = 0;
    const s = createHero('warrior', 1, 0, false); s.waiting = false; s.d = 400; s.shield = 1; Game.heroes.push(s);
    const hp0 = s.hp;
    assert.strictEqual(damageHero(s, 5), 0, 'shield blocks');
    assert(s.hp === hp0 && !s.shield, 'shield breaks');
    damageHero(s, 5);
    assert(s.hp < hp0, 'second hit lands');
    const r = createHero('warrior', 1, 0, false); r.waiting = false; r.d = 500; r.revive = 1; Game.heroes.push(r);
    damageHero(r, 1e9);
    const risen = Game.heroes.filter(h => !h.dead && h.d === 500);
    assert(risen.length === 1 && Math.abs(risen[0].hp - risen[0].maxHp / 2) < 1e-6 && !risen[0].revive, 'revives once at half hp');
    const e = createHero('elite_swordsman', 1, 0, false); e.waiting = false; e.d = 600; Game.heroes.push(e);
    damageHero(e, 1e9);
    assert.strictEqual(Game.heroes.filter(h => !h.dead && h.d === 600 && h.type === 'warrior').length, Game.mods.eliteSplit, 'elite splits');
    // 사제 동행: 용사가 서서히 회복한다
    const p = createHero('warrior', 1, 0, false); p.waiting = false; p.d = 300; Game.heroes.push(p);
    p.hp = p.maxHp / 2;
    updateHero(p, 1);
    assert(p.hp > p.maxHp / 2, 'priest heals');
    // 격노한 보스: 패턴이 두 배
    assert.strictEqual(bossPatterns('fallen_knight').length, BOSSES.fallen_knight.patterns.length * 2);
    // 방패와 되살아나기는 시드 난수라 같은 판이면 같은 용사가 받는다
    const shields = () => {
        Game.reset(null, null, abyssChallenge('pact-s', 'rift', [], 9));
        Game.startWave();
        return Game.heroes.map(h => `${h.shield ? 1 : 0}${h.revive ? 1 : 0}`).join('');
    };
    const sh = shields();
    assert(sh === shields() && sh.includes('1'), 'shields are seeded');
    // 난이도 기본 배율: 베이직 체력·이동 50%, 노말 100%, 헬 1000%·300%
    assert.deepStrictEqual(ABYSS_LEVELS.map(L => [L.hp, L.speed]).filter((_, i) => [0, 3, 9].includes(i)), [[0.5, 0.5], [1, 1], [10, 3]], 'base multipliers');
    for (let i = 1; i < ABYSS_LEVELS.length; i++) assert(ABYSS_LEVELS[i].hp > ABYSS_LEVELS[i - 1].hp && ABYSS_LEVELS[i].speed > ABYSS_LEVELS[i - 1].speed, 'base rises every level');
    assert(!ABYSS_LEVELS[9].cards.includes('pact_iron'), 'hell hp lives in the base, not in a clause');
    Game.reset(null, null, abyssChallenge('base-w', 'rift', [], 9));
    assert(Math.abs(Game.mods.heroHp - 10) < 1e-9 && Math.abs(Game.mods.heroSpeed - 3) < 1e-9, 'hell: hero hp x10, speed x3');
    Game.reset(null, null, abyssChallenge('base-w', 'rift', [], 0));
    assert(Math.abs(Game.mods.heroHp - 0.5) < 1e-9 && Math.abs(Game.mods.heroSpeed - 0.5) < 1e-9, 'basic: hero hp and speed halved');
    }).toString() + ')()', pctx);
    console.log('smoke ok: forbidden pact');
}
// 튜토리얼: 본부 첫 안내(아무 데나 누르면 다음), 첫 판 따라 하기(단계 버튼만 눌린다, 준비 시간 멈춤), 본 기록과 다시 보기
{
    const tctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), tctx, { filename: f });
    vm.runInContext('(' + (() => {
        const click = (x, y) => { UI.onMove(x, y); UI.onDown(x, y); UI.onUp(x, y); };
        const ids = () => { UI.update(0); return UI.buttons.map(b => b.id); };
        const btn = id => { UI.update(0); const b = UI.buttons.find(b => b.id === id); assert(b, 'no button ' + id); click(b.x + 5, b.y + 5); };
        // 저장: 새 기록은 안 봄, 판을 해 본 옛 기록은 본 것으로
        assert.deepStrictEqual(Meta.fresh().tutorial, { hq: false, battle: false }, 'fresh: not seen');
        assert.deepStrictEqual(Meta.sanitize({ version: META_VERSION, runs: 3, cleared: [] }).tutorial, { hq: true, battle: true }, 'old players skip it');
        assert.deepStrictEqual(Meta.sanitize({ version: META_VERSION, runs: 3, tutorial: { hq: true, battle: false } }).tutorial, { hq: true, battle: false }, 'kept as saved');
        Meta.data = Meta.fresh();
        // 본부 안내: 시설 버튼은 눌리지 않고 다음으로만 넘어간다
        UI.openHQ();
        ids();
        assert(UI.tut && UI.tut.kind === 'hq' && ids().includes('tut_skip'), 'hq tour starts on the first visit');
        const table = UI.buttons.find(b => b.id === 'hq_wartable');
        click(table.x + 5, table.y + 5);
        assert(Game.state === 'hq' && UI.tut.step === 1, 'a click moves the tour on, not into the facility');
        for (let i = 0; i < TUTORIAL_HQ_STEPS.length; i++) if (UI.tut) click(10, 500);
        assert(!UI.tut && Meta.data.tutorial.hq, 'tour seen');
        ids();
        assert(!UI.tut, 'the tour does not come back');
        // 첫 판: 스토리 첫 스테이지
        UI.openSelect(STAGES[0].id);
        UI.beginRun();
        if (UI.dialogue) UI.endDialogue();
        ids();
        assert(UI.tut && UI.tutStep() === 'summon' && Game.state === 'prep', 'battle tutorial starts at round 0');
        btn('next');
        assert.strictEqual(Game.state, 'prep', 'start round is blocked while summoning');
        UI.onKey('Space');
        assert.strictEqual(Game.state, 'prep', 'Space is blocked too');
        const timer = Game.prepTimer;
        for (let i = 0; i < 300; i++) { UI.update(1 / 30); Game.update(1 / 30); }
        assert(Game.state === 'prep' && Game.prepTimer === timer, 'the prep timer waits');
        let guard = 0;
        while (UI.tutStep() === 'summon' && guard++ < 8) btn('summon');
        assert.strictEqual(Game.monsters.length, MERGE_RULES.gradeCount, 'three summons');
        assert(Game.monsters.every(m => MONSTERS[m.type].grade === GRADE_ORDER[0]), 'the first three are the lowest grade');
        assert.strictEqual(UI.tutStep(), 'merge', 'then merge');
        btn('next');
        assert.strictEqual(Game.state, 'prep', 'start round is blocked while merging');
        const pair = UI.tutMergeable();
        Game.act({ kind: 'merge', src: pair.src, dst: pair.m });
        ids();
        assert.strictEqual(Game.stats.merged, 1, 'merged');
        assert.strictEqual(UI.tutStep(), 'start', 'then start the round');
        btn('next');
        assert.strictEqual(Game.state, 'wave', 'round started');
        ids();
        assert(!Game.holdPrep, 'the timer is free again');
        btn('tut_skip');
        assert(!UI.tut && Meta.data.tutorial.battle, 'skip counts as seen');
        // 다시 보기: 설정 버튼이 둘 다 지운다
        UI.openHQ();
        UI.tut = null;
        Meta.data.tutorial.hq = true;
        UI.hqSettings = true;
        btn('set_tutorial');
        assert.deepStrictEqual(Meta.data.tutorial, { hq: false, battle: false }, 'replay resets both');
        ids();
        assert(UI.tut && UI.tut.kind === 'hq', 'the tour starts again');
        UI.onKey('Escape');
        assert(!UI.tut && Meta.data.tutorial.hq, 'Esc skips the tour');
        // 도전 판에서는 나오지 않는다
        Game.reset(null, null, abyssChallenge('tut-w', 'rift', [], 3));
        Game.state = 'prep';
        ids();
        assert(!UI.tut, 'no tutorial in challenges');
        // 연타: 라운드가 막 시작하면 다음 라운드를 부르지 못한다(2초)
        Game.reset(null, STAGES[0].id);
        Game.state = 'prep';
        Game.act({ kind: 'startWave' });
        assert.strictEqual(Game.act({ kind: 'nextRound' }).ok, false, 'no next round right after the start');
        assert.strictEqual(Game.waveIndex, 0, 'still round 1');
        for (let i = 0; i < 70; i++) Game.update(1 / 30);
        assert.strictEqual(Game.act({ kind: 'nextRound' }).ok, true, 'next round after the lock');
        assert.strictEqual(Game.act({ kind: 'nextRound' }).ok, false, 'locked again for the new round');
        console.log('smoke ok: tutorial');
        // 전투 메뉴: Esc로 열고 닫는다(판이 멈춘다), 설정은 소리와 효과만, 항복은 두 번
        Meta.data.tutorial = { hq: true, battle: true };
        Game.reset(null, STAGES[0].id);
        Game.state = 'prep';
        Game.paused = false;
        UI.tut = null;
        ids();
        assert(ids().includes('menu') && !ids().includes('fx'), 'menu button in place of the effects toggle');
        UI.onKey('Escape');
        assert(UI.battleMenu && Game.paused, 'Esc opens the menu and pauses');
        assert(['menu_resume', 'menu_settings', 'menu_surrender'].every(id => ids().includes(id)) && !ids().includes('summon'), 'menu buttons only');
        UI.onKey('KeyS');
        assert.strictEqual(Game.monsters.length, 0, 'game keys wait while the menu is open');
        UI.onKey('Escape');
        assert(!UI.battleMenu && !Game.paused, 'Esc closes the menu and resumes');
        btn('menu');
        btn('menu_settings');
        assert(UI.hqSettings && ['set_sound', 'set_fx', 'set_close'].every(id => ids().includes(id)), 'settings from the menu');
        assert(!ids().includes('set_tutorial') && !ids().includes('set_title'), 'no tutorial or title rows in a battle');
        UI.onKey('Escape');
        assert(UI.battleMenu && !UI.hqSettings, 'Esc goes back to the menu');
        btn('menu_resume');
        assert(!UI.battleMenu && !Game.paused, 'resume');
        // 고른 몬스터가 있으면 Esc는 취소만
        Game.act({ kind: 'summon' });
        UI.selectedMonster = Game.monsters[0];
        UI.onKey('Escape');
        assert(!UI.selectedMonster && !UI.battleMenu, 'Esc clears a selection first');
        // 항복: 두 번 눌러야 한다
        btn('menu');
        btn('menu_surrender');
        assert(Game.inPlay() && UI.surrenderArmed > 0, 'first press arms');
        btn('menu_surrender');
        assert(Game.state === 'defeat' && Game.hp === 0 && !UI.battleMenu, 'surrendered');
        // 도전: 항복도 입력이라 기록되고, 남은 체력은 0
        Game.reset(null, null, abyssChallenge('menu-w', 'rift', [], 3));
        Game.state = 'prep';
        Game.record = { inputs: [] };
        assert(Game.act({ kind: 'surrender' }).ok, 'surrender act');
        assert(Game.challengeResult && Game.challengeResult.hp === 0, 'no hp left for the ranking');
        assert(Game.record.inputs.some(i => i.kind === 'surrender'), 'recorded for replay');
        assert(!Game.act({ kind: 'surrender' }).ok, 'only once');
        console.log('smoke ok: battle menu');
    }).toString() + ')()', tctx);
}
// 계정(테스트 서버): 가입 → 손님 기록 옮기기 → 저장이 서버로 → 로그아웃은 손님 기록 → 다시 로그인하면 고르기 → 다시 켜면 이어받기
{
    const store = {};
    const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    const actx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON, localStorage, store,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), actx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', actx);
    vm.runInContext('(' + (async () => {
        assert(Account.testServer(), 'no server config: test server');
        // 손님 기록 하나
        store[META_KEY] = JSON.stringify(Object.assign(Meta.fresh(), { cleared: [STAGES[0].id], runs: 4, seen: ['zombie'], savedAt: 1000 }));
        Meta.load();
        await Account.init();
        assert.strictEqual(Account.status, 'guest', 'starts as a guest');
        assert.strictEqual(Account.label(), '계정: 손님', 'title label');
        // 입력 확인
        assert(!(await Account.signUp('ab', 'secret1')) && Account.error === ACCOUNT_ERRORS.invalidId, 'short id');
        assert(!(await Account.signUp('demon_lord', '123')) && Account.error === ACCOUNT_ERRORS.weakPassword, 'short password');
        assert(!(await Account.signIn('nobody_here', 'secret1')) && Account.error === ACCOUNT_ERRORS.noUser, 'unknown id');
        // 가입: 서버 기록이 없고 손님 기록이 있으면 옮길지 묻는다
        assert(await Account.signUp('demon_lord', 'secret1'), 'sign up');
        assert(Account.status === 'user' && Account.choice && Account.choice.kind === 'migrate', 'asks to move the guest record');
        UI.update(0);
        assert(UI.buttons.some(b => b.id === 'acc_local') && !UI.buttons.some(b => b.id === 'start'), 'the choice panel on the title');
        Account.pick('local');
        await Promise.resolve();
        assert.strictEqual(Meta.key, META_KEY + '@demon_lord', 'account slot');
        assert.strictEqual(Meta.data.runs, 4, 'moved the guest record');
        assert.strictEqual(store[META_KEY], undefined, 'the guest slot is emptied');
        assert.strictEqual(MockServer.read().users.demon_lord.save.runs, 4, 'uploaded on the move');
        assert(!(await Account.signUp('Demon_Lord', 'secret1')) && Account.error === ACCOUNT_ERRORS.idTaken, 'ids are case blind');
        // 저장은 잠시 뒤 한 번에 올라간다
        Meta.data.runs = 7;
        Meta.save();
        assert.strictEqual(Account.sync, 'waiting', 'upload waits');
        Account.tick(ACCOUNT_UPLOAD_DELAY + 0.1);
        await Promise.resolve(); await Promise.resolve();
        assert.strictEqual(MockServer.read().users.demon_lord.save.runs, 7, 'uploaded after the delay');
        // 닉네임
        assert(!(await Account.setNickname('a')) && Account.error === ACCOUNT_ERRORS.invalidNick, 'short nickname');
        assert(await Account.setNickname('마왕님'), 'nickname');
        assert.strictEqual(Account.label(), '계정: 마왕님', 'label shows the nickname');
        // 로그아웃: 손님 칸(옮겨서 빈 기록)
        assert(await Account.signOut(), 'sign out');
        assert(Account.status === 'guest' && Meta.key === META_KEY && Meta.data.runs === 0, 'back to the guest slot');
        // 손님으로 다른 기록 → 로그인하면 고른다
        Meta.data.runs = 1;
        Meta.data.seen = ['fire_imp'];
        Meta.save();
        assert(!(await Account.signIn('demon_lord', 'wrong12')) && Account.error === ACCOUNT_ERRORS.wrongPassword, 'wrong password');
        assert(await Account.signIn('DEMON_LORD', 'secret1'), 'sign in, any case');
        assert(Account.choice && Account.choice.kind === 'conflict', 'different records: choose');
        assert.strictEqual(Account.choice.server.runs, 7, 'server side');
        assert.strictEqual(Account.choice.local.runs, 1, 'device side');
        Account.pick('server');
        assert.strictEqual(Meta.data.runs, 7, 'server record in use');
        assert.strictEqual(JSON.parse(store[META_KEY]).runs, 1, 'the guest record stays when not moved');
        // 다시 켠다: 남은 로그인을 이어받고, 이 기기 칸이 더 새로우면 그것을 쓰고 올린다
        Meta.data.runs = 9;
        const onSave = Meta.onSave;
        Meta.onSave = null;
        Meta.save();
        Meta.onSave = onSave;
        Meta.key = META_KEY;
        Meta.load();
        await Account.init();
        assert(Account.status === 'user' && !Account.choice, 'resumed without asking');
        assert.strictEqual(Meta.data.runs, 9, 'the newer device copy');
        await Promise.resolve();
        assert.strictEqual(MockServer.read().users.demon_lord.save.runs, 9, 'and uploads it');
        // 같은 기록이면 묻지 않는다
        await Account.signOut();
        assert(await Account.signIn('demon_lord', 'secret1'), 'sign in again');
        assert(Account.choice && Account.choice.kind === 'conflict', 'guest record still differs');
        Account.pick('local');
        await Account.signOut();
        store[META_KEY] = store[META_KEY + '@demon_lord'];
        Meta.load();
        assert(await Account.signIn('demon_lord', 'secret1') && !Account.choice, 'same record: no question');
        assert.deepStrictEqual(Account.summary(Meta.fresh()).slice(0, 2), ['스토리 0 / ' + STAGES.length, '판 0 · 도감 0'], 'summary lines');
        console.log('smoke ok: account');
    }).toString() + ')()', actx).catch(e => { console.error(e); process.exit(1); });
}
// 역병의 군주: 맞으면 독, 독은 0.5초마다 피해, 쓰러지면 옮음(보스 제외), 권능(겹치기, 구름, 제물, 장례비, 대유행, 숨통)
{
    const qctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), qctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', qctx);
    vm.runInContext('(' + (() => {
        Meta.data.cleared = STAGES.slice(0, 3).map(s => s.id); // 스토리 3을 깨야 열린다
        const start = powers => {
            Game.reset({ lord: 'plague', relics: [] }, STAGES[2].id);
            Game.state = 'wave';
            Game.heroes.length = 0;
            for (const id of powers || []) Game.powers[id] = true;
        };
        const hero = (type, d) => {
            const h = createHero(type || 'warrior', 5, 0, false, 'north');
            h.waiting = false; h.delay = 0; h.d = d || 300; h.maxHp = h.hp = 1000;
            Game.heroes.push(h);
            return h;
        };
        const tick = s => { for (let i = 0; i < Math.round(s * 30); i++) for (const h of Game.heroes.slice()) if (!h.dead && !h.boss) updateHero(h, 1 / 30); }; // 보스 표시는 옮음 시험용(보스 패턴은 돌리지 않는다)
        start();
        assert(Game.lordPassive('plague'), 'plague passive');
        const k = [...BUILD_CELLS].find(x => { const [a, r] = x.split(',').map(Number); return Game.canPlace('fire_imp', a, r); }).split(',').map(Number);
        const imp = Game.place('fire_imp', k[0], k[1]) || Game.monsters[Game.monsters.length - 1];
        const a = hero();
        monsterHitHero(imp.type, a, imp);
        a.burn = 0; // 불 도깨비의 화상은 빼고 독만 잰다
        const dps = monsterStats(imp).damage * DEMON_LORDS.plague.passive.ratio;
        assert(a.poison === 3 && Math.abs(a.poisonDps - dps) < 1e-9, 'a hit poisons for 3 s');
        const hp0 = a.hp;
        tick(3.05);
        assert(Math.abs((hp0 - a.hp) - dps * 3) < 1e-6 && a.poison === 0, 'six ticks of half a second');
        // 옮음: 일반은 옮고, 보스는 안 옮는다
        const b = hero('warrior', 300), c = hero('warrior', 310), boss = hero('warrior', 305);
        boss.boss = true;
        poisonHero(b, 3, 10, imp);
        b.hp = 1;
        tick(0.55);
        assert(b.dead && c.poison > 0 && c.poisonSpread && !(boss.poison > 0), 'spreads to the crowd, not the boss');
        assert.strictEqual(Game.poisonKills, 1, 'poison kill counted');
        // 다른 마왕은 독을 걸지 않는다
        Game.reset({ lord: 'rift', relics: [] }, STAGES[2].id);
        const r = hero();
        monsterHitHero(imp.type, r, imp);
        assert(!(r.poison > 0), 'only the plague lord poisons');
        // 겹치는 독 3번, 진한 독 1.4배
        start(['venomStack', 'venomStrong']);
        const s = hero();
        for (let i = 0; i < 5; i++) poisonHero(s, 3, 10, null);
        assert.strictEqual(s.poisonStacks, 3, 'three stacks at most');
        assert(Math.abs(poisonDps(s) - 10 * 3 * 1.4) < 1e-9, 'stacked and strong');
        // 오래가는 독, 숨통(일반 용사 체력 10% 이하 즉사)
        start(['venomLong', 'venomDeath']);
        const t = hero();
        poisonHero(t, 3, 1, null);
        assert.strictEqual(t.poison, 5, 'long poison +2 s');
        t.hp = 90;
        tick(0.55);
        assert(t.dead, 'below 10%: dies');
        // 장례비: 독으로 쓰러지면 골드 +50%
        start(['spreadGold']);
        const g = hero();
        g.bounty = 10;
        const gold0 = Game.gold;
        poisonHero(g, 3, 1, null);
        g.hp = 0.1;
        tick(0.55);
        assert.strictEqual(Game.gold - gold0, 15, 'funeral fee');
        // 역병 구름(E): 새 스킬, 맨 앞 용사 자리에 장판, 안의 용사에게 독
        start(['miasma']);
        assert.strictEqual(Game.thirdSkill().key, 'miasma', 'third skill');
        const m = hero('warrior', 500);
        assert(Game.act({ kind: 'miasma' }).ok && Game.skills.miasma > 0, 'cast');
        assert(!Game.act({ kind: 'miasma' }).ok, 'cooldown');
        const z = Game.hazards[Game.hazards.length - 1];
        assert(z.kind === 'poison' && z.dps > 0, 'poison cloud');
        updateHazard(z, 0.01);
        assert(m.poison > 0, 'the cloud poisons');
        // 역병 제물: 맵의 모든 용사에게 독
        start(['rotSac']);
        Game.state = 'prep';
        const e = hero('warrior', 200);
        const sac = Game.place('fire_imp', k[0], k[1]) || Game.monsters[Game.monsters.length - 1];
        assert(Game.sacrifice(sac).ok && e.poison > 0, 'sacrifice poisons everyone');
        // 대유행: 10명째마다 모든 독을 처음부터
        start(['pandemic']);
        const keep = hero('warrior', 100);
        poisonHero(keep, 3, 1, null);
        keep.poison = 0.8;
        for (let i = 0; i < 10; i++) { const v = hero('warrior', 400 + i); poisonHero(v, 3, 1, null); v.hp = 0.1; }
        tick(0.55);
        assert(keep.poison > 2, 'pandemic refills');
        // 썩은 살 + 깊은 부패: 독 걸린 용사 받는 피해 +45%
        start(['rotCurse', 'rotDeep']);
        const w = hero();
        w.armor = 0;
        poisonHero(w, 3, 0.0001, null);
        const dealt = damageHero(w, 100, 0, 0);
        assert(Math.abs(dealt - 145) < 1e-6, 'rot +45%');
        console.log('smoke ok: plague lord');
    }).toString() + ')()', qctx);
}
// 사슬의 군주: 맞으면 확률로 묶임(정지), 정예·보스는 절반, 권능(사슬 엮기, 갈고리, 형틀·고문, 참수, 몸값, 구덩이, 사슬 감옥)
{
    const cctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), cctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', cctx);
    vm.runInContext('(' + (() => {
        Meta.data.cleared = STAGES.slice(0, 4).map(s => s.id); // 스토리 4를 깨야 열린다
        const start = powers => {
            Game.reset({ lord: 'chain', relics: [] }, STAGES[3].id);
            Game.state = 'wave';
            Game.heroes.length = 0;
            for (const id of powers || []) Game.powers[id] = true;
        };
        const hero = (d, kind) => {
            const h = createHero('warrior', 5, 0, false, 'north');
            h.waiting = false; h.delay = 0; h.d = d || 300; h.maxHp = h.hp = 1000; h.armor = 0;
            if (kind) h[kind] = true;
            Game.heroes.push(h);
            return h;
        };
        const tick = s => { for (let i = 0; i < Math.round(s * 30); i++) for (const h of Game.heroes.slice()) if (!h.dead && !h.boss) updateHero(h, 1 / 30); };
        start();
        assert(Game.lordPassive('shackle'), 'shackle passive');
        // 확률: 많이 맞히면 패시브 확률만큼 묶인다(고정 난수)
        let bound = 0;
        for (let i = 0; i < 400; i++) { const h = hero(); chainOnHit(h); if (h.bound > 0) bound++; h.dead = true; }
        assert(bound > 400 * DEMON_LORDS.chain.passive.chance * 0.5 && bound < 400 * DEMON_LORDS.chain.passive.chance * 1.6, 'about the passive chance: ' + bound);
        Game.heroes.length = 0;
        let eb = 0;
        for (let i = 0; i < 400; i++) { const h = hero(300, 'elite'); chainOnHit(h); if (h.bound > 0) eb++; h.dead = true; }
        assert(eb < 400 * DEMON_LORDS.chain.passive.chance * 0.85, 'elites about half: ' + eb + ' vs ' + bound);
        Game.heroes.length = 0;
        // 묶임: 정지와 같이 걸리고, 시간이 지나면 풀린다
        const a = hero(400);
        bindHero(a, 0.6);
        assert(a.bound === 0.6 && a.stun >= 0.6, 'bound and stunned');
        tick(0.7);
        assert(a.bound === 0, 'released');
        // 다른 마왕은 묶지 않는다
        Game.reset({ lord: 'rift', relics: [] }, STAGES[3].id);
        const r = hero();
        for (let i = 0; i < 50; i++) chainOnHit(r);
        assert(!(r.bound > 0), 'only the chain lord binds');
        // 갈고리, 큰 갈고리, 긴 사슬: 뒤로 끈다
        start(['dragBack', 'dragHook', 'dragFar']);
        const e = hero(1000, 'elite');
        bindHero(e, 0.6);
        assert(Math.abs(e.d - (1000 - (0.5 + 2) * TILE * 2)) < 1e-6, 'elite dragged 5 tiles');
        // 형틀 + 고문: 묶인 용사 받는 피해 +60%
        start(['execBound', 'execDeep']);
        const f = hero();
        bindHero(f, 1);
        assert(Math.abs(damageHero(f, 100, 0, 0) - 160) < 1e-6, 'bound takes +60%');
        // 참수: 15% 이하면 즉사(일반만)
        start(['execLow']);
        const g = hero();
        bindHero(g, 1);
        damageHero(g, 860, 0, 0);
        assert(g.dead, 'executed');
        const ge = hero(300, 'elite');
        bindHero(ge, 1);
        damageHero(ge, 860, 0, 0);
        assert(!ge.dead, 'elites are not executed');
        // 몸값: 묶인 채 쓰러지면 골드 +50%
        start(['execGold']);
        const m = hero();
        m.bounty = 10;
        bindHero(m, 1);
        const gold0 = Game.gold;
        damageHero(m, 5000, 0, 0);
        assert.strictEqual(Game.gold - gold0, 15, 'ransom');
        // 구덩이: 묶인 일반 용사 5명째마다 입구로
        start(['dragPit']);
        const pit = [1, 2, 3, 4, 5].map(i => hero(500 + i));
        for (const h of pit) bindHero(h, 0.5);
        assert(pit[4].d === 0 && pit[3].d > 0, 'fifth goes back to the gate');
        // 사슬 엮기: 1칸 안 한 명 더
        start(['shackleChain', 'shackleChance']);
        const c1 = hero(600), c2 = hero(610);
        Game.lordPassive('shackle').chance = 1;
        chainOnHit(c1);
        Game.lordPassive('shackle').chance = 0.08;
        assert(c1.bound > 0 && c2.bound > 0, 'a second one is bound');
        // 사슬 감옥(E)
        start(['jail', 'dragAll']);
        assert.strictEqual(Game.thirdSkill().key, 'jail', 'third skill');
        const j1 = hero(900), j2 = hero(920), far = hero(100);
        assert(Game.act({ kind: 'jail' }).ok && Game.skills.jail > 0, 'cast');
        assert(j1.bound === 3 && j2.bound === 3 && !(far.bound > 0), 'jail binds around the front');
        assert(j1.d < 900, 'pulled back');
        assert(!Game.act({ kind: 'jail' }).ok, 'cooldown');
        console.log('smoke ok: chain lord');
    }).toString() + ')()', cctx);
}
// 거울 마녀: 합치면 확률로 재료가 돌아옴, 분신(E)은 합치기·판매·제물이 안 되고 시간이 지나면 사라짐, 거울 방패, 되비침, 은 세공
{
    const mctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), mctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', mctx);
    vm.runInContext('(' + (() => {
        Meta.data.cleared = STAGES.slice(0, 5).map(s => s.id); // 스토리 5를 깨야 열린다
        const start = powers => {
            Game.reset({ lord: 'mirror', relics: [] }, STAGES[4].id);
            Game.state = 'prep';
            Game.gold = 100000;
            for (const id of powers || []) Game.powers[id] = true;
        };
        const put = type => {
            const k = [...BUILD_CELLS].find(x => { const [a, r] = x.split(',').map(Number); return Game.canPlace(type, a, r); }).split(',').map(Number);
            return Game.place(type, k[0], k[1]);
        };
        const trio = () => [put('orc_guard'), put('orc_guard'), put('orc_guard')];
        start();
        assert(Game.lordPassive('reflection'), 'reflection passive');
        // 확률 1로: 합치면 끌어온 재료가 돌아온다
        Game.lordPassive('reflection').chance = 1;
        let [a, b] = trio();
        const before = Game.monsters.length;
        assert(Game.act({ kind: 'merge', src: a, dst: b }).ok, 'merge');
        assert.strictEqual(Game.monsters.length, before - 2 + 1, 'three in, one out, one mirrored back');
        assert(Game.monsters.some(m => m.type === 'orc_guard' && !m.removed), 'the material came back');
        // 확률 0이면 돌아오지 않는다
        start();
        Game.lordPassive('reflection').chance = 0;
        [a, b] = trio();
        const n0 = Game.monsters.length;
        Game.act({ kind: 'merge', src: a, dst: b });
        assert.strictEqual(Game.monsters.length, n0 - 2, 'no mirror');
        Game.lordPassive('reflection').chance = 0.15;
        // 거울 값(골드), 닮은 꼴(랭크)
        start(['copyGold', 'copyRank']);
        Game.lordPassive('reflection').chance = 1;
        [a, b] = trio();
        setMonsterRank(a, 2);
        setMonsterRank(b, 2);
        for (const m of Game.monsters) setMonsterRank(m, 2);
        const g0 = Game.gold;
        Game.act({ kind: 'merge', src: a, dst: b });
        const back = Game.monsters.find(m => m.type === 'orc_guard');
        assert(back && back.rank === 2, 'rank kept');
        assert(Game.gold > g0, 'mirror gold');
        Game.lordPassive('reflection').chance = 0.15;
        // 은 세공: 결과 등급만큼 골드
        start(['transGold']);
        [a, b] = trio();
        const g1 = Game.gold;
        const res = Game.act({ kind: 'merge', src: a, dst: b });
        assert.strictEqual(Game.gold - g1, COMBAT_RULES.mirror.transGold[MONSTERS[res.type].grade], 'silverwork gold');
        // 거울 분신(E)
        start(['mirrorClone', 'cloneTwo']);
        assert.strictEqual(Game.thirdSkill().key, 'mirrorClone', 'third skill');
        const top = put('hell_general') || put('orc_guard');
        const count = Game.monsters.length;
        assert(Game.act({ kind: 'mirrorClone' }).ok, 'cast');
        const clones = Game.monsters.filter(m => m.clone > 0);
        assert(clones.length === 2 && clones[0].type === clones[1].type && GRADE_ORDER.indexOf(MONSTERS[clones[0].type].grade) >= GRADE_ORDER.indexOf(MONSTERS[top.type].grade) - 4, 'two clones of the best that fits');
        assert(!Game.fieldFull() || count >= Game.maxField(), 'clones do not fill the field');
        assert(!Game.act({ kind: 'merge', src: clones[0], dst: clones[1] }).ok, 'clones cannot merge');
        assert(!Game.act({ kind: 'sacrifice', monster: clones[0] }).ok, 'clones cannot be sacrificed');
        const g2 = Game.gold;
        Game.sell(clones[0]);
        assert(Game.gold === g2 && Game.monsters.includes(clones[0]), 'clones cannot be sold');
        Game.state = 'wave';
        for (let i = 0; i < Math.round((COMBAT_RULES.mirrorClone.duration + 0.5) * 30); i++) Game.update(1 / 30);
        assert(!Game.monsters.some(m => m.clone), 'clones fade');
        // 거울 방패: 라운드마다 왕좌 피해 1번 막음(큰 방패 2번), 라운드가 바뀌면 다시
        start(['mirrorShield']);
        Game.state = 'wave';
        const hp = Game.hp;
        damageThrone(1);
        assert.strictEqual(Game.hp, hp, 'first hit blocked');
        damageThrone(1);
        assert.strictEqual(Game.hp, hp - 1, 'second hit lands');
        Game.state = 'prep';
        Game.startWave();
        damageThrone(1);
        assert.strictEqual(Game.hp, hp - 1, 'blocked again next round');
        // 되비침: 왕좌가 맞으면 맨 앞 용사 3명에게 번개 피해 50%
        start(['reflectThrone']);
        Game.state = 'wave';
        Game.heroes.length = 0;
        const hs = [1, 2, 3, 4].map(i => { const h = createHero('warrior', 5, 0, false, 'north'); h.waiting = false; h.d = 500 + i * 40; h.maxHp = h.hp = 1000; h.armor = 0; Game.heroes.push(h); return h; });
        damageThrone(1);
        const hurt = hs.filter(h => h.hp < 1000).length;
        assert.strictEqual(hurt, 3, 'three reflected');
        assert(Math.abs(hs[3].hp - (1000 - Game.lightningDamage() * 0.5)) < 1e-6, 'half lightning');
        // 공짜 거울: 라운드 첫 소환 0
        start(['transFree']);
        assert.strictEqual(Game.summonCost(), 0, 'first summon free');
        Game.act({ kind: 'summon' });
        assert(Game.summonCost() > 0, 'then paid');
        console.log('smoke ok: mirror lord');
    }).toString() + ')()', mctx);
}
// 시계탑의 마왕: 라운드 시작 4초 감속(보스 절반), 권능(느린·무거운 초침, 그림자, 가속, 시간 정지, 되감기, 마지막 1초, 수리공)
{
    const kctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), kctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', kctx);
    vm.runInContext('(' + (() => {
        Meta.data.cleared = STAGES.map(s => s.id); // 스토리 6을 깨야 열린다
        const start = powers => {
            Game.reset({ lord: 'clock', relics: [] }, STAGES[5].id);
            Game.state = 'prep';
            Game.prepTimer = 999;
            for (const id of powers || []) Game.powers[id] = true;
            Game.startWave();
            Game.heroes.length = 0;
        };
        const hero = (d, kind) => {
            const h = createHero('warrior', 5, 0, false, 'north');
            h.waiting = false; h.delay = 0; h.d = d || 300; h.maxHp = h.hp = 1000;
            if (kind) h[kind] = true;
            Game.heroes.push(h);
            return h;
        };
        const age = s => { Game.roundTimer = Game.roundFull - s; };
        start();
        assert(Game.lordPassive('stopwatch'), 'stopwatch passive');
        const h = hero(), b = hero(300, 'boss');
        age(1);
        assert(Math.abs(clockSlowMul(h) - 0.6) < 1e-9 && Math.abs(clockSlowMul(b) - 0.8) < 1e-9, 'first 4 s: -40%, bosses half');
        age(DEMON_LORDS.clock.passive.duration + 0.5);
        assert.strictEqual(clockSlowMul(h), 1, 'after the passive time: normal');
        // 다른 마왕은 감속하지 않는다
        Game.reset({ lord: 'rift', relics: [] }, STAGES[5].id);
        assert.strictEqual(clockSlowMul(h), 1, 'only the clock lord');
        // 느린·무거운 초침, 태엽 감기
        start(['slowLong', 'slowDeep', 'slowBoss']);
        const h2 = hero(), b2 = hero(300, 'boss');
        age(DEMON_LORDS.clock.passive.duration + 1.5);
        assert(Math.abs(clockSlowMul(h2) - 0.45) < 1e-9 && Math.abs(clockSlowMul(b2) - 0.45) < 1e-9, '+2 s, -55%, bosses too');
        // 시계 소리: 감속 중인 용사가 받는 피해 +15%
        start(['slowAura']);
        age(1);
        const slowed = hero();
        slowed.armor = 0;
        assert(Math.abs(damageHero(slowed, 100, 0, 0) - 115) < 1e-6, 'clock ring while slowed');
        age(20);
        const calm = hero();
        calm.armor = 0;
        assert(Math.abs(damageHero(calm, 100, 0, 0) - 100) < 1e-6, 'no bonus after the slow');
        // 가속: 첫 종소리 + 폭주 시계
        start(['hasteStart', 'hasteMax']);
        age(2);
        assert(Math.abs(clockHaste() - 0.6) < 1e-9, 'first bell doubled');
        age(7);
        assert.strictEqual(clockHaste(), 0, 'bell ends');
        // 몰아치기, 늦춰진 시간: 정예 처치
        start(['hasteKill', 'slowElite']);
        age(20);
        const e = hero(300, 'elite');
        e.bounty = 0;
        damageHero(e, 5000, 0, 0);
        assert(Game.clockHasteT > 0 && Game.clockSlowT > 0, 'elite kill starts both');
        assert(Math.abs(clockHaste() - 0.3) < 1e-9 && Math.abs(clockSlowMul(hero()) - 0.7) < 1e-9, 'haste and slow');
        // 시간 정지(E)
        start(['timeStop', 'stopLong', 'timeStopHaste']);
        const s1 = hero(), sb = hero(400, 'boss');
        assert.strictEqual(Game.thirdSkill().key, 'timeStop', 'third skill');
        assert(Game.act({ kind: 'timeStop' }).ok && Game.skills.timeStop > 0, 'cast');
        assert(s1.stun >= 4.5 && sb.stun >= 1 && sb.stun < 2, 'heroes stopped, boss briefly');
        assert(Math.abs(clockHaste() - 0.5) < 1e-9, 'monsters faster while time stops');
        assert(!Game.act({ kind: 'timeStop' }).ok, 'cooldown');
        // 되감기: 피해 2마다 3초 뒤 체력 1
        start(['rewindThrone']);
        const hp = Game.hp;
        damageThrone(2);
        assert.strictEqual(Game.hp, hp - 2, 'hit');
        for (let i = 0; i < 100; i++) Game.update(1 / 30);
        assert.strictEqual(Game.hp, hp - 1, 'one back after 3 s');
        // 마지막 1초: 판당 한 번
        start(['rewindDeath']);
        damageThrone(Game.hp);
        assert(Game.hp === COMBAT_RULES.clock.rewindDeathHp && Game.inPlay(), 'saved once');
        damageThrone(Game.hp);
        assert.strictEqual(Game.state, 'defeat', 'not twice');
        // 수리공: 라운드 종료 체력 +1
        start(['rewindHeal']);
        Game.hp = 10;
        Game.endWave();
        assert.strictEqual(Game.hp, 11, 'repairman');
        // 보스가 왕좌에 닿으면 바로 패배가 아니라 최대 체력의 절반
        Game.reset({ lord: 'rift', relics: [] }, STAGES[5].id);
        Game.state = 'wave';
        Game.heroes.length = 0;
        const boss = createHero(Object.keys(BOSSES)[0], 10, 0, true, 'north');
        boss.waiting = false; boss.delay = 0; boss.d = ROUTES.north.length - 50;
        Game.heroes.push(boss);
        updateHero(boss, 1 / 30);
        assert(boss.dead && Game.inPlay() && Game.hp === Game.maxHp() - Math.ceil(Game.maxHp() * COMBAT_RULES.bossArrival), 'boss arrival: half hp, not defeat');
        console.log('smoke ok: clock lord');
    }).toString() + ')()', kctx);
}
// 유물 2판(47종)과 치명타: 표, 설명, 해금, 효과(새 실행 환경)
{
    const rctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), rctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', rctx);
    vm.runInContext('(' + (() => {
        // 표: 47종, 모두 설명이 있고 효과 키를 안다. 스토리마다 7, 7, 7, 9, 9, 8개
        const ids = Object.keys(RELICS);
        assert.strictEqual(ids.length, 47, '47 relics');
        for (const id of ids) {
            assert(RELICS[id].desc && RELICS[id].desc.length > 8, id + ' desc');
            for (const k of Object.keys(RELICS[id].effects)) assert(LORD_EFFECTS[k], id + ' key ' + k);
        }
        assert.deepStrictEqual(STAGES.map(st => st.unlocks.filter(u => u.kind === 'relic').length), [7, 7, 7, 9, 9, 8], 'relics per stage');
        assert(!['pauper_helm', 'iron_oath', 'blood_altar', 'mad_drum'].some(id => RELICS[id]), 'four relics removed');
        Meta.data.cleared = STAGES.map(s => s.id);
        const start = (relics, state) => {
            Game.reset({ lord: 'rift', relics: [] }, STAGES[5].id);
            Game.relics = relics.slice();
            Game.mods = buildMods('rift', relics);
            Game.state = state || 'wave';
            Game.gold = 100000;
            Game.heroes.length = 0;
        };
        const hero = (d, kind) => {
            const h = createHero('warrior', 5, 0, false, 'north');
            h.waiting = false; h.delay = 0; h.d = d || 300; h.maxHp = h.hp = 100000; h.armor = 0;
            if (kind) h[kind] = true;
            Game.heroes.push(h);
            return h;
        };
        const put = type => {
            const k = [...BUILD_CELLS].find(x => { const [a, r] = x.split(',').map(Number); return Game.canPlace(type, a, r); }).split(',').map(Number);
            return Game.place(type, k[0], k[1]);
        };
        const ofFamily = fam => Object.keys(MONSTERS).find(id => MONSTERS[id].family === fam && MONSTERS[id].grade === 'common' && monsterCells(id).join() === '1,1');
        // 치명타: 확률 1이면 2배(피의 잔이면 2.5배), 0이면 그대로
        start([]);
        const imp = put(ofFamily('demon'));
        COMBAT_RULES.crit.chance = 1;
        let h = hero();
        assert(Math.abs(damageHero(h, 100, 0, 0, null, imp) - 200) < 1e-6, 'crit x2');
        start(['blood_cup']);
        h = hero();
        const imp2 = put(ofFamily('demon'));
        assert(Math.abs(damageHero(h, 100, 0, 0, null, imp2) - 250) < 1e-6, 'blood cup crit x2.5');
        COMBAT_RULES.crit.chance = 0;
        assert(Math.abs(damageHero(h, 100, 0, 0, null, imp2) - 100) < 1e-6, 'no crit');
        assert(Math.abs(damageHero(h, 100, 0, 0) - 100) < 1e-6, 'no attacker, no crit');
        // 고문 도구: 상태 이상이면 +20%
        start(['torture_kit']);
        const imp3 = put(ofFamily('demon'));
        h = hero();
        h.slow = 2; h.slowMul = 0.9;
        assert(Math.abs(damageHero(h, 100, 0, 0, null, imp3) - 120) < 1e-6, 'torture kit');
        // 종족 확률: 망자의 성배면 같은 등급에서 언데드가 더 자주
        const count = relics => {
            start(relics, 'prep');
            let undead = 0;
            for (let i = 0; i < 300; i++) if (MONSTERS[Game.rollSummon()].family === 'undead') undead++;
            return undead;
        };
        const plain = count([]), grail = count(['undead_grail']);
        assert(grail > plain * 1.4, 'undead odds up: ' + plain + ' -> ' + grail);
        // 일곱 번째 별: 7번째 소환은 영웅 이상
        start(['seventh_star'], 'prep');
        Game.summonCount = 6;
        assert(GRADE_ORDER.indexOf(MONSTERS[Game.rollSummon()].grade) >= GRADE_ORDER.indexOf('epic'), 'seventh star');
        // 유리 심장, 군단의 깃발, 상인의 보증서, 마왕의 갑옷, 저주받은 왕관
        Game.reset({ lord: 'rift', relics: [] }, STAGES[5].id);
        const base = Game.maxHp();
        start(['lord_armor']);
        assert.strictEqual(Game.maxHp(), base + 10, 'lord armor');
        start(['cursed_crown']);
        assert.strictEqual(Game.maxHp(), Math.floor(base / 2), 'cursed crown halves hp');
        assert(Math.abs(Game.mods.damage - 0.4) < 1e-9, 'cursed crown damage');
        // 진군의 북, 순혈의 왕관, 균형의 저울, 거인의 장갑
        start(['march_drum', 'pure_crown']);
        const o1 = put(ofFamily('orc'));
        put(ofFamily('orc'));
        assert(Math.abs(Game.relicDamage(o1) - (0.06 + 0.4)) < 1e-9, 'drum and pure crown');
        start(['balance_scale']);
        const fams = Object.keys(MONSTER_FAMILIES).map(f => put(ofFamily(f)));
        assert(Math.abs(Game.relicDamage(fams[0]) - 0.25) < 1e-9, 'balance scale');
        // 마나 결정: 1을 받으면 1.5(소수는 모아 둔다)
        Game.reset({ lord: 'rift', relics: [] }, STAGES[5].id);
        Game.mods = buildMods('rift', ['mana_crystal']);
        Game.addMana(1);
        Game.addMana(1);
        assert.strictEqual(Game.mana, 3, 'mana crystal');
        // 학살의 종: 처치 게이지, 1000이면 눌러서 큰 피해
        start(['slaughter_bell']);
        assert.strictEqual(relicCharge('slaughter_bell'), 0, 'gauge empty');
        assert(!Game.act({ kind: 'relicFire', id: 'slaughter_bell' }).ok, 'not ready');
        const e = hero(300, 'elite');
        damageHero(e, 1e9, 0, 0);
        assert.strictEqual(Game.relicGauge, 10, 'elite +10');
        Game.relicGauge = 1000;
        const big = hero(), bossy = hero(400, 'boss');
        assert(Game.act({ kind: 'relicFire', id: 'slaughter_bell' }).ok && Game.relicGauge === 0, 'fired');
        assert(Math.abs(big.hp - 50000) < 1e-6 && Math.abs(bossy.hp - 90000) < 1e-6, '50% and boss 10%');
        // 영혼 수확 낫: 정예 5마리면 공격 속도
        start(['soul_scythe']);
        const mm = put(ofFamily('beast'));
        for (let i = 0; i < 5; i++) damageHero(hero(300, 'elite'), 1e9, 0, 0);
        assert(Game.act({ kind: 'relicFire', id: 'soul_scythe' }).ok && mm.buffT === 10, 'scythe');
        // 불사의 왕관: 한 번은 라운드를 다시
        start(['undying_crown']);
        hero();
        damageThrone(Game.hp);
        assert(Game.state === 'prep' && Game.hp === Game.maxHp() && Game.heroes.length === 0, 'undying restarts the round');
        Game.state = 'wave';
        damageThrone(Game.hp);
        assert.strictEqual(Game.state, 'defeat', 'only once');
        // 시간 도둑의 모래, 깨진 모래시계
        start(['thief_sand'], 'prep');
        Game.waveIndex = Game.waves.findIndex(w => w.boss);
        Game.startWave();
        assert(Math.abs(Game.roundTimer - (COMBAT_RULES.bossRoundTime + 15)) < 1e-6, 'boss time +15');
        // 장비 먹는 괴물: 두 칸
        start(['equip_eater'], 'prep');
        const knight = put(ofFamily('orc'));
        Game.equipBag = Object.keys(EQUIPMENT).filter(id => !EQUIP_BASES.includes(id)).slice(0, 2); // 완성 장비 둘(재료끼리는 조합된다)
        Game.equipMonster(knight, 0);
        Game.equipMonster(knight, 0);
        assert(knight.equip && knight.equip2 && Game.equipBag.length === 0, 'two equips');
        assert(Game.unequipMonster(knight).ok && !knight.equip2 && knight.equip, 'second comes off first');
        // 탐식의 위장, 신화의 파편 없이도 합치면 쌓인다
        start(['glutton_stomach'], 'prep');
        const t1 = put('orc_guard'), t2 = put('orc_guard');
        put('orc_guard');
        const res = Game.act({ kind: 'merge', src: t1, dst: t2 });
        assert(res.ok && Math.abs(res.monster.feast - 0.05) < 1e-9, 'feast stacks');
        // 쌍날 검: 확률 1이면 두 번
        start(['twin_blade']);
        Game.mods.doubleHit = 1;
        const o2 = put(ofFamily('orc'));
        h = hero();
        damageHero(h, 100, 0, 0, null, o2);
        assert(Math.abs(h.maxHp - h.hp - 200) < 1e-6, 'twin blade hits twice');
        console.log('smoke ok: relics v2');
    }).toString() + ')()', rctx);
}
// 종족 강화: 골드로 종족 피해를 올린다. 3레벨부터 성공률이 내려가고 실패해도 골드를 쓴다. 성공 여부는 시드 난수
{
    const fctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted(v) { this.muted = v; }, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), fctx, { filename: f });
    vm.runInContext('UI.tutorialOff = true', fctx);
    vm.runInContext('(' + (() => {
        assert.deepStrictEqual([0, 1, 2, 3, 4, 9, 30].map(familyUpgradeCost), [50, 100, 150, 200, 250, 500, 1550], 'cost rises without a cap');
        assert.deepStrictEqual([0, 2, 3, 4, 8, 9, 20].map(familyUpgradeChance), [1, 1, 0.9, 0.8, 0.4, 0.3, 0.3], 'chance falls to a floor');
        Game.reset(null, null, abyssChallenge('fam-w', 'rift', [], 3));
        Game.state = 'wave';
        // 피해: 그 종족만 레벨당 +8%
        const k = [...BUILD_CELLS].find(x => { const [a, r] = x.split(',').map(Number); return Game.canPlace('fire_imp', a, r); }).split(',').map(Number);
        const imp = Game.place('fire_imp', k[0], k[1]) || Game.monsters[Game.monsters.length - 1];
        const fam = MONSTERS[imp.type].family;
        const other = Object.keys(MONSTER_FAMILIES).find(f => f !== fam);
        const base = monsterStats(imp).damage;
        Game.familyLevels[other] = 5;
        assert.strictEqual(monsterStats(imp).damage, base, 'other families do not count');
        Game.familyLevels[fam] = 3;
        assert(Math.abs(monsterStats(imp).damage - base * 1.24) < 1e-9, 'three levels = +24%');
        Game.familyLevels = {};
        // 골드가 모자라면 못 한다. 확실한 레벨은 늘 오른다
        Game.gold = 40;
        assert.strictEqual(Game.act({ kind: 'familyUp', family: fam }).reason, 'gold');
        assert.strictEqual(Game.act({ kind: 'familyUp', family: 'nope' }).reason, 'family');
        Game.gold = 1e6;
        for (let i = 0; i < 3; i++) assert(Game.act({ kind: 'familyUp', family: fam }).success, 'sure levels');
        assert.strictEqual(Game.familyLevel(fam), 3);
        // 높은 레벨: 실패가 섞이고, 실패해도 골드는 나간다
        let fails = 0;
        for (let i = 0; i < 40; i++) {
            const lv = Game.familyLevel(fam);
            const g0 = Game.gold;
            const r = Game.act({ kind: 'familyUp', family: fam });
            assert(r.ok && g0 - Game.gold === familyUpgradeCost(lv), 'pays the cost either way');
            if (!r.success) { fails++; assert.strictEqual(Game.familyLevel(fam), lv, 'failure keeps the level'); }
        }
        assert(fails > 0 && Game.familyLevel(fam) > 3, 'some fail, some succeed');
        // 같은 시드와 입력이면 같은 결과(입력 재생)
        const run = () => {
            Game.reset(null, null, abyssChallenge('fam-r', 'rift', [], 3));
            Game.state = 'wave';
            Game.gold = 1e6;
            for (let i = 0; i < 25; i++) Game.act({ kind: 'familyUp', family: 'demon' });
            return Game.familyLevel('demon');
        };
        assert.strictEqual(run(), run(), 'seeded');
        assert(Game.record.inputs.some(i => i.kind === 'familyUp' && i.family === 'demon'), 'recorded');
    }).toString() + ')()', fctx);
    console.log('smoke ok: family upgrade');
}
// 신화 몬스터는 기술마다 동작(skill0, skill1)이 있고, 기술을 쓰면 그 동작을 고른다. 일반 공격은 공격 동작
{
    const sctx = vm.createContext({ console, assert, Math, Set, Map, Object, Array, Infinity, Number, String, JSON,
        Sfx: { play() {}, unlock() {}, setMuted() {}, muted: false, volume: { master: 80, sfx: 80, bgm: 60 }, setVolume() {} }, saveSettings() {}, Render: {}, UIKit: {}, Assets: { get() { return null; } } });
    for (const f of [...files.filter(f => !f.startsWith('js/ui/')), 'js/data/fx_sheets.js', 'js/ui/uikit.js', 'js/game/render.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sctx, { filename: f });
    vm.runInContext('(' + (() => {
        const mythic = Object.keys(MONSTERS).filter(k => ['mythic', 'legendary'].includes(MONSTERS[k].grade) && (MONSTERS[k].skills || []).length && ASTERIA_ART[k]);
        for (const k of mythic) MONSTERS[k].skills.forEach((s, i) => assert(MONSTERS[k].art.anim['skill' + i] && MONSTERS[k].art.anim['skill' + i].frames === 8, k + ' skill motion ' + i));
        const m = { type: 'time_witch', atkPose: 0.5, atkPoseMax: 0.75, dir: 'down', skillPose: 1 };
        assert.strictEqual(Render.monsterFrame(MONSTERS.time_witch, m).clip.folder, 'skill1', 'skill motion picked');
        m.skillPose = -1;
        assert.strictEqual(Render.monsterFrame(MONSTERS.time_witch, m).clip.folder, 'attack', 'plain attack');
    }).toString() + ')()', sctx);
    console.log('smoke ok: mythic skill motions');
}
require('./smoke_maps.js');
