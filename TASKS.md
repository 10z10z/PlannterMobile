# Tasks

Road to a production-ready 1.0. Grouped by tier, not by area — tier 1 is what
makes the app trustworthy, tier 2 is what makes the repo credible, tier 3 is
what makes it feel finished, tier 4 is what ships and presents it.

Done items have been removed. What's below is open.

**Where it stands (updated 2026-08-06, after phase 0):** 111 JS files, ~17.9k
lines. 368 unit tests across 16 suites, all passing, all covering `lib/` pure
logic — 55% statement coverage of `lib/`, which is the floor CI now enforces.
ESLint, Prettier, `tsc --noEmit` over JSDoc and a GitHub Actions run of all four
are in place and green. Still no component tests. RLS policies and indexes are
in place on every table.

**Phase order:** 0 guardrails (done) → 1 data layer → 2 validation → 3 test
depth → 4 polish. **Tier 4 is deliberately parked** until the feature set
settles: more features are coming, and screenshots, store copy and an
architecture doc written now would only be rewritten. The point of phases 1–4 is
that whatever gets built next lands on a foundation that already handles its
errors, validates its inputs and is testable.

---

## Carried over

- [ ] **Move "Save as a feeding" to the top of the NPK calculator.** It sits
      below the micronutrient card at the end of a long scroll
      (`screens/calculator/NpkCalculatorScreen.js:428`) — the one action the
      screen exists to produce is the hardest thing on it to reach. Header
      action or FAB.
- [ ] **Free-text note on the dashboard.** Just jot something down — "the
      chillies look leggy" — dated, editable, deletable. Needs a `notes` table + migration, a card on the dashboard, and a spot in the calendar day view.
- [ ] **Input safety** — see _Validation & input safety_ below, expanded.
- [ ] **Colour scheme improvements: login and signup screens.** Splash is done.
      Login is still a bare centred column with a 🌱 emoji as the logo
      (`screens/auth/LoginScreen.js:24`) while the app ships a real mark at
      `assets/plannter-logo.png`. Signup is the same. These are the first
      screens anyone sees, including a reviewer.

---

## Tier 1 — Correctness and trust

The gaps here are the ones that produce a bad demo on a flaky train wifi.

### Error handling

- [x] **A query cache.** TanStack Query adopted: `lib/queryClient.js` wires
      `focusManager` to AppState and `onlineManager` to NetInfo, which is what
      React Native needs before either works. `lib/queryKeys.js` holds every key
      and, in `AFFECTED_BY`, what each _action_ invalidates — so a mutation
      names what it did rather than remembering which four caches it dirtied.
- [x] **Error boundaries.** `components/ErrorBoundary.js` at the root and around
      each of the five tabs, so a screen that throws takes only itself down.
- [x] **Raw Supabase errors no longer reach users.** `lib/errors.js` maps
      Postgres SQLSTATE, PostgREST and GoTrue codes to sentences, with text
      matching for the older GoTrue releases that send wording without a code.
      29 tests, one of which asserts no raw database text can get through.
- [x] **Retry on transient failure only.** `isRetryable` splits a dropped
      connection from a constraint that will fail identically forever. Writes
      are never retried — none of them are idempotent, and a lost response
      would sow a tray twice.
- [ ] **Apply the triad to every screen.** `components/QueryBoundary.js` gives
      loading / error + retry / empty in one place, and fertilizers is converted
      as the reference. The other 21 screens still swallow their failures.
- [ ] **Offline banner.** NetInfo is installed and queries already pause when
      the connection goes, but nothing tells the user that is why.
- [ ] **Session expiry is unhandled.** If the refresh token dies the next query
      just fails. `isAuthExpired` recognises it; nothing acts on it yet. Listen
      for `onAuthStateChange` → `SIGNED_OUT` and route back to login with an
      explanation.
- [ ] **Optimistic updates for the cheap actions** — ticking a job off the
      dashboard, watering a plant, marking a cell germinated. They currently
      round-trip before the UI moves.

### Data integrity

- [ ] **`createSowing()` isn't atomic** and neither are the multi-step saves in
      `GrowspaceFormDialog` (growspace → grids → lights). PostgREST has no
      transactions, so these hand-roll rollbacks and the seed-count subtraction
      isn't rolled back at all. Move each multi-write operation into a Postgres
      RPC function so the database does the transaction.
