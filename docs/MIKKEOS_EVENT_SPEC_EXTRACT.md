# mikkeOS Event Spec Extract

Created: 2026-07-12
Scope: BP-2-a only. This extracts the Event MVP specification from the old Mikkeruu / Mikkeruu-codex materials without modifying Mikkeruu-codex.

Primary source:

- `G:\Musubiプロジェクト\Mikkeruu-codex\Mikke-ruu_画面目的と機能配置.md`

Supplemental source:

- `G:\Musubiプロジェクト\Mikkeruu-codex\githubtest\index.html` was used only to confirm that the old app contains public event, application, exhibitor/admin, album, survey, notice/email, eyecatch, and receipt-related surfaces. The full 790k-character file was not read as the main specification source.

Master-plan boundary:

- Follow `MIKKEOS_APP_PORTFOLIO_MASTER_PLAN_2026-07-12.md` section 4.2.
- Do not migrate Mikkeruu-codex.
- Build only the small Event MVP subset later: small event creation, public event listing/detail LP, exhibitor/participant application form, admin event creation, admin application list/status, post-confirmation memo.
- Exclude album, survey, exchange/community, bulk thank-you email, eyecatch generation, task sending, receipt issuance.

## Product Role

Event is not a full Mikkeruu replacement. In mikkeOS it should be a small app for a person or small organizer to create one event, publish a simple event page, receive applications, and manage application status.

Old Mikkeruu stays alive as the production event operations tool. mikkeOS Event only inherits the core flow and vocabulary.

## Screens In MVP

| Area | Screen | Route Candidate | Purpose | MVP Notes |
|---|---|---|---|---|
| Public | Event list | `/event` | Visitors and exhibitors find available events. | Shows upcoming events, accepting applications, and finished events only if needed later. |
| Public | Event detail LP | `/event/[id]` or `/event/e/[id]` | Visitor understands event details and can apply. | Keep it lightweight; no album/survey/exchange modules. |
| Public | Application form | `/event/[id]/apply` | Exhibitor/participant applies inside mikkeOS without Google Forms. | One form for exhibitor/participant MVP. |
| Public | Application complete | `/event/[id]/apply/complete` | Confirms application was received and explains next step. | Include "after confirmation, go to My Page" guidance. |
| Owner/Admin | Event dashboard | `/apps/event` or `/event/admin` | Organizer sees event work to do. | Use `MikkeAppShell` and shared primitives when implemented. |
| Owner/Admin | Event create/edit | `/event/admin/new`, `/event/admin/[id]` | Organizer creates a small event. | Wizard-like can be simplified to one edit page. |
| Owner/Admin | Application list | `/event/admin/[id]/applications` | Organizer reviews submitted applications. | Status flow is the key MVP admin function. |
| Owner/Admin | Application detail | `/event/admin/[id]/applications/[applicationId]` | Organizer checks applicant content and updates status. | Include post-confirmation memo fields. |
| Confirmed User | My page | `/event/my/[applicationId]` | Confirmed exhibitor/participant checks what to do next. | Keep to essentials: event, fee, payment, preparation memo, organizer notice. |

## Screens Explicitly Out Of MVP

These exist in Mikkeruu or are implied by the old app, but are not included in Event MVP:

- Albums and media archive
- Surveys/questionnaires
- Exchange/community room
- Bulk thank-you email
- Eyecatch generation and download
- Task sending
- Receipt issuance
- LINE/email automation
- Advanced admin analytics
- Complex booth placement maps
- Full event-operation dashboard parity with Mikkeruu-codex

## Data Items

### Event

| Field | Purpose | Notes |
|---|---|---|
| id | Event identifier | Local/generated initially. |
| owner_profile_id | Organizer ownership | Use mikke profile ownership later. |
| title | Event name | Required. |
| summary | Short public description | For list/detail. |
| description | Detail body | Optional rich text can be plain text in MVP. |
| event_date | Main date | Required. |
| start_time | Start time | Optional. |
| end_time | End time | Optional. |
| venue_name | Venue | Required or strongly recommended. |
| venue_address | Address | Optional. |
| map_url | Map link | Optional. |
| cover_image_url | Public image | Optional placeholder in MVP. |
| fee_label | Fee label | Example: participation fee, booth fee. |
| fee_amount | Fee amount | DESK candidate later, forced private if logged. |
| capacity | Capacity | Optional. |
| application_status | Accepting / closed | Controls public apply button. |
| status | Draft / published / finished / cancelled | Owner-facing status. |
| organizer_notice | Public or applicant-facing notice | Keep as text. |
| created_at / updated_at | Audit | Standard. |

### Application

| Field | Purpose | Notes |
|---|---|---|
| id | Application identifier | Local/generated initially. |
| event_id | Event relation | Required. |
| applicant_name | Name/shop name | Required. |
| contact_email | Contact | Required for MVP. |
| phone | Contact | Optional. |
| instagram | Social link | Optional. |
| website_url | Portfolio/shop URL | Optional. |
| genre | Booth/content genre | Optional. |
| application_note | Applicant note | Optional. |
| image_url | Reference image | Optional; do not implement heavy upload in first pass unless explicitly approved. |
| wants_exchange | Exchange/community preference | Record only if needed; no exchange room MVP. |
| status | Submitted / reviewing / confirmed / declined / cancelled | Main state transition. |
| organizer_memo | Private owner memo | Owner only. |
| confirmed_memo | Memo shown after confirmation | My Page guidance. |
| fee_amount | Confirmed fee | DESK candidate later. |
| payment_status | Not required / unpaid / paid | Optional MVP field; no payment automation. |
| created_at / updated_at | Audit | Standard. |

