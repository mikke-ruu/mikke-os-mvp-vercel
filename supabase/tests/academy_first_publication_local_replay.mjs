// Explicitly local and disposable. No connection URL or arbitrary container is accepted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const project = 'academy-release-auth-20260909';
const container = `supabase_db_${project}`;
assert.equal(process.env.ACADEMY_LOCAL_REPLAY_CONFIRM, project, 'Explicit isolated replay confirmation required');
const docker = process.platform === 'win32' ? 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe' : 'docker';
const root = fileURLToPath(new URL('../..', import.meta.url));
const run = (args, input) => execFileSync(docker, args, { input, encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const labels = JSON.parse(run(['inspect', '--format', '{{json .Config.Labels}}', container]));
assert.equal(labels['com.supabase.cli.project'], project, 'Never replay against another container');
const query = sql => run(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], sql).trim();
const empty = query("select to_regclass('public.academy_headquarters') is null and to_regclass('public.profiles') is null;");
assert.equal(empty, 't', 'Fresh dedicated database required; existing app data is never overwritten');
const manifest = JSON.parse(execFileSync(process.execPath, [resolve(root, 'supabase/tests/academy_first_publication_replay_manifest.mjs')], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const item of [{ ...manifest.baseline, name: 'reviewed-baseline' }, ...manifest.entries.map(entry => ({ ...entry, path: resolve(root, entry.path), name: entry.path }))]) {
  const bytes = readFileSync(item.path);
  assert.equal(hash(bytes), item.sha256, 'Replay input changed since manifest');
  try {
    run(['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-U', 'postgres', '-d', 'postgres', '-f', '-'], bytes);
  } catch (error) {
    const detail = String(error.stderr ?? '').split(/\r?\n/).filter(line => /ERROR:|DETAIL:|HINT:/.test(line)).slice(-6).join('\n');
    throw new Error(`Isolated replay failed at ${item.name}\n${detail}`);
  }
  console.log(`PASS ${item.name}`);
}
console.log(JSON.stringify({ result: 'PASS', kind: 'local_full_schema_replay', project, commit: manifest.commit, deltaCount: manifest.deltaCount, productionChanged: false, authenticationTested: false, concurrencyTested: false }));
