/* 流光 · 交互逻辑
   纯原生 JS，无依赖。四个视图：排行榜 / 推荐 / 分类 / 收藏，
   一个搜索框贯穿全部视图，一个详情面板。 */

(() => {
  'use strict';

  const BOOKS = window.BOOKS || [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 本地收藏 ----------
  const FAV_KEY = 'liuguang-favs';
  const loadFavs = () => {
    try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return new Set(Array.isArray(v) ? v : []); }
    catch { return new Set(); }
  };
  const favs = loadFavs();
  const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch {} };
  const key = (b) => b.t + '|' + b.a;

  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 3.1C19.5 15.3 12 20 12 20z"/></svg>';
  const HEART_FILL = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-8-5-8-10.2A4.8 4.8 0 0 1 12 6.9a4.8 4.8 0 0 1 8 3.4c0 5.2-8 10.2-8 10.2z"/></svg>';

  // ---------- 高亮 ----------
  function hl(text, q) {
    const t = esc(text);
    if (!q) return t;
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return t.replace(new RegExp(pattern, 'gi'), (m) => `<mark>${m}</mark>`); }
    catch { return t; }
  }

  // ---------- 搜索匹配 ----------
  function match(b, q) {
    if (!q) return true;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [b.t, b.a, b.c, b.k, ...(b.tags || [])]
      .join(' ').toLowerCase().includes(s);
  }
  function scoreHit(b, q) {
    if (!q) return 0;
    const s = q.trim().toLowerCase();
    if (!s) return 0;
    let n = 0;
    if (b.t.toLowerCase().includes(s)) n += 10;
    if (b.a.toLowerCase().includes(s)) n += 6;
    if (b.c.toLowerCase().includes(s)) n += 4;
    if ((b.tags || []).some((t) => t.toLowerCase().includes(s))) n += 3;
    if (b.k.toLowerCase().includes(s)) n += 1;
    return n;
  }

  // ---------- 状态 ----------
  const state = { view: 'rank', sort: 'heat', cat: '全部', q: '', heroIndex: 0 };

  // ---------- 卡片 ----------
  function cardHTML(b, q, i) {
    const on = favs.has(key(b));
    return `<article class="card" data-k="${esc(key(b))}" style="animation-delay:${Math.min(i * 26, 320)}ms" tabindex="0" role="button" aria-label="查看《${esc(b.t)}》">
      <button class="heart ${on ? 'is-on' : ''}" data-fav="${esc(key(b))}" aria-label="收藏" aria-pressed="${on}">${on ? HEART_FILL : HEART}</button>
      <div class="card-tag"><span>${esc(b.c)}</span><span class="card-rate">${b.r.toFixed(1)}</span></div>
      <h3>${hl(b.t, q)}</h3>
      <div class="author">${hl(b.a, q)}</div>
      <div class="kicker">${hl(b.k, q)}</div>
    </article>`;
  }

  function rankHTML(b, i, q) {
    const n = i + 1;
    const metric = state.sort === 'r' ? b.r.toFixed(1)
      : state.sort === 'fav' ? b.fav
      : state.sort === 'y' ? b.y : b.heat;
    const label = state.sort === 'r' ? '评分' : state.sort === 'fav' ? '万收藏' : state.sort === 'y' ? '年份' : '热度';
    return `<li class="rank-row" data-k="${esc(key(b))}" style="animation-delay:${Math.min(i * 22, 300)}ms" tabindex="0" role="button" aria-label="第${n}名《${esc(b.t)}》">
      <div class="rank-no" data-n="${n}">${n}</div>
      <div class="rank-info">
        <div class="rank-title"><strong>${hl(b.t, q)}</strong><span>${hl(b.a, q)}</span></div>
        <div class="rank-meta"><b>${b.c}</b><span>${b.s}</span><span>${b.w}万字</span></div>
        ${state.sort === 'heat' ? `<div class="heat-bar"><i style="width:${b.heat}%"></i></div>` : ''}
      </div>
      <div class="rank-score"><b>${esc(String(metric))}</b><span>${label}</span></div>
    </li>`;
  }

  // ---------- 渲染 ----------
  const rankList = $('#rank-list');
  const recGrid = $('#rec-grid');
  const catGrid = $('#cat-grid');
  const favGrid = $('#fav-grid');
  const hero = $('#hero');

  function q_() { return state.q.trim(); }

  function renderRank() {
    const q = q_();
    const list = BOOKS.filter((b) => match(b, q));
    const s = state.sort;
    list.sort((a, b) => {
      if (q) { const d = scoreHit(b, q) - scoreHit(a, q); if (d) return d; }
      return s === 'r' ? b.r - a.r : s === 'fav' ? b.fav - a.fav : s === 'y' ? b.y - a.y : b.heat - a.heat;
    });
    const top = list.slice(0, 50);
    rankList.innerHTML = top.map((b, i) => rankHTML(b, i, q)).join('');
    if (!top.length) rankList.innerHTML = `<li class="empty">没有匹配「${esc(q)}」的书。</li>`;
  }

  function renderRec() {
    const q = q_();
    const pool = BOOKS.filter((b) => match(b, q));
    if (!pool.length) { hero.innerHTML = `<div class="empty">没有匹配「${esc(q)}」的书。</div>`; recGrid.innerHTML = ''; return; }

    // 精选：热度 + 评分加权
    const scored = [...pool].sort((a, b) => (b.heat * 0.6 + b.r * 8) - (a.heat * 0.6 + a.r * 8));
    const pick = scored[state.heroIndex % Math.min(scored.length, 8)];
    hero.innerHTML = `
      <button class="shuffle" id="shuffle" aria-label="换一本">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
      </button>
      <div class="hero-inner">
        <div class="eyebrow">今日推荐 · ${esc(pick.c)}</div>
        <h3>${hl(pick.t, q)}</h3>
        <div class="by">${hl(pick.a, q)}　·　${pick.s}　·　${pick.w}万字</div>
        <p class="quote">「${hl(pick.k, q)}」</p>
        <div class="stats">
          <div class="stat"><b>${pick.r.toFixed(1)}</b><span>评分</span></div>
          <div class="stat"><b>${pick.heat}</b><span>热度</span></div>
          <div class="stat"><b>${pick.fav}万</b><span>收藏</span></div>
        </div>
      </div>`;
    hero.dataset.k = key(pick);

    const rest = scored.filter((b) => key(b) !== key(pick)).slice(0, 12);
    recGrid.innerHTML = rest.map((b, i) => cardHTML(b, q, i)).join('');
  }

  function renderCat() {
    const q = q_();
    let pool = BOOKS.filter((b) => match(b, q));
    if (state.cat !== '全部') pool = pool.filter((b) => b.c === state.cat);
    const total = state.cat === '全部' ? BOOKS.length : BOOKS.filter((b) => b.c === state.cat).length;
    const base = state.cat === '全部' ? '全部' : state.cat;
    $('#cat-hint').textContent = q
      ? `「${q}」· 命中 ${pool.length} 本（${base}共 ${total} 本）`
      : state.cat === '全部'
        ? `全部 ${BOOKS.length} 本`
        : `${state.cat} · ${pool.length} 本`;
    pool.sort((a, b) => (q ? scoreHit(b, q) - scoreHit(a, q) : 0) || b.r - a.r);
    catGrid.innerHTML = pool.map((b, i) => cardHTML(b, q, i)).join('');
    if (!pool.length) catGrid.innerHTML = `<p class="empty">没有匹配的书，换个关键词或分类试试。</p>`;
  }

  function renderFav() {
    const q = q_();
    const pool = BOOKS.filter((b) => favs.has(key(b)) && match(b, q));
    $('#fav-hint').textContent = favs.size ? `共 ${favs.size} 本` : '还没有收藏';
    $('#fav-empty').hidden = favs.size > 0;
    favGrid.innerHTML = pool.map((b, i) => cardHTML(b, q, i)).join('');
    $('#fav-count').textContent = String(favs.size);
  }

  function renderChips() {
    const cats = ['全部', ...new Set(BOOKS.map((b) => b.c))];
    $('#chips').innerHTML = cats.map((c) =>
      `<button class="chip ${c === state.cat ? 'is-on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }

  function render() {
    if (state.view === 'rank') renderRank();
    else if (state.view === 'rec') renderRec();
    else if (state.view === 'cat') renderCat();
    else renderFav();
    $('#fav-count').textContent = String(favs.size);
  }

  // ---------- 视图切换 ----------
  function moveGlider() {
    const on = $('.tab.is-on');
    const g = $('#glider');
    if (!on || !g) return;
    g.style.width = on.offsetWidth + 'px';
    g.style.transform = `translateX(${on.offsetLeft - 5}px)`;
  }

  function setView(v) {
    state.view = v;
    $$('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('is-on', s.id === 'view-' + v));
    moveGlider();
    render();
  }

  // ---------- 详情面板 ----------
  const sheet = $('#sheet');
  const scrim = $('#scrim');
  let lastFocus = null;

  function openSheet(b) {
    const on = favs.has(key(b));
    $('#sheet-body').innerHTML = `
      <div class="sb-tag">${esc(b.c)}${b.s === '连载' ? ' · 连载中' : ''}</div>
      <h2 class="sb-title" id="sheet-title">${esc(b.t)}</h2>
      <div class="sb-by">${esc(b.a)}　·　${b.y} 年　·　${b.w} 万字</div>
      <div class="sb-stats">
        <div class="sb-stat"><b>${b.r.toFixed(1)}</b><span>评分</span></div>
        <div class="sb-stat"><b>${b.heat}</b><span>热度</span></div>
        <div class="sb-stat"><b>${b.fav}万</b><span>收藏</span></div>
        <div class="sb-stat"><b>${b.w}</b><span>万字</span></div>
      </div>
      <p class="sb-quote">「${esc(b.k)}」</p>
      <p class="sb-desc">${esc(b.d)}</p>
      <div class="sb-tags">${(b.tags || []).map((t) => `<span class="sb-tag-pill">${esc(t)}</span>`).join('')}</div>
      <div class="sb-actions">
        <button class="btn primary" id="sb-close-btn">知道了</button>
        <button class="btn ${on ? 'is-on' : ''}" id="sb-fav" data-fav="${esc(key(b))}" aria-pressed="${on}">
          ${on ? HEART_FILL : HEART} <span>${on ? '已收藏' : '收藏'}</span>
        </button>
      </div>`;
    lastFocus = document.activeElement;
    scrim.hidden = false;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#sheet-close').focus?.();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { scrim.hidden = true; }, 260);
    lastFocus?.focus?.();
  }

  // ---------- 收藏切换 ----------
  function toggleFav(k) {
    if (favs.has(k)) favs.delete(k); else favs.add(k);
    saveFavs();
    $('#fav-count').textContent = String(favs.size);
    // 就地更新按钮外观
    $$(`[data-fav="${CSS.escape(k)}"]`).forEach((el) => {
      const on = favs.has(k);
      if (el.classList.contains('heart')) {
        el.classList.toggle('is-on', on);
        el.innerHTML = on ? HEART_FILL : HEART;
        el.setAttribute('aria-pressed', String(on));
      } else if (el.id === 'sb-fav') {
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', String(on));
        el.innerHTML = `${on ? HEART_FILL : HEART} <span>${on ? '已收藏' : '收藏'}</span>`;
      }
    });
    if (state.view === 'fav') renderFav();
  }

  // ---------- 事件 ----------
  const byKey = new Map(BOOKS.map((b) => [key(b), b]));

  document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }

    const tab = e.target.closest('.tab');
    if (tab) { setView(tab.dataset.view); return; }

    const seg = e.target.closest('.seg-btn');
    if (seg) {
      state.sort = seg.dataset.sort;
      $$('.seg-btn').forEach((b) => b.classList.toggle('is-on', b === seg));
      renderRank(); return;
    }

    const chip = e.target.closest('.chip');
    if (chip) {
      state.cat = chip.dataset.cat;
      $$('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
      renderCat(); return;
    }

    if (e.target.closest('#shuffle')) {
      state.heroIndex = (state.heroIndex + 1) % 8;
      renderRec(); return;
    }

    const hit = e.target.closest('.rank-row, .card, .hero');
    if (hit) {
      const b = byKey.get(hit.dataset.k) || (hit.id === 'hero' ? byKey.get(hit.dataset.k) : null);
      if (b) openSheet(b);
      return;
    }

    if (e.target.closest('#sb-close-btn') || e.target.closest('#sheet-close')) { closeSheet(); return; }
    if (e.target.closest('#scrim')) { closeSheet(); return; }

    if (e.target.closest('#q-clear')) {
      $('#q').value = ''; state.q = ''; $('#q-clear').hidden = true; render(); return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.card, .rank-row')) {
      e.preventDefault();
      const b = byKey.get(e.target.dataset.k);
      if (b) openSheet(b);
    }
    if (e.key === '/' && document.activeElement !== $('#q')) {
      e.preventDefault(); $('#q').focus();
    }
  });

  const qInput = $('#q');
  let qTimer;
  qInput.addEventListener('input', () => {
    state.q = qInput.value;
    $('#q-clear').hidden = !state.q;
    clearTimeout(qTimer);
    qTimer = setTimeout(render, 90);
  });
  qInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { qInput.value = ''; state.q = ''; $('#q-clear').hidden = true; render(); qInput.blur(); }
    if (e.key === 'Enter') {
      // 回车跳到分类视图看全部命中
      state.q = qInput.value;
      if (state.q.trim()) { setView('cat'); state.cat = '全部'; renderChips(); renderCat(); }
    }
  });

  // ---------- 启动 ----------
  $('#total').textContent = String(BOOKS.length);
  renderChips();
  setView('rank');
  requestAnimationFrame(() => { moveGlider(); });
  window.addEventListener('resize', moveGlider);
  window.addEventListener('load', moveGlider);
})();