### My Page / Confirmed Applicant Info

| Field | Purpose | Notes |
|---|---|---|
| application_id | Relation | Required. |
| next_event_summary | Event/date/venue compact view | Derived from event. |
| meet_time | Arrival/setup time | Optional owner memo. |
| booth_fee | Fee to pay | Derived from application/event. |
| payment_note | Payment instructions | Text only. |
| organizer_notice | What organizer wants confirmed applicants to know | Text only. |
| layout_note | Booth/location note | Text only in MVP. |
| guide_url | External guide link | Optional. |
| calendar_url | Calendar link | Optional. |
| marketnote_add_hint | "Add to MarketNote" route hint | Link only; do not auto-save cross-app yet. |

## State Transitions

### Event Status

```text
draft -> published -> finished
draft -> cancelled
published -> cancelled
```

Rules:

- Draft events do not show in the public list.
- Published events show publicly while application status allows it.
- Finished events can remain visible as archive later, but archive is not a first-pass requirement.
- Cancelled events are owner-visible and public-hidden unless a cancellation notice is intentionally shown.

### Application Status

```text
submitted -> reviewing -> confirmed
submitted -> reviewing -> declined
submitted -> cancelled
reviewing -> submitted
confirmed -> cancelled
```

Rules:

- Public form creates `submitted`.
- Owner can mark `reviewing`, `confirmed`, `declined`, or `cancelled`.
- Confirmation unlocks the My Page guidance.
- Declined/cancelled applications remain owner-visible for history, but no public display.

### Payment Status

```text
not_required
unpaid -> paid
paid -> unpaid
```

Rules:

- Payment status is optional in MVP.
- If Event later writes Activity Log / DESK rows, fee/payment data is DESK-targeted and forced private.

## Activity Log Mapping Candidates

These are design candidates only; do not implement during BP-2-a.

| Event action | Story | DESK | Visibility | Notes |
|---|---:|---:|---|---|
| Event created/published | Candidate | No | private initial | Public event can become Story material later, but not automatic. |
| Application received | No | No | private | Contains applicant personal data. |
| Application confirmed | Candidate | No | private initial | Could become "event participation confirmed" only if owner chooses. |
| Participation/booth fee recorded | No | Yes | forced private | Money and applicant info must not enter public Story. |
| Event finished | Candidate | No | private initial | May later produce Story achievement candidate. |

## Implementation Notes For BP-2-b Later

- Build from mikkeOS components, not by copying Mikkeruu-codex HTML/JS.
- Use app-first branding: `Event`, with subtle `Event by mikke` only if needed.
- Use `MikkeAppShell`, `MikkeSection`, `MikkeListRow`, `MikkeStatusBadge`, `MikkeActionCard`, and `MikkeEmptyState`.
- Do not touch Mikkeruu-codex.
- Do not implement DB migrations, RLS, Supabase production wiring, email, LINE, receipt, or album upload in the first Event MVP pass.
- Keep admin wording focused on "organizer", "applicant", "event", "application", and "confirmation" rather than old Mikkeruu-specific operational labels.

## Waiting State

This BP-2-a output is ready for priority review. BP-2-b implementation should wait for explicit instruction after P2-b priority decisions.

## Fable Sign-off（2026-07-12 承認・修正2点付き）

この仕様抽出をBP-2-bの正典として承認する。ただし以下2点を修正して実装すること。

```text
修正1: My Page（/event/my/[applicationId]）は第1パスから外し、
       Event MVP第2パスへ送る。
  理由: 申込者向けページは「推測可能なURLで個人情報が見える」リスクの
  設計判断が必要（申込IDは推測不能なトークンにする等）。第1パスでは
  確定連絡は主催者が手動で行う運用とし、confirmed_memo は
  管理側の申込詳細に保持だけしておく。

修正2: 第1パスの画面は以下の7枚に確定。
  公開側: /event（一覧）/ /event/[id]（詳細LP）/
          /event/[id]/apply（申込）/ apply/complete（完了）
  管理側: /apps/event（ダッシュボード・MikkeAppShell）/
          /event/admin/new と /event/admin/[id]（作成・編集は1ページ形式）/
          /event/admin/[id]/applications（申込一覧・ステータス管理・
          申込詳細と確定後メモを含む）

その他はこのdocsの通り:
  - 状態遷移3種（Event / Application / Payment）は記載通り採用。
  - Activity Logマッピング候補は記載通り（申込者情報・金額はStory禁止・
    強制private）。実装はBP-2-bでも行わず、adapter接続フェーズで別途。
  - 保存はlocalStorage（activity-client-storeと同じ方式）。
  - Mikkeruu-codexには一切触れない。
```
