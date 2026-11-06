// 메인 스토리: 장(STORY_CHAPTERS)과 스테이지(STAGES). 스테이지를 처음 깨면 마왕, 유물, 유물 칸이 풀린다.
// 코드는 스테이지 id로 분기하지 않고 이 표만 읽는다. 수치(체력 배율, 시작 골드 보너스)는 플레이 후 고칠 초안이다.
// 설계: docs/MONSTER_DESIGN.md의 "메인 스토리"
//
// 스테이지 항목
//   id, no(지도 도장 번호), chapter(STORY_CHAPTERS의 id), name
//   waves: 이번 스테이지에 쓸 WAVES의 인덱스 목록(순서대로). 웨이브의 나머지 값은 WAVES 그대로다
//   noBoss: true면 고른 웨이브의 보스 칸을 모두 비운다("보스 없는 표")
//   boss: 있으면 마지막 웨이브의 보스 칸을 이 보스(BOSSES 열쇠)로 덮어쓴다
//   hpMul: 용사(보스 포함) 체력 배율, goldBonus: 시작 골드에 더한다
//   map: 스토리 지도의 도장 자리 [x, y](화면 좌표)
//   intro, outro: 시작 전 대화와 승리 대화. [말하는 사람(STORY_CAST 열쇠), 대사]
//   unlocks: 처음 깰 때 풀리는 것. { kind: 'lord', id } | { kind: 'relic', id } | { kind: 'slot' } | { kind: 'ending' }
// 균열의 군주(DEFAULT_LORD)는 처음부터 쓴다. 유물 칸은 0개로 시작한다.

const STORY_CHAPTERS = [
    { id: 1, name: '1장 집들이', sub: '분양받은 던전에 손님이 몰려온다' },
    { id: 2, name: '2장 빚쟁이', sub: '분양 대금을 받으러 온 마왕' },
    { id: 3, name: '3장 용사단 본대', sub: '드디어 본대가 온다' }
];

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

