import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Technical adapter harness only: this is not the product editor's Auth E2E.
export async function runMediaBrowserAuthChecks({ url, publicKey, credentialsA, credentialsB, siteId, articleId, expectedTitle, pass }) {
  const ref = 'ydwvaljzorgwmqihvocf';
  const deadline = Date.parse('2026-09-07T13:59:05Z');
  if (url !== `https://${ref}.supabase.co` || Date.now() >= deadline) throw new Error('BROWSER_TARGET_REJECTED');
  const require = createRequire(import.meta.url);
  const { chromium } = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  const sources = new Map();
  for (const name of ['database-operations', 'integration']) {
    const source = await readFile(new URL(`../lib/media-app/${name}.ts`, import.meta.url), 'utf8');
    sources.set(`/${name}.js`, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  sources.set('/sdk.js', await readFile(new URL('../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url), 'utf8'));
  const html = '<!doctype html><meta charset="utf-8"><title>Media isolated Auth adapter test</title><p>合成データ専用の技術検証</p><script src="/sdk.js"></script><script type="module">import {createMediaDatabaseOperations} from "/database-operations.js"; import {MediaSessionBoundary} from "/integration.js"; window.mediaFactory=createMediaDatabaseOperations;window.MediaSessionBoundary=MediaSessionBoundary;</script>';
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', request.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript');
    const body = request.url === '/' ? html : sources.get(request.url);
    response.statusCode = body ? 200 : 404;
    response.end(body ?? '');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const contexts = [];
  try {
    // Never inherit the runner's admin secret into the browser process.
    const browserEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/MEDIA_TEST|SUPABASE|TOKEN|SECRET|PASSWORD|API_KEY/i.test(key)));
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, env: browserEnv });
    async function newPage() {
      const context = await browser.newContext();
      contexts.push(context);
      await context.route('**/*', async (route) => {
        const target = new URL(route.request().url());
        const allowed = target.origin === origin || (target.origin === url && /^\/(auth|rest)\/v1\//.test(target.pathname));
        if (!allowed || Date.now() >= deadline) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(origin);
      await page.waitForFunction(() => Boolean(window.mediaFactory));
      return page;
    }
    async function initialize(page, credentials) {
      const ok = await page.evaluate(async ({ url, publicKey, credentials }) => {
        window.mediaClient = window.supabase.createClient(url, publicKey, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
        const result = await window.mediaClient.auth.signInWithPassword(credentials);
        window.mediaOperations = window.mediaFactory(window.mediaClient);
        return !result.error && Boolean(result.data.user) && !result.data.user.is_anonymous;
      }, { url, publicKey, credentials });
      if (!ok) throw new Error('BROWSER_LOGIN_FAILED');
    }
    async function ownDraft(page) {
      return page.evaluate(async ({ siteId, articleId, expectedTitle }) => {
        const sites = await window.mediaOperations.listMyMediaSitesFromDatabase();
        const draft = await window.mediaOperations.readMediaArticleDraftFromDatabase(articleId);
        return sites.length === 1 && sites[0].id === siteId && draft?.title === expectedTitle;
      }, { siteId, articleId, expectedTitle });
    }
    const a = await newPage();
    await initialize(a, credentialsA);
    if (!await ownDraft(a)) throw new Error('BROWSER_A_RESTORE_FAILED');
    pass('browser_A_real_login_product_adapter_restore');
    await a.reload();
    await a.waitForFunction(() => Boolean(window.mediaFactory));
    const restored = await a.evaluate(async ({ url, publicKey }) => {
      window.mediaClient = window.supabase.createClient(url, publicKey, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
      window.mediaOperations = window.mediaFactory(window.mediaClient);
      const result = await window.mediaClient.auth.getUser();
      return !result.error && Boolean(result.data.user);
    }, { url, publicKey });
    if (!restored || !await ownDraft(a)) throw new Error('BROWSER_RELOAD_SESSION_FAILED');
    pass('browser_reload_session_restore');
    const b = await newPage();
    await initialize(b, credentialsB);
    const invisible = await b.evaluate(async (articleId) => (await window.mediaOperations.readMediaArticleDraftFromDatabase(articleId)) === null, articleId);
    if (!invisible) throw new Error('BROWSER_B_DRAFT_LEAK');
    pass('independent_browser_B_cannot_read_A_draft');
    const anotherA = await newPage();
    await initialize(anotherA, credentialsA);
    if (!await ownDraft(anotherA)) throw new Error('INDEPENDENT_BROWSER_A_RESTORE_FAILED');
    pass('independent_browser_A_login_restores_same_data');
    const switched = await a.evaluate(async ({ credentialsB, articleId }) => {
      await window.mediaClient.auth.signOut({ scope: 'local' });
      const result = await window.mediaClient.auth.signInWithPassword(credentialsB);
      return !result.error && (await window.mediaOperations.readMediaArticleDraftFromDatabase(articleId)) === null;
    }, { credentialsB, articleId });
    if (!switched) throw new Error('BROWSER_ACCOUNT_SWITCH_LEAK');
    pass('same_browser_A_logout_B_no_data_mix');
  } finally {
    for (const context of contexts) {
      for (const page of context.pages()) {
        try { await page.evaluate(async () => { if (window.mediaClient) await window.mediaClient.auth.signOut({ scope: 'local' }); localStorage.clear(); }); } catch { /* Branch deletion is the final cleanup. */ }
      }
      await context.close().catch(() => {});
    }
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}
