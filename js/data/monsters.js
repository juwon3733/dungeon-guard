// 몬스터 표. 한 줄을 추가하면 몬스터가 들어간다. 코드는 id가 아니라 역할(role), 수치(stats), 능력 종류(abilities)로 동작을 정한다.
// 설계: docs/MONSTER_DESIGN.md. 수치는 플레이 후 고칠 초안이다. 거리는 타일 단위, 시간은 초 단위다.

// 등급: 낮은 등급부터 적는다. 등급 합치기는 같은 등급 2마리를 바로 다음 등급의 무작위 1마리로 바꾼다.
// 다음 등급에 몬스터가 없으면 그 등급이 최고 등급이라 합칠 수 없다(지금은 영웅. 전설 몬스터는 아직 없다)
// glow는 소환·합치기 연출의 빛 색(r,g,b), light는 어두운 바탕 위 글자 색이다
const MONSTER_GRADES = {
    common: { name: '일반', color: '#9a96a8', glow: '200,196,220', light: '#e8e4f2' },
    rare: { name: '희귀', color: '#4f8cff', glow: '90,150,255', light: '#9cc2ff' },
    epic: { name: '영웅', color: '#b25cff', glow: '190,100,255', light: '#dfa8ff' },
    legendary: { name: '전설', color: '#ffc63d', glow: '255,200,70', light: '#ffe08a' }
};
const GRADE_ORDER = Object.keys(MONSTER_GRADES);

// 소환과 판매. odds는 등급별 소환 확률이다(합이 1). 전설은 몬스터가 생기면 확률을 넣는다
const SUMMON_RULES = {
    cost: 40,       // 소환 1회 골드
    benchSize: 5,   // 하단 대기 칸 수
    odds: { common: 0.70, rare: 0.25, epic: 0.05 },
    refund: { common: 20, rare: 60, epic: 150, legendary: 300 } // 판매 환불(등급별 고정)
};

// 강화(3단계 갈래)는 등급 합치기로 대신해 꺼 둔다. true로 바꾸면 팝업에 강화 버튼이 다시 나온다(branches가 있는 몬스터만)
const MONSTER_UPGRADE_ENABLED = false;

// 역할: 모든 몬스터는 길 옆 칸(BUILD_CELLS)에 놓는다.
//   blocks가 true면 놓은 칸에서 가장 가까운 길 지점으로 걸어 나가 용사를 막고, 쓰러지면 놓은 칸에서 다시 나온다.
//   false면 놓은 칸에 서서 사거리 안을 공격한다
const MONSTER_ROLES = {
    tank: { name: '탱커', blocks: true },
    melee: { name: '근접 공격', blocks: true },
    ranged: { name: '원거리 단일', blocks: false },
    area: { name: '원거리 광역', blocks: false },
    support: { name: '지원', blocks: false }
};

// 계열: 함께 놓으면 효과(다음 작업). 지금은 이름만 쓴다
const MONSTER_FAMILIES = { undead: '언데드', orc: '오크', demon: '악마', beast: '야수', spirit: '정령' };

// 능력 종류: 몬스터 abilities에 { kind, ...값 }으로 적는다. 코드는 몬스터 id가 아니라 kind로 동작한다(js/game/monster.js).
// 같은 능력을 다른 몬스터에 주려면 abilities에 한 줄을 넣으면 된다. desc는 팝업에 보이는 한 줄 설명이다
//   enrage: 체력 비율이 below 이하면 공격 간격 x intervalMul. 다시 나오면(체력 회복) 풀린다
//   curseShot: 이 몬스터의 공격에 맞은 용사가 duration초 동안 받는 피해 x takenMul. 겹치지 않고 남은 시간만 다시 채운다
//   deathStun: 쓰러질 때 반경 radius칸 안 용사를 duration초 기절시킨다. 보스는 걸리지 않는다
const ABILITY_KINDS = {
    enrage: { name: '광폭화', desc: a => `체력 ${Math.round(a.below * 100)}% 이하면 공격 간격 x${a.intervalMul}` },
    curseShot: { name: '저주', desc: a => `맞은 용사가 ${a.duration}초간 받는 피해 +${Math.round((a.takenMul - 1) * 100)}%` },
    deathStun: { name: '단말마', desc: a => `쓰러지면 ${a.radius}칸 안 용사 ${a.duration}초 기절(보스 제외)` }
};

