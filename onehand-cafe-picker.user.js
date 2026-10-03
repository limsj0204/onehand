// ==UserScript==
// @name         한손 카페 닉네임 복사기 (onehand)
// @namespace    https://github.com/limsj0204/onehand
// @version      1.1.0
// @description  네이버 카페 글 작성자 닉네임을 글을 여는 즉시 클립보드에 복사해서, 타이핑 없이 룰렛에 붙여넣을 수 있게 해 줍니다.
// @match        https://cafe.naver.com/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const IS_TOP = window === window.top;
  const MSG_TYPE = 'onehand-author';

  // 네이버가 화면 구조를 바꿔도 버티도록 여러 후보를 순서대로 시도한다.
  // 댓글 작성자가 잡히지 않도록 글 상단 영역 안에서만 찾는다.
  const AUTHOR_SELECTORS = [
    '.ArticleTopBox .WriterInfo .nickname',
    '.ArticleTopBox .nick_box .nickname',
    '.ArticleTopBox .nickname',
    '.ArticleTopBox [class*="nick"]',
    '.article_header .nickname',
    '.article_writer .user',
    '.WriterInfo [class*="nick"]',
  ];
  const TITLE_SELECTORS = ['.ArticleTopBox .title_text', '.ArticleTopBox h3', '.article_header .title_text'];

  const load = (key, def) => {
    try { return GM_getValue(key, def); } catch (e) { return def; }
  };
  const save = (key, val) => GM_setValue(key, val);

  // ---------------------------------------------------------------- 공통: 작성자 찾기

  function textOf(sel) {
    for (const s of sel) {
      const el = document.querySelector(s);
      const t = el && el.textContent.replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    return '';
  }

  function articleIdOf(href) {
    const m = href.match(/articles\/(\d+)/) || href.match(/[?&]articleid=(\d+)/i);
    return m ? m[1] : '';
  }

  // ---------------------------------------------------------------- 공통: 직접 선택 모드 (클릭한 글자를 복사)

  let pickMode = load('pickMode', false);
  GM_addValueChangeListener('pickMode', (_k, _o, v) => { pickMode = v; document.documentElement.classList.toggle('onehand-picking', v); });
  document.documentElement.classList.toggle('onehand-picking', pickMode);

  const pickStyle = document.createElement('style');
  pickStyle.textContent = `.onehand-picking *:hover{outline:2px dashed #ff4d6d!important;cursor:copy!important}
    .onehand-picking #onehand-panel *:hover{outline:none!important;cursor:auto!important}`;
  (document.head || document.documentElement).appendChild(pickStyle);

  document.addEventListener('click', (e) => {
    if (!pickMode || e.target.closest('#onehand-panel')) return;
    e.preventDefault();
    e.stopPropagation();
    const t = (e.target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!t) return;
    sendToTop({ nick: t, articleId: '', title: '(직접 선택)', picked: true });
  }, true);

  function sendToTop(data) {
    if (IS_TOP) handleAuthor(data);
    else window.top.postMessage({ type: MSG_TYPE, ...data }, location.origin);
  }

  // ---------------------------------------------------------------- 공통: 글이 바뀌는지 감시 (iframe / SPA 모두 대응)

  let lastKey = '';
  function scan() {
    const nick = textOf(AUTHOR_SELECTORS);
    if (!nick) return;
    const articleId = articleIdOf(location.href);
    const key = articleId + '|' + nick;
    if (key === lastKey) return;
    lastKey = key;
    sendToTop({ nick, articleId, title: textOf(TITLE_SELECTORS) });
  }
  setInterval(scan, 600);
  scan();

  if (!IS_TOP) return;

  // ================================================================ 이하 최상위 창 전용: 패널 UI

  // 닉네임별로 그 닉네임이 작성자였던 글 번호들. 다른 글에서 같은 닉네임이 또 나오면 알려 준다.
  let seen = load('seen', {}); // { nick: [articleId, ...] }
  let current = null;

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === MSG_TYPE) handleAuthor(e.data);
    else if (e.data.type === 'onehand-key') recopy();
  });

  function copy(text) {
    GM_setClipboard(text, 'text');
  }

  function handleAuthor(data) {
    current = data;
    copy(data.nick);
    current.dupOf = [];
    if (data.articleId) {
      const ids = seen[data.nick] || [];
      current.dupOf = ids.filter((id) => id !== data.articleId);
      if (!ids.includes(data.articleId)) {
        seen[data.nick] = ids.concat(data.articleId);
        save('seen', seen);
      }
    }
    if (data.picked) setPickMode(false); // 한 번 집으면 자동으로 끄기
    flash();
    render();
  }

  function setPickMode(on) {
    pickMode = on;
    save('pickMode', on);
    document.documentElement.classList.toggle('onehand-picking', on);
  }

  function recopy() {
    if (!current) return;
    copy(current.nick);
    flash();
  }

  // ---------------------------------------------------------------- 패널 그리기

  const panel = document.createElement('div');
  panel.id = 'onehand-panel';
  panel.innerHTML = `
    <style>
      #onehand-panel{position:fixed;z-index:2147483647;width:240px;font:13px/1.4 'Malgun Gothic',sans-serif;
        background:#fff;color:#222;border:2px solid #03c75a;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);user-select:none}
      #onehand-panel .oh-head{display:flex;align-items:center;gap:6px;padding:5px 8px;background:#03c75a;color:#fff;
        border-radius:9px 9px 0 0;cursor:move;font-weight:bold;font-size:12px}
      #onehand-panel .oh-head span{flex:1}
      #onehand-panel .oh-head button{background:none;border:0;color:#fff;font-size:15px;cursor:pointer;padding:0 4px}
      #onehand-panel .oh-body{padding:8px}
      #onehand-panel.oh-min .oh-body{display:none}
      #onehand-panel .oh-cur{text-align:center;padding:8px 6px;border-radius:8px;background:#f2fbf5;transition:background .3s}
      #onehand-panel .oh-cur.flash{background:#b2f2bb}
      #onehand-panel .oh-cur .oh-label{font-size:11px;color:#2b8a3e}
      #onehand-panel .oh-cur .oh-nick{font-size:20px;font-weight:bold;word-break:break-all}
      #onehand-panel .oh-cur small{display:block;font-size:11px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #onehand-panel .oh-dup{margin-top:6px;padding:5px;border-radius:6px;background:#fff4e6;color:#d9480f;font-size:12px;text-align:center}
      #onehand-panel .oh-row{display:flex;gap:4px;margin-top:6px}
      #onehand-panel .oh-btn{flex:1;padding:7px 4px;border:0;border-radius:8px;cursor:pointer;
        font:bold 12px 'Malgun Gothic',sans-serif;background:#e9ecef;color:#222}
      #onehand-panel .oh-btn.on{background:#ff4d6d;color:#fff}
      #onehand-panel .oh-foot{display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#888}
      #onehand-panel .oh-foot a{color:#888;cursor:pointer;text-decoration:underline}
    </style>
    <div class="oh-head"><span>🖐 작성자 자동 복사</span><button data-act="min" title="접기/펴기">—</button></div>
    <div class="oh-body">
      <div class="oh-cur" data-ref="cur"></div>
      <div class="oh-dup" data-ref="dup" hidden></div>
      <div class="oh-row">
        <button class="oh-btn" data-act="recopy">📋 다시 복사</button>
        <button class="oh-btn" data-act="pick">🎯 직접 선택</button>
      </div>
      <div class="oh-foot"><span>\` 키 = 다시 복사</span><a data-act="reset">중복 기록 초기화</a></div>
    </div>`;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const ref = (name) => $(`[data-ref="${name}"]`);

  // 위치 복원 + 드래그
  const pos = load('pos', { right: 16, bottom: 16 });
  Object.assign(panel.style, pos.left != null ? { left: pos.left + 'px', top: pos.top + 'px' } : { right: pos.right + 'px', bottom: pos.bottom + 'px' });
  if (load('minimized', false)) panel.classList.add('oh-min');

  $('.oh-head').addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const move = (ev) => {
      const left = Math.max(0, Math.min(window.innerWidth - r.width, ev.clientX - dx));
      const top = Math.max(0, Math.min(window.innerHeight - 30, ev.clientY - dy));
      Object.assign(panel.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto' });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      save('pos', { left: parseInt(panel.style.left, 10), top: parseInt(panel.style.top, 10) });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  const actions = {
    min() {
      panel.classList.toggle('oh-min');
      save('minimized', panel.classList.contains('oh-min'));
    },
    recopy,
    pick() {
      setPickMode(!pickMode);
      render();
    },
    reset() {
      if (!confirm('중복 닉네임 기록을 지울까요? (새 이벤트를 시작할 때)')) return;
      seen = {};
      save('seen', seen);
      if (current) current.dupOf = [];
      render();
    },
  };

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn && actions[btn.dataset.act]) actions[btn.dataset.act]();
  });

  // 다른 탭에서 본 글도 중복 기록에 반영
  GM_addValueChangeListener('seen', (_k, _o, v, remote) => { if (remote) seen = v; });

  // 단축키: ` (Backquote) = 다시 복사. 입력창에 글 쓰는 중에는 무시
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    recopy();
  }, true);

  let flashTimer;
  function flash() {
    const el = ref('cur');
    el.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.classList.remove('flash'), 400);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function render() {
    ref('cur').innerHTML = current
      ? `<div class="oh-label">✅ 복사됨 — 룰렛에 붙여넣기만 하세요</div><div class="oh-nick">${esc(current.nick)}</div>${current.title ? `<small>${esc(current.title)}</small>` : ''}`
      : '<div class="oh-label">카페 글을 열면 작성자가 자동으로 복사돼요</div>';
    const dup = current && current.dupOf && current.dupOf.length;
    ref('dup').hidden = !dup;
    if (dup) ref('dup').textContent = `⚠ 앞에서 본 다른 글(${current.dupOf.length}개)에도 있던 닉네임이에요`;
    $('[data-act="pick"]').classList.toggle('on', pickMode);
    $('[data-act="pick"]').textContent = pickMode ? '🎯 선택 중(끄기)' : '🎯 직접 선택';
  }
  render();
})();

// iframe 안에서 누른 단축키를 최상위 창으로 전달 (별도 블록: 위 IIFE는 iframe에서 일찍 return 함)
(function () {
  if (window === window.top) return;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    window.top.postMessage({ type: 'onehand-key' }, location.origin);
  }, true);
})();
