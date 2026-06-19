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
