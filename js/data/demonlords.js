// 마왕과 유물. 판을 시작하기 전에 마왕 1명과 유물(유물 칸 수 Meta.relicSlots()개까지)을 고른다. 판 중에는 유물을 얻지 않는다.
// 마왕, 유물, 유물 칸은 메인 스토리 스테이지를 처음 깰 때 풀린다(js/data/story.js의 STAGES[].unlocks, 계산은 js/game/meta.js)
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
    meleeDamage: { name: '근접 몬스터 피해', mode: 'ratio' },
    meleeRange: { name: '근접 몬스터 사거리', mode: 'add', unit: '칸' },
    respawn: { name: '부활 시간', mode: 'mul', low: true }, // 막는 몬스터가 쓰러졌다 다시 나오는 시간
    eliteDrop: { name: '정예 장비 드롭', mode: 'ratio' }, // EQUIP_RULES.eliteDrop에 더한다
    refund: { name: '판매 환불', mode: 'mul' },
    sacrifice: { name: '제물 효과', mode: 'mul' }, // 체력 회복과 번개 감소에 곱한다(체력은 내림)
    // 유물 전용. 상한과 기준 수는 RELIC_LIMITS
    goldDamage: { name: '보유 골드 100G당 몬스터 피해', mode: 'ratio', note: '최대 30%' },
    interest: { name: '라운드 종료 이자', mode: 'ratio', note: '최대 15G' },
    mergeJump: { name: '합치기 2단계 상승 확률', mode: 'ratio' },
    monsterArmor: { name: '몬스터 받는 피해 감소', mode: 'ratio' },
    altarDamage: { name: '제물당 몬스터 피해', mode: 'ratio', note: '최대 15%' },
    earlyAttackSpeed: { name: '일찍 부른 라운드 공격 속도', mode: 'ratio' },
    lightningCooldown: { name: '번개 재사용', mode: 'mul', low: true },
    roarAnytime: { name: '호통', mode: 'add', text: () => '체력 조건 없이 호통' },
    equipUp: { name: '돌아오는 장비 등급 상승 확률', mode: 'ratio' },
    equipPower: { name: '장비 효과', mode: 'ratio' },
    twinSummon: { name: '소환 1마리 더 나올 확률', mode: 'ratio' },
    fewDamage: { name: '몬스터 6마리 이하일 때 피해', mode: 'ratio' },
    commonDamage: { name: '일반 몬스터 피해', mode: 'ratio' },
    fullHpDamage: { name: '체력이 가득할 때 피해', mode: 'ratio' },
    hpSummon: { name: '골드가 모자라면 체력 1로 소환', mode: 'add', unit: '회', text: v => `골드 부족 시 체력 1로 소환(판당 ${v}회)` },
    mergedSlow: { name: '합류 뒤 용사 이동 속도', mode: 'mul', low: true },
    // 유물 2판(47종). 효과 설명은 유물의 desc가 화면에 나오고, 이 이름은 "이번 판 효과" 요약에 쓴다
    critChance: { name: '치명타 확률', mode: 'ratio' },
    critDamage: { name: '치명타 피해', mode: 'ratio' },
    pierce: { name: '원거리 관통', mode: 'add', unit: '명' },
    meleeSpeed: { name: '근접 몬스터 공격 속도', mode: 'ratio' },
    farDamage: { name: '먼 적 추가 피해', mode: 'ratio', note: '최대' },
    doubleHit: { name: '한 번 더 공격할 확률', mode: 'ratio' },
    earlyGold: { name: '라운드 스킵 골드', mode: 'add', unit: 'G' },
    undeadOdds: { name: '언데드 등장 확률', mode: 'ratio' },
    orcOdds: { name: '오크 등장 확률', mode: 'ratio' },
    demonOdds: { name: '악마 등장 확률', mode: 'ratio' },
    beastOdds: { name: '야수 등장 확률', mode: 'ratio' },
    spiritOdds: { name: '정령 등장 확률', mode: 'ratio' },
    undeadCrit: { name: '언데드 치명타 확률', mode: 'ratio' },
    orcSpeed: { name: '오크 공격 속도', mode: 'ratio' },
    demonBurn: { name: '악마 공격 화상(초당 공격력)', mode: 'ratio' },
    beastFrenzy: { name: '야수 처치 후 공격 속도', mode: 'ratio' },
    spiritSplash: { name: '정령 공격 튀김', mode: 'ratio' },
    statusDamage: { name: '상태 이상 적이 받는 피해', mode: 'ratio' },
    freezeChance: { name: '빙결 확률', mode: 'ratio' },
    bigDamage: { name: '큰 몬스터 피해', mode: 'ratio' },
    smallSpeed: { name: '1칸 몬스터 공격 속도', mode: 'ratio' },
    killBlast: { name: '처치 폭발 확률', mode: 'ratio' },
    eliteCrit: { name: '정예·보스 치명타 확률', mode: 'ratio' },
    perMonsterDamage: { name: '몬스터 한 마리당 피해', mode: 'ratio', note: '최대 45%' },
    manaGain: { name: '마력 획득', mode: 'ratio' },
    bossTime: { name: '보스 라운드 시간', mode: 'add', unit: '초' },
    seventhStar: { name: '7번째 소환 영웅 이상', mode: 'add', text: () => '7번째 소환마다 영웅 이상' },
    pureDamage: { name: '한 종족일 때 피해', mode: 'ratio' },
    allFamilies: { name: '5종족이 모두 있을 때 피해', mode: 'ratio' },
    gamble: { name: '소환 비용 도박', mode: 'add', text: () => '소환 비용 15% 0, 10% 2배' },
    freshSpeed: { name: '새 몬스터 10초 공격 속도', mode: 'ratio' },
    mythicGold: { name: '신화 합성 골드', mode: 'add', unit: 'G' },
    equipSlots: { name: '장비 칸', mode: 'add', unit: '칸', text: () => '장비 2개 장착' },
    slaughterBell: { name: '학살의 종', mode: 'add', text: () => '처치 게이지 1000에 전체 피해' },
    soulScythe: { name: '영혼 수확 낫', mode: 'add', text: () => '정예 영혼 5개에 공격 속도 +50%' },
    undying: { name: '부활', mode: 'add', text: () => '1회 부활해 라운드 다시' },
    maxHpHalf: { name: '최대 체력 절반', mode: 'add', low: true, text: () => '마왕 최대 체력 절반' },
    feast: { name: '합성마다 쌓이는 피해', mode: 'ratio' },
    critSplash: { name: '치명타 처치 주변 피해', mode: 'ratio' },
    // 규칙 카드 전용
    heroHp: { name: '용사 체력', mode: 'mul', low: true },
    // 금단의 계약 조항 전용(심연 난이도). 판 규칙을 바꾼다
    heroShield: { name: '방패 든 용사', mode: 'ratio', low: true, text: v => `일반 용사 ${Math.round(v * 100)}% 방패(첫 공격 무효)` },
    heroRevive: { name: '되살아나는 용사', mode: 'ratio', low: true, text: v => `일반 용사 ${Math.round(v * 100)}% 부활 1회(체력 절반)` },
    heroRegen: { name: '사제 동행', mode: 'ratio', low: true, text: v => `용사 체력 재생 초당 ${Math.round(v * 1000) / 10}%` },
    eliteSplit: { name: '분열하는 정예', mode: 'add', low: true, text: v => `정예 처치 시 용사 ${v}명 분열` },
    roundTime: { name: '라운드 시간', mode: 'mul', low: true, text: v => `라운드 간격 ${Math.round(COMBAT_RULES.roundTime * v)}초` },
    summonPerRound: { name: '라운드당 소환', mode: 'add', low: true, text: v => `라운드당 소환 ${v}회` },
    powerSeal: { name: '권능 봉인', mode: 'add', low: true, text: () => '마력 획득 불가' },
    bossEvery5: { name: '잦은 보스', mode: 'add', low: true, text: () => '5라운드마다 보스' },
    bossFury: { name: '격노한 보스', mode: 'add', low: true, text: () => '보스 패턴 2배' }
};

