import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('lib/community/auth-scope.ts', 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
const scope = module.exports.createCommunityAuthScope();
const session = (id, token, anonymous = false) => ({ user: { id, is_anonymous: anonymous }, access_token: token });
scope.observe(session('A', 'fake-A'));
const a = scope.capture();
let resolve;
const delayed = new Promise(r => { resolve = r; });
let rendered = null;
let navigated = false;
const oldReply = delayed.then(value => { if (a.isCurrent()) { rendered = value; navigated = true; } });
assert.equal(a.accessToken(), 'fake-A');
assert.equal(scope.observe(session('A', 'fake-A-refreshed')), false);
assert.equal(a.accessToken(), 'fake-A-refreshed');
scope.observe(session('B', 'fake-B'));
assert.equal(a.isCurrent(), false);
assert.throws(() => a.accessToken());
const b = scope.capture();
assert.notEqual(a.epoch, b.epoch);
assert.equal(b.accessToken(), 'fake-B');
resolve('A private dashboard / creation result');
await oldReply;
assert.equal(rendered, null);
assert.equal(navigated, false);
scope.observe(session('A', 'fake-A-new'));
assert.equal(a.isCurrent(), false); // A -> B -> A never revives old requests.
assert.equal(b.isCurrent(), false);
scope.observe(session('anon', 'fake-anon', true));
assert.equal(scope.capture().user, null);
assert.throws(() => scope.capture().accessToken());
scope.invalidate();
assert.equal(b.isCurrent(), false);

const hub = readFileSync('components/community/CommunityHub.tsx', 'utf8');
const app = readFileSync('components/community/CommunityApp.tsx', 'utf8');
const boundary = readFileSync('components/community/CommunityAuthBoundary.tsx', 'utf8');
assert.ok(hub.includes('CommunityCreateForm key={lease.epoch}'));
assert.ok(hub.includes('createCommunity(communityScopedClient(lease)'));
assert.ok(hub.includes('if (!lease.isCurrent()) return;\n      router.replace'));
assert.ok(app.includes('key={`${props.communitySlug}:${lease.epoch}`}'));
assert.ok(app.includes('generation === reloadGeneration.current'));
assert.ok(app.includes('loadCommunityDashboard(communityScopedClient(lease)'));
assert.ok(boundary.includes('data.session.user.id !== lease.user?.id'));
assert.ok(boundary.includes('onAuthStateChange'));
const boundaryModule = { exports: {} };
let getSession = async () => ({ data: { session: session('A', 'fake-A') } });
vm.runInNewContext(ts.transpileModule(boundary, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  module: boundaryModule, exports: boundaryModule.exports,
  process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake' } },
  require(name) {
    if (name === '@supabase/supabase-js') return { createClient: (_url, _key, options) => options };
    if (name === '@/lib/supabase/client') return { supabase: { auth: { getSession: () => getSession() } } };
    return {};
  }
});
scope.observe(session('A', 'fake-A'));
const pinnedLease = scope.capture();
const client = boundaryModule.exports.communityScopedClient(pinnedLease);
assert.equal(await client.accessToken(), 'fake-A');
getSession = async () => ({ data: { session: session('B', 'fake-B') } });
await assert.rejects(client.accessToken()); // Reject B even before the auth event arrives.
let deliverSession;
getSession = () => new Promise(resolve => { deliverSession = resolve; });
const pendingToken = client.accessToken();
scope.observe(session('B', 'fake-B'));
deliverSession({ data: { session: session('A', 'fake-A') } });
await assert.rejects(pendingToken); // Reject a delayed old getSession after the event.
console.log('Community auth scope: delayed reply, actor switch/revisit, refresh, anonymous and UI wiring passed (fake-only)');
