/* 모험가 길드 데이터.
 * 캐릭터를 늘리려면 CHARACTERS에 한 줄을 더하고 assets/characters/<id>/card.png, icon.png를 넣으면 됩니다.
 * (그림이 없으면 임시 카드가 대신 나옵니다. 규격은 docs/ART_SPEC.md)
 * 수치는 모두 초안입니다. */
window.GUILD_DATA = (function () {
  // 직업: glyph는 임시 카드와 필터에 쓰는 기호
  const CLASSES = {
    '전사': { glyph: '⚔' },
    '기사': { glyph: '⛨' },
    '마법사': { glyph: '✦' },
    '사제': { glyph: '✚' },
    '궁수': { glyph: '➶' },
    '도적': { glyph: '✂' },
    '소환사': { glyph: '❂' },
  };

  // 특기 태그: 던전이 요구하는 태그를 파티가 많이 덮을수록 성공률이 오릅니다.
  const TAGS = ['함정', '어둠', '신성', '화염', '정찰', '방어', '자연'];

  // rarity: N, R, SR, SSR. bio는 처음부터, secret은 ★3부터 읽을 수 있습니다.
  const CHARACTERS = [
    // ---- SSR ----
    { id: 'seraphine', name: '세라핀', rarity: 'SSR', cls: '사제', tags: ['신성', '방어'],
      bio: '북쪽 성당의 막내 성녀. 웃으면서 철퇴를 든다.',
      secret: '성당에서 도망쳐 나온 것이다. 기도문을 외우는 것보다 던전이 훨씬 재미있다고 한다.' },
    { id: 'lucian', name: '루시안', rarity: 'SSR', cls: '전사', tags: ['화염', '어둠'],
      bio: '저주받은 마검을 쓰는 방랑 검사. 말수가 적다.',
      secret: '검이 밤마다 말을 건다. 대화 상대가 생겨서 은근히 좋아한다.' },
    { id: 'nyx', name: '닉스', rarity: 'SSR', cls: '도적', tags: ['어둠', '정찰'],
      bio: '그림자 속을 걷는 전설의 도둑. 길드 금고도 한 번 털렸다.',
      secret: '훔친 물건은 전부 원래 주인에게 되돌려 놓는다. 들키지 않는 게 목적이다.' },
    // ---- SR ----
    { id: 'iris', name: '아이리스', rarity: 'SR', cls: '마법사', tags: ['화염', '정찰'],
      bio: '불꽃 마법에 빠진 천재 소녀. 실험은 늘 폭발로 끝난다.',
      secret: '사실 물 마법이 더 잘 맞는다. 폼이 안 난다는 이유로 숨기고 있다.' },
    { id: 'borin', name: '보린', rarity: 'SR', cls: '기사', tags: ['방어', '함정'],
      bio: '언덕 요새를 지키던 노련한 방패 기사.',
      secret: '함정을 몸으로 막는 버릇이 있다. 갑옷 속은 흉터투성이다.' },
    { id: 'mira', name: '미라', rarity: 'SR', cls: '궁수', tags: ['정찰', '자연'],
      bio: '숲에서 자란 궁수. 어떤 소리도 놓치지 않는다.',
      secret: '도시의 소음이 무서워서 숲 밖으로 거의 나오지 못했다.' },
    { id: 'kael', name: '카엘', rarity: 'SR', cls: '소환사', tags: ['자연', '신성'],
      bio: '작은 정령들과 함께 다니는 소환사. 정령에게 이름을 다 붙여 줬다.',
      secret: '정령들이 사실 더 똑똑하다. 길 찾기는 전부 정령 몫이다.' },
    // ---- R ----
    { id: 'tomas', name: '토마스', rarity: 'R', cls: '전사', tags: ['방어'],
      bio: '마을 대장간 집 아들. 힘 하나는 확실하다.', secret: '검보다 망치가 손에 맞는다.' },
    { id: 'lena', name: '레나', rarity: 'R', cls: '궁수', tags: ['정찰'],
      bio: '사냥꾼의 딸. 활 솜씨는 아버지보다 낫다.', secret: '몰래 토끼를 키우고 있다.' },
    { id: 'pip', name: '핍', rarity: 'R', cls: '도적', tags: ['함정'],
      bio: '손이 빠른 꼬마 도적. 자물쇠는 취미다.', secret: '모은 열쇠가 벌써 서른 개다.' },
    { id: 'olga', name: '올가', rarity: 'R', cls: '사제', tags: ['신성'],
      bio: '수도원 주방 담당이었다. 치유 마법은 요리 덕분에 늘었다.', secret: '수프가 가장 강한 회복약이다.' },
    { id: 'finn', name: '핀', rarity: 'R', cls: '마법사', tags: ['어둠'],
      bio: '독학으로 마법을 배운 수습생. 주문서를 거꾸로 읽곤 한다.', secret: '그래서 가끔 거꾸로 된 마법이 성공한다.' },
    // ---- N ----
    { id: 'jack', name: '잭', rarity: 'N', cls: '전사', tags: ['방어'],
      bio: '마을 경비병 출신. 의욕은 만점이다.', secret: '순찰 중에 길을 잃은 적이 많다.' },
    { id: 'rosa', name: '로사', rarity: 'N', cls: '사제', tags: ['신성'],
      bio: '견습 수녀. 붕대 감는 속도가 빠르다.', secret: '피를 보면 눈을 감지만 붕대는 정확하다.' },
    { id: 'ted', name: '테드', rarity: 'N', cls: '궁수', tags: ['자연'],
      bio: '나무꾼 겸 사냥꾼. 화살은 아직 반쯤 빗나간다.', secret: '빗나간 화살이 가끔 더 큰 걸 맞춘다.' },
    { id: 'mimi', name: '미미', rarity: 'N', cls: '도적', tags: ['정찰'],
      bio: '골목길 소매치기. 발이 가볍다.', secret: '훔친 빵은 항상 나눠 먹는다.' },
  ];

  // 인연: 둘이 같은 파티에 있으면 효과가 붙고, 파견 보고서에 대사가 나옵니다.
  // friend는 성공률 +6%, rival은 -4%이지만 대사가 더 재미있습니다.
  const BONDS = [
    ['seraphine', 'lucian', 'rival', '"그 검, 성당에서는 불태워야 할 물건인데요." "…태워 보든가."'],
    ['seraphine', 'borin', 'friend', '보린이 앞을 막고 세라핀이 뒤에서 철퇴를 휘두른다. 호흡이 척척 맞는다.'],
    ['nyx', 'mira', 'friend', '미라가 소리를 듣고, 닉스가 그림자로 길을 낸다. 두 사람은 말 한마디 없이 움직인다.'],
    ['nyx', 'pip', 'friend', '핍이 닉스의 자물쇠 따는 손놀림을 흉내 낸다. 닉스가 모르는 척 눈감아 준다.'],
    ['lucian', 'nyx', 'rival', '"내 금고, 네가 털었지?" "증거 있어?" 둘 사이에 칼날 같은 침묵이 흐른다.'],
    ['iris', 'kael', 'friend', '아이리스의 불꽃 위로 정령들이 신나게 춤을 춘다. 던전이 환해진다.'],
    ['iris', 'finn', 'rival', '두 마법사의 주문이 겹쳐 방이 반쯤 날아갔다. 서로 상대 탓이라고 한다.'],
    ['borin', 'tomas', 'friend', '보린이 방패 쓰는 법을 알려 주자 토마스가 열심히 따라 한다.'],
    ['mira', 'lena', 'friend', '미라와 레나가 활 쏘는 자세를 두고 한참을 이야기한다. 화살은 정확히 꽂힌다.'],
    ['olga', 'jack', 'friend', '올가의 수프를 먹은 잭이 갑자기 힘이 솟는다. 원인은 아무도 모른다.'],
    ['kael', 'mira', 'friend', '정령이 숲의 길을 알려 주고 미라는 그 길로 앞서간다.'],
    ['rosa', 'seraphine', 'friend', '로사가 세라핀의 기도문을 받아 적는다. 세라핀은 부끄러워한다.'],
  ];

  // 던전: need는 추천 전투력, sec은 걸리는 시간(초), tags는 요구 특기
  const DUNGEONS = [
    { id: 'sewer', name: '잊힌 지하 수로', sec: 60, need: 40, tags: ['함정', '정찰'],
      gold: 60, tk: 0, tkChance: 0.3, desc: '마을 아래에 숨은 오래된 수로. 입문용.' },
    { id: 'crypt', name: '달빛 지하묘지', sec: 300, need: 100, tags: ['신성', '어둠'],
      gold: 160, tk: 0, tkChance: 0.6, desc: '밤마다 불이 켜지는 묘지 던전.' },
    { id: 'forge', name: '잿불 대장간', sec: 1800, need: 200, tags: ['화염', '방어'],
      gold: 420, tk: 1, tkChance: 0.3, desc: '꺼지지 않는 용광로가 있는 폐광.' },
    { id: 'abyss', name: '별빛 심연', sec: 7200, need: 340, tags: ['어둠', '신성', '자연'],
      gold: 1100, tk: 2, tkChance: 0.5, desc: '하늘과 땅이 뒤집힌 깊은 구멍. 최고 난이도.' },
  ];

  return { CLASSES, TAGS, CHARACTERS, BONDS, DUNGEONS };
})();
