# mikkeOS Phase 4 Supabase Adapter Plan

Status: design only. Do not switch production saving yet.

Safe insert test status, 2026-07-06:

- One private `mikkeos_test` activity log was inserted through the safe test payload by using a temporary local PowerShell access token.
- The test reported `ok: true`, `insert.ok: true`, and `select.ok: true`.
- The saved payload was private, not displayed on Story, not counted toward summary, and not aggregated by DESK.
- The access token was removed from the PowerShell environment after the test and was not written to chat, docs, Git, or `.env.local`.
- This confirms the first safe adapter-payload path can pass current `activity_logs` RLS and constraints.
- This does not enable Supabase saving for normal screens.

Private revenue test status, 2026-07-06:

- One private `mikkeos_test` revenue activity log was inserted and selected successfully.
- The test reported `insert.ok: true` and `select.ok: true`.
- The saved payload used `visibility: "private"`, `display_on_story: false`, `counts_toward_summary: false`, `has_financial_value: true`, `amount: 1000`, `transaction_type: "revenue"`, and `payment_status: "paid"`.
- This confirms the first private DESK revenue payload can pass current `activity_logs` financial constraints and RLS.

Public Story test status, 2026-07-07:

- One public `mikkeos_test` Story activity log was inserted and selected successfully.
- The test reported `ok: true`, `insert.ok: true`, and `select.ok: true`.
- The saved payload used `visibility: "public"`, `display_on_story: true`, `counts_toward_summary: true`, `has_financial_value: false`, `amount: null`, and `transaction_type: "none"`.
- The test reported `story.visible: true` and `story.public_policy_readable: true`, confirming the public Story RLS policy can read the intended public row.
- The test reported `desk.counted: false` and `summary.counted: true`.
- This confirms the first public Story payload can pass current `activity_logs` constraints and RLS without becoming a DESK financial row.
- The access token was removed from the PowerShell environment after the test.

Item Studio test mode status, 2026-07-07:

- `/apps/item-studio` now shows a Supabase test save box only for the "作品を登録" preset.
- The normal localStorage Activity Log button remains unchanged.
- A browser check confirmed the test box and button render.
- The browser save attempt stopped before insert because the browser session was not logged in, showing `Supabase test save needs a logged-in user.`
- This is the expected safety behavior; no Supabase row was inserted during that browser check.
- A later logged-in in-app browser test inserted and selected one Item Studio `item_created` row successfully.
- The logged-in test reported `insert: ok`, `select: ok`, Story `公開対象`, DESK `対象外`, and 活動実績 `含める`.
- The saved `source_record_id` was `item-studio-test-2026-07-07T05:01:58.621Z-d74eb705-50d3-4dc9-8e6b-8a9309f59532`.
- This confirms the first one-app, one-action Item Studio save path can pass the current authenticated RLS and constraints without switching normal screens away from localStorage.
- A second logged-in in-app browser test inserted and selected one Item Studio `item_sold` row successfully.
- The sale test reported `insert: ok`, `select: ok`, `source_service: item_studio`, `category: product`, `has_financial_value: true`, `amount: 4800`, `transaction_type: revenue`, and `payment_status: paid`.
- The sale test also reported `visibility: private`, `display_on_story: false`, and `counts_toward_summary: false`.
- The saved sale `source_record_id` was `item-studio-sale-test-2026-07-07T05:41:13.228Z-c08117e7-a872-4525-a9f7-d036382e2b1a`.
- This confirms Item Studio sale logs can be DESK targets while staying out of public Story and activity-summary counts.

Log read test status, 2026-07-07:

