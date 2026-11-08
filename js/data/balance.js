// 계획서의 초기값. 거리는 타일 단위, 시간은 초 단위다. 몬스터 표는 js/data/monsters.js에 있다.

// 타락(쓰러진 용사를 눌러 부하로 만들기): 사용자가 생각보다 별로라고 해 일단 끈다(2026-11-07).
// 코드와 그림은 남겨 두었고 true로 바꾸면 그대로 되살아난다. smoke 시험이 잠시 켜 보므로 let으로 둔다.
let CORRUPTION_ENABLED = false;
// 타락이 꺼져 있을 때 시체: 쓰러지는 동작(초당 CORPSE_FALL_FPS 프레임)을 재생한 뒤 CORPSE_FADE_TIME초 동안 서서히 사라진다
const CORPSE_FALL_FPS = 14;
const CORPSE_FADE_TIME = 1;

// PixelLab 동작 그림. dirs가 있으면 그 방향만 있고, 서쪽은 동쪽을 뒤집어 쓴다.
// footPx는 캔버스 안의 발끝 높이다. 캔버스 크기가 방향마다 달라 방향별로 적기도 한다
const PL_DIRS = ['south', 'east', 'north'];
const ORC_ART = {
    sprite: 'pl_orc_guard', scale: PIXEL_SCALE, barY: 126,
    anim: {
        walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 53, east: 53, north: 58 } },
        attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 50, east: 52, north: 51 } }
    }
};

// 떼로 몰려오는 일반 용사: 그림은 작게(1.5면 그림 1px이 화면 1px), 수는 countMul배, 대신 한 명의 체력, 처치 골드, 왕좌 피해를 나눈다.
// 정예와 보스에는 쓰지 않는다
const SWARM_RULES = { scale: ART_SCALE, countMul: 3, hpMul: 0.35, bountyMul: 0.35, leak: 0.34 };

const HEROES = {
    warrior: {
        // PixelLab 그림. barY는 체력바 높이(발 기준 위쪽 세계 px)
        // anim은 animations 아래 폴더 이름과 프레임 수, footPx는 64px 캔버스 안의 발끝 높이다
        anim: {
            walk: { folder: 'walking', frames: 6, footPx: 54 },
            attack: { folder: 'slash', frames: 6, footPx: 53 },
            death: { folder: 'falling_backward', frames: 7, footPx: 55 }
        },
        name: '전사', sprite: 'pl_hero_warrior', scale: SWARM_RULES.scale, barY: 70, hp: 24, speed: 0.8, bounty: 3, damage: 4, interval: 1.0, armor: 2,
        counter: '갑옷, 강한 공격으로'
    },
    rogue: {
        anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 62, east: 53, north: 54 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 55, east: 53, north: 52 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 55 }
        },
        name: '도적', sprite: 'pl_hero_rogue', scale: SWARM_RULES.scale, barY: 70, hp: 12, speed: 1.6, bounty: 2, damage: 3, interval: 0.6,
        counter: '빠름, 오크로 막기'
    },
    mage: {
        anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 54, east: 53, north: 52 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 53, east: 53, north: 50 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 53 }
        },
        atkTime: 0.45, // 주문 동작 표시 시간(초). 근접 공격 동작(0.4)보다 조금 길다
        name: '마법사', sprite: 'pl_hero_mage', scale: SWARM_RULES.scale, barY: 70, hp: 14, speed: 1.0, bounty: 3, damage: 3, interval: 1.0,
        stunEvery: 6, stunRange: 3, stunTime: 2,
        counter: '몬스터 정지, 먼저 처치'
    }
};