// stats
//   hp, damage, interval(공격 간격), range(사거리. 근접은 용사를 붙잡는 거리)
//   block: 붙잡는 용사 수(막는 몬스터), respawn: 쓰러진 뒤 놓은 칸에서 다시 나오는 시간(막는 몬스터)
//   splash: 광역 반경, 있으면 마력 구체를 던진다. 없으면 가장 앞선 용사에게 화살을 쏜다
// branches: 3단계 갈래. damageMul, interval, range, splash, armor(받는 피해 감소), beam(일직선 빔), heavy(큰 화살)
// art: 그림. anim.idle은 서 있을 때 반복(idleFps가 0이면 0번 프레임 고정), anim.attack은 공격 때 한 번 재생한다.
//   anim.walk가 있으면 길로 걸어 나갈 때 반복한다
//   hand는 투사체가 나가는 손 위치(발끝 기준 위쪽 y, 동서 방향일 때 앞쪽 x, 세계 px), barY는 체력바 높이, glow는 뒤쪽 빛 색
// 원거리 몬스터는 아직 공격받지 않아 hp를 쓰지 않는다
// cost는 강화 비용 계산(upgradeCost)에만 쓴다. 소환은 SUMMON_RULES.cost로 등급과 관계없이 같다
// summon이 false면 소환에서 나오지 않고 조합으로만 얻는다(히든 등급용)
const MONSTERS = {
    orc_guard: {
        id: 'orc_guard', name: '오크 경비병', role: 'tank', family: 'orc', grade: 'common',
        sprite: 'pl_orc_guard', cost: 70,
        stats: { hp: 120, damage: 8, interval: 1.0, range: 0.8, block: 3, respawn: 8 },
        abilities: [], unlock: 'start',
        desc: '길로 걸어 나가 용사를 3명까지 붙잡습니다.',
        branches: {
            A: { name: '중갑', desc: '받는 피해 40% 감소', armor: 0.4 },
            B: { name: '광전사', desc: '피해 2배, 공격 간격 0.5초', damageMul: 2, interval: 0.5 }
        },
        art: { scale: 2, barY: 84, idleFps: 0, glow: '255,130,70', anim: { idle: ORC_ART.anim.walk, walk: ORC_ART.anim.walk, attack: ORC_ART.anim.attack } }
    },
    skeleton_archer: {
        id: 'skeleton_archer', name: '스켈레톤 궁수', role: 'ranged', family: 'undead', grade: 'common',
        sprite: 'pl_mon_skeleton_archer', cost: 50,
        stats: { hp: 40, damage: 8, interval: 0.8, range: 3 },
        abilities: [], unlock: 'start',
        desc: '길 옆에서 가장 앞선 용사를 빠르게 쏩니다.',
        branches: {
            A: { name: '연사', desc: '공격 간격 0.4초', interval: 0.4 },
            B: { name: '저격', desc: '피해 3배, 사거리 5', damageMul: 3, range: 5, heavy: true }
        },
        art: {
            scale: 2, barY: 96, idleFps: 3, glow: '120,170,255', hand: { x: 40, y: 50 },
            anim: {
                idle: { folder: 'idle', frames: 4, dirs: PL_DIRS, footPx: { south: 63, east: 62, north: 62 } },
                attack: { folder: 'shoot', frames: 6, dirs: PL_DIRS, footPx: { south: 59, east: 56, north: 56 } }
            }
        }
    },
    dark_mage: {
        id: 'dark_mage', name: '암흑 마법사', role: 'area', family: 'demon', grade: 'common',
        sprite: 'pl_mon_dark_mage', cost: 100,
        stats: { hp: 30, damage: 20, interval: 2.0, range: 2.5, splash: 1 },
        abilities: [], unlock: 'start',
        desc: '길 옆에서 마력 구체로 무리를 함께 공격합니다.',
        branches: {
            A: { name: '폭발', desc: '피해 범위 반경 2', splash: 2 },
            B: { name: '관통', desc: '일직선 빔으로 공격', beam: true }
        },
        art: {
            scale: 2, barY: 96, idleFps: 3, glow: '190,90,255', hand: { x: 34, y: 40 },
            anim: {
                idle: { folder: 'idle', frames: 4, dirs: PL_DIRS, footPx: { south: 63, east: 62, north: 62 } },
                attack: { folder: 'cast', frames: 6, dirs: PL_DIRS, footPx: { south: 56, east: 57, north: 56 } }
            }
        }
    },
    orc_berserker: {
        id: 'orc_berserker', name: '오크 광전사', role: 'melee', family: 'orc', grade: 'rare',
        sprite: 'pl_mon_orc_berserker', cost: 120,
        stats: { hp: 180, damage: 22, interval: 0.7, range: 0.8, block: 2, respawn: 8 },
        abilities: [{ kind: 'enrage', below: 0.5, intervalMul: 0.5 }], unlock: 'start',
        desc: '길로 걸어 나가 용사 2명을 붙잡고 빠르게 벱니다.',
        art: {
            scale: 2, barY: 92, idleFps: 0, glow: '255,110,60',
            anim: {
                idle: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 61, east: 54, north: 60 } },
                walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 61, east: 54, north: 60 } },
                attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 54, east: 53, north: 53 } }
            }
        }
    },
    curse_shooter: {
        id: 'curse_shooter', name: '저주 사수', role: 'ranged', family: 'undead', grade: 'rare',
        sprite: 'pl_mon_curse_shooter', cost: 120,
        stats: { hp: 50, damage: 22, interval: 1.0, range: 4 },
        abilities: [{ kind: 'curseShot', duration: 3, takenMul: 1.25 }], unlock: 'start',
        desc: '먼 곳의 가장 앞선 용사에게 저주 화살을 쏩니다.',
        art: {
            scale: 2, barY: 96, idleFps: 3, glow: '170,90,255', hand: { x: 34, y: 50 },
            anim: {
                idle: { folder: 'idle', frames: 4, dirs: PL_DIRS, footPx: { south: 62, east: 64, north: 61 } },
                attack: { folder: 'shoot', frames: 6, dirs: PL_DIRS, footPx: { south: 55, east: 56, north: 55 } }
            }
        }
    },
    bone_knight: {
        id: 'bone_knight', name: '해골 기사', role: 'tank', family: 'undead', grade: 'epic',
        sprite: 'pl_mon_bone_knight', cost: 250,
        stats: { hp: 500, damage: 30, interval: 1.0, range: 0.9, block: 5, respawn: 6 },
        abilities: [{ kind: 'deathStun', radius: 2, duration: 1.5 }], unlock: 'start',
        desc: '길로 걸어 나가 용사를 5명까지 붙잡고 오래 버팁니다.',
        art: {
            scale: 2, barY: 100, idleFps: 0, glow: '170,120,255',
            anim: {
                idle: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 63, east: 62, north: 62 } },
                walk: { folder: 'walking', frames: 6, dirs: PL_DIRS, footPx: { south: 63, east: 62, north: 62 } },
                attack: { folder: 'slash', frames: 6, dirs: PL_DIRS, footPx: { south: 54, east: 56, north: 54 } }
            }
        }
    }
};

