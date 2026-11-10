import assert from "node:assert/strict";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { createMikkeMenuAuthScope, runWithMikkeMenuLease } from "../lib/mikkeos/menu-preferences-auth-scope.ts";

const scope = createMikkeMenuAuthScope();
const actorA = "00000000-0000-4000-8000-00000000000a";
const actorB = "00000000-0000-4000-8000-00000000000b";
scope.observe({ user: { id: actorA }, access_token: "token-a-1" });

const refreshLease = scope.capture(actorA);
scope.observe({ user: { id: actorA }, access_token: "token-a-2" });
assert.equal(refreshLease.accessToken(), "token-a-2", "same-actor token refresh remains usable");

const staleBeforeSend = scope.capture(actorA);
scope.observe({ user: { id: actorB }, access_token: "token-b" });
assert.throws(() => staleBeforeSend.accessToken(), /ログイン状態が変わりました/);
scope.observe({ user: { id: actorA }, access_token: "token-a-3" });
assert.throws(() => staleBeforeSend.accessToken(), /ログイン状態が変わりました/, "A→B→A must not revive an old lease");

let requests = 0;
let seenAuthorization = "";
let releaseResponse;
const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
let requestArrived;
const arrived = new Promise((resolve) => { requestArrived = resolve; });
const server = http.createServer(async (request, response) => {
  requests++;
  seenAuthorization = String(request.headers.authorization ?? "");
  requestArrived();
  await responseGate;
  response.writeHead(200, { "content-type": "application/json" });
  response.end("[]");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const currentLease = scope.capture(actorA);
  const client = createClient(`http://127.0.0.1:${address.port}`, "anon-placeholder", {
    accessToken: async () => currentLease.accessToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const staleClient = createClient(`http://127.0.0.1:${address.port}`, "anon-placeholder", {
    accessToken: async () => currentLease.accessToken(),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const inFlight = runWithMikkeMenuLease(currentLease, async () => {
    const { error } = await client.rpc("menu_test");
    if (error) throw error;
    return "old-result";
  });
  await arrived;
  assert.equal(seenAuthorization, "Bearer token-a-3", "request must be bound to captured actor A");
  scope.observe({ user: { id: actorB }, access_token: "token-b-2" });
  releaseResponse();
  await assert.rejects(inFlight, /ログイン状態が変わりました/, "old A result must be discarded after switch to B");
  assert.equal(requests, 1);

  const before = requests;
  const { error } = await staleClient.rpc("must_not_send");
  assert(error, "stale lease must reject instead of falling back to anon key");
  assert.equal(requests, before, "stale request must never reach the server");
} finally {
  server.close();
}

console.log("PASS menu preference RPCs stay bound to the initiating actor and discard stale results");
