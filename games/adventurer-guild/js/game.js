/* 모험가 길드 규칙. 화면 코드와 분리해 두어 Node에서도 시험할 수 있습니다. 수치는 초안. */
(function (root) {
  const D = root.GUILD_DATA;
  const SAVE_KEY = 'adventurerGuild.save.v1';
  const MAX_SLOTS = 2;
  const PARTY_MAX = 4;
  const BASE_POWER = { N: 10, R: 16, SR: 24, SSR: 36 };
  const RATES = { N: 0.5, R: 0.35, SR: 0.12, SSR: 0.03 };
  const PITY_SR = 10;   // 10번째 뽑기는 SR 이상
  const PITY_SSR = 60;  // 60번째 뽑기는 SSR
  const DUP_GOLD = { N: 20, R: 60, SR: 200, SSR: 600 }; // ★이 가득 찬 뒤 중복 보상
  const MAX_STAR = 5;

  const byId = {};
  D.CHARACTERS.forEach((c) => { byId[c.id] = c; });
  const dungeonById = {};
  D.DUNGEONS.forEach((d) => { dungeonById[d.id] = d; });

  function today() { return new Date().toISOString().slice(0, 10); }
  function fresh() {
    return { v: 1, tickets: 10, gold: 300, owned: {}, pulls: 0, pitySR: 0, pitySSR: 0, jobs: [], lastDaily: '' };
  }

  const Game = {
    byId, dungeonById, MAX_SLOTS, PARTY_MAX, RATES, PITY_SR, PITY_SSR, MAX_STAR,
    S: fresh(),
    now: () => Date.now(),
    rng: Math.random,

    load() {
      try {
        const raw = root.localStorage && root.localStorage.getItem(SAVE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.v === 1) { this.S = Object.assign(fresh(), s); return; }
        }
      } catch (e) { /* 저장을 못 읽으면 처음 상태 */ }
      this.S = fresh();
    },
    save() {
      try { root.localStorage && root.localStorage.setItem(SAVE_KEY, JSON.stringify(this.S)); } catch (e) { /* 무시 */ }
    },
    reset() { this.S = fresh(); this.save(); },

    // ---- 일일 보상 ----
    canDaily() { return this.S.lastDaily !== today(); },
    claimDaily() {
      if (!this.canDaily()) return false;
      this.S.lastDaily = today();
      this.S.tickets += 3;
      this.S.gold += 100;
      this.save();
      return true;
    },

    // ---- 모집(뽑기) ----
    rollRarity() {
      const S = this.S;
      if (S.pitySSR >= PITY_SSR - 1) return 'SSR';
      let r = this.rng();
      let pick = 'N';
      for (const k of ['SSR', 'SR', 'R', 'N']) {
        if (r < RATES[k]) { pick = k; break; }
        r -= RATES[k];
      }
      if (S.pitySR >= PITY_SR - 1 && (pick === 'N' || pick === 'R')) pick = 'SR';
      return pick;
    },
    pullOne() {
      const S = this.S;
      const rarity = this.rollRarity();
      const pool = D.CHARACTERS.filter((c) => c.rarity === rarity);
      const c = pool[Math.floor(this.rng() * pool.length)];
      S.pulls += 1;
      S.pitySR = (rarity === 'SR' || rarity === 'SSR') ? 0 : S.pitySR + 1;
      S.pitySSR = rarity === 'SSR' ? 0 : S.pitySSR + 1;
      const o = S.owned[c.id];
      let kind = 'new', gold = 0;
      if (!o) {
        S.owned[c.id] = { lv: 1, stars: 1, at: this.now() };
      } else if (o.stars < MAX_STAR) {
        o.stars += 1; kind = 'star';
      } else {
        gold = DUP_GOLD[c.rarity]; S.gold += gold; kind = 'dup';
      }
      return { id: c.id, rarity, kind, gold };
    },
    // n회 뽑기. 모집권이 모자라면 null
    pull(n) {
      if (this.S.tickets < n) return null;
      this.S.tickets -= n;
      const out = [];
      for (let i = 0; i < n; i++) out.push(this.pullOne());
      this.save();
      return out;
    },

    // ---- 성장 ----
    levelCap(id) { const o = this.S.owned[id]; return 10 + 5 * o.stars; },
    levelCost(id) { return 40 * this.S.owned[id].lv; },
    levelUp(id) {
      const o = this.S.owned[id];
      if (!o || o.lv >= this.levelCap(id)) return false;
      const cost = this.levelCost(id);
      if (this.S.gold < cost) return false;
      this.S.gold -= cost; o.lv += 1; this.save();
      return true;
    },
    power(id) {
      const o = this.S.owned[id], c = byId[id];
      if (!o) return 0;
      return Math.round(BASE_POWER[c.rarity] * (1 + 0.08 * (o.lv - 1)) * (1 + 0.1 * (o.stars - 1)));
    },

    // ---- 파견 ----
    busyIds() {
      const s = new Set();
      this.S.jobs.forEach((j) => j.party.forEach((id) => s.add(id)));
      return s;
    },
    bondsIn(party) {
      const out = [];
      D.BONDS.forEach(([a, b, type, line]) => {
        if (party.includes(a) && party.includes(b)) out.push({ a, b, type, line });
      });
      return out;
    },
    // 파티와 던전으로 성공 확률을 계산합니다.
    calc(dungeonId, party) {
      const dn = dungeonById[dungeonId];
      const total = party.reduce((s, id) => s + this.power(id), 0);
      const have = new Set();
      party.forEach((id) => byId[id].tags.forEach((t) => have.add(t)));
      const covered = dn.tags.filter((t) => have.has(t));
      const bonds = this.bondsIn(party);
      const bondSum = bonds.reduce((s, b) => s + (b.type === 'friend' ? 0.06 : -0.04), 0);
      const raw = (total / dn.need) * 0.7 + covered.length * 0.07 + bondSum;
      const chance = Math.min(0.97, Math.max(0.05, raw));
      return { total, covered, bonds, chance };
    },
    startJob(dungeonId, party) {
      const S = this.S;
      if (S.jobs.length >= MAX_SLOTS) return { ok: false, why: '파견 칸이 가득 찼습니다.' };
      if (!party.length || party.length > PARTY_MAX) return { ok: false, why: '파티는 1~4명입니다.' };
      const busy = this.busyIds();
      if (party.some((id) => busy.has(id) || !S.owned[id])) return { ok: false, why: '이미 파견 중이거나 없는 모험가입니다.' };
      const dn = dungeonById[dungeonId];
      const calc = this.calc(dungeonId, party);
      const start = this.now();
      // 결과는 출발 때 정해 두어, 저장을 지우고 다시 하는 식의 재시도를 막습니다.
      S.jobs.push({ dungeon: dungeonId, party: party.slice(), start, end: start + dn.sec * 1000,
        chance: calc.chance, roll: this.rng(), tkRoll: this.rng() });
      this.save();
      return { ok: true };
    },
    // 직접 출격(전투) 보상. 처음 돌파하는 던전은 보너스가 붙습니다.
    grantBattle(dungeonId, win) {
      const S = this.S, dn = dungeonById[dungeonId];
      S.cleared = S.cleared || {};
      let gold = win ? dn.gold : Math.floor(dn.gold * 0.25), tk = 0, first = false;
      if (win) {
        tk = dn.tk + (this.rng() < dn.tkChance ? 1 : 0);
        if (!S.cleared[dungeonId]) { S.cleared[dungeonId] = true; first = true; tk += 2; gold += dn.gold; }
      }
      S.gold += gold; S.tickets += tk; this.save();
      return { gold, tk, first };
    },
    jobDone(job) { return this.now() >= job.end; },
    claim(index) {
      const S = this.S;
      const job = S.jobs[index];
      if (!job || !this.jobDone(job)) return null;
      const dn = dungeonById[job.dungeon];
      const success = job.roll < job.chance;
      const gold = success ? dn.gold : Math.floor(dn.gold / 2);
      const tk = success ? dn.tk + (job.tkRoll < dn.tkChance ? 1 : 0) : 0;
      S.gold += gold; S.tickets += tk;
      const bonds = this.bondsIn(job.party);
      S.jobs.splice(index, 1);
      this.save();
      return { dungeon: dn.id, party: job.party, success, gold, tk, bonds, chance: job.chance };
    },
  };

  root.GuildGame = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
})(typeof window !== 'undefined' ? window : globalThis);
