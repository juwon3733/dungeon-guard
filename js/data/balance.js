// 계획서의 초기값. 거리는 타일 단위, 시간은 초 단위다.
const FACILITIES = {
    archer: {
        name: '유령 궁수탑', role: '단일 공격', cost: 50, damage: 8, interval: 0.8, range: 3,
        desc: '가장 앞선 용사를 빠르게 쏩니다.',
        branches: {
            A: { name: '연사', desc: '공격 간격 0.4초', interval: 0.4 },
            B: { name: '저격', desc: '피해 3배, 사거리 5', damageMul: 3, range: 5 }
        }
    },
    crystal: {
        name: '암흑 수정', role: '광역 공격', cost: 100, damage: 20, interval: 2.0, range: 2.5, splash: 1,
        desc: '마력 구체로 무리를 함께 공격합니다.',
        branches: {
            A: { name: '폭발', desc: '피해 범위 반경 2', splash: 2 },
            B: { name: '관통', desc: '일직선 빔으로 공격', beam: true }
        }
    },
    barracks: {
        name: '오크 초소', role: '길막기', cost: 70, damage: 6, interval: 1.0, range: 1.6,
        unitHp: 60, respawn: 8, unitCount: 2,
        desc: '오크 2기가 길을 막고 싸웁니다.',
        branches: {
            A: { name: '중갑', desc: '받는 피해 40% 감소', armor: 0.4 },
            B: { name: '광전사', desc: '피해 2배, 공격 간격 0.5초', damageMul: 2, interval: 0.5 }
        }
    }
};

// 2단계 비용은 건설비의 80%, 3단계는 150%
function upgradeCost(type, nextTier) {
    return Math.round(FACILITIES[type].cost * (nextTier === 2 ? 0.8 : 1.5));
}

// PixelLab 동작 그림. dirs가 있으면 그 방향만 있고, 서쪽은 동쪽을 뒤집어 쓴다.
// footPx는 캔버스 안의 발끝 높이다. 캔버스 크기가 방향마다 달라 방향별로 적기도 한다
const PL_DIRS = ['south', 'east', 'north'];
const ORC_ART = {
    sprite: 'pl_orc_guard', scale: 2, barY: 84,
    anim: {
        walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 53, east: 53, north: 58 } },
        attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 50, east: 52, north: 51 } }
    }
};

const FACILITY_ART = {
    archer: { sprite: 'pl_fac_archer', footPx: 92 },
    crystal: { sprite: 'pl_fac_crystal', footPx: 91 },
    barracks: { sprite: 'pl_fac_barracks', footPx: 91 }
};

const HEROES = {
    warrior: {
        // PixelLab 그림. barY는 체력바 높이(발 기준 위쪽 세계 px)
        // anim은 animations 아래 폴더 이름과 프레임 수, footPx는 64px 캔버스 안의 발끝 높이다
        anim: {
            walk: { folder: 'walking', frames: 6, footPx: 54 },
            attack: { folder: 'slash', frames: 6, footPx: 53 },
            death: { folder: 'falling_backward', frames: 7, footPx: 55 }
        },
        name: '전사', sprite: 'pl_hero_warrior', scale: 2, barY: 84, hp: 24, speed: 0.8, bounty: 3, damage: 4, interval: 1.0, armor: 2,
        counter: '갑옷, 강한 공격으로'
    },
    rogue: {
        anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 62, east: 53, north: 54 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 55, east: 53, north: 52 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 55 }
        },
        name: '도적', sprite: 'pl_hero_rogue', scale: 2, barY: 84, hp: 12, speed: 1.6, bounty: 2, damage: 3, interval: 0.6,
        counter: '빠름, 오크로 막기'
    },
    mage: {
        anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 54, east: 53, north: 52 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 53, east: 53, north: 50 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 53 }
        },
        atkTime: 0.45, // 주문 동작 표시 시간(초). 근접 공격 동작(0.4)보다 조금 길다
        name: '마법사', sprite: 'pl_hero_mage', scale: 2, barY: 84, hp: 14, speed: 1.0, bounty: 3, damage: 3, interval: 1.0,
        stunEvery: 6, stunRange: 3, stunTime: 2,
        counter: '시설 정지, 먼저 처치'
    }
};

