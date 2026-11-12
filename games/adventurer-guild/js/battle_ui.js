/* 던전 직접 출격: 화면과 연출. 규칙은 battle.js, 여기서는 그리기만 합니다.
 * 그림(assets/characters/<id>/icon.png, card.png)이 있으면 쓰고, 없으면 임시 카드로 그립니다. */
(function () {
  const G = window.GuildGame, B = window.GuildBattle, D = window.GUILD_DATA;
  const W = B.W, H = B.H, SC = 2;
  const RC = { N: '#8a8fa3', R: '#5aa8ff', SR: '#b57bff', SSR: '#ffc94d' };
  const CLS_COL = { '전사': '#ff7a5a', '기사': '#6fb4ff', '도적': '#c9c9ff', '마법사': '#ff9a3c', '궁수': '#8fe36f', '사제': '#ffe48a', '소환사': '#7ae7ff' };
  const FOE_COL = { slime: '#5fd38a', bat: '#a07bd8', brute: '#d86a5f', boss: '#e0b13f' };

  // ---------- 그림 ----------
  const imgs = {};
  function img(id, kind) {
    const k = id + '/' + kind;
    if (!imgs[k]) {
      const im = new Image();
      im.onload = () => { im._ok = true; }; im.onerror = () => { im._bad = true; };
      im.src = 'assets/characters/' + id + '/' + kind + '.png';
      imgs[k] = im;
    }
    return imgs[k];
  }
  const ok = (im) => im._ok && im.naturalWidth > 0;
  function drawCover(ctx, im, x, y, w, h) {     // object-fit: cover
    const r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const sw = w / r, sh = h / r;
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, 0, sw, sh, x, y, w, h);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- 배경(한 번만 그려 둠) ----------
  const TINT = { sewer: '#1d2a2c', crypt: '#231a33', forge: '#33201a', abyss: '#141a3a' };
  function makeBg(dnId, Hv) {
    const c = document.createElement('canvas'); c.width = W * SC; c.height = Hv * SC;
    const x = c.getContext('2d'); x.scale(SC, SC);
    const g = x.createLinearGradient(0, 0, 0, Hv); g.addColorStop(0, TINT[dnId] || '#1a1426'); g.addColorStop(1, '#0a0810');
    x.fillStyle = g; x.fillRect(0, 0, W, Hv);
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1;
    for (let y = 0; y < Hv; y += 34) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
      for (let xx = ((y / 34) % 2) * 30; xx < W; xx += 60) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 34); x.stroke(); } }
    // 벽 횃불 빛
    [[0, 90], [W, 90], [0, Hv * 0.5], [W, Hv * 0.5]].forEach(([tx, ty]) => {
      const t = x.createRadialGradient(tx, ty, 2, tx, ty, 130); t.addColorStop(0, 'rgba(255,160,70,.32)'); t.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = t; x.fillRect(0, 0, W, Hv);
    });
    // 아군이 서는 바닥
    const fy = Hv - 160, fl = x.createLinearGradient(0, fy, 0, Hv); fl.addColorStop(0, 'rgba(255,255,255,0)'); fl.addColorStop(1, 'rgba(255,255,255,.1)');
    x.fillStyle = fl; x.fillRect(0, fy, W, 160);
    const v = x.createRadialGradient(W / 2, Hv / 2, 140, W / 2, Hv / 2, Math.max(340, Hv * 0.7)); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    x.fillStyle = v; x.fillRect(0, 0, W, Hv);
    return c;
  }

  // ---------- 상태 ----------
  let S = null;   // 진행 중인 전투 화면
  const $ = (sel, root) => (root || document).querySelector(sel);

  function start(dungeonId, party, onClose) {
    if (S) stop();
    const dn = G.dungeonById[dungeonId];
    const el = document.createElement('div');
    el.id = 'battle'; el.className = 'bt';
    el.innerHTML =
      '<div class="bt-hud"><b class="bt-name">' + dn.name + '</b><span class="bt-wave">WAVE 1/3</span>' +
      '<button data-b="auto">자동 OFF</button><button data-b="speed">×1</button><button data-b="quit">후퇴</button></div>' +
      '<div class="bt-field"><canvas width="' + W * SC + '" height="' + H * SC + '"></canvas></div>' +
      '<div class="bt-skills"></div><div class="bt-end" hidden></div>';
    document.body.appendChild(el);
    const canvas = $('canvas', el), ctx = canvas.getContext('2d');
    // 화면이 세로로 길면 전장도 세로로 늘려서 위아래에 빈 띠가 생기지 않게 한다(아군은 늘 아래쪽 기준)
    const fr = $('.bt-field', el).getBoundingClientRect();
    const Hv = Math.round(Math.min(760, Math.max(H, W * fr.height / Math.max(1, fr.width))));
    canvas.width = W * SC; canvas.height = Hv * SC; canvas.style.aspectRatio = W + ' / ' + Hv;
    S = { dnId: dungeonId, dn, party: party.slice(), onClose, el, canvas, ctx, Hv, DY: Hv - H, bg: makeBg(dungeonId, Hv), b: null,
      parts: [], texts: [], fx: [], shake: 0, flash: 0, cutin: null, banner: null, speed: 1, last: 0, raf: 0, ended: false, t: 0 };
    reset();
    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    S.last = performance.now();
    S.raf = requestAnimationFrame(loop);
  }
  function reset() {
    const auto = S.b ? S.b.auto : false;
    S.b = B.create(S.dnId, S.party, { fx: { emit: onEvent }, auto, top: -S.DY });
    S.parts = []; S.texts = []; S.fx = []; S.cutin = null; S.banner = null; S.ended = false; S.shake = 0; S.flash = 0;
    $('.bt-end', S.el).hidden = true;
    buildSkills();
  }
  function stop() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    document.removeEventListener('keydown', onKey);
    S.el.remove(); S = null;
  }

  function buildSkills() {
    const box = $('.bt-skills', S.el);
    box.innerHTML = S.b.allies.map((a, i) =>
      '<button class="sk r-' + a.rarity + '" data-i="' + i + '" style="--col:' + CLS_COL[a.cls] + '">' +
      '<span class="sk-art">' + '</span><span class="sk-nm">' + a.name + '</span><span class="sk-sn">' + a.k.skill + '</span>' +
      '<i class="sk-cd"></i><em class="sk-key">' + (i + 1) + '</em></button>').join('');
    S.b.allies.forEach((a, i) => {      // 그림이 있으면 쓰고, 없으면 직업 기호
      const holder = box.children[i].firstChild, im = new Image();
      im.onload = () => { holder.innerHTML = ''; holder.appendChild(im); };
      im.onerror = () => { holder.textContent = D.CLASSES[a.cls].glyph; };
      holder.textContent = D.CLASSES[a.cls].glyph;
      im.src = 'assets/characters/' + a.id + '/icon.png';
    });
  }

  // ---------- 입력 ----------
  function onClick(e) {
    const sk = e.target.closest('.sk');
    if (sk && S && !S.ended) { B.cast(S.b, Number(sk.dataset.i)); return; }
    const bt = e.target.closest('[data-b]');
    if (!bt || !S) return;
    const k = bt.dataset.b;
    if (k === 'auto') { S.b.auto = !S.b.auto; bt.textContent = '자동 ' + (S.b.auto ? 'ON' : 'OFF'); bt.classList.toggle('on', S.b.auto); }
    else if (k === 'speed') { S.speed = S.speed === 1 ? 2 : 1; bt.textContent = '×' + S.speed; }
    else if (k === 'quit') { if (confirm('후퇴하면 보상이 없습니다. 후퇴할까요?')) close(); }
    else if (k === 'retry') { reset(); }
    else if (k === 'close') { close(); }
  }
  function onKey(e) {
    if (!S) return;
    const n = Number(e.key);
    if (n >= 1 && n <= S.b.allies.length && !S.ended) B.cast(S.b, n - 1);
    else if (e.key === 'a' || e.key === 'A') $('[data-b=auto]', S.el).click();
    else if (e.key === 'Escape') $('[data-b=quit]', S.el).click();
  }
  function close() { const cb = S && S.onClose; stop(); if (cb) cb(); }

  // ---------- 효과 만들기 ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function burst(x, y, n, col, speed, size, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(0.3, 1) * speed;
      S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: grav || 0, life: life * rnd(0.6, 1), max: life, size: rnd(size * 0.6, size), col });
    }
  }
  function text(x, y, str, col, size) { S.texts.push({ x: x + rnd(-8, 8), y, str, col, size: size || 14, life: 0.9, max: 0.9 }); }
  function addFx(dur, fn) { S.fx.push({ age: 0, dur, fn }); }
  const shake = (v) => { S.shake = Math.max(S.shake, v); };

  function onEvent(type, v) {
    if (!S) return;
    switch (type) {
      case 'hit': {
        const col = !v.foe ? '#ff6a6a' : v.kind === 'crit' ? '#ffb347' : v.kind === 'skill' ? '#ff8ad8' : '#fff';
        text(v.x, v.y - 26, String(v.dmg), col, v.kind === 'skill' || v.kind === 'crit' ? 20 : 14);
        burst(v.x, v.y, v.kind === 'skill' ? 10 : 5, v.foe ? '#fff3b0' : '#ff7a7a', 90, 3, 0.4);
        if (v.big) shake(4);
        break;
      }
      case 'attack': {
        const c = CLS_COL[v.from.cls] || '#9ff';
        if (v.ranged) {
          const f = v.from, t = v.to;
          addFx(0.2, (x, p) => { const px = f.x + (t.x - f.x) * p, py = f.y - 20 + (t.y - f.y + 20) * p;
            x.fillStyle = c; x.globalAlpha = 1 - p * 0.3; x.beginPath(); x.arc(px, py, v.spirit ? 5 : 4, 0, 6.283); x.fill(); x.globalAlpha = 1; });
        } else {
          const t = v.to;
          addFx(0.18, (x, p) => { x.strokeStyle = 'rgba(255,255,255,' + (1 - p) + ')'; x.lineWidth = 3; x.beginPath();
            x.arc(t.x, t.y, 20 + p * 8, -2.2 + p, -0.6 + p * 1.2); x.stroke(); });
        }
        break;
      }
      case 'foeattack': {
        const t = v.to;
        addFx(0.15, (x, p) => { x.strokeStyle = 'rgba(255,90,90,' + (1 - p) + ')'; x.lineWidth = 3; x.beginPath(); x.moveTo(t.x - 14, t.y - 22 + p * 6); x.lineTo(t.x + 14, t.y + 4 + p * 6); x.stroke(); });
        break;
      }
      case 'die':
        burst(v.x, v.y, v.boss ? 60 : 16, v.foe ? '#ffd78a' : '#9aa', v.boss ? 220 : 120, v.boss ? 6 : 4, v.boss ? 1.1 : 0.6);
        if (v.boss) { shake(12); S.flash = 0.8; }
        break;
      case 'wave':
        S.banner = { str: v.boss ? 'BOSS' : 'WAVE ' + v.n, boss: v.boss, t: 0 };
        break;
      case 'cutin':
        S.cutin = { unit: v.unit, skill: v.skill, dur: v.dur };
        break;
      case 'release':
        S.flash = 0.5; shake(5);
        break;
      case 'chain':
        text(v.x, v.y - 50, '연계!', '#ffd34d', 22);
        addFx(0.5, (x, p) => { x.fillStyle = 'rgba(255,211,77,' + (0.35 * (1 - p)) + ')'; x.fillRect(0, -S.DY, W, S.Hv); });
        break;
      case 'slash':
        addFx(0.55, (x, p) => {
          x.save(); x.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) { const q = Math.max(0, Math.min(1, p * 2 - i * 0.25)); if (q <= 0) continue;
            x.strokeStyle = 'rgba(255,170,120,' + (1 - q) + ')'; x.lineWidth = 10 - i * 2;
            x.beginPath(); x.arc(v.x, v.y, 70 + i * 14, -2.6 + i * 0.3 + q * 0.8, -0.6 + i * 0.3 + q * 1.6); x.stroke(); }
          x.strokeStyle = 'rgba(255,255,255,' + (1 - p) + ')'; x.lineWidth = 3;
          x.beginPath(); x.moveTo(v.x - 90 + p * 40, v.y + 70 - p * 40); x.lineTo(v.x + 90 + p * 40, v.y - 70 - p * 40); x.stroke(); x.restore();
        });
        burst(v.x, v.y, 26, '#ffb07a', 240, 4, 0.6); shake(9);
        break;
      case 'shield': {
        const u = v.unit; shake(3);
        addFx(0.6, (x, p) => { x.strokeStyle = 'rgba(120,190,255,' + (1 - p) + ')'; x.lineWidth = 6; x.beginPath(); x.arc(u.x, u.y - 20, 30 + p * 120, 0, 6.283); x.stroke(); });
        burst(u.x, u.y - 20, 18, '#9fd0ff', 150, 4, 0.7);
        break;
      }
      case 'stab': {
        const hue = v.n % 2 ? 1 : -1;
        addFx(0.25, (x, p) => { x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(210,210,255,' + (1 - p) + ')'; x.lineWidth = 4;
          x.beginPath(); x.moveTo(v.x - 40 * hue, v.y - 40); x.lineTo(v.x + 40 * hue, v.y + 40); x.stroke(); x.restore(); });
        burst(v.x, v.y, 6, '#d0d0ff', 160, 3, 0.35); shake(2);
        break;
      }
      case 'fireball': {
        const f = v.from;
        addFx(0.4, (x, p) => {
          const px = f.x + (v.x - f.x) * p, py = f.y - 20 + (v.y - f.y + 20) * p - Math.sin(p * 3.14) * 40;
          x.save(); x.globalCompositeOperation = 'lighter';
          const g = x.createRadialGradient(px, py, 2, px, py, 22); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ff9a3c'); g.addColorStop(1, 'rgba(255,80,0,0)');
          x.fillStyle = g; x.beginPath(); x.arc(px, py, 22, 0, 6.283); x.fill(); x.restore();
          if (Math.random() < 0.8) S.parts.push({ x: px, y: py, vx: rnd(-20, 20), vy: rnd(-20, 20), g: 0, life: 0.3, max: 0.3, size: 4, col: '#ff9a3c' });
        });
        break;
      }
      case 'explosion':
        addFx(0.6, (x, p) => {
          x.save(); x.globalCompositeOperation = 'lighter';
          const r = v.r * (0.4 + p * 0.9), g = x.createRadialGradient(v.x, v.y, 0, v.x, v.y, r);
          g.addColorStop(0, 'rgba(255,240,180,' + (1 - p) + ')'); g.addColorStop(0.5, 'rgba(255,120,30,' + (0.8 * (1 - p)) + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
          x.fillStyle = g; x.beginPath(); x.arc(v.x, v.y, r, 0, 6.283); x.fill();
          x.strokeStyle = 'rgba(255,200,120,' + (1 - p) + ')'; x.lineWidth = 4; x.beginPath(); x.arc(v.x, v.y, r * 1.05, 0, 6.283); x.stroke(); x.restore();
        });
        burst(v.x, v.y, 40, '#ff9a3c', 260, 5, 0.8, 200); shake(10); S.flash = 0.35;
        break;
      case 'arrow': {
        const f = v.from;
        addFx(0.18, (x, p) => { const y0 = v.y - 160, py = y0 + (v.y - y0) * p, px = v.x + (1 - p) * 30;
          x.strokeStyle = 'rgba(200,255,170,' + (1 - p * 0.5) + ')'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - (1 - p) * 8, py - 22); x.lineTo(px, py); x.stroke(); });
        burst(v.x, v.y, 4, '#c8ffaa', 80, 3, 0.3);
        break;
      }
      case 'heal':
        addFx(0.8, (x, p) => { x.save(); x.globalCompositeOperation = 'lighter';
          const g = x.createLinearGradient(0, v.y - 110, 0, v.y + 10); g.addColorStop(0, 'rgba(255,240,150,0)'); g.addColorStop(1, 'rgba(255,240,150,' + (0.7 * (1 - p)) + ')');
          x.fillStyle = g; x.fillRect(v.x - 22 + p * 6, v.y - 110, 44 - p * 12, 120); x.restore(); });
        burst(v.x, v.y, 10, '#fff2a0', 70, 3, 0.9, -60);
        text(v.x, v.y - 40, '+' + v.amt, '#7dff9a', 16);
        break;
      case 'summon':
        burst(v.x, v.y, 14, '#7ae7ff', 120, 4, 0.7);
        addFx(0.5, (x, p) => { x.strokeStyle = 'rgba(122,231,255,' + (1 - p) + ')'; x.lineWidth = 3; x.beginPath(); x.arc(v.x, v.y, 10 + p * 34, 0, 6.283); x.stroke(); });
        break;
      case 'over':
        setTimeout(() => finish(v.win), 900);
        break;
    }
  }

  // ---------- 끝 ----------
  function finish(win) {
    if (!S || S.ended) return;
    S.ended = true;
    const r = G.grantBattle(S.dnId, win);
    const end = $('.bt-end', S.el);
    end.hidden = false;
    end.innerHTML = '<div class="bt-card"><h2 class="' + (win ? 'win' : 'lose') + '">' + (win ? '던전 돌파!' : '전멸…') + '</h2>' +
      '<p>' + S.dn.name + (win ? ' · ' + Math.round(S.b.time) + '초 · 연계 ' + S.b.chains + '회' : '') + '</p>' +
      '<div class="gain">🪙 +' + r.gold + (r.tk ? ' &nbsp; 🎟 +' + r.tk : '') + '</div>' +
      (r.first ? '<p class="first">첫 돌파 보너스 포함!</p>' : '') +
      '<div class="btns"><button class="btn ghost" data-b="close">돌아가기</button><button class="btn gold" data-b="retry">다시 도전</button></div></div>';
  }

  // ---------- 그리기 ----------
  function drawFoe(ctx, f, t) {
    const col = f.hitT > 0 ? '#ffffff' : FOE_COL[f.type];
    const bob = Math.sin(t * 5 + f.x) * 2, x = f.x, y = f.y + bob, r = f.r;
    ctx.save();
    if (!f.alive) ctx.globalAlpha = Math.max(0, f.hitT / 0.12);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, f.y + r * 0.8, r * 0.9, r * 0.3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = col;
    if (f.type === 'bat') {
      const w = Math.sin(t * 18 + f.x) * 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y - 10 + w); ctx.lineTo(x - 14, y + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y - 10 + w); ctx.lineTo(x + 14, y + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 6.283); ctx.fill();
    } else if (f.type === 'slime') {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.78 + Math.sin(t * 4 + f.x) * 0.06), 0, Math.PI, 0); ctx.lineTo(x + r, y + r * 0.6); ctx.lineTo(x - r, y + r * 0.6); ctx.closePath(); ctx.fill();
    } else {
      rrect(ctx, x - r, y - r, r * 2, r * 2, r * 0.45); ctx.fill();
      if (f.type === 'boss') { // 뿔과 왕관
        ctx.fillStyle = f.hitT > 0 ? '#fff' : '#b83a2e';
        ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.7); ctx.lineTo(x - r * 1.1, y - r * 1.5); ctx.lineTo(x - r * 0.3, y - r * 0.9); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + r * 0.8, y - r * 0.7); ctx.lineTo(x + r * 1.1, y - r * 1.5); ctx.lineTo(x + r * 0.3, y - r * 0.9); ctx.fill();
        ctx.fillStyle = f.hitT > 0 ? '#fff' : '#ffd34d'; ctx.fillRect(x - r * 0.5, y - r * 1.15, r, r * 0.3);
      }
    }
    if (f.hitT <= 0 && f.alive) { // 눈
      ctx.fillStyle = f.type === 'boss' ? '#ff3a3a' : '#1b1424';
      ctx.fillRect(x - r * 0.4, y - r * 0.15, r * 0.22, r * 0.3); ctx.fillRect(x + r * 0.18, y - r * 0.15, r * 0.22, r * 0.3);
    }
    ctx.restore();
    if (f.alive) bar(ctx, x, y - r - 12, Math.max(26, r * 1.6), f.hp / f.max, '#ff5b5b');
  }
  function bar(ctx, cx, y, w, p, col) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = col; ctx.fillRect(cx - w / 2, y, w * Math.max(0, p), 4);
  }
  function drawAlly(ctx, a, t) {
    const w = 52, h = 70;
    let ox = 0, oy = Math.sin(t * 3 + a.x) * 1.5;
    if (a.lunge > 0) oy -= Math.sin(a.lunge / 0.15 * 3.14) * (a.k.range > 100 ? 3 : 12);
    const x = a.x + ox, y = a.y + oy;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 28, 8, 0, 0, 6.283); ctx.fill();
    ctx.save();
    if (!a.alive) ctx.globalAlpha = 0.35;
    const im = img(a.id, 'icon');
    ctx.save(); rrect(ctx, x - w / 2, y - h, w, h, 8); ctx.clip();
    if (ok(im)) drawCover(ctx, im, x - w / 2, y - h, w, h);
    else {
      const g = ctx.createLinearGradient(0, y - h, 0, y); const c = RC[a.rarity];
      g.addColorStop(0, '#3a3358'); g.addColorStop(1, '#1b1830'); ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = CLS_COL[a.cls]; ctx.font = '30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(D.CLASSES[a.cls].glyph, x, y - h / 2 + 8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(a.name, x, y - 6);
    }
    if (a.hitT > 0) { ctx.fillStyle = 'rgba(255,60,60,.45)'; ctx.fillRect(x - w / 2, y - h, w, h); }
    ctx.restore();
    ctx.strokeStyle = RC[a.rarity]; ctx.lineWidth = 2; rrect(ctx, x - w / 2, y - h, w, h, 8); ctx.stroke();
    ctx.restore();
    if (a.alive) bar(ctx, a.x, y - h - 9, 46, a.hp / a.max, '#62d394');
  }
  function drawCutin(ctx, b) {
    const c = S.cutin; if (!c) return;
    const p = 1 - b.pause / b.pauseMax;                 // 0 → 1
    const inn = Math.min(1, p / 0.22), out = p > 0.82 ? (p - 0.82) / 0.18 : 0;
    const e = 1 - Math.pow(1 - inn, 3), a = (1 - out);
    const u = c.unit, col = RC[u.rarity], top = 170, bh = 170;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + 0.62 * a + ')'; ctx.fillRect(0, 0, W, S.Hv);
    ctx.globalAlpha = a;
    // 대각선 띠
    ctx.translate((1 - e) * -W, 0);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20, top + 20); ctx.lineTo(W + 20, top - 10); ctx.lineTo(W + 20, top + bh - 30); ctx.lineTo(-20, top + bh); ctx.closePath(); ctx.globalAlpha = 0.9 * a; ctx.fill();
    ctx.fillStyle = 'rgba(10,8,20,.8)'; ctx.beginPath(); ctx.moveTo(-20, top + 32); ctx.lineTo(W + 20, top + 2); ctx.lineTo(W + 20, top + bh - 42); ctx.lineTo(-20, top + bh - 12); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = a;
    // 집중선
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const y = top + 8 + (i * 37 % bh), l = 40 + (i * 53 % 120); ctx.beginPath(); ctx.moveTo(W - ((p * 700 + i * 90) % (W + 120)), y); ctx.lineTo(W - ((p * 700 + i * 90) % (W + 120)) + l, y); ctx.stroke(); }
    // 초상: 카드 그림이 있으면 쓰고, 없으면 큰 기호
    const im = img(u.id, 'card');
    ctx.save(); ctx.beginPath(); ctx.moveTo(-20, top - 60); ctx.lineTo(W + 20, top - 90); ctx.lineTo(W + 20, top + bh + 20); ctx.lineTo(-20, top + bh + 50); ctx.closePath(); ctx.clip();
    if (ok(im)) { const ph = 340, pw = ph * 0.75; ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * 0.8, -10 + (1 - e) * 40, top - 100, pw, ph * 0.8 + 40); }
    else { ctx.fillStyle = col; ctx.globalAlpha = 0.35 * a; ctx.font = '170px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(D.CLASSES[u.cls].glyph, 6, top + 125); ctx.globalAlpha = a; }
    ctx.restore();
    // 글자
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = col; ctx.fillText(u.rarity + ' · ' + u.cls + ' ' + u.name, W - 18, top + 62);
    ctx.font = 'italic 900 34px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#14101f'; ctx.strokeText(c.skill, W - 18, top + 104);
    ctx.fillStyle = '#fff'; ctx.fillText(c.skill, W - 18, top + 104);
    ctx.restore();
  }
  function draw(ctx, b, t) {
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    ctx.save();
    if (S.shake > 0) ctx.translate(rnd(-S.shake, S.shake), rnd(-S.shake, S.shake));
    ctx.drawImage(S.bg, 0, 0, W, S.Hv);
    ctx.save(); ctx.translate(0, S.DY);     // 이후는 전투 좌표(아군이 아래쪽 기준)
    // 그림자 순서: y가 작은(먼) 것부터
    const units = [].concat(b.foes.map((f) => ({ y: f.y, f })), b.allies.map((a) => ({ y: a.y, a })));
    units.sort((p, q) => p.y - q.y).forEach((u) => (u.f ? drawFoe(ctx, u.f, t) : drawAlly(ctx, u.a, t)));
    // 방벽
    if (b.shieldT > 0 && b.taunt) {
      const k = b.taunt; ctx.save(); ctx.strokeStyle = 'rgba(120,190,255,' + (0.5 + Math.sin(t * 8) * 0.2) + ')'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(120,190,255,.12)';
      ctx.beginPath(); ctx.arc(k.x, k.y - 30, 52, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    // 정령
    b.spirits.forEach((s, i) => {
      const y = s.y + Math.sin(t * 4 + i) * 4; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, y, 1, s.x, y, 16); g.addColorStop(0, '#e8ffff'); g.addColorStop(0.5, 'rgba(122,231,255,.8)'); g.addColorStop(1, 'rgba(122,231,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, y, 16, 0, 6.283); ctx.fill(); ctx.restore();
    });
    // 연출
    S.fx.forEach((f) => { ctx.save(); f.fn(ctx, Math.min(1, f.age / f.dur)); ctx.restore(); });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    S.parts.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); });
    ctx.restore();
    S.texts.forEach((x) => { ctx.globalAlpha = Math.min(1, x.life / x.max * 1.6); ctx.font = 'bold ' + x.size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(x.str, x.x, x.y); ctx.fillStyle = x.col; ctx.fillText(x.str, x.x, x.y); ctx.globalAlpha = 1; });
    ctx.restore();                           // 전투 좌표 끝, 이후는 화면 좌표
    if (S.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + S.flash + ')'; ctx.fillRect(0, 0, W, S.Hv); }
    if (S.banner) { const bn = S.banner, a = Math.min(1, bn.t / 0.25) * (bn.t > 1.2 ? Math.max(0, 1 - (bn.t - 1.2) / 0.4) : 1);
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'italic 900 ' + (bn.boss ? 46 : 36) + 'px sans-serif'; ctx.lineWidth = 7; ctx.strokeStyle = '#14101f'; ctx.strokeText(bn.str, W / 2, 190);
      ctx.fillStyle = bn.boss ? '#ff6a5a' : '#fff'; ctx.fillText(bn.str, W / 2, 190); ctx.globalAlpha = 1; }
    ctx.restore();
    if (b.pause > 0) drawCutin(ctx, b);
  }

  function loop(now) {
    if (!S) return;
    const real = Math.min(0.05, (now - S.last) / 1000); S.last = now; S.t += real;
    const b = S.b;
    if (!S.ended || true) {
      let rem = b.pause > 0 ? real : real * S.speed;
      while (rem > 1e-6) { const d = Math.min(1 / 30, rem); B.step(b, d); rem -= d; }
    }
    // 연출 갱신은 컷인 중에는 멈춥니다(정지한 화면 위에 컷인)
    if (b.pause <= 0) {
      const dt = real * S.speed;
      S.fx.forEach((f) => { f.age += dt; }); S.fx = S.fx.filter((f) => f.age < f.dur);
      S.parts.forEach((p) => { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }); S.parts = S.parts.filter((p) => p.life > 0);
      S.texts.forEach((x) => { x.life -= dt; x.y -= 28 * dt; }); S.texts = S.texts.filter((x) => x.life > 0);
      S.shake = Math.max(0, S.shake - 30 * dt); S.flash = Math.max(0, S.flash - 2 * dt);
      if (S.banner) { S.banner.t += dt; if (S.banner.t > 1.6) S.banner = null; }
    }
    draw(S.ctx, b, S.t);
    // HUD
    $('.bt-wave', S.el).textContent = 'WAVE ' + Math.min(b.wave, 3) + '/3';
    Array.from($('.bt-skills', S.el).children).forEach((btn, i) => {
      const a = b.allies[i];
      btn.style.setProperty('--p', a.alive ? (1 - a.cd / a.cdMax) : 0);
      btn.classList.toggle('ready', a.alive && a.cd <= 0 && !b.over);
      btn.classList.toggle('dead', !a.alive);
    });
    S.raf = requestAnimationFrame(loop);
  }

  window.GuildBattleUI = { start, stop };
})();
