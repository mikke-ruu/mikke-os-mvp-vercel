import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const admin = await readFile(fileURLToPath(new URL("./academy-access-admin.ts", import.meta.url)), "utf8");
const route = await readFile(fileURLToPath(new URL("../../app/community/api/academy-access/route.ts", import.meta.url)), "utf8");

assert.match(admin, /auth\.getUser\(accessToken\)/);
assert.doesNotMatch(admin, /SUPABASE_(SECRET|SERVICE_ROLE)/);
assert.match(admin, /academy_get_community_release_overview/);
assert.match(admin, /academy_issue_community_instructor_invitation/);
assert.match(admin, /academy_cancel_community_instructor_invitation/);
assert.match(admin, /community_decline_my_academy_access_invitation/);
assert.doesNotMatch(admin, /activeMemberCount:\s*0|invitationCount:\s*0/);

assert.match(route, /Cache-Control": "private, no-store/);
assert.match(route, /Vary: "Authorization, Origin"/);
assert.match(route, /sec-fetch-site/);
assert.match(route, /new Set\(body\.roomIds\)\.size/);
assert.match(route, /request\.body\.getReader\(\)/);
assert.doesNotMatch(route, /request\.json\(\)/);
assert.doesNotMatch(route, /stoppedCount:\s*0|activeMemberCount:\s*0|invitationCount:\s*0/);

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const transpiledRoute = typescript.transpileModule(route, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022
  }
}).outputText;
const routeModule = { exports: {} };
const routeFactory = vm.runInNewContext(
  `(function(require,module,exports){${transpiledRoute}\n})`,
  {
    Request,
    Response,
    ReadableStream,
    TextDecoder,
    Uint8Array,
    URL,
    Set,
    console
  }
);
routeFactory((id) => {
  if (id === "next/server") {
    return {
      NextResponse: {
        json(body, init) {
          return new Response(JSON.stringify(body), {
            ...init,
            headers: { "Content-Type": "application/json", ...init?.headers }
          });
        }
      }
    };
  }
  if (id === "@/lib/community/academy-access-admin") {
    return {
      CommunityAcademyAccessError: class CommunityAcademyAccessError extends Error {},
      cancelCommunityAcademyInstructorInvitation() { throw new Error("unexpected RPC"); },
      declineCommunityAcademyInstructorInvitation() { throw new Error("unexpected RPC"); },
      issueCommunityAcademyInstructorInvitation() { throw new Error("unexpected RPC"); },
      readCommunityAcademyReleaseOverview() { throw new Error("unexpected RPC"); }
    };
  }
  throw new Error(`Unexpected module: ${id}`);
}, routeModule, routeModule.exports);

const { POST } = routeModule.exports;
const encoder = new TextEncoder();
function chunkedRequest(chunks) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  const request = new Request("http://community.test/community/api/academy-access", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      Origin: "http://community.test",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json"
    },
    body,
    duplex: "half"
  });
  assert.equal(request.headers.get("content-length"), null, "runtime case must not rely on Content-Length");
  return request;
}

const oversizedAscii = await POST(chunkedRequest([
  '{"action":"unknown","padding":"',
  "a".repeat(5000),
  "b".repeat(4000),
  '"}'
]));
assert.equal(oversizedAscii.status, 413, "chunked ASCII body over 8192 bytes is rejected");

const oversizedUtf8 = await POST(chunkedRequest([
  '{"action":"unknown","padding":"',
  "あ".repeat(2800),
  '"}'
]));
assert.equal(oversizedUtf8.status, 413, "multibyte body is limited by bytes, not characters");

const boundedBody = await POST(chunkedRequest(['{"action":"unknown"}']));
assert.equal(boundedBody.status, 400, "a bounded chunked body reaches normal action validation");

console.log("community_academy_access_route_runtime_ok");
console.log("community_academy_access_admin_contract_ok");
