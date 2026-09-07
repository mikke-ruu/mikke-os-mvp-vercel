# Media Free: disposable real Auth validation

## Scope and result

2026-09-07, dedicated worktree `mikke-os-mvp-media-integration-20260907`, base `c8b4812`.
The control room prepared and approved a data-free temporary Supabase project
`ydwvaljzorgwmqihvocf`. Production `nttqpprkqbynxyldbnjs` was not changed.
The test's functional cases passed. Its final exit was **1**, because synthetic
user/session cleanup did not fully succeed. The control room was immediately
asked to destroy the entire branch. At 08:19:08 UTC it confirmed deletion
success and a subsequent branch listing containing only the existing main.
The branch existed about 20 minutes. This proves environment disposal, not
successful individual fixture deletion before disposal.

This is real Supabase Auth/PostgREST plus the product database/public adapters,
with a technical Edge browser harness. It is **not** the product editor UI's
end-to-end test, a physical-device test, a production release, or image validation.

## Implementation

- `createMediaDatabaseOperations(client)` uses an injected authenticated client.
  Existing singleton exports remain wrappers. Draft create/read/update project
  explicit columns; caller-supplied owner/publication fields are never spread.
- Public reads use the actual public RPC projection and strict DTO reader.
- A PowerShell launcher captures official CLI branch JSON only in memory, passes
  branch-specific keys in child process environment, and clears them afterward.
- The runner validates exact project URL, JWT project/role/expiry, DB-ready and
  Auth-preflight acknowledgements, explicit invocation and absolute expiry.
- Network requests permit only specified Auth endpoints and REST on this branch.
  Password sign-in and admin-confirmed synthetic users only; no email flow,
  Functions, Storage, billing, customer data, production env, or new schema.
- The browser harness serves actual transpiled factory modules and installed SDK
  on loopback. Admin credentials are stripped from the browser process env;
  browser contexts receive only the public key and synthetic login credentials.
  No screenshots, traces, session files, passwords or keys are persisted.

## Real executed cases

- Synthetic nonanonymous A/B creation and password login.
- No owned Media before creation; one own Media after creation RPC commits;
  B sees none. Only A receives the RPC's `media` active entitlement, source
  `media_create`. No other grant, profile, trial or billing fixture was added.
- Text draft create/read; logout/relogin and separate client restoration.
- B cannot directly read/update A's draft, insert into A's site, publish or
  unpublish A's article.
- Owner cannot directly update article status/current version or site publish
  state; publication RPC is required.
- Anonymous base-table draft access denied and public RPC draft results empty.
- Explicit publish exposes the validated public DTO. Updating the draft leaves
  the public snapshot unchanged. Republish creates a new revision. Unpublish
  hides the article while retaining the draft.
- Independent Edge contexts: A restores the same draft, reload retains session,
  B cannot read A's draft, another A login restores the same data, A logout/B
  login in one context does not mix data.
- A delayed read after a real A-to-B session change returns `stale`.

## Initialization failure and correction

Runs 1 and 2 stopped at the initial empty-ownership assertion. Run 2 observed
`status=stale`: the asynchronous `INITIAL_SESSION` notification correctly
invalidated an in-flight read. Both runs removed their synthetic users.
Run 3 explicitly waited for the initial Auth notification before assertions.
**The product boundary was not weakened or changed. Mutations are not retried.**
All functional cases then passed.

## Cleanup and remaining gates

Browser contexts, browser and loopback HTTP server close in an awaited `finally`;
the browser case returned successfully. The outer runner disposed subscriptions
and attempted sign-out and synthetic-user deletion. It reported
`CLEANUP BRANCH_DELETE_REQUIRED`, correctly yielding exit 1. Exact failing
cleanup operation was not recorded, so a specific FK cause is not proven.
Deletion/retention/immutable-version interactions remain a production gate.
The control room owns complete branch destruction. This expired branch must
never be reused; no credentials are retained for reconnection.

Remaining: actual editor DB wiring and shared login UI E2E, development public
server loader integration, physical/mobile UI checks, image privacy-safe URLs,
deletion/hold/retention design, final legal text/operations, production DB,
push/PR/deploy/public route/homepage approval. All production Media routes
remain disabled. Supabase anonymous sign-ins were disabled on this temporary
branch; anonymous-Auth-user rejection remains covered by isolated SQL/fake
tests, not by an anonymous real Auth session in this run.
