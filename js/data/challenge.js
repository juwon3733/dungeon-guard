// 도전 콘텐츠의 공통 규칙: 규칙 카드(RULE_CARDS)와 일일 도전. 같은 날에는 모두 같은 시드, 같은 마왕, 유물, 규칙 카드로 겨룬다.
// 시도는 무제한이고 최고 기록만 남는다. 시드와 입력 기록은 js/core/config.js의 Rng와 Game.act가 맡는다.

// 규칙 카드: 효과 키는 LORD_EFFECTS와 같다. hard는 어렵게, boon은 쉽게 만든다
const RULE_CARDS = {
    iron_armor: { id: 'iron_armor', name: '강철 갑옷', kind: 'hard', effects: { heroHp: 1.25 } },
    hasty_steps: { id: 'hasty_steps', name: '급한 발걸음', kind: 'hard', effects: { heroSpeed: 1.1 } },
    gold_drought: { id: 'gold_drought', name: '보물 가뭄', kind: 'hard', effects: { bounty: 0.8 } },
    narrow_field: { id: 'narrow_field', name: '좁은 전장', kind: 'hard', effects: { fieldMax: -4 } },
    broken_bolt: { id: 'broken_bolt', name: '번개 고장', kind: 'hard', effects: { lightningCooldown: 2 } },
    costly_pact: { id: 'costly_pact', name: '비싼 계약', kind: 'hard', effects: { summonBase: 8 } },
    weak_arms: { id: 'weak_arms', name: '약한 팔', kind: 'hard', effects: { damage: -0.1 } },
    dull_hands: { id: 'dull_hands', name: '둔한 손', kind: 'hard', effects: { attackSpeed: -0.1 } },
    full_vault: { id: 'full_vault', name: '넉넉한 금고', kind: 'boon', effects: { startGold: 200 } },
    wide_field: { id: 'wide_field', name: '넓은 전장', kind: 'boon', effects: { fieldMax: 4 } },
    war_fever: { id: 'war_fever', name: '전쟁 열기', kind: 'boon', effects: { damage: 0.1 } },
    rich_spoils: { id: 'rich_spoils', name: '쌓이는 전리품', kind: 'boon', effects: { bounty: 1.2 } },
    cheap_summon: { id: 'cheap_summon', name: '할인 소환', kind: 'boon', effects: { summonBase: -5 } },
    keen_eyes: { id: 'keen_eyes', name: '날카로운 눈', kind: 'boon', effects: { range: 0.1 } },
    elite_hunt: { id: 'elite_hunt', name: '정예 사냥', kind: 'boon', effects: { eliteDrop: 0.2 } }
};

// 일일 도전: 무한 라운드. 유물 relics개, 규칙 카드 hard + boon장
const DAILY_RULES = { relics: 2, hard: 2, boon: 1 };

// 점수: 처치와 라운드마다 쌓이고 뒤 라운드일수록 커진다. 기준값 x scoreMul(라운드)
//   kill: 일반 처치(eliteMul, bossMul을 곱한다), clear: 라운드를 다 잡음, earlySecond: 남은 시간 1초
const SCORE_RULES = { kill: 1000, eliteMul: 5, bossMul: 100, clear: 50000, earlySecond: 5000, roundGrowth: 1.04 };

// 라운드 r의 점수 배율: r x 1.04^r. 곱셈을 되풀이한다(Math.pow는 엔진마다 값이 다를 수 있어 입력 재생이 어긋난다)
function scoreMul(r) {
    let mul = r;
    for (let i = 0; i < r; i++) mul *= SCORE_RULES.roundGrowth;
    return mul;
}