// 조합식: 두 재료(a, b)를 합치면 result가 나온다. 순서는 상관없다. 등급 합치기보다 먼저 적용한다.
// hidden이면 미리 보여 주지 않고, 처음 만들면 "히든 조합 발견!" 연출을 한다(이번 시험판은 발견 기록을 저장하지 않는다)
const MONSTER_RECIPES = [
    { a: 'skeleton_archer', b: 'dark_mage', result: 'curse_shooter', hidden: false },
    { a: 'orc_guard', b: 'dark_mage', result: 'orc_berserker', hidden: false },
    { a: 'orc_berserker', b: 'curse_shooter', result: 'bone_knight', hidden: false },
    { a: 'orc_berserker', b: 'skeleton_archer', result: 'bone_knight', hidden: true }
];

// 등급별 소환·등급 합치기 후보. 표 순서를 따른다
function gradePool(grade) {
    return Object.keys(MONSTERS).filter(id => MONSTERS[id].grade === grade && MONSTERS[id].summon !== false);
}

function findRecipe(a, b) {
    return MONSTER_RECIPES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
}

// 등급 합치기 결과 등급. 다음 등급에 몬스터가 없으면(최고 등급) null
function nextGrade(grade) {
    const next = GRADE_ORDER[GRADE_ORDER.indexOf(grade) + 1];
    return next && gradePool(next).length ? next : null;
}

// 두 몬스터를 합칠 수 있는지와 결과(무작위 없이). 위에서부터 먼저 적용한다
//   { kind: 'recipe', recipe, result } 조합식 / { kind: 'grade', grade } 등급 합치기(결과는 grade 등급 무작위)
//   { kind: 'none', reason: 'top' | 'mismatch' } 합칠 수 없음. top은 최고 등급끼리
function mergePlan(a, b) {
    const recipe = findRecipe(a, b);
    if (recipe) return { kind: 'recipe', recipe, result: recipe.result };
    const ga = MONSTERS[a].grade;
    if (ga === MONSTERS[b].grade) {
        const grade = nextGrade(ga);
        return grade ? { kind: 'grade', grade } : { kind: 'none', reason: 'top' };
    }
    return { kind: 'none', reason: 'mismatch' };
}

// 몬스터 하나로 만들 수 있는 공개 조합식(팝업과 끌기 표시용). 히든 조합식은 넣지 않는다
function publicRecipesFor(type) {
    return MONSTER_RECIPES.filter(r => !r.hidden && (r.a === type || r.b === type))
        .map(r => ({ partner: r.a === type ? r.b : r.a, result: r.result }));
}

// 몬스터의 kind 능력(없으면 null)
function monsterAbility(type, kind) {
    return MONSTERS[type].abilities.find(a => a.kind === kind) || null;
}

function monsterBlocks(type) { return MONSTER_ROLES[MONSTERS[type].role].blocks; }

// 2단계 비용은 배치 비용의 80%, 3단계는 150%
function upgradeCost(type, nextTier) {
    return Math.round(MONSTERS[type].cost * (nextTier === 2 ? 0.8 : 1.5));
}