- [ ] **Orphaned images.** `lib/storage.js` uploads but nothing ever deletes —
      removing a plant or seed pack leaves its photo in the bucket forever.
      Delete on entity removal, and add a reconciliation the account-deletion
      path can call.
- [ ] **The uploads bucket is public.** `insert into storage.buckets … public`
      (`0001_init.sql:144`). Writes are correctly scoped to `<user_id>/…`, but
      _reads_ are open to anyone who has the URL — a user's plant photos are
      protected only by an unguessable path. Switch to a private bucket with
      signed URLs (and a short-lived URL cache), or write down why not.
- [ ] **No RLS regression tests.** Policies exist on all 20 tables, and nothing
      proves they still work after the next migration. Add an integration suite
      against a local Supabase that signs in as two users and asserts user B
      cannot read, update or delete a single row of user A's — every table.
      This is the security test a reviewer actually looks for.

### Validation & input safety

- [ ] **Centralise validation.** It's currently ad-hoc and per-dialog — humidity
      is range-checked in `GrowspaceFormDialog` but not everywhere it's entered,
      and numeric fields elsewhere accept anything `Number()` tolerates. Build
      `lib/validation.js` (or adopt Zod) with one schema per entity, used by
      every form, fully unit-tested.
- [ ] **Errors belong on the field, not at the bottom of the dialog.** Right now
      one `ErrorText` at the end of a scrolling form reports whichever rule
      failed first — off-screen, and one at a time. Per-field `HelperText`,
      validate on blur, show everything that's wrong at once.
- [ ] **Range and sanity limits everywhere numbers are entered:** grid rows and
      columns (a 999×999 grid renders ~1M cells and locks the app), seed counts
      vs. pack quantity, wattage, PPFD, dose sliders, watering interval,
      quantities, temperature, humidity, sun hours.
- [ ] **Length caps and trimming on every text field** — names, descriptions,
      notes. Enforce in the DB too (`check (length(name) <= 80)`), not just in
      the UI.
- [ ] **Locale-safe number parsing.** `Number(x.replace(',', '.'))` is repeated
      inline in several dialogs; one helper, tested against `1,5` / `1.5` /
      `1 234` / `''` / `abc` / `-0`.
- [ ] **Disable submit while invalid** instead of validating only on press.
- [ ] **Guard against double submission** — the save buttons disable on
      `saving`, but confirm every dialog does, including the destructive ones.

---

## Tier 2 — Engineering signals

This is the tier a technical reviewer reads first. The four guardrails are in
and green; the rest of the tier is still open.

- [x] **ESLint** — `eslint-config-expo` flat config plus a handful of house
      rules, `eslint-config-prettier` last. All 15 findings fixed rather than
      configured away; the three deliberate `exhaustive-deps` exceptions carry
      an inline reason.
- [x] **Prettier**, `.prettierrc`, `.prettierignore` (generated `lib/themes.js`
      is excluded) and `.editorconfig`. 72 files reformatted.
- [x] **Type checking without a rewrite.** `checkJs` over JSDoc. Went from 1107
      errors to zero; the real ones it caught are listed at the bottom of this
      file.
- [x] **CI on GitHub Actions** — lint, format check, typecheck and test on every
      push and PR, with a badge in the README.
- [x] **Coverage floor** at the current 55% of `lib/`, enforced by
      `coverageThreshold`, to be ratcheted as tests land.
- [ ] **Coverage badge.** Needs a Codecov or Coveralls upload step; the run
      already produces `lcov`.
- [ ] **Component and integration tests.** All 368 tests are pure functions;
      not one renders a component. Add `@testing-library/react-native` and
      cover the paths that matter: login, create a growspace, sow a tray,
      transplant a cell, log a feeding, tick off a scheduled action. Mock
      Supabase at the client boundary with MSW or a hand-rolled fake.
- [ ] **A pre-commit hook** (husky + lint-staged) so the above can't rot.
- [ ] **Dependabot or Renovate** — a config file is five lines and shows you
      think about supply chain.