// 한국 시간 기준 오늘 날짜 'YYYY-MM-DD'. 자정에 함께 바뀐다
function kstDate(now) {
    return new Date((now === undefined ? Date.now() : now) + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 시드에서 표의 항목을 겹치지 않게 count개 고른다(표 순서는 고정이어야 같은 결과가 나온다)
function seededPick(seed, name, list, count) {
    const pool = list.slice();
    const out = [];
    let s = hashSeed(`${seed}/${name}`);
    while (out.length < count && pool.length) {
        s = (Math.imul(s, 1664525) + 1013904223) | 0;
        out.push(pool.splice((s >>> 8) % pool.length, 1)[0]);
    }
    return out;
}

// 날짜의 일일 도전. 같은 날짜면 언제 어디서 불러도 같다
function dailyChallenge(date) {
    const seed = `daily-${date}`;
    const cards = id => Object.keys(RULE_CARDS).filter(k => RULE_CARDS[k].kind === id);
    return {
        kind: 'daily', id: seed, name: '일일 도전', date, seed,
        lord: seededPick(seed, 'lord', Object.keys(DEMON_LORDS), 1)[0],
        relics: seededPick(seed, 'relics', Object.keys(RELICS), DAILY_RULES.relics),
        cards: [...seededPick(seed, 'hard', cards('hard'), DAILY_RULES.hard), ...seededPick(seed, 'boon', cards('boon'), DAILY_RULES.boon)],
        map: seededPick(seed, 'map', MAP_IDS, 1)[0],
        zone: seededPick(seed, 'zone', ZONE_IDS, 1)[0]
    };
}

// 끝없는 심연: 일주일 동안 모두 같은 시드(소환, 합치기, 변이 순서, 지역 순서)로 겨룬다. 해금한 마왕과 유물을 골라 들어가고, 겨루는 것은 얼마나 깊이 내려가는가다.
//   mutateEvery: 이 층수마다 변이(어렵게 만드는 규칙 카드)가 하나씩 쌓이고 지역이 바뀐다
//   hpFrom, hpGrowth: 이 층부터 용사 체력이 층마다 몇 배로 늘어나는가. 일일 도전보다 가파르다
//   scorePerMutation: 쌓인 변이 하나당 점수 배율
const ABYSS_RULES = { mutateEvery: 10, hpFrom: 20, hpGrowth: 1.07, scorePerMutation: 0.25 };

// 주간 토벌전: 일주일 동안 모두 같은 시드, 같은 보스, 같은 조건으로 몇 단계까지 잡는지 겨룬다.
//   tierEvery: 보스가 나오는 라운드 간격, tierHpGrowth: 보스를 잡을 때마다 다음 보스 체력 배율(곱해진다)
//   bossDamageScore: 보스에게 준 피해 1당 기준 점수(라운드 배율을 곱한다). 잡지 못한 마지막 보스도 점수로 남는다
const RAID_RULES = { tierEvery: 10, tierHpGrowth: 2, relics: 2, hard: 2, bossDamageScore: 20 };

// 토벌 보스: 그림은 Asteria 보스. 패턴 표는 BOSSES와 같다. 체력은 전사 체력 x hpMultiplier x 라운드 배율 x 단계 배율이다
const RAID_BOSSES = {
    war_avatar: { name: '전쟁의 화신', note: '체력 50%에 돌진, 25%에 주변 정지', patterns: [{ at: 0.5, kind: 'charge', time: 3, speed: 2.2 }, { at: 0.25, kind: 'stomp', windup: 1.2, range: 3, stun: 3 }] },
    sea_king: { name: '심해의 왕', note: '체력 50%·25%에 넓은 감전', patterns: [{ at: 0.5, kind: 'shock', windup: 1.0, range: 4, stun: 2.5 }, { at: 0.25, kind: 'shock', windup: 1.6, range: 5, stun: 3 }] },
    judge: { name: '심판자', note: '체력 75%·50%·25%에 감전', patterns: [{ at: 0.75, kind: 'shock', windup: 1.0, range: 3, stun: 2 }, { at: 0.5, kind: 'shock', windup: 1.0, range: 3, stun: 2 }, { at: 0.25, kind: 'shock', windup: 1.0, range: 4, stun: 2.5 }] },
    gatekeeper: { name: '문지기', note: '느리지만 단단하고, 25%에 주변 정지', speed: 0.5, hpMultiplier: 20, patterns: [{ at: 0.25, kind: 'stomp', windup: 1.0, range: 4, stun: 3 }] },
    golden_boar: { name: '황금 멧돼지', note: '빠르고 체력 75%·40%에 돌진', speed: 1, hpMultiplier: 11, patterns: [{ at: 0.75, kind: 'charge', time: 2, speed: 2.4 }, { at: 0.4, kind: 'charge', time: 3, speed: 2.6 }] },
    star_herald: { name: '별의 사도', note: '체력 60%에 감전, 30%에 돌진', patterns: [{ at: 0.6, kind: 'shock', windup: 1.2, range: 4, stun: 2.5 }, { at: 0.3, kind: 'charge', time: 3, speed: 2.2 }] }
};
for (const [id, b] of Object.entries(RAID_BOSSES)) {
    const a = ASTERIA_BOSS_ART[id];
    BOSSES[id] = Object.assign({
        hpMultiplier: 15, armor: 4, base: 'warrior', speed: 0.7, bounty: 40, damage: 18, interval: 1.0, throneDamage: 5, entry: 'north', starY: a.height * 1.5 + 20,
        portrait: { sprite: `${a.sprite}/rotations/south`, crop: a.crop }, art: { sprite: a.sprite, scale: a.scale, anim: a.anim, bob: true, windupLoop: false }
    }, b);
}

function raidChallenge(week) {
    const seed = `raid-${week}`;
    const hard = Object.keys(RULE_CARDS).filter(k => RULE_CARDS[k].kind === 'hard');
    return {
        kind: 'raid', id: seed, name: '주간 토벌전', seed, week, hpFrom: 1e9, boss: seededPick(seed, 'boss', Object.keys(RAID_BOSSES), 1)[0],
        lord: seededPick(seed, 'lord', Object.keys(DEMON_LORDS), 1)[0],
        relics: seededPick(seed, 'relics', Object.keys(RELICS), RAID_RULES.relics),
        cards: seededPick(seed, 'hard', hard, RAID_RULES.hard),
        map: seededPick(seed, 'map', MAP_IDS, 1)[0],
        zone: seededPick(seed, 'zone', ZONE_IDS, 1)[0]
    };
}

// 이번 주의 시드: 한국 시간 월요일 날짜 'YYYY-MM-DD'. 월요일 0시에 함께 바뀐다
function abyssWeek(now) {
    const kst = new Date((now === undefined ? Date.now() : now) + 9 * 3600 * 1000);
    const sinceMonday = (kst.getUTCDay() + 6) % 7;
    return new Date(kst.getTime() - sinceMonday * 86400 * 1000).toISOString().slice(0, 10);
}

function abyssChallenge(seed, lord, relics) {
    return {
        kind: 'abyss', id: `abyss-${seed}`, name: '끝없는 심연', seed: String(seed), lord, relics: relics.slice(), cards: [],
        hpFrom: ABYSS_RULES.hpFrom, hpGrowth: ABYSS_RULES.hpGrowth,
        map: seededPick(String(seed), 'map', MAP_IDS, 1)[0],
        zone: seededPick(String(seed), 'zone', ZONE_IDS, 1)[0]
    };
}

// i번째 변이(0부터). 시드로 섞은 어려운 카드를 차례로 쓰고 다 쓰면 되풀이한다.
// 좁은 전장은 겹치면 몬스터를 둘 자리가 없어지므로 한 번만 나온다
function abyssMutation(seed, i) {
    const order = seededPick(seed, 'mutation', Object.keys(RULE_CARDS).filter(k => RULE_CARDS[k].kind === 'hard'), 99);
    if (i < order.length) return order[i];
    const again = order.filter(k => k !== 'narrow_field');
    return again[(i - order.length) % again.length];
}

// 변이 수에 따른 지역: 시드에서 고른 첫 지역부터 차례로 바뀐다
function abyssZone(seed, mutations) {
    const first = ZONE_IDS.indexOf(seededPick(seed, 'zone', ZONE_IDS, 1)[0]);
    return ZONE_IDS[(first + mutations) % ZONE_IDS.length];
}

// 기록에서 도전 조건을 다시 만든다
function challengeFromRecord(record) {
    if (record.kind === 'raid') return raidChallenge(record.week);
    return record.kind === 'abyss' ? abyssChallenge(record.seed, record.lord, record.relics) : dailyChallenge(record.date);
}

// 입력 기록을 처음부터 다시 돌려 결과를 낸다(뒤에 서버가 점수를 검증할 때 쓴다). 저장과 기록을 남기지 않는다
function replayChallenge(record, maxTicks) {
    const c = challengeFromRecord(record);
    Game.replaying = true;
    try {
        Game.reset(null, null, c);
        Game.state = 'prep';
        let i = 0;
        const limit = maxTicks || 60 * 60 * 60 * 6; // 판 시간 6시간
        while (Game.inPlay() && Game.tick < limit) {
            while (i < record.inputs.length && record.inputs[i].t <= Game.tick) Game.applyInput(record.inputs[i++]);
            Game.update(GAME_TICK);
        }
        return Game.challengeResult;
    } finally {
        Game.replaying = false;
    }
}