- `/log` now includes a separate `Supabase読み取りテスト` box.
- The normal `/log` Activity Log list remains localStorage-backed.
- The read test checks the logged-in user's Supabase session before selecting from `activity_logs`.
- If there is no logged-in user, it stops before DB select and shows `Supabase read test needs a logged-in user.`
- A logged-in in-app browser test read 5 `source_service = item_studio` rows from `activity_logs`.
- The read test displayed the Item Studio registration log as `visibility: public`, `display_on_story: true`, `counts_toward_summary: true`, `has_financial_value: false`, and `transaction_type: none`.
- The read test displayed the Item Studio sale log as `visibility: private`, `display_on_story: false`, `counts_toward_summary: false`, `has_financial_value: true`, `amount: 4800`, `transaction_type: revenue`, and `payment_status: paid`.
- This confirms `/log` can read the saved Item Studio test rows from Supabase without switching the normal `/log`, `/os`, `/story`, or `/desk` data source.

Story / DESK / activity-summary extraction test status, 2026-07-07:

- The `/log` Supabase read test box now includes a separate extraction check for Story, DESK, and activity-summary targets.
- Story targets use `visibility = public` and `display_on_story = true`.
- DESK targets use `has_financial_value = true`, `transaction_type in revenue / expense`, and `amount is not null`.
- Activity-summary targets use `counts_toward_summary = true`.
- A logged-in in-app browser test read 5 `source_service = item_studio` rows and displayed Story target count `2`, DESK target count `3`, and activity-summary target count `3`.
- The Item Studio registration log appeared in Story and activity-summary targets, and did not appear in DESK targets.
- The Item Studio sale log appeared in DESK targets, and did not appear in Story or activity-summary targets.
- This confirms the saved Supabase `activity_logs` rows can be extracted into downstream Story / DESK / activity-summary groups without switching `/story`, `/desk`, `/os`, or the normal `/log` display to Supabase.

Activity log filter helper status, 2026-07-07:

- Story / DESK / activity-summary destination checks now live in `lib/mikkeos/activity-log-filters.ts`.
- The shared helpers are `isStoryVisibleLog`, `isDeskCountedLog`, `isSummaryCountedLog`, and `splitActivityLogsByDestination`.
- `/log`'s Supabase read test box now uses these helpers instead of local inline conditions.
- This only centralizes the tested extraction conditions. It does not switch `/story`, `/desk`, `/os`, or the normal `/log` display to Supabase.

Story read test status, 2026-07-08:

- `/story` now includes a separate `Supabase Story読み取りテスト` box.
- The normal `/story` profile display remains localStorage / mock-backed.
- The read test checks the logged-in user's Supabase session before selecting from `activity_logs`.
- If there is no logged-in user, it stops before DB select and shows `Supabase story read test needs a logged-in user.`
- The test box filters fetched rows with the shared `isStoryVisibleLog` helper.
- Story target rows use `visibility = public` and `display_on_story = true`.
- The test box displays Story target count, Story non-target count, and the Story target rows' `title`, `source_service`, `category`, `visibility`, `display_on_story`, `counts_toward_summary`, `has_financial_value`, `transaction_type`, `occurred_at`, and `created_at`.
- A logged-in in-app browser test displayed Story target count `2` and Story non-target count `10`.
- The Item Studio registration log appeared in the Story target list.
- The Item Studio sale log did not appear in the Story target list.
- See `docs/MIKKEOS_PHASE4_STORY_SUPABASE_READ_TEST.md` for the Story read-only test scope.

DESK read test status, 2026-07-08:

- `/desk` now includes a separate `Supabase DESK読み取りテスト` box.
- The normal `/desk` summary display remains localStorage / mock-backed.
- The read test checks the logged-in user's Supabase session before selecting from `activity_logs`.
- If there is no logged-in user, it stops before DB select and shows `Supabase desk read test needs a logged-in user.`
- The test box filters fetched rows with the shared `isDeskCountedLog` helper.
- DESK target rows use `has_financial_value = true`, `amount is not null`, and `transaction_type = revenue or expense`.
- The test box displays DESK target count, DESK non-target count, revenue total, expense total, net total, and each DESK target row's `title`, `source_service`, `category`, `amount`, `transaction_type`, `payment_status`, `visibility`, `display_on_story`, `counts_toward_summary`, `has_financial_value`, `occurred_at`, and `created_at`.
- A logged-in in-app browser test displayed DESK target count `11`, DESK non-target count `9`, revenue total `￥225,800`, expense total `￥10,250`, and net total `￥215,550`.
- The Item Studio sale log appeared in the DESK target list and contributed `revenue / 4800`.
- The Item Studio registration log did not appear in the DESK target list.
- See `docs/MIKKEOS_PHASE4_DESK_SUPABASE_READ_TEST.md` for the DESK read-only test scope.