// 정예 용사: 같은 직업(base)의 능력치를 물려받고 여기 적은 값만 바꾼다. 수치는 플레이 후 고칠 초안이다.
// 그림은 Asteria 직업 그림(동작 정의 anim 없음)이다. sprite에 '_female'을 붙인 그림도 쓴다.
// footPx는 64px 캔버스 안의 발끝 높이, barY는 체력바 높이(발 기준 위쪽 세계 px)다.
const ELITE_RULES = {
    bountyMul: 3,     // 현상금: 같은 직업의 몇 배
    throneDamage: 3,  // 왕좌 도착 시 깎는 마왕 체력(일반 용사는 1)
    corruptMul: 2     // 타락 정예의 체력과 피해: 같은 직업 타락 유닛의 몇 배
};

// 직업 능력 수치도 여기서 고친다. 거리는 칸, 시간은 초다.
// - song: 음유시인의 노래. every초마다 반경 radius 안 용사(자신 포함)의 이동 속도를 speedMul배로 duration초 동안 올린다
// - stunArea: 뇌술사의 범위 감전. warn초 동안 바닥에 경고 원을 띄운 뒤 사거리(stunRange) 안 방어 쪽 전부를 stunTime초 정지
// - breakthrough: 검사의 돌파. 막힌 뒤 after초가 지나면 막은 유닛을 길 옆으로 push칸 밀치고 stun초 정지시킨 뒤,
//   free초 동안 막히지 않고 지나간다
// - passOrcs: 조련사는 오크에게 막히지 않는다(타락 유닛에게는 막힌다)
const ELITES = {
    elite_swordsman: {
        base: 'warrior', name: '정예 검사', sprite: 'swordsman', hpMul: 4, armor: 4,
        breakthrough: { after: 2, push: 0.7, stun: 0.8, free: 1.2 },
        counter: '갑옷 차림 돌파, 큰 한 방으로'
    },
    elite_tamer: {
        base: 'rogue', name: '정예 조련사', sprite: 'beast_tamer', hpMul: 4, speed: 1.3, passOrcs: true,
        counter: '오크를 지나침, 탑으로'
    },
    elite_stormcaller: {
        base: 'mage', name: '정예 뇌술사', sprite: 'stormcaller', hpMul: 4, stunEvery: 4, stunRange: 4, stunTime: 1.5,
        stunArea: { warn: 0.5 },
        counter: '범위 감전, 먼저 처치'
    },
    elite_rhapsodist: {
        // 노래만 하고 정지 주문은 쓰지 않는다(stunEvery 0)
        base: 'mage', name: '정예 음유시인', sprite: 'rhapsodist', hpMul: 4, stunEvery: 0,
        song: { every: 5, radius: 3, speedMul: 1.25, duration: 3 },
        counter: '주변 용사 가속, 먼저 처치'
    }
};
// Why: 세계 2배(scale 2)는 일반 용사보다 1.25배 정도라 구분이 안 됐다. 2 / WORLD_ZOOM이면 화면에서 원본 2배라 도트도 고르다.
const ELITE_ART = { scale: 2 / WORLD_ZOOM, footPx: 59, barY: 142 };

// 층 보스. 웨이브 표의 boss 칸에 여기 열쇠를 적는다(예: boss: 'archmage').
// 체력은 base 직업 체력 x hpMultiplier x 웨이브 배율이다. patterns는 체력 비율(at) 이하가 되면 한 번씩 쓴다.
// - charge: time초 동안 speed칸/초로 돌진, 막힘 풀림
// - stomp / shock: 멈춰서 windup초 동안 경고 원을 띄운 뒤 반경 range칸 안 방어 쪽 전부를 stun초 정지(stomp는 부대장, shock은 감전)
// art가 없으면 부대장 전용 그림, 있으면 Asteria 직업 그림을 scale배로 그린다. starY는 정지 별 높이(발 기준 위쪽 세계 px)
const BOSSES = {
    fallen_knight: {
        name: '용사단 부대장', portrait: 'portrait_fallenKnight', note: '돌진, 주변 시설·유닛 정지',
        hpMultiplier: 15, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0, throneDamage: 5,
        starY: 165,
        patterns: [
            { at: 0.5, kind: 'charge', time: 3, speed: 2.2 },
            { at: 0.25, kind: 'stomp', windup: 1.2, range: 3, stun: 3 }
        ]
    },
    archmage: {
        name: '용사단 대마도사', portrait: 'stormcaller_walk_down0', note: '체력 50%·25%에 범위 감전',
        // 체력 체계는 부대장과 같다(전사 체력 x 15)
        hpMultiplier: 15, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0, throneDamage: 5,
        art: { sprite: 'stormcaller', scale: 3 / WORLD_ZOOM, footPx: 59 }, starY: 225,
        patterns: [
            { at: 0.5, kind: 'shock', windup: 1.0, range: 3, stun: 2.5 },
            { at: 0.25, kind: 'shock', windup: 1.6, range: 5, stun: 3 }
        ]
    }
};

