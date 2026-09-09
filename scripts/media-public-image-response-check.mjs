import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../lib/media-app/public-image-response.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require, Buffer, Response });
const { publicImageResponse } = module.exports;
const token = "a".repeat(48);
const bucket = "media-public-objects";
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9RkAAAAASUVORK5CYII=", "base64");
const valid = { bucket, storagePath: "owner-internal/path/image.png", mimeType: "image/png", byteSize: bytes.length, contentSha256: createHash("sha256").update(bytes).digest("hex") };
let tests = 0;
async function hidden(response) {
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Location"), null);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  tests++;
}
for (const invalid of ["", "a".repeat(31), "a".repeat(129), "../" + token, `${token}?id=owner`, `${token}\n`]) {
  let called = false;
  await hidden(await publicImageResponse(invalid, bucket, async () => { called = true; return valid; }, async () => { called = true; return new Response(bytes); }));
  assert.equal(called, false);
}
await hidden(await publicImageResponse(token, "", async () => valid, async () => { throw new Error("must not download"); }));
for (const patch of [
  { bucket: "wrong-bucket" }, { mimeType: "image/svg+xml" }, { mimeType: "text/html" },
  { byteSize: 15 * 1024 * 1024 + 1 }, { byteSize: 0 }, { byteSize: 1.5 },
  { contentSha256: "invalid" }, { storagePath: "../secret" }, { storagePath: "folder/../secret" },
  { storagePath: "folder/./secret" }, { storagePath: "/absolute/path" }, { storagePath: "folder//image" },
  { storagePath: "folder\\secret" }, { storagePath: "folder/\u0000secret" }
]) {
  let downloaded = false;
  await hidden(await publicImageResponse(token, bucket, async () => ({ ...valid, ...patch }), async () => { downloaded = true; return new Response(bytes); }));
  assert.equal(downloaded, false);
}
await hidden(await publicImageResponse(token, bucket, async () => null, async () => new Response(bytes)));
await hidden(await publicImageResponse(token, bucket, async () => { throw new Error("internal owner locator error"); }, async () => new Response(bytes)));
await hidden(await publicImageResponse(token, bucket, async () => valid, async () => { throw new Error("private origin network failure"); }));
await hidden(await publicImageResponse(token, bucket, async () => valid, async () => new Response(null, { status: 302, headers: { Location: "https://storage.invalid/owner/path" } })));
await hidden(await publicImageResponse(token, bucket, async () => valid, async () => new Response(bytes, { status: 206 })));
await hidden(await publicImageResponse(token, bucket, async () => valid, async () => new Response(null)));
await hidden(await publicImageResponse(token, bucket, async () => ({ ...valid, byteSize: bytes.length + 1 }), async () => new Response(bytes)));
await hidden(await publicImageResponse(token, bucket, async () => ({ ...valid, byteSize: bytes.length - 1 }), async () => new Response(bytes)));
await hidden(await publicImageResponse(token, bucket, async () => ({ ...valid, contentSha256: "0".repeat(64) }), async () => new Response(bytes)));
{
  let cancelled = false;
  await hidden(await publicImageResponse(token, bucket, async () => ({ ...valid, byteSize: 1 }), async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array([1, 2])); }, cancel() { cancelled = true; }
  }))));
  assert.equal(cancelled, true);
}
for (const after of [null, { ...valid, storagePath: "owner-internal/other/image.png" }, { ...valid, contentSha256: "1".repeat(64) }]) {
  let reads = 0;
  await hidden(await publicImageResponse(token, bucket, async () => ++reads === 1 ? valid : after, async () => new Response(bytes)));
  assert.equal(reads, 2);
}
{
  let reads = 0;
  const response = await publicImageResponse(token, bucket, async () => { reads++; return { ...valid }; }, async () => new Response(bytes, { headers: { Location: "https://storage.invalid/private-owner", "X-Storage-Path": "private-owner" } }));
  assert.equal(response.status, 200);
  assert.equal(reads, 2);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("Content-Length"), String(bytes.length));
  assert.equal(response.headers.get("Location"), null);
  assert.equal(response.headers.get("X-Storage-Path"), null);
  assert.equal(response.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  tests++;
}
console.log(`Media public image response checks PASS (${tests} cases; synthetic bytes only, no external fetch).`);