const STAGES = [
    {
        id: 's1', no: 1, chapter: 1, name: '첫 손님', waves: [0, 1, 2], hpMul: 0.6, goldBonus: 0, map: [210, 330],
        intro: [
            ['goblin', '군주님! 입주 첫날부터 손님이 왔습니다.'],
            ['rift', '손님? 집들이 초대장은 안 돌렸는데.'],
            ['warrior', '던전 새로 열렸다며? 보물 있지? 있다고 해 줘!'],
            ['goblin', '제가 문패를 너무 크게 달았나 봅니다...'],
            ['rift', '좋아. 첫 손님은 번개로 환영한다.']
        ],
        outro: [
            ['goblin', '다 쫓아냈습니다! 그런데 짐 정리는 언제 하죠?'],
            ['rift', '선물이라도 남기고 갔나 보군. 저 주머니는 뭐야?'],
            ['goblin', '용사 지갑입니다. 이제 저희 겁니다. 유물 칸도 하나 짜 뒀어요.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'pouch' }]
    },
    {
        id: 's2', no: 2, chapter: 1, name: '마을 자경단', waves: [0, 1, 2, 3], hpMul: 0.64, goldBonus: 0, map: [380, 470],
        intro: [
            ['goblin', '이번엔 마을 자경단입니다. 쇠스랑을 들고 왔어요.'],
            ['warrior', '밤마다 지하에서 번쩍번쩍! 잠을 못 자겠다!'],
            ['rift', '그건 내 번개가 아니라 너희 마을 가로등이다.'],
            ['goblin', '군주님, 일단 싸우시죠. 해명은 나중에.']
        ],
        outro: [
            ['warrior', '다음엔 이장님 모시고 온다!'],
            ['goblin', '창고에서 뿔이랑 심장이 나왔습니다. 전 주인 물건 같아요.'],
            ['rift', '분양 사무소가 청소를 안 했군. 쓰자.']
        ],
        unlocks: [{ kind: 'relic', id: 'horn' }, { kind: 'relic', id: 'heart' }]
    },
    {
        id: 's3', no: 3, chapter: 1, name: '도굴꾼 소동', waves: [1, 2, 3, 4, 5], hpMul: 0.67, goldBonus: 10, map: [230, 610],
        intro: [
            ['goblin', '도굴꾼입니다! 벽을 몰래 파고 있어요!'],
            ['rift', '남의 집 벽을? 그거 내 보증금이야.'],
            ['bone_queen', '(벽 너머) 거기 시끄러워! 뼈 울린다고!'],
            ['goblin', '...방금 벽이 말했습니까?'],
            ['rift', '못 들은 걸로 하자. 도굴꾼부터.']
        ],
        outro: [
            ['goblin', '도굴꾼들이 성배랑 주사위를 흘리고 갔습니다.'],
            ['bone_queen', '(벽 너머) 그 주사위 내 거야! ...아니, 아무것도 아니야.'],
            ['rift', '옆방이 있다는 얘긴 계약서에 없었는데.']
        ],
        unlocks: [{ kind: 'relic', id: 'chalice' }, { kind: 'relic', id: 'dice' }]
    },
    {
        id: 's4', no: 4, chapter: 1, name: '건너편 세입자', waves: [2, 3, 4, 5, 6], boss: 'archmage', hpMul: 0.71, goldBonus: 20, map: [480, 660],
        intro: [
            ['bone_queen', '새로 들어온 집이 너야? 밤새 번개 치는 소리에 못 잤어!'],
            ['rift', '누구시죠? 이 층은 나 혼자 분양받았는데.'],
            ['bone_queen', '난 백 년째 여기 살았어. 계약서는... 묻혔지.'],
            ['goblin', '대마도사가 옵니다! 두 분 다 위험합니다!'],
            ['archmage', '불법 거주 마왕이 둘! 한 번에 신고 처리한다!'],
            ['bone_queen', '불법이라니! ...좋아, 이번만 같이 싸워 줄게.']
        ],
        outro: [
            ['archmage', '이 던전, 민원 넣을 거야!'],
            ['bone_queen', '쳇, 생각보다 쓸 만하네. 앞으로 같이 지내 줄게.'],
            ['rift', '월세는?'],
            ['bone_queen', '뼈로 낼게. 이 족쇄도 덤으로 줄게.']
        ],
        unlocks: [{ kind: 'lord', id: 'bone_queen' }, { kind: 'relic', id: 'shackles' }]
    },
    {
        id: 's5', no: 5, chapter: 2, name: '왕국 정찰대', waves: [2, 3, 4, 5, 6, 7], hpMul: 0.75, goldBonus: 20, map: [730, 430],
        intro: [
            ['gold_king', '실례합니다. 이 던전 분양 대금이 아직 안 들어왔는데요?'],
            ['rift', '...분양 사무소에서 오셨어요?'],
            ['gold_king', '내가 분양 사무소다. 원금에 이자 붙는 중이다.'],
            ['goblin', '그, 그 와중에 왕국 정찰대가 옵니다!'],
            ['gold_king', '채무자가 죽으면 곤란하지. 구경은 해 주마.']
        ],
        outro: [
            ['gold_king', '흠, 정찰대가 떨어뜨린 촛불과 석판이군. 감정가는...'],
            ['rift', '그거 내 전리품인데.'],
            ['gold_king', '일단 맡겨 두지. 이자는 붙는다.']
        ],
        unlocks: [{ kind: 'relic', id: 'candle' }, { kind: 'relic', id: 'tablet' }]
    },
    {
        id: 's6', no: 6, chapter: 2, name: '은빛 검 기사단', waves: [3, 4, 5, 6, 7, 8], hpMul: 0.78, goldBonus: 30, map: [900, 300],
        intro: [
            ['warrior', '은빛 검 기사단이다! 이 던전을 압류하러 왔다!'],
            ['gold_king', '압류? 이 던전은 내 담보다. 순서가 있지!'],
            ['goblin', '사장님, 그럼 같이 싸워 주시나요?'],
            ['gold_king', '아니. 나는 응원만 한다. 응원도 유료다.']
        ],
        outro: [
            ['goblin', '기사단이 북이랑 눈알을 두고 갔습니다. 눈알은 아직 깜빡여요.'],
            ['gold_king', '중고로 팔면 꽤 나오겠군.'],
            ['rift', '안 판다.']
        ],
        unlocks: [{ kind: 'relic', id: 'drum' }, { kind: 'relic', id: 'eye' }]
    },
    {
        id: 's7', no: 7, chapter: 2, name: '두 갈래 습격', waves: [2, 3, 4, 5, 6, 7, 8], hpMul: 0.82, goldBonus: 30, map: [1010, 520],
        intro: [
            ['goblin', '북쪽 문, 남쪽 문으로 동시에 옵니다! 문 하나만 달걸 그랬어요!'],
            ['rift', '문 두 개짜리를 고른 건 너잖아.'],
            ['goblin', '환기가 잘 된다고 해서...'],
            ['gold_king', '던전이 털리면 내 담보도 털린다. 잘 막아 봐.']
        ],
        outro: [
            ['gold_king', '잘했다. 유물 칸 하나 더 짜 주지. 이 해골 손은 계약금으로 쳐 주마.'],
            ['rift', '계약금은 내가 내는 거 아니었어?'],
            ['gold_king', '그러니까 네 손해지.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'handgem' }]
    },
    {
        id: 's8', no: 8, chapter: 2, name: '수금하러 왔다', waves: [3, 4, 5, 6, 7, 8, 9], noBoss: true, boss: 'archmage', hpMul: 0.85, goldBonus: 40, map: [1180, 660],
        intro: [
            ['archmage', '지난번 민원은 반려됐지만, 이번엔 직접 철거한다!'],
            ['gold_king', '잠깐. 이 던전이 철거되면 내 돈은 누가 갚지?'],
            ['archmage', '그건 내 알 바 아니다!'],
            ['gold_king', '알 바가 생기게 해 주지. 군주, 이번엔 나도 싸운다.'],
            ['bone_queen', '어머, 돈 냄새 나는 동료가 왔네.']
        ],
        outro: [
            ['archmage', '두 번째 민원도 반려라니...!'],
            ['gold_king', '좋아. 대금은 분할 상환해 주지. 대신 여기 살면서 수금하겠다.'],
            ['rift', '그 열쇠는 뭐야?'],
            ['gold_king', '네 금고 열쇠. 내가 들고 있을게. 이자는 붙는다.']
        ],
        unlocks: [{ kind: 'lord', id: 'gold_king' }, { kind: 'relic', id: 'key' }]
    },
    {
        id: 's9', no: 9, chapter: 3, name: '선봉대', waves: [2, 3, 4, 5, 6, 7, 8, 9], noBoss: true, hpMul: 0.89, goldBonus: 40, map: [1420, 620],
        intro: [
            ['goblin', '큰일입니다! 용사단 본대의 선봉대가 왔습니다!'],
            ['bone_queen', '본대? 그동안 온 건 다 연습 경기였어?'],
            ['gold_king', '판돈이 커졌군. 이자율도 올려야겠어.'],
            ['rift', '다 같이 막는다. 집들이는 이걸로 끝이다.']
        ],
        outro: [
            ['goblin', '선봉대가 모래시계와 깃발을 두고 도망쳤습니다!'],
            ['bone_queen', '깃발 꽂자. 이제 여긴 우리 집이야.'],
            ['gold_king', '깃발 값은 따로 받는다.']
        ],
        unlocks: [{ kind: 'relic', id: 'hourglass' }, { kind: 'relic', id: 'banner' }]
    },
    {
        id: 's10', no: 10, chapter: 3, name: '끝없는 행렬', waves: [1, 2, 3, 4, 5, 6, 7, 8, 9], noBoss: true, hpMul: 0.93, goldBonus: 50, map: [1530, 430],
        intro: [
            ['goblin', '줄이 끝이 안 보입니다. 맛집인 줄 아나 봐요.'],
            ['warrior', '여기가 그 평 좋은 던전 맞죠? 웨이팅 몇 분이에요?'],
            ['rift', '평? 누가 우리 던전 평을 써?'],
            ['bone_queen', '별점이 높으면 손님이 더 오잖아. 큰일이네.']
        ],
        outro: [
            ['goblin', '용사들이 번개 병을 떨어뜨렸습니다. 기념품인가 봐요.'],
            ['rift', '기념품까지 팔고 있었다고?'],
            ['gold_king', '...그 기념품 판매 수익, 나한테는 안 들어왔는데.']
        ],
        unlocks: [{ kind: 'relic', id: 'bottle' }]
    },
    {
        id: 's11', no: 11, chapter: 3, name: '왕좌 앞 전투', waves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], noBoss: true, boss: 'archmage', hpMul: 0.96, goldBonus: 60, map: [1700, 350],
        intro: [
            ['archmage', '세 번째 민원이다! 이번엔 부대장님 결재까지 받아 왔다!'],
            ['gold_king', '결재 서류는 몇 장이지? 장당 수수료가 있다.'],
            ['bone_queen', '왕좌 앞까지 오게 두지 마. 내가 청소한 바닥이야.'],
            ['rift', '모두 자리로. 왕좌는 내가 지킨다.']
        ],
        outro: [
            ['archmage', '부대장님... 제 민원은 실패했습니다...'],
            ['goblin', '거울이 나왔습니다! 금이 갔지만 잘 비칩니다.'],
            ['bone_queen', '내 얼굴 보여? 아, 뼈밖에 없지.'],
            ['gold_king', '유물 칸 하나 더 늘려 주지. 이번엔 서비스다. ...이자만 받는다.']
        ],
        unlocks: [{ kind: 'slot' }, { kind: 'relic', id: 'mirror' }]
    },
    {
        id: 's12', no: 12, chapter: 3, name: '부대장의 최후', waves: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], boss: 'fallen_knight', hpMul: 1.0, goldBonus: 60, map: [1740, 620],
        intro: [
            ['captain', '내가 용사단 부대장이다. 이 던전의 모든 것을 확인하러 왔다!'],
            ['rift', '확인? 압류야, 철거야?'],
            ['captain', '아니. 체험이다.'],
            ['goblin', '체험이요...?'],
            ['captain', '말은 필요 없다. 검으로 확인하겠다!']
        ],
        outro: [
            ['captain', '훌륭하다... 함정, 몬스터, 왕좌의 번개까지...'],
            ['captain', '사실 나는 던전 후기를 쓰러 왔다. 별 다섯 개. 집들이 맛집.'],
            ['rift', '...그래서 그렇게 줄을 섰던 거냐.'],
            ['gold_king', '후기 광고비는 따로 청구하겠다.'],
            ['bone_queen', '그런데 후기 마지막 줄이 뭐야? "2층도 기대됨"?'],
            ['goblin', '군주님... 우리 2층도 분양받았습니까?']
        ],
        unlocks: [{ kind: 'ending' }]
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

// 스테이지의 웨이브 목록: WAVES 항목을 복사해 noBoss면 보스 칸을 비우고, boss가 있으면 마지막 웨이브의 보스 칸을 덮어쓴다.
// level은 원래 WAVES 인덱스(용사 체력이 웨이브마다 오르는 계산에 쓴다)
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