// 정예 용사: 같은 직업(base)의 능력치를 물려받고 여기 적은 값만 바꾼다. 수치는 플레이 후 고칠 초안이다.
// 그림은 PixelLab 동작 그림(64px 캐릭터)이다. 캔버스가 동작과 방향마다 달라(84, 96 등) footPx를 방향별로 적는다.
// 사망 동작은 전사처럼 남쪽 하나다. barY는 체력바 높이(발 기준 위쪽 세계 px)다.
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
        base: 'warrior', name: '정예 검사', sprite: 'pl_elite_duelist', anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 78, east: 78, north: 68 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 72, east: 72, north: 67 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 72 }
        }, hpMul: 4, armor: 4,
        breakthrough: { after: 2, push: 0.7, stun: 0.8, free: 1.2 },
        counter: '막히면 돌파, 큰 한 방'
    },
    elite_tamer: {
        base: 'rogue', name: '정예 조련사', sprite: 'pl_elite_tamer', anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 78, east: 78, north: 77 } },
            attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 72, east: 74, north: 71 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 72 }
        }, hpMul: 4, speed: 1.3, passOrcs: true,
        counter: '오크를 지나침, 탑으로'
    },
    elite_stormcaller: {
        base: 'mage', name: '정예 뇌술사', sprite: 'pl_elite_thunder_sage', anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 78, east: 79, north: 77 } },
            attack: { folder: 'cast', frames: 6, dirs: PL_DIRS, footPx: { south: 72, east: 72, north: 71 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 72 }
        }, hpMul: 4, stunEvery: 4, stunRange: 4, stunTime: 1.5,
        stunArea: { warn: 0.5 },
        counter: '범위 감전, 먼저 처치'
    },
    elite_rhapsodist: {
        // 노래만 하고 정지 주문은 쓰지 않는다(stunEvery 0)
        base: 'mage', name: '정예 음유시인', sprite: 'pl_elite_bard', anim: {
            walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 78, east: 78, north: 77 } },
            attack: { folder: 'cast', frames: 6, dirs: PL_DIRS, footPx: { south: 72, east: 72, north: 71 } },
            death: { folder: 'falling_backward', frames: 6, dirs: ['south'], footPx: 72 }
        }, hpMul: 4, stunEvery: 0,
        song: { every: 5, radius: 3, speedMul: 1.25, duration: 3 },
        counter: '주변 용사 가속, 먼저 처치'
    }
};
const ELITE_ART = { scale: HERO_SCALE, barY: 192 };

// 층 보스. 웨이브 표의 boss 칸에 여기 열쇠를 적는다(예: boss: 'archmage').
// 체력은 base 직업 체력 x hpMultiplier x 웨이브 배율이다. patterns는 체력 비율(at) 이하가 되면 한 번씩 쓴다.
// - charge: time초 동안 speed칸/초로 돌진, 막힘 풀림
// - stomp / shock: 멈춰서 windup초 동안 경고 원을 띄운 뒤 반경 range칸 안 방어 쪽 전부를 stun초 정지(stomp는 부대장, shock은 감전)
// art는 PixelLab 동작 그림(96px 캐릭터)이다: walk와 attack 동작, footPx는 방향별 캔버스 안의 발끝 높이.
//   windupLoop가 있으면 경고(windup) 중에 공격 동작을 반복하고, 없으면 공격 동작 첫 프레임으로 멈춰 선다.
// portrait는 보스 초상: sprite에서 crop [x, y, 크기]를 잘라 쓴다(마왕 초상과 같은 형식). starY는 정지 별 높이(발 기준 위쪽 세계 px)
// waveHpMul: 웨이브 배율까지 곱한 체력에 한 번 더 곱한다(중간 보스를 약하게. 없으면 1)
// entry: 들어오는 입구(ROUTE_IDS). 없으면 north
const BOSSES = {
    fallen_knight: {
        name: '용사단 부대장', portrait: { sprite: 'pl_boss_captain/rotations/south', crop: [31, 8, 28] }, note: '돌진, 주변 몬스터 정지', entry: 'north',
        hpMultiplier: 15, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0, throneDamage: 5,
        art: {
            sprite: 'pl_boss_captain', scale: BOSS_SCALE,
            anim: {
                walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 120, east: 120, north: 121 } },
                attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 113, east: 116, north: 114 } }
            }
        }, starY: 300,
        patterns: [
            { at: 0.5, kind: 'charge', time: 3, speed: 2.2 },
            { at: 0.25, kind: 'stomp', windup: 1.2, range: 3, stun: 3 }
        ]
    },
    archmage: {
        name: '용사단 대마도사', portrait: { sprite: 'pl_boss_grand_wizard/rotations/south', crop: [31, 18, 28] }, note: '체력 50%·25%에 범위 감전', entry: 'north',
        // 체력 체계는 부대장과 같다(전사 체력 x 15). 5번째 웨이브 중간 보스라 waveHpMul로 낮춘다(초안)
        hpMultiplier: 15, waveHpMul: 0.6, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0, throneDamage: 5,
        art: {
            sprite: 'pl_boss_grand_wizard', scale: BOSS_SCALE, windupLoop: true,
            anim: {
                walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 119, east: 119, north: 110 } },
                attack: { folder: 'cast', frames: 6, dirs: PL_DIRS, footPx: { south: 111, east: 113, north: 109 } }
            }
        }, starY: 290,
        patterns: [
            { at: 0.5, kind: 'shock', windup: 1.0, range: 3, stun: 2.5 },
            { at: 0.25, kind: 'shock', windup: 1.6, range: 5, stun: 3 }
        ]
    }
};

