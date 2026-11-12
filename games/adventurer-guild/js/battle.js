/* 던전 직접 출격: 전투 규칙(코어). 화면 없이 Node에서도 돌아가서 밸런스를 시험할 수 있습니다.
 * 화면과 연출은 battle_ui.js. 코어는 fx.emit(종류, 값)으로 "무슨 일이 일어났는지"만 알립니다.
 * 수치는 초안입니다. */
(function (root) {
  const G = root.GuildGame;
  const W = 360, H = 520;           // 전장 크기(논리 좌표). 적은 위에서 내려오고 파티는 아래에 선다
  const BOSS_WAVE = 3;

  // 직업: hp/atk 배율, 사거리, 공격 간격, 스킬 이름과 재사용 시간
  const CLS = {
    '전사':   { hp: 1.3,  atk: 1.0,  range: 80,  iv: 0.9, front: true,  skill: '광폭 베기',   cd: 8,  desc: '가장 가까운 적과 주변을 크게 벤다' },
    '기사':   { hp: 1.9,  atk: 0.55, range: 80,  iv: 1.0, front: true,  skill: '수호의 방벽', cd: 11, desc: '5초간 적을 끌어모으고 받는 피해를 절반으로' },
    '도적':   { hp: 0.9,  atk: 1.1,  range: 80,  iv: 0.7, front: true,  skill: '그림자 연참', cd: 7,  desc: '가장 약한 적을 5번 연속으로 벤다' },
    '마법사': { hp: 0.7,  atk: 1.25, range: 300, iv: 1.2, front: false, skill: '화염 폭발',   cd: 9,  desc: '적이 모인 곳에 불덩이를 떨어뜨린다' },
    '궁수':   { hp: 0.8,  atk: 1.0,  range: 340, iv: 0.9, front: false, skill: '화살비',     cd: 8,  desc: '화살 8발을 적들에게 퍼붓는다' },
    '사제':   { hp: 0.95, atk: 0.5,  range: 280, iv: 1.1, front: false, skill: '치유의 빛',   cd: 10, desc: '파티 전원의 체력을 회복한다' },
    '소환사': { hp: 0.8,  atk: 0.7,  range: 290, iv: 1.0, front: false, skill: '정령 소환',   cd: 12, desc: '7초간 싸우는 정령 3기를 부른다' },
  };
  const SKILL_MULT = { N: 1.0, R: 1.15, SR: 1.35, SSR: 1.6 };
  const CUTIN_SEC = { N: 0.45, R: 0.55, SR: 0.8, SSR: 1.0 };   // 컷인 동안 전투가 멈춘다

  const FOES = {
    slime: { name: '슬라임', hp: 1.0, atk: 1.0, speed: 34, r: 18, iv: 1.1 },
    bat:   { name: '박쥐',   hp: 0.6, atk: 0.8, speed: 64, r: 14, iv: 0.9 },
    brute: { name: '거구',   hp: 2.2, atk: 1.5, speed: 24, r: 25, iv: 1.4 },
    boss:  { name: '던전 군주', hp: 9.0, atk: 2.0, speed: 17, r: 40, iv: 1.5 },
  };
  const WAVES = [
    ['slime', 'slime', 'slime', 'slime'],
    ['slime', 'bat', 'slime', 'bat', 'brute'],
    ['brute', 'slime', 'bat', 'bat', 'boss'],
  ];

  // 적 수치: 던전 추천 전투력 S에 비례해 늘어납니다(밸런스 시험으로 맞춘 값)
  // 시험 결과: 추천 전투력일 때 자동 스킬로 대략 60~90% 승리, 스킬 없이는 못 이기는 것이 목표
  const FOE_HP = { base: 75, per: 1.95 };
  const FOE_ATK = { base: 22.5, per: 0.675 };
  const SKILL_DMG = { v: 0.5 };   // 스킬 피해 전체 배율

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function mkAlly(id, i, n) {
    const c = G.byId[id], k = CLS[c.cls], p = G.power(id);
    const hp = (40 + p * 5) * k.hp;
    return { side: 'ally', id, name: c.name, cls: c.cls, rarity: c.rarity, k, alive: true,
      x: W * (i + 1) / (n + 1), y: k.front ? 395 : 450, r: 22,
      hp, max: hp, atk: (4 + p * 0.8) * k.atk, cd: 0, cdMax: k.cd, atkT: 0.2 * i, hitT: 0, lunge: 0 };
  }
  function mkFoe(b, type, x) {
    const t = FOES[type], S = b.dn.need;
    const hp = (FOE_HP.base + S * FOE_HP.per) * t.hp;
    return { side: 'foe', type, name: t.name, alive: true, x, y: b.top - 30, r: t.r, speed: t.speed, iv: t.iv,
      hp, max: hp, atk: (FOE_ATK.base + S * FOE_ATK.per) * t.atk, atkT: 0.5, hitT: 0 };
  }

  function create(dungeonId, party, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    // top: 화면이 세로로 더 길 때 적이 나오는 위쪽 끝(음수). 화면 맨 위에서 걸어 내려오게 한다
    const b = { dn: G.dungeonById[dungeonId], rng, top: opts.top || 0, fx: opts.fx || { emit() {} },
      time: 0, allies: [], foes: [], spirits: [], timers: [], spawnQ: [], wave: 0, waveAt: 0.6,
      pause: 0, pauseMax: 0, pending: null, shieldT: 0, taunt: null, over: null, kills: 0,
      lastCast: { id: null, t: -99 }, chains: 0, deaths: 0, auto: !!opts.auto };
    party.forEach((id, i) => b.allies.push(mkAlly(id, i, party.length)));
    // 인연(친구) 쌍이 같이 살아 있으면 공격력 +8%
    G.bondsIn(party).forEach((bd) => {
      if (bd.type !== 'friend') return;
      b.allies.forEach((a) => { if (a.id === bd.a || a.id === bd.b) a.atk *= 1.08; });
    });
    return b;
  }

  const emit = (b, type, v) => b.fx.emit(type, v || {});
  const aliveAllies = (b) => b.allies.filter((a) => a.alive);

  function damage(b, src, tgt, dmg, kind) {
    if (!tgt.alive) return;
    dmg = Math.max(1, Math.round(dmg));
    tgt.hp -= dmg; tgt.hitT = 0.12;
    emit(b, 'hit', { x: tgt.x, y: tgt.y, dmg, kind: kind || 'hit', foe: tgt.side === 'foe', big: dmg > tgt.max * 0.25 });
    if (tgt.hp <= 0) {
      tgt.alive = false; tgt.hp = 0;
      if (tgt.side === 'foe') { b.kills++; emit(b, 'die', { x: tgt.x, y: tgt.y, r: tgt.r, boss: tgt.type === 'boss', foe: true }); }
      else { b.deaths++; emit(b, 'die', { x: tgt.x, y: tgt.y, r: tgt.r, foe: false }); }
    }
  }

  function nearestFoe(from, b, range) {
    let best = null, bd = range;
    for (const f of b.foes) { if (!f.alive) continue; const d = dist(from, f); if (d <= bd) { bd = d; best = f; } }
    return best;
  }
  const foesNear = (b, p, r) => b.foes.filter((f) => f.alive && dist(f, p) <= r + f.r);

  // ---------- 스킬 ----------
  function castMult(b, a) {
    let m = SKILL_MULT[a.rarity];
    // 인연 연계: 인연 있는 동료의 스킬 직후 2.5초 안에 쓰면 피해 +35%
    const last = b.lastCast;
    if (last.id && last.id !== a.id && b.time - last.t < 2.5) {
      const bond = G.bondsIn([last.id, a.id]).length > 0;
      if (bond) { m *= 1.35; b.chains++; emit(b, 'chain', { a: last.id, b: a.id, x: a.x, y: a.y }); }
    }
    b.lastCast = { id: a.id, t: b.time };
    return m;
  }
  function later(b, delay, fn) { b.timers.push({ at: b.time + delay, fn }); }

  function doSkill(b, a, m) {
    const atk = a.atk * m * SKILL_DMG.v;
    switch (a.cls) {
      case '전사': {
        const t = nearestFoe(a, b, 9999); if (!t) return;
        emit(b, 'slash', { from: a, x: t.x, y: t.y });
        foesNear(b, t, 105).forEach((f) => damage(b, a, f, atk * 3.2, 'skill'));
        break;
      }
      case '기사': {
        b.shieldT = 5; b.taunt = a; a.hp = Math.min(a.max, a.hp + a.max * 0.15);
        emit(b, 'shield', { unit: a });
        break;
      }
      case '도적': {
        for (let i = 0; i < 5; i++) later(b, i * 0.12, () => {
          const alive = b.foes.filter((f) => f.alive);
          if (!alive.length) return;
          const t = alive.reduce((x, y) => (x.hp < y.hp ? x : y));
          emit(b, 'stab', { from: a, x: t.x, y: t.y, n: i });
          damage(b, a, t, atk * 1.35, 'skill');
        });
        break;
      }
      case '마법사': {
        const alive = b.foes.filter((f) => f.alive);
        if (!alive.length) return;
        const c = alive.reduce((x, y) => (foesNear(b, x, 90).length >= foesNear(b, y, 90).length ? x : y));
        const pt = { x: c.x, y: c.y };
        emit(b, 'fireball', { from: a, x: pt.x, y: pt.y });
        later(b, 0.4, () => {
          emit(b, 'explosion', { x: pt.x, y: pt.y, r: 95 });
          foesNear(b, pt, 95).forEach((f) => damage(b, a, f, atk * 3.4, 'skill'));
        });
        break;
      }
      case '궁수': {
        for (let i = 0; i < 8; i++) later(b, i * 0.13, () => {
          const alive = b.foes.filter((f) => f.alive);
          if (!alive.length) return;
          const t = alive[Math.floor(b.rng() * alive.length)];
          emit(b, 'arrow', { from: a, x: t.x, y: t.y });
          damage(b, a, t, atk * 1.15, 'skill');
        });
        break;
      }
      case '사제': {
        aliveAllies(b).forEach((u) => {
          const amt = u.max * 0.3 * Math.min(1.6, m);
          u.hp = Math.min(u.max, u.hp + amt);
          emit(b, 'heal', { x: u.x, y: u.y, amt: Math.round(amt) });
        });
        break;
      }
      case '소환사': {
        for (let i = 0; i < 3; i++) {
          const sp = { side: 'ally', spirit: true, alive: true, x: a.x + (i - 1) * 46, y: a.y - 56, r: 12, atk: atk * 0.9, t: 7, atkT: 0.2 * i };
          b.spirits.push(sp);
          emit(b, 'summon', { x: sp.x, y: sp.y });
        }
        break;
      }
    }
  }

  // 스킬 사용. 컷인(전투 정지) 뒤에 효과가 나옵니다.
  function cast(b, i) {
    const a = b.allies[i];
    if (!a || !a.alive || a.cd > 0 || b.over || b.pause > 0) return false;
    a.cd = a.cdMax;
    const m = castMult(b, a);
    b.pause = b.pauseMax = CUTIN_SEC[a.rarity];
    emit(b, 'cutin', { unit: a, skill: a.k.skill, dur: b.pauseMax });
    b.pending = () => { emit(b, 'release', { unit: a }); doSkill(b, a, m); };
    return true;
  }

  function autoCast(b) {
    b.allies.forEach((a, i) => {
      if (!a.alive || a.cd > 0 || b.pause > 0) return;
      const foes = b.foes.filter((f) => f.alive);
      if (!foes.length) return;
      const avg = aliveAllies(b).reduce((s, u) => s + u.hp / u.max, 0) / Math.max(1, aliveAllies(b).length);
      if (a.cls === '사제' && avg > 0.65) return;
      if (a.cls === '기사' && foesNear(b, a, 160).length < 2) return;
      cast(b, i);
    });
  }

  // ---------- 진행 ----------
  function step(b, dt) {
    if (b.over) return;
    if (b.pause > 0) {
      b.pause -= dt;
      if (b.pause <= 0) { b.pause = 0; if (b.pending) { const f = b.pending; b.pending = null; f(); } }
      return;
    }
    b.time += dt;
    if (b.shieldT > 0) { b.shieldT -= dt; if (b.shieldT <= 0) b.taunt = null; }
    if (b.auto) autoCast(b);

    // 예약된 일(연속 타격 등)
    for (let i = b.timers.length - 1; i >= 0; i--) {
      if (b.time >= b.timers[i].at) { const t = b.timers.splice(i, 1)[0]; t.fn(); }
    }
    // 웨이브 등장
    if (b.waveAt !== null && b.time >= b.waveAt && b.wave < WAVES.length) {
      b.spawnQ = WAVES[b.wave].map((type, i) => ({ type, at: b.time + i * 0.85 }));
      b.wave++; b.waveAt = null;
      emit(b, 'wave', { n: b.wave, boss: b.wave === BOSS_WAVE });
    }
    while (b.spawnQ.length && b.time >= b.spawnQ[0].at) {
      const s = b.spawnQ.shift();
      b.foes.push(mkFoe(b, s.type, 40 + b.rng() * (W - 80)));
    }

    // 아군
    for (const a of b.allies) {
      a.hitT = Math.max(0, a.hitT - dt); a.lunge = Math.max(0, a.lunge - dt);
      if (!a.alive) continue;
      a.cd = Math.max(0, a.cd - dt);
      a.atkT -= dt;
      if (a.atkT <= 0) {
        const t = nearestFoe(a, b, a.k.range);
        if (t) {
          a.atkT = a.k.iv; a.lunge = 0.15;
          const crit = b.rng() < 0.1;
          emit(b, 'attack', { from: a, to: t, ranged: a.k.range > 100 });
          damage(b, a, t, a.atk * (crit ? 1.8 : 1), crit ? 'crit' : 'hit');
        }
      }
    }
    // 정령
    for (let i = b.spirits.length - 1; i >= 0; i--) {
      const s = b.spirits[i];
      s.t -= dt; s.atkT -= dt;
      if (s.t <= 0) { b.spirits.splice(i, 1); continue; }
      if (s.atkT <= 0) {
        const t = nearestFoe(s, b, 270);
        if (t) { s.atkT = 0.6; emit(b, 'attack', { from: s, to: t, ranged: true, spirit: true }); damage(b, s, t, s.atk, 'hit'); }
      }
    }
    // 적
    for (const f of b.foes) {
      f.hitT = Math.max(0, f.hitT - dt);
      if (!f.alive) continue;
      const pool = aliveAllies(b);
      if (!pool.length) break;
      let tgt = (b.taunt && b.taunt.alive) ? b.taunt : pool.reduce((x, y) => (dist(f, x) <= dist(f, y) ? x : y));
      const d = dist(f, tgt), reach = f.r + tgt.r + 4;
      if (d > reach) {
        f.x += (tgt.x - f.x) / d * f.speed * dt;
        f.y += (tgt.y - f.y) / d * f.speed * dt;
      } else {
        f.atkT -= dt;
        if (f.atkT <= 0) {
          f.atkT = f.iv;
          emit(b, 'foeattack', { from: f, to: tgt });
          damage(b, f, tgt, f.atk * (b.shieldT > 0 ? 0.5 : 1), 'foehit');
        }
      }
    }
    b.foes = b.foes.filter((f) => f.alive || f.hitT > 0);   // 죽은 적은 잠깐 남겨 두었다가 치움

    // 결과
    if (!aliveAllies(b).length) { b.over = 'lose'; emit(b, 'over', { win: false }); return; }
    if (b.waveAt === null && !b.spawnQ.length && !b.foes.some((f) => f.alive)) {
      if (b.wave >= WAVES.length) { b.over = 'win'; emit(b, 'over', { win: true }); }
      else b.waveAt = b.time + 1.4;
    }
  }

  root.GuildBattle = { W, H, CLS, FOES, WAVES, SKILL_MULT, FOE_HP, FOE_ATK, SKILL_DMG, create, step, cast, autoCast, aliveAllies };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GuildBattle;
})(typeof window !== 'undefined' ? window : globalThis);
