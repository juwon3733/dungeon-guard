// 화면 자동 캡처: 헤드리스 브라우저로 게임을 1920x1080에서 열고 정해 둔 장면을 captures/에 PNG로 저장한다.
// 실행: node tools/capture.js            (모든 장면)
//       node tools/capture.js combat     (장면 하나만, 여러 개는 공백으로 나열)
// 브라우저: 이 PC의 Edge를 먼저 쓰고 없으면 Chrome을 쓴다. CAPTURE_CHANNEL=chrome 처럼 정할 수도 있다.
// 콘솔 오류나 불러오지 못한 그림이 있으면 목록을 출력하고 종료 코드 1로 끝난다.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'captures');
const VIEWPORT = { width: 1920, height: 1080 };
const FPS_SECONDS = 2;

// 장면마다 페이지 안에서 실행할 준비 함수. 게임 코드는 바꾸지 않고 전역 객체만 만진다.
// 각 함수는 페이지에서 실행되므로 바깥 변수를 쓰지 못한다.
const SCENES = {
    // 타이틀은 열린 그대로 찍는다
    title: { setup: () => {}, freeze: false },

    // 도감 조합식 마지막 쪽: 히든 신화 조합식은 본 재료만 드러난다
    recipeDex: {
        setup: () => {
            Meta.seeMonster('fire_imp');
            Meta.seeMonster('vampire');
            Meta.seeMonster('grave_keeper');
            UI.openCollection();
            UI.collection.tab = 'recipe';
            UI.collection.page = UI.collectionPages('recipe') - 1;
        }
    },

    // 재료가 모인 S랭크 전설의 정보 창(??? 합치기 버튼)
    hiddenRecipe: {
        setup: () => {
            startRun();
            const put = t => {
                const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); });
                const [c, r] = key.split(',').map(Number);
                return Game.place(t, c, r);
            };
            const lord = put('death_lord');
            setMonsterRank(lord, 4);
            put('vampire'); put('grave_keeper'); put('grave_keeper');
            Fx.reset();
            UI.selectedMonster = lord;
        }
    },

    // 히든 조합 발견 연출(4마리 재료)
    hiddenFound: {
        setup: () => {
            startRun();
            const put = t => {
                const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); });
                const [c, r] = key.split(',').map(Number);
                return Game.place(t, c, r);
            };
            const lord = put('phoenix_lord');
            setMonsterRank(lord, 4);
            put('flame_demon'); put('fire_imp'); put('fire_imp');
            Game.act({ kind: 'fullRecipe', monster: lord });
            advance(1.6);
        }
    },

    // 일반 용사 떼를 광역 몬스터가 터뜨리는 후반 전투(프레임 측정용)
    swarm: {
        setup: () => {
            startRun();
            for (const t of ['hell_general', 'phoenix_lord', 'archlich', 'flame_demon', 'chaos_mage', 'dark_mage', 'dark_mage', 'frost_witch', 'orc_guard', 'troll']) {
                const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); });
                if (key) { const [c, r] = key.split(',').map(Number); Game.place(t, c, r); }
            }
            Game.waveIndex = 55;
            Game.gold = 500;
            Game.startWave();
            Game.speed = 3;
            advance(5);
        },
        freeze: false
    },

    // 도전의 문: 오늘의 일일 도전 조건
    dailyPortal: {
        setup: () => {
            Game.state = 'hq';
            UI.hqView = 'portal';
        }
    },

    // 일일 도전 전투와 결과
    dailyPlay: {
        setup: () => {
            UI.startDaily();
            Game.gold = 3000;
            for (let i = 0; i < 12; i++) Game.act({ kind: 'summon' });
            Game.waveIndex = 41;
            Game.score = 482913650;
            UI.scoreShown = Game.score;
            Game.act({ kind: 'startWave' });
            advance(6);
        }
    },
    dailyResult: {
        setup: () => {
            UI.startDaily();
            Game.waveIndex = 87;
            Game.stats.kills = 4120;
            Game.score = 6284913650;
            Game.finish(false);
        }
    },

    // 신화와 전설 스킬이 쓰이는 전투(정보 창은 히든 신화)
    mythicSkills: {
        setup: () => {
            startRun();
            for (const t of ['god_king', 'abyss_dragon_king', 'frost_queen', 'hell_general', 'star_whale']) {
                const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); });
                if (key) { const [c, r] = key.split(',').map(Number); Game.place(t, c, r); }
            }
            Game.startWave();
            advance(9);
            const m = Game.monsters.find(x => x.type === 'god_king');
            UI.selectedMonster = m;
        }
    },

    // 칸 모양이 다른 몬스터를 큰 것부터 깐 맵(몬스터별 칸 크기와 Asteria 그림 확인)
    monsterCells: {
        setup: () => {
            startRun();
            const order = ['crystal_giant', 'hell_general', 'giant_king', 'phoenix_lord', 'earth_behemoth', 'orc_high_chief', 'death_lord', 'archlich', 'fallen_angel', 'element_sage',
                'vampire', 'ancient_treant', 'hydra_warrior', 'flame_demon', 'executioner', 'bone_knight', 'storm_archer', 'chaos_mage', 'bone_priest', 'saber_warrior', 'moon_priestess',
                'wraith_swordsman', 'fire_imp', 'zombie', 'frost_witch', 'orc_guard', 'skeleton_archer', 'minotaur', 'succubus', 'ogre_crusher', 'rock_spirit', 'eagle_hunter'];
            for (const t of order) {
                const key = [...BUILD_CELLS].find(k => { const [c, r] = k.split(',').map(Number); return Game.canPlace(t, c, r); });
                if (key) { const [c, r] = key.split(',').map(Number); Game.place(t, c, r); }
            }
            Fx.reset();
            advance(0.5);
        }
    },

    // 고르기 화면(스테이지 5까지 깸, 6번 앞): 마왕 3장(황금 마왕을 고름), 유물 격자(잠긴 유물은 자물쇠와 풀리는 스테이지 도장),
    // 고른 유물 2칸(마녀의 눈)과 잠긴 3번째 칸, 이번 판 효과. 잠긴 금 간 거울에 마우스를 올려 "스테이지 6에서 해금"을 띄운다
    select: {
        setup: () => {
            storyProgress(5);
            UI.openSelect('s6');
            pressButton('lord_gold_king');
            pressButton('relic_broken_hourglass');
            const b = UI.buttons.find(x => x.id === 'relic_pauper_helm');
            UI.onMove(b.x + 20, b.y + 20);
        }
    },

    // 뼈의 여왕으로 시작한 판: 왕좌의 여왕 그림, 체력 막대(최대 17), 마왕 탭의 초상(호통)과 유물 칸(푸른 족쇄, 마우스를 올려 설명)
    lordQueen: {
        setup: () => {
            unlockAll();
            UI.openSelect(null);
            pressButton('lord_bone_queen');
            pressButton('relic_iron_oath');
            pressButton('begin');
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            advance(1.6);
            Fx.reset();
            Game.hp = 9; // 호통을 쓸 수 있는 체력
            pressButton('tab_demon');
            Fx.say(tileX(THRONE_TILE.col), tileY(THRONE_TILE.row) - LORD_SAY_Y, DEMON_LORDS.bone_queen.speech.waveStart[0], 30);
            UI.update(0);
            const b = UI.buttons.find(x => x.id === 'barRelic0');
            UI.onMove(b.x + 20, b.y + 20);
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 막 시작한 고르기 화면(스테이지 1만 깸, 2번 앞): 균열의 군주만 쓰고 잠긴 마왕은 "스테이지 N에서 해금", 유물은 황금 주머니만,
    // 유물 칸 1개와 잠긴 칸 둘(4, 6). 잠긴 모래시계에 마우스를 올려 설명을 띄운다
    selectLocked: {
        setup: () => {
            storyProgress(1);
            UI.openSelect('s2');
            pressButton('relic_greedy_vault');
            const b = UI.buttons.find(x => x.id === 'relic_mad_drum');
            UI.onMove(b.x + 20, b.y + 20);
        }
    },

    // 도감 몬스터 탭(본부 서재): 본 몬스터 4종은 그림과 이름, 등급, 역할, 능력. 나머지는 검은 실루엣과 ???
    collection: {
        setup: () => {
            Meta.data = Meta.sanitize({ version: META_VERSION, cleared: ['s1', 's2'], runs: 4, wins: 3, bestStage: 2,
                seen: ['orc_guard', 'skeleton_archer', 'dark_mage', 'orc_berserker', 'bone_knight'],
                recipes: ['orc_berserker+skeleton_archer', 'dark_mage+orc_guard'] });
            pressButton('start');
            pressButton('hq_bookshelf');
        }
    },

    // 본부(스테이지 2까지 깸): 벽과 나무 바닥, 붉은 카펫, 왕좌와 균열의 군주, 가운데 큰 도전의 문, 시설 6개와 이름표,
    // 새로 볼 것이 있는 시설의 밀랍 느낌표, 고블린 비서 말풍선. 스테이지 2를 깨 벽난로가 놓였다. 서재에 마우스를 올려 설명을 띄운다
    hq: {
        setup: () => {
            storyProgress(2);
            Meta.data.seen = ['orc_guard', 'dark_mage'];
            pressButton('start');
            UI.update(0);
            const b = UI.buttons.find(x => x.id === 'hq_bookshelf');
            UI.onMove(b.x + 100, b.y + 100);
        },
        afterFreeze: () => { Game.time = 0.3; }
    },

    // 보물 진열장(스테이지 3까지 깸): 균열의 군주와 뼈의 여왕은 초상과 효과, 황금 마왕은 그림자와 "스테이지 5에서 해금",
    // 유물 16종 중 풀린 11종은 효과, 나머지는 그림자와 풀리는 스테이지
    hqRelics: {
        setup: () => {
            storyProgress(3);
            pressButton('start');
            pressButton('hq_relic_case');
        }
    },

    // 무기고: 등급별 얻는 법과 장비 16종. 얻은 장비 5종은 그림, 이름, 효과. 나머지는 그림자와 ???
    hqArmory: {
        setup: () => {
            storyProgress(4);
            for (const id of ['sword', 'ring', 'axe', 'helmet', 'crown']) Meta.seeEquip(id);
            pressButton('start');
            pressButton('hq_weapon_rack');
        }
    },

    // 스토리 지도(스테이지 3까지 깸, 본부의 작전 테이블로): 깬 도장은 붉은 밀랍, 다음(4)은 밝게 숨쉬는 고리, 나머지는 자물쇠.
    // 아래 판에 4번의 웨이브 수와 처음 깰 때 보상(유물 칸, 해골 손, 모래시계, 열쇠)
    storyMap: {
        setup: () => {
            storyProgress(3);
            pressButton('start');
            pressButton('hq_wartable');
        },
        afterFreeze: () => { Game.time = 0.5; }
    },

    // 시작 전 대화(3번 건너편 세입자): 어두워진 맵 위 양피지 대화창, 뼈의 여왕 초상과 이름표, 한 글자씩 나오는 중인 대사
    dialogue: {
        setup: () => {
            storyProgress(2);
            UI.enterStage('s3');
        },
        afterFreeze: () => { UI.dialogue.index = 0; UI.dialogue.chars = 18; }
    },

    // 3번을 처음 깬 뒤 해금 카드: 뼈의 여왕(효과와 설명) 1/4
    unlockCard: {
        setup: () => {
            storyProgress(2);
            UI.enterStage('s3');
            UI.endDialogue();
            pressButton('begin');
            winStage();
            UI.endDialogue(); // 승리 대화를 넘기면 해금 카드
        }
    },

    // 스테이지 승리 결과 화면(3번을 처음 깸): 스테이지 이름, 처음 깸과 풀린 것(뼈의 여왕, 족쇄, 북, 눈), 다음 스테이지와 본부 버튼
    resultSouls: {
        setup: () => {
            storyProgress(2);
            Meta.data.runs = 5;
            UI.enterStage('s3');
            UI.endDialogue();
            pressButton('begin');
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            advance(1.6);
            Fx.reset();
            Game.stats.kills = 214;
            Game.stats.summoned = 31;
            Game.stats.merged = 12;
            Game.stats.time = 1043;
            winStage();
            UI.endDialogue();
            UI.unlockCards = null;
            UI.update(0);
        }
    },

    // 시작 버튼을 눌러 준비 단계로 들어간 첫 화면: 소환 버튼(현재 비용)과 맵 몬스터 수 0/24, 첫 안내 문구
    prep: {
        setup: () => { startRun(); },
        // 건설 칸 테두리는 Game.time으로 깜빡인다. 가장 밝은 순간(sin = 1)에 멈춘다
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 소환: 몬스터 넷을 맵에 소환한 뒤 다섯째로 영웅(해골 기사)이 길 옆 칸에 나오는 순간. 소환 버튼에 마우스를 올려 확률 설명을 띄운다
    summon: {
        setup: () => {
            startRun();
            Game.gold = 400;
            for (const r of [[0.1, 0.1, 0.2], [0.5, 0.5, 0.4], [0.1, 0.9, 0.3], [0.8, 0.9, 0.5]]) withRandom(r, () => pressButton('summon'));
            advance(1.5);
            withRandom([0.97, 0, 0.45], () => pressButton('summon'));
            advance(0.22);
            const b = UI.buttons.find(x => x.id === 'summon');
            UI.onMove(b.x + 40, b.y + 40);
            freezeScene();
        }
    },

    // 끌기: 맵의 암흑 마법사(3,5)를 빈 길 옆 칸 위로 끄는 중. 칸 표시, 반투명 그림, 사거리와
    // 합칠 수 있는 몬스터 배지(조합식은 결과 그림, 같은 등급은 ?)가 보인다
    drag: {
        setup: () => {
            setupBoard();
            dragHold(cellCenter(3, 5), cellCenter(9, 5));
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 끌어서 스켈레톤 궁수 위에 올린 순간: "합치기 → 저주 사수" 안내와 밝은 고리
    dragMerge: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(7, 4);
            dragHold(cellCenter(3, 5), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 합치기 직전: 두 몬스터가 하얗게 달아오르며 결과 자리로 빨려 드는 중
    mergeSuck: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(7, 4);
            dragDrop(cellCenter(3, 5), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(0.28);
            freezeScene();
        }
    },

    // 합치기 순간(희귀 결과, 맵): 빛이 터지고 저주 사수가 나온다
    merge: {
        setup: () => {
            setupBoard();
            const m = Game.monsterAt(7, 4);
            dragDrop(cellCenter(3, 5), [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(MERGE_REVEAL + 0.12);
            freezeScene();
        }
    },

    // 영웅 합치기(맵): 희귀 2마리(저주 사수 위에 오크 광전사)가 해골 기사가 되는 순간. 가장 화려한 등급 연출
    mergeEpic: {
        setup: () => {
            setupBoard();
            const b = Game.monsterAt(8, 2);
            dragDrop([b.x * WORLD_ZOOM, (b.y - 10) * WORLD_ZOOM], cellCenter(13, 5));
            advance(MERGE_REVEAL + 0.16);
            freezeScene();
        }
    },

    // 신화 등장(시험용 신화 항목. 신화 몬스터는 아직 표에 없다): 전설 3마리(대리치를 죽음의 군주 위에, 셋째 재료 지옥 대장군)가
    // 합쳐지는 순간. 붉은 무지개 빛 등급, 전설보다 큰 빛줄기와 이름
    mythic: {
        setup: () => {
            MONSTERS.test_mythic = Object.assign({}, MONSTERS.death_lord, { id: 'test_mythic', name: '시험 신화', grade: 'mythic' });
            startRun();
            Game.place('death_lord', 7, 4);
            Game.place('archlich', 3, 5);
            Game.place('hell_general', 8, 2);
            advance(1.6);
            Fx.reset();
            const a = Game.monsterAt(3, 5);
            const b = Game.monsterAt(7, 4);
            dragDrop([a.x * WORLD_ZOOM, (a.y - 10) * WORLD_ZOOM], [b.x * WORLD_ZOOM, (b.y - 10) * WORLD_ZOOM]);
            if (!Game.monsters.some(m => m.type === 'test_mythic')) throw new Error('신화가 만들어지지 않았습니다');
            advance(MERGE_REVEAL + 0.7);
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 히든 조합 발견: 오크 광전사 + 스켈레톤 궁수 = 해골 기사
    hidden: {
        setup: () => {
            setupBoard();
            const b = Game.monsterAt(8, 2);
            const m = Game.monsterAt(7, 4);
            dragDrop([b.x * WORLD_ZOOM, (b.y - 10) * WORLD_ZOOM], [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            advance(MERGE_REVEAL + 0.7);
            freezeScene();
        }
    },

    // 제물: 오크 광전사를 왕좌에 바친 직후(마왕이 금빛으로 빛나고 회복 숫자, 대사, 체력 막대가 차오름)에
    // 저주 사수를 왕좌 위로 끌어 올린 순간. 왕좌의 제물 고리와 "제물: 체력 +2, 번개 -5초" 미리보기가 보인다
    sacrifice: {
        setup: () => {
            setupBoard();
            Game.hp = 12;
            Game.skills.lightning = 20;
            advance(0.1);
            const throne = [tileX(THRONE_TILE.col) * WORLD_ZOOM, (tileY(THRONE_TILE.row) - 40) * WORLD_ZOOM];
            const b = Game.monsterAt(8, 2);
            dragDrop([b.x * WORLD_ZOOM, (b.y - 10) * WORLD_ZOOM], throne);
            advance(MERGE_REVEAL + 0.25);
            const s = Game.monsterAt(13, 5);
            dragHold([s.x * WORLD_ZOOM, (s.y - 10) * WORLD_ZOOM], [throne[0] - 20, throne[1] + 10]);
            freezeScene();
        }
    },

    // 맵의 암흑 마법사를 누른 정보 팝업: 이름, 등급, 역할, 수치, 함께 합칠 수 있는 몬스터, 판매
    popup: {
        setup: () => {
            setupBoard();
            const c = cellCenter(3, 5);
            UI.onMove(c[0], c[1]);
            UI.onDown(c[0], c[1]);
            UI.onUp(c[0], c[1]);
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 맵 몬스터(해골 기사, 영웅)를 누른 정보 팝업. 최고 등급 안내
    popupField: {
        setup: () => {
            setupBoard();
            const [c, r] = [[12, 7], [11, 6], [9, 6], [7, 5]].find(([x, y]) => Game.canPlace('bone_knight', x, y));
            const m = Game.place('bone_knight', c, r);
            advance(1.5);
            // 길로 걸어 나간 해골 기사를 누른다(놓은 칸이 아니라 서 있는 곳)
            const p = [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM];
            UI.onMove(p[0], p[1]);
            UI.onDown(p[0], p[1]);
            UI.onUp(p[0], p[1]);
            if (UI.selectedMonster !== m) throw new Error('해골 기사를 고르지 못했습니다');
            freezeScene();
        }
    },

    // 몬스터 20마리 넘게 소환해 맵에 깔고(22/24) 7번째 웨이브를 붙인 장면. 용사와 체력바가 몬스터 사이에서 보이는지 본다
    crowded: {
        setup: () => {
            startRun();
            Game.gold = 5000;
            seededRandom(7, () => { for (let i = 0; i < 22; i++) pressButton('summon'); });
            if (Game.monsters.length < 20) throw new Error(`몬스터가 ${Game.monsters.length}마리뿐입니다`);
            UI.onMove(GAME_WIDTH / 2, 600); // 소환 버튼의 확률 설명이 화면을 가리지 않게 마우스를 치운다
            Fx.reset();
            Game.waveIndex = 6;
            Game.startWave();
            Fx.reset();
            const step = 1 / 30;
            for (let i = 0; i < 30 * 20; i++) {
                UI.update(step);
                Game.update(step);
                if (Game.heroes.filter(h => !h.waiting).length >= 14 && Game.monsters.some(m => Game.heroes.some(h => h.blocker === m))) break;
            }
        },
        settleMs: 400
    },

    // 몬스터 24마리에 랭크를 섞은 장면: 대부분 D(글자 없음), C·B·A 몇, S 둘. 하나는 랭크가 막 오른 연출 중이다
    ranks: {
        setup: () => {
            startRun();
            Game.gold = 5000;
            seededRandom(7, () => { for (let i = 0; i < 24; i++) pressButton('summon'); });
            if (Game.monsters.length < 22) throw new Error(`몬스터가 ${Game.monsters.length}마리뿐입니다`);
            const ranks = [4, 0, 1, 0, 0, 2, 0, 3, 0, 0, 1, 0, 4, 0, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0];
            Game.monsters.forEach((m, i) => setMonsterRank(m, ranks[i] || 0));
            UI.onMove(GAME_WIDTH / 2, 600);
            for (let i = 0; i < 60; i++) Game.update(1 / 30); // 막는 몬스터가 길로 걸어 나간다
            Fx.reset();
            Game.monsters[5].rankUp = 0.7;
            freezeScene();
        }
    },

    // 몬스터 3종을 길 옆에 놓고 웨이브를 시작한 뒤, 오크가 길로 나가 용사를 붙잡을 때까지 시간을 빨리 돌린다
    combat: {
        setup: () => {
            startRun();
            Game.gold = 2000; // 장면용: 세 몬스터를 모두 놓을 돈
            // 화면 가운데쯤(길이 ㄷ자로 꺾이는 곳)에 놓아 싸움이 입구 그림에 가리지 않게 한다
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            Fx.reset(); // 배치 효과를 지운다
            // Why: 첫 웨이브는 전사뿐이라 세 직업이 섞인 7번째 웨이브로 띄운다. 수치 확인용이 아니라 그림 확인용이다.
            Game.waveIndex = 6;
            Game.startWave();
            Fx.reset(); // 웨이브 시작 말풍선도 지운다
            const step = 1 / 30;
            for (let i = 0; i < 30 * 20; i++) {
                UI.update(step);
                Game.update(step);
                const walking = Game.heroes.filter(h => !h.waiting).length;
                if (walking >= 14 && Game.monsters.some(m => Game.heroes.some(h => h.blocker === m))) break;
            }
        },
        // 빨리 돌린 뒤에는 실제 속도로 조금 더 돌려 연출 효과가 자연스럽게 보이게 한다
        settleMs: 400
    },

    // 용사 3종과 몬스터 3종 x 4방향, 시체를 한 화면에 세운다
    units: {
        setup: () => {
            Game.reset();
            Game.state = 'wave'; // 건설 칸 표시를 끈다. update를 멈추므로 웨이브 종료 처리는 일어나지 않는다
            UI.corruptHintShown = true; // 시체가 있으면 뜨는 안내 문구가 줄을 가리지 않게 한다
            Game.update = () => {};
            const dirs = ['down', 'left', 'up', 'right'];
            const types = ['warrior', 'rogue', 'mage'];
            // 용사 그림 위치는 길 위 거리(d)와 길 폭 방향 어긋남(lane)으로 정해진다.
            // 3행 가로 구간(10,3)~(15,3)을 골라 d로 가로, lane으로 세로 위치를 맞춘다.
            const seg = PATH.segments.find(s => s.dy === 0 && s.dx > 0 && s.ax === tileX(10) && s.ay === tileY(3));
            // Why: d가 구간 양 끝과 같으면 이웃 구간(세로)으로 계산되어 lane이 가로로 붙는다. 양 끝을 비워 둔다.
            const margin = 48;
            const colX = i => seg.ax + margin + i * ((seg.len - margin * 2) / 3);
            const rowLane = j => 100 + j * 118; // 위쪽 HUD를 피해 길 아래 바닥에 세운다
            // 이름표 위치는 세계 좌표 [글자, x, 이름표 윗변 y]. 칸이 좁아 열 머리(방향)와 행 머리(직업)로 단다
            const labels = [];
            const footY = j => seg.ay + rowLane(j);
            dirs.forEach((dir, i) => labels.push([dir, colX(i), footY(0) - 130]));
            dirs.forEach((dir, i) => labels.push([dir, colX(i) + 900, footY(types.length) - 140]));
            types.forEach((type, j) => labels.push([HEROES[type].name, colX(0) - 105, footY(j) - 55]));
            // 몬스터 6종: 일반 3종은 용사 아래 줄에, 희귀·영웅 3종은 오른쪽 묶음에 둔다(화면 세로가 모자라다)
            const monsterTypes = Object.keys(MONSTERS);
            const RIGHT = 900;
            const monsterPos = j => (j < 3 ? { dx: 0, row: types.length + j } : { dx: RIGHT, row: types.length + j - 3 });
            monsterTypes.forEach((type, j) => {
                const p = monsterPos(j);
                labels.push([MONSTERS[type].name, colX(0) + p.dx - 105, footY(p.row) - 55]);
            });
            types.forEach((type, j) => {
                dirs.forEach((dir, i) => {
                    const h = createHero(type, 0, 0, false);
                    Object.assign(h, { waiting: false, dir, anim: 0, d: seg.start + (colX(i) - seg.ax), lane: rowLane(j) });
                    Game.heroes.push(h);
                });
            });
            // 몬스터: 네 방향 모두. 그림은 south/east/north만 있고 왼쪽은 동쪽을 뒤집어 그린다
            monsterTypes.forEach((type, j) => {
                const p = monsterPos(j);
                dirs.forEach((dir, i) => {
                    const m = createMonster(type, 0, 0);
                    // 발끝(y + MONSTER_FOOT)을 용사 줄과 같은 높이에 맞춘다
                    Object.assign(m, { x: colX(i) + p.dx, y: footY(p.row) - MONSTER_FOOT, dir, anim: 0 });
                    Game.monsters.push(m);
                });
            });
            // 시체: 쓰러지는 동작이 끝난 마지막 프레임
            types.forEach((type, j) => {
                const x = colX(3) + 260;
                const y = footY(j);
                Game.corpses.push({ type, x, y, d: 0, dir: 'down', age: 5, life: 60, cost: 15 });
                labels.push([`${HEROES[type].name} 시체`, x, y + 24]);
            });
            // 이름표: 캔버스 위에 DOM으로 얹는다(게임 화면 좌표 = 세계 좌표 x WORLD_ZOOM)
            const rect = document.getElementById('game').getBoundingClientRect();
            for (const [text, x, y] of labels) {
                const el = document.createElement('div');
                el.textContent = text;
                el.style.cssText = 'position:fixed;transform:translateX(-50%);font:bold 15px sans-serif;color:#fff;'
                    + 'background:rgba(0,0,0,.65);padding:1px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;';
                el.style.left = `${rect.left + x * WORLD_ZOOM * rect.width / GAME_WIDTH}px`;
                el.style.top = `${rect.top + y * WORLD_ZOOM * rect.height / GAME_HEIGHT}px`;
                document.body.appendChild(el);
            }
        }
    },

    // 정예 4종이 함께 걷는 장면: 음유시인 노래(음표), 뇌술사 범위 감전 경고 원, 오크에 막힌 검사, 오크를 지나는 조련사
    elites: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Fx.reset();
            Game.waveIndex = 6;
            Game.startWave();
            const rally = Game.monsters.find(f => f.rally).rally.d;
            const put = (type, d, lane) => {
                const h = createHero(type, Game.waveIndex, 0, false);
                Object.assign(h, { waiting: false, d, lane, cast: 99, song: 99 });
                return h;
            };
            // 앞에서부터: 조련사(오크를 지나 앞서 감), 검사(오크에 막힘), 뇌술사, 음유시인과 일반 용사 무리
            const tamer = put('elite_tamer', rally - 0.2 * TILE, -25);
            const sword = put('elite_swordsman', rally - 0.6 * TILE, 10);
            const storm = put('elite_stormcaller', rally - 3.2 * TILE, 0);
            const bard = put('elite_rhapsodist', rally - 5.6 * TILE, 0);
            const crowd = [put('warrior', rally - 5 * TILE, 30), put('warrior', rally - 6.3 * TILE, -30), put('mage', rally - 6.6 * TILE, 25)];
            Fx.reset();
            const step = 1 / 30;
            // 오크가 길로 나올 때까지 돌린다(용사는 멈춰 둔다)
            Game.heroes = [];
            for (let i = 0; i < 90; i++) Game.update(step);
            Game.heroes = [tamer, sword, storm, bard, ...crowd];
            // 검사가 막히고 조련사가 지나가도록 잠깐 걷게 한다. 뇌술사는 아직 오크에 닿지 않는다
            for (let i = 0; i < 25; i++) { UI.update(step); Game.update(step); }
            bard.song = 0.01;
            storm.cast = 0.01;
            for (let i = 0; i < 6; i++) { UI.update(step); Game.update(step); }
            freezeScene(); // fps를 재는 2초 동안 경고 원이 사라지지 않게 바로 멈춘다
        }
    },

    // 대마도사 보스: 체력 25% 넓은 범위 감전 경고 중. 보스 체력바가 위에 나온다
    archmage: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            Fx.reset();
            Game.waveIndex = 0;
            Game.startWave();
            const rally = Game.monsters.find(f => f.rally).rally.d;
            const boss = createHero(null, 0, 0, 'archmage');
            Object.assign(boss, { waiting: false, d: rally - 1.5 * TILE });
            Game.heroes = [boss];
            Fx.reset();
            const step = 1 / 30;
            boss.hp = boss.maxHp * 0.5;
            for (let i = 0; i < 60; i++) Game.update(step); // 50% 감전을 끝까지 쓴다
            boss.hp = boss.maxHp * 0.24;
            for (let i = 0; i < 20; i++) { UI.update(step); Game.update(step); }
            freezeScene(); // 넓은 감전 경고 원이 보이는 순간에 멈춘다
        }
    },

    // 몬스터 능력 3개: 광폭화한 오크 광전사(붉은 빛), 저주 사수에게 맞은 용사(머리 위 보라 표식),
    // 막 쓰러진 해골 기사(고리와 입자, 주변 용사 기절 별. 보스는 기절하지 않는다)
    abilities: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            // 셋을 서로 다른 길 옆에 떨어뜨려 놓아 효과가 겹치지 않게 한다
            const bz = Game.place('orc_berserker', 7, 6);
            const cs = Game.place('curse_shooter', 9, 5);
            const bk = Game.place('bone_knight', 14, 7);
            if (!bz || !cs || !bk) throw new Error('몬스터를 놓지 못했습니다');
            advance(1.6); // 막는 몬스터가 길로 걸어 나간다
            Game.waveIndex = 6;
            Game.startWave();
            const put = (type, d, lane, bossKey) => {
                const h = createHero(type, Game.waveIndex, 0, bossKey);
                Object.assign(h, { waiting: false, d, lane, cast: 99, song: 99 });
                h.hp = h.maxHp = 99999; // 장면 동안 쓰러지지 않게 한다
                return h;
            };
            const csD = nearestPathPoint(cs.x, cs.y).d; // 저주 사수 옆 길은 북쪽 길(합류 뒤 구간)
            const kD = bk.rally.d;
            Game.heroes = [
                // 광전사가 붙잡은 용사 둘. 광전사가 가리지 않게 길 위쪽(뒤)에 세운다
                put('warrior', bz.rally.d - 0.6 * TILE, -30), put('rogue', bz.rally.d - 0.3 * TILE, -45),
                // 저주 사수 앞을 걷는 용사들
                put('mage', csD - 1.6 * TILE, -10), put('warrior', csD + 0.2 * TILE, 15),
                // 해골 기사 둘레: 일반 용사 셋은 기절하고, 반경 안의 보스는 기절하지 않는다
                put('warrior', kD - 0.6 * TILE, -10), put('rogue', kD + 0.7 * TILE, 20),
                put('mage', kD - 1.5 * TILE, 15), put(null, kD + 1.8 * TILE, 0, 'fallen_knight')
            ];
            for (const h of Game.heroes) h.speed = 0; // 자리를 지키게 한다(장면용)
            for (let i = 0; i < 40; i++) { UI.update(1 / 60); Game.update(1 / 60); }
            bz.hp = bz.maxHp * 0.4; // 광폭화
            // 저주 사수에게 맞은 용사(실제 능력 경로로 건다)
            for (const h of Game.heroes.slice(2, 4)) monsterHitHero(cs.type, h);
            advance(0.4);
            knockDownMonster(bk); // 해골 기사 쓰러짐: 단말마(deathStun)
            advance(0.1);
            Fx.numbers = []; // 체력을 크게 잡은 용사의 피해 숫자가 화면을 가리지 않게 한다
            Fx.shake = 0;
            freezeScene();
        }
    },

    // 전설: 랭크 A 저주 사수를 랭크 A 해골 기사 위에 놓아 죽음의 군주가 나온 직후. 군주가 길로 나가 용사를 붙잡아 베고,
    // 화면에는 전설용 "히든 조합 발견!"(재료 줄에 랭크 A)이 떠 있다. 발밑에는 금색 전설 표식과 랭크 A
    legend: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            const knight = Game.place('bone_knight', 10, 2);
            const shooter = Game.place('curse_shooter', 14, 2);
            if (!knight || !shooter) throw new Error('재료를 놓지 못했습니다');
            setMonsterRank(knight, 3);
            setMonsterRank(shooter, 3);
            advance(1.6);
            Game.waveIndex = 6;
            Game.startWave();
            Fx.reset();
            dragDrop([shooter.x * WORLD_ZOOM, (shooter.y - 10) * WORLD_ZOOM], [knight.x * WORLD_ZOOM, (knight.y - 10) * WORLD_ZOOM]);
            const lord = Game.monsterAt(10, 2);
            if (!lord || lord.type !== 'death_lord') throw new Error('죽음의 군주가 나오지 않았습니다');
            const put = (type, d, lane) => {
                const h = createHero(type, Game.waveIndex, 0, false);
                Object.assign(h, { waiting: false, d, lane, cast: 99, song: 99, speed: 0 });
                h.hp = h.maxHp = 99999; // 장면 동안 쓰러지지 않게 한다
                return h;
            };
            const d = lord.rally.d;
            Game.heroes = [put('warrior', d - 0.7 * TILE, -25), put('rogue', d + 0.7 * TILE, -20), put('mage', d - 1.5 * TILE, 5), put('warrior', d + 1.3 * TILE, -10)];
            advance(2.7); // 군주가 나타나 길로 걸어 나가 벤다. 합치기 글자는 사라지고 발견 연출은 아직 떠 있다
            Fx.numbers = [];
            Fx.shake = 0;
            freezeScene();
        }
    },

    // 장비: 맵의 몬스터 넷이 장비를 끼고(발 옆 작은 그림), 보관함 5/6칸. 보관함의 룬 전투 도끼를 뼈 활을 낀
    // 스켈레톤 궁수 위로 끄는 중이라 몬스터 발밑이 밝아지고 "맞바꾸기" 안내가 보인다
    equipment: {
        setup: () => {
            setupBoard();
            const on = (c, r, id) => setMonsterEquip(Game.monsterAt(c, r), id);
            on(7, 6, 'shield');
            on(7, 4, 'bow');
            on(13, 5, 'crown');
            on(12, 5, 'staff');
            on(8, 2, 'gauntlet');
            Game.equipBag = ['sword', 'axe', 'cape', 'ring', 'elixir'];
            UI.update(0);
            const r = UI.bagRect(1);
            const m = Game.monsterAt(7, 4);
            dragHold([r.x + r.w / 2, r.y + r.h / 2], [m.x * WORLD_ZOOM, (m.y - 10) * WORLD_ZOOM]);
            if (!UI.equipDrag || UI.equipTarget !== m) throw new Error('장비를 끌지 못했습니다');
            freezeScene();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 보스 보상 3택: 5번째 웨이브 대마도사를 처치하고 준비 단계에 들어간 순간. 영웅 몬스터, 희귀 장비, 300G 카드,
    // 첫 카드에 마우스를 올린 상태
    bossReward: {
        setup: () => {
            startRun();
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            advance(1.6);
            Game.waveIndex = 9;
            Game.startWave();
            const boss = Game.heroes.find(h => h.boss);
            Game.heroes = [boss];
            boss.waiting = false;
            damageHero(boss, 1e9);
            advance(1.5);
            if (!Game.bossReward) throw new Error('보스 보상이 뜨지 않았습니다');
            Game.bossReward = withRandom([0.1, 0, 0.9, 0.99], () => Game.rollBossReward()); // 해골 기사, 고대 주문서, 골드
            UI.update(0);
            const b = UI.buttons.find(x => x.id === 'reward0');
            UI.onMove(b.x + 60, b.y + 60);
            freezeScene();
        }
    },

    // 대마도사 이름 배너(보스 웨이브 시작 연출)
    // 두 입구의 준비 화면: 5번째 웨이브(6:4, 대마도사)를 앞둔 준비 시간. 북쪽·남쪽 문 위에 올 인원(보스는 북쪽),
    // 다음 파티 창의 입구별 인원 줄과 보스 줄의 입구, 남쪽 갈래 둘레의 건설 칸과 낀 칸(9,9)
    twoGates: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            Game.waveIndex = 9;
            Game.place('orc_guard', 3, 10);
            Game.place('skeleton_archer', 9, 9);
            Game.place('orc_guard', 11, 8);
            advance(1.6);
            Fx.reset();
        },
        afterFreeze: () => { Game.time = Math.PI / 6; }
    },

    // 웨이브 중 합류점 근처: 8번째 웨이브(5:5). 남쪽 갈래 오크(3,10)와 합류점 오크(11,8), 낀 칸 궁수(9,9)·마법사(8,9),
    // 두 갈래의 용사가 합류점 (10,8)에서 만나 붙잡힌 순간
    merge2: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            Game.place('orc_guard', 3, 10);
            Game.place('orc_guard', 11, 8);
            Game.place('skeleton_archer', 9, 9);
            Game.place('dark_mage', 8, 9);
            Game.place('skeleton_archer', 6, 5);
            advance(1.6);
            for (const m of Game.monsters) { m.hp = m.maxHp = 1e6; } // 장면 동안 쓰러지지 않게 한다
            Game.waveIndex = 7;
            seededRandom(7, () => Game.startWave());
            const near = r => Game.heroes.some(h => !h.waiting && h.route === r && h.blocker && distance(heroWorld(h).x, heroWorld(h).y, tileX(MERGE_TILE.col), tileY(MERGE_TILE.row)) < TILE * 1.5);
            for (let i = 0; i < 60 * 30 && !(near('north') && near('south')); i++) { UI.update(1 / 60); Game.update(1 / 60); }
            if (!near('north') || !near('south')) throw new Error('합류점에서 두 갈래 용사가 만나지 않았습니다');
            advance(0.3);
            Fx.numbers = [];
            Fx.shake = 0;
            freezeScene();
        }
    },

    archmageIntro: {
        setup: () => {
            startRun();
            WAVES[WAVES.length - 1].boss = 'archmage';
            Game.waveIndex = WAVES.length - 1;
            Game.startWave();
            for (let i = 0; i < 30; i++) { UI.update(1 / 30); Game.update(1 / 30); }
        }
    },

    // 빈 맵 전체: 바닥 타일(이끼, 벽돌 길, 물가), 소품, 입구 문, 왕좌와 마왕. 건설 칸 표시가 없도록 웨이브 상태로 둔다
    mapOverview: {
        setup: () => {
            startRun();
            Game.state = 'wave';
            Game.heroes = [];
            Fx.reset();
            UI.onMove(GAME_WIDTH / 2, 600);
            freezeScene();
        }
    },

    // 지역 8곳(ZONES)을 차례로: 같은 판에 지역만 바꿔 맵을 다시 그린다. 몬스터 몇과 걷는 용사를 함께 올려 길 폭과 섬 크기를 본다.
    // 파일은 zones_<지역>.png
    zones: {
        setup: () => {
            startRun();
            Game.gold = 2000;
            Game.place('orc_guard', 7, 6);
            Game.place('skeleton_archer', 7, 4);
            Game.place('dark_mage', 12, 5);
            Game.place('frost_witch', 16, 9);
            Game.waveIndex = 6;
            Game.startWave();
            seededRandom(3, () => advance(6));
            Fx.reset();
            UI.onMove(GAME_WIDTH / 2, 600);
            freezeScene();
        },
        shots: ['moonGarden', 'coast', 'frost', 'skySea', 'sunForge', 'warTemple', 'starChoir', 'ember'],
        shot: id => { Game.zone = id; }
    },

    // 몬스터 23종을 모두 맵에 올린 모습(준비 단계). 막는 11종은 서로 다른 길 지점으로 걸어 나가 서고,
    // 원거리·지원 12종은 길에서 떨어진 칸에 선다. 발이 떠 있거나 잘린 몬스터가 없는지 본다
    roster: {
        setup: () => {
            startRun();
            const blockers = ['orc_guard', 'orc_berserker', 'bone_knight', 'death_lord', 'goblin_spearman', 'zombie', 'werewolf', 'troll',
                'minotaur', 'ancient_treant', 'hell_general'];
            const others = ['skeleton_archer', 'dark_mage', 'curse_shooter', 'fire_imp', 'gnoll_hunter', 'wisp_acolyte', 'frost_witch',
                'nightmare_jester', 'orc_shaman', 'vampire', 'flame_demon', 'archlich'];
            const blockCells = [[3, 2], [4, 6], [9, 5], [11, 6], [13, 4], [16, 7], [17, 10], [20, 9], [22, 8], [14, 9], [7, 10]];
            const otherCells = [[2, 5], [7, 4], [12, 7], [14, 6], [19, 7], [11, 10], [3, 7], [4, 9], [8, 9], [19, 10], [24, 5], [23, 10]];
            const all = Object.keys(MONSTERS);
            if (blockers.length + others.length !== all.length || !all.every(id => blockers.includes(id) || others.includes(id))) {
                throw new Error('roster 장면의 몬스터 목록이 표와 다릅니다');
            }
            blockers.forEach((id, i) => { if (!Game.place(id, ...blockCells[i])) throw new Error(`${id}를 놓지 못했습니다`); });
            others.forEach((id, i) => { if (!Game.place(id, ...otherCells[i])) throw new Error(`${id}를 놓지 못했습니다`); });
            advance(2); // 막는 몬스터가 길로 걸어 나가 선다
            Fx.reset();
            UI.onMove(GAME_WIDTH / 2, 600);
            freezeScene();
        }
    },

    // 확장 능력: 화상(불꽃 임프), 빙결(서리 마녀), 악몽 기절(악몽 광대), 흡혈(늑대인간), 재생과 회복 오라(좀비, 도깨비불 수련사),
    // 피해 오라(오크 주술사), 가르기(미노타우로스), 가시(고대 나무 정령), 연쇄 번개와 공격 속도 오라(대리치), 용암 장판(용암 악마), 약탈 골드(뱀파이어)
    abilities2: {
        setup: () => {
            startRun();
            const at = (id, c, r) => { const m = Game.place(id, c, r); if (!m) throw new Error(`${id}를 놓지 못했습니다`); return m; };
            const imp = at('fire_imp', 2, 5);
            const shaman = at('orc_shaman', 6, 4);
            const mino = at('minotaur', 9, 5);
            const wolf = at('werewolf', 13, 4);
            const witch = at('frost_witch', 14, 6);
            const tree = at('ancient_treant', 16, 7);
            const jester = at('nightmare_jester', 19, 7);
            const lich = at('archlich', 17, 2);
            const demon = at('flame_demon', 11, 10);
            const zombie = at('zombie', 22, 8);
            const wisp = at('wisp_acolyte', 21, 6);
            const vamp = at('vampire', 22, 9);
            advance(1.6); // 막는 몬스터가 길로 걸어 나간다
            Game.waveIndex = 6;
            Game.startWave();
            // 몬스터 칸에서 가장 가까운 길 지점 기준으로 용사를 세운다(off: 길 따라 칸, lane: 길과 수직 px)
            const put = (m, off, lane, type) => {
                const p = m.rally || nearestPathPoint(m.x, m.y);
                const h = createHero(type || 'warrior', Game.waveIndex, 0, false, p.route);
                // 장면 동안 용사도 몬스터도 쓰러지지 않게 한다(용사 피해 1)
                Object.assign(h, { waiting: false, d: p.d + off * TILE, lane, cast: 99, song: 99, speed: 0, damage: 1, interval: 99 });
                h.hp = h.maxHp = 99999;
                return h;
            };
            Game.heroes = [
                put(imp, 0.6, 10), put(imp, -0.8, -20, 'rogue'),
                put(mino, 0.55, -20), put(mino, 1.1, 20, 'rogue'), put(mino, 1.5, -10, 'mage'),
                put(wolf, 0.55, -20, 'rogue'), put(wolf, 1.2, 15),
                put(witch, 0.3, 10, 'mage'), put(witch, 0.6, -25),
                put(tree, 0.55, -20), put(tree, 1.0, 20, 'rogue'), put(tree, 1.45, 0),
                put(jester, 0.5, 10, 'rogue'), put(jester, -0.4, -20),
                put(lich, 0.4, 0), put(lich, 2.2, 10, 'rogue'), put(lich, 4.3, -10, 'mage'),
                put(demon, 0.2, 0), put(demon, 0.7, -25, 'rogue'),
                put(zombie, 0.55, -15), put(zombie, 1.1, 20, 'rogue'),
                put(vamp, 1.4, 0, 'mage')
            ];
            seededRandom(5, () => advance(1.5));
            // 한순간에 보이도록 능력마다 실제 경로를 한 번 더 부른다
            zombie.hp = zombie.maxHp * 0.6; // 재생과 회복 오라
            wolf.hp = wolf.maxHp * 0.5; // 흡혈
            const near = m => Game.heroes.find(h => h.blocker === m) || Game.heroes[0];
            const prey = Game.heroes[21];
            prey.hp = 1;
            seededRandom(9, () => advance(0.3)); // 뱀파이어가 쓰러뜨려 약탈 골드
            if (!prey.dead) monsterKilledHero(vamp, prey);
            withRandom(0, () => monsterHitHero(jester.type, Game.heroes[12], jester)); // 악몽 기절(난수 0)
            monsterCleave(mino, near(mino), monsterStats(mino).damage);
            tree.thornsFx = 0;
            damageUnit(tree, 40, near(tree));
            monsterChain(lich, Game.heroes[14], monsterStats(lich).damage);
            advance(0.1);
            for (const x of [...Game.heroes, ...Game.monsters]) x.flash = 0;
            Fx.numbers = [];
            Fx.shake = 0;
            UI.onMove(GAME_WIDTH / 2, 600);
            freezeScene();
        }
    }
};

// 페이지 안에 넣는 도우미: 실제 입력 경로로 UI 버튼을 누른다(tools/smoke.js와 같은 방식)
const PAGE_HELPERS = () => {
    // 스토리 없는 판(WAVES 전부)을 고르기 화면을 거쳐 기본 선택(균열의 군주, 유물 없음)으로 시작한다(tools/smoke.js와 같은 시험용 판)
    window.startRun = () => { UI.openSelect(null); pressButton('begin'); };
    // 기록을 스토리 스테이지 앞에서부터 n개 깬 상태로. 페이지마다 저장소를 비우고 시작해 사용자의 저장과 상관없다
    window.storyProgress = n => {
        Meta.data = Meta.sanitize({ version: META_VERSION, cleared: STAGES.slice(0, n).map(s => s.id) });
    };
    // 스토리를 모두 깬 기록(마왕 3명, 유물 16종, 칸 3개)
    window.unlockAll = () => storyProgress(STAGES.length);
    // 이번 스테이지를 이긴다(마지막 웨이브를 막은 것처럼). 다음 UI.update에서 승리 대화가 뜬다
    window.winStage = () => {
        Game.waveIndex = Game.waves.length - 1;
        Game.state = 'wave';
        Game.heroes = [];
        Game.update(1 / 60);
        UI.update(0);
    };
    window.pressButton = id => {
        UI.update(0);
        const b = UI.buttons.find(x => x.id === id);
        if (!b) throw new Error(`버튼이 없습니다: ${id}`);
        UI.onMove(b.x + 5, b.y + 5);
        UI.onClick(b.x + 5, b.y + 5);
    };
    // Math.random 고정(배열이면 차례로, 다 쓰면 0.5). 소환 결과를 장면마다 같게 만든다
    window.withRandom = (v, fn) => {
        const old = Math.random;
        const list = Array.isArray(v) ? v.slice() : null;
        Math.random = () => (list ? (list.length ? list.shift() : 0.5) : v);
        try { return fn(); } finally { Math.random = old; }
    };
    // 씨앗으로 정한 난수열(mulberry32)로 바꿔 여러 번 소환해도 장면이 매번 같게 한다
    window.seededRandom = (seed, fn) => {
        const old = Math.random;
        let a = seed >>> 0;
        Math.random = () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        try { return fn(); } finally { Math.random = old; }
    };
    window.advance = seconds => {
        for (let i = 0; i < Math.round(seconds * 60); i++) { UI.update(1 / 60); Game.update(1 / 60); }
    };
    window.cellCenter = (c, r) => [tileX(c) * WORLD_ZOOM, tileY(r) * WORLD_ZOOM];
    // 끌기 장면 공통 판: 오크 경비병(7,6)·스켈레톤 궁수(7,4)·암흑 마법사(12,5)와 끌어 쓸 암흑 마법사(3,5),
    // 오크 경비병(13,8), 저주 사수(13,5), 오크 광전사(8,2)
    window.setupBoard = () => {
        startRun();
        Game.gold = 300;
        Game.place('orc_guard', 7, 6);
        Game.place('skeleton_archer', 7, 4);
        Game.place('dark_mage', 12, 5);
        Game.place('dark_mage', 3, 5);
        Game.place('orc_guard', 13, 8);
        Game.place('curse_shooter', 13, 5);
        Game.place('orc_berserker', 8, 2);
        advance(1.6); // 오크가 길로 걸어 나가고 설치 효과가 사라진다
        Fx.reset();
    };
    // 실제 입력 경로로 누른 채 끈다(떼지 않음)
    window.dragHold = (from, to) => {
        UI.onMove(from[0], from[1]);
        UI.onDown(from[0], from[1]);
        for (let i = 1; i <= 6; i++) UI.onMove(from[0] + (to[0] - from[0]) * i / 6, from[1] + (to[1] - from[1]) * i / 6);
    };
    window.dragDrop = (from, to) => { dragHold(from, to); UI.onUp(to[0], to[1]); };
    // 장면 고정: 게임 진행을 멈추고, 남은 건설 효과 같은 연출은 그대로 둔 채 더 이상 움직이지 않게 한다
    window.freezeScene = () => { Game.update = () => {}; };
    // rAF 횟수로 실제 그리기 속도를 잰다
    window.measureFps = seconds => new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        const tick = now => {
            frames++;
            if (now - start < seconds * 1000) requestAnimationFrame(tick);
            else resolve(frames / ((now - start) / 1000));
        };
        requestAnimationFrame(tick);
    });
};