OS summary test status, 2026-07-08:

- `/os` now includes a separate `Supabase OSサマリーテスト` box.
- The normal `/os` Home display remains localStorage / mock-backed.
- The summary test checks the logged-in user's Supabase session before selecting from `activity_logs`.
- If there is no logged-in user, it stops before DB select and shows `Supabase OS summary test needs a logged-in user.`
- The test box uses the shared `isStoryVisibleLog`, `isDeskCountedLog`, `isSummaryCountedLog`, and `splitActivityLogsByDestination` helpers.
- The test box displays Supabase total log count, Story target count, DESK target count, activity-summary target count, revenue total, expense total, net total, and the latest 5 Activity Logs with destination labels.
- A logged-in in-app browser test displayed Supabase total log count `63`, Story target count `12`, DESK target count `27`, activity-summary target count `13`, revenue total `￥513,800`, expense total `￥33,750`, and net total `￥480,050`.
- The latest 5 Activity Logs included the Item Studio registration log as Story target / DESK non-target / activity-summary target.
- The latest 5 Activity Logs included the Item Studio sale log as Story non-target / DESK target / activity-summary non-target.
- See `docs/MIKKEOS_PHASE4_OS_SUPABASE_SUMMARY_TEST.md` for the OS summary read-only test scope.

## Goal

Phase 4 prepares the path from the current local Activity Log prototype to Supabase-backed saving.

Current prototype:

- `UnifiedActivityLog` is the app-level common activity type.
- `activity-client-store.ts` stores and reads logs from localStorage.
- Mini app screens create activity logs locally.

Phase 4 should keep this behavior and add an adapter boundary so localStorage can later be replaced by Supabase.

## Adapter Shape

Use `ActivityLogAdapter` from `lib/mikkeos/activity-adapter.ts`.

```ts
type ActivityLogAdapter = {
  list(profileId: string): Promise<UnifiedActivityLog[]>;
  create(log: UnifiedActivityLog, context: ActivityAdapterContext): Promise<UnifiedActivityLog>;
};
```

The UI should call the adapter through a small store layer. The adapter can be backed by:

- localStorage for prototype mode
- Supabase for authenticated mode

## Field Mapping

| UnifiedActivityLog | activity_logs |
| --- | --- |
| `profileId` | `profile_id` |
| context `userId` | `user_id` |
| `appKey` | `source_service` |
| `eventType` | `activity_type` |
| `sourceId` | `source_record_id` |
| `title` | `title` |
| `description` | `description` |
| `occurredAt` | `occurred_at` |
| `visibility` | `visibility` |
| `storyEnabled` | `display_on_story` |
| `storyEnabled` | `display_in_timeline` |
| `storyEnabled` | `display_as_achievement` |
| `deskEnabled && amountType !== "none"` | `has_financial_value` |
| `amount` | `amount` |
| `amountType: income` | `transaction_type: revenue` |
| `amountType: expense` | `transaction_type: expense` |
| `amountType: none` | `transaction_type: none` |
| `metadata.paymentStatus` | `payment_status` |
| `metadata.category ?? appKey` | `category` |

## Transform Function

`toSupabaseActivityLogInsert()` converts `UnifiedActivityLog` to the existing Supabase insert payload.

Important details:

- `source_service` should usually become the app key, but MarketNote is the compatibility exception.
- For MarketNote, keep `UnifiedActivityLog.appKey: "market_note"` in the UI and save `source_service: "marketnote"` to match the existing writer.
- When reading from Supabase, normalize both `source_service: "marketnote"` and `source_service: "market_note"` back to `appKey: "market_note"`.
- See `docs/MIKKEOS_PHASE4_MARKETNOTE_SOURCE_SERVICE_POLICY.md` for the fixed normalization policy.
- `income` maps to existing DB value `revenue`.
- `deskEnabled` controls whether a log has financial value.
- non-financial logs save `amount: null`, `transaction_type: none`, and `payment_status: not_required`.
- Story flags are intentionally separate from DESK flags.
- Financial, payment, and internal office logs must not rely on DB defaults. Save them with `visibility: "private"`, `display_on_story: false`, and `counts_toward_summary: false`.
- See `docs/MIKKEOS_PHASE4_RLS_POLICY_CONFIRMATION.md` for the public Story RLS notes.
- See `docs/MIKKEOS_PHASE4_ACTIVITY_LOG_CONSTRAINTS_AND_POLICY_CHECK.md` for confirmed check constraints, defaults, and update/delete policy checks before save testing.
- See `docs/MIKKEOS_PHASE4_UPDATE_POLICY_CONFIRMATION.md` for the Dashboard-confirmed update policy body.
- See `docs/MIKKEOS_PHASE4_DELETE_POLICY_CONFIRMATION.md` for the Dashboard-confirmed delete policy body and the full RLS summary before save testing.
- See `docs/MIKKEOS_PHASE4_SAFE_INSERT_TEST_RUNBOOK.md` for the first safe private insert/select test procedure.
- See `docs/MIKKEOS_PHASE4_FINANCIAL_AND_PUBLIC_STORY_TESTS.md` for the next private revenue and public Story payload tests.
- See `docs/MIKKEOS_PHASE4_ITEM_STUDIO_SUPABASE_TEST_MODE.md` for the first one-app, one-action Supabase test mode on `/apps/item-studio`.
- See `docs/MIKKEOS_PHASE4_LOG_SUPABASE_READ_TEST.md` for the first `/log` Supabase read-only test box.
- See `docs/MIKKEOS_PHASE4_STORY_SUPABASE_READ_TEST.md` for the first `/story` Supabase Story read-only test box.
- See `docs/MIKKEOS_PHASE4_DESK_SUPABASE_READ_TEST.md` for the first `/desk` Supabase DESK read-only test box.
- See `docs/MIKKEOS_PHASE4_OS_SUPABASE_SUMMARY_TEST.md` for the first `/os` Supabase OS summary read-only test box.

## Existing MarketNote Integration

Current `lib/activity-log.ts` writes directly to Supabase and hardcodes:

- `category: "event"`
- `source_service: "marketnote"`

When integrating, keep MarketNote working but route new writes through the same adapter path:

1. Convert MarketNote event/finance/reflection actions into `UnifiedActivityLog`.
2. Pass the unified log to the selected adapter.
3. Use the Supabase adapter to call `activity_logs.upsert`.
4. Keep `onConflict: "profile_id,source_service,source_record_id"` if that remains the DB unique rule.

Do not delete the old MarketNote writer until parity is verified.

## RLS / Identity Notes

Supabase saving needs both:

- `user_id`: authenticated Supabase user id
- `profile_id`: Mikke ID profile id

Expected rule:

- users can read/write rows where `activity_logs.user_id = auth.uid()`
- profile ownership should also be validated through `profiles.user_id = auth.uid()` where needed

The prototype currently uses `profile-ayumi`, so it must not write directly to production tables without a real authenticated user and profile.

## Not Yet Implemented

- Supabase adapter runtime implementation
- DB writes from mini app screens
- DB reads for OS / Log / Story / DESK
- migration or schema changes
- RLS updates

The current app remains localStorage-backed.
