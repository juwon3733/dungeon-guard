// 몬스터 표. 한 줄을 추가하면 몬스터가 들어간다. 코드는 id가 아니라 역할(role), 수치(stats), 능력 종류(abilities)로 동작을 정한다.
// 설계: docs/MONSTER_DESIGN.md. 수치는 플레이 후 고칠 초안이다. 거리는 타일 단위, 시간은 초 단위다.

// 등급: 낮은 등급부터 적는다(GRADE_ORDER). 소환 확률은 SUMMON_RULES.odds, 합치기 재료 수는 MERGE_RULES에 둔다.
//   | 등급 | 소환 | 합치기로 얻기             | 맵 제한 |
//   | 일반 | 70%  |                           | 없음    |
//   | 희귀 | 25%  | 일반 3마리                | 없음    |
//   | 영웅 | 5%   | 희귀 3마리                | 없음    |
//   | 전설 | 없음 | 영웅 3마리, 조합식        | 없음    |
//   | 신화 | 없음 | 전설 3마리, 히든 조합식   | 1마리   |
// 다음 등급에 합치기 후보(mergePool)가 없으면 그 등급이 최고 등급이라 등급 합치기를 할 수 없다(신화 몬스터가 표에 들어오면 전설 3마리가 바로 신화가 된다)
//   color: 굵은 등급 테두리와 맵 표시, glow: 소환·합치기 연출의 빛 색(r,g,b), light: 큰 글자(외곽선), ink: 남색 창 위 글자
//   summon: false면 소환과 보스 보상에 나오지 않는다(합치기와 조합식으로만 얻는다)
//   fieldMax: 그 등급 몬스터를 맵에 그 수까지만 둔다(넘게 되는 합치기는 막는다)
//     신화는 서로 다른 종이면 3마리까지다(Game.mergePlanFor, Game.mergeResultPool)
//   secret: 도감 조합식 탭에서 결과를 찾기 전까지 '?'로 둔다
//   fx: 등장 연출 단계(0 보통, 1 큰 글자, 2 전설, 3 신화). 소환·합치기 이름 크기, 맵 등급 표식, 히든 발견 연출 크기에 쓴다
//   rainbow: 테두리를 등급 색 하나 대신 흐르는 무지개 빛으로 그린다(신화는 붉은 무지개)
const MONSTER_GRADES = {
    common: { name: '일반', color: '#e4dfd2', glow: '220,214,200', light: '#f6f2e8', ink: '#e8e4da', fx: 0 },
    rare: { name: '희귀', color: '#3d8bff', glow: '90,150,255', light: '#a8ccff', ink: '#7fb6ff', fx: 0 },
    epic: { name: '영웅', color: '#b45cff', glow: '190,100,255', light: '#e2b0ff', ink: '#d39bff', fx: 1 },
    legendary: { name: '전설', color: '#ffc63d', glow: '255,200,70', light: '#ffe08a', ink: '#ffd25a', summon: false, secret: true, fx: 2 },
    mythic: { name: '신화', color: '#ff2d55', glow: '255,60,90', light: '#ff9cb0', ink: '#ff7a92', summon: false, secret: true, fx: 3, // 2026-11-09: 맵 제한 없음(같은 신화도 여럿)
        rainbow: ['#ff2d55', '#ff7a1a', '#ffd23d', '#ff3dd2', '#ff2d55'] },
    // 초월(2026-11-10): 히든 신화 위. 조합 제단으로만 만든다(등급 합치기 결과 없음)
    transcendent: { name: '초월', color: '#9ff6ff', glow: '160,240,255', light: '#e6fdff', ink: '#b8f8ff', summon: false, secret: true, fx: 3,
        rainbow: ['#9ff6ff', '#ffffff', '#c9a6ff', '#ffe08a', '#9ff6ff'] }
};
const GRADE_ORDER = Object.keys(MONSTER_GRADES);

// 소환과 판매. 소환하면 맵의 빈 길 옆 칸에 바로 나온다(대기 칸은 없다).
// odds는 등급별 소환 확률이다(합이 1). 전설은 몬스터가 생기면 확률을 넣는다
const SUMMON_RULES = {
    cost: 25,       // 첫 소환 골드
    costStep: 2,    // 소환할 때마다 오르는 골드(다시 시작하면 처음으로)
    maxField: 24,   // 맵에 둘 수 있는 몬스터 수. 넘으면 합쳐서 자리를 만든다
    blockerSpacing: 1, // 막는 몬스터 자동 배치: 길 지점이 이 칸 수 안으로 겹치지 않는 칸을 먼저 고른다
    // 등급별 확률은 SUMMON_LEVELS(소환 강화 레벨)에 있다
    refund: { common: 20, rare: 60, epic: 150, legendary: 300, mythic: 800, transcendent: 2000 } // 판매 환불(등급별 고정)
};

// 합치기: 등급 합치기는 같은 등급 아무 gradeCount마리를 상위 등급 무작위 1마리로 바꾼다.
// 조합식과 히든 조합식은 정해진 재료 2마리이고, 조합식이 맞으면 조합식이 먼저다
// 조합 제단: 히든 조합식의 재료를 올리는 칸 수
const ALTAR_RULES = { slots: 5, dragHidden: false }; // dragHidden: 옛 시험용(끌어 합치기로도 히든을 만든다)

const MERGE_RULES = {
    gradeCount: 3
};

// 소환 강화: 판 안에서만 유지되는 레벨. 골드를 내고 올리면 좋은 등급이 나올 확률이 오른다(다시 시작하면 1).
//   cost: 이 레벨로 올리는 골드, odds: 등급별 소환 확률(합이 1). 신화는 소환되지 않는다
const SUMMON_LEVELS = [
    { cost: 0, odds: { common: 0.70, rare: 0.25, epic: 0.05, legendary: 0 } },
    { cost: 100, odds: { common: 0.62, rare: 0.30, epic: 0.08, legendary: 0 } },
    { cost: 200, odds: { common: 0.54, rare: 0.33, epic: 0.12, legendary: 0.01 } },
    { cost: 350, odds: { common: 0.46, rare: 0.36, epic: 0.16, legendary: 0.02 } },
    { cost: 550, odds: { common: 0.38, rare: 0.38, epic: 0.20, legendary: 0.04 } },
    { cost: 800, odds: { common: 0.30, rare: 0.40, epic: 0.24, legendary: 0.06 } },
    { cost: 1100, odds: { common: 0.22, rare: 0.40, epic: 0.30, legendary: 0.08 } }
];

SUMMON_RULES.odds = SUMMON_LEVELS[0].odds; // 레벨 1의 확률(시험과 이전 코드용)

// 종족 강화: 판 안에서 골드로 종족(MONSTER_FAMILIES)마다 레벨을 올린다. 그 종족 몬스터 전체의 피해 +damagePer x 레벨.
// 비용은 cost에서 레벨마다 costStep씩 오르고 상한이 없다(후반 골드를 받아 준다).
// sureLevels 레벨까지는 반드시 성공하고, 그 뒤로 레벨마다 chanceStep씩 성공률이 내려가 minChance에서 멈춘다.
// 실패해도 골드는 쓰고 레벨은 그대로다. 성공 여부는 시드 난수(입력 재생이 같은 결과를 낸다)
// 맵이 찬 뒤 골드 쓸 곳(2026-11-09): 칸 넓히기, 몬스터 바꾸기, 마력 사기. 모두 판 안에서만 유지된다
//   field: 맵에 둘 수 있는 몬스터 수를 1씩 늘린다. 처음 cost, 살 때마다 mul배. max번까지
//   reroll: 몬스터 한 마리를 같은 등급의 다른 몬스터로 바꾼다(랭크와 장비는 그대로). 등급별 골드, 신화는 못 바꾼다
//   mana: 골드로 마력 1. 처음 cost, 살 때마다 step씩 오른다
const GOLD_SHOP = {
    field: { max: 12, cost: 400, mul: 1.35 },
    reroll: { common: 30, rare: 80, epic: 200, legendary: 500 },
    mana: { cost: 300, step: 100 }
};

const FAMILY_UPGRADE = { damagePer: 0.08, cost: 50, costStep: 50, sureLevels: 3, chanceStep: 0.1, minChance: 0.3 };
function familyUpgradeCost(level) { return FAMILY_UPGRADE.cost + FAMILY_UPGRADE.costStep * level; }
function familyUpgradeChance(level) {
    const F = FAMILY_UPGRADE;
    if (level < F.sureLevels) return 1;
    return Math.max(F.minChance, Math.round((1 - (level - F.sureLevels + 1) * F.chanceStep) * 100) / 100);
}

// 보스 보상 3택: 마지막 웨이브가 아닌 보스를 처치하면 그 웨이브가 끝나고 준비 단계에서 카드를 띄운다.
//   monsterCards: 몬스터 카드 수(서로 다른 몬스터). 등급은 epicChance 확률로 영웅, 아니면 희귀.
//   후보는 그 등급의 소환 후보(gradePool)라 전설, 신화와 summon: false 몬스터는 나오지 않는다.
//   gold: 골드 카드의 골드(카드는 몬스터 카드 뒤에 하나)
//   장비 카드는 몬스터 카드와 골드 카드 사이에 한 장(등급은 EQUIP_RULES.rewardEpicChance)
const BOSS_REWARD_RULES = {
    roundEvery: 5,  // 이 라운드 수마다 카드 3택(보스를 잡지 못했어도)
    monsterCards: 1,
    epicChance: 0.4,
    gold: 300
};

// 장비: 몬스터마다 1칸. 재료(common) 6종을 2개 겹치면 완성 장비가 된다(EQUIP_RECIPES, 21가지).
// 효과는 기본 수치에 곱하는 비율이다(0.2 = +20%). monsterStats 한 곳에서 랭크 배율 뒤에 곱한다.
//   hp 체력, damage 피해, speed 공격 속도(공격 간격을 1 + speed로 나눈다), range 사거리, xp 처치 경험치,
//   bossDmg 정예와 보스에게 주는 피해, gold 처치 골드
//   onHit: 맞은 용사에게 거는 효과 { burn: [초, 초당 피해], slow: [초, 이동 배율], curse: [초, 받는 피해 배율] }, note: 그 설명
//   grade는 MONSTER_GRADES의 열쇠(색과 이름을 함께 쓴다). 그림은 assets/sprites/equip_<id>.png(48px)
const EQUIP_EFFECTS = { hp: '체력', damage: '피해', speed: '공격 속도', range: '사거리', xp: '처치 경험치', bossDmg: '정예·보스 피해', gold: '처치 골드' };
const EQUIPMENT = {
    // 재료
    sword: { id: 'sword', name: '저주받은 검', grade: 'common', effects: { damage: 0.2 } },
    ring: { id: 'ring', name: '보랏빛 반지', grade: 'common', effects: { speed: 0.15 } },
    bow: { id: 'bow', name: '뼈 활', grade: 'common', effects: { range: 0.15 } },
    elixir: { id: 'elixir', name: '초록 비약', grade: 'common', effects: { damage: 0.1 } },
    armor: { id: 'armor', name: '강철 흉갑', grade: 'common', effects: { bossDmg: 0.25 } },
    boots: { id: 'boots', name: '날개 장화', grade: 'common', effects: { gold: 0.3 } },
    // 완성
    axe: { id: 'axe', name: '룬 전투 도끼', grade: 'rare', effects: { damage: 0.5 } },
    gauntlet: { id: 'gauntlet', name: '악마 손아귀', grade: 'epic', effects: { damage: 0.35, speed: 0.25 } },
    staff: { id: 'staff', name: '해골 지팡이', grade: 'epic', effects: { damage: 0.3, range: 0.25 } },
    crown: { id: 'crown', name: '뼈 왕관', grade: 'epic', effects: { damage: 0.55 } },
    shield: { id: 'shield', name: '해골 방패', grade: 'rare', effects: { damage: 0.25, bossDmg: 0.4 } },
    helmet: { id: 'helmet', name: '뿔 투구', grade: 'rare', effects: { damage: 0.3, gold: 0.5 } },
    amulet: { id: 'amulet', name: '핏빛 목걸이', grade: 'rare', effects: { speed: 0.45 } },
    cape: { id: 'cape', name: '어둠의 망토', grade: 'rare', effects: { speed: 0.25, range: 0.25 } },
    crystal: { id: 'crystal', name: '영혼 수정', grade: 'epic', effects: { speed: 0.25, damage: 0.2 } },
    frostArmor: { id: 'frostArmor', name: '서리 갑주', grade: 'epic', effects: { speed: 0.2, bossDmg: 0.2 }, onHit: { slow: [1.5, 0.8] }, note: '맞은 용사 이동 -20%' },
    stormBoots: { id: 'stormBoots', name: '폭풍 장화', grade: 'rare', effects: { speed: 0.25, gold: 0.3 } },
    tome: { id: 'tome', name: '고대 주문서', grade: 'rare', effects: { range: 0.5 } },
    moonCharm: { id: 'moonCharm', name: '별빛 목걸이', grade: 'rare', effects: { range: 0.2, damage: 0.1 } },
    hunterHelm: { id: 'hunterHelm', name: '사냥꾼 투구', grade: 'rare', effects: { range: 0.2, bossDmg: 0.4 } },
    windBoots: { id: 'windBoots', name: '바람 장화', grade: 'rare', effects: { range: 0.2, gold: 0.3 } },
    sageOrb: { id: 'sageOrb', name: '현자의 보주', grade: 'rare', effects: { damage: 0.3 } },
    curseGlove: { id: 'curseGlove', name: '저주 장갑', grade: 'epic', effects: { damage: 0.08 }, onHit: { curse: [3, 1.15] }, note: '맞은 용사 3초간 받는 피해 +15%' },
    goldHelm: { id: 'goldHelm', name: '황금 투구', grade: 'rare', effects: { damage: 0.1, gold: 0.5 } },
    fireCrown: { id: 'fireCrown', name: '불꽃 왕관', grade: 'epic', effects: { bossDmg: 0.7 }, onHit: { burn: [3, 8] }, note: '맞은 용사 3초간 화상' },
    bloodPlate: { id: 'bloodPlate', name: '핏빛 갑옷', grade: 'rare', effects: { bossDmg: 0.3, gold: 0.4 } },
    boarBoots: { id: 'boarBoots', name: '황금 장화', grade: 'rare', effects: { gold: 1 } }
};
const EQUIP_BASES = ['sword', 'ring', 'bow', 'elixir', 'armor', 'boots'];
const EQUIP_RECIPES = [
    ['sword', 'sword', 'axe'], ['sword', 'ring', 'gauntlet'], ['sword', 'bow', 'staff'], ['sword', 'elixir', 'crown'], ['sword', 'armor', 'shield'], ['sword', 'boots', 'helmet'],
    ['ring', 'ring', 'amulet'], ['ring', 'bow', 'cape'], ['ring', 'elixir', 'crystal'], ['ring', 'armor', 'frostArmor'], ['ring', 'boots', 'stormBoots'],
    ['bow', 'bow', 'tome'], ['bow', 'elixir', 'moonCharm'], ['bow', 'armor', 'hunterHelm'], ['bow', 'boots', 'windBoots'],
    ['elixir', 'elixir', 'sageOrb'], ['elixir', 'armor', 'curseGlove'], ['elixir', 'boots', 'goldHelm'],
    ['armor', 'armor', 'fireCrown'], ['armor', 'boots', 'bloodPlate'],
    ['boots', 'boots', 'boarBoots']
];
// 재료 두 개로 만드는 장비(순서 무관). 없으면 null
function craftResult(a, b) {
    const r = EQUIP_RECIPES.find(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a));
    return r ? r[2] : null;
}