- [ ] **A data layer boundary.** 23 screens import `supabase` and build queries
      inline. Move every query behind `lib/` repository functions so screens
      never touch the client — which is also what makes them testable and what
      makes swapping in a query cache a small diff.
- [ ] **Split the big screens.** `NpkCalculatorScreen.js` is 760 lines,
      `PlantGrid.js` 492, `CalendarScreen.js` 438. Extract hooks
      (`useNpkMix`, `usePlantDrag`) and subcomponents.
- [x] **`.env.example` committed**, and **fail fast on missing env** —
      `lib/supabase.js` now names the missing variable and says to restart the
      dev server, instead of dying inside `createClient`.
- [x] **`.git-blame-ignore-revs`** naming the Prettier reformat commit, so
      `git blame` steps over it.

---

## Tier 3 — Product polish

- [ ] **Accessibility.** Two files in the whole repo mention
      `accessibilityLabel`. Every icon-only button (`Appbar.Action`, FABs, the
      grid cells) needs a label and a role; the drag-to-rearrange grid needs a
      non-drag alternative; check contrast on all six schemes in both modes;
      test with TalkBack; respect font scaling (fixed-height rows will break).
- [ ] **Undo instead of confirm** where it's safe. Deleting a plant currently
      needs a dialog; a Snackbar with UNDO is faster and less annoying. There
      isn't a single `Snackbar` in the app yet — no toast layer exists at all.
- [ ] **Pull-to-refresh** on every list and the dashboard.
- [ ] **Haptics** on drop, on tick-off, on destructive confirm
      (`expo-haptics`).
- [ ] **Empty states with a way out.** Growspaces has a good one; check every
      other list has the same (inventory tabs, calendar day view, holding tray,
      dashboard sections).
- [ ] **First-run onboarding.** A new account lands on an empty dashboard with
      no idea that the order of work is: seed pack → sowing → germination →
      transplant → growspace. Three or four screens, or a dismissible checklist
      card on the dashboard.
- [ ] **Keyboard handling.** Long forms in dialogs need
      `KeyboardAvoidingView` / `keyboardShouldPersistTaps`, and a "next" flow
      between fields.
- [ ] **Deep-link notification taps.** Deliberately skipped before; for 1.0 a
      tapped watering reminder should open that plant, and a scheduled-action
      reminder its calendar entry.
- [ ] **"Do it now" should work for every action type.** `transplant`, `thin`
      and `water` currently just mark done because the plan doesn't say which
      sowing or plant — but it does now that scheduled actions carry targets
      (migration 0012). Wire them to the real forms.
- [ ] **Growspace light assignment.** `growspace_lights` is still written only
      from the growspace form; verify it round-trips and that a light group's
      "in use" count sums both sides.
- [ ] **Delete and reorder germination stations and growspaces.** Neither can
      be deleted today; tabs are ordered by `created_at` with no way to change
      it.
- [ ] **Plants tab** — every plant across every growspace in one searchable,
      filterable, sortable list. Already the sole item in the README roadmap.
- [ ] **Search.** Nothing in the app is searchable. Inventory especially, once
      someone has 40 seed packs.
- [ ] **Tablet and landscape.** `app.json` claims `supportsTablet: true` and
      the app is locked to portrait with phone-width layouts.
- [ ] **Animations.** `react-native-reanimated` layout animations on list
      insert/remove, and a real drag animation on the plant grid.
- [ ] **Performance pass.** `FlatList` with `keyExtractor` and
      `getItemLayout` where lists are long, `React.memo` on grid cells, and a
      look at whether the dashboard's several queries can be one RPC.

---

## Tier 4 — Release and presentation

### Ship

- [ ] **Version and build-number strategy** — `app.json` and `package.json` are
      both `1.0.0` with no `versionCode`. Bump script, tags, `CHANGELOG.md`
      (Keep a Changelog format).
- [ ] **CI release build.** Local Gradle is the deliberate choice over EAS, and
      a GitHub Actions job can do exactly that — `expo prebuild` followed by
      `gradlew assembleRelease` — signing from repo secrets, attaching the APK to a
      GitHub Release on tag. Keeps the no-Expo-account stance and adds a
      reproducible build.
