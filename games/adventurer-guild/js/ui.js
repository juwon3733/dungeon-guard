/* 모험가 길드 화면. 규칙은 game.js, 데이터는 data.js. */
(function () {
  const G = window.GuildGame;
  const D = window.GUILD_DATA;
  const RARITY_ORDER = { SSR: 0, SR: 1, R: 2, N: 3 };
  const $app = document.getElementById('app');

  const ui = {
    tab: 'home',
    filter: { rar: 'all', cls: 'all', own: 'all', q: '', sort: 'rarity' },
    modal: null,      // {type:'detail'|'dispatch'|'result'|'pulls'|'report', ...}
    disp: null,       // 파견 준비 {dungeon, party}
  };

  // ---------- 그림: 파일이 있으면 그림, 없으면 임시 카드 ----------
  window.GUILD_PH = function (id, kind) {
    const c = G.byId[id];
    const d = document.createElement('div');
    d.className = 'ph ' + kind + ' r-' + c.rarity;
    d.innerHTML = '<span class="g">' + D.CLASSES[c.cls].glyph + '</span>' +
      (kind === 'card' ? '<span class="n">' + c.name + '</span>' : '');
    return d;
  };
  function art(id, kind) {
    return '<img class="art ' + kind + '" src="assets/characters/' + id + '/' + kind + '.png" alt="" loading="lazy" ' +
      'data-id="' + id + '" data-kind="' + kind + '" ' +
      'onerror="this.replaceWith(GUILD_PH(this.dataset.id,this.dataset.kind))">';
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  function fmtTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
  }
  function fmtSec(sec) { return sec >= 3600 ? sec / 3600 + '시간' : sec >= 60 ? sec / 60 + '분' : sec + '초'; }
  const ownedCount = () => Object.keys(G.S.owned).length;

  // ---------- 조각 ----------
  function iconCell(id, extra) {
    const c = G.byId[id], o = G.S.owned[id];
    return '<button class="cell r-' + c.rarity + (o ? '' : ' locked') + (extra && extra.cls ? ' ' + extra.cls : '') +
      '" data-act="' + ((extra && extra.act) || 'detail') + '" data-id="' + id + '">' +
      art(id, 'icon') +
      '<span class="rar">' + c.rarity + '</span>' +
      (o ? '<span class="lv">Lv.' + o.lv + '</span><span class="st">' + '★'.repeat(o.stars) + '</span>' : '') +
      '<span class="nm">' + (o ? c.name : '???') + '</span>' +
      (extra && extra.badge ? '<span class="badge">' + extra.badge + '</span>' : '') +
      '</button>';
  }

  function header() {
    const S = G.S;
    return '<header class="top"><h1>모험가 길드</h1>' +
      '<div class="cur"><span title="모집권">🎟 ' + S.tickets + '</span><span title="금화">🪙 ' + S.gold + '</span></div></header>';
  }
  function nav() {
    const tabs = [['home', '길드'], ['recruit', '모집'], ['book', '도감']];
    return '<nav class="nav">' + tabs.map(([k, n]) =>
      '<button class="' + (ui.tab === k ? 'on' : '') + '" data-act="tab" data-id="' + k + '">' + n +
      (k === 'home' && G.S.jobs.some(G.jobDone, G) ? '<i class="dot"></i>' : '') + '</button>').join('') + '</nav>';
  }

  // ---------- 길드(홈) ----------
  function homeView() {
    const S = G.S;
    let h = '';
    if (G.canDaily()) {
      h += '<div class="daily"><div>오늘의 출석 보상 <b>🎟 3 + 🪙 100</b></div><button class="btn" data-act="daily">받기</button></div>';
    }
    h += '<h2>파견</h2><div class="slots">';
    for (let i = 0; i < G.MAX_SLOTS; i++) {
      const j = S.jobs[i];
      if (!j) {
        h += '<div class="slot empty"><div class="t">비어 있음</div><button class="btn" data-act="newjob">파견 보내기</button></div>';
      } else {
        const dn = G.dungeonById[j.dungeon];
        const done = G.jobDone(j);
        h += '<div class="slot' + (done ? ' done' : '') + '"><div class="t">' + dn.name + '</div>' +
          '<div class="party">' + j.party.map((id) => '<span class="mini r-' + G.byId[id].rarity + '">' + art(id, 'icon') + '</span>').join('') + '</div>' +
          (done ? '<button class="btn gold" data-act="claim" data-id="' + i + '">보고 받기</button>'
            : '<div class="timer" data-end="' + j.end + '">' + fmtTime(j.end - G.now()) + '</div>') + '</div>';
      }
    }
    h += '</div>';
    h += '<h2>길드 현황</h2><div class="stats">' +
      '<div><b>' + ownedCount() + ' / ' + D.CHARACTERS.length + '</b><span>모은 모험가</span></div>' +
      '<div><b>' + S.pulls + '</b><span>모집 횟수</span></div></div>';
    if (!ownedCount()) h += '<p class="hint">아직 모험가가 없습니다. 아래 <b>모집</b>에서 첫 동료를 만나 보세요.</p>';
    return h;
  }

  // ---------- 모집 ----------
  function recruitView() {
    const S = G.S;
    return '<h2>모집</h2><div class="banner"><div class="bn-title">길드 모집 공고</div>' +
      '<div class="rates">' + Object.keys(G.RATES).map((k) => '<span class="r-' + k + '">' + k + ' ' + Math.round(G.RATES[k] * 100) + '%</span>').join('') + '</div>' +
      '<div class="pity">SR 보장까지 ' + (G.PITY_SR - S.pitySR) + '회 · SSR 보장까지 ' + (G.PITY_SSR - S.pitySSR) + '회</div>' +
      '<div class="btns"><button class="btn" data-act="pull" data-id="1"' + (S.tickets < 1 ? ' disabled' : '') + '>1회 · 🎟1</button>' +
      '<button class="btn gold" data-act="pull" data-id="10"' + (S.tickets < 10 ? ' disabled' : '') + '>10회 · 🎟10</button></div></div>' +
      '<p class="hint">모집권은 파견과 출석으로 모읍니다. 같은 모험가가 또 나오면 ★이 오르고(최대 ★5), 그 뒤로는 금화가 됩니다.</p>';
  }

  // ---------- 도감 ----------
  function filteredList() {
    const f = ui.filter;
    let list = D.CHARACTERS.slice();
    if (f.rar !== 'all') list = list.filter((c) => c.rarity === f.rar);
    if (f.cls !== 'all') list = list.filter((c) => c.cls === f.cls);
    if (f.own === 'yes') list = list.filter((c) => G.S.owned[c.id]);
    if (f.own === 'no') list = list.filter((c) => !G.S.owned[c.id]);
    if (f.q) {
      const q = f.q.trim();
      list = list.filter((c) => G.S.owned[c.id] ? c.name.includes(q) : false);
    }
    const o = (id) => G.S.owned[id];
    list.sort((a, b) => {
      if (f.sort === 'power') return G.power(b.id) - G.power(a.id);
      if (f.sort === 'level') return (o(b.id) ? o(b.id).lv : 0) - (o(a.id) ? o(a.id).lv : 0);
      if (f.sort === 'recent') return (o(b.id) ? o(b.id).at : 0) - (o(a.id) ? o(a.id).at : 0);
      return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
    });
    return list;
  }
  function gridHtml() {
    const list = filteredList();
    if (!list.length) return '<p class="hint">조건에 맞는 모험가가 없습니다.</p>';
    return list.map((c) => iconCell(c.id)).join('');
  }
  function chips(key, values, label) {
    return '<div class="chips" role="group" aria-label="' + label + '">' + values.map(([v, n]) =>
      '<button class="chip' + (ui.filter[key] === v ? ' on' : '') + '" data-act="filter" data-key="' + key + '" data-id="' + v + '">' + n + '</button>').join('') + '</div>';
  }
  function bookView() {
    return '<h2>도감 <small>' + ownedCount() + ' / ' + D.CHARACTERS.length + '</small></h2>' +
      '<input id="q" class="search" type="search" placeholder="이름 검색 (모은 모험가)" value="' + esc(ui.filter.q) + '">' +
      chips('rar', [['all', '전체'], ['SSR', 'SSR'], ['SR', 'SR'], ['R', 'R'], ['N', 'N']], '등급') +
      chips('cls', [['all', '전체 직업'], ...Object.keys(D.CLASSES).map((k) => [k, D.CLASSES[k].glyph + ' ' + k])], '직업') +
      chips('own', [['all', '전체'], ['yes', '보유'], ['no', '미보유']], '보유') +
      chips('sort', [['rarity', '등급순'], ['power', '전투력순'], ['level', '레벨순'], ['recent', '최근 영입']], '정렬') +
      '<div id="grid" class="grid">' + gridHtml() + '</div>';
  }

  // ---------- 모달 ----------
  function detailModal(id) {
    const c = G.byId[id], o = G.S.owned[id];
    const bonds = D.BONDS.filter((b) => b[0] === id || b[1] === id).map(([a, b, type, line]) => {
      const other = a === id ? b : a;
      const known = G.S.owned[other];
      return '<li class="' + type + '"><b>' + (type === 'friend' ? '친구' : '앙숙') + '</b> ' +
        (known ? esc(G.byId[other].name) : '???') + '<em>' + (known && o && o.stars >= 2 ? esc(line) : '★2 이상이고 상대를 영입하면 볼 수 있습니다.') + '</em></li>';
    }).join('');
    let h = '<div class="detail r-' + c.rarity + '"><div class="big' + (o ? '' : ' locked') + '">' + art(id, 'card') + '</div><div class="info">' +
      '<div class="rarity">' + c.rarity + ' · ' + D.CLASSES[c.cls].glyph + ' ' + c.cls + '</div>' +
      '<h3>' + (o ? esc(c.name) : '???') + '</h3>';
    if (o) {
      h += '<div class="tags">' + c.tags.map((t) => '<span>' + t + '</span>').join('') + '</div>' +
        '<div class="kv"><span>레벨</span><b>' + o.lv + ' / ' + G.levelCap(id) + '</b><span>★</span><b>' + o.stars + ' / ' + G.MAX_STAR + '</b><span>전투력</span><b>' + G.power(id) + '</b></div>' +
        (o.lv < G.levelCap(id) ? '<button class="btn" data-act="levelup" data-id="' + id + '"' + (G.S.gold < G.levelCost(id) ? ' disabled' : '') + '>레벨업 🪙' + G.levelCost(id) + '</button>'
          : '<div class="hint">현재 ★에서의 최고 레벨입니다. 같은 모험가를 또 영입하면 오릅니다.</div>') +
        '<p class="bio">' + esc(c.bio) + '</p>' +
        '<p class="bio secret">' + (o.stars >= 3 ? esc(c.secret) : '🔒 ★3에서 숨은 이야기가 열립니다.') + '</p>' +
        '<ul class="bonds">' + (bonds || '<li class="none">알려진 인연이 없습니다.</li>') + '</ul>';
    } else {
      h += '<p class="bio">아직 만나지 못한 모험가입니다. 모집으로 영입하세요.</p>';
    }
    return h + '</div></div><button class="btn ghost close" data-act="close">닫기</button>';
  }

  function dispatchModal() {
    const d = ui.disp;
    const busy = G.busyIds();
    let h = '<h3>파견 준비</h3><div class="dlist">' + D.DUNGEONS.map((dn) =>
      '<button class="dn' + (d.dungeon === dn.id ? ' on' : '') + '" data-act="pickdn" data-id="' + dn.id + '"><b>' + dn.name + '</b>' +
      '<span>⏱ ' + fmtSec(dn.sec) + ' · 추천 전투력 ' + dn.need + ' · 🪙' + dn.gold + (dn.tk ? ' · 🎟' + dn.tk + '+' : ' · 🎟 가끔') + '</span>' +
      '<span class="tg">' + dn.tags.map((t) => '<i>' + t + '</i>').join('') + '</span></button>').join('') + '</div>';
    const owned = Object.keys(G.S.owned).sort((a, b) => RARITY_ORDER[G.byId[a].rarity] - RARITY_ORDER[G.byId[b].rarity] || G.power(b) - G.power(a));
    h += '<h4>파티 (' + d.party.length + '/' + G.PARTY_MAX + ')</h4>';
    if (!owned.length) h += '<p class="hint">모험가가 없습니다.</p>';
    h += '<div class="grid small">' + owned.map((id) => iconCell(id, {
      act: 'toggle', cls: (d.party.includes(id) ? 'sel ' : '') + (busy.has(id) ? 'busy' : ''), badge: busy.has(id) ? '파견 중' : '' })).join('') + '</div>';
    if (d.party.length) {
      const c = G.calc(d.dungeon, d.party);
      const dn = G.dungeonById[d.dungeon];
      h += '<div class="calc"><div>전투력 <b>' + c.total + '</b> / 추천 ' + dn.need + '</div>' +
        '<div>특기 일치 <b>' + c.covered.length + ' / ' + dn.tags.length + '</b> ' + c.covered.map((t) => '<i>' + t + '</i>').join('') + '</div>' +
        c.bonds.map((b) => '<div class="bd ' + b.type + '">' + (b.type === 'friend' ? '♥ ' : '⚡ ') + esc(G.byId[b.a].name) + ' · ' + esc(G.byId[b.b].name) + ' (' + (b.type === 'friend' ? '친구 +6%' : '앙숙 -4%') + ')</div>').join('') +
        '<div class="ch">성공 확률 <b>' + Math.round(c.chance * 100) + '%</b></div></div>';
    }
    h += '<div class="btns"><button class="btn ghost" data-act="close">취소</button><button class="btn gold" data-act="start"' + (d.party.length ? '' : ' disabled') + '>출발</button></div>';
    return h;
  }

  function reportModal(r) {
    const dn = G.dungeonById[r.dungeon];
    return '<h3 class="' + (r.success ? 'win' : 'lose') + '">' + (r.success ? '파견 성공' : '파견 실패') + '</h3><p class="hint">' + dn.name + ' (성공 확률이었던 ' + Math.round(r.chance * 100) + '%)</p>' +
      '<div class="party big">' + r.party.map((id) => '<span class="mini r-' + G.byId[id].rarity + '">' + art(id, 'icon') + '</span>').join('') + '</div>' +
      '<div class="gain">🪙 +' + r.gold + (r.tk ? ' &nbsp; 🎟 +' + r.tk : '') + '</div>' +
      '<ul class="lines">' + (r.bonds.length ? r.bonds.map((b) => '<li class="' + b.type + '"><b>' + esc(G.byId[b.a].name) + ' · ' + esc(G.byId[b.b].name) + '</b> ' + esc(b.line) + '</li>').join('') : '<li class="none">이번엔 특별한 일이 없었습니다.</li>') + '</ul>' +
      '<button class="btn" data-act="close">확인</button>';
  }

  function pullsModal(res) {
    return '<h3>모집 결과</h3><div class="grid small reveal">' + res.map((r, i) => {
      const c = G.byId[r.id];
      return '<div class="cell r-' + r.rarity + ' pop" style="animation-delay:' + i * 90 + 'ms">' + art(r.id, 'icon') +
        '<span class="rar">' + r.rarity + '</span><span class="nm">' + esc(c.name) + '</span>' +
        '<span class="badge ' + r.kind + '">' + (r.kind === 'new' ? 'NEW' : r.kind === 'star' ? '★UP' : '🪙' + r.gold) + '</span></div>';
    }).join('') + '</div><button class="btn" data-act="close">확인</button>';
  }

  function modalHtml() {
    const m = ui.modal;
    if (!m) return '';
    let body = '';
    if (m.type === 'detail') body = detailModal(m.id);
    else if (m.type === 'dispatch') body = dispatchModal();
    else if (m.type === 'report') body = reportModal(m.r);
    else if (m.type === 'pulls') body = pullsModal(m.res);
    return '<div class="overlay" data-act="overlay"><div class="modal ' + m.type + '" role="dialog" aria-modal="true">' + body + '</div></div>';
  }

  // ---------- 그리기 ----------
  function render() {
    const view = ui.tab === 'home' ? homeView() : ui.tab === 'recruit' ? recruitView() : bookView();
    $app.innerHTML = header() + '<main class="view">' + view + '</main>' + nav() + modalHtml();
  }

  // ---------- 입력 ----------
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    if (act === 'overlay') { if (e.target !== el) return; ui.modal = null; ui.disp = null; }
    else if (act === 'close') { ui.modal = null; ui.disp = null; }
    else if (act === 'tab') { ui.tab = id; }
    else if (act === 'daily') { G.claimDaily(); }
    else if (act === 'detail') { ui.modal = { type: 'detail', id }; }
    else if (act === 'levelup') { G.levelUp(id); }
    else if (act === 'filter') { ui.filter[el.dataset.key] = id; }
    else if (act === 'pull') { const res = G.pull(Number(id)); if (res) ui.modal = { type: 'pulls', res }; }
    else if (act === 'newjob') { ui.disp = { dungeon: D.DUNGEONS[0].id, party: [] }; ui.modal = { type: 'dispatch' }; }
    else if (act === 'pickdn') { ui.disp.dungeon = id; }
    else if (act === 'toggle') {
      if (G.busyIds().has(id)) return;
      const p = ui.disp.party, i = p.indexOf(id);
      if (i >= 0) p.splice(i, 1); else if (p.length < G.PARTY_MAX) p.push(id);
    } else if (act === 'start') {
      const r = G.startJob(ui.disp.dungeon, ui.disp.party);
      if (r.ok) { ui.modal = null; ui.disp = null; } else { alert(r.why); }
    } else if (act === 'claim') {
      const r = G.claim(Number(id));
      if (r) ui.modal = { type: 'report', r };
    }
    render();
  });
  $app.addEventListener('input', (e) => {
    if (e.target.id !== 'q') return;
    ui.filter.q = e.target.value;
    document.getElementById('grid').innerHTML = gridHtml();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modal) { ui.modal = null; ui.disp = null; render(); }
  });

  // 남은 시간 갱신. 끝난 칸이 생기면 다시 그립니다.
  setInterval(() => {
    let finished = false;
    document.querySelectorAll('.timer').forEach((t) => {
      const left = Number(t.dataset.end) - G.now();
      if (left <= 0) finished = true; else t.textContent = fmtTime(left);
    });
    if (finished && !ui.modal) render();
  }, 1000);

  G.load();
  render();
  window.GuildUI = { render, ui };
})();
