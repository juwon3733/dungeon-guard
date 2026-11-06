// 몬스터 표. 한 줄을 추가하면 몬스터가 들어간다. 코드는 id가 아니라 역할(role)과 수치(stats)로 동작을 정한다.
// 설계: docs/MONSTER_DESIGN.md. 수치는 플레이 후 고칠 초안이다. 거리는 타일 단위, 시간은 초 단위다.

// 등급: 테두리 색만 쓴다. 층 보상 확률과 등급 연출은 다음 작업이다
const MONSTER_GRADES = {
    common: { name: '일반', color: '#9a96a8' },
    rare: { name: '희귀', color: '#4f8cff' },
    epic: { name: '영웅', color: '#b25cff' },
    legendary: { name: '전설', color: '#ffc63d' }
};

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

// stats
//   hp, damage, interval(공격 간격), range(사거리. 근접은 용사를 붙잡는 거리)
//   block: 붙잡는 용사 수(막는 몬스터), respawn: 쓰러진 뒤 놓은 칸에서 다시 나오는 시간(막는 몬스터)
//   splash: 광역 반경, 있으면 마력 구체를 던진다. 없으면 가장 앞선 용사에게 화살을 쏜다
// branches: 3단계 갈래. damageMul, interval, range, splash, armor(받는 피해 감소), beam(일직선 빔), heavy(큰 화살)
// art: 그림. anim.idle은 서 있을 때 반복(idleFps가 0이면 0번 프레임 고정), anim.attack은 공격 때 한 번 재생한다.
//   anim.walk가 있으면 길로 걸어 나갈 때 반복한다
//   hand는 투사체가 나가는 손 위치(발끝 기준 위쪽 y, 동서 방향일 때 앞쪽 x, 세계 px), barY는 체력바 높이, glow는 뒤쪽 빛 색
// 원거리 몬스터는 아직 공격받지 않아 hp를 쓰지 않는다
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
    }
};

// 하단 몬스터 탭의 슬롯 순서이자 단축키 1~9. 지금은 기본 제공(unlock: 'start')만 나온다
const MONSTER_SLOTS = Object.keys(MONSTERS).filter(id => MONSTERS[id].unlock === 'start');

function monsterBlocks(type) { return MONSTER_ROLES[MONSTERS[type].role].blocks; }

// 2단계 비용은 배치 비용의 80%, 3단계는 150%
function upgradeCost(type, nextTier) {
    return Math.round(MONSTERS[type].cost * (nextTier === 2 ? 0.8 : 1.5));
}
