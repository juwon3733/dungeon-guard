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
    slow_revival: { id: 'slow_revival', name: '느린 부활', kind: 'hard', effects: { respawn: 1.5 } },
    dull_hands: { id: 'dull_hands', name: '둔한 손', kind: 'hard', effects: { attackSpeed: -0.1 } },
    full_vault: { id: 'full_vault', name: '넉넉한 금고', kind: 'boon', effects: { startGold: 200 } },
    wide_field: { id: 'wide_field', name: '넓은 전장', kind: 'boon', effects: { fieldMax: 4 } },
    war_fever: { id: 'war_fever', name: '전쟁 열기', kind: 'boon', effects: { damage: 0.1 } },
    rich_spoils: { id: 'rich_spoils', name: '쌓이는 전리품', kind: 'boon', effects: { bounty: 1.2 } },
    cheap_summon: { id: 'cheap_summon', name: '할인 소환', kind: 'boon', effects: { summonBase: -5 } },
    fast_revival: { id: 'fast_revival', name: '빠른 부활', kind: 'boon', effects: { respawn: 0.7 } },
    elite_hunt: { id: 'elite_hunt', name: '정예 사냥', kind: 'boon', effects: { eliteDrop: 0.2 } }
};

// 일일 도전: rounds 라운드, 유물 relics개, 규칙 카드 hard + boon장. 신화까지 닿을 수 있는 길이다
const DAILY_RULES = { rounds: 40, relics: 2, hard: 2, boon: 1, parTime: 1200 };

// 점수: 막은 라운드가 먼저이고, 같으면 남은 체력과 처치, 다 막으면 빨리 끝낼수록 높다
const SCORE_RULES = { round: 1000, hp: 100, kill: 2, victory: 5000, timePerSecond: 2 };

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
        kind: 'daily', id: seed, name: '일일 도전', date, seed, rounds: DAILY_RULES.rounds, parTime: DAILY_RULES.parTime,
        lord: seededPick(seed, 'lord', Object.keys(DEMON_LORDS), 1)[0],
        relics: seededPick(seed, 'relics', Object.keys(RELICS), DAILY_RULES.relics),
        cards: [...seededPick(seed, 'hard', cards('hard'), DAILY_RULES.hard), ...seededPick(seed, 'boon', cards('boon'), DAILY_RULES.boon)],
        zone: seededPick(seed, 'zone', ZONE_IDS, 1)[0]
    };
}

// 판 결과의 점수
function challengeScore(c, r) {
    const R = SCORE_RULES;
    let score = r.rounds * R.round + r.hp * R.hp + r.kills * R.kill;
    if (r.victory) score += R.victory + Math.max(0, Math.round(c.parTime - r.time)) * R.timePerSecond;
    return score;
}

// 입력 기록을 처음부터 다시 돌려 결과를 낸다(뒤에 서버가 점수를 검증할 때 쓴다). 저장과 기록을 남기지 않는다
function replayChallenge(record, maxTicks) {
    const c = dailyChallenge(record.date);
    Game.replaying = true;
    try {
        Game.reset(null, null, c);
        Game.state = 'prep';
        let i = 0;
        const limit = maxTicks || 60 * 60 * 90;
        while (Game.inPlay() && Game.tick < limit) {
            while (i < record.inputs.length && record.inputs[i].t <= Game.tick) Game.applyInput(record.inputs[i++]);
            Game.update(GAME_TICK);
        }
        return Game.challengeResult;
    } finally {
        Game.replaying = false;
    }
}