const COMBAT_RULES = {
    startGold: 130,
    maxHp: 20,
    waveBaseReward: 15,
    waveStepReward: 1,
    spawnGap: 0.34,
    prepTime: 3,        // 라운드를 다 잡은 뒤 다음 라운드까지
    firstPrepTime: 15,
    roundTime: 30,      // 라운드 시간. 다 지나면 남은 용사가 있어도 다음 라운드가 시작된다
    bossRoundTime: 45,
    spawnWindow: 14,    // 한 라운드의 용사가 이 시간 안에 다 나온다
    earlyGoldPerSecond: 1,
    nextRoundLock: 2,   // 라운드가 시작되고 이 시간(판 시간, 초) 동안은 다음 라운드를 부를 수 없다(연타로 여러 라운드가 넘어가지 않게)
    hpPerWave: 0.2,
    corpseTime: 5,
    corruptCostMul: 8,
    corruptMax: 3,
    lightning: { damage: 40, radius: 1.5, cooldown: 30 },
    roar: { unlockHp: 10, duration: 3, cooldown: 60 },
    portal: { cooldown: 35, count: 8, back: 6 }, // 권능 균열 열기
    raise: { cooldown: 30, count: 8, radius: 1, damageMul: 0.5 }, // 권능 시체 일으키기
    goldBomb: { cooldown: 25, spend: 0.1, richSpend: 0.2, maxSpend: 500, minGold: 50, radius: 3, bigRadius: 1.5, damagePerGold: 0.5 }, // 권능 금화 폭격
    bribeRoar: { cost: 300, cooldown: 5 }, // 권능 입막음
    miasma: { cooldown: 28, radius: 2, duration: 6, dps: 6, dpsPerRound: 1.5, bigDuration: 3 }, // 권능 역병 구름(초당 피해 = dps + 라운드 x dpsPerRound)
    plague: { sacDps: 5, sacDpsPerRound: 1.2, burstSeconds: 2, deathBelow: 0.1, pandemicEvery: 10, blastRadius: 1, blastMul: 0.4 }, // 역병의 군주 권능 수치
    corpseBlast: { every: 5, quickEvery: 3, radius: 1.5, damageMul: 0.3 }, // 권능 시체 폭발
    chainStrike: { count: 3, radius: 0.75, damageMul: 0.4 } // 권능 연쇄 낙뢰
};

// 타락 유닛의 능력치. ranged는 길을 막지 않는다.
const CORRUPTED = {
    warrior: { name: '타락 전사', hp: 60, damage: 8, interval: 1.0, range: 1.1 },
    rogue: { name: '타락 도적', hp: 40, damage: 18, interval: 0.8, range: 1.1 },
    mage: { name: '타락 마법사', hp: 30, damage: 10, interval: 1.2, range: 2.5, ranged: true }
};

