// Exercise the actual React component event handlers without a browser or DB.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const file = path.resolve(__dirname, "../components/team-works/operations/TeamWorksOperationsClientPortal.tsx");
const source = fs.readFileSync(file, "utf8") + "\nexport { ProjectRosterTab, RosterEditor };";
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const labels = { rosterNoun: "名簿", participantNoun: "生徒", groupNoun: "グループ", attendanceNoun: "出席", sessionNoun: "レッスン" };
function harness({ readOnly = false, confirm = true, failure = false } = {}) {
  const states = []; let cursor = 0; let confirmations = []; let writes = [];
  const people = [{ id: "a", projectId: "p", name: "残す生徒", groupId: null, level: null }, { id: "b", projectId: "p", name: "削除する生徒", groupId: null, level: null }];
  const element = (type, props) => ({ type, props });
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial; return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
    useEffect() {}, useCallback(fn) { return fn; }
  };
  const req = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return { jsx: element, jsxs: element, Fragment: "fragment" };
    if (name.endsWith("useTeamWorksLabels")) return { useTeamWorksLabels: () => labels };
    if (name.endsWith("TeamWorksViewAsContext")) return { useIsViewAs: () => readOnly };
    if (name.endsWith("supabase/client")) return { supabase: {} };
    if (name.endsWith("team-works-operations-client")) return {
      archiveOperationsClientParticipant: async (_, input) => { writes.push(input); if (failure) throw new Error("保存エラー"); const index = people.findIndex(p => p.id === input.participantId); if (index >= 0) people.splice(index, 1); }
    };
    return {};
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", "window", compiled)(req, mod, mod.exports, { confirm(text) { confirmations.push(text); return confirm; } });
  const mutate = async (action, text) => { try { await action(); return { tone: "success", text }; } catch (error) { return { tone: "error", text: error.message }; } };
  const render = () => { cursor = 0; return mod.exports.ProjectRosterTab({ data: { groups: [], participants: people }, project: { id: "p" }, mutate }); };
  const roster = (session) => { cursor = 0; return mod.exports.RosterEditor({ session, participants: people, groups: [], mutate }); };
  return { render, roster, people, states, writes, confirmations };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
const removeButton = tree => nodes(tree).find(n => n.props?.["aria-label"] === "削除する生徒を名簿から削除");
async function test(label, action) { await action(); console.log(`PASS ${label}`); }
(async () => {
  await test("cancel names the selected person and never calls the mutation", async () => {
    const h = harness({ confirm: false });
    await removeButton(h.render()).props.onClick();
    assert.equal(h.writes.length, 0);
    assert.equal(h.people.length, 2);
    assert.match(h.confirmations[0], /削除する生徒/);
    assert.match(h.confirmations[0], /記録は残ります/);
  });
  await test("confirmed removal uses the exact person and clears their edit form", async () => {
    const h = harness();
    const edit = nodes(h.render()).find(n => n.type === "button" && text(n) === "削除する生徒グループ未設定");
    edit.props.onClick();
    assert.equal(nodes(h.render()).find(n => n.type === "input" && n.props.placeholder === "対象者名").props.value, "削除する生徒");
    removeButton(h.render()).props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.writes, [{ projectId: "p", participantId: "b" }]);
    assert.deepEqual(h.people.map(p => p.id), ["a"]);
    assert.equal(nodes(h.render()).find(n => n.type === "input" && n.props.placeholder === "対象者名").props.value, "");
  });
  await test("preview disables deletion and guards the handler too", async () => {
    const h = harness({ readOnly: true });
    const button = removeButton(h.render());
    assert.equal(button.props.disabled, true);
    button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.confirmations.length, 0);
    assert.equal(h.writes.length, 0);
  });
  await test("failure leaves the person visible with an error notice", async () => {
    const h = harness({ failure: true });
    removeButton(h.render()).props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    const tree = h.render();
    assert.ok(removeButton(tree));
    assert.ok(nodes(tree).some(n => n.props?.notice?.tone === "error" && n.props.notice.text === "保存エラー"));
  });
  await test("a removed person stays visible in a saved session until explicitly removed there", async () => {
    const h = harness();
    h.people.splice(1, 1);
    const session = { id: "s", projectId: "p", roster: [{ participantId: "b", participantName: "削除する生徒", orderIndex: 1 }] };
    const tree = h.roster(session);
    assert.match(text(tree), /削除する生徒/);
    assert.match(text(tree), /名簿から削除済み/);
    const remove = nodes(tree).find(n => n.type === "button" && text(n) === "この回から外す");
    remove.props.onClick();
    assert.doesNotMatch(text(h.roster(session)), /削除する生徒/);
    assert.equal(session.roster.length, 1, "draft change must not delete the saved session");
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
