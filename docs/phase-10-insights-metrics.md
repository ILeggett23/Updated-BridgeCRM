# Phase 10 Insights metric definitions

Phase 10 changes presentation only. Existing scorecard metrics, daily-goal logic, follow-up lifecycle, and pipeline stage definitions remain unchanged.

## Existing calculations retained

- **Counted conversations:** conversation records with `isCountedConversation === true` whose conversation date falls in the selected local date range.
- **Phone numbers captured:** unique normalized phone numbers counted on their earliest recorded `phoneCapturedAt` date.
- **Shared scorecard Prospects and Customers:** contacts first met in the selected range, grouped by their existing role.
- **Follow-up effectiveness:** completed follow-ups divided by non-deleted follow-ups whose `createdAt` (or `dueDate` when `createdAt` is absent) is in the selected range.
- **Goal streak:** the existing `dailyGoalMetrics` calculation, including configured exclusions and recurring rest days.

## Reliable derived metrics introduced

- **New people:** contacts whose persisted `dateFirstMet` is in the selected range.
- **Pipeline movements:** persisted `stageEvents` in the selected range whose destination is one of the exact canonical stages for that contact's role.
- **Conversation activity by day:** counted conversations grouped by local calendar day.
- **Goal consistency:** days in the selected range meeting the saved conversation goal, shown only when the period contains at least one counted conversation.
- **Current stage distribution:** active, non-filtered contacts grouped by the exact current stage resolved by Bridge's existing pipeline logic.
- **Stalled relationships:** current-stage age greater than 21 calendar days, shown only when the current stage has a persisted stage date or stage event.
- **Saved-place activity:** counted conversations and pipeline movements in the selected range among contacts currently linked to each saved place. This is relationship activity associated with a saved place, not a claim that an event occurred at that location.
- **Communication outcomes:** stored call/text outcomes grouped exactly as recorded in the selected range.

When a percentage or chart cannot be supported by activity in the selected period, Insights renders an unavailable/empty state instead of a zero percentage or an empty chart.
