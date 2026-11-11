// 화면 없이 지금 규칙을 봇으로 돌려 판 길이와 난이도를 잰다. 실행: node tools/simulate.js [판 수, 기본 5] [봇 이름 일부]
// 사람보다 칸 배치와 조작이 단순하므로 대략적인 값으로 본다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/core/config.js', 'js/data/balance.js', 'js/data/asteria_art.js', 'js/data/asteria_heroes.js', 'js/data/hd_monster_art.js', 'js/data/monsters.js', 'js/data/demonlords.js', 'js/data/story.js', 'js/data/asteria_bosses.js', 'js/data/challenge.js', 'js/data/map.js', 'js/game/effects.js', 'js/game/combat.js',
    'js/game/hero.js', 'js/game/monster.js', 'js/game/unit.js', 'js/game/relics.js', 'js/game/meta.js', 'js/game/game.js'];
const context = vm.createContext({ console, Math, Set, Map, Object, Array, Infinity, JSON, Sfx: { play() {} } });
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });

vm.runInContext(`
// 합칠 수 있는 짝: 조합식을 먼저, 그다음 낮은 등급부터
function mergePair(G) {
    const ms = G.monsters.filter(m => !m.removed);
    let best = null;
    for (const a of ms) for (const b of ms) {
        if (a === b) continue;
        const p = G.mergePlanFor(a, b);
        if (p.kind === 'none') continue;
        const score = (p.kind === 'recipe' ? 100 : 0) - GRADE_ORDER.indexOf(MONSTERS[a.type].grade);
        if (!best || score > best.score) best = { a, b, score };
    }
    return best;
}
const TRACE = [];
// 조합 제단: 맵의 몬스터로 만들 수 있는 히든 조합식(결과 등급이 높은 것부터). 재료는 조건을 채우는 가장 낮은 랭크부터. 없으면 null
function altarPick(G) {
    const order = MONSTER_RECIPES.filter(r => r.hidden).sort((a, b) => GRADE_ORDER.indexOf(MONSTERS[b.result].grade) - GRADE_ORDER.indexOf(MONSTERS[a.result].grade));
    for (const r of order) {
        const used = [];
        let ok = true;
        for (const need of recipeMaterials(r)) {
            const m = G.monsters.filter(x => !x.removed && !x.clone && !used.includes(x) && x.type === need.type && (x.rank || 0) >= need.rank)
                .sort((a, b) => (a.rank || 0) - (b.rank || 0))[0];
            if (!m) { ok = false; break; }
            used.push(m);
        }
        if (ok) return used;
    }
    return null;
}
function play(bot, stageId, daily) {
    if (daily) { Game.reset(null, null, daily.startsWith('raid') ? raidChallenge(daily) : daily.startsWith('abyss') ? abyssChallenge(daily, bot.lord || 'rift', bot.relics || [], bot.level === undefined ? DEFAULT_ABYSS_LEVEL : bot.level) : dailyChallenge(daily)); Game.state = 'prep'; }
    else Game.reset(stageId ? { lord: 'rift', relics: [] } : undefined, stageId);
    const G = Game, DT = 1 / 30;
    const s = { summons: 0, merges: 0, ups: 0, top: 0, legendWave: 0 };
    let guard = 0, thinkMerge = 0, spendThink = 0;
    while ((G.state === 'prep' || G.state === 'wave') && guard++ < 400000) {
        if (G.bossReward) {
            const c = G.bossReward.cards;
            let i = bot.equip ? c.findIndex(x => x.kind === 'equip' && G.canTakeReward(x)) : -1;
            if (i < 0) i = c.findIndex(x => G.canTakeReward(x));
            G.pickBossReward(i);
        }
        if (bot.merge && thinkMerge-- <= 0 && (G.fieldFull() || G.monsters.length >= (bot.spend ? G.maxField() * 0.85 : 18))) {
            thinkMerge = 15; // 사람처럼 0.5초에 한 번만
            // 조합 제단(bot.altar): 만들 수 있는 히든이 있으면 먼저
            const al = bot.altar ? altarPick(G) : null;
            if (al && G.act({ kind: 'altar', list: al }).ok) s.altars = (s.altars || 0) + 1;
            else {
                const p = mergePair(G);
                if (p && G.merge({ monster: p.a }, { monster: p.b }).ok) s.merges++;
            }
        }
        if (bot.upgrade) {
            const cost = G.summonUpgradeCost();
            if (cost !== null && G.gold >= cost && G.monsters.length >= 6 && G.upgradeSummon().ok) s.ups++;
        }
        // spend 봇은 사람처럼 소환 강화 값을 먼저 모은다(몬스터가 8마리 넘으면)
        const saving = bot.spend && G.summonUpgradeCost() !== null && G.monsters.length >= G.maxField() * 0.85;
        if (bot.summon && !saving && !G.fieldFull() && G.gold >= G.summonCost() && G.summon().ok) s.summons++;
        if (bot.equip && G.equipBag.length) {
            const m = G.monsters.filter(x => !x.equip && !x.removed).sort((a, b) => GRADE_ORDER.indexOf(MONSTERS[b.type].grade) - GRADE_ORDER.indexOf(MONSTERS[a.type].grade))[0];
            if (m) G.equipMonster(m, 0);
        }
        // 권능: 정한 갈래(bot.branch)에서 찍을 수 있는 가장 낮은 겹부터. 3번째 스킬은 준비되면 바로
        if (bot.powers && G.mana > 0) {
            const br = G.lordPowers()[bot.branch || 0];
            const node = br && br.tiers.flat().find(n => G.powerCheck(n.id).ok);
            if (node) G.act({ kind: 'power', id: node.id });
        }
        // 남는 골드 쓰기(bot.spend): 맵이 차면 칸 넓히기, 높은 등급부터 랭크 돌리기(S 이상이면 멈춤), 종족 강화, 마력 사기와 각성
        if (bot.spend && G.inPlay() && !G.bossReward && spendThink-- <= 0) {
            spendThink = 15;
            if (G.awakenCheck().ok) G.act({ kind: 'awaken' });
            if (G.fieldFull() && G.summonUpgradeCost() === null && !mergePair(G)) { // 강화를 다 올리고 합칠 짝도 없을 때만
                const fc = G.fieldCost();
                const ms = G.monsters.filter(m => !m.removed && !m.clone);
                const roll = ms.filter(m => (m.rank || 0) < rankIndex('S') && G.rankRollCost(m) !== null)
                    .sort((a, b) => GRADE_ORDER.indexOf(MONSTERS[b.type].grade) - GRADE_ORDER.indexOf(MONSTERS[a.type].grade))[0];
                const fams = {};
                for (const m of ms) fams[MONSTERS[m.type].family] = (fams[MONSTERS[m.type].family] || 0) + GRADE_ORDER.indexOf(MONSTERS[m.type].grade) + 1;
                const fam = Object.keys(fams).sort((a, b) => fams[b] - fams[a])[0];
                // 싼 것부터: 칸, 높은 등급 랭크(A 미만), 종족 강화. 차례로 돌아가며 쓴다
                const opts = [];
                if (fc !== null) opts.push([fc, { kind: 'buyField' }]);
                if (roll && (roll.rank || 0) < rankIndex('A')) opts.push([G.rankRollCost(roll), { kind: 'rollRank', monster: roll }]);
                if (fam) opts.push([familyUpgradeCost(G.familyLevel(fam)), { kind: 'familyUp', family: fam }]);
                opts.sort((x, y) => x[0] - y[0]);
                if (opts.length && G.gold >= opts[0][0]) G.act(opts[0][1]);
                else if (G.lordPowers().length && !G.powerReady() && G.gold >= G.manaCost() * 2) G.act({ kind: 'buyMana' });
            }
        }
        // 저주 라운드(bot.curse): 나오면 늘 받아들인다
        if (bot.curse && G.curseRound() && !G.curseAccept[G.curseRound()]) G.act({ kind: 'curse', accept: true });
        // 발동형 유물(학살의 종, 영혼 수확 낫): 채워지면 바로
        if (bot.skill && G.state === 'wave') for (const id of G.relics) if (relicCharge(id) >= 1) G.act({ kind: 'relicFire', id });
        // 마왕 스킬: 3번째 스킬(E)은 준비되면 바로. 스킬 1(Q)·2(W)는 맨 앞 용사가 길의 60%를 넘어오면(조준 스킬은 그 용사 자리에)
        const third = G.thirdSkill();
        if (bot.skill && third && G.state === 'wave' && G.skills[third.key] <= 0) G.act({ kind: third.key });
        if (bot.skill && G.state === 'wave') {
            const h = G.heroes.filter(x => !x.waiting && !x.dead).sort((a, b) => remainingDistance(a) - remainingDistance(b))[0];
            if (h && remainingDistance(h) < ROUTES.north.length * 0.6) {
                const p = heroWorld(h);
                for (const key of G.lordSkills()) {
                    if (G.skills[key] > 0 || G.skillLocked(key)) continue;
                    if (key === 'bribe' && (!bribeTarget() || bribeCost(bribeTarget()) > G.gold * 0.25)) continue; // 매수는 골드의 1/4 이하일 때만
                    G.act({ kind: key, x: p.x, y: p.y });
                }
            }
        }
        for (const m of G.monsters) {
            const g = GRADE_ORDER.indexOf(MONSTERS[m.type].grade);
            if (g > s.top) s.top = g;
            if (g >= 3 && !s.legendWave) s.legendWave = G.waveIndex + 1;
        }
        const before = G.gold;
        G.update(DT);
        if (G.gold > before) s.earned = (s.earned || 0) + G.gold - before;
        // 골드 흐름 기록(bot.trace): 10라운드마다 번 골드, 남은 골드, 소환 비용, 맵 몬스터 수
        if (bot.trace && G.waveIndex + 1 !== s.lastRound) {
            s.lastRound = G.waveIndex + 1;
            if (s.lastRound % (bot.every || 10) === 0) TRACE.push({ hp: Math.round(G.hp), maxHp: G.maxHp(), myth: G.monsters.filter(m => MONSTERS[m.type].grade === 'mythic').length, leg: G.monsters.filter(m => MONSTERS[m.type].grade === 'legendary').length,  round: s.lastRound, earned: Math.round(s.earned || 0), gold: Math.round(G.gold), cost: G.summonCost(), n: G.monsters.length, level: G.summonLevel + 1, top: GRADE_ORDER[s.top], field: G.maxField(), fam: Object.values(G.familyLevels).reduce((a, b) => a + b, 0), awaken: G.awaken, ranks: G.monsters.filter(m => (m.rank || 0) >= 4).length });
        }
    }
    return { tier: G.raidTier, score: G.score, win: G.state === 'victory', wave: Math.min(G.waveIndex + 1, G.waves.length), total: G.waves.length, hp: G.hp, time: G.stats.time, kills: G.stats.kills, gold: G.gold,
        n: G.monsters.length, summons: s.summons, merges: s.merges, altars: s.altars || 0, topGrade: GRADE_ORDER[s.top], ups: s.ups, top: s.top, legendWave: s.legendWave };
}
`, context);

