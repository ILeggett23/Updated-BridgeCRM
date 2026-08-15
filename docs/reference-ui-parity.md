# BridgeCRM reference UI parity

This checklist compares the production BridgeCRM presentation layer with the
public `BridgeCRM-Mobile-Redesign` reference at commit `fc91360` and the approved
393 x 852 screenshots supplied on August 14, 2026.

The reference controls presentation and interaction. Production BridgeCRM
continues to control persistence, authentication, synchronization, analytics,
notifications, follow-ups, scorecards, and pipeline behavior. No reference
provider, demo record, mock metric, or local-only prototype state is used.

## Immutable production pipeline contract

- [x] Prospect stages remain, in order: `PQI`, `QI/P`, `FUP`, `LA`.
- [x] Customer stages remain, in order: `CNA`, `Proposal`, `Follow-Up`,
      `Order Placed`, `Active Customer`.
- [x] Standalone activity markers `MSA` and `DTM` remain outside either
      pipeline.
- [x] Stage labels, assignments, transitions, history, persistence, and
      analytics continue to use those exact values.

## Shared foundation

- [x] Reference colors are production tokens: warm canvas `#F5F2EC`, white
      surface `#FFFFFF`, raised surface `#FBFAF7`, ink `#1B1913`, warm grays,
      Bridge teal, ember, amber, moss, and sand borders.
- [x] Newsreader and Inter Tight are loaded locally and used for editorial and
      interface roles.
- [x] The shell is mobile first, capped at 460 px, and honors all four safe-area
      insets.
- [x] Bottom navigation uses the reference 60 px bar, 20 px icons, 11 px labels,
      active underline, and raised 48 px Capture action.
- [x] Routed headers use the reference eyebrow, editorial title, Back behavior,
      and sticky safe-area geometry.
- [x] Sheets use a 26 px top radius, 92dvh ceiling, dim/blur overlay, drag
      handle, focus management, Escape behavior, and reduced-motion fallback.
- [x] Toasts, buttons, inputs, chips, avatars, dividers, rows, empty states, and
      loading states share production primitives rather than page-local themes.

## Screen and component migration checklist

### App shell, navigation, and headers

- [x] `AppShell.tsx`, `BottomNavigation.tsx`, and `ScreenHeader.tsx` map to the
      production shell, `Navigation()`, and `PresentationScreen()`.
- [x] Today, People, Pipeline, and Insights are the only primary destinations;
      Capture remains the centered global action.
- [x] Search, profile, timeline, stage detail, Goals, Scorecard, and Settings are
      addressable presentation routes with Back/Forward and reload support.

### Capture and activity composer

- [x] `ActivityComposer.tsx` maps to `quickCreateModal()` with the six reference
      choices backed by existing production create/log actions.
- [x] `QuickCapture.tsx` conversation and meeting flows use the reference step
      count and sequence while retaining production-only date, stage, What I
      Know, relationship, and follow-up fields behind progressive disclosure.
- [x] Person suggestions come from real recent relationship activity.
- [x] Place suggestions come from real saved/favorite/recent place activity.
- [x] Call, text, follow-up, add-person, and other supported activity continue
      to write through existing models and analytics rules.

### Today

- [x] Reference greeting, goal line, Next Up, attention rows, relationship feed,
      worth-doing intelligence, and compact momentum visualization use real
      production data.
- [x] Empty, completed-goal, overdue, upcoming, long-content, and safe-area
      states remain supported.

### People, search, profile, and timeline

- [x] People rows, avatars, metadata, exact stage chips, quick filters, dividers,
      and density match the reference grammar.
- [x] Dedicated search is addressable, autofocuses, supports clear/Back/reload,
      uses real recent suggestions, and opens real profiles.
- [x] All production filters remain available in the reference-style sheet.
- [x] Profile header, contact actions, next action, Bridge Brief, timeline,
      details, exact pipeline status, editing, and stage history remain bound to
      the existing contact record.

### Pipeline

- [x] Prospect and Customer tabs, stage rail, counts, avatars, expansion,
      recency/stall presentation, movement history, unstaged people, detail, and
      transition screens use the reference layout.
- [x] The production stage arrays above remain the sole taxonomy and ordering
      source.

### Follow-ups and places

- [x] Follow-up Today/Upcoming/Overdue/Completed views call the existing Call,
      Text, Done, Reschedule, Delete, and View Relationship paths.
- [x] Places overview/detail, associated people, activity, favorites, and
      conversation capture remain backed by existing place records.

### Insights and analytics

- [x] Reference overview narrative, weekly activity chart, pipeline
      intelligence, stage distribution, follow-up effectiveness, and place
      sections use current analytics definitions.
- [x] Detailed Analytics uses the reference flat metric/bar architecture while
      preserving exact production stage values and honest empty states.

### Goals, streaks, and achievements

- [x] `SettingsGoals.tsx` maps to the production Goals settings with reference
      target-field hierarchy and the existing recurring/one-time rest-day
      editor retained through progressive disclosure.
- [x] `Goals.tsx` maps to the production Progress route with real today, current
      calendar-week, and current calendar-month counted-conversation totals.
- [x] Achievement rows use the existing production definitions and unlock
      state; reference demo names and counts are not copied.

### Scorecard

- [x] `Scorecard.tsx` maps to the secure production scorecard flow with reference
      preview, scope cards, disclosure, and primary action geometry.
- [x] Seven-day expiry, contact-scope privacy, authenticated creation, image
      export, revoke behavior, and existing shared-link compatibility remain
      production-owned.

### Settings, account, sync, and notifications

- [x] Settings root uses the reference flat grouped row hierarchy.
- [x] Account/profile, Goals, Notifications, and Data & Sync subpages use the
      same flat editorial form/row density while retaining real account,
      session, push, sync, backup, import, and export behavior.
- [x] Relationship-health, cadence, workflow, backup, privacy, and About
      controls remain accessible even where the reference prototype omits them.
- [x] The prototype Appearance route is intentionally not migrated. BridgeCRM's
      approved appearance is fixed; color, accent, theme, serif-name, and
      density controls stay removed. `prefers-reduced-motion` remains active as
      accessibility behavior.

## Validation gates

- [ ] Compare reference and production at 393 x 852 for Capture menu and steps,
      Today, People, both pipelines, Insights, Analytics, Goals, Settings,
      Account, Notifications, Data & Sync, and Scorecard.
- [ ] Verify narrow phone width, standard phone width, standalone/safe-area
      geometry, long text, empty states, keyboard focus, and reduced motion.
- [ ] Run the complete automated suite and production build.
- [ ] Confirm no demo data, pipeline mutation, schema change, auth/sync change,
      analytics redefinition, or appearance controls were introduced.
- [ ] Publish the exact verified source and perform a hosted smoke check.
