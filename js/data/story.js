// 메인 스토리: 스테이지(STAGES) 6개. 튜토리얼처럼 빠르게 끝나고, 게임의 중심은 본부의 도전의 문(js/ui/hq.js의 HQ_CONTENTS)이다.
// 스테이지를 처음 깨면 마왕, 유물, 유물 칸이 풀린다. 코드는 스테이지 id로 분기하지 않고 이 표만 읽는다.
// 수치(체력 배율, 시작 골드 보너스)는 플레이 후 고칠 초안이다. 설계: docs/MONSTER_DESIGN.md의 "메인 스토리"
//
// 스테이지 항목
//   id, no(지도 도장 번호), name, zone(맵 지역: js/data/map.js의 ZONES)
//   waves: 이번 스테이지에 쓸 WAVES의 인덱스 목록(순서대로, 겹쳐도 된다). 라운드의 나머지 값은 WAVES 그대로다
//   noBoss: true면 고른 라운드의 보스 칸을 모두 비운다("보스 없는 표")
//   boss: 있으면 마지막 라운드의 보스 칸을 이 보스(BOSSES 열쇠)로 덮어쓴다. 마지막 라운드의 보스는 보상 없이 승리로 끝난다
//   hpMul: 용사(보스 포함) 체력 배율, goldBonus: 시작 골드에 더한다
//   map: 스토리 지도의 도장 자리 [x, y](화면 좌표)
//   intro, outro: 시작 전 대화와 승리 대화(2~4줄). [말하는 사람(STORY_CAST 열쇠), 대사]
//   unlocks: 처음 깰 때 풀리는 것. { kind: 'lord', id } | { kind: 'relic', id } | { kind: 'slot' } | { kind: 'ending' }
// 균열의 군주(DEFAULT_LORD)는 처음부터 쓴다. 유물 칸은 0개로 시작한다.
// 예전 12스테이지 저장(옛 번호 N)은 Meta가 새 번호 ceil(N / 2)로 옮긴다(STORY_OLD_STAGES)

const STORY_TITLE = { name: '1부 집들이', sub: '분양받은 던전에 손님이 몰려온다' };

// 예전(12스테이지) 표의 스테이지 수. 옛 번호 N은 새 번호 ceil(N / 2)
const STORY_OLD_STAGES = 12;

// 대화에 나오는 인물: 이름표와 초상(그림에서 [x, y, 크기]를 잘라 쓴다. 마왕은 DEMON_LORDS의 초상)
const STORY_CAST = {
    rift: { name: '균열의 군주', lord: 'rift' },
    bone_queen: { name: '뼈의 여왕', lord: 'bone_queen' },
    gold_king: { name: '황금 마왕', lord: 'gold_king' },
    goblin: { name: '고블린 창병 꼬챙이', portrait: { sprite: 'pl_mon_goblin_spearman/rotations/south', crop: [12, 4, 24] } },
    warrior: { name: '견습 용사 덕수', portrait: { sprite: 'pl_hero_warrior/rotations/south', crop: [13, 3, 22] } },
    archmage: { name: '대마도사 몽글', portrait: { sprite: 'pl_boss_grand_wizard/rotations/south', crop: [31, 18, 28] } },
    captain: { name: '부대장 그라벨', portrait: { sprite: 'pl_boss_captain/rotations/south', crop: [31, 8, 28] } }
};

// 장 N은 1라운드부터 N*10라운드까지 한 판이다
function firstRounds(n) { return Array.from({ length: n }, (_, i) => i); }