function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once('error', reject);
        s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

// tools/server.js를 빈 포트로 띄운다. 이미 8123에서 돌고 있는 서버와 부딪히지 않는다.
async function startServer() {
    const port = await freePort();
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('서버가 5초 안에 뜨지 않았습니다')), 5000);
        child.stdout.on('data', d => { if (String(d).includes('http://')) { clearTimeout(timer); resolve(); } });
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`서버가 종료되었습니다(${code})`)); });
    });
    return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
}

async function launchBrowser() {
    const channels = process.env.CAPTURE_CHANNEL ? [process.env.CAPTURE_CHANNEL] : ['msedge', 'chrome'];
    let lastError;
    for (const channel of channels) {
        try {
            const browser = await chromium.launch({ channel, headless: true });
            return { browser, channel };
        } catch (e) { lastError = e; }
    }
    throw new Error(`브라우저를 열지 못했습니다(${channels.join(', ')}): ${lastError && lastError.message.split('\n')[0]}`);
}

async function captureScene(browser, url, name, problems) {
    const scene = SCENES[name];
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const report = text => problems.push(`[${name}] ${text}`);
    page.on('console', msg => {
        const text = msg.text();
        const where = msg.location().url || '';
        // 브라우저가 알아서 찾는 favicon은 게임 자원이 아니다
        if (msg.type() === 'error' && /\/favicon\.ico$/.test(where)) return;
        if (msg.type() === 'error') report(`콘솔 오류: ${text}${where ? ` (${where})` : ''}`);
        else if (text.includes('그림을 찾지 못했습니다')) report(`그림 없음: ${text}`);
    });
    page.on('pageerror', err => report(`페이지 예외: ${err.message}`));
    page.on('requestfailed', req => report(`요청 실패: ${req.url()} (${req.failure() && req.failure().errorText})`));
    page.on('response', res => { if (res.status() >= 400) report(`HTTP ${res.status()}: ${res.url()}`); });

    // 새 브라우저 페이지(사용자 프로필이 아님)의 저장소를 비우고 시작한다: 직전 선택과 영구 수집 기록(dungeonGuard.meta)이 없는 첫 실행
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* 무시 */ } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof ready !== 'undefined' && ready === true, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(PAGE_HELPERS);
    await page.evaluate(scene.setup);
    const fps = await page.evaluate(s => measureFps(s), FPS_SECONDS);
    if (scene.settleMs) await page.waitForTimeout(scene.settleMs);
    if (scene.freeze !== false) await page.evaluate(() => freezeScene());
    if (scene.afterFreeze) await page.evaluate(scene.afterFreeze);
    // 고정한 상태가 한 번 이상 그려지도록 두 프레임 기다린다
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (scene.shots) {
        // 한 장면에서 여러 장: shot(값)을 부른 뒤 두 프레임 기다려 찍는다
        let file;
        for (const v of scene.shots) {
            await page.evaluate(scene.shot, v);
            await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
            file = path.join(outDir, `${name}_${v}.png`);
            await page.screenshot({ path: file });
        }
        await page.close();
        return { file, fps };
    }
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    await page.close();
    return { file, fps };
}

