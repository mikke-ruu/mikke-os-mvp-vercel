import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const documents = [
  ['academy-first-publication-trial-terms-2026-09-08-v1.md', 'a337bd78bfbfb20991c015ab0b7c7db00eb26cf663608f629f1d7e6e92fd5cff', 'app/legal/academy/first-publication-trial/2026-09-08-v1/page.tsx'],
  ['academy-first-publication-trial-consent-2026-09-08-v1.md', 'ec63e2b2d035e92bb75b41f2cdcda5145466b5ccad7ab2ec28a388d8a8e0f5d2', 'app/legal/academy/first-publication-trial/consent/2026-09-08-v1/page.tsx'],
];
const renderer = readFileSync('components/legal/LegalMarkdownPage.tsx', 'utf8');
for (const [name, digest, route] of documents) {
  // Git may use CRLF on Windows; the approved public source is UTF-8 with LF.
  const source = readFileSync(`legal-content/${name}`, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(source, 'utf8').digest('hex'), digest, `${name}: approved legal text changed`);
  assert.ok(renderer.includes(`"${name}"`), `${name}: renderer allowlist missing`);
  assert.ok(readFileSync(route, 'utf8').includes(`documentName="${name}"`), `${name}: route missing`);
}
for (const route of ['app/legal/academy/terms/2026-09-04-v1/page.tsx', 'app/legal/academy/billing/2026-09-04-v1/page.tsx', 'app/legal/privacy/2026-09-04-v1/page.tsx']) assert.ok(existsSync(route), `${route}: applied document route missing`);
console.log('academy_first_publication_legal_sources_ok: approved text hashes and local routes only; no public activation verified');