const STAGES = [
    {
        id: 's1', no: 1, name: '첫 손님', zone: 'moonGarden', waves: firstRounds(10), hpMul: 0.5, goldBonus: 0, map: [260, 610],
        intro: [
            ['goblin', '군주님! 입주 첫날부터 용사 손님입니다. 소환(S)하면 길 옆에 부하가 나와요.'],
            ['rift', '같은 등급 둘을 겹치면 더 센 놈이 된다고? 좋아, 합쳐서 막는다.'],
            ['goblin', '급하면 마왕 탭의 번개(Q)! 체력이 낮으면 호통(W)입니다.']
        ],
        outro: [
            ['goblin', '다 쫓아냈습니다! 용사 지갑이랑 뿔, 심장을 주웠어요.'],
            ['rift', '스테이지를 처음 깰 때마다 이런 게 풀리는군. 유물 칸도 하나 짜 둬.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'greedy_vault' }, { kind: 'relic', id: 'legion_banner' }, { kind: 'relic', id: 'glass_heart' }]
    },
    {
        id: 's2', no: 2, name: '도굴꾼 소동', zone: 'coast', waves: firstRounds(20), hpMul: 0.6, goldBonus: 10, map: [560, 380],
        intro: [
            ['goblin', '도굴꾼입니다! 벽을 몰래 파고 있어요!'],
            ['bone_queen', '(벽 너머) 거기 시끄러워! 뼈 울린다고!'],
            ['rift', '...방금 벽이 말했나? 도굴꾼부터 막자.']
        ],
        outro: [
            ['goblin', '성배, 주사위, 촛불, 석판을 흘리고 갔습니다.'],
            ['bone_queen', '(벽 너머) 그 주사위 내 거야! ...아니, 아무것도 아니야.']
        ],
        unlocks: [{ kind: 'relic', id: 'usury_ledger' }, { kind: 'relic', id: 'mad_dice' }, { kind: 'relic', id: 'dead_horn' }, { kind: 'relic', id: 'sniper_mark' }]
    },
    {
        id: 's3', no: 3, name: '건너편 세입자', zone: 'frost', waves: firstRounds(30), hpMul: 0.7, goldBonus: 20, map: [840, 610],
        intro: [
            ['bone_queen', '난 백 년째 옆방에 살았어. 계약서는... 묻혔지.'],
            ['archmage', '불법 거주 마왕이 둘! 한 번에 신고 처리한다!'],
            ['bone_queen', '불법이라니! ...좋아, 이번만 같이 싸워 줄게.']
        ],
        outro: [
            ['bone_queen', '생각보다 쓸 만하네. 앞으로 같이 지내 줄게.'],
            ['rift', '월세는?'],
            ['bone_queen', '뼈로 낼게. 족쇄랑 북, 눈알도 덤이야.']
        ],
        unlocks: [{ kind: 'lord', id: 'bone_queen' }, { kind: 'relic', id: 'iron_oath' }, { kind: 'relic', id: 'blood_altar' }, { kind: 'relic', id: 'broken_hourglass' }]
    },
    {
        id: 's4', no: 4, name: '왕국 정찰대', zone: 'skySea', waves: firstRounds(40), hpMul: 0.8, goldBonus: 20, map: [1110, 380],
        intro: [
            ['gold_king', '실례합니다. 이 던전 분양 대금이 아직 안 들어왔는데요?'],
            ['goblin', '그, 그 와중에 왕국 정찰대가 옵니다!'],
            ['gold_king', '채무자가 죽으면 곤란하지. 구경은 해 주마.']
        ],
        outro: [
            ['gold_king', '잘했다. 유물 칸 하나 더 짜 주지. 이 해골 손, 모래시계, 열쇠는 담보로 맡겨 두마.'],
            ['rift', '그거 내 전리품인데.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'storm_bottle' }, { kind: 'relic', id: 'mad_drum' }, { kind: 'relic', id: 'smith_hammer' }]
    },
    {
        id: 's5', no: 5, name: '수금하러 왔다', zone: 'sunForge', waves: firstRounds(50), hpMul: 0.9, goldBonus: 40, map: [1390, 610],
        intro: [
            ['archmage', '지난번 민원은 반려됐지만, 이번엔 직접 철거한다!'],
            ['gold_king', '이 던전이 철거되면 내 돈은 누가 갚지? 군주, 이번엔 나도 싸운다.'],
            ['bone_queen', '어머, 돈 냄새 나는 동료가 왔네.']
        ],
        outro: [
            ['gold_king', '대금은 분할 상환해 주지. 대신 여기 살면서 수금하겠다.'],
            ['goblin', '깃발이랑 번개 병도 두고 가셨어요. ...이자는 붙는대요.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'lord', id: 'gold_king' }, { kind: 'relic', id: 'equip_eater' }, { kind: 'relic', id: 'mirror_twin' }, { kind: 'relic', id: 'lone_crown' }]
    },
    {
        id: 's6', no: 6, name: '부대장의 최후', zone: 'warTemple', waves: firstRounds(60), hpMul: 1, goldBonus: 60, map: [1640, 380],
        intro: [
            ['captain', '내가 용사단 부대장이다. 이 던전의 모든 것을 확인하러 왔다!'],
            ['rift', '확인? 압류야, 철거야?'],
            ['captain', '아니. 체험이다. 검으로 확인하겠다!']
        ],
        outro: [
            ['captain', '훌륭하다... 사실 나는 던전 후기를 쓰러 왔다. 별 다섯 개.'],
            ['gold_king', '후기 광고비는 따로 청구하겠다. 거울은 서비스, 유물 칸도 하나 더.'],
            ['bone_queen', '후기 마지막 줄이 뭐야? "도전의 문 너머가 진짜 맛집"?'],
            ['goblin', '사장님, 이제 본부의 도전의 문이 진짜 장사예요!']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'pauper_helm' }, { kind: 'relic', id: 'blood_contract' }, { kind: 'relic', id: 'shaky_bridge' }, { kind: 'ending' }]
    }
];

// 표에 있는 스테이지 id인지
function hasStage(id) { return typeof id === 'string' && STAGES.some(s => s.id === id); }

function stageDef(id) { return STAGES.find(s => s.id === id) || null; }

// 다음 스테이지(마지막이면 null)
function nextStage(id) {
    const i = STAGES.findIndex(s => s.id === id);
    return i >= 0 && i + 1 < STAGES.length ? STAGES[i + 1] : null;
}

// 스테이지의 라운드 목록: WAVES 항목을 복사해 noBoss면 보스 칸을 비우고, boss가 있으면 마지막 라운드의 보스 칸을 덮어쓴다.
// level은 원래 WAVES 인덱스(용사 체력이 라운드마다 오르는 계산에 쓴다)
function stageWaves(stage) {
    return stage.waves.map((index, i) => {
        const w = Object.assign({}, WAVES[index], { level: index });
        if (stage.noBoss) delete w.boss;
        if (stage.boss && i === stage.waves.length - 1) w.boss = stage.boss;
        return w;
    });
}

// 대화 인물의 초상(마왕은 DEMON_LORDS의 초상)
function castPortrait(key) {
    const c = STORY_CAST[key];
    if (!c) return null;
    return c.lord ? DEMON_LORDS[c.lord].portrait : c.portrait;
}

// 해금 항목이 처음 풀리는 스테이지. slot은 n번째(1부터) 칸. 없으면(처음부터 쓰거나 모르는 것) null
function unlockStage(kind, id) {
    let slots = 0;
    for (const s of STAGES) {
        for (const u of s.unlocks) {
            if (u.kind !== kind) continue;
            if (kind === 'slot' ? ++slots === id : u.id === id) return s;
        }
    }
    return null;
}