// 장비 얻기와 보관함
//   slots: 보관함 칸 수. 가득 차 있으면 들어올 장비(정예 드롭, 합치기·제물·판매로 돌아오는 장비)는 fullGold 골드로 바뀐다.
//     보스 보상의 장비 카드는 꺼져 고를 수 없다
//   rewardEpicChance: 보스 보상 장비 카드가 영웅일 확률(아니면 희귀). 조합을 건너뛰지 않게 낮게 둔다
//   eliteDrop: 정예 용사를 처치하면 재료를 떨어뜨릴 확률
const EQUIP_RULES = {
    slots: 6,
    fullGold: 30,
    rewardEpicChance: 0.1,
    eliteDrop: 0.35
};

// 랭크: 개체의 성장(등급은 종류에 고정). 소환하면 첫 단계(D)이고 처치 경험치로만 오른다(합치기로는 오르지 않는다).
//   xp: 그 랭크가 되는 누적 처치 경험치, mul: 체력과 피해 배율(D 기준), color: 맵과 팝업의 글자 색
//   killXp: 처치 하나의 경험치. 마지막 공격을 넣은 몬스터가 받는다(번개, 타락 유닛의 처치는 몬스터 경험치가 아니다)
//   합치면 재료 중 낮은 랭크를 결과가 이어받고 경험치는 그 랭크의 시작값이 된다
// 2026-11-09 사용자 결정: 랭크는 처치로 오르지 않고 골드로 돌린다(무작위, 내려갈 수도 있다). 처치 수는 따로 센다.
//   mul: 피해 배율(D 기준), odds: 돌렸을 때 나올 확률(합 1). 돌리는 값은 RANK_ROLL.cost(등급별)
const MONSTER_RANKS = [
    { name: 'D', xp: 0, mul: 1, color: '#c9c2d8', odds: 0.30 },
    { name: 'C', xp: 0, mul: 1.2, color: '#9fe39a', odds: 0.30 },
    { name: 'B', xp: 0, mul: 1.45, color: '#8cc4ff', odds: 0.22 },
    { name: 'A', xp: 0, mul: 1.75, color: '#e0a8ff', odds: 0.12 },
    { name: 'S', xp: 0, mul: 2.1, color: '#ffd23d', odds: 0.05 },
    { name: 'S+', xp: 0, mul: 2.6, color: '#ff7a3d', odds: 0.01 }
];
const RANK_ROLL = { cost: { common: 40, rare: 100, epic: 250, legendary: 600, mythic: 1500, transcendent: 3000 } };

// 제물: 맵의 몬스터를 끌어 왕좌의 마왕 위에 놓으면 몬스터가 사라지고 마왕이 힘을 얻는다(웨이브 중에도, 준비 중에도). 판매 환불은 없다.
//   heal: 마왕 체력 회복(최대 체력 Game.maxHp()를 넘지 않는다), lightning: 번개 재사용 대기 감소(초, 0 아래로 내려가지 않는다)
//   랭크가 높으면 MONSTER_RANKS의 mul만큼 커진다(랭크마다 +25%, S는 2배). 체력은 내림으로 정수를 유지한다
const SACRIFICE_RULES = {
    common: { heal: 1, lightning: 2 },
    rare: { heal: 2, lightning: 5 },
    epic: { heal: 5, lightning: 10 },
    legendary: { heal: 10, lightning: 30 },
    mythic: { heal: 20, lightning: 60 },
    transcendent: { heal: 30, lightning: 90 }
};

// 강화(3단계 갈래)는 등급 합치기로 대신해 꺼 둔다. true로 바꾸면 팝업에 강화 버튼이 다시 나온다(branches가 있는 몬스터만)
const MONSTER_UPGRADE_ENABLED = false;

