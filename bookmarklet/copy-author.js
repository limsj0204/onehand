// 북마클릿 원본 (읽기 쉬운 버전). build.js가 이걸 한 줄짜리 javascript: 주소로 만든다.
// 주의: 즐겨찾기 주소로 들어가므로 퍼센트 기호를 쓰지 말 것.
(() => {
  // 글 상단 영역 안에서만 찾아서 댓글 작성자가 잡히지 않게 한다.
  const SELECTORS = [
    '.ArticleTopBox .WriterInfo .nickname',
    '.ArticleTopBox .nick_box .nickname',
    '.ArticleTopBox .nickname',
    '.ArticleTopBox [class*="nick"]',
    '.article_header .nickname',
    '.article_writer .user',
    '.WriterInfo [class*="nick"]',
  ];

  // 글 본문은 보통 iframe(cafe_main) 안에 있으므로 현재 문서와 같은 사이트의 iframe들을 모두 뒤진다.
  const docs = [];
  const collect = (w) => {
    try { docs.push(w.document); } catch (e) { return; }
    for (const f of w.document.querySelectorAll('iframe')) {
      try { if (f.contentWindow) collect(f.contentWindow); } catch (e) {}
    }
  };
  collect(window);

  let nick = '', doc = null;
  for (const d of docs) {
    for (const s of SELECTORS) {
      const el = d.querySelector(s);
      const t = el && el.textContent.replace(/\s+/g, ' ').trim();
      if (t) { nick = t; doc = d; break; }
    }
    if (nick) break;
  }

  const toast = (msg, ok) => {
    const old = document.getElementById('onehand-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'onehand-toast';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;top:20px;left:0;right:0;margin:0 auto;width:fit-content;' +
      'z-index:2147483647;padding:14px 22px;border-radius:12px;font:bold 20px Malgun Gothic,sans-serif;color:#fff;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.3);background:' + (ok ? '#03c75a' : '#e03131');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ok ? 1500 : 3000);
  };

  if (!nick) {
    toast('작성자를 못 찾았어요. 카페 글을 연 상태에서 눌러 주세요.', false);
    return;
  }

  // 1순위: 예전 방식 복사(포커스가 iframe에 있어도 동작). 2순위: Clipboard API. 둘 다 안 되면 직접 복사하도록 띄워 준다.
  const legacyCopy = (d) => {
    const ta = d.createElement('textarea');
    ta.value = nick;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    d.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = d.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  };

  if (legacyCopy(doc) || legacyCopy(document)) {
    toast('📋 ' + nick + '  복사됨', true);
  } else {
    navigator.clipboard.writeText(nick)
      .then(() => toast('📋 ' + nick + '  복사됨', true))
      .catch(() => prompt('자동 복사가 막혔어요. Ctrl+C로 복사해 주세요:', nick));
  }
})();
