import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route=await readFile(new URL('../app/academy/api/first-publication/worker/route.ts',import.meta.url),'utf8');
const snapshot=await readFile(new URL('../app/academy/api/first-publication/snapshot/route.ts',import.meta.url),'utf8');
const server=await readFile(new URL('../lib/academy/first-publication-billing/server.ts',import.meta.url),'utf8');

assert.match(route,/export function GET\(request: Request\).*scheduled: true/);
assert.match(snapshot,/export function GET\(request: Request\)/);
assert.match(server,/ACADEMY_FIRST_PUBLICATION_SCHEDULER_ENABLED!=='1'/);
assert.match(server,/ACADEMY_FIRST_PUBLICATION_SNAPSHOT_ENABLED!=='1'/);
assert.match(server,/scheduled\?process\.env\.CRON_SECRET:process\.env\.ACADEMY_FIRST_PUBLICATION_WORKER_SECRET/);
assert.match(server,/academy_first_publication_capture_due_snapshots/);
assert.doesNotMatch(server,/process\.env\.CRON_SECRET\s*\?\?/);

console.log('Academy scheduler routes are authenticated and fail closed until explicit activation.');