const COMBAT_RULES = {
    startGold: 130,
    maxHp: 20,
    waveBaseReward: 20,
    waveStepReward: 5,
    spawnGap: 0.34,
    prepTime: 20,
    firstPrepTime: 35,
    earlyGoldPerSecond: 1,
    sellRefund: 0.7,
    hpPerWave: 0.14,
    corpseTime: 5,
    corruptCostMul: 8,
    corruptMax: 3,
    lightning: { damage: 40, radius: 1.5, cooldown: 30 },
    roar: { unlockHp: 10, duration: 3, cooldown: 60 }
};

// 타락 유닛의 능력치. ranged는 길을 막지 않는다.
const CORRUPTED = {
    warrior: { name: '타락 전사', hp: 60, damage: 8, interval: 1.0, range: 1.1 },
    rogue: { name: '타락 도적', hp: 40, damage: 18, interval: 0.8, range: 1.1 },
    mage: { name: '타락 마법사', hp: 30, damage: 10, interval: 1.2, range: 2.5, ranged: true }
};

// elites는 일반 인원(members)에 더해 섞이는 정예 용사 수다. boss는 BOSSES의 열쇠다
const WAVES = [
    { party: '신참 원정대', members: { warrior: 9 } },
    { party: '마을 자경단', members: { warrior: 12 } },
    { party: '날쌘 도굴꾼', members: { rogue: 8 }, elites: { elite_tamer: 1 } },
    { party: '수상한 혼성대', members: { warrior: 12, rogue: 6 }, elites: { elite_swordsman: 1 } },
    { party: '견습 마법사와 친구들', members: { warrior: 15, mage: 3 }, elites: { elite_stormcaller: 1 } },
    { party: '보물 사냥단', members: { rogue: 20 }, elites: { elite_tamer: 2, elite_rhapsodist: 1 } },
    { party: '왕국 정찰대', members: { warrior: 18, rogue: 9, mage: 3 }, elites: { elite_swordsman: 1, elite_stormcaller: 1 } },
    { party: '은빛 검 기사단', members: { warrior: 28, mage: 6 }, elites: { elite_swordsman: 2, elite_rhapsodist: 1 } },
    { party: '최후의 선봉대', members: { warrior: 24, rogue: 15, mage: 9 }, elites: { elite_swordsman: 1, elite_tamer: 1, elite_stormcaller: 1 } },
    { party: '용사단 본대', boss: 'fallen_knight', members: { warrior: 16, mage: 4 }, elites: { elite_swordsman: 1, elite_rhapsodist: 1, elite_stormcaller: 1 } }
];

// 정예를 HEROES와 CORRUPTED에 같은 직업 기준으로 채워 넣는다. 다른 코드는 HEROES[type]으로 똑같이 읽는다.
for (const [type, elite] of Object.entries(ELITES)) {
    const base = HEROES[elite.base];
    const { anim, atkTime, ...stats } = base; // Asteria 그림이라 PixelLab 동작 정의는 물려받지 않는다
    const { base: baseType, hpMul, ...overrides } = elite;
    HEROES[type] = {
        ...stats, ...ELITE_ART, ...overrides,
        elite: true, baseType,
        hp: base.hp * hpMul,
        bounty: base.bounty * ELITE_RULES.bountyMul,
        throneDamage: ELITE_RULES.throneDamage
    };
    const corrupt = CORRUPTED[elite.base];
    CORRUPTED[type] = {
        ...corrupt, name: `타락 ${elite.name}`,
        hp: corrupt.hp * ELITE_RULES.corruptMul,
        damage: corrupt.damage * ELITE_RULES.corruptMul
    };
}

const SPEECH = {
    waveStart: ['또 왔어?', '문 좀 닫고 다녀라.', '이번엔 몇 명이야?', '내 낮잠 시간인데.'],
    throneHit: ['내 의자 만지지 마!', '거기 먼지 묻잖아!', '아야, 내 왕좌!'],
    corrupt: ['복지가 더 좋네요.', '여기 야근 있나요?', '마왕님 만세, 네.'],
    arrive: ['다시 올 거야!', '왕좌 찍었다!', '인증샷 완료!'],
    boss: ['부대장이 왔다. 넌 끝이야!', '내 경력을 걸고 베겠다!'],
    elite: ['정예 등장. 사인은 나중에.', '연봉이 다르다, 연봉이!', '나 이번 달 승진 심사야.']
};