// 마왕 권능 지도: 왕좌를 가운데 둔 연결망. 큰 갈래 3개가 뻗고, 갈래마다 4겹에 2개씩 있다. 판 안에서 마력을 써서 찍는다.
// 한 판에 한 갈래만 찍는다(처음 찍은 갈래로 정해진다). 겹마다 2개 중 하나를 고르고, 왕좌나 찍은 곳과 이어진 항목만 찍을 수 있다.
// 항목의 자리와 연결은 시드로 정해 판마다 갈 수 있는 길이 다르다(같은 시드 도전은 모두 같은 지도).
// 그래서 한 판의 빌드는 갈래 하나와 겹마다 고른 4개다. 마력은 판이 끝나면 사라진다(오래 한 사람이 랭킹에서 유리해지지 않게).
// 수치는 플레이 후 고칠 초안이다.
const POWER_RULES = { maxNodes: 4, tierCost: [1, 2, 3, 5], manaElite: 1, manaBoss: 3, manaCleanRound: 1 };
const LORD_POWERS = {
    rift: [
        { id: 'storm', name: '폭풍', desc: '번개 강화', tiers: [
            [{ id: 'wide', name: '넓은 낙뢰', desc: '번개 범위 +0.5칸' }, { id: 'focus', name: '벼락 집중', desc: '번개 피해 +30%' }],
            [{ id: 'markLong', name: '깊은 낙인', desc: '감전 낙인 +3초' }, { id: 'static', name: '정전기', desc: '번개 맞은 용사 3초간 이동 -30%' }],
            [{ id: 'chain', name: '연쇄 낙뢰', desc: '주변 용사 3명에게 연쇄 번개' }, { id: 'echo', name: '메아리', desc: '1초 뒤 같은 자리에 번개 한 번 더(피해 50%)' }],
            [{ id: 'smite', name: '천벌', desc: '정예·보스에게 번개 피해 2배' }, { id: 'auto', name: '폭풍의 눈', desc: '번개 자동 시전(선두 용사)' }]
        ] },
        { id: 'portal', name: '균열', desc: '후퇴', tiers: [
            [{ id: 'tear', name: '찢긴 틈', desc: '번개 맞은 용사 1초 정지' }, { id: 'ward', name: '왕좌 결계', desc: '일반 용사의 왕좌 피해 -20%' }],
            [{ id: 'pull', name: '끌어당김', desc: '번개 맞은 용사 2칸 후퇴(보스 제외)' }, { id: 'turnback', name: '문전박대', desc: '왕좌 도달 일반 용사 5명마다 1명 입구로' }],
            [{ id: 'gate', name: '균열 열기', desc: '새 스킬(E): 선두 용사 8명 6칸 후퇴' }, { id: 'longTear', name: '긴 틈', desc: '번개 맞은 용사 2초 정지' }],
            [{ id: 'abyss', name: '심연의 손길', desc: '번개·균열 맞은 용사 5초간 받는 피해 +40%' }, { id: 'exile', name: '먼 추방', desc: '후퇴 거리 2배' }]
        ] },
        { id: 'overload', name: '과부하', desc: '스킬 회전', tiers: [
            [{ id: 'quick', name: '빠른 충전', desc: '번개 재사용 -15%' }, { id: 'roarDrill', name: '호통 단련', desc: '호통 재사용 -30%' }],
            [{ id: 'killCharge', name: '처치 충전', desc: '일반 용사 처치마다 번개 재사용 -0.1초' }, { id: 'sacCharge', name: '제물 충전', desc: '제물의 번개 충전 2배' }],
            [{ id: 'eliteCharge', name: '사냥 충전', desc: '정예 처치 시 번개 즉시 충전' }, { id: 'circuit', name: '마력 회로', desc: '무피해 라운드 마력 +1' }],
            [{ id: 'frenzy', name: '폭주', desc: '처치마다 번개 재사용 -0.3초, 호통 봉인' }, { id: 'rally', name: '맞불', desc: '호통 사용 시 번개 즉시 충전' }]
        ] }
    ],
    bone_queen: [
        { id: 'wraith', name: '망령', desc: '일제 사격 강화', tiers: [
            [{ id: 'volleyFast', name: '재촉', desc: '일제 사격 주기 20명' }, { id: 'volleyWide', name: '망령 무리', desc: '일제 사격 대상 +3명' }],
            [{ id: 'volleyHeavy', name: '무거운 혼', desc: '일제 사격 피해 +50%' }, { id: 'volleyCurse', name: '저주받은 화살', desc: '일제 사격 맞은 용사 3초간 받는 피해 +20%' }],
            [{ id: 'volleyBoss', name: '우두머리 사냥', desc: '정예·보스 우선 공격' }, { id: 'volleyCharge', name: '혼의 환류', desc: '일제 사격마다 스킬 재사용 -3초' }],
            [{ id: 'volleyTwin', name: '두 번째 사격', desc: '일제 사격 2회' }, { id: 'volleyFear', name: '공포', desc: '일제 사격 맞은 용사 1.5초 정지' }]
        ] },
        { id: 'corpse', name: '시체', desc: '시체 폭발', tiers: [
            [{ id: 'corpseBlast', name: '시체 폭발', desc: '일반 용사 5명 처치마다 시체 폭발' }, { id: 'xpUp', name: '죽음의 교훈', desc: '처치 경험치 +30%', mods: { xp: 0.3 } }],
            [{ id: 'corpseFrost', name: '썩은 안개', desc: '폭발에 맞은 용사 2초간 이동 -30%' }, { id: 'boneEdge', name: '뼈 칼날', desc: '몬스터 피해 +8%', mods: { damage: 0.08 } }],
            [{ id: 'raise', name: '시체 일으키기', desc: '새 스킬(E): 최근 시체 8구 동시 폭발' }, { id: 'corpseQuick', name: '썩은 살', desc: '시체 폭발 주기 3명' }],
            [{ id: 'raiseFast', name: '끝없는 무덤', desc: '시체 일으키기 재사용 -40%' }, { id: 'corpseBig', name: '큰 폭발', desc: '폭발 범위 2배' }]
        ] },
        { id: 'offering', name: '제물', desc: '제물 강화', tiers: [
            [{ id: 'sacBoost', name: '달콤한 제물', desc: '제물 효과 +50%', mods: { sacrifice: 1.5 } }, { id: 'sacSell', name: '뼈값', desc: '판매 환불 +30%', mods: { refund: 1.3 } }],
            [{ id: 'sacRage', name: '피의 환호', desc: '제물 시 몬스터 8초간 공격 속도 +25%' }, { id: 'altar', name: '쌓이는 제단', desc: '제물당 몬스터 피해 +2%(최대 15%)', mods: { altarDamage: 0.02 } }],
            [{ id: 'sacMana', name: '영혼 추출', desc: '제물 시 마력 +1' }, { id: 'sacGold', name: '헌금', desc: '제물 시 소환 비용 2배만큼 골드' }],
            [{ id: 'sacRoar', name: '여왕의 외침', desc: '제물 시 호통 즉시 충전' }, { id: 'sacSoul', name: '혼의 일제 사격', desc: '제물 시 일제 사격 발동' }]
        ] }
    ],
    gold_king: [
        { id: 'invest', name: '투자', desc: '골드 수입', tiers: [
            [{ id: 'interestUp', name: '복리 장부', desc: '라운드 종료 이자 +3%(최대 15G)', mods: { interest: 0.03 } }, { id: 'bountyUp', name: '현상금 수수료', desc: '처치 골드 +20%', mods: { bounty: 1.2 } }],
            [{ id: 'summonCheap', name: '대량 계약', desc: '소환 시작 비용 -5G', mods: { summonBase: -5 } }, { id: 'sellUp', name: '중고 거래', desc: '판매 환불 +30%', mods: { refund: 1.3 } }],
            [{ id: 'goldMana', name: '금화 연금술', desc: '라운드 종료 시 골드 500 이상이면 마력 +1' }, { id: 'goldEdge', name: '금칠한 칼', desc: '200G당 몬스터 피해 +1%(최대 15%)', mods: { goldDamage: 0.01 } }],
            [{ id: 'compound', name: '큰손', desc: '이자 상한 2배' }, { id: 'twin', name: '덤', desc: '소환 때 8% 확률로 1마리 더', mods: { twinSummon: 0.08 } }]
        ] },
        { id: 'bribe', name: '매수', desc: '골드 방어', tiers: [
            [{ id: 'goldWard', name: '왕좌 보험', desc: '일반 용사의 왕좌 피해 -20%' }, { id: 'dropUp', name: '장물아비', desc: '정예 장비 드롭 +10%', mods: { eliteDrop: 0.1 } }],
            [{ id: 'heroSlow', name: '통행세', desc: '새로 오는 용사 이동 -7%', mods: { heroSpeed: 0.93 } }, { id: 'longRoar', name: '긴 협상', desc: '호통 정지 +1초' }],
            [{ id: 'bribeRoar', name: '입막음', desc: '호통을 300G로 사용(체력 조건 없음, 대기 5초)' }, { id: 'contract', name: '상시 계약', desc: '체력 조건 없이 호통', mods: { roarAnytime: 1 } }],
            [{ id: 'bribeCheap', name: '단골', desc: '입막음 비용 절반' }, { id: 'traitor', name: '배신 유도', desc: '호통 맞은 용사 3초간 받는 피해 +30%' }]
        ] },
        { id: 'bomb', name: '금화 폭격', desc: '골드 공격', tiers: [
            [{ id: 'goldFocus', name: '금빛 번개', desc: '번개 피해 +25%', mods: { lightningDamage: 1.25 } }, { id: 'coinWide', name: '넓은 금맥', desc: '번개 범위 +0.5칸' }],
            [{ id: 'coinCool', name: '선불', desc: '번개 재사용 -15%' }, { id: 'coinLoot', name: '전리품', desc: '번개 처치 골드 2배' }],
            [{ id: 'goldBomb', name: '금화 폭격', desc: '새 스킬(E): 골드 10% 소모, 선두 넓게 폭격' }, { id: 'coinRain', name: '금화 비', desc: '번개 맞은 용사 1명당 +1G' }],
            [{ id: 'bombBig', name: '대규모 폭격', desc: '폭격 범위 +1.5칸' }, { id: 'bombRich', name: '재벌의 분노', desc: '폭격 소모 골드 20%, 피해 2배' }]
        ] }
    ],
    plague: [
        { id: 'venom', name: '맹독', desc: '독 강화', tiers: [
            [{ id: 'venomStrong', name: '진한 독', desc: '독 피해 +20%' }, { id: 'venomLong', name: '오래가는 독', desc: '중독 시간 +2초' }],
            [{ id: 'venomStack', name: '겹치는 독', desc: '독 3중첩' }, { id: 'venomSlow', name: '마비 독', desc: '중독된 용사 이동 -15%' }],
            [{ id: 'venomBurst', name: '독 폭발', desc: '중독 종료 시 2초치 피해 폭발' }, { id: 'venomPierce', name: '살을 파는 독', desc: '중독된 용사 방어력 무시' }],
            [{ id: 'venomBoss', name: '거인 사냥', desc: '정예·보스에게 독 피해 1.3배' }, { id: 'venomDeath', name: '숨통', desc: '중독된 일반 용사 체력 10% 이하 즉사' }]
        ] },
        { id: 'contagion', name: '전염', desc: '전염 강화', tiers: [
            [{ id: 'spreadWide', name: '넓은 전염', desc: '전염 범위 +1칸' }, { id: 'spreadStrong', name: '변이', desc: '전염된 독 피해 +50%' }],
            [{ id: 'spreadElite', name: '고열', desc: '정예도 전염' }, { id: 'spreadGold', name: '장례비', desc: '독 처치 골드 +50%' }],
            [{ id: 'miasma', name: '역병 구름', desc: '새 스킬(E): 선두에 6초 독 구름' }, { id: 'spreadChain', name: '열병', desc: '전염 시 2초간 이동 -30%' }],
            [{ id: 'cloudBig', name: '짙은 구름', desc: '구름 범위 2배, 시간 +3초' }, { id: 'pandemic', name: '대유행', desc: '독 처치 10명마다 모든 중독 시간 초기화' }]
        ] },
        { id: 'rot', name: '부패', desc: '약화', tiers: [
            [{ id: 'rotCurse', name: '썩은 살', desc: '중독된 용사 받는 피해 +15%' }, { id: 'rotXp', name: '거름', desc: '처치 경험치 +30%', mods: { xp: 0.3 } }],
            [{ id: 'rotMana', name: '정수 추출', desc: '독으로 정예 처치 시 마력 +1' }, { id: 'rotEdge', name: '녹슨 칼날', desc: '몬스터 피해 +8%', mods: { damage: 0.08 } }],
            [{ id: 'rotWeaken', name: '쇠약', desc: '중독된 정예·보스 왕좌 피해 -30%' }, { id: 'rotSac', name: '역병 제물', desc: '제물 시 모든 용사 중독' }],
            [{ id: 'rotDeep', name: '깊은 부패', desc: '중독된 용사 받는 피해 +30%' }, { id: 'rotBlast', name: '시체 가스', desc: '독 처치 시 그 자리 폭발' }]
        ] }
    ],
    chain: [
        { id: 'shackle', name: '족쇄', desc: '속박 강화', tiers: [
            [{ id: 'shackleChance', name: '촘촘한 사슬', desc: '속박 확률 +6%' }, { id: 'shackleLong', name: '굵은 사슬', desc: '속박 시간 +0.4초' }],
            [{ id: 'shackleElite', name: '무거운 족쇄', desc: '정예 속박 확률 감소 없음' }, { id: 'shackleChain', name: '사슬 엮기', desc: '속박 시 1칸 안 1명 추가 속박' }],
            [{ id: 'jail', name: '사슬 감옥', desc: '새 스킬(E): 선두 주변 1.5칸 3초 속박(보스 1초)' }, { id: 'shackleBreak', name: '찢기는 사슬', desc: '속박 해제 시 최대 체력 5% 피해' }],
            [{ id: 'jailBig', name: '큰 감옥', desc: '감옥 범위 +1칸, 시간 +1초' }, { id: 'shackleLock', name: '단단한 자물쇠', desc: '재속박 시간 1.5배' }]
        ] },
        { id: 'drag', name: '끌기', desc: '후퇴', tiers: [
            [{ id: 'dragBack', name: '갈고리', desc: '속박된 용사 0.5칸 후퇴(보스 제외)' }, { id: 'dragWard', name: '쇠창살', desc: '일반 용사의 왕좌 피해 -20%' }],
            [{ id: 'dragHook', name: '큰 갈고리', desc: '속박된 정예 2칸 후퇴' }, { id: 'dragSlow', name: '저린 다리', desc: '속박 해제 후 2초간 이동 -25%' }],
            [{ id: 'dragTurn', name: '재수감', desc: '왕좌 도달 일반 용사 8명마다 1명 입구로' }, { id: 'dragFar', name: '긴 사슬', desc: '후퇴 거리 2배' }],
            [{ id: 'dragPit', name: '구덩이', desc: '속박된 일반 용사 5명마다 1명 입구로' }, { id: 'dragAll', name: '쇠사슬 회수', desc: '사슬 감옥 맞은 용사 2칸 후퇴' }]
        ] },
        { id: 'execute', name: '처형', desc: '속박 처치', tiers: [
            [{ id: 'execBound', name: '형틀', desc: '속박된 용사 받는 피해 +20%' }, { id: 'execRange', name: '긴 창', desc: '몬스터 사거리 +10%', mods: { range: 0.1 } }],
            [{ id: 'execLow', name: '참수', desc: '속박된 일반 용사 체력 15% 이하 즉사' }, { id: 'execGold', name: '몸값', desc: '속박 상태 처치 골드 +50%' }],
            [{ id: 'execMana', name: '본보기', desc: '속박된 정예 처치 시 마력 +1' }, { id: 'execEdge', name: '간수의 칼', desc: '몬스터 피해 +8%', mods: { damage: 0.08 } }],
            [{ id: 'execDeep', name: '고문', desc: '속박된 용사 받는 피해 +40%' }, { id: 'execChainKill', name: '연쇄 형벌', desc: '속박 처치 시 1칸 안 1명 속박' }]
        ] }
    ],
    mirror: [
        { id: 'copy', name: '복제', desc: '복제', tiers: [
            [{ id: 'reflectUp', name: '맑은 거울', desc: '보존 확률 +10%' }, { id: 'twinUp', name: '쌍둥이', desc: '소환 때 8% 확률로 1마리 더', mods: { twinSummon: 0.08 } }],
            [{ id: 'copyRank', name: '닮은 꼴', desc: '보존된 재료 랭크 유지' }, { id: 'copyGold', name: '거울 값', desc: '재료 보존 시 소환 비용만큼 골드' }],
            [{ id: 'mirrorClone', name: '거울 분신', desc: '새 스킬(E): 최고 등급 몬스터 분신 15초' }, { id: 'copyHigh', name: '큰 거울', desc: '영웅 이상 보존 확률 2배' }],
            [{ id: 'cloneLong', name: '오래가는 분신', desc: '분신 시간 2배' }, { id: 'cloneTwo', name: '분신 둘', desc: '분신 2마리' }]
        ] },
        { id: 'reflect', name: '반사', desc: '왕좌 반격', tiers: [
            [{ id: 'shardArmor', name: '거울 갑옷', desc: '몬스터 받는 피해 -10%', mods: { monsterArmor: 0.1 } }, { id: 'reflectWard', name: '거울벽', desc: '일반 용사의 왕좌 피해 -20%' }],
            [{ id: 'reflectThrone', name: '되비침', desc: '왕좌 피격 시 선두 3명에게 번개(피해 50%)' }, { id: 'reflectRoar', name: '날 선 목소리', desc: '왕좌 피격 시 호통 재사용 -10초' }],
            [{ id: 'mirrorShield', name: '거울 방패', desc: '라운드당 왕좌 피해 1회 무효' }, { id: 'reflectCurse', name: '저주받은 거울', desc: '왕좌 피격 시 모든 용사 2초간 받는 피해 +20%' }],
            [{ id: 'shieldBig', name: '큰 방패', desc: '왕좌 피해 무효 2회' }, { id: 'reflectAll', name: '전신 거울', desc: '되비침 피해 100%' }]
        ] },
        { id: 'transmute', name: '변환', desc: '합치기 강화', tiers: [
            [{ id: 'transEdge', name: '은 칼날', desc: '몬스터 피해 +8%', mods: { damage: 0.08 } }, { id: 'transXp', name: '비친 경험', desc: '처치 경험치 +30%', mods: { xp: 0.3 } }],
            [{ id: 'transJump', name: '뒤틀린 상', desc: '합치기 2단계 상승 확률 +3%', mods: { mergeJump: 0.03 } }, { id: 'transRefund', name: '깨진 조각값', desc: '판매 환불 +30%', mods: { refund: 1.3 } }],
            [{ id: 'transRecipe', name: '조합 거울', desc: '조합식 보존 확률 2배' }, { id: 'transGold', name: '은 세공', desc: '합치기마다 골드(일반 3 ~ 신화 100)' }],
            [{ id: 'transUp', name: '금빛 거울', desc: '보존 재료 한 등급 상승(전설까지)' }, { id: 'transFree', name: '공짜 거울', desc: '라운드 첫 소환 무료' }]
        ] }
    ],
    clock: [
        { id: 'slow', name: '감속', desc: '용사 감속', tiers: [
            [{ id: 'slowLong', name: '느린 초침', desc: '멈춘 초침 +2초' }, { id: 'slowDeep', name: '무거운 초침', desc: '멈춘 초침 감속 -55%' }],
            [{ id: 'slowElite', name: '늦춰진 시간', desc: '정예 처치 시 모든 용사 2초간 이동 -30%' }, { id: 'slowHit', name: '모래 바람', desc: '적중 시 10% 확률로 1.5초간 이동 -30%' }],
            [{ id: 'timeStop', name: '시간 정지', desc: '새 스킬(E): 모든 용사 3초 정지(보스 1초)' }, { id: 'slowAura', name: '시계 소리', desc: '감속 중인 용사 받는 피해 +15%' }],
            [{ id: 'stopLong', name: '긴 정지', desc: '시간 정지 +1.5초' }, { id: 'slowBoss', name: '태엽 감기', desc: '보스도 멈춘 초침 감속 그대로' }]
        ] },
        { id: 'haste', name: '가속', desc: '몬스터 가속', tiers: [
            [{ id: 'hasteStart', name: '첫 종소리', desc: '라운드 시작 6초간 몬스터 공격 속도 +30%' }, { id: 'hasteEdge', name: '태엽 칼날', desc: '몬스터 피해 +8%', mods: { damage: 0.08 } }],
            [{ id: 'hasteKill', name: '몰아치기', desc: '정예 처치 시 5초간 몬스터 공격 속도 +30%' }, { id: 'hasteRange', name: '긴 바늘', desc: '몬스터 사거리 +10%', mods: { range: 0.1 } }],
            [{ id: 'overclock', name: '과회전', desc: '10초마다 3초간 몬스터 공격 속도 +50%' }, { id: 'hasteSkill', name: '빠른 태엽', desc: '스킬 재사용 -15%', mods: { skillCooldown: 0.85 } }],
            [{ id: 'timeStopHaste', name: '멈춘 세계', desc: '시간 정지 중 몬스터 공격 속도 +50%' }, { id: 'hasteMax', name: '폭주 시계', desc: '가속 효과 2배' }]
        ] },
        { id: 'rewind', name: '되감기', desc: '왕좌 회복', tiers: [
            [{ id: 'rewindHeal', name: '수리공', desc: '라운드 종료 시 체력 +1' }, { id: 'rewindWard', name: '시계 문', desc: '일반 용사의 왕좌 피해 -20%' }],
            [{ id: 'rewindGold', name: '이른 종', desc: '다음 라운드 앞당김 골드 +50%' }, { id: 'rewindRound', name: '느린 하루', desc: '라운드 간격 +5초', mods: { roundTime: 35 / 30 } }],
            [{ id: 'rewindThrone', name: '되감기', desc: '왕좌 피해 2마다 3초 뒤 체력 1 회복' }, { id: 'rewindSkill', name: '태엽 재장전', desc: '보스 처치 시 모든 스킬 즉시 충전' }],
            [{ id: 'rewindDeath', name: '마지막 1초', desc: '판당 1회 체력 0에서 5로 회복' }, { id: 'rewindMana', name: '정시 퇴근', desc: '무피해 라운드 마력 +1' }]
        ] }
    ]
};

