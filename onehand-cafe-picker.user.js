// ==UserScript==
// @name         한손 카페 닉네임 수집기 (onehand)
// @namespace    https://github.com/limsj0204/onehand
// @version      1.0.0
// @description  네이버 카페 글 작성자 닉네임을 타이핑 없이 복사/수집해서 룰렛에 붙여넣기 쉽게 해 줍니다.
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

  const DEFAULT_SETTINGS = {
    autoCopy: true,       // 글을 열면 작성자 닉네임을 바로 클립보드에 복사
    autoAdd: false,       // 글을 열면 수집 목록에도 자동 추가
    allowDupNick: false,  // 같은 닉네임 여러 번 추가 허용
    separator: 'NL',      // 전체 복사 구분자 (NL = 줄바꿈)
  };

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

  // ---------------------------------------------------------------- 공통: 선택 모드 (직접 클릭해서 닉네임 집기)

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
    sendToTop({ nick: t, articleId: '', title: '(직접 선택)', manual: true });
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

  const settings = Object.assign({}, DEFAULT_SETTINGS, load('settings', {}));
  let list = load('list', []); // [{nick, articleId, title, at}]
  let current = null;

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== MSG_TYPE) return;
    handleAuthor(e.data);
  });

  function copy(text) {
    GM_setClipboard(text, 'text');
  }

  function handleAuthor(data) {
    if (data.manual) {
      current = data;
      copy(data.nick);
      addToList(data);
      render();
      return;
    }
    current = data;
    if (settings.autoCopy) {
      copy(data.nick);
      toast(`📋 "${data.nick}" 복사됨`);
    }
    if (settings.autoAdd) addToList(data);
    render();
  }

  function addToList(data) {
    if (data.articleId && list.some((x) => x.articleId === data.articleId)) {
      toast(`이미 추가된 글이에요: ${data.nick}`, true);
      return false;
    }
    if (!settings.allowDupNick && list.some((x) => x.nick === data.nick)) {
      toast(`이미 있는 닉네임: ${data.nick}`, true);
      return false;
    }
    list.push({ nick: data.nick, articleId: data.articleId || '', title: data.title || '', at: Date.now() });
    save('list', list);
    toast(`✅ ${data.nick} 추가 (총 ${list.length}명)`);
    return true;
  }

  // ---------------------------------------------------------------- 패널 그리기

  const panel = document.createElement('div');
  panel.id = 'onehand-panel';
  panel.innerHTML = `
    <style>
      #onehand-panel{position:fixed;z-index:2147483647;width:250px;font:13px/1.4 'Malgun Gothic',sans-serif;
        background:#fff;color:#222;border:2px solid #03c75a;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);user-select:none}
      #onehand-panel .oh-head{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#03c75a;color:#fff;
        border-radius:9px 9px 0 0;cursor:move;font-weight:bold}
      #onehand-panel .oh-head span{flex:1}
      #onehand-panel .oh-head button{background:none;border:0;color:#fff;font-size:16px;cursor:pointer;padding:0 4px}
      #onehand-panel .oh-body{padding:8px}
      #onehand-panel.oh-min .oh-body{display:none}
      #onehand-panel .oh-cur{font-size:18px;font-weight:bold;text-align:center;padding:6px;margin-bottom:6px;
        background:#f2fbf5;border-radius:8px;word-break:break-all}
      #onehand-panel .oh-cur small{display:block;font-size:11px;font-weight:normal;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #onehand-panel .oh-btn{display:block;width:100%;margin:4px 0;padding:10px 6px;border:0;border-radius:8px;
        font:bold 15px 'Malgun Gothic',sans-serif;cursor:pointer;background:#03c75a;color:#fff}
      #onehand-panel .oh-btn.sub{background:#e9ecef;color:#222;font-size:13px;padding:7px 6px}
      #onehand-panel .oh-btn.on{background:#ff4d6d;color:#fff}
      #onehand-panel .oh-row{display:flex;gap:4px}
      #onehand-panel .oh-row .oh-btn{flex:1}
      #onehand-panel ol{max-height:180px;overflow:auto;margin:6px 0;padding:0 0 0 26px;background:#fafafa;border-radius:6px}
      #onehand-panel li{padding:2px 4px;display:flex;justify-content:space-between;gap:4px}
      #onehand-panel li button{border:0;background:none;color:#c00;cursor:pointer;font-size:14px;line-height:1}
      #onehand-panel label{display:block;font-size:12px;margin:2px 0;cursor:pointer}
      #onehand-panel .oh-toast{min-height:18px;font-size:12px;text-align:center;color:#03a04a}
      #onehand-panel .oh-toast.warn{color:#d9480f}
      #onehand-panel details summary{cursor:pointer;font-size:12px;color:#555;margin-top:4px}
    </style>
    <div class="oh-head"><span>🖐 한손 닉네임 수집기</span><button data-act="min" title="접기/펴기">—</button></div>
    <div class="oh-body">
      <div class="oh-cur" data-ref="cur">글을 열어 주세요</div>
      <button class="oh-btn" data-act="add">➕ 복사 + 목록에 추가</button>
      <div class="oh-row">
        <button class="oh-btn sub" data-act="copyCur">📋 다시 복사</button>
        <button class="oh-btn sub" data-act="pick">🎯 직접 선택</button>
      </div>
      <div class="oh-toast" data-ref="toast"></div>
      <div><b>수집 목록</b> <span data-ref="count">0</span>명</div>
      <ol data-ref="list"></ol>
      <div class="oh-row">
        <button class="oh-btn sub" data-act="copyAll">📋 전체 복사</button>
        <button class="oh-btn sub" data-act="undo">↩ 마지막 취소</button>
      </div>
      <button class="oh-btn sub" data-act="clear">🗑 목록 비우기</button>
      <details>
        <summary>설정</summary>
        <label><input type="checkbox" data-set="autoCopy"> 글 열면 작성자 자동 복사</label>
        <label><input type="checkbox" data-set="autoAdd"> 글 열면 목록에 자동 추가</label>
        <label><input type="checkbox" data-set="allowDupNick"> 같은 닉네임 중복 허용</label>
        <label>전체 복사 구분자
          <select data-set="separator">
            <option value="NL">줄바꿈</option>
            <option value=",">쉼표(,)</option>
            <option value=", ">쉼표+공백</option>
            <option value=" ">공백</option>
          </select>
        </label>
        <div style="font-size:11px;color:#777;margin-top:4px">단축키: <b>\`</b>(숫자 1 왼쪽) = 복사+추가</div>
      </details>
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

  // 설정 UI
  panel.querySelectorAll('[data-set]').forEach((el) => {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!settings[k];
    else el.value = settings[k];
    el.addEventListener('change', () => {
      settings[k] = el.type === 'checkbox' ? el.checked : el.value;
      save('settings', settings);
    });
  });

  const actions = {
    min() {
      panel.classList.toggle('oh-min');
      save('minimized', panel.classList.contains('oh-min'));
    },
    add() {
      if (!current) return toast('먼저 글을 열어 주세요', true);
      copy(current.nick);
      addToList(current);
      render();
    },
    copyCur() {
      if (!current) return toast('먼저 글을 열어 주세요', true);
      copy(current.nick);
      toast(`📋 "${current.nick}" 복사됨`);
    },
    pick() {
      save('pickMode', !pickMode);
      pickMode = !pickMode;
      document.documentElement.classList.toggle('onehand-picking', pickMode);
      render();
      if (pickMode) toast('닉네임을 클릭하면 바로 추가돼요');
    },
    copyAll() {
      if (!list.length) return toast('목록이 비어 있어요', true);
      copy(list.map((x) => x.nick).join(settings.separator === 'NL' ? '\n' : settings.separator));
      toast(`📋 ${list.length}명 전체 복사됨`);
    },
    undo() {
      const x = list.pop();
      save('list', list);
      render();
      if (x) toast(`↩ ${x.nick} 취소`);
    },
    clear() {
      if (!list.length || !confirm(`수집한 ${list.length}명을 모두 지울까요?`)) return;
      list = [];
      save('list', list);
      render();
    },
  };

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn && actions[btn.dataset.act]) actions[btn.dataset.act]();
    const del = e.target.closest('[data-del]');
    if (del) {
      list.splice(+del.dataset.del, 1);
      save('list', list);
      render();
    }
  });

  // 다른 탭에서 수집한 것도 반영
  GM_addValueChangeListener('list', (_k, _o, v, remote) => { if (remote) { list = v; render(); } });

  // 단축키: ` (Backquote) — 입력창에 글 쓰는 중에는 무시
  function onKey(e) {
    if (e.code !== 'Backquote' || e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    actions.add();
  }
  document.addEventListener('keydown', onKey, true);
  // 글 본문 iframe에 포커스가 있을 때도 단축키가 먹도록
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'onehand-key') actions.add();
  });

  let toastTimer;
  function toast(msg, warn) {
    const el = ref('toast');
    el.textContent = msg;
    el.classList.toggle('warn', !!warn);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.textContent = ''; }, 2500);
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function render() {
    ref('cur').innerHTML = current
      ? `${esc(current.nick)}${current.title ? `<small>${esc(current.title)}</small>` : ''}`
      : '글을 열어 주세요';
    ref('count').textContent = list.length;
    ref('list').innerHTML = list
      .map((x, i) => `<li title="${esc(x.title)}"><span>${esc(x.nick)}</span><button data-del="${i}" title="삭제">✕</button></li>`)
      .join('');
    ref('list').scrollTop = ref('list').scrollHeight;
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
