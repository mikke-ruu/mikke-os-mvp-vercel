// Real Auth/API checks for a control-room-approved disposable LOCAL environment.
// Does not provision schema, use admin credentials, or connect to production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const target = new URL(process.env.MANAGER_TEST_URL ?? "http://invalid.invalid");
assert.equal(process.env.MANAGER_TEST_ALLOW_WRITES, "isolated-local", "Explicit isolated-local test permission required");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Only loopback test environments allowed");
assert.ok(target.port && target.protocol === "http:", "Use an explicit local HTTP port");
const apiKey = process.env.MANAGER_TEST_ANON_KEY;
assert.ok(apiKey, "Local publishable/anon key required; never use service_role");
assert.ok(!apiKey.startsWith("sb_secret_"), "Secret keys are prohibited");
if (apiKey.split(".").length === 3) {
  const claims = JSON.parse(Buffer.from(apiKey.split(".")[1], "base64url").toString());
  assert.equal(claims.role, "anon", "Only anon JWT keys allowed");
}

const clients = [];
async function client() {
  const instance = createClient(target.origin, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const address = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(address.origin, target.origin, "Cross-environment requests prohibited");
        return fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(30000) });
      }
    }
  });
  clients.push(instance);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("INITIAL_SESSION timeout")), 15000);
    const { data } = instance.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION") return;
      clearTimeout(timer);
      queueMicrotask(() => { data.subscription.unsubscribe(); resolve(); });
    });
  });
  return instance;
}
async function ok(request, label) {
  const result = await request;
  assert.equal(result.error, null, `${label}: ${result.error?.code ?? "request failed"}`);
  return result.data;
}
async function denied(request, label) {
  const result = await request;
  assert.ok(result.error, `${label}: unexpectedly permitted`);
}
const normalized = (rows) => rows.map(({ app_key, sort_order, is_hidden }) => ({ app_key, sort_order, is_hidden }));
const rpcNames = {
  get: "mikke_app_menu_preferences_get_mine",
  replace: "mikke_app_menu_preferences_replace_mine",
  reset: "mikke_app_menu_preferences_reset_mine"
};
async function mine(c) { return normalized(await ok(c.rpc(rpcNames.get), "get mine")); }
async function ownership(c, userId) {
  return await ok(c.from("mikke_app_entitlements").select("app_key,status,starts_at,ends_at")
    .eq("user_id", userId).order("app_key"), "read ownership");
}

try {
  const run = randomUUID();
  const password = `${randomUUID()}Aa9!`;
  const [a, b, anon] = await Promise.all([client(), client(), client()]);
  const users = [];
  for (const [index, c] of [a, b].entries()) {
    const data = await ok(c.auth.signUp({ email: `manager-${run}-${index}@example.test`, password }), "local signup");
    assert.ok(data.session && data.user && !data.user.is_anonymous,
      "Local ordinary signup must yield a session; configure isolated confirmation or stop");
    users.push(data.user.id);
  }
  const before = await Promise.all([ownership(a, users[0]), ownership(b, users[1])]);
  const rowsA = [{ app_key: "academy", sort_order: 0, is_hidden: true }, { app_key: "marketnote", sort_order: 1, is_hidden: false }];
  const rowsB = [{ app_key: "story", sort_order: 0, is_hidden: true }, { app_key: "academy", sort_order: 1, is_hidden: false }];
  await ok(a.rpc(rpcNames.replace, { p_items: rowsA }), "A replace");
  await ok(b.rpc(rpcNames.replace, { p_items: rowsB }), "B replace");
  assert.deepEqual(await mine(a), rowsA);
  assert.deepEqual(await mine(b), rowsB);

  for (const [c, other] of [[a, users[1]], [b, users[0]]]) {
    await denied(c.from("mikke_app_menu_preferences").select("*").eq("user_id", other), "direct foreign select");
    await denied(c.from("mikke_app_menu_preferences").update({ is_hidden: true }).eq("user_id", other), "direct foreign update");
    await denied(c.rpc(rpcNames.replace, { p_items: [{ ...rowsA[0], user_id: other }] }), "injected owner");
    await denied(c.rpc(rpcNames.replace, { p_items: [{ ...rowsA[0], app_key: "manager" }] }), "fixed Manager cannot be hidden");
  }
  assert.deepEqual(await mine(a), rowsA);
  assert.deepEqual(await mine(b), rowsB);
  for (const name of Object.values(rpcNames)) {
    await denied(anon.rpc(name, name === rpcNames.replace ? { p_items: rowsA } : undefined), "anon RPC");
  }
  await ok(a.rpc(rpcNames.reset), "A reset");
  assert.deepEqual(await mine(a), []);
  assert.deepEqual(await mine(b), rowsB);
  await ok(b.rpc(rpcNames.reset), "B reset");
  assert.deepEqual(await mine(b), []);
  assert.deepEqual(await Promise.all([ownership(a, users[0]), ownership(b, users[1])]), before);
  console.log("PASS: isolated real Auth menu A/B separation, Academy save, reset, table/anon denial, ownership unchanged");
  console.log("NOT COVERED: browser/reload, anonymous-signin JWT, ID/email/password UI, production; dispose test environment after remaining QA");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local Auth check failed");
  process.exitCode = 1;
} finally {
  for (const c of clients) {
    try {
      const { error } = await c.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      console.error("Cleanup failed: could not sign out a local test session");
      process.exitCode = 1;
    }
  }
}