// 권능으로 열리는 3번째 스킬. 항목 id: 스킬 키(Game.skills와 COMBAT_RULES의 키), 칸 이름, 설명 제목, 아이콘
const POWER_SKILLS = {
    gate: { key: 'portal', name: '균열', title: '균열 열기', icon: 'wave' },
    raise: { key: 'raise', name: '시체', title: '시체 일으키기', icon: 'soul' },
    goldBomb: { key: 'goldBomb', name: '폭격', title: '금화 폭격', icon: 'gold' },
    miasma: { key: 'miasma', name: '구름', title: '역병 구름', icon: 'soul' },
    jail: { key: 'jail', name: '감옥', title: '사슬 감옥', icon: 'lock' },
    mirrorClone: { key: 'mirrorClone', name: '분신', title: '거울 분신', icon: 'summon' },
    timeStop: { key: 'timeStop', name: '정지', title: '시간 정지', icon: 'pause' }
};

// 갈래가 놓이는 방향(도)과 색. LORD_POWERS의 갈래 순서와 같다
const POWER_SECTORS = [{ angle: 205, color: '#7fd8ff' }, { angle: 335, color: '#c98bff' }, { angle: 90, color: '#ff9a4d' }];

// 지도를 시드로 만든다: { nodes: [{ id, branch, tier, x, y }], edges: [[id, id]] }. x, y는 가운데 0, 끝 1인 값
// 판의 난수 흐름과 따로 계산해 지도를 만들어도 소환 결과가 바뀌지 않는다
function buildPowerMap(lordId, seed) {
    const branches = LORD_POWERS[lordId] || [];
    let state = hashSeed(`${seed}/powermap/${lordId}`);
    const next = () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const nodes = [];
    const edges = [];
    const grid = []; // grid[갈래][겹][왼쪽0 오른쪽1] = 항목
    branches.forEach((br, b) => {
        const sector = POWER_SECTORS[b];
        grid[b] = br.tiers.map((list, tier) => {
            const order = next() < 0.5 ? [list[0], list[1]] : [list[1], list[0]];
            const spread = 30 - tier * 3;
            return order.map((node, side) => {
                const ang = (sector.angle + (side ? spread : -spread) + (next() - 0.5) * 10) * Math.PI / 180;
                const r = (tier + 1) / br.tiers.length + (next() - 0.5) * 0.05;
                const n = { id: node.id, branch: b, tier, side, x: Math.cos(ang) * r, y: Math.sin(ang) * r };
                nodes.push(n);
                return n;
            });
        });
        const rows = grid[b];
        // 첫 겹은 하나만 왕좌와 이어질 수도 있다. 그래도 옆 칸으로 건너갈 수 있어 모두 닿는다
        const firstBoth = next() < 0.6;
        const openSide = next() < 0.5 ? 0 : 1;
        rows[0].forEach((n, side) => { if (firstBoth || side === openSide) edges.push(['core', n.id]); });
        edges.push([rows[0][0].id, rows[0][1].id]);
        for (let t = 1; t < rows.length; t++) {
            rows[t].forEach((n, side) => {
                edges.push([rows[t - 1][side].id, n.id]);
                if (next() < 0.35) edges.push([rows[t - 1][1 - side].id, n.id]);
            });
        }
    });
    return { nodes, edges };
}

