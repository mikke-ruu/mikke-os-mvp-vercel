# Implementation Notes

## Rule

Do not modify existing projects:

- marketnote
- mikkeruu-app
- mikkeruu-saas
- miraco

Only implement `mikke-os-mvp`.

## Activity Log

MarketNote details belong in:

- market_events
- market_check_items
- market_financial_records
- market_reflections

`activity_logs` only stores activity facts.

## Story

Never show financial amounts on Story.

Story reads public logs:

```text
visibility = public
display_on_story = true
```

## DESK

DESK is not accounting software. It only shows rough activity revenue, expenses, and profit.

## Numeric Inputs

For numeric fields across Mikke OS, prefer mobile numeric keyboards.

- Use `inputMode="numeric"` for integers such as amounts, quantity, people count, photo count, and number-centered booth fields.
- Use `pattern="[0-9]*"` when decimals are not needed.
- Use `inputMode="decimal"` only when decimals may be valid.
- Prefer `type="text"` with `inputMode` when `type="number"` would add browser spinners or unstable mobile styling.
