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
        zone: seededPick(seed, 'zone', ZONE_IDS, 1)[0]
    };
}

// 끝없는 심연: 일주일 동안 모두 같은 시드(소환, 합치기, 변이 순서, 지역 순서)로 겨룬다. 해금한 마왕과 유물을 골라 들어가고, 겨루는 것은 얼마나 깊이 내려가는가다.
//   mutateEvery: 이 층수마다 변이(어렵게 만드는 규칙 카드)가 하나씩 쌓이고 지역이 바뀐다
//   hpFrom, hpGrowth: 이 층부터 용사 체력이 층마다 몇 배로 늘어나는가. 일일 도전보다 가파르다
//   scorePerMutation: 쌓인 변이 하나당 점수 배율
const ABYSS_RULES = { mutateEvery: 10, hpFrom: 20, hpGrowth: 1.07, scorePerMutation: 0.25 };

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
