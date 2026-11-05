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

const HEROES = {
    warrior: {
        name: '전사', sprite: 'swordsman', hp: 24, speed: 0.8, bounty: 3, damage: 4, interval: 1.0, armor: 2,
        counter: '갑옷, 강한 공격으로'
    },
    rogue: {
        name: '도적', sprite: 'beast_tamer', hp: 12, speed: 1.6, bounty: 2, damage: 3, interval: 0.6,
        counter: '빠름, 오크로 막기'
    },
    mage: {
        name: '마법사', sprite: 'stormcaller', hp: 14, speed: 1.0, bounty: 3, damage: 3, interval: 1.0,
        stunEvery: 6, stunRange: 3, stunTime: 2,
        counter: '시설 정지, 먼저 처치'
    }
};

const FLOOR_BOSS = {
    name: '용사단 부대장', hpMultiplier: 15, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0,
    throneDamage: 5, chargeAt: 0.5, chargeTime: 3, chargeSpeed: 2.2,
    stompAt: 0.25, stompWindup: 1.2, stompRange: 3, stompStun: 3
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

const WAVES = [
    { party: '신참 원정대', members: { warrior: 9 } },
    { party: '마을 자경단', members: { warrior: 12 } },
    { party: '날쌘 도굴꾼', members: { rogue: 8 } },
    { party: '수상한 혼성대', members: { warrior: 12, rogue: 6 } },
    { party: '견습 마법사와 친구들', members: { warrior: 15, mage: 3 } },
    { party: '보물 사냥단', members: { rogue: 20 } },
    { party: '왕국 정찰대', members: { warrior: 18, rogue: 9, mage: 3 } },
    { party: '은빛 검 기사단', members: { warrior: 28, mage: 6 } },
    { party: '최후의 선봉대', members: { warrior: 24, rogue: 15, mage: 9 } },
    { party: '용사단 본대', boss: true, members: { warrior: 16, mage: 4 } }
];

const SPEECH = {
    waveStart: ['또 왔어?', '문 좀 닫고 다녀라.', '이번엔 몇 명이야?', '내 낮잠 시간인데.'],
    throneHit: ['내 의자 만지지 마!', '거기 먼지 묻잖아!', '아야, 내 왕좌!'],
    corrupt: ['복지가 더 좋네요.', '여기 야근 있나요?', '마왕님 만세, 네.'],
    arrive: ['다시 올 거야!', '왕좌 찍었다!', '인증샷 완료!'],
    boss: ['부대장이 왔다. 넌 끝이야!', '내 경력을 걸고 베겠다!']
};