// 유물 효과의 상한과 기준 수
const RELIC_LIMITS = { goldStep: 100, goldDamageMax: 0.3, altarDamageMax: 0.15, interestMax: 15, fewCount: 6, perMonsterMax: 0.45, gaugeMax: 1000, soulMax: 5 };

// 마왕. 스킬은 셋 다 번개와 호통이다(전용 몬스터는 다음 단계).
//   sprite: 왕좌의 대기 그림, cast: 주문 그림(없으면 sprite를 쓰고 빛 효과로 구분), footPx: 128px 캔버스 안의 발끝 높이
//   portrait: 마왕 탭 초상. crop이 있으면 sprite에서 [x, y, 크기]를 잘라 쓴다(머리 부분)
//   speech: SPEECH에 더해 이 마왕만 하는 대사
//   passive: 마왕 고유 패시브. kind로 동작한다(Game.lordPassive). lightningCurse 번개 맞은 용사 저주, soulVolley 처치 수마다 망령 타격, goldTouch 소환 강화 할인과 정예 골드
const DEMON_LORDS = {
    rift: {
        id: 'rift', name: '균열의 군주', desc: '번개 특화',
        sprite: 'lord_rift', footPx: 120,
        portrait: { sprite: 'lord_rift', crop: [34, 12, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'lightningCurse', name: '감전 낙인', desc: '번개 맞은 용사 8초간 받는 피해 +60%', duration: 8, takenMul: 1.6 },
        speech: {
            waveStart: ['오늘 전기세는 너희가 낸다.'],
            throneHit: ['찌릿하게 해 줄까?'],
            sacrifice: ['좋아, 번개 충전 완료.']
        }
    },
    bone_queen: {
        id: 'bone_queen', name: '뼈의 여왕', desc: '성장·제물 특화',
        sprite: 'lord_bone_queen', footPx: 119,
        portrait: { sprite: 'lord_bone_queen', crop: [42, 4, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'soulVolley', name: '망령 일제 사격', desc: '용사 25명 처치마다 망령이 선두 6명 공격', every: 25, count: 6, base: 30, perRound: 8 },
        speech: {
            waveStart: ['얘들아, 간식 왔다. 뼈는 남기지 마.'],
            throneHit: ['내 왕관 삐뚤어졌잖아!'],
            sacrifice: ['다시 태어나면 더 크게 자라렴.']
        }
    },
    gold_king: {
        id: 'gold_king', name: '황금 마왕', desc: '골드 특화',
        sprite: 'lord_gold_king', footPx: 120,
        portrait: { sprite: 'lord_gold_king', crop: [40, 6, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'goldTouch', name: '황금 수완', desc: '소환 강화 비용 -25%, 정예·보스 처치 골드 2배', upgradeMul: 0.75, eliteGold: 2 },
        speech: {
            waveStart: ['입장료는 냈나? 안 냈으면 목숨으로.'],
            throneHit: ['이 의자 얼마짜린 줄 알아?!'],
            sacrifice: ['이건 낭비가 아니라 투자다.']
        }
    },
    plague: {
        id: 'plague', name: '역병의 군주', desc: '독·전염 특화',
        sprite: 'lord_plague', footPx: 119,
        portrait: { sprite: 'lord_plague', crop: [42, 8, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'plague', name: '역병', desc: '적중 시 3초 중독(초당 공격력 15%), 중독 상태로 쓰러지면 1.5칸 전염', duration: 3, ratio: 0.15, radius: 1.5 },
        speech: {
            waveStart: ['기침 소리가 들리는군. 어서 와.'],
            throneHit: ['가까이 오지 마, 옮는다.'],
            sacrifice: ['거름이 되어라.']
        }
    },
    chain: {
        id: 'chain', name: '사슬의 군주', desc: '속박·제어 특화',
        sprite: 'lord_chain', footPx: 120,
        portrait: { sprite: 'lord_chain', crop: [40, 4, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'shackle', name: '족쇄', desc: '적중 시 14% 확률로 0.6초 속박(정예·보스 절반)', chance: 0.14, duration: 0.6 },
        speech: {
            waveStart: ['줄 맞춰 들어와라.'],
            throneHit: ['감히 간수를 쳐?'],
            sacrifice: ['형기 만료.']
        }
    },
    mirror: {
        id: 'mirror', name: '거울 마녀', desc: '합치기·복제 특화',
        sprite: 'lord_mirror', footPx: 119,
        portrait: { sprite: 'lord_mirror', crop: [42, 8, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'reflection', name: '거울상', desc: '합치기 때 12% 확률로 재료 1마리 보존', chance: 0.12 },
        speech: {
            waveStart: ['어서 와. 너도 둘이 되고 싶니?'],
            throneHit: ['내 거울에 금이 갔잖아.'],
            sacrifice: ['비친 모습은 남겨 둘게.']
        }
    },
    clock: {
        id: 'clock', name: '시계탑의 마왕', desc: '감속·시간 특화',
        sprite: 'lord_clock', footPx: 119,
        portrait: { sprite: 'lord_clock', crop: [40, 4, 44] },
        effects: {}, // 기본 수치 효과는 없다(마왕은 패시브와 권능으로 갈린다)
        passive: { kind: 'stopwatch', name: '멈춘 초침', desc: '라운드 시작 6초간 용사 이동 -40%(보스 절반)', duration: 6, cut: 0.4 },
        speech: {
            waveStart: ['시간 맞춰 왔군.'],
            throneHit: ['초침이 어긋났잖아.'],
            sacrifice: ['네 시간은 여기까지.']
        }
    }
};
const DEFAULT_LORD = 'rift';

// 유물: 시작할 때 유물 칸 수만큼 고른다. 대가 없이 약하게, 판의 방식을 바꾸는 효과 위주다. 그림은 assets/sprites/relic_<id>.png(48px)
const RELICS = {
    greedy_vault: { id: 'greedy_vault', name: '탐욕의 금주머니', effects: { goldDamage: 0.03 }, desc: '보유 골드 100G당 몬스터 피해가 3% 증가한다(최대 30%)' },
    legion_banner: { id: 'legion_banner', name: '군단의 깃발', effects: { fieldMax: 5 }, desc: '맵 몬스터 상한이 5 증가한다' },
    glass_heart: { id: 'glass_heart', name: '유리 심장', effects: { fullHpDamage: 0.2 }, desc: '체력이 가득할 때 피해가 20% 증가한다' },
    merchant_bond: { id: 'merchant_bond', name: '상인의 보증서', effects: { startGold: 100 }, desc: '게임 시작 시 골드를 100G 더 받는다' },
    lord_armor: { id: 'lord_armor', name: '마왕의 갑옷', effects: { maxHp: 10 }, desc: '마왕의 최대 체력이 10 증가한다' },
    tome_xp: { id: 'tome_xp', name: '경험의 서', effects: { xp: 0.5 }, desc: '처치로 얻는 경험치가 50% 증가한다' },
    pierce_tip: { id: 'pierce_tip', name: '꿰뚫는 화살촉', effects: { pierce: 1 }, desc: '원거리 공격이 용사 1명을 더 관통한다' },
    usury_ledger: { id: 'usury_ledger', name: '고리대금 장부', effects: { interest: 0.03 }, desc: '라운드 종료 시 현재 보유 골드의 3%만큼 이자를 받는다(최대 15G)' },
    mad_dice: { id: 'mad_dice', name: '미치광이의 주사위', effects: { mergeJump: 0.05 }, desc: '합성 시 5% 확률로 2단계 더 높은 등급의 몬스터가 나온다' },
    dead_horn: { id: 'dead_horn', name: '망자의 뿔피리', effects: { meleeDamage: 0.15, meleeSpeed: 0.15 }, desc: '근접 몬스터의 피해와 공격 속도가 15% 증가한다' },
    sniper_mark: { id: 'sniper_mark', name: '저격수의 표식', effects: { range: 0.1, farDamage: 0.2 }, desc: '몬스터의 사거리가 10% 증가하고, 멀리 있는 적일수록 최대 20%의 추가 피해를 준다' },
    blood_cup: { id: 'blood_cup', name: '피의 잔', effects: { critChance: 0.15, critDamage: 0.5 }, desc: '치명타 확률이 15%, 치명타 피해가 50% 증가한다' },
    twin_blade: { id: 'twin_blade', name: '쌍날 검', effects: { doubleHit: 0.15 }, desc: '공격할 때 15% 확률로 한 번 더 공격한다' },
    broken_hourglass: { id: 'broken_hourglass', name: '깨진 모래시계', effects: { earlyGold: 30, earlyAttackSpeed: 0.1 }, desc: '라운드를 스킵하면 30G를 받고, 모든 몬스터의 공격 속도가 10% 증가한다' },
    undead_grail: { id: 'undead_grail', name: '망자의 성배', effects: { undeadOdds: 1, undeadCrit: 0.3 }, desc: '소환 시 언데드가 나올 확률이 100% 증가하고, 언데드의 치명타 확률이 30% 증가한다' },
    war_cry: { id: 'war_cry', name: '전쟁 함성', effects: { orcOdds: 1, orcSpeed: 0.25 }, desc: '소환 시 오크가 나올 확률이 100% 증가하고, 오크의 공격 속도가 25% 증가한다' },
    torture_kit: { id: 'torture_kit', name: '고문 도구', effects: { statusDamage: 0.2 }, desc: '상태 이상에 걸린 적이 받는 피해가 20% 증가한다' },
    ice_fang: { id: 'ice_fang', name: '얼음 송곳니', effects: { freezeChance: 0.1 }, desc: '공격할 때 10% 확률로 적을 1.5초 동안 얼려 이동 속도를 50% 낮춘다' },
    giant_glove: { id: 'giant_glove', name: '거인의 장갑', effects: { bigDamage: 0.25 }, desc: '2칸 이상을 차지하는 큰 몬스터의 피해가 25% 증가한다' },
    small_giant: { id: 'small_giant', name: '작은 거인', effects: { smallSpeed: 0.15 }, desc: '1칸 몬스터의 공격 속도가 15% 증가한다' },
    firecracker: { id: 'firecracker', name: '폭죽 상자', effects: { killBlast: 0.1 }, desc: '일반 용사를 처치하면 10% 확률로 그 자리가 폭발한다' },
    hellfire_seal: { id: 'hellfire_seal', name: '지옥불 인장', effects: { demonOdds: 1, demonBurn: 0.2 }, desc: '소환 시 악마가 나올 확률이 100% 증가하고, 악마의 공격이 3초 동안 적을 불태운다' },
    hunter_horn: { id: 'hunter_horn', name: '사냥꾼의 뿔', effects: { beastOdds: 1, beastFrenzy: 0.5 }, desc: '소환 시 야수가 나올 확률이 100% 증가하고, 야수가 적을 처치하면 3초 동안 공격 속도가 50% 증가한다' },
    storm_bottle: { id: 'storm_bottle', name: '폭풍의 병', effects: { lightningCooldown: 0.8 }, desc: '번개의 재사용 시간이 20% 감소한다' },
    smith_hammer: { id: 'smith_hammer', name: '대장장이의 망치', effects: { equipUp: 0.1 }, desc: '장비 등급이 오를 확률이 10% 증가한다' },
    hunt_mark: { id: 'hunt_mark', name: '사냥 표식', effects: { eliteCrit: 0.25 }, desc: '정예와 보스에게 치명타 확률이 25% 증가한다' },
    march_drum: { id: 'march_drum', name: '진군의 북', effects: { perMonsterDamage: 0.03 }, desc: '내 맵의 몬스터 한 마리당 피해가 3% 증가한다(최대 45%)' },
    mana_crystal: { id: 'mana_crystal', name: '마나 결정', effects: { manaGain: 0.5 }, desc: '마력을 얻는 양이 50% 증가한다' },
    thief_sand: { id: 'thief_sand', name: '시간 도둑의 모래', effects: { bossTime: 15 }, desc: '보스 라운드 시간이 15초 늘어난다' },
    seventh_star: { id: 'seventh_star', name: '일곱 번째 별', effects: { seventhStar: 1 }, desc: '7번째 소환마다 영웅 등급 이상의 몬스터가 나온다' },
    spirit_orb: { id: 'spirit_orb', name: '정령의 구슬', effects: { spiritOdds: 1, spiritSplash: 0.3 }, desc: '소환 시 정령이 나올 확률이 100% 증가하고, 정령의 공격이 주변 적에게 30%의 피해로 튄다' },
    equip_eater: { id: 'equip_eater', name: '장비 먹는 괴물', effects: { equipSlots: 1 }, desc: '몬스터 한 마리에 장비를 2개까지 장착할 수 있다' },
    mirror_twin: { id: 'mirror_twin', name: '거울 쌍둥이', effects: { twinSummon: 0.05 }, desc: '소환 시 5% 확률로 한 마리를 더 소환한다' },
    lone_crown: { id: 'lone_crown', name: '고독한 왕관', effects: { fewDamage: 0.35 }, desc: '내 맵의 몬스터가 6마리 이하일 때 피해가 35% 증가한다' },
    pure_crown: { id: 'pure_crown', name: '순혈의 왕관', effects: { pureDamage: 0.4 }, desc: '내 맵의 몬스터가 모두 같은 종족이면 피해가 40% 증가한다' },
    balance_scale: { id: 'balance_scale', name: '균형의 저울', effects: { allFamilies: 0.25 }, desc: '5종족이 모두 맵에 있으면 피해가 25% 증가한다' },
    gambler_coin: { id: 'gambler_coin', name: '도박꾼의 동전', effects: { gamble: 1 }, desc: '소환 시 15% 확률로 비용이 0이 되고, 10% 확률로 비용이 2배가 된다' },
    swift_boots: { id: 'swift_boots', name: '신속의 장화', effects: { freshSpeed: 0.5 }, desc: '새로 소환하거나 합성한 몬스터는 10초 동안 공격 속도가 50% 증가한다' },
    mythic_shard: { id: 'mythic_shard', name: '신화의 파편', effects: { mythicGold: 500 }, desc: '합성으로 신화 몬스터가 나오면 골드를 500G 받는다' },
    blood_contract: { id: 'blood_contract', name: '피의 계약서', effects: { hpSummon: 3 }, desc: '골드가 부족할 때 체력 1을 소모해 소환할 수 있다(판당 3회)' },
    shaky_bridge: { id: 'shaky_bridge', name: '흔들리는 다리', effects: { mergedSlow: 0.7 }, desc: '합류 지점을 지나 마왕에게 가까워진 용사들의 이동 속도가 30% 감소한다' },
    slaughter_bell: { id: 'slaughter_bell', name: '학살의 종', effects: { slaughterBell: 1 }, desc: '적이 죽을 때마다 게이지가 1씩 쌓인다(정예 10, 보스 100). 게이지가 1000이 되면 유물을 눌러 모든 적에게 최대 체력의 50%만큼 피해를 입힌다(보스는 10%)' },
    soul_scythe: { id: 'soul_scythe', name: '영혼 수확 낫', effects: { soulScythe: 1 }, desc: '정예를 처치할 때마다 영혼을 하나 얻는다. 영혼이 5개가 되면 유물을 눌러 모든 몬스터의 공격 속도를 10초 동안 50% 올린다' },
    undying_crown: { id: 'undying_crown', name: '불사의 왕관', effects: { undying: 1 }, desc: '마왕이 쓰러지면 1회에 한해 부활해 해당 라운드를 다시 진행한다' },
    cursed_crown: { id: 'cursed_crown', name: '저주받은 왕관', effects: { maxHpHalf: 1, damage: 0.4 }, desc: '마왕의 최대 체력이 절반이 되는 대신 모든 몬스터의 피해가 40% 증가한다' },
    glutton_stomach: { id: 'glutton_stomach', name: '탐식의 위장', effects: { feast: 0.05 }, desc: '합성할 때마다 결과 몬스터의 피해가 5%씩 쌓여 판이 끝날 때까지 유지된다' },
    cruel_blade: { id: 'cruel_blade', name: '잔혹한 칼날', effects: { critSplash: 0.5 }, desc: '치명타로 적을 처치하면 주변 적에게 그 피해의 50%를 입힌다' }
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
function buildMods(lordId, relicIds, cardIds) {
    const mods = emptyMods();
    const sources = [hasEntry(DEMON_LORDS, lordId) && DEMON_LORDS[lordId], ...(relicIds || []).map(id => hasEntry(RELICS, id) && RELICS[id]),
        ...(cardIds || []).map(id => hasEntry(RULE_CARDS, id) && RULE_CARDS[id])].filter(Boolean);
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
    if (e.text) return e.text(v);
    if (e.mode === 'add') return `${e.name} ${signed(v)}${e.unit || ''}`;
    if (e.mode === 'ratio') return `${e.name} ${signed(v * 100)}%${e.note ? `(${e.note})` : ''}`;
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
