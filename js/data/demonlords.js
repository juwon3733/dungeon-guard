// 마왕과 유물. 판을 시작하기 전에 마왕 1명과 유물(유물 칸 수 Meta.relicSlots()개까지)을 고른다. 판 중에는 유물을 얻지 않는다.
// unlock은 해금 가격(영혼석)이다. 0이면 처음부터 쓸 수 있다. 영혼석과 유물 칸은 META_RULES, 저장은 js/game/meta.js
// 마왕과 유물은 같은 효과 키(LORD_EFFECTS)를 쓴다. 코드는 마왕이나 유물 id가 아니라 효과 키로 동작한다.
// 한 판의 효과는 buildMods로 합쳐 Game.mods에 두고, 각 계산 지점이 읽는다. 값이 없으면 효과가 없는 기본값이다.
// 설계: docs/MONSTER_DESIGN.md. 수치는 플레이 후 고칠 초안이다.

// 효과 키
//   mode: add(더한다, 기본 0) | ratio(비율, 0.1 = +10%. 여러 개면 더한다, 기본 0) | mul(곱한다, 기본 1)
//   name: 설명 문구 이름, unit: add 값 뒤에 붙는 글자, pct: mul 값을 '×1.25' 대신 '+25%'로 적는다
//   low: 값이 작을수록 마왕에게 좋은 키(설명 글자 색에만 쓴다)
//   몬스터 수치(damage, hp, attackSpeed, range)는 monsterStats에서 장비 다음에 곱한다. 공격 속도는 공격 간격을 나눈다
const LORD_EFFECTS = {
    startGold: { name: '시작 골드', mode: 'add', unit: 'G' },
    maxHp: { name: '최대 체력', mode: 'add' },
    skillCooldown: { name: '스킬 재사용', mode: 'mul', low: true },
    lightningDamage: { name: '번개 피해', mode: 'mul', pct: true },
    heroSpeed: { name: '용사 이동 속도', mode: 'mul', low: true },
    damage: { name: '몬스터 피해', mode: 'ratio' },
    hp: { name: '몬스터 체력', mode: 'ratio' },
    attackSpeed: { name: '몬스터 공격 속도', mode: 'ratio' },
    range: { name: '몬스터 사거리', mode: 'ratio' },
    xp: { name: '처치 경험치', mode: 'ratio' },
    bounty: { name: '처치 골드', mode: 'mul' },
    rareChance: { name: '소환 희귀 확률', mode: 'ratio' }, // 희귀 확률에 더하고 일반에서 뺀다
    summonBase: { name: '소환 시작 비용', mode: 'add', unit: 'G', low: true },
    fieldMax: { name: '맵 몬스터 상한', mode: 'add' },
    respawn: { name: '부활 시간', mode: 'mul', low: true }, // 막는 몬스터가 쓰러졌다 다시 나오는 시간
    eliteDrop: { name: '정예 장비 드롭', mode: 'ratio' }, // EQUIP_RULES.eliteDrop에 더한다
    refund: { name: '판매 환불', mode: 'mul' },
    sacrifice: { name: '제물 효과', mode: 'mul' } // 체력 회복과 번개 감소에 곱한다(체력은 내림)
};

// 마왕. 스킬은 셋 다 번개와 호통이다(전용 몬스터는 다음 단계).
//   sprite: 왕좌의 대기 그림, cast: 주문 그림(없으면 sprite를 쓰고 빛 효과로 구분), footPx: 128px 캔버스 안의 발끝 높이
//   portrait: 마왕 탭 초상. crop이 있으면 sprite에서 [x, y, 크기]를 잘라 쓴다(머리 부분)
//   speech: SPEECH에 더해 이 마왕만 하는 대사
const DEMON_LORDS = {
    rift: {
        id: 'rift', name: '균열의 군주', unlock: 0, desc: '번개로 직접 싸운다. 부하들은 박수만 친다.',
        sprite: 'boss_rift_lord_down', cast: 'boss_rift_lord_cast', footPx: 118,
        portrait: { sprite: 'portrait_riftLord' },
        effects: { lightningDamage: 1.25, skillCooldown: 0.9 },
        speech: {
            waveStart: ['오늘 전기세는 너희가 낸다.'],
            throneHit: ['찌릿하게 해 줄까?'],
            sacrifice: ['좋아, 번개 충전 완료.']
        }
    },
    bone_queen: {
        id: 'bone_queen', name: '뼈의 여왕', unlock: 20, desc: '몬스터를 빨리 키운다. 쓰러져도 금방 일으킨다.',
        sprite: 'lord_bone_queen', footPx: 119,
        portrait: { sprite: 'lord_bone_queen', crop: [42, 4, 44] },
        effects: { respawn: 0.6, xp: 0.25, maxHp: -3 },
        speech: {
            waveStart: ['얘들아, 간식 왔다. 뼈는 남기지 마.'],
            throneHit: ['내 왕관 삐뚤어졌잖아!'],
            sacrifice: ['다시 태어나면 더 크게 자라렴.']
        }
    },
    gold_king: {
        id: 'gold_king', name: '황금 마왕', unlock: 20, desc: '돈으로 해결한다. 몸은 조금 약하다.',
        sprite: 'lord_gold_king', footPx: 120,
        portrait: { sprite: 'lord_gold_king', crop: [40, 6, 44] },
        effects: { startGold: 100, bounty: 1.2, maxHp: -5 },
        speech: {
            waveStart: ['입장료는 냈나? 안 냈으면 목숨으로.'],
            throneHit: ['이 의자 얼마짜린 줄 알아?!'],
            sacrifice: ['이건 낭비가 아니라 투자다.']
        }
    }
};
const DEFAULT_LORD = 'rift';

