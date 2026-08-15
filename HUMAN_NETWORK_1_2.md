# Bridge 1.2 Human Network implementation matrix

This release treats the six supplied Human Network mockups as one visual system while retaining Bridge's real routes, storage, account synchronization, offline behavior, and existing records. Unsupported mockup concepts are not fabricated.

## Baseline

- Routes: `dashboard`, `contacts`, `add`, `followups`, and `analytics` remain the stable deep-link identifiers.
- Mobile labels become Dashboard, Contacts, Add, Actions, and Insights without changing route IDs.
- Persistence remains IndexedDB-first with the existing local cache, optional account record synchronization, and JSON backup/restore.
- Baseline build passed. Baseline tests: 103 passed, 1 existing typography/glass contract failed.
- Production record counts are unavailable in this checkout and are not inferred from fixtures.

## Mockup-to-route preservation

| Human Network reference | Bridge route or surface | Preserved real capability | 1.2 treatment |
| --- | --- | --- | --- |
| Dashboard | `dashboard` | Daily goal, streak, contacts, follow-ups, pipeline and achievements | Relationship health summary, due actions, attention list, real trend and recent activity |
| Contacts | `contacts` | List, Pipeline, Places, search, role/type/visibility/date filters | Health band/trend/cadence filters and compact relationship rows |
| Add New | `add` plus quick-create sheet | Counted conversation, contact, place, tracking and notes | Four explicit entry paths; opening Add never creates data |
| Follow-Ups | `followups` (presented as Actions) | Scheduled follow-ups and reminders | Overdue, Today, Upcoming, Completed with edit, reschedule, complete and delete lifecycle |
| Analytics | `analytics` (presented as Insights) | Day/Week/Month/Custom metrics, pipeline, scorecards | Existing totals plus accessible action, health, growth and consistency views |
| Settings | settings sheet | Profile, workflow, appearance, notifications, backup and account | Cadence presets, score visibility and opt-in health notifications |

## Contact detail preservation

- Overview: identity, role, stage, health explanation and next action.
- Activity: counted conversations, communication logs and stage history.
- Personal Info: the existing dedicated learned-information field; never merged into Notes.
- Notes: regular notes and existing attachment controls where supported.

## Data boundaries

- Only records explicitly marked `isCountedConversation` feed goal, streak, consistency and momentum.
- Active summaries exclude archived and explicit No-Go contacts, while their history remains intact.
- Health is deterministic and versioned. It does not invent email, relationship links, AI suggestions, files, actions or historical transitions.
- Follow-up lifecycle is additive on the existing records; deleted and canceled records remain available for history but never return to active reminders.
- Rest/excluded days affect streak continuity only and do not remove activity from analytics.