async function main() {
    const wanted = process.argv.slice(2);
    const unknown = wanted.filter(n => !SCENES[n]);
    if (unknown.length) {
        console.error(`모르는 장면: ${unknown.join(', ')} (가능: ${Object.keys(SCENES).join(', ')})`);
        process.exit(2);
    }
    const names = wanted.length ? wanted : Object.keys(SCENES);
    fs.mkdirSync(outDir, { recursive: true });

    const server = await startServer();
    const problems = [];
    const fpsList = [];
    let browser;
    try {
        const launched = await launchBrowser();
        browser = launched.browser;
        console.log(`브라우저: ${launched.channel} ${browser.version()}, 화면 ${VIEWPORT.width}x${VIEWPORT.height}`);
        for (const name of names) {
            const { file, fps } = await captureScene(browser, server.url, name, problems);
            fpsList.push(fps);
            console.log(`${name.padEnd(7)} ${fps.toFixed(1).padStart(5)} fps  ${path.relative(root, file)}`);
        }
    } finally {
        if (browser) await browser.close();
        server.stop();
    }
    const avg = fpsList.reduce((a, b) => a + b, 0) / fpsList.length;
    console.log(`평균 FPS: ${avg.toFixed(1)} (장면마다 ${FPS_SECONDS}초 측정)`);
    if (problems.length) {
        console.error(`\n문제 ${problems.length}건:`);
        for (const p of problems) console.error(`  ${p}`);
        process.exit(1);
    }
}

main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