// 영구 수집(수치 초안). 판이 끝나면 막은 웨이브 수 x soulsPerWave, 승리하면 winBonus를 더 받는다.
// 유물 칸은 relicSlots.start개로 시작해 prices 순서대로 산다(2번째 30, 3번째 80). 최대는 start + prices.length
const META_RULES = {
    soulsPerWave: 2,
    winBonus: 15,
    relicSlots: { start: 1, prices: [30, 80] }
};

// 유물: 시작할 때 유물 칸 수만큼 고른다. 그림은 assets/sprites/relic_<id>.png(48px)
const RELICS = {
    pouch: { id: 'pouch', name: '황금 주머니', unlock: 0, effects: { startGold: 100 } },
    chalice: { id: 'chalice', name: '피의 성배', unlock: 0, effects: { maxHp: 5 } },
    hourglass: { id: 'hourglass', name: '모래시계', unlock: 14, effects: { skillCooldown: 0.8 } },
    candle: { id: 'candle', name: '푸른 촛불', unlock: 8, effects: { heroSpeed: 0.92 } },
    tablet: { id: 'tablet', name: '룬 석판', unlock: 8, effects: { range: 0.1 } },
    handgem: { id: 'handgem', name: '해골 손', unlock: 14, effects: { rareChance: 0.05 } },
    drum: { id: 'drum', name: '전쟁 북', unlock: 8, effects: { attackSpeed: 0.1 } },
    horn: { id: 'horn', name: '악마 뿔', unlock: 0, effects: { damage: 0.1 } },
    key: { id: 'key', name: '박쥐 열쇠', unlock: 14, effects: { eliteDrop: 0.15 } },
    heart: { id: 'heart', name: '갇힌 심장', unlock: 0, effects: { hp: 0.15 } },
    bottle: { id: 'bottle', name: '번개 병', unlock: 14, effects: { lightningDamage: 1.5 } },
    eye: { id: 'eye', name: '마녀의 눈', unlock: 8, effects: { xp: 0.5 } },
    banner: { id: 'banner', name: '마왕군 깃발', unlock: 14, effects: { fieldMax: 4 } },
    dice: { id: 'dice', name: '뼈 주사위', unlock: 8, effects: { summonBase: -5 } },
    shackles: { id: 'shackles', name: '푸른 족쇄', unlock: 14, effects: { respawn: 0.7 } },
    mirror: { id: 'mirror', name: '금 간 거울', unlock: 14, effects: { refund: 1.5, sacrifice: 1.5 } }
};

// 표에 있는 id인지('toString' 같은 Object 속성 이름은 아니다)
function hasEntry(table, id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(table, id); }

// 효과가 없는 기본값(모든 키)
function emptyMods() {
    const mods = {};
    for (const [key, e] of Object.entries(LORD_EFFECTS)) mods[key] = e.mode === 'mul' ? 1 : 0;
    return mods;
}

// 마왕과 유물의 효과를 하나로 합친다. 모르는 id와 키는 건너뛴다
function buildMods(lordId, relicIds) {
    const mods = emptyMods();
    const sources = [hasEntry(DEMON_LORDS, lordId) && DEMON_LORDS[lordId], ...(relicIds || []).map(id => hasEntry(RELICS, id) && RELICS[id])].filter(Boolean);
    for (const src of sources) {
        for (const [key, v] of Object.entries(src.effects)) {
            if (!hasEntry(LORD_EFFECTS, key)) continue;
            const e = LORD_EFFECTS[key];
            if (e.mode === 'mul') mods[key] *= v;
            else mods[key] += v;
        }
    }
    return mods;
}

// 효과 하나의 설명: "시작 골드 +100G", "번개 피해 +25%", "스킬 재사용 ×0.9"
function effectText(key, v) {
    const e = LORD_EFFECTS[key];
    const round = x => Math.round(x * 1000) / 1000;
    const signed = x => `${x < 0 ? '-' : '+'}${round(Math.abs(x))}`;
    if (e.mode === 'add') return `${e.name} ${signed(v)}${e.unit || ''}`;
    if (e.mode === 'ratio') return `${e.name} ${signed(v * 100)}%`;
    if (e.pct) return `${e.name} ${signed((v - 1) * 100)}%`;
    return `${e.name} ×${round(v)}`;
}

// 마왕에게 좋은 효과인지(설명 글자 색)
function effectGood(key, v) {
    const e = LORD_EFFECTS[key];
    const up = e.mode === 'mul' ? v > 1 : v > 0;
    return e.low ? !up : up;
}

// 합친 효과 중 기본값과 다른 것만 { key, value } 목록으로(LORD_EFFECTS 순서)
function modsChanged(mods) {
    const base = emptyMods();
    return Object.keys(LORD_EFFECTS).filter(k => Math.abs(mods[k] - base[k]) > 1e-9).map(k => ({ key: k, value: mods[k] }));
}

// 마왕이나 유물의 효과 설명 줄(표에 적은 순서)
function effectLines(effects) {
    return Object.keys(effects).filter(k => hasEntry(LORD_EFFECTS, k)).map(k => effectText(k, effects[k]));
}

// 저장했거나 넘겨받은 선택을 쓸 수 있는 값으로 고친다: 없거나 잠긴 마왕은 기본 마왕, 없거나 잠긴 유물과 겹친 유물은 빼고
// 유물 칸 수(Meta.relicSlots())까지. 해금 상태는 Meta(js/game/meta.js)를 읽는다
function cleanLoadout(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const lord = Meta.hasLord(src.lord) ? src.lord : DEFAULT_LORD;
    const relics = [];
    for (const id of Array.isArray(src.relics) ? src.relics : []) {
        if (Meta.hasRelic(id) && !relics.includes(id) && relics.length < Meta.relicSlots()) relics.push(id);
    }
    return { lord, relics };
}
