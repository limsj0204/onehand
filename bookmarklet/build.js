// copy-author.js → 한 줄짜리 북마클릿(bookmarklet.txt)과 끌어다 놓는 설치 페이지(install.html)를 만든다.
// 사용법: node bookmarklet/build.js
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'copy-author.js'), 'utf8');
if (src.includes('%')) throw new Error('copy-author.js에 퍼센트 기호가 있으면 즐겨찾기 주소에서 깨집니다');

const code = src
  .split('\n')
  .filter((l) => !/^\s*\/\//.test(l)) // 주석 줄 제거
  .map((l) => l.trim())
  .join(' ')
  .replace(/\s{2,}/g, ' ')
  .trim();
const bookmarklet = 'javascript:' + code;
fs.writeFileSync(path.join(__dirname, 'bookmarklet.txt'), bookmarklet + '\n');

const attr = bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>작성자 복사 버튼 설치</title>
<style>
  body{font:16px/1.6 'Malgun Gothic',sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#222;background:#fff}
  .bm{display:inline-block;padding:14px 26px;margin:16px 0;border-radius:12px;background:#03c75a;color:#fff;
    font-size:22px;font-weight:bold;text-decoration:none;cursor:grab;box-shadow:0 4px 14px rgba(0,0,0,.2)}
  ol li{margin:6px 0} kbd{background:#eee;border-radius:4px;padding:1px 6px;border:1px solid #ccc}
  textarea{width:100%;height:90px;font-size:12px}
</style></head><body>
<h1>📋 작성자 복사 버튼 설치</h1>
<p>아래 초록 버튼을 <b>마우스로 잡고 크롬 북마크바(주소창 바로 아래)로 끌어다 놓으세요.</b></p>
<a class="bm" href="${attr}" onclick="alert('여기서 누르는 게 아니라, 북마크바로 끌어다 놓아 주세요!');return false;">작성자 복사</a>
<ol>
  <li>북마크바가 안 보이면 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd></li>
  <li>네이버 카페 글을 연 상태에서 북마크바의 <b>작성자 복사</b>를 클릭</li>
  <li>화면 위에 초록색 "📋 닉네임 복사됨"이 뜨면 룰렛에 붙여넣기</li>
</ol>
<details><summary>끌어다 놓기가 안 될 때 (직접 추가)</summary>
<p>북마크바 빈 곳 우클릭 → <b>페이지 추가</b> → 이름: <code>작성자 복사</code>, URL 칸에 아래 내용을 통째로 붙여넣기</p>
<textarea readonly onclick="this.select()">${bookmarklet.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
</details>
</body></html>
`;
fs.writeFileSync(path.join(__dirname, 'install.html'), html);
console.log('bookmarklet length:', bookmarklet.length);