const BOTS = {
    '아무것도 안 함': '{}',
    '소환만': '{summon:true}',
    '소환+합치기': '{summon:true,merge:true}',
    '합치기+강화+장비+번개': '{summon:true,merge:true,upgrade:true,equip:true,skill:true}' // 번개: 마왕 스킬(이름은 예전 그대로)
};
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const R = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const N = +process.argv[2] || 5;
const only = process.argv[3];
const GRADES = vm.runInContext('GRADE_ORDER', context);
function batch(name, bot, stage) {
    const rs = [];
    for (let i = 0; i < N; i++) rs.push(JSON.parse(vm.runInContext(`JSON.stringify(play(${bot}, ${stage ? `'${stage}'` : 'null'}))`, context)));
    const count = {};
    for (const r of rs) count[GRADES[r.top]] = (count[GRADES[r.top]] || 0) + 1;
    console.log(`${name}${stage ? ' ' + stage : ''} | 승 ${rs.filter(r => r.win).length}/${N} | 라운드 ${R(avg(rs.map(r => r.wave)))}/${rs[0].total} (최소 ${Math.min(...rs.map(r => r.wave))}) | 체력 ${R(avg(rs.map(r => r.hp)))} | ${R(avg(rs.map(r => r.time)) / 60)}분 | 소환 ${R(avg(rs.map(r => r.summons)), 0)} 합치기 ${R(avg(rs.map(r => r.merges)), 0)} 강화 ${R(avg(rs.map(r => r.ups)))} | 최고 ${JSON.stringify(count)} 전설첫 ${R(avg(rs.filter(r => r.legendWave).map(r => r.legendWave)))} | 남은골드 ${R(avg(rs.map(r => r.gold)), 0)} 맵 ${R(avg(rs.map(r => r.n)), 0)}`);
}
for (const k of Object.keys(BOTS)) if (!only || k.includes(only)) batch(k, BOTS[k]);
if (!only) for (const st of ['s1', 's3', 's6']) batch('합치기+강화+장비+번개', BOTS['합치기+강화+장비+번개'], st);
if (process.argv[4] === 'daily') {
    for (const d of ['2026-11-07', '2026-11-08', '2026-11-09']) {
        const r = JSON.parse(vm.runInContext(`JSON.stringify(play(${BOTS['합치기+강화+장비+번개']}, null, '${d}'))`, context));
        console.log(`일일 ${d} | 라운드 ${r.wave} | ${R(r.time / 60)}분 | 점수 ${r.score.toLocaleString()} | 소환 ${r.summons} 합치기 ${r.merges} | 최고 ${GRADES[r.top]} 전설첫 ${r.legendWave}`);
    }
}
if (process.argv[4] === 'abyss') {
    for (const d of ['abyss1', 'abyss2', 'abyss3']) {
        const r = JSON.parse(vm.runInContext(`JSON.stringify(play(${BOTS['합치기+강화+장비+번개']}, null, '${d}'))`, context));
        console.log(`심연 ${d} | ${r.wave}층 | ${R(r.time / 60)}분 | 점수 ${r.score.toLocaleString()} | 소환 ${r.summons} 합치기 ${r.merges} | 최고 ${GRADES[r.top]}`);
    }
}
// 마왕 비교: 마왕 x 갈래마다 심연을 같은 시드로(난이도는 5번째 값, 기본 노말). CURSE=1이면 저주 라운드를 늘 받아들인다
if (process.argv[4] === 'lords') {
    vm.runInContext('Meta.data.cleared = STAGES.map(s => s.id)', context);
    const level = process.argv[5] === undefined ? vm.runInContext('DEFAULT_ABYSS_LEVEL', context) : +process.argv[5];
    // 6번째 값으로 마왕 하나만(쉼표로 여럿) 잴 수 있다: 여러 창에서 나눠 돌릴 때
    const lords = vm.runInContext('Object.keys(DEMON_LORDS)', context).filter(id => !process.argv[6] || process.argv[6].split(',').includes(id));
    for (const lord of lords) {
        for (let b = 0; b < 3; b++) {
            const rs = [];
            for (let i = 1; i <= N; i++) rs.push(JSON.parse(vm.runInContext(`JSON.stringify(play({summon:true,merge:true,upgrade:true,equip:true,skill:true,powers:true,spend:true,altar:true,branch:${b},lord:'${lord}',level:${level},curse:${process.env.CURSE ? 'true' : 'false'}}, null, 'abyss${i}'))`, context)));
            const br = vm.runInContext(`LORD_POWERS['${lord}'][${b}].name`, context);
            console.log(`${lord} ${br} | 층 ${R(avg(rs.map(r => r.wave)))} (${rs.map(r => r.wave).join(',')}) | ${R(avg(rs.map(r => r.time)) / 60)}분 | 제단 ${R(avg(rs.map(r => r.altars)))} | 최고 ${rs.map(r => r.topGrade).join(',')}`);
        }
    }
}
// 유물 비교: 마왕 하나(기본 뼈의 여왕, 첫 갈래)에 유물 하나씩 들려 심연을 같은 시드로. 5번째 값 난이도, 6번째 유물(쉼표, 없으면 전부, '없음'은 유물 없이)
if (process.argv[4] === 'relics') {
    vm.runInContext('Meta.data.cleared = STAGES.map(s => s.id)', context);
    const level = process.argv[5] === undefined ? vm.runInContext('DEFAULT_ABYSS_LEVEL', context) : +process.argv[5];
    const lord = process.argv[7] || 'bone_queen';
    const ids = process.argv[6] ? process.argv[6].split(',') : vm.runInContext('Object.keys(RELICS)', context);
    for (const id of ids) {
        const relics = id === '없음' ? '[]' : `['${id}']`;
        const rs = [];
        for (let i = 1; i <= N; i++) rs.push(JSON.parse(vm.runInContext(`JSON.stringify(play({summon:true,merge:true,upgrade:true,equip:true,skill:true,powers:true,branch:0,lord:'${lord}',level:${level},relics:${relics}}, null, 'abyss${i}'))`, context)));
        const name = id === '없음' ? '없음' : vm.runInContext(`RELICS['${id}'].name`, context);
        console.log(`${id} ${name} | 층 ${R(avg(rs.map(r => r.wave)))} (${rs.map(r => r.wave).join(',')})`);
    }
}
// 골드 흐름: 노말 심연을 한 판 돌며 10라운드마다 번 골드와 남은 골드(봇은 남는 골드를 쓰지 못한다)
if (process.argv[4] === 'economy') {
    vm.runInContext('Meta.data.cleared = STAGES.map(s => s.id)', context);
    const level = process.argv[5] === undefined ? vm.runInContext('DEFAULT_ABYSS_LEVEL', context) : +process.argv[5];
    for (let i = 1; i <= N; i++) {
        vm.runInContext('TRACE.length = 0', context);
        const r = JSON.parse(vm.runInContext(`JSON.stringify(play({summon:true,merge:true,upgrade:true,equip:true,skill:true,powers:true,spend:true,altar:true,branch:${+(process.env.BRANCH || 0)},lord:'${process.env.LORD || 'bone_queen'}',level:${level},trace:true,every:${+(process.env.EVERY || 10)}}, null, 'abyss${i}'))`, context));
        console.log(`시드 ${i}: ${r.wave}층에서 끝`);
        for (const t of JSON.parse(vm.runInContext('JSON.stringify(TRACE)', context))) console.log(`  ${t.round}라운드 | 체력 ${t.hp}/${t.maxHp} | 신화 ${t.myth} 전설 ${t.leg} | 번 골드 ${t.earned} | 남은 ${t.gold} | 소환 ${t.cost}G | 맵 ${t.n}/${t.field}마리 | 소환 강화 ${t.level} | 최고 ${t.top} | 종족 Lv합 ${t.fam} | 각성 ${t.awaken} | S이상 ${t.ranks}`);
    }
}
if (process.argv[4] === 'raid') {
    for (const d of ['raid1', 'raid2', 'raid3', 'raid4']) {
        const r = JSON.parse(vm.runInContext(`JSON.stringify(play(${BOTS['합치기+강화+장비+번개']}, null, '${d}'))`, context));
        const boss = vm.runInContext(`BOSSES[raidChallenge('${d}').boss].name`, context);
        console.log(`토벌 ${d} ${boss} | ${r.tier}단계 | ${r.wave}라운드 | ${R(r.time / 60)}분 | 점수 ${r.score.toLocaleString()} | 최고 ${GRADES[r.top]}`);
    }
}
