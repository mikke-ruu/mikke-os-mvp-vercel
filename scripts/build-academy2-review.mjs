import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../docs/academy2-review/Academy2_Review_SOURCE.html', import.meta.url));
const outputPath = fileURLToPath(new URL('../public/academy2-review.html', import.meta.url));
let html = readFileSync(sourcePath, 'utf8');
const pagesStart = html.indexOf('const pages = ') + 'const pages = '.length;
const pagesEnd = html.indexOf(';\nlet current', pagesStart);
if (pagesStart < 14 || pagesEnd < 0) throw new Error('Page data was not found');
const pages = JSON.parse(html.slice(pagesStart, pagesEnd));
const pagesDirectory = fileURLToPath(new URL('../public/academy2-review-pages/', import.meta.url));
mkdirSync(pagesDirectory, { recursive: true });
pages.forEach((page, index) => {
  // The single-file source escaped closing script tags for its JSON literal.
  const standalone = page.html.replaceAll(String.raw`<\/script>`, '</script>')
    .replace('<head>', '<head><meta name="robots" content="noindex,nofollow">')
    .replace(/[ \t]+$/gm, '');
  writeFileSync(`${pagesDirectory}/${String(index + 1).padStart(2, '0')}.html`, standalone, 'utf8');
});
html = html.slice(0, pagesStart)
  + JSON.stringify(pages.map(({ group, title, filename, status }) => ({ group, title, filename, status })))
  + html.slice(pagesEnd);

const replaceOnce = (before, after) => {
  if (!html.includes(before)) throw new Error(`Source marker missing: ${before.slice(0, 60)}`);
  html = html.replace(before, after);
};

replaceOnce('<title>Academy 2.0 ネオンちゃん確認用 - 1ファイル版</title>', '<title>Academy 2.0 画面見本 | mikkeOS</title>');
replaceOnce('<head>', '<head><meta name="robots" content="noindex,nofollow">');
replaceOnce('<h1>Academy 2.0 ネオンちゃん確認用</h1>', '<h1>Academy 2.0 画面見本</h1>');
replaceOnce('<div class="sub">このHTML 1ファイルだけで全画面を開けます</div>', '<div class="sub">本部・講師・受講者の画面を確認できます</div>');
replaceOnce('<div class="note">上から順番に確認してください。画面はこのファイル内に埋め込まれているので、別HTMLは不要です。</div>', `<section class="review-home" aria-labelledby="review-home-title">
    <div class="review-home-kicker">ACADEMY 2.0</div>
    <h2 id="review-home-title">Academy 2.0 ホーム</h2>
    <p>本部・講師・受講者の画面見本を、ここから確認できます。</p>
    <div class="review-home-grid">
      <button type="button" data-open-page="0"><span>本部</span><strong>本部ホームを見る</strong><small>講座・販売プラン・開催の入口</small></button>
      <button type="button" data-open-page="16"><span>講師</span><strong>講師ホームを見る</strong><small>申込・開催・担当依頼の入口</small></button>
      <button type="button" data-open-page="27"><span>受講者</span><strong>受講者ホームを見る</strong><small>学ぶ・予定・認定の入口</small></button>
    </div>
    <a class="review-home-all" href="#review-screen-list">全33画面の一覧を見る →</a>
  </section>
  <div class="note">各画面は操作できるHTMLの見本です。入力内容はAcademyのデータベースには保存されません。</div>`);
replaceOnce('<div class="tabs">', '<div id="review-screen-list" class="tabs">');
replaceOnce(' sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"', '');
replaceOnce("document.getElementById('frame').srcdoc = pages[i].html;", "document.getElementById('frame').src = '/academy2-review-pages/' + String(i+1).padStart(2,'0') + '.html';");
replaceOnce("document.getElementById('frame').srcdoc='';", "document.getElementById('frame').src='about:blank';");
replaceOnce('</style>', `.review-home{background:#fff;border:1px solid #e0e6e1;border-radius:18px;padding:28px;margin-bottom:18px;background-image:linear-gradient(120deg,#fff 60%,#e5f3ed)}
.review-home-kicker{font-size:12px;font-weight:800;letter-spacing:.12em;color:#3f4eb5}
.review-home h2{font-size:26px;margin:8px 0 10px}.review-home p{margin:0 0 21px;color:#526057;font-size:14px}
.review-home-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.review-home-grid button{background:#fff;border:1px solid #d7e5dc;border-radius:13px;text-align:left;padding:16px;cursor:pointer;min-height:116px;color:#202126}
.review-home-grid button:hover,.review-home-grid button:focus-visible{border-color:#4b9376;box-shadow:0 5px 15px #b3d9c44d;outline:none}
.review-home-grid span{display:block;color:#4b9376;font-size:12px;font-weight:800}.review-home-grid strong{display:block;font-size:16px;margin:8px 0 4px}.review-home-grid small{font-size:12px;color:#666}
.review-home-all{display:inline-block;color:#3f4eb5;font-size:13px;font-weight:700;margin-top:18px;text-decoration:none}
@media(max-width:700px){.review-home{padding:18px}.review-home h2{font-size:22px}.review-home-grid{grid-template-columns:1fr}.review-home-grid button{min-height:auto}}
</style>`);
replaceOnce('render();\n</script>', `document.querySelectorAll('[data-open-page]').forEach(button => {
  button.addEventListener('click', () => openPage(Number(button.dataset.openPage)));
});
render();
</script>`);

if (html.includes('ネオンちゃん')) throw new Error('Unexpected presenter name remains');
writeFileSync(outputPath, html, 'utf8');
console.log(`Built ${outputPath} (${Buffer.byteLength(html)} bytes)`);
