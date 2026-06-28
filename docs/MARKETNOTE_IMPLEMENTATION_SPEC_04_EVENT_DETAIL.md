# MarketNote Implementation Spec 04

## Event Detail Screen

Target route: `/marketnote/[id]`

## Purpose

- Show registered event details.
- Let users lightly edit event basics without making the page feel like an admin form.
- Let users update payment status, check tasks, memo, reflection notes, and lightweight finance notes.
- Keep the D-style MarketNote world: white base, fine lines, light cards, weak shadows, orange accent, green support, neutral grays.

## Structure

1. Header
   - Back
   - Title: `出店詳細`
   - Edit/save affordance

2. Summary card
   - Status chip
   - Event title
   - Date or date range
   - Start time - end time
   - Venue
   - Payment status
   - Task progress
   - Thin progress bar

3. Basic information
   - Event title
   - Event date / start date / end date
   - Status
   - Start time
   - End time
   - Meet time
   - Pack-up time

4. Venue information
   - Venue name
   - Address
   - Map link is future work.

5. Payment information
   - Payment status: unpaid / paid / not required.
   - Payment method.
   - Amount.
   - Multiple payment rows are future work. `+ 支払い追加` remains visually disabled in the MVP.

6. Check items
   - Toggle done / not done.
   - Show task progress.
   - Add an item.
   - Future connection: due_date and settings-managed templates.

7. Memo
   - Free text.
   - Uses `market_events.public_note` in the MVP.

8. Finance memo
   - Revenue.
   - Expense.
   - Profit.
   - Link toward a future finance page.
   - This is a lightweight note, not accounting software.

9. Reflection
   - Good points.
   - Next improvements.
   - Saved in `market_reflections`.

10. Photos
   - Thumbnail UI.
   - `+ 写真を追加`.
   - Up to five photos in the future. MVP is UI-first.

11. Actions
   - Orange primary button: `変更を保存`.
   - White / orange outline close button.

## MVP Data Handling

- Main editable fields use `market_events`.
- Multi-day `end_date` and time fields use `market_events.private_note` until real columns are added.
- Payment data uses the first event expense record as the MVP event fee row.
- Check items use `market_check_items`.
- Reflection fields use `market_reflections`.

## Future Notes

- Add real `start_date / end_date` columns to `market_events`.
- Add first-class event statuses such as `considering / applied / confirmed / finished / canceled`.
- Add settings-managed check templates with due-date rules.
- Add real photo storage and multi-payment rows.

## 2026-06-28 refinement notes

- The detail screen is confirmation-first, not a large input form.
- Basic information and venue information should start collapsed, or otherwise use compact confirmation-style rows.
- Any section that shows a collapse arrow must actually open and close.
- Do not show edit icons that do not perform an action.
- Reflection inputs should be one column on mobile so longer text remains easy to read and edit.

## 2026-06-28 summary-first layout notes

- The detail screen should make the summary card the primary surface.
- Status changes and quick check completion should be available directly inside the summary card.
- Basic information, venue information, payment information, and detailed check editing should be grouped into one collapsed `各項目編集` card.
- Memo, finance memo, reflection, and photos are record areas below the edit card.
- Reflection is one freeform field with placeholder guidance such as `今日の反応、気づいたこと、次回やることなど`.
- Finance details should not be edited in a popup on the detail screen. The detail screen shows totals and links to a future finance page for detailed revenue / expense entry.
