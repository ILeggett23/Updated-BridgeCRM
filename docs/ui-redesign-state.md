# UI redesign state

- **Completed phase:** Phase 8 — Contacts List.
- **Files changed:** `src/app.js`, `src/styles.css`, `tests/smoke.test.mjs`, `docs/ui-redesign-state.md`.
- **Components created or changed:** Compact relationship-focused Contacts rows, subdued search/filter controls, smaller avatars/status badges, collapsible date filter, route loading skeleton, and reconnecting status notice.
- **Tests run:** `node --check src/app.js`; `node build.mjs`; `node --test tests/contact-logic.test.mjs tests/smoke.test.mjs`; `git diff --check` — passed (57 tests). Visual regression checked 320px, 375px, 390px, and 430px widths.
- **Existing behavior verified:** Search, List/Pipeline/Places views, sort, role/visibility/relationship/date filters, empty state, contact opening, call/text links and logging, stages, real contact data, favorite places, archive behavior, and bottom-dock clearance remain intact.
- **Remaining issue:** The redesigned routes have not yet received a single cross-route visual/accessibility regression pass as a group.
- **Exact next phase:** Phase 9 — redesign one selected remaining route group only, then run its targeted regression checks.