- [ ] **The two `gradle.properties` settings that don't survive prebuild**
      (`reactNativeArchitectures=arm64-v8a`, the `PLANNTER_*` signing config)
      should be an `expo prebuild` config plugin instead of a manual step —
      right now a `--clean` silently produces a 95 MB debug-signed APK.
- [ ] **Play Store readiness** if it's going out: privacy policy URL, data
      safety form, target API level, feature graphic, screenshots, store copy.
- [ ] **Account deletion and data export.** Required by both stores, and a
      strong signal on its own. "Delete my account" → RPC that cascades every
      table and empties the user's storage folder. Export as JSON.
- [ ] **Crash and error reporting** — Sentry, with releases and source maps
      wired to CI. Optional given the app's privacy stance; if it's declined,
      say so in the README, because the absence otherwise reads as an oversight.

### Present

- [ ] **Screenshots in the README.** There isn't one image in it. A reviewer
      decides in fifteen seconds. Six device frames across the top: dashboard,
      growspace grid, sowing tray, calendar, NPK calculator, colour schemes.
- [ ] **A demo GIF or 60-second video** of the drag-to-rearrange and the sow →
      germinate → transplant flow. This is the part that's hard to describe and
      obvious to watch.
- [ ] **`docs/ARCHITECTURE.md`** — data model diagram (20 tables is worth a
      picture), the layering, why Supabase, why the local Gradle build, how
      "from records" calendar derivation works, why `TextField` wraps Paper's
      input. The last one especially: it documents a real bug found and fixed,
      which is exactly the kind of thing an interviewer will ask about.
- [ ] **ADRs** (`docs/adr/`) for the decisions already made deliberately:
      Supabase over a custom backend, local Gradle over EAS, generated MD3
      palettes over hand-tinted themes, five tabs with Settings demoted,
      snapshotting tray dimensions onto sowings.
- [ ] **Trim the README's Features list.** It's 105 lines of prose and reads as
      a changelog. Lead with what the app is, a screenshot row, then features
      grouped under headings.
- [ ] **`CONTRIBUTING.md`** and issue/PR templates.
- [ ] **`supabase/README.md`** explaining migration order and how to run them,
      and adopt the Supabase CLI so migrations aren't copy-paste into the SQL
      editor.

---

## Tier 5 — Stretch

- [ ] **i18n** — `i18next`, English extracted first. Also unlocks proper
      number/date formatting per locale.
- [ ] **Widgets / quick actions** — "what's due today" on the home screen.
- [ ] **Photo timeline per plant** — one photo per week, swipe through growth.
      The data model already dates everything.
- [ ] **Harvest tracking and yield per growspace.** The growth-phase guidelines
      already end at a harvest window for leaf and root crops; nothing records
      what actually came out.
- [ ] **Charts** — temperature/humidity history, yield per space, nutrient ppm
      over time.
- [ ] **CSV export** of the activity log.
- [ ] **E2E tests** with Maestro (far lighter than Detox for an Expo app) on
      the three critical flows, running in CI on an emulator.

---

## What phase 0 turned up

Adding the guardrails was meant to be plumbing. It found four real defects on
the way through, which is the argument for having them:

- **Foreground notifications used a deprecated handler shape.**
  `lib/notifications.js` set only `shouldShowAlert`, which expo-notifications
  deprecated; `shouldShowBanner` and `shouldShowList` are both required as of
  SDK 54. Now set.
- **`recordEvent({ userId })` had no default** while every one of its siblings
  did, so seven callers were passing an object the signature said was
  incomplete. It falls back to the signed-in user, and now says so.
- **`formatDose` read an option its own signature didn't declare** (`form`,
  which picks the liquid or dry unit). Documented, and now checked.
- **Embedded Supabase rows were read as objects.** PostgREST returns a to-one
  embed as an object and a to-many as an array, decided by the foreign key
  rather than the query; four sites in `lib/activity.js` assumed the first.
  Both shapes are handled by one helper now.

Two smaller things worth knowing:

- Route names are checked now. `navigation/types.js` names every route and its
  params, so `navigate('PlantDetial')` fails the typecheck.
- `ScreenTitle`'s `icon` prop is typed against the icon font's own glyph map, so
  a misspelt icon name is caught rather than rendering as a blank square.
