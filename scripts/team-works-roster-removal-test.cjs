// Local contract tests with in-memory rows only. No network or real accounts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const file = path.join(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const localRequire = (name) => name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}
const { archiveOperationsClientParticipant, loadOperationsClientPortal } = load("lib/team-works-operations-client.ts");
const { loadOperationsRosterNames } = load("lib/team-works-roster-names.ts");

function fixture({ loggedIn = true, authorized = true, updateError = null } = {}) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const rows = {
    team_works_organization_members: [{ id: "client", user_id: "user", role: "client_user", status: "active", display_name: "学校" }],
    team_works_project_members: authorized ? [{ project_id: "p1", organization_member_id: "client", project_role: "client" }] : [],
    team_works_projects: [{ id: "p1", organization_id: "org", style: "operations", status: "active", title: "テスト校", description: "", feature_settings: null }],
    team_works_organizations: [{ id: "org", name: "本部" }],
    team_works_participants: [
      { id: "a", project_id: "p1", name: "残す生徒", group_id: null, level: null, status: "active", archived_at: null },
      { id: "b", project_id: "p1", name: "削除する生徒", group_id: null, level: null, status: "active", archived_at: null },
      { id: "foreign", project_id: "p2", name: "別校", status: "active", archived_at: null }
    ],
    team_works_op_sessions: [{ id: "s", project_id: "p1", session_date: day, start_time: "12:30", duration_min: 30, status: "scheduled" }],
    team_works_session_roster: [{ id: "r", session_id: "s", project_id: "p1", participant_id: "b", order_index: 1, attendance_status: "present" }],
    team_works_groups: [], team_works_project_comments: [], team_works_holidays: []
  };
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: loggedIn ? { id: "user" } : null }, error: null }) },
    rpc: async () => ({ data: null, error: null }),
    from(table) {
      const call = { table, filters: [], patch: null };
      calls.push(call);
      let single = false;
      const query = {
        select() { return query; }, order() { return query; }, limit() { return query; }, or() { return query; },
        eq(key, val) { call.filters.push(row => row[key] === val); return query; },
        neq(key, val) { call.filters.push(row => row[key] !== val); return query; },
        is(key, val) { call.filters.push(row => (row[key] ?? null) === val); return query; },
        in(key, vals) { call.filters.push(row => vals.includes(row[key])); return query; },
        gte(key, val) { call.filters.push(row => row[key] >= val); return query; },
        lte(key, val) { call.filters.push(row => row[key] <= val); return query; },
        update(patch) { call.patch = patch; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          const matched = (rows[table] ?? []).filter(row => call.filters.every(filter => filter(row)));
          if (call.patch && updateError) return Promise.resolve({ data: null, error: updateError }).then(resolve, reject);
          if (call.patch) matched.forEach(row => Object.assign(row, call.patch));
          return Promise.resolve({ data: single ? matched[0] ?? null : matched, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  return { rows, calls, client };
}

async function test(name, fn) { await fn(); console.log(`PASS ${name}`); }
(async () => {
  await test("removes from selectable names after reload, preserves existing session/name/attendance", async () => {
    const f = fixture();
    const beforeRoster = JSON.stringify(f.rows.team_works_session_roster);
    await archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "b" });
    const portal = await loadOperationsClientPortal(f.client);
    assert.deepEqual(portal.participants.map(p => p.id), ["a"]);
    assert.equal(portal.sessions[0].roster[0].participantName, "削除する生徒");
    assert.equal(portal.sessions[0].roster[0].participantId, "b");
    assert.equal(JSON.stringify(f.rows.team_works_session_roster), beforeRoster);
    assert.equal(f.rows.team_works_participants.length, 3);
    assert.equal(f.rows.team_works_participants[0].status, "active");
    assert.equal(f.rows.team_works_participants[2].status, "active");
    assert.ok(f.rows.team_works_participants[1].archived_at);
  });
  await test("requires a logged-in client", async () => {
    const f = fixture({ loggedIn: false });
    await assert.rejects(archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "b" }), /ログイン/);
    assert.equal(f.calls.length, 0);
  });
  await test("rejects missing project membership before any write", async () => {
    const f = fixture({ authorized: false });
    await assert.rejects(archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "b" }), /権限/);
    assert.ok(f.calls.every(call => !call.patch));
  });
  await test("cannot remove a person belonging to another project", async () => {
    const f = fixture();
    await assert.rejects(archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "foreign" }), /削除できません/);
    assert.equal(f.rows.team_works_participants[2].status, "active");
  });
  await test("does not report success for a missing or RLS-hidden row", async () => {
    const f = fixture();
    await assert.rejects(archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "missing" }), /削除できません/);
  });
  await test("surfaces database failure without modifying records", async () => {
    const f = fixture({ updateError: new Error("denied") });
    await assert.rejects(archiveOperationsClientParticipant(f.client, { projectId: "p1", participantId: "b" }), /denied/);
    assert.equal(f.rows.team_works_participants[1].status, "active");
  });
  await test("historical name lookup is project scoped and does not re-enable archived people", async () => {
    const f = fixture();
    const names = await loadOperationsRosterNames(f.client, ["p1"], [{ id: "a", name: "残す生徒" }], [{ participant_id: "b" }, { participant_id: "foreign" }]);
    assert.equal(names.get("b"), "削除する生徒");
    assert.equal(names.has("foreign"), false);
    const count = f.calls.length;
    await loadOperationsRosterNames(f.client, ["p1"], [{ id: "a", name: "残す生徒" }], [{ participant_id: "a" }]);
    assert.equal(f.calls.length, count);
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