// 역할: 모든 몬스터는 길 옆 칸(BUILD_CELLS)에 놓고 그 자리에서 공격한다. 근접(melee)은 사거리가 짧고 stats.block명을 한 번에 때린다.
//   blocks가 true면 놓은 칸에서 가장 가까운 길 지점으로 걸어 나가 용사를 막고, 쓰러지면 놓은 칸에서 다시 나온다.
//   false면 놓은 칸에 서서 사거리 안을 공격한다. 지원(support)도 그렇게 서서 약하게 공격하며 오라(aura 능력)를 낸다
const MONSTER_ROLES = {
    tank: { name: '근접 광역', blocks: false, melee: true },
    melee: { name: '근접', blocks: false, melee: true },
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
//   burnShot: 맞은 용사가 duration초 동안 초당 dps 화상 피해(방어력 무시). 겹치지 않고 남은 시간만 다시 채운다
//   slowShot: 맞은 용사가 duration초 동안 이동 속도 x speedMul. 겹치지 않고 남은 시간만 다시 채운다
//   stunShot: 맞을 때 chance 확률로 duration초 기절. 보스는 걸리지 않는다
//   lifesteal: 이 몬스터가 준 피해의 ratio만큼 체력을 회복한다(최대 체력까지)
//   regen: 쓰러지지 않은 동안 초당 perSec 체력을 회복한다
//   aura: 반경 radius칸 안 몬스터(자신 포함)에게 stat 효과. heal은 초당 체력 회복, damage는 피해 비율, attackSpeed는 공격 속도 비율.
//     같은 stat의 오라가 여럿이면 가장 큰 값 하나만 받는다. 피해와 공격 속도는 monsterStats에서 곱하고, 최대 체력은 바꾸지 않는다
//   cleave: 막는 몬스터가 때릴 때 대상 둘레 radius칸 안 다른 용사에게 피해의 ratio
//   thorns: 막는 몬스터가 용사에게 맞으면 받은 피해의 ratio를 그 용사에게 돌려준다
//   chain: 맞은 용사에서 jump칸 안 다음 용사로 count번 이어지며 피해의 ratio(이미 맞은 용사는 건너뛴다)
//   goldOnKill: 이 몬스터가 용사를 쓰러뜨리면 골드 +gold(처치 골드와 따로)
//   frenzy: 용사를 쓰러뜨리면 duration초 동안 공격 간격 x intervalMul
//   burnGround: 광역 공격이 떨어진 자리에 duration초 동안 반경 radius칸 불 장판(초당 dps, 방어력 무시)
// 특수 스킬: 전설과 신화의 skills에 { kind, name, cooldown, ...값 }으로 적는다. 재사용 대기(cooldown초)마다 맞는 용사가 있으면 저절로 쓴다(js/game/monster.js).
//   nova: 몬스터 둘레 radius칸('map'이면 맵 전체) 용사에게 공격력 x mul. stun, slow, burn, curse는 그 효과의 초(기절은 보스 제외)
//   meteor: 사거리 reach칸 안 가장 앞선 용사 자리 radius칸에 공격력 x mul. 효과는 nova와 같다
//   barrage: reach칸('map' 가능) 안 용사를 무작위로 count번 때린다(공격력 x mul)
//   harvest: reach칸('map' 가능) 안 체력 below 이하 용사를 바로 쓰러뜨린다(보스 제외). 하나당 골드 +gold
//   timeStop: 맵의 모든 용사를 duration초 멈춘다. 보스는 멈추지 않고 느려진다
//   push: 보스가 아닌 용사를 길 뒤로 tiles칸 밀고 공격력 x mul
//   buff: 맵의 모든 몬스터가 duration초 동안 피해 +damage, 공격 속도 +speed, 받는 피해 -armor
//   heal: 맵의 모든 몬스터 체력을 최대의 ratio만큼 채우고, revive면 쓰러진 몬스터를 일으킨다
const SKILL_SLOW_MUL = 0.5;  // 스킬 slow의 이동 속도 배율
const SKILL_CURSE_MUL = 1.3; // 스킬 curse의 받는 피해 배율
const SKILL_BURN_DPS = 0.25; // 스킬 burn의 초당 피해(공격력 비율)
function skillPlace(v) { return v === 'map' ? '맵 전체' : `${v}칸 안`; }
function skillEffects(s) {
    const list = [];
    if (s.stun) list.push(`${s.stun}초 기절`);
    if (s.slow) list.push(`${s.slow}초 느려짐`);
    if (s.burn) list.push(`${s.burn}초 화상`);
    if (s.curse) list.push(`${s.curse}초 저주`);
    return list.length ? ', ' + list.join(', ') : '';
}
const SKILL_KINDS = {
    nova: s => `${skillPlace(s.radius)} 용사에게 공격력 x${s.mul}${skillEffects(s)}`,
    meteor: s => `가장 앞선 용사 자리 ${s.radius}칸에 공격력 x${s.mul}${skillEffects(s)}`,
    barrage: s => `${skillPlace(s.reach)} 용사를 ${s.count}번 때림(공격력 x${s.mul})`,
    harvest: s => `${skillPlace(s.reach)} 체력 ${Math.round(s.below * 100)}% 이하 용사를 처형(보스 제외), 골드 +${s.gold}`,
    timeStop: s => `맵의 용사를 ${s.duration}초 멈춤(보스는 느려짐)`,
    push: s => `용사를 ${s.tiles}칸 밀어내고 공격력 x${s.mul}(보스 제외)`,
    buff: s => `${s.duration}초간 모든 몬스터 ${[s.damage ? `피해 +${Math.round(s.damage * 100)}%` : '', s.speed ? `공격 속도 +${Math.round(s.speed * 100)}%` : '', s.armor ? `받는 피해 -${Math.round(s.armor * 100)}%` : ''].filter(Boolean).join(', ')}`,
    heal: s => `모든 몬스터 체력 ${Math.round(s.ratio * 100)}% 회복${s.revive ? ', 쓰러진 몬스터 부활' : ''}`
};
function skillDesc(s) { return `${SKILL_KINDS[s.kind](s)} · ${s.cooldown}초마다`; }

// 능력에 name을 적으면 ABILITY_KINDS의 이름 대신 그 이름을 보여 준다(효과는 같고 몬스터에 맞는 이름만 다르다)
function abilityName(a) { return a.name || ABILITY_KINDS[a.kind].name; }

const AURA_STATS = { heal: '체력 회복', damage: '피해', attackSpeed: '공격 속도' };
const ABILITY_KINDS = {
    frenzy: { name: '격분', desc: a => `용사를 쓰러뜨리면 ${a.duration}초간 공격 간격 x${a.intervalMul}` },
    enrage: { name: '광폭화', desc: a => `체력 ${Math.round(a.below * 100)}% 이하면 공격 간격 x${a.intervalMul}` },
    curseShot: { name: '저주', desc: a => `맞은 용사가 ${a.duration}초간 받는 피해 +${Math.round((a.takenMul - 1) * 100)}%` },
    deathStun: { name: '단말마', desc: a => `쓰러지면 ${a.radius}칸 안 용사 ${a.duration}초 기절(보스 제외)` },
    burnShot: { name: '화상', desc: a => `맞은 용사가 ${a.duration}초간 초당 ${a.dps} 화상 피해` },
    slowShot: { name: '빙결', desc: a => `맞은 용사가 ${a.duration}초간 이동 속도 x${a.speedMul}` },
    stunShot: { name: '악몽', desc: a => `맞으면 ${Math.round(a.chance * 100)}% 확률로 ${a.duration}초 기절(보스 제외)` },
    lifesteal: { name: '흡혈', desc: a => `준 피해의 ${Math.round(a.ratio * 100)}%만큼 체력 회복` },
    regen: { name: '재생', desc: a => `초당 체력 ${a.perSec} 회복` },
    aura: {
        name: '오라',
        desc: a => `${a.radius}칸 안 몬스터 ${AURA_STATS[a.stat]} ${a.stat === 'heal' ? `초당 ${a.value}` : `+${Math.round(a.value * 100)}%`}(겹치지 않음)`
    },
    cleave: { name: '가르기', desc: a => `대상 둘레 ${a.radius}칸 용사에게 피해의 ${Math.round(a.ratio * 100)}%` },
    thorns: { name: '가시', desc: a => `막다가 맞으면 받은 피해의 ${Math.round(a.ratio * 100)}% 반사` },
    chain: { name: '연쇄 번개', desc: a => `다음 용사 ${a.count}명에게 이어지며 피해의 ${Math.round(a.ratio * 100)}%` },
    goldOnKill: { name: '약탈', desc: a => `용사를 쓰러뜨리면 골드 +${a.gold}` },
    burnGround: { name: '용암 장판', desc: a => `떨어진 자리 ${a.radius}칸에 ${a.duration}초간 초당 ${a.dps} 불 장판` }
};

// 공격 모양(2026-11-09): 몬스터마다 MONSTER_ATTACKS에 { kind, look, ...값 }으로 적는다. 코드는 kind로 동작한다(js/game/monster.js의 fireMonsterShot).
// look은 그림의 색과 모양이다(js/game/render.js의 ATTACK_LOOKS). 값을 적지 않으면 ATTACK_KINDS의 기본값을 쓴다. 거리는 칸, 시간은 초.
// 근접 몬스터는 사거리 안에서 그 모양에 드는 용사를 stats.block명까지 때린다. 광역 몬스터의 splash는 모양이 허락하면 그대로 쓴다.
// 전설과 신화는 서로 다른 kind를 하나씩 가진다(시험이 확인한다). name과 desc는 정보 창에 보이는 이름과 한 줄 설명이다
//   arrow: 가장 앞선 용사 하나에게 화살(art.shot 그림). orb: 구체를 던져 떨어진 자리 splash칸 안을 함께
//   pierce: 한 줄로 날아가(초당 speed px) 지나는 용사를 max명까지 맞힌다. 첫 용사 뒤로는 피해 x ratio
//   boomerang: 대상 뒤까지 곧게 갔다 휘어 돌아오며 지나는 용사를 갈 때와 올 때 max명씩(피해 x ratio)
//   stream: 한 줄로 뿜어 폭 width 안 용사를 count명까지(첫 용사 뒤 x ratio), 보스가 아니면 push칸 길 뒤로 민다. puddle이 true면 끝에 웅덩이
//   puddle: 맞힌 자리에 duration초 radius칸 웅덩이. 안의 용사는 이동 속도 x slow, 방어력 x armorMul
//   drop: delay초 뒤 하늘에서 떨어져 radius칸(광역이면 splash) 안을 때린다(근접이면 block명까지). count개면 길을 따라 spread칸씩 벌린다(하나 피해 x ratio)
//   beam: duration초 동안 한 줄 광선(사거리 + extra칸, 폭 width), ticks번 피해 x ratio
//   vortex: 떨어진 자리에 duration초 소용돌이. 처음 피해 x ratio, tick초마다 x tickRatio, 보스가 아닌 용사를 초당 pull칸 가운데로 끈다
//   trap: 대상 앞 길에 덫(몬스터당 max개, life초). arm초 뒤부터 용사가 trigger칸 안에 들어오면 radius칸(광역이면 splash)에 피해 x ratio
//   zap: 곧바로 번개로 맞힌다(광역이면 splash칸 안 함께)
//   breath: 앞쪽 부채꼴(반각의 코사인 cos)로 사거리 안 용사를 모두. 근접이면 block명까지
//   volley: count발을 앞선 용사들에게 나눠 쏜다(초당 speed px, 한 발 피해 x ratio, 광역이면 반경 splash x 0.5 안 함께)
//   tether: 사거리 안 용사 count명에게 줄을 이어 duration초 동안 ticks번 피해 x ratio
//   fissure: 첫 대상 쪽으로 땅이 갈라져 사거리 + extra칸까지 초당 speed칸으로 나아간다. 폭 width 안 용사를 block명까지
//   spikes, tentacle, claw: 기본 근접처럼 고른 대상의 발밑에서 솟거나 할퀸다
//   thrust: 첫 대상 쪽 한 줄(사거리 + extra칸, 폭 width). slam: 첫 대상 자리 radius칸 원. sweep: 몸 앞 부채꼴(반각 코사인 cos). whirl: 몸 둘레 전체
//   smite: 근접 대상마다 하늘에서 번개, 그 둘레 radius칸의 다른 용사에게 피해 x ratio
//   rewind: 대상 발밑에 시계. delay초 뒤 피해 x ratio, 보스가 아니면 push칸 길 뒤로
//   elements: 불, 얼음, 번개 구체 셋을 앞선 용사들에게 던진다(구체 하나 피해 x ratio, 반경 splash x splashMul)
//   shockwave: 몸에서 초당 speed칸으로 퍼지는 파동이 사거리 안 용사에게 닿는다
const ATTACK_KINDS = {
    arrow: { name: '화살', desc: '가장 앞선 용사 하나를 쏜다' },
    orb: { name: '마력 구체', desc: '구체가 떨어진 자리의 무리를 함께 때린다' },
    pierce: { name: '꿰뚫기', desc: '한 줄로 날아가 지나는 용사를 꿰뚫는다', ratio: 0.3, max: 4 },
    boomerang: { name: '부메랑', desc: '갔다가 돌아오며 지나는 용사를 두 번 벤다', ratio: 0.5, max: 2 },
    stream: { name: '물줄기', desc: '한 줄로 뿜어 맞은 용사를 길 뒤로 밀어낸다', ratio: 0.6, count: 4, width: 0.45, push: 0.3 },
    puddle: { name: '웅덩이', desc: '맞은 자리에 웅덩이가 남아 용사가 느려지고 방어력이 줄어든다', radius: 0.8, duration: 3, slow: 0.7, armorMul: 0.5 },
    drop: { name: '낙하', desc: '잠시 뒤 하늘에서 떨어져 그 자리의 용사를 때린다', delay: 0.45, radius: 0.6, count: 1, spread: 0.7, ratio: 1 },
    beam: { name: '광선', desc: '긴 광선으로 한 줄의 용사를 여러 번 태운다', duration: 0.6, ticks: 3, ratio: 0.4, width: 0.45, extra: 1 },
    vortex: { name: '소용돌이', desc: '소용돌이가 용사를 가운데로 끌어당기며 계속 피해를 준다', duration: 1.6, ratio: 0.5, tick: 0.4, tickRatio: 0.2, pull: 1.2 },
    trap: { name: '덫', desc: '길에 덫을 깔고 용사가 밟으면 터진다', max: 3, life: 6, arm: 0.35, trigger: 0.55, radius: 0.9, ratio: 1.3 },
    zap: { name: '번개', desc: '번개를 곧바로 내리꽂는다' },
    breath: { name: '숨결', desc: '앞쪽 부채꼴로 숨을 뿜어 안의 용사를 모두 태운다', cos: 0.866 },
    volley: { name: '흩뿌리기', desc: '여러 발을 흩뿌려 앞선 용사들을 맞힌다', count: 3, ratio: 0.4 },
    tether: { name: '영혼 흡수', desc: '여러 용사에게 줄을 이어 기운을 빨아들인다', count: 4, duration: 0.9, ticks: 3, ratio: 0.45 },
    fissure: { name: '땅 가르기', desc: '땅을 갈라 한 줄로 바위 가시를 솟게 한다', extra: 1.5, width: 0.45, speed: 9 },
    spikes: { name: '솟구침', desc: '대상 발밑에서 가시가 솟는다' },
    tentacle: { name: '촉수', desc: '대상 발밑에서 촉수가 솟아 때린다' },
    claw: { name: '할퀴기', desc: '가까운 용사들을 할퀸다' },
    thrust: { name: '찌르기', desc: '앞으로 길게 찔러 한 줄의 용사를 꿰뚫는다', extra: 0.6, width: 0.4 },
    slam: { name: '내려찍기', desc: '대상 자리를 내려찍어 둘레의 용사를 함께 때린다', radius: 1 },
    sweep: { name: '휘두르기', desc: '앞쪽을 크게 휘둘러 부채꼴 안의 용사를 벤다', cos: 0.26 },
    whirl: { name: '회전 베기', desc: '몸을 한 바퀴 돌려 둘레의 용사를 모두 벤다' },
    smite: { name: '천벌', desc: '하늘에서 번개 망치가 떨어져 대상과 둘레를 때린다', radius: 0.8, ratio: 0.5 },
    rewind: { name: '되감기', desc: '용사 발밑에 시계를 띄워 피해를 주고 길 뒤로 되돌린다', delay: 0.4, ratio: 1.15, push: 0.35 },
    elements: { name: '세 원소', desc: '불, 얼음, 번개 구체를 함께 던진다', ratio: 0.36, splashMul: 0.8 },
    shockwave: { name: '수정 파동', desc: '몸에서 수정 파동이 퍼져 둘레의 용사를 때린다', speed: 8 }
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
// cost는 강화 비용 계산(upgradeCost)에만 쓴다. 소환 비용은 SUMMON_RULES로 등급과 관계없이 같다
// summon이 false면 소환에서 나오지 않는다(등급 표의 summon이 false인 전설과 신화는 적지 않아도 소환에서 빠진다).
// gradeMerge가 false면 등급 합치기 결과로도 나오지 않고 조합식으로만 얻는다
// art.shot: 투사체 모양. FX_SHEETS의 투사체 시트 열쇠(날아가는 방향으로 돌려 그린다)이거나 'bolt'(glow 색 빛 덩이). 없으면 화살과 마력 구체
// art.impact: 광역 공격이 터질 때 효과(FX_SHEETS 열쇠). 없으면 보라 마력 폭발
// PixelLab 동작 하나: 폴더, 프레임 수, 방향별 첫 프레임 발끝 높이(그림 px). 서쪽은 동쪽을 뒤집는다(PL_DIRS)
function plClip(folder, frames, south, east, north) {
    return { folder, frames, dirs: PL_DIRS, footPx: { south, east, north } };
}
// Asteria 그림(js/data/asteria_art.js)이나 88px로 새로 그린 그림(js/data/hd_monster_art.js) 하나: 그림 1px이 화면 1px(ART_SCALE)이다. breathe로 숨 쉬기와 내지르기를 코드가 그린다
function astArt(id, opts) {
    const a = ASTERIA_ART[id] || HD_MONSTER_ART[id];
    const scale = ART_SCALE;
    return Object.assign({ scale, barY: Math.round(a.height * scale) + 14, idleFps: 0, glow: '200,200,255', breathe: true, cells: a.cells,
        hand: { x: Math.round(a.width * scale * 0.3), y: Math.round(a.height * scale * 0.6) }, anim: a.anim }, opts);
}

// 몬스터가 차지하는 칸(가로, 세로). 놓은 칸(col, row)이 왼쪽 아래 칸이다
function monsterCells(type) { return MONSTERS[type].art.cells || [1, 1]; }

// 공격이 닿는 칸 수. 근접 몬스터는 사거리가 짧은 대신 몸이 클수록 조금 더 닿는다
function monsterReach(type) {
    const base = MONSTERS[type].stats.range;
    if (!MONSTER_ROLES[MONSTERS[type].role].melee) return base;
    return base + (Math.max(...monsterCells(type)) - 1) * 0.5;
}

// 차지하는 칸 전체의 가운데 x와 발끝 기준 y(맨 아래 줄 가운데)
function monsterHomeX(type, col) { return tileX(col) + (monsterCells(type)[0] - 1) * TILE / 2; }
function monsterHomeY(type, row) {
    const [w, h] = monsterCells(type);
    return tileY(row) + (w > 1 || h > 1 ? TILE * 0.3 : 0); // 큰 몬스터는 발을 맨 아래 칸 아래쪽에 두어 차지한 칸 안에 서게 한다
}

// 몬스터 m이 (col, row) 칸을 차지하는지
function monsterCovers(m, col, row) {
    const [w, h] = monsterCells(m.type);
    return col >= m.col && col < m.col + w && row <= m.row && row > m.row - h;
}

const MONSTERS = {
    orc_guard: {
        id: 'orc_guard', name: '오크 경비병', role: 'tank', family: 'orc', grade: 'common',
        sprite: HD_MONSTER_ART.orc_guard.sprite, cost: 70,
        stats: { hp: 120, damage: 8, interval: 1.0, range: 2, block: 3, respawn: 8 },
        abilities: [], unlock: 'start',
        desc: '길 옆에 서서 곁을 지나는 용사 3명을 한꺼번에 때린다.',
        branches: {
            A: { name: '중갑', desc: '받는 피해 40% 감소', armor: 0.4 },
            B: { name: '광전사', desc: '피해 2배, 공격 간격 0.5초', damageMul: 2, interval: 0.5 }
        },
        art: astArt('orc_guard', { glow: '255,130,70' })
    },
    skeleton_archer: {
        id: 'skeleton_archer', name: '스켈레톤 궁수', role: 'ranged', family: 'undead', grade: 'common',
        sprite: HD_MONSTER_ART.skeleton_archer.sprite, cost: 50,
        stats: { hp: 40, damage: 8, interval: 0.8, range: 3 },
        abilities: [], unlock: 'start',
        desc: '길 옆에서 가장 앞선 용사를 빠르게 쏜다.',
        branches: {
            A: { name: '연사', desc: '공격 간격 0.4초', interval: 0.4 },
            B: { name: '저격', desc: '피해 3배, 사거리 5', damageMul: 3, range: 5, heavy: true }
        },
        art: astArt('skeleton_archer', { glow: '120,170,255' })
    },
    dark_mage: {
        id: 'dark_mage', name: '암흑 마법사', role: 'area', family: 'demon', grade: 'common',
        sprite: HD_MONSTER_ART.dark_mage.sprite, cost: 100,
        stats: { hp: 30, damage: 15, interval: 2.0, range: 2.5, splash: 1 },
        abilities: [], unlock: 'start',
        desc: '길 옆에서 마력 구체로 무리를 함께 공격한다.',
        branches: {
            A: { name: '폭발', desc: '피해 범위 반경 2', splash: 2 },
            B: { name: '관통', desc: '일직선 빔으로 공격', beam: true }
        },
        art: astArt('dark_mage', { glow: '190,90,255' })
    },
    orc_berserker: {
        id: 'orc_berserker', name: '오크 광전사', role: 'melee', family: 'orc', grade: 'rare',
        sprite: HD_MONSTER_ART.orc_berserker.sprite, cost: 120,
        stats: { hp: 180, damage: 22, interval: 0.7, range: 2.4, block: 2, respawn: 8 },
        abilities: [{ kind: 'frenzy', duration: 3, intervalMul: 0.6 }], unlock: 'start',
        desc: '곁의 용사 2명을 빠르게 베고, 쓰러뜨릴수록 더 빨라진다.',
        art: astArt('orc_berserker', { glow: '255,110,60' })
    },
    curse_shooter: {
        id: 'curse_shooter', name: '저주 사수', role: 'ranged', family: 'undead', grade: 'rare',
        sprite: ASTERIA_ART.curse_shooter.sprite, cost: 120,
        stats: { hp: 50, damage: 22, interval: 1.0, range: 4 },
        abilities: [{ kind: 'curseShot', duration: 3, takenMul: 1.25 }], unlock: 'start',
        desc: '먼 곳의 가장 앞선 용사에게 저주 화살을 쏜다.',
        art: astArt('curse_shooter', { glow: '170,90,255' })
    },
    bone_knight: {
        id: 'bone_knight', name: '해골 기사', role: 'tank', family: 'undead', grade: 'epic',
        sprite: ASTERIA_ART.bone_knight.sprite, cost: 250,
        stats: { hp: 500, damage: 30, interval: 1.0, range: 2, block: 5, respawn: 6 },
        abilities: [{ kind: 'stunShot', chance: 0.15, duration: 1 }], unlock: 'start',
        desc: '곁의 용사 5명을 베고, 가끔 기절시킨다.',
        art: astArt('bone_knight', { glow: '170,120,255' })
    },
    death_lord: {
        id: 'death_lord', name: '죽음의 군주', role: 'tank', family: 'undead', grade: 'legendary',
        sprite: ASTERIA_ART.death_lord.sprite, cost: 500, summon: false,
        stats: { hp: 900, damage: 60, interval: 0.9, range: 2, block: 8, respawn: 5 },
        abilities: [{ kind: 'stunShot', chance: 0.2, duration: 1.2 }], unlock: 'start',
        skills: [{ kind: 'barrage', name: '망자의 군세', cooldown: 14, count: 6, mul: 1.2, reach: 6 }],
        desc: '곁의 용사 8명을 한꺼번에 베고, 가끔 기절시킨다.',
        art: astArt('death_lord', { glow: '255,200,90' })
    },

    // ----- 몬스터 확장 16종(2026-11-06, 수치 초안) -----
    goblin_spearman: {
        id: 'goblin_spearman', name: '고블린 창병', role: 'melee', family: 'orc', grade: 'common',
        sprite: HD_MONSTER_ART.goblin_spearman.sprite, cost: 60,
        stats: { hp: 70, damage: 12, interval: 0.7, range: 2.4, block: 1, respawn: 6 },
        abilities: [], unlock: 'start',
        desc: '길 옆에 서서 지나가는 용사를 창으로 빠르게 찌른다.',
        art: astArt('goblin_spearman', { glow: '130,235,80' })
    },
    zombie: {
        id: 'zombie', name: '좀비', role: 'tank', family: 'undead', grade: 'common',
        sprite: ASTERIA_ART.zombie.sprite, cost: 60,
        stats: { hp: 170, damage: 6, interval: 1.2, range: 2, block: 3, respawn: 7 },
        abilities: [{ kind: 'slowShot', name: '붙잡는 손', speedMul: 0.85, duration: 1.5 }], unlock: 'start',
        desc: '곁을 지나는 용사 3명을 움켜쥐어 느리게 한다.',
        art: astArt('zombie', { glow: '150,220,120' })
    },
    fire_imp: {
        id: 'fire_imp', name: '불꽃 임프', role: 'ranged', family: 'demon', grade: 'common',
        sprite: ASTERIA_ART.fire_imp.sprite, cost: 60,
        stats: { hp: 30, damage: 7, interval: 1.0, range: 2.5 },
        abilities: [{ kind: 'burnShot', dps: 3, duration: 2 }], unlock: 'start',
        desc: '불덩이를 던져 맞은 용사를 잠시 태운다.',
        art: astArt('fire_imp', { glow: '255,110,40', shot: 'fx_shot_fire' })
    },
    gnoll_hunter: {
        id: 'gnoll_hunter', name: '그놀 사냥꾼', role: 'ranged', family: 'beast', grade: 'common',
        sprite: HD_MONSTER_ART.gnoll_hunter.sprite, cost: 60,
        stats: { hp: 40, damage: 14, interval: 1.3, range: 3 },
        abilities: [], unlock: 'start',
        desc: '무거운 손도끼를 던져 앞선 용사 하나를 세게 때린다.',
        art: astArt('gnoll_hunter', { glow: '255,180,70', shot: 'fx_shot_axe' })
    },
    wisp_acolyte: {
        id: 'wisp_acolyte', name: '도깨비불 수련사', role: 'support', family: 'spirit', grade: 'common',
        sprite: ASTERIA_ART.wisp_acolyte.sprite, cost: 60,
        stats: { hp: 30, damage: 3, interval: 1.5, range: 2 },
        abilities: [{ kind: 'aura', stat: 'attackSpeed', radius: 2, value: 0.05 }], unlock: 'start',
        desc: '둘레 몬스터의 공격 속도를 조금 올린다.',
        art: astArt('wisp_acolyte', { glow: '90,240,255', shot: 'bolt' })
    },
    werewolf: {
        id: 'werewolf', name: '늑대인간', role: 'melee', family: 'beast', grade: 'rare',
        sprite: HD_MONSTER_ART.werewolf.sprite, cost: 120,
        stats: { hp: 170, damage: 24, interval: 0.6, range: 2.4, block: 2, respawn: 7 },
        abilities: [{ kind: 'frenzy', duration: 3, intervalMul: 0.6 }], unlock: 'start',
        desc: '곁의 용사 2명을 물어뜯고, 쓰러뜨리면 더 사나워진다.',
        art: astArt('werewolf', { glow: '140,160,255' })
    },
    troll: {
        id: 'troll', name: '동굴 트롤', role: 'tank', family: 'orc', grade: 'rare',
        sprite: HD_MONSTER_ART.troll.sprite, cost: 120,
        stats: { hp: 320, damage: 14, interval: 1.2, range: 2, block: 4, respawn: 7 },
        abilities: [{ kind: 'slowShot', name: '육중한 일격', speedMul: 0.8, duration: 2 }], unlock: 'start',
        desc: '곁의 용사 4명을 내리쳐 느리게 한다.',
        art: astArt('troll', { glow: '70,230,180' })
    },
    frost_witch: {
        id: 'frost_witch', name: '서리 마녀', role: 'area', family: 'spirit', grade: 'rare',
        sprite: ASTERIA_ART.frost_witch.sprite, cost: 120,
        stats: { hp: 40, damage: 14, interval: 2.0, range: 3, splash: 1 },
        abilities: [{ kind: 'slowShot', speedMul: 0.6, duration: 2 }], unlock: 'start',
        desc: '얼음 창을 던져 무리를 함께 얼리고 느리게 만든다.',
        art: astArt('frost_witch', { glow: '130,205,255', shot: 'fx_shot_ice', impact: 'fx_snowflake' })
    },
    nightmare_jester: {
        id: 'nightmare_jester', name: '악몽 광대', role: 'ranged', family: 'demon', grade: 'rare',
        sprite: HD_MONSTER_ART.nightmare_jester.sprite, cost: 120,
        stats: { hp: 40, damage: 16, interval: 1.2, range: 3.5 },
        abilities: [{ kind: 'stunShot', chance: 0.2, duration: 1 }], unlock: 'start',
        desc: '악몽 원반을 던져 가끔 용사를 그 자리에 멈춰 세운다.',
        art: astArt('nightmare_jester', { glow: '235,110,255', shot: 'fx_shot_jester' })
    },
    orc_shaman: {
        id: 'orc_shaman', name: '오크 주술사', role: 'support', family: 'orc', grade: 'rare',
        sprite: HD_MONSTER_ART.orc_shaman.sprite, cost: 120,
        stats: { hp: 50, damage: 5, interval: 1.5, range: 2.5 },
        abilities: [{ kind: 'aura', stat: 'damage', radius: 2.5, value: 0.2 }], unlock: 'start',
        desc: '전쟁 주술로 둘레 몬스터의 공격을 더 아프게 한다.',
        art: astArt('orc_shaman', { glow: '110,240,130', shot: 'bolt' })
    },
    minotaur: {
        id: 'minotaur', name: '미노타우로스', role: 'melee', family: 'beast', grade: 'epic',
        sprite: HD_MONSTER_ART.minotaur.sprite, cost: 250,
        stats: { hp: 480, damage: 50, interval: 1.2, range: 2.4, block: 3, respawn: 6 },
        abilities: [{ kind: 'cleave', radius: 1.5, ratio: 0.6 }], unlock: 'start',
        desc: '큰 도끼를 휘둘러 곁의 용사와 그 둘레를 함께 벤다.',
        art: astArt('minotaur', { glow: '255,140,50' })
    },
    vampire: {
        id: 'vampire', name: '뱀파이어', role: 'ranged', family: 'undead', grade: 'epic',
        sprite: ASTERIA_ART.vampire.sprite, cost: 250,
        stats: { hp: 70, damage: 40, interval: 1.0, range: 4 },
        abilities: [{ kind: 'goldOnKill', gold: 3 }], unlock: 'start',
        desc: '먼 곳의 용사에게 핏빛 구슬을 쏘고, 쓰러뜨리면 금화를 챙긴다.',
        art: astArt('vampire', { glow: '255,50,80', shot: 'fx_shot_blood' })
    },
    flame_demon: {
        id: 'flame_demon', name: '용암 악마', role: 'area', family: 'demon', grade: 'epic',
        sprite: ASTERIA_ART.flame_demon.sprite, cost: 250,
        stats: { hp: 80, damage: 45, interval: 2.2, range: 3, splash: 1.5 },
        abilities: [{ kind: 'burnGround', radius: 1, dps: 10, duration: 3 }], unlock: 'start',
        desc: '용암 덩이를 던져 무리를 태우고 그 자리에 불 장판을 남긴다.',
        art: astArt('flame_demon', { glow: '255,90,20', shot: 'fx_shot_fire', impact: 'fx_hit_fire' })
    },
    ancient_treant: {
        id: 'ancient_treant', name: '고대 나무 정령', role: 'tank', family: 'spirit', grade: 'epic',
        sprite: ASTERIA_ART.ancient_treant.sprite, cost: 250,
        stats: { hp: 700, damage: 28, interval: 1.3, range: 2, block: 6, respawn: 6 },
        abilities: [{ kind: 'slowShot', name: '뿌리 묶기', speedMul: 0.7, duration: 2 }], unlock: 'start',
        desc: '곁의 용사 6명을 뿌리로 묶어 느리게 한다.',
        art: astArt('ancient_treant', { glow: '140,255,100' })
    },
    hell_general: {
        id: 'hell_general', name: '지옥 대장군', role: 'melee', family: 'demon', grade: 'legendary',
        sprite: ASTERIA_ART.hell_general.sprite, cost: 500, summon: false,
        stats: { hp: 800, damage: 95, interval: 0.8, range: 2.4, block: 4, respawn: 5 },
        abilities: [{ kind: 'cleave', radius: 2, ratio: 0.7 }, { kind: 'frenzy', duration: 3, intervalMul: 0.6 }], unlock: 'start',
        skills: [{ kind: 'meteor', name: '지옥불 강타', cooldown: 12, reach: 5, radius: 2, mul: 3, burn: 3 }],
        desc: '곁의 용사를 불칼로 쓸어버린다.',
        art: astArt('hell_general', { glow: '255,170,40' })
    },
    archlich: {
        id: 'archlich', name: '대리치', role: 'area', family: 'undead', grade: 'legendary',
        sprite: ASTERIA_ART.archlich.sprite, cost: 500, summon: false,
        stats: { hp: 120, damage: 100, interval: 1.8, range: 4.5, splash: 2 },
        abilities: [{ kind: 'chain', count: 3, ratio: 0.6, jump: 2.5 }, { kind: 'aura', stat: 'attackSpeed', radius: 3, value: 0.2 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '죽음의 파동', cooldown: 16, radius: 4.5, mul: 1.5, curse: 3 }],
        desc: '죽음의 구체를 떨어뜨리고 번개로 잇는다. 둘레 몬스터가 더 빨리 공격한다.',
        art: astArt('archlich', { glow: '80,255,150', shot: 'bolt' })
    },

    // ----- 55종 확장(2026-11-07): 그림은 Asteria(js/data/asteria_art.js), 맞는 그림이 없는 4종만 PixelLab. 수치 초안 -----
    grave_keeper: {
        id: 'grave_keeper', name: '묘지기', role: 'tank', family: 'undead', grade: 'common',
        sprite: ASTERIA_ART.grave_keeper.sprite, cost: 60,
        stats: { hp: 150, damage: 7, interval: 1.1, range: 2, block: 2, respawn: 7 },
        abilities: [{ kind: 'curseShot', name: '무덤의 저주', duration: 2, takenMul: 1.1 }], unlock: 'start',
        desc: '등불로 곁을 지나는 용사 2명에게 저주를 건다.',
        art: astArt('grave_keeper', { glow: '150,190,255' })
    },
    wraith_swordsman: {
        id: 'wraith_swordsman', name: '망령 검사', role: 'melee', family: 'undead', grade: 'rare',
        sprite: ASTERIA_ART.wraith_swordsman.sprite, cost: 120,
        stats: { hp: 190, damage: 20, interval: 0.7, range: 2.4, block: 2, respawn: 7 },
        abilities: [{ kind: 'frenzy', duration: 2, intervalMul: 0.7 }], unlock: 'start',
        desc: '곁의 용사 2명을 베고, 쓰러뜨리면 잠시 더 빨라진다.',
        art: astArt('wraith_swordsman', { glow: '150,110,255' })
    },
    plague_ghoul: {
        id: 'plague_ghoul', name: '독 구울', role: 'area', family: 'undead', grade: 'rare',
        sprite: ASTERIA_ART.plague_ghoul.sprite, cost: 120,
        stats: { hp: 50, damage: 12, interval: 1.8, range: 3, splash: 1 },
        abilities: [{ kind: 'curseShot', duration: 3, takenMul: 1.2 }], unlock: 'start',
        desc: '독 안개를 던져 맞은 용사들이 더 큰 피해를 받게 한다.',
        art: astArt('plague_ghoul', { glow: '190,170,240', shot: 'bolt' })
    },
    bone_priest: {
        id: 'bone_priest', name: '뼈의 사제', role: 'support', family: 'undead', grade: 'epic',
        sprite: ASTERIA_ART.bone_priest.sprite, cost: 250,
        stats: { hp: 90, damage: 12, interval: 1.5, range: 3 },
        abilities: [{ kind: 'aura', stat: 'attackSpeed', radius: 3, value: 0.2 }], unlock: 'start',
        desc: '둘레 몬스터의 공격 속도를 올리는 뼈 가면의 사제이다.',
        art: astArt('bone_priest', { glow: '140,230,120', shot: 'bolt' })
    },
    goblin_thrower: {
        id: 'goblin_thrower', name: '고블린 투척병', role: 'ranged', family: 'orc', grade: 'common',
        sprite: HD_MONSTER_ART.goblin_thrower.sprite, cost: 60,
        stats: { hp: 35, damage: 10, interval: 1.0, range: 2.5 },
        abilities: [{ kind: 'stunShot', chance: 0.1, duration: 0.6 }], unlock: 'start',
        desc: '창을 던져 가끔 용사를 멈춰 세운다.',
        art: astArt('goblin_thrower', { glow: '255,190,90' })
    },
    orc_charger: {
        id: 'orc_charger', name: '돌격대장', role: 'melee', family: 'orc', grade: 'epic',
        sprite: ASTERIA_ART.orc_charger.sprite, cost: 250,
        stats: { hp: 460, damage: 44, interval: 0.9, range: 2.4, block: 3, respawn: 6 },
        abilities: [{ kind: 'frenzy', duration: 3, intervalMul: 0.65 }], unlock: 'start',
        desc: '곁의 용사 3명을 들이받고, 쓰러뜨리면 더 사나워진다.',
        art: astArt('orc_charger', { glow: '255,150,80' })
    },
    war_drummer: {
        id: 'war_drummer', name: '전쟁 북꾼', role: 'support', family: 'orc', grade: 'epic',
        sprite: HD_MONSTER_ART.war_drummer.sprite, cost: 250,
        stats: { hp: 100, damage: 10, interval: 1.5, range: 3 },
        abilities: [{ kind: 'aura', stat: 'damage', radius: 3, value: 0.3 }], unlock: 'start',
        desc: '북소리로 둘레 몬스터의 피해를 올린다.',
        art: astArt('war_drummer', { glow: '255,120,70', shot: 'bolt' })
    },
    ogre_crusher: {
        id: 'ogre_crusher', name: '오우거 파쇄자', role: 'melee', family: 'orc', grade: 'epic',
        sprite: HD_MONSTER_ART.ogre_crusher.sprite, cost: 250,
        stats: { hp: 560, damage: 60, interval: 1.4, range: 2.4, block: 4, respawn: 7 },
        abilities: [{ kind: 'cleave', radius: 1.5, ratio: 0.6 }], unlock: 'start',
        desc: '느리지만 한 번에 여럿을 부수는 거한이다.',
        art: astArt('ogre_crusher', { glow: '255,170,90' })
    },
    orc_high_chief: {
        id: 'orc_high_chief', name: '대족장', role: 'melee', family: 'orc', grade: 'legendary',
        sprite: ASTERIA_ART.orc_high_chief.sprite, cost: 500, summon: false,
        stats: { hp: 1000, damage: 95, interval: 0.9, range: 2.4, block: 6, respawn: 5 },
        abilities: [{ kind: 'cleave', radius: 2, ratio: 0.4 }, { kind: 'aura', stat: 'damage', radius: 3, value: 0.2 }], unlock: 'start',
        skills: [{ kind: 'buff', name: '전쟁의 함성', cooldown: 20, duration: 8, damage: 0.3 }],
        desc: '철퇴를 휘두르며 둘레 몬스터를 함께 강하게 만든다.',
        art: astArt('orc_high_chief', { glow: '255,160,70' })
    },
    giant_king: {
        id: 'giant_king', name: '거인 왕', role: 'tank', family: 'orc', grade: 'legendary',
        sprite: ASTERIA_ART.giant_king.sprite, cost: 500, summon: false,
        stats: { hp: 1400, damage: 70, interval: 1.3, range: 2, block: 10, respawn: 6 },
        abilities: [{ kind: 'stunShot', chance: 0.2, duration: 1.2 }, { kind: 'cleave', radius: 1.5, ratio: 0.4 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '대지 강타', cooldown: 15, radius: 3, mul: 1.5, stun: 2 }],
        desc: '곁의 용사 10명을 한꺼번에 내리치는 거인이다.',
        art: astArt('giant_king', { glow: '255,140,60' })
    },
    hellhound_warrior: {
        id: 'hellhound_warrior', name: '지옥견', role: 'melee', family: 'demon', grade: 'common',
        sprite: ASTERIA_ART.hellhound_warrior.sprite, cost: 60,
        stats: { hp: 90, damage: 13, interval: 0.7, range: 2.4, block: 1, respawn: 6 },
        abilities: [{ kind: 'frenzy', duration: 2, intervalMul: 0.7 }], unlock: 'start',
        desc: '불타는 사냥개이다. 쓰러뜨리면 더 빨리 문다.',
        art: astArt('hellhound_warrior', { glow: '255,120,50' })
    },
    succubus: {
        id: 'succubus', name: '서큐버스', role: 'ranged', family: 'demon', grade: 'rare',
        sprite: HD_MONSTER_ART.succubus.sprite, cost: 120,
        stats: { hp: 45, damage: 18, interval: 1.0, range: 3.5 },
        abilities: [{ kind: 'curseShot', duration: 3, takenMul: 1.2 }], unlock: 'start',
        desc: '홀린 용사가 더 큰 피해를 받게 한다.',
        art: astArt('succubus', { glow: '255,90,190', shot: 'bolt' })
    },
    flame_archer: {
        id: 'flame_archer', name: '화염 궁수', role: 'tank', family: 'demon', grade: 'rare',
        sprite: ASTERIA_ART.flame_archer.sprite, cost: 120,
        stats: { hp: 240, damage: 18, interval: 1.0, range: 2, block: 3, respawn: 7 },
        abilities: [{ kind: 'burnShot', dps: 6, duration: 2 }], unlock: 'start',
        desc: '곁의 용사 3명을 불로 때려 태운다.',
        art: astArt('flame_archer', { glow: '255,110,50' })
    },
    executioner: {
        id: 'executioner', name: '심판의 처형자', role: 'melee', family: 'demon', grade: 'epic',
        sprite: ASTERIA_ART.executioner.sprite, cost: 250,
        stats: { hp: 420, damage: 70, interval: 1.3, range: 2.4, block: 2, respawn: 6 },
        abilities: [{ kind: 'frenzy', duration: 3, intervalMul: 0.65 }, { kind: 'cleave', radius: 1.5, ratio: 0.5 }], unlock: 'start',
        desc: '큰 낫으로 둘레를 함께 베는 사신이다.',
        art: astArt('executioner', { glow: '190,90,255' })
    },
    chaos_mage: {
        id: 'chaos_mage', name: '혼돈 마도사', role: 'area', family: 'demon', grade: 'epic',
        sprite: ASTERIA_ART.chaos_mage.sprite, cost: 250,
        stats: { hp: 80, damage: 42, interval: 2.0, range: 3.5, splash: 1.5 },
        abilities: [{ kind: 'curseShot', duration: 3, takenMul: 1.25 }], unlock: 'start',
        desc: '넓은 저주를 터뜨린다.',
        art: astArt('chaos_mage', { glow: '170,110,255', shot: 'bolt' })
    },
    fallen_angel: {
        id: 'fallen_angel', name: '타락 천사', role: 'ranged', family: 'demon', grade: 'legendary',
        sprite: ASTERIA_ART.fallen_angel.sprite, cost: 500, summon: false,
        stats: { hp: 140, damage: 130, interval: 1.0, range: 5 },
        abilities: [{ kind: 'chain', count: 4, ratio: 0.5, jump: 2.5 }, { kind: 'curseShot', duration: 4, takenMul: 1.3 }], unlock: 'start',
        skills: [{ kind: 'harvest', name: '검은 심판', cooldown: 14, reach: 5, below: 0.25, gold: 1 }],
        desc: '검은 빛이 용사들 사이를 이어 달린다.',
        art: astArt('fallen_angel', { glow: '255,210,120', shot: 'bolt' })
    },
    boar_warrior: {
        id: 'boar_warrior', name: '멧돼지 전사', role: 'tank', family: 'beast', grade: 'common',
        sprite: ASTERIA_ART.boar_warrior.sprite, cost: 60,
        stats: { hp: 160, damage: 8, interval: 1.1, range: 2, block: 2, respawn: 7 },
        abilities: [], unlock: 'start',
        desc: '튼튼한 멧돼지가 길을 막는다.',
        art: astArt('boar_warrior', { glow: '255,160,80' })
    },
    spider_archer: {
        id: 'spider_archer', name: '독거미', role: 'ranged', family: 'beast', grade: 'common',
        sprite: ASTERIA_ART.spider_archer.sprite, cost: 60,
        stats: { hp: 35, damage: 9, interval: 0.9, range: 2.5 },
        abilities: [{ kind: 'slowShot', speedMul: 0.8, duration: 1.5 }], unlock: 'start',
        desc: '독을 뱉어 용사를 느리게 한다.',
        art: astArt('spider_archer', { glow: '100,210,255', shot: 'bolt' })
    },
    bear_warrior: {
        id: 'bear_warrior', name: '곰 전사', role: 'tank', family: 'beast', grade: 'rare',
        sprite: ASTERIA_ART.bear_warrior.sprite, cost: 120,
        stats: { hp: 360, damage: 16, interval: 1.2, range: 2, block: 4, respawn: 7 },
        abilities: [{ kind: 'slowShot', name: '곰의 앞발', speedMul: 0.8, duration: 1.5 }], unlock: 'start',
        desc: '곁의 용사 4명을 앞발로 후려 느리게 한다.',
        art: astArt('bear_warrior', { glow: '190,225,255' })
    },
    eagle_hunter: {
        id: 'eagle_hunter', name: '독수리 사냥꾼', role: 'ranged', family: 'beast', grade: 'rare',
        sprite: ASTERIA_ART.eagle_hunter.sprite, cost: 120,
        stats: { hp: 45, damage: 24, interval: 0.9, range: 4.5 },
        abilities: [{ kind: 'goldOnKill', gold: 1 }], unlock: 'start',
        desc: '멀리서 쏘고 쓰러뜨린 용사의 금화를 챙긴다.',
        art: astArt('eagle_hunter', { glow: '255,190,200' })
    },
    saber_warrior: {
        id: 'saber_warrior', name: '검치호 전사', role: 'melee', family: 'beast', grade: 'epic',
        sprite: ASTERIA_ART.saber_warrior.sprite, cost: 250,
        stats: { hp: 420, damage: 56, interval: 0.8, range: 2.4, block: 3, respawn: 6 },
        abilities: [{ kind: 'frenzy', duration: 3, intervalMul: 0.6 }], unlock: 'start',
        desc: '곁의 용사 3명을 할퀴고, 쓰러뜨리면 더 빨라진다.',
        art: astArt('saber_warrior', { glow: '255,215,120' })
    },
    hydra_warrior: {
        id: 'hydra_warrior', name: '히드라', role: 'area', family: 'beast', grade: 'epic',
        sprite: ASTERIA_ART.hydra_warrior.sprite, cost: 250,
        stats: { hp: 110, damage: 38, interval: 1.6, range: 3.5, splash: 1.2 },
        abilities: [{ kind: 'chain', count: 2, ratio: 0.5, jump: 2 }], unlock: 'start',
        desc: '세 머리가 독을 뿜어 이어 맞힌다.',
        art: astArt('hydra_warrior', { glow: '160,220,90', shot: 'bolt' })
    },
    earth_behemoth: {
        id: 'earth_behemoth', name: '대지의 거수', role: 'tank', family: 'beast', grade: 'legendary',
        sprite: ASTERIA_ART.earth_behemoth.sprite, cost: 500, summon: false,
        stats: { hp: 1500, damage: 64, interval: 1.2, range: 2, block: 9, respawn: 6 },
        abilities: [{ kind: 'cleave', radius: 1.5, ratio: 0.5 }, { kind: 'slowShot', name: '가시 덩굴', speedMul: 0.7, duration: 2 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '가시 폭풍', cooldown: 14, radius: 3.5, mul: 2, slow: 3 }],
        desc: '곁의 용사 9명을 가시로 찔러 느리게 한다.',
        art: astArt('earth_behemoth', { glow: '220,90,80' })
    },
    phoenix_lord: {
        id: 'phoenix_lord', name: '불사조', role: 'area', family: 'beast', grade: 'legendary',
        sprite: ASTERIA_ART.phoenix_lord.sprite, cost: 500, summon: false,
        stats: { hp: 150, damage: 90, interval: 1.6, range: 4.5, splash: 2 },
        abilities: [{ kind: 'burnGround', name: '불바다', radius: 1.2, dps: 20, duration: 4 }], unlock: 'start',
        skills: [{ kind: 'buff', name: '재생의 불꽃', cooldown: 25, duration: 8, damage: 0.25 }],
        desc: '지나간 자리를 불바다로 만든다.',
        art: astArt('phoenix_lord', { glow: '255,150,50', shot: 'bolt' })
    },
    rock_spirit: {
        id: 'rock_spirit', name: '바위 정령', role: 'tank', family: 'spirit', grade: 'common',
        sprite: ASTERIA_ART.rock_spirit.sprite, cost: 60,
        stats: { hp: 190, damage: 5, interval: 1.3, range: 2, block: 3, respawn: 8 },
        abilities: [], unlock: 'start',
        desc: '느리지만 잘 버티는 흙과 바위의 정령이다.',
        art: astArt('rock_spirit', { glow: '190,170,120' })
    },
    wind_sylph: {
        id: 'wind_sylph', name: '바람 정령', role: 'ranged', family: 'spirit', grade: 'common',
        sprite: ASTERIA_ART.wind_sylph.sprite, cost: 60,
        stats: { hp: 30, damage: 8, interval: 0.7, range: 3 },
        abilities: [{ kind: 'slowShot', speedMul: 0.85, duration: 1 }], unlock: 'start',
        desc: '빠른 바람 칼날로 발을 묶는다.',
        art: astArt('wind_sylph', { glow: '170,220,255', shot: 'bolt' })
    },
    water_spirit: {
        id: 'water_spirit', name: '물의 정령', role: 'support', family: 'spirit', grade: 'rare',
        sprite: ASTERIA_ART.water_spirit.sprite, cost: 120,
        stats: { hp: 60, damage: 6, interval: 1.5, range: 2.5 },
        abilities: [{ kind: 'aura', stat: 'attackSpeed', radius: 3, value: 0.1 }], unlock: 'start',
        desc: '둘레 몬스터의 공격 속도를 올린다.',
        art: astArt('water_spirit', { glow: '110,210,255', shot: 'bolt' })
    },
    lightning_spirit: {
        id: 'lightning_spirit', name: '번개 정령', role: 'ranged', family: 'spirit', grade: 'rare',
        sprite: ASTERIA_ART.lightning_spirit.sprite, cost: 120,
        stats: { hp: 40, damage: 18, interval: 1.1, range: 3 },
        abilities: [{ kind: 'chain', count: 2, ratio: 0.5, jump: 2 }], unlock: 'start',
        desc: '번개가 다음 용사로 튄다.',
        art: astArt('lightning_spirit', { glow: '110,160,255', shot: 'bolt' })
    },
    moon_priestess: {
        id: 'moon_priestess', name: '달의 사제', role: 'support', family: 'spirit', grade: 'epic',
        sprite: ASTERIA_ART.moon_priestess.sprite, cost: 250,
        stats: { hp: 90, damage: 14, interval: 1.4, range: 3 },
        abilities: [{ kind: 'aura', stat: 'damage', radius: 3, value: 0.2 }], unlock: 'start',
        desc: '달빛으로 둘레 몬스터의 피해를 크게 올린다.',
        art: astArt('moon_priestess', { glow: '200,220,255', shot: 'bolt' })
    },
    storm_archer: {
        id: 'storm_archer', name: '폭풍의 궁수', role: 'ranged', family: 'spirit', grade: 'epic',
        sprite: ASTERIA_ART.storm_archer.sprite, cost: 250,
        stats: { hp: 90, damage: 46, interval: 1.0, range: 4.5 },
        abilities: [{ kind: 'chain', count: 2, ratio: 0.6, jump: 2.5 }], unlock: 'start',
        desc: '하늘에서 폭풍을 내리꽂는다.',
        art: astArt('storm_archer', { glow: '140,190,255', shot: 'bolt' })
    },
    element_sage: {
        id: 'element_sage', name: '원소의 현자', role: 'area', family: 'spirit', grade: 'legendary',
        sprite: ASTERIA_ART.element_sage.sprite, cost: 500, summon: false,
        stats: { hp: 130, damage: 95, interval: 1.7, range: 4.5, splash: 2 },
        abilities: [{ kind: 'slowShot', speedMul: 0.6, duration: 2.5 }, { kind: 'burnGround', name: '일곱 빛 불꽃', radius: 1, dps: 15, duration: 3 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '운명의 실', cooldown: 18, radius: 'map', mul: 0.5, slow: 5 }],
        desc: '일곱 빛깔 실로 용사의 발을 묶고 태운다.',
        art: astArt('element_sage', { glow: '255,210,240', shot: 'bolt' })
    },
    crystal_giant: {
        id: 'crystal_giant', name: '수정 거인', role: 'tank', family: 'spirit', grade: 'legendary',
        sprite: ASTERIA_ART.crystal_giant.sprite, cost: 500, summon: false,
        stats: { hp: 1600, damage: 66, interval: 1.3, range: 2, block: 10, respawn: 6 },
        abilities: [{ kind: 'cleave', radius: 1.5, ratio: 0.4 }, { kind: 'stunShot', chance: 0.2, duration: 1.2 }], unlock: 'start',
        skills: [{ kind: 'buff', name: '수정 공명', cooldown: 20, duration: 6, damage: 0.2 }],
        desc: '곁의 용사 10명을 수정 주먹으로 내리친다.',
        art: astArt('crystal_giant', { glow: '150,180,255' })
    },

    // ----- 신화: 전설 3마리로 만드는 합성 신화 8종(등급 합치기) -----
    abyss_dragon_king: {
        id: 'abyss_dragon_king', name: '심연의 용왕', role: 'area', family: 'spirit', grade: 'mythic',
        sprite: ASTERIA_ART.abyss_dragon_king.sprite, cost: 1000,
        stats: { hp: 240, damage: 170, interval: 1.6, range: 5, splash: 2.2 },
        abilities: [{ kind: 'chain', count: 3, ratio: 0.5, jump: 2.5 }], unlock: 'start',
        skills: [{ kind: 'push', name: '심연의 포효', cooldown: 18, radius: 'map', mul: 1, tiles: 2.5 }, { kind: 'meteor', name: '해일', cooldown: 13, reach: 6, radius: 2.5, mul: 2.5, slow: 3 }],
        desc: '포효로 맵의 모든 용사를 뒤로 밀어낸다.',
        art: astArt('abyss_dragon_king', { glow: '90,220,200', shot: 'bolt' })
    },
    time_witch: {
        id: 'time_witch', name: '시간의 마녀', role: 'ranged', family: 'spirit', grade: 'mythic',
        sprite: ASTERIA_ART.time_witch.sprite, cost: 1000,
        stats: { hp: 220, damage: 190, interval: 1.0, range: 5.5 },
        abilities: [{ kind: 'slowShot', speedMul: 0.6, duration: 2 }], unlock: 'start',
        skills: [{ kind: 'timeStop', name: '시간 정지', cooldown: 22, duration: 3 }, { kind: 'barrage', name: '시간의 화살', cooldown: 11, count: 10, mul: 1, reach: 'map' }],
        desc: '시간을 멈춰 용사들을 세운다.',
        art: astArt('time_witch', { glow: '230,210,160', shot: 'bolt' })
    },
    soul_devourer: {
        id: 'soul_devourer', name: '영혼 포식자', role: 'area', family: 'undead', grade: 'mythic',
        sprite: ASTERIA_ART.soul_devourer.sprite, cost: 1000,
        stats: { hp: 260, damage: 160, interval: 1.5, range: 5, splash: 2 },
        abilities: [{ kind: 'curseShot', duration: 4, takenMul: 1.3 }], unlock: 'start',
        skills: [{ kind: 'harvest', name: '영혼 수확', cooldown: 12, reach: 5, below: 0.3, gold: 2 }, { kind: 'nova', name: '영혼 흡수', cooldown: 16, radius: 4, mul: 1.5, curse: 4 }],
        desc: '약해진 용사의 영혼을 통째로 삼킨다.',
        art: astArt('soul_devourer', { glow: '170,230,110', shot: 'bolt' })
    },
    bone_dragon: {
        id: 'bone_dragon', name: '뼈 용', role: 'area', family: 'undead', grade: 'mythic',
        sprite: ASTERIA_ART.bone_dragon.sprite, cost: 1000,
        stats: { hp: 280, damage: 175, interval: 1.7, range: 5, splash: 2.2 },
        abilities: [{ kind: 'burnGround', name: '죽음의 불길', radius: 1.2, dps: 25, duration: 4 }], unlock: 'start',
        skills: [{ kind: 'meteor', name: '죽음의 숨결', cooldown: 10, reach: 6, radius: 2.5, mul: 3, curse: 4 }, { kind: 'nova', name: '뼈의 비명', cooldown: 18, radius: 4, mul: 1, stun: 2 }],
        desc: '초록 숨결로 넓은 땅을 태운다.',
        art: astArt('bone_dragon', { glow: '120,240,130', shot: 'bolt' })
    },
    kraken: {
        id: 'kraken', name: '심연의 크라켄', role: 'tank', family: 'beast', grade: 'mythic',
        sprite: ASTERIA_ART.kraken.sprite, cost: 1000,
        stats: { hp: 2400, damage: 130, interval: 1.1, range: 2, block: 14, respawn: 5 },
        abilities: [{ kind: 'slowShot', name: '먹물', speedMul: 0.6, duration: 2.5 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '촉수 붙잡기', cooldown: 14, radius: 4, mul: 1.5, stun: 2.5 }, { kind: 'push', name: '소용돌이', cooldown: 20, radius: 5, mul: 1, tiles: 2 }],
        desc: '곁의 용사 14명을 촉수로 후려친다.',
        art: astArt('kraken', { glow: '130,110,230' })
    },
    frost_queen: {
        id: 'frost_queen', name: '서리 여왕', role: 'area', family: 'spirit', grade: 'mythic',
        sprite: ASTERIA_ART.frost_queen.sprite, cost: 1000,
        stats: { hp: 220, damage: 180, interval: 1.6, range: 5, splash: 2.2 },
        abilities: [{ kind: 'slowShot', speedMul: 0.5, duration: 3 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '절대 영도', cooldown: 20, radius: 'map', mul: 0.8, slow: 6 }, { kind: 'buff', name: '얼음 숨결', cooldown: 18, duration: 6, speed: 0.25 }],
        desc: '맵 전체를 얼려 용사의 발을 묶는다.',
        art: astArt('frost_queen', { glow: '160,220,255', shot: 'bolt' })
    },
    star_whale: {
        id: 'star_whale', name: '별의 고래', role: 'ranged', family: 'beast', grade: 'mythic',
        sprite: ASTERIA_ART.star_whale.sprite, cost: 1000,
        stats: { hp: 260, damage: 170, interval: 1.1, range: 5.5 },
        abilities: [{ kind: 'chain', count: 3, ratio: 0.6, jump: 3 }], unlock: 'start',
        skills: [{ kind: 'barrage', name: '별의 비', cooldown: 12, count: 12, mul: 1, reach: 'map' }, { kind: 'buff', name: '별의 노래', cooldown: 20, duration: 8, speed: 0.3 }],
        desc: '하늘에서 별을 쏟아붓는다.',
        art: astArt('star_whale', { glow: '120,140,255', shot: 'bolt' })
    },
    frost_drake: {
        id: 'frost_drake', name: '서리 비룡', role: 'area', family: 'beast', grade: 'mythic',
        sprite: ASTERIA_ART.frost_drake.sprite, cost: 1000,
        stats: { hp: 250, damage: 165, interval: 1.5, range: 5, splash: 2 },
        abilities: [{ kind: 'slowShot', speedMul: 0.6, duration: 2.5 }], unlock: 'start',
        skills: [{ kind: 'meteor', name: '서리 숨결', cooldown: 11, reach: 6, radius: 3, mul: 2.5, slow: 4 }, { kind: 'nova', name: '눈보라', cooldown: 16, radius: 5, mul: 1.2, slow: 4 }],
        desc: '얼음 숨결로 길을 뒤덮는다.',
        art: astArt('frost_drake', { glow: '170,225,255', shot: 'bolt' })
    },

    // ----- 히든 신화: S랭크 전설 2마리 조합식으로만 만든다. 사실상 신화 윗등급(성능 약 1.5배) -----
    sun_god: {
        id: 'sun_god', name: '태양신', role: 'area', family: 'demon', grade: 'mythic',
        sprite: ASTERIA_ART.sun_god.sprite, cost: 1000, hiddenMythic: true, gradeMerge: false,
        stats: { hp: 400, damage: 270, interval: 1.4, range: 6, splash: 2.6 },
        abilities: [{ kind: 'burnGround', name: '태양의 불길', radius: 1.5, dps: 40, duration: 4 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '태양 폭발', cooldown: 16, radius: 'map', mul: 2.5, burn: 5 }, { kind: 'buff', name: '여명', cooldown: 24, duration: 8, speed: 0.3 }],
        desc: '히든 신화. 맵 전체를 불태우고 몬스터를 빛으로 북돋운다.',
        art: astArt('sun_god', { glow: '255,210,110', shot: 'bolt' })
    },
    moon_god: {
        id: 'moon_god', name: '달의 여신', role: 'ranged', family: 'spirit', grade: 'mythic',
        sprite: ASTERIA_ART.moon_god.sprite, cost: 1000, hiddenMythic: true, gradeMerge: false,
        stats: { hp: 380, damage: 380, interval: 0.9, range: 6.5 },
        abilities: [{ kind: 'chain', count: 4, ratio: 0.6, jump: 3 }], unlock: 'start',
        skills: [{ kind: 'timeStop', name: '달빛 정지', cooldown: 20, duration: 3 }, { kind: 'buff', name: '달의 장막', cooldown: 18, duration: 8, damage: 0.3 }],
        desc: '히든 신화. 시간을 멈추고 몬스터를 달빛으로 강하게 한다.',
        art: astArt('moon_god', { glow: '200,220,255', shot: 'bolt' })
    },
    death_god: {
        id: 'death_god', name: '죽음의 신', role: 'melee', family: 'undead', grade: 'mythic',
        sprite: ASTERIA_ART.death_god.sprite, cost: 1000, hiddenMythic: true, gradeMerge: false,
        stats: { hp: 2800, damage: 280, interval: 0.8, range: 2.4, block: 8, respawn: 4 },
        abilities: [{ kind: 'cleave', radius: 2.5, ratio: 0.45 }], unlock: 'start',
        skills: [{ kind: 'harvest', name: '사신의 낫', cooldown: 10, reach: 'map', below: 0.35, gold: 2 }, { kind: 'barrage', name: '저승의 군세', cooldown: 14, count: 15, mul: 1.2, reach: 'map' }],
        desc: '히든 신화. 약해진 용사는 맵 어디에 있어도 거둔다.',
        art: astArt('death_god', { glow: '200,170,255' })
    },
    god_king: {
        id: 'god_king', name: '신왕', role: 'melee', family: 'spirit', grade: 'mythic',
        sprite: ASTERIA_ART.god_king.sprite, cost: 1000, hiddenMythic: true, gradeMerge: false,
        stats: { hp: 3600, damage: 200, interval: 0.9, range: 2.4, block: 12, respawn: 4 },
        abilities: [{ kind: 'aura', stat: 'damage', radius: 5, value: 0.3 }], unlock: 'start',
        skills: [{ kind: 'buff', name: '신왕의 칙령', cooldown: 20, duration: 10, damage: 0.5, speed: 0.3 }, { kind: 'barrage', name: '천벌', cooldown: 15, count: 14, mul: 1.1, reach: 'map' }],
        desc: '히든 신화. 맵의 모든 몬스터를 강하게 하고 하늘의 벌을 내린다.',
        art: astArt('god_king', { glow: '255,225,150' })
    },
    // ----- 히든 전용(조합 제단으로만 나온다. 소환과 등급 합치기에는 없다, 2026-11-10) -----
    gem_mimic: {
        id: 'gem_mimic', name: '보석 미믹', role: 'melee', family: 'beast', grade: 'epic',
        sprite: ASTERIA_ART.gem_mimic.sprite, cost: 300, summon: false, gradeMerge: false,
        stats: { hp: 400, damage: 52, interval: 1.0, range: 2.2, block: 3, respawn: 6 },
        abilities: [{ kind: 'goldOnKill', gold: 6 }], unlock: 'start',
        desc: '히든. 보물 상자인 척하다 문다. 처치할 때마다 보석을 흘린다.',
        art: astArt('gem_mimic', { glow: '255,210,120' })
    },
    mushroom_king: {
        id: 'mushroom_king', name: '버섯 왕', role: 'area', family: 'spirit', grade: 'epic',
        sprite: ASTERIA_ART.mushroom_king.sprite, cost: 300, summon: false, gradeMerge: false,
        stats: { hp: 120, damage: 54, interval: 1.6, range: 4, splash: 1.6 },
        abilities: [{ kind: 'slowShot', name: '포자', speedMul: 0.7, duration: 2.5 }], unlock: 'start',
        desc: '히든. 포자 웅덩이로 용사를 느리게 하고 방어를 무르게 한다.',
        art: astArt('mushroom_king', { glow: '255,120,120' })
    },
    slime_monarch: {
        id: 'slime_monarch', name: '슬라임 군주', role: 'area', family: 'undead', grade: 'epic',
        sprite: ASTERIA_ART.slime_monarch.sprite, cost: 300, summon: false, gradeMerge: false,
        stats: { hp: 140, damage: 26, interval: 1.4, range: 3.5, splash: 1.8 },
        abilities: [{ kind: 'burnGround', name: '산성 점액', radius: 1.2, dps: 9, duration: 4 }], unlock: 'start',
        desc: '히든. 삼킨 용사의 뼈가 몸 안에 떠 있다. 산성 점액을 뿌린다.',
        art: astArt('slime_monarch', { glow: '150,255,90' })
    },
    ghost_captain: {
        id: 'ghost_captain', name: '유령 선장', role: 'ranged', family: 'undead', grade: 'legendary',
        sprite: ASTERIA_ART.ghost_captain.sprite, cost: 600, summon: false, gradeMerge: false,
        stats: { hp: 200, damage: 70, interval: 0.9, range: 5.5 },
        abilities: [{ kind: 'goldOnKill', gold: 8 }], unlock: 'start',
        skills: [{ kind: 'barrage', name: '유령선 일제 사격', cooldown: 12, count: 10, mul: 1.1, reach: 'map' }],
        desc: '히든. 가라앉은 배의 선원들이 함께 쏜다.',
        art: astArt('ghost_captain', { glow: '120,255,220', shot: 'bolt' })
    },
    frost_mammoth: {
        id: 'frost_mammoth', name: '서리 매머드', role: 'tank', family: 'beast', grade: 'legendary',
        sprite: ASTERIA_ART.frost_mammoth.sprite, cost: 600, summon: false, gradeMerge: false,
        stats: { hp: 1800, damage: 90, interval: 1.2, range: 2.2, block: 10, respawn: 6 },
        abilities: [{ kind: 'cleave', radius: 2, ratio: 0.6 }, { kind: 'slowShot', name: '얼음 엄니', speedMul: 0.6, duration: 2 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '빙하 짓밟기', cooldown: 14, radius: 3.5, mul: 2, slow: 3 }],
        desc: '히든. 짓밟은 땅이 얼어붙는다.',
        art: astArt('frost_mammoth', { glow: '170,220,255' })
    },
    magma_tortoise: {
        id: 'magma_tortoise', name: '용암 거북', role: 'tank', family: 'orc', grade: 'legendary',
        sprite: ASTERIA_ART.magma_tortoise.sprite, cost: 600, summon: false, gradeMerge: false,
        stats: { hp: 2000, damage: 85, interval: 1.3, range: 2.2, block: 10, respawn: 6 },
        abilities: [{ kind: 'cleave', radius: 2, ratio: 0.6 }, { kind: 'burnGround', name: '용암 등껍질', radius: 1.5, dps: 30, duration: 4 }], unlock: 'start',
        skills: [{ kind: 'meteor', name: '분화', cooldown: 12, reach: 5, radius: 2, mul: 2.5, burn: 4 }],
        desc: '히든. 등의 화산이 터지면 둘레가 불바다가 된다.',
        art: astArt('magma_tortoise', { glow: '255,120,40' })
    },
    // ----- 초월(히든 신화 위 등급, 조합 제단으로만) -----
    ferry_reaper: {
        id: 'ferry_reaper', name: '저승 뱃사공', role: 'melee', family: 'undead', grade: 'transcendent',
        sprite: ASTERIA_ART.ferry_reaper.sprite, cost: 2000, summon: false, gradeMerge: false,
        stats: { hp: 4200, damage: 760, interval: 0.8, range: 2.6, block: 10, respawn: 4 },
        abilities: [{ kind: 'cleave', radius: 2.6, ratio: 0.45 }], unlock: 'start',
        skills: [{ kind: 'harvest', name: '저승 노', cooldown: 8, reach: 'map', below: 0.45, gold: 3 }, { kind: 'timeStop', name: '망각의 강', cooldown: 24, duration: 3 }],
        desc: '초월. 강을 건너는 이는 돌아오지 못한다.',
        art: astArt('ferry_reaper', { glow: '150,140,255' })
    },
    abyss_crown: {
        id: 'abyss_crown', name: '공허의 군주', role: 'area', family: 'demon', grade: 'transcendent',
        sprite: ASTERIA_ART.abyss_crown.sprite, cost: 2000, summon: false, gradeMerge: false,
        stats: { hp: 600, damage: 440, interval: 1.3, range: 6.5, splash: 2.8 },
        abilities: [{ kind: 'burnGround', name: '공허의 불', radius: 1.6, dps: 80, duration: 4 }], unlock: 'start',
        skills: [{ kind: 'nova', name: '공허 붕괴', cooldown: 14, radius: 'map', mul: 3, burn: 5 }, { kind: 'buff', name: '어둠의 왕관', cooldown: 20, duration: 10, damage: 0.4 }],
        desc: '초월. 왕관이 빛을 삼키면 맵 전체가 무너진다.',
        art: astArt('abyss_crown', { glow: '170,90,255', shot: 'bolt' })
    },
    void_eye: {
        id: 'void_eye', name: '공허의 눈', role: 'ranged', family: 'spirit', grade: 'transcendent',
        sprite: ASTERIA_ART.void_eye.sprite, cost: 2000, summon: false, gradeMerge: false,
        stats: { hp: 560, damage: 430, interval: 0.9, range: 7 },
        abilities: [{ kind: 'chain', count: 5, ratio: 0.5, jump: 3 }], unlock: 'start',
        skills: [{ kind: 'timeStop', name: '응시', cooldown: 20, duration: 4 }, { kind: 'barrage', name: '천 개의 눈', cooldown: 10, count: 20, mul: 1.2, reach: 'map' }],
        desc: '초월. 눈이 마주친 용사는 그 자리에 굳는다.',
        art: astArt('void_eye', { glow: '200,90,255', shot: 'bolt' })
    },
    rift_sovereign: {
        id: 'rift_sovereign', name: '차원 군주', role: 'ranged', family: 'spirit', grade: 'transcendent',
        sprite: ASTERIA_ART.rift_sovereign.sprite, cost: 2000, summon: false, gradeMerge: false,
        stats: { hp: 600, damage: 620, interval: 1.0, range: 7 },
        abilities: [{ kind: 'aura', stat: 'damage', radius: 6, value: 0.4 }], unlock: 'start',
        skills: [{ kind: 'push', name: '차원 균열', cooldown: 16, radius: 6, mul: 1.5, tiles: 3 }, { kind: 'buff', name: '별의 계약', cooldown: 20, duration: 10, damage: 0.5, speed: 0.3 }],
        desc: '초월. 둘레 몬스터의 힘을 끌어올리고 용사를 차원 밖으로 밀어낸다.',
        art: astArt('rift_sovereign', { glow: '200,120,255', shot: 'bolt' })
    }
};

// 몬스터별 공격 모양(ATTACK_KINDS). 종족과 역할에 맞춰 나눴다. look은 그림(ATTACK_LOOKS)
const MONSTER_ATTACKS = {
    // 일반
    orc_guard: { kind: 'sweep', look: 'steel' },
    skeleton_archer: { kind: 'arrow' },
    dark_mage: { kind: 'orb' },
    goblin_spearman: { kind: 'thrust', look: 'spear' },
    zombie: { kind: 'slam', look: 'rot' },
    fire_imp: { kind: 'arrow' },
    gnoll_hunter: { kind: 'boomerang', look: 'axe' },
    wisp_acolyte: { kind: 'zap', look: 'wisp' },
    grave_keeper: { kind: 'spikes', look: 'grave' },
    goblin_thrower: { kind: 'trap', look: 'bomb', radius: 0.45, ratio: 0.8 },
    hellhound_warrior: { kind: 'claw', look: 'hellfire' },
    boar_warrior: { kind: 'slam', look: 'dirt' },
    rock_spirit: { kind: 'drop', look: 'rock', radius: 0.6, ratio: 1.1 },
    spider_archer: { kind: 'puddle', look: 'web', armorMul: 1, slow: 0.65 },
    wind_sylph: { kind: 'pierce', look: 'wind', speed: 1000 },
    // 희귀
    orc_berserker: { kind: 'claw', look: 'cross' },
    curse_shooter: { kind: 'arrow' },
    werewolf: { kind: 'claw', look: 'beast' },
    troll: { kind: 'slam', look: 'club' },
    frost_witch: { kind: 'drop', look: 'ice' },
    nightmare_jester: { kind: 'boomerang', look: 'jester' },
    orc_shaman: { kind: 'zap', look: 'totem' },
    wraith_swordsman: { kind: 'thrust', look: 'ghost' },
    plague_ghoul: { kind: 'puddle', look: 'toxic' },
    succubus: { kind: 'volley', look: 'heart', speed: 800 },
    flame_archer: { kind: 'breath', look: 'fire' },
    bear_warrior: { kind: 'sweep', look: 'paw' },
    eagle_hunter: { kind: 'pierce', look: 'feather' },
    water_spirit: { kind: 'stream', look: 'water', push: 0.15, count: 2 },
    lightning_spirit: { kind: 'zap', look: 'storm' },
    // 영웅
    bone_knight: { kind: 'slam', look: 'bone' },
    minotaur: { kind: 'thrust', look: 'horn' },
    vampire: { kind: 'volley', look: 'bat', speed: 650 },
    flame_demon: { kind: 'drop', look: 'lava' },
    ancient_treant: { kind: 'spikes', look: 'root' },
    bone_priest: { kind: 'spikes', look: 'bone' },
    orc_charger: { kind: 'thrust', look: 'iron' },
    war_drummer: { kind: 'pierce', look: 'sound', speed: 800 },
    ogre_crusher: { kind: 'slam', look: 'stone' },
    executioner: { kind: 'sweep', look: 'doom' },
    chaos_mage: { kind: 'puddle', look: 'chaos' },
    saber_warrior: { kind: 'claw', look: 'saber' },
    hydra_warrior: { kind: 'breath', look: 'acid' },
    moon_priestess: { kind: 'drop', look: 'moonlight', radius: 0.45 },
    storm_archer: { kind: 'pierce', look: 'storm' },
    // 전설: 하나씩 다른 모양
    death_lord: { kind: 'spikes', look: 'deathlord' },
    hell_general: { kind: 'sweep', look: 'inferno' },
    archlich: { kind: 'zap', look: 'necro' },
    orc_high_chief: { kind: 'thrust', look: 'chief', width: 0.6 },
    giant_king: { kind: 'slam', look: 'giant' },
    fallen_angel: { kind: 'pierce', look: 'fallen' },
    earth_behemoth: { kind: 'fissure', look: 'earth' },
    phoenix_lord: { kind: 'trap', look: 'ember', ratio: 1.15 },
    element_sage: { kind: 'elements' },
    crystal_giant: { kind: 'shockwave', look: 'crystal' },
    // 신화: 하나씩 다른 모양
    star_whale: { kind: 'stream', look: 'star', puddle: true, push: 0.45, count: 6 },
    abyss_dragon_king: { kind: 'vortex', look: 'abyss' },
    time_witch: { kind: 'rewind', look: 'clock' },
    soul_devourer: { kind: 'tether', look: 'soul' },
    bone_dragon: { kind: 'breath', look: 'bonefire' },
    kraken: { kind: 'tentacle', look: 'kraken' },
    frost_queen: { kind: 'volley', look: 'frost', count: 5, ratio: 0.22 },
    frost_drake: { kind: 'drop', look: 'icicle', count: 3, ratio: 0.95 },
    sun_god: { kind: 'beam', look: 'sun' },
    moon_god: { kind: 'boomerang', look: 'moon', ratio: 0.6 },
    death_god: { kind: 'whirl', look: 'scythe' },
    god_king: { kind: 'smite', look: 'thunder' },
    gem_mimic: { kind: 'claw' },
    mushroom_king: { kind: 'puddle' },
    slime_monarch: { kind: 'puddle' },
    ghost_captain: { kind: 'volley' },
    frost_mammoth: { kind: 'slam' },
    magma_tortoise: { kind: 'fissure' },
    ferry_reaper: { kind: 'whirl', look: 'scythe' },
    abyss_crown: { kind: 'vortex', look: 'abyss' },
    void_eye: { kind: 'beam' },
    rift_sovereign: { kind: 'zap' }
};
// 공격 값: 기본값(ATTACK_KINDS) 위에 몬스터 값을 덮는다. 표에 없는 몬스터는 역할로 정한다(근접 claw, 광역 orb, 그 밖 arrow)
const attackCache = {};
function monsterAttack(type) {
    if (attackCache[type]) return attackCache[type];
    const def = MONSTERS[type];
    const own = MONSTER_ATTACKS[type] || { kind: MONSTER_ROLES[def.role].melee ? 'claw' : (def.stats.splash ? 'orb' : 'arrow') };
    const base = Object.assign({}, ATTACK_KINDS[own.kind]);
    delete base.name;
    delete base.desc;
    return (attackCache[type] = Object.assign(base, own));
}

// 조합식: 두 재료(a, b)를 합치면 result가 나온다. 순서는 상관없다. 등급 합치기보다 먼저 적용한다.
// aRank, bRank는 재료별 최소 랭크(MONSTER_RANKS의 name, 없으면 조건 없음). 조건이 안 맞으면 그 조합식이 없는 것처럼 판단한다.
// hidden이면 미리 보여 주지 않고, 처음 만들면 "히든 조합 발견!" 연출을 한다. 만든 조합식은 영구 기록(Meta, 도감)에 남는다
const MONSTER_RECIPES = [
    { a: 'skeleton_archer', b: 'dark_mage', result: 'curse_shooter', hidden: false },
    { a: 'orc_guard', b: 'dark_mage', result: 'orc_berserker', hidden: false },
    { a: 'orc_berserker', b: 'curse_shooter', result: 'bone_knight', hidden: false },
    { a: 'orc_berserker', b: 'skeleton_archer', result: 'bone_knight', hidden: true },
    { a: 'bone_knight', aRank: 'A', b: 'curse_shooter', bRank: 'A', result: 'death_lord', hidden: true },
    // 몬스터 확장 16종
    { a: 'goblin_spearman', b: 'fire_imp', result: 'werewolf', hidden: false },
    { a: 'zombie', b: 'wisp_acolyte', result: 'troll', hidden: false },
    { a: 'gnoll_hunter', b: 'wisp_acolyte', result: 'frost_witch', hidden: false },
    { a: 'fire_imp', b: 'dark_mage', result: 'nightmare_jester', hidden: false },
    { a: 'goblin_spearman', b: 'dark_mage', result: 'orc_shaman', hidden: false },
    { a: 'werewolf', b: 'troll', result: 'minotaur', hidden: false },
    { a: 'frost_witch', b: 'nightmare_jester', result: 'flame_demon', hidden: false },
    { a: 'orc_shaman', b: 'troll', result: 'ancient_treant', hidden: false },
    { a: 'curse_shooter', b: 'nightmare_jester', result: 'vampire', hidden: true },
    { a: 'flame_demon', aRank: 'A', b: 'minotaur', bRank: 'A', result: 'hell_general', hidden: true },
    { a: 'vampire', aRank: 'A', b: 'bone_knight', bRank: 'A', result: 'archlich', hidden: true },
    // 55종 확장
    { a: 'grave_keeper', b: 'skeleton_archer', result: 'wraith_swordsman', hidden: false },
    { a: 'goblin_thrower', b: 'orc_guard', result: 'orc_berserker', hidden: false },
    { a: 'hellhound_warrior', b: 'fire_imp', result: 'flame_archer', hidden: false },
    { a: 'boar_warrior', b: 'spider_archer', result: 'bear_warrior', hidden: false },
    { a: 'rock_spirit', b: 'wind_sylph', result: 'water_spirit', hidden: false },
    { a: 'orc_shaman', b: 'orc_berserker', result: 'war_drummer', hidden: false },
    { a: 'succubus', b: 'plague_ghoul', result: 'chaos_mage', hidden: false },
    { a: 'bear_warrior', b: 'eagle_hunter', result: 'saber_warrior', hidden: false },
    { a: 'water_spirit', b: 'lightning_spirit', result: 'moon_priestess', hidden: false },
    { a: 'ogre_crusher', aRank: 'A', b: 'war_drummer', bRank: 'A', result: 'orc_high_chief', hidden: true },
    { a: 'orc_charger', aRank: 'A', b: 'ogre_crusher', bRank: 'A', result: 'giant_king', hidden: true },
    { a: 'executioner', aRank: 'A', b: 'chaos_mage', bRank: 'A', result: 'fallen_angel', hidden: true },
    { a: 'saber_warrior', aRank: 'A', b: 'minotaur', bRank: 'A', result: 'earth_behemoth', hidden: true },
    { a: 'hydra_warrior', aRank: 'A', b: 'flame_demon', bRank: 'A', result: 'phoenix_lord', hidden: true },
    { a: 'moon_priestess', aRank: 'A', b: 'storm_archer', bRank: 'A', result: 'element_sage', hidden: true },
    { a: 'ancient_treant', aRank: 'A', b: 'storm_archer', bRank: 'A', result: 'crystal_giant', hidden: true },
    // 히든 신화: S랭크 전설(a) + 영웅(b) + 일반 2마리(parts). 끌어 합치지 않고 전설의 정보 창 버튼으로 합친다(Game.fullRecipePlan)
    { a: 'phoenix_lord', aRank: 'S', b: 'flame_demon', parts: [{ type: 'fire_imp', count: 2 }], result: 'sun_god', hidden: true },
    { a: 'element_sage', aRank: 'S', b: 'moon_priestess', parts: [{ type: 'wisp_acolyte', count: 2 }], result: 'moon_god', hidden: true },
    { a: 'death_lord', aRank: 'S', b: 'vampire', parts: [{ type: 'grave_keeper', count: 2 }], result: 'death_god', hidden: true },
    { a: 'giant_king', aRank: 'S', b: 'war_drummer', parts: [{ type: 'orc_guard', count: 2 }], result: 'god_king', hidden: true },
    // 조합 제단 히든 14개 더(2026-11-10). 재료 3~5마리, 순서는 상관없다
    // 히든 전용
    { a: 'werewolf', b: 'goblin_spearman', parts: [{ type: 'gnoll_hunter', count: 1 }], result: 'gem_mimic', hidden: true },
    { a: 'ancient_treant', b: 'wisp_acolyte', parts: [{ type: 'zombie', count: 1 }], result: 'mushroom_king', hidden: true },
    { a: 'plague_ghoul', b: 'zombie', parts: [{ type: 'zombie', count: 1 }], result: 'slime_monarch', hidden: true },
    { a: 'vampire', aRank: 'A', b: 'wraith_swordsman', parts: [{ type: 'curse_shooter', count: 1 }, { type: 'grave_keeper', count: 1 }], result: 'ghost_captain', hidden: true },
    { a: 'bear_warrior', aRank: 'A', b: 'frost_witch', parts: [{ type: 'saber_warrior', count: 1 }], result: 'frost_mammoth', hidden: true },
    { a: 'flame_demon', aRank: 'A', b: 'troll', parts: [{ type: 'rock_spirit', count: 1 }], result: 'magma_tortoise', hidden: true },
    // 다른 길로 만드는 전설·신화
    { a: 'kraken', b: 'water_spirit', parts: [{ type: 'storm_archer', count: 1 }], result: 'star_whale', hidden: true },
    { a: 'frost_witch', aRank: 'A', b: 'moon_priestess', bRank: 'A', parts: [{ type: 'ancient_treant', count: 1 }], result: 'frost_queen', hidden: true },
    { a: 'flame_archer', b: 'eagle_hunter', parts: [{ type: 'fire_imp', count: 2 }], result: 'phoenix_lord', hidden: true },
    { a: 'orc_berserker', b: 'war_drummer', parts: [{ type: 'orc_berserker', count: 1 }, { type: 'goblin_spearman', count: 1 }], result: 'orc_high_chief', hidden: true },
    // 초월: 히든 신화(S 이상)와 높은 등급 재료
    { a: 'death_god', aRank: 'S', b: 'soul_devourer', parts: [{ type: 'ghost_captain', count: 1 }], result: 'ferry_reaper', hidden: true },
    { a: 'sun_god', aRank: 'S', b: 'fallen_angel', bRank: 'S', parts: [{ type: 'hell_general', count: 1 }, { type: 'chaos_mage', count: 1 }], result: 'abyss_crown', hidden: true },
    { a: 'moon_god', aRank: 'S', b: 'time_witch', parts: [{ type: 'abyss_dragon_king', count: 1 }], result: 'void_eye', hidden: true },
    { a: 'god_king', aRank: 'S', b: 'giant_king', bRank: 'S', parts: [{ type: 'element_sage', count: 1 }, { type: 'crystal_giant', count: 1 }, { type: 'war_drummer', count: 1 }], result: 'rift_sovereign', hidden: true }
];

// 조합식 하나의 기록 열쇠: 재료(랭크 조건 포함)를 정렬해 잇는다. 예: 'bone_knight:A+curse_shooter:A'
function recipeKey(r) {
    const parts = (r.parts || []).map(p => `${p.type}*${p.count}`);
    return [r.a + (r.aRank ? `:${r.aRank}` : ''), r.b + (r.bRank ? `:${r.bRank}` : ''), ...parts].sort().join('+');
}

// 등급별 소환 후보(소환, 보스 보상). 등급 표의 summon과 몬스터의 summon이 false가 아닌 것. 표 순서를 따른다
// 소환 강화 레벨로 소환될 때의 후보. 전설은 summon: false여도 나온다(소환 강화 높은 단계)
function summonPool(grade) {
    // 히든 전용(gradeMerge: false)은 어느 등급이든 소환되지 않는다(조합 제단으로만)
    return Object.keys(MONSTERS).filter(id => MONSTERS[id].grade === grade && MONSTERS[id].gradeMerge !== false && (grade === 'legendary' || MONSTERS[id].summon !== false));
}

function gradePool(grade) {
    if (!MONSTER_GRADES[grade] || MONSTER_GRADES[grade].summon === false) return [];
    return Object.keys(MONSTERS).filter(id => MONSTERS[id].grade === grade && MONSTERS[id].summon !== false);
}

// 등급별 등급 합치기 결과 후보. 소환에 나오지 않는 전설과 신화도 들어간다(gradeMerge: false만 뺀다). 표 순서를 따른다
function mergePool(grade) {
    return Object.keys(MONSTERS).filter(id => MONSTERS[id].grade === grade && MONSTERS[id].gradeMerge !== false);
}

// 랭크 이름('A')의 MONSTER_RANKS 번호
function rankIndex(name) { return MONSTER_RANKS.findIndex(r => r.name === name); }

// 합치기 재료: 몬스터 id 문자열(랭크 D로 본다) 또는 맵의 몬스터 개체 { type, rank }
function mergeInput(x) {
    return typeof x === 'string' ? { type: x, rank: 0 } : { type: x.type, rank: x.rank || 0 };
}

// 재료 하나가 조합식 한쪽(type, 최소 랭크 need)에 맞는지
function recipeSideOk(input, type, need) {
    return input.type === type && (!need || input.rank >= rankIndex(need));
}

// a, b: 재료(mergeInput). 순서를 바꿔도 재료별 랭크 조건으로 판단한다
function findRecipe(a, b) {
    const A = mergeInput(a);
    const B = mergeInput(b);
    return MONSTER_RECIPES.find(r => !r.parts && (!r.hidden || ALTAR_RULES.dragHidden) && ( // 히든 조합식은 조합 제단(altarRecipe)으로만
        (recipeSideOk(A, r.a, r.aRank) && recipeSideOk(B, r.b, r.bRank)) ||
        (recipeSideOk(B, r.a, r.aRank) && recipeSideOk(A, r.b, r.bRank)))) || null;
}

// 조합 제단(2026-11-10): 히든 조합식은 끌어 합치기가 아니라 제단에 재료를 올려 만든다.
// 조합식의 재료 목록 [{ type, rank }](a, b와 parts를 펼친다). rank는 최소 랭크 번호(조건 없으면 0)
function recipeMaterials(r) {
    const out = [{ type: r.a, rank: r.aRank ? rankIndex(r.aRank) : 0 }, { type: r.b, rank: r.bRank ? rankIndex(r.bRank) : 0 }];
    for (const p of r.parts || []) for (let i = 0; i < p.count; i++) out.push({ type: p.type, rank: 0 });
    return out;
}
// 재료(inputs: { type, rank }들)를 조합식 재료에 하나씩 짝지을 수 있으면 짝(조합식 재료 순서의 inputs 번호), 없으면 null
function matchMaterials(inputs, need) {
    if (inputs.length !== need.length) return null;
    const used = new Array(inputs.length).fill(false);
    const pick = [];
    const go = i => {
        if (i === need.length) return true;
        for (let j = 0; j < inputs.length; j++) {
            if (used[j] || inputs[j].type !== need[i].type || (inputs[j].rank || 0) < need[i].rank) continue;
            used[j] = true;
            pick[i] = j;
            if (go(i + 1)) return true;
            used[j] = false;
        }
        return false;
    };
    return go(0) ? pick.slice() : null;
}
// 제단에 올린 재료로 만들 수 있는 히든 조합식과 짝. 없으면 null
function altarRecipe(inputs) {
    const list = inputs.map(mergeInput);
    for (const r of MONSTER_RECIPES) {
        if (!r.hidden) continue;
        const pick = matchMaterials(list, recipeMaterials(r));
        if (pick) return { recipe: r, pick };
    }
    return null;
}
// 틀렸을 때 힌트: 히든 조합식 중 올린 재료와 종류가 가장 많이 겹치는 수(랭크는 보지 않는다)와 그 조합식의 재료 수
function altarHint(inputs) {
    let best = { match: 0, need: 0 };
    for (const r of MONSTER_RECIPES) {
        if (!r.hidden) continue;
        const need = recipeMaterials(r).map(x => x.type);
        let match = 0;
        for (const x of inputs) {
            const i = need.indexOf(x.type);
            if (i >= 0) { match++; need.splice(i, 1); }
        }
        if (match > best.match) best = { match, need: recipeMaterials(r).length };
    }
    return best;
}

// 등급 합치기 결과 등급. 다음 등급에 합치기 후보가 없으면(최고 등급) null
function nextGrade(grade) {
    const next = GRADE_ORDER[GRADE_ORDER.indexOf(grade) + 1];
    return next && mergePool(next).length ? next : null;
}

// 두 몬스터를 합칠 수 있는지와 결과(무작위 없이). 위에서부터 먼저 적용한다
//   a, b: 몬스터 개체 { type, rank } 또는 id 문자열(랭크 D). 랭크 조건이 있는 조합식은 개체를 넘겨야 맞을 수 있다
//   { kind: 'recipe', recipe, result } 조합식(재료 2마리)
//   { kind: 'grade', grade, count } 등급 합치기(같은 등급 count마리, 결과는 grade 등급 무작위). 나머지 재료는 맵 상태가 필요해 Game.mergePlanFor가 고른다
//   { kind: 'none', reason: 'top' | 'mismatch' } 합칠 수 없음. top은 최고 등급끼리
//   gradeOnly면 조합식을 보지 않는다(팝업의 합치기 버튼)
function mergePlan(a, b, gradeOnly) {
    const recipe = gradeOnly ? null : findRecipe(a, b);
    if (recipe) return { kind: 'recipe', recipe, result: recipe.result };
    const ga = MONSTERS[mergeInput(a).type].grade;
    if (ga === MONSTERS[mergeInput(b).type].grade) {
        const grade = nextGrade(ga);
        return grade ? { kind: 'grade', grade, count: MERGE_RULES.gradeCount } : { kind: 'none', reason: 'top' };
    }
    return { kind: 'none', reason: 'mismatch' };
}

// 몬스터 하나로 만들 수 있는 공개 조합식(팝업과 끌기 표시용). 히든 조합식은 넣지 않는다
// selfRank, partnerRank는 조합식의 최소 랭크 조건(없으면 null)
function publicRecipesFor(type) {
    return MONSTER_RECIPES.filter(r => !r.hidden && (r.a === type || r.b === type))
        .map(r => r.a === type
            ? { partner: r.b, result: r.result, selfRank: r.aRank || null, partnerRank: r.bRank || null }
            : { partner: r.a, result: r.result, selfRank: r.bRank || null, partnerRank: r.aRank || null });
}

// 몬스터의 kind 능력(없으면 null)
function monsterAbility(type, kind) {
    return MONSTERS[type].abilities.find(a => a.kind === kind) || null;
}

// 제물 효과: m은 { type, rank } 개체 또는 id 문자열(랭크 D). { heal, lightning }(최대치 제한 전 값)
// extra는 마왕과 유물의 제물 효과 배율(없으면 1). 판 중에는 Game.sacrificeGain이 넘긴다
function sacrificeGain(m, extra) {
    const input = mergeInput(m);
    const base = SACRIFICE_RULES[MONSTERS[input.type].grade];
    const mul = MONSTER_RANKS[input.rank].mul * (extra === undefined ? 1 : extra);
    return { heal: Math.floor(base.heal * mul + 1e-9), lightning: base.lightning * mul };
}

// "체력 +2, 번개 -5초". 6.25초처럼 소수도 그대로 적는다
function sacrificeText(gain) {
    return `체력 +${gain.heal}, 번개 -${Math.round(gain.lightning * 100) / 100}초`;
}

// 등급별 장비 후보. 표 순서를 따른다
function equipPool(grade) {
    return Object.keys(EQUIPMENT).filter(id => EQUIPMENT[id].grade === grade);
}

// 장비 효과 하나(없으면 0)
function equipEffect(id, key) {
    return (id && EQUIPMENT[id].effects[key]) || 0;
}

// "피해 +20%, 사거리 +15%". EQUIP_EFFECTS 순서로 적는다
function equipEffectText(id) {
    const e = EQUIPMENT[id].effects;
    const list = Object.keys(EQUIP_EFFECTS).filter(k => e[k]).map(k => `${EQUIP_EFFECTS[k]} +${Math.round(e[k] * 100)}%`);
    if (EQUIPMENT[id].note) list.push(EQUIPMENT[id].note);
    return list.join(', ');
}

// 등급이 높은 쪽 장비. 같으면 a(합치기에서는 먼저 끌어온 쪽). 둘 다 없으면 null
function betterEquip(a, b) {
    if (!a || !b) return a || b || null;
    return GRADE_ORDER.indexOf(EQUIPMENT[b].grade) > GRADE_ORDER.indexOf(EQUIPMENT[a].grade) ? b : a;
}

// 여러 장비 중 가장 좋은 것(같으면 앞쪽). 없으면 null
function bestEquip(list) {
    return list.reduce((best, id) => betterEquip(best, id), null);
}

// '#ff2d55' → '255,45,85'(rgba에 넣는 꼴)
function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// 등급 표의 값 하나(없으면 기본값)
function gradeInfo(grade, key, fallback) {
    const g = MONSTER_GRADES[grade];
    return g && g[key] !== undefined ? g[key] : fallback;
}

function monsterBlocks(type) { return MONSTER_ROLES[MONSTERS[type].role].blocks; }

// 2단계 비용은 배치 비용의 80%, 3단계는 150%
function upgradeCost(type, nextTier) {
    return Math.round(MONSTERS[type].cost * (nextTier === 2 ? 0.8 : 1.5));
}

// 몸 둘레를 도는 종족 오브젝트 그림(전설부터). d 어두운, m 중간, l 밝은, w 흰빛, a 강조색. 테두리는 그릴 때 자동으로 두른다
const ORBITER_ART = {
    demon: ['....l....', '...lm....', '...mml...', '..mmwm...', '..mwwmd..', '.dmwwmd..', '.dmmmmd..', '..dmmd...', '...dd....'],
    undead: ['...ll....', '..lwwl...', '.lwwwml..', '.mwwmmd..', '.mmmmdd..', '..mmdd...', '...dd....', '....d....', '.....d...'],
    spirit: ['....w....', '...lwl...', '...lwm...', '..lwmmd..', '..lwmmd..', '..lmmdd..', '...mdd...', '...md....', '....d....'],
    beast: ['.......l.', '.....llm.', '....lwmd.', '...lwmd..', '..lmmd...', '.lmmd....', '.mdd.....', '.d.......', 'd........'],
    orc: ['...dmm...', '..dmllm..', '.dmlwlmd.', '.dmllmmd.', '.ddmmmdd.', '..ddadd..', '...ddd...']
};
// 날개나 몸으로 떠 있는 몬스터: 대기 때 크게 떠오른다
const FLYING_MONSTERS = new Set(['phoenix_lord', 'bone_dragon', 'frost_drake', 'abyss_dragon_king', 'storm_archer', 'fallen_angel', 'wisp_acolyte', 'wind_sylph', 'lightning_spirit', 'star_whale', 'soul_devourer', 'time_witch', 'water_spirit', 'eagle_hunter', 'sun_god', 'moon_god']);

// <palettes> tools/monster_palettes.py가 만든 표: 몬스터 그림에서 뽑은 [어두운, 중간, 밝은, 강조] 색(주변 효과에 쓴다)
const MONSTER_PALETTES = {"orc_guard":["#4b291f","#6d432a","#814d2d","#caca67"],"skeleton_archer":["#683c3a","#825646","#b6896c","#654668"],"dark_mage":["#704c45","#804c42","#b07974","#ddacfc"],"orc_berserker":["#644d48","#83472d","#b87543","#7a1012"],"curse_shooter":["#4a2d11","#741a14","#ab2a14","#fdedbd"],"bone_knight":["#29073e","#4c096a","#d70ee8","#ff63ff"],"death_lord":["#330b3a","#451748","#5d4176","#ffcb9b"],"goblin_spearman":["#502b22","#72422b","#957a61","#dbc8a1"],"zombie":["#433122","#654226","#ac391b","#f9e40a"],"fire_imp":["#941c03","#ce3102","#f85b00","#ffa307"],"gnoll_hunter":["#653327","#823833","#a17c62","#e3c89d"],"wisp_acolyte":["#3d9ceb","#a5ddf9","#93d0fc","#b5d8fc"],"werewolf":["#292635","#292635","#292635","#d9a275"],"troll":["#384917","#415316","#677d1c","#a6825f"],"frost_witch":["#3c4158","#033392","#8da4d3","#17c4ff"],"nightmare_jester":["#311446","#592a75","#9a5cb2","#758eab"],"orc_shaman":["#6e4339","#875b39","#a0856c","#f4dfa3"],"minotaur":["#877159","#987f5f","#b1a083","#f4ccb4"],"vampire":["#40040a","#5b0518","#8f101d","#ed5743"],"flame_demon":["#4c211c","#731804","#e16133","#ffc804"],"ancient_treant":["#46281b","#663e28","#a16a39","#fff482"],"hell_general":["#a40200","#f22901","#fc7104","#ffdc25"],"archlich":["#372d3f","#3b066a","#a74df4","#9b38ff"],"grave_keeper":["#2e243d","#3c2e4d","#69597b","#dcbb7b"],"wraith_swordsman":["#2a2e3d","#252c52","#595b7b","#bd95eb"],"plague_ghoul":["#362955","#6e6199","#713bbc","#d9abf9"],"bone_priest":["#4f541b","#749b36","#a2c944","#ffefbb"],"goblin_thrower":["#512e2b","#63392d","#98663f","#dfc98d"],"orc_charger":["#552c1b","#885239","#f43402","#fefca6"],"war_drummer":["#5a4a28","#9f9441","#c4af8e","#be7a3d"],"ogre_crusher":["#502e24","#772823","#9e683f","#a06e75"],"orc_high_chief":["#48261b","#733601","#bb7132","#ffde70"],"giant_king":["#44251e","#603d31","#974524","#ffca2d"],"hellhound_warrior":["#702d2a","#c11102","#f66600","#ffcc14"],"succubus":["#502a4e","#621948","#ed59dc","#f075af"],"flame_archer":["#821715","#b41c04","#f36d01","#ad2a2c"],"executioner":["#331451","#7f4b9d","#d44bfb","#7a27ce"],"chaos_mage":["#271a3e","#3c2262","#5919aa","#e88cff"],"fallen_angel":["#704b1e","#baac72","#f9c162","#f7d3b8"],"boar_warrior":["#993110","#d15414","#f57319","#f2d4b5"],"spider_archer":["#025fa9","#089cca","#5de0e8","#0659b5"],"bear_warrior":["#425374","#4a71ad","#99b9e4","#c4a48b"],"eagle_hunter":["#a44561","#e16d73","#fa8588","#ffaaa3"],"saber_warrior":["#bb7a21","#dd9c35","#f8ca63","#e9cbad"],"hydra_warrior":["#4a480b","#726c1c","#c19a55","#ffff53"],"earth_behemoth":["#730120","#b90630","#fb1225","#94a329"],"phoenix_lord":["#b11002","#e93200","#fd6501","#ff9704"],"rock_spirit":["#4b3221","#72533b","#936c4b","#9da12a"],"wind_sylph":["#031b4d","#07236c","#8abcfb","#bee8ff"],"water_spirit":["#003d6e","#1797c8","#a4d9fa","#b3fefd"],"lightning_spirit":["#110349","#160a6d","#3627db","#bbbcff"],"moon_priestess":["#212543","#24356b","#a0b3e6","#7d7ba5"],"storm_archer":["#2b446f","#87a7cf","#b3d4fc","#73bbff"],"element_sage":["#7d470d","#cf9f65","#fce0bc","#ffba9e"],"crystal_giant":["#3e4fc8","#7887fa","#7eb2ff","#5348ff"],"abyss_dragon_king":["#03344f","#0a6571","#7dc4ea","#b2fff1"],"time_witch":["#453317","#6b552c","#a87e41","#927d6b"],"soul_devourer":["#301d40","#48335a","#692498","#d4ff61"],"bone_dragon":["#5a4c39","#867253","#cab48a","#86ff8a"],"kraken":["#26235f","#5e4883","#5953ac","#b2f6ff"],"frost_queen":["#172a55","#2a4f8f","#66a0e2","#66c0ff"],"star_whale":["#0d134a","#132673","#344fd3","#967eff"],"frost_drake":["#3c7bb3","#a0cce3","#75dbff","#85b5e9"],"sun_god":["#69130a","#ad2803","#fd7709","#fff9b8"],"moon_god":["#263975","#6f84c3","#a6b5e8","#8583b2"],"death_god":["#362554","#6a578b","#805da9","#dbacff"],"god_king":["#d99e4e","#fbf1a1","#ffda4b","#ff8f2b"],"gem_mimic":["#aa5e08","#d8910a","#fac145","#ffaca4"],"mushroom_king":["#6f3f2d","#a97952","#ee4229","#ffd440"],"slime_monarch":["#90a13a","#8abc1d","#b2de34","#68b41e"],"ghost_captain":["#037a71","#0fa6a0","#54e2d5","#34e5f8"],"frost_mammoth":["#213159","#4e699a","#3086dd","#b4e4ff"],"magma_tortoise":["#6a1d19","#a1462e","#f77e0f","#ffeb90"],"ferry_reaper":["#2c1d4c","#3d2d78","#9a78e7","#6db4ff"],"abyss_crown":["#1a0e40","#2c0f6c","#6127d7","#dcb2ff"],"void_eye":["#18014a","#210264","#4a0cab","#9324f8"],"rift_sovereign":["#221747","#2f2870","#3e2cad","#ff33ff"]};
// </palettes>