// elites는 일반 인원(members)에 더해 섞이는 정예 용사 수다. boss는 BOSSES의 열쇠다.
// entry는 입구별 비율(ROUTE_IDS 열쇠, 합이 1이 아니어도 비율로 본다). 없으면 모두 북쪽이다.
// 일반과 정예를 합친 인원을 비율대로 나누고(Game.entryCounts) 섞인 순서대로 입구를 정한다. 보스는 BOSSES의 entry를 따른다
const ENTRY_70_30 = { north: 0.7, south: 0.3 };
const ENTRY_60_40 = { north: 0.6, south: 0.4 };
const ENTRY_50_50 = { north: 0.5, south: 0.5 };
// 라운드 표(60라운드). 앞 라운드일수록 적게, 뒤로 갈수록 많이. 10라운드마다 보스, 5라운드마다 정예 묶음.
// 이름은 앞 30개를 뒤 30라운드에 "재집결"로 다시 쓴다. 수치는 플레이 후 고칠 초안이다
const ROUND_NAMES = ['신참 원정대', '마을 자경단', '날쌘 도굴꾼', '수상한 혼성대', '견습 마법사와 친구들', '보물 사냥단', '왕국 정찰대', '은빛 검 기사단', '최후의 선봉대', '대마도사의 제자들', '국경 수비대', '현상금 사냥꾼', '마법 학회 원정대', '왕실 근위대', '용병 대부대', '야습대', '성기사단', '전쟁 마법사단', '왕국 선봉군', '부대장 친위대', '복수의 원정대', '그림자 추적대', '대마법 연합', '철의 군단', '왕국 총동원령', '끝없는 행렬', '성전의 기사들', '현자의 군세', '왕국 최정예', '용사단 본대'];
// 무한 라운드: 인원은 maxCount에서 멈추고(화면과 속도), hpFrom 라운드부터 용사 체력이 라운드마다 hpGrowth배로 늘어 언젠가 무너진다
const ENDLESS_RULES = { maxCount: 270, maxElites: 8, hpFrom: 30, hpGrowth: 1.06 };
const ROUND_RULES = {
    count: r => Math.round((8 + r * 1.1) * SWARM_RULES.countMul),                     // 일반 용사 수(r은 1부터)
    // 구성 순환: 전사 위주, 도적 무리, 혼성, 마법사 많음
    mix: [{ warrior: 1 }, { warrior: 0.7, rogue: 0.3 }, { rogue: 1 }, { warrior: 0.6, mage: 0.4 }, { warrior: 0.5, rogue: 0.3, mage: 0.2 }],
    eliteEvery: 5, eliteBase: 1, elitePer: 15,              // 5라운드마다 정예: 1명 + 15라운드마다 1명
    elites: ['elite_tamer', 'elite_swordsman', 'elite_stormcaller', 'elite_rhapsodist'],
    bosses: ['archmage', 'fallen_knight'],                  // 10라운드마다 번갈아
};
// r번째 라운드(1부터). 무한 라운드도 이 함수로 끝없이 만든다
function buildRound(r) {
    const R = ROUND_RULES;
    const mix = R.mix[r <= 2 ? 0 : (r - 1) % R.mix.length];
    const total = Math.min(ENDLESS_RULES.maxCount, R.count(r));
    const members = {};
    for (const k of Object.keys(mix)) members[k] = Math.max(1, Math.round(total * mix[k]));
    const w = { party: (r > 30 ? '재집결 ' : '') + ROUND_NAMES[(r - 1) % 30], members };
    if (r >= 3) w.entry = r < 5 ? ENTRY_70_30 : (r < 8 ? ENTRY_60_40 : ENTRY_50_50);
    if (r >= 3 && (r % R.eliteEvery === 0 || r === 3)) {
        const n = Math.min(ENDLESS_RULES.maxElites, R.eliteBase + Math.floor(r / R.elitePer));
        w.elites = {};
        for (let i = 0; i < n; i++) { const e = R.elites[(r + i) % R.elites.length]; w.elites[e] = (w.elites[e] || 0) + 1; }
    }
    if (r % 10 === 0) w.boss = R.bosses[(r / 10 - 1) % R.bosses.length];
    return w;
}
const WAVES = Array.from({ length: 60 }, (_, i) => buildRound(i + 1));

// 정예를 HEROES와 CORRUPTED에 같은 직업 기준으로 채워 넣는다. 다른 코드는 HEROES[type]으로 똑같이 읽는다.
for (const [type, elite] of Object.entries(ELITES)) {
    const base = HEROES[elite.base];
    const { anim, atkTime, ...stats } = base; // 정예는 자기 그림과 동작 정의(anim)를 쓴다
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
    sacrifice: ['음, 바삭하군.', '충성심 잘 받았다. 맛있네.', '네 희생은... 기억은 안 할게.', '간식 시간이다!'],
    corrupt: ['복지가 더 좋네요.', '여기 야근 있나요?', '마왕님 만세, 네.'],
    arrive: ['다시 올 거야!', '왕좌 찍었다!', '인증샷 완료!'],
    boss: ['부대장이 왔다. 넌 끝이야!', '내 경력을 걸고 베겠다!'],
    elite: ['정예 등장. 사인은 나중에.', '연봉이 다르다, 연봉이!', '나 이번 달 승진 심사야.']
};
