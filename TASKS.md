# Tasks

Road to a production-ready 1.0. Grouped by tier, not by area — tier 1 is what
makes the app trustworthy, tier 2 is what makes the repo credible, tier 3 is
what makes it feel finished, tier 4 is what ships and presents it.

Done items have been removed. What's below is open.

**Where it stands (updated 2026-08-07, phase 3 under way):** 575 tests across 30
suites, all passing. `jest` now runs two projects: `lib` (node preset, the 527
pure-logic tests) and `app` (jest-expo/android), which renders. The coverage
floor CI enforces is 57% of `lib/` (65% of its functions); `components/` and
`hooks/` are collected but have no floor yet. ESLint, Prettier, `tsc --noEmit`
over JSDoc and a GitHub Actions run of all four are in place and green.

The data layer is done: no screen imports `supabase`, no screen refetches on
focus. Reads go through `hooks/`, writes through mutations that invalidate by
naming what they did. RLS policies and indexes are in place on every table, and
still untested.

Validation is done too. Every form in the app — all sixteen dialogs, the two
plant forms, login and signup — runs on a schema in `lib/schemas.js` through
`hooks/useForm.js`, and reports per field rather than one line at a time into
the foot of a scrolling dialog. Migration `0013_value_limits.sql` puts the same
limits in Postgres, so they hold for anything that writes without going through
the app.

**Phase order:** 0 guardrails (done) → 1 data layer (done) → 2 validation (done)
→ 3 test depth → 4 polish. **Tier 4 is deliberately parked** until the feature
set settles: more features are coming, and screenshots, store copy and an
architecture doc written now would only be rewritten. The point of phases 1–4 is
that whatever gets built next lands on a foundation that already handles its
errors, validates its inputs and is testable.

### Pick up here

Phase 3 is half done and **uncommitted** — the working tree holds the whole test
harness plus 48 new tests. `npm run verify` is green.

The next three flows are the ones _Component and integration tests_ names and
this session ran out before reaching: **logging a feeding**
(`screens/calendar/FeedingDialog.js`), **transplanting a cell**
(`screens/germination/TransplantDialog.js`) and **ticking a scheduled action off
the dashboard**. All three are the same shape as
`screens/germination/__tests__/SowingFormDialog.test.js`, which is the one to
copy: seed the fake, drive the dialog, assert on the rows that ended up in the
tables. After those, set coverage floors for `components/` and `hooks/` —
they're collected in `jest.config.js` but only `./lib/` has a threshold.

Still open from phase 2, both written up in _Validation & input safety_ below:

1. **Run `supabase/migrations/0013_value_limits.sql`** in the SQL editor. It has
   never been executed — it is one transaction, so a row outside a limit rolls
   the whole thing back and names the constraint that objected.
2. **The NPK calculator's own fields** are still unvalidated by design; the mix
   it hands to `FeedingDialog` is what gets checked.

---

## Carried over

- [ ] **Move "Save as a feeding" to the top of the NPK calculator.** It sits
      below the micronutrient card at the end of a long scroll
      (`screens/calculator/NpkCalculatorScreen.js:428`) — the one action the
      screen exists to produce is the hardest thing on it to reach. Header
      action or FAB.
- [ ] **Free-text note on the dashboard.** Just jot something down — "the
      chillies look leggy" — dated, editable, deletable. Needs a `notes` table + migration, a card on the dashboard, and a spot in the calendar day view.
- [x] **Input safety** — done; see _Validation & input safety_ below.
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
- [x] **The triad on every screen.** `components/QueryBoundary.js` gives
      loading / error + retry / empty in one place. No screen imports `supabase`
      any more, and no screen uses `useFocusEffect` to refetch — every read goes
      through a hook, every write through a mutation that invalidates what it
      touched.
- [ ] **Offline banner.** NetInfo is installed and queries already pause when
      the connection goes, but nothing tells the user that is why.
- [ ] **Session expiry is unhandled.** If the refresh token dies the next query
      just fails. `isAuthExpired` recognises it; nothing acts on it yet. Listen
      for `onAuthStateChange` → `SIGNED_OUT` and route back to login with an
      explanation.
- [ ] **Optimistic updates for the remaining cheap actions** — ticking a job off
      the dashboard, watering a plant, marking a cell germinated. Dragging a
      plant on the grid is already optimistic, since it had to be; the rest
      still round-trip before the UI moves.

### Data integrity

- [ ] **The multi-table writes still aren't atomic.** `createSowing` (sowing →
      cells → seed count), `saveGrowspace` (growspace → grids → lights) and
      `saveStation` (station → lights). PostgREST has no transactions, so each
      hand-rolls the failure path, and `createSowing`'s seed-count subtraction
      is still not rolled back at all. Phase 1 made the partial outcome
      survivable rather than correct: the two form saves fail to the harmless
      half and carry the created row back on the error, so pressing save again
      finishes the job instead of creating a second growspace or station under
      the same name. That is a substitute for a transaction and it is not one.
      Move each into a Postgres RPC function and let the database do it.
      **Wants xhigh.**
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

- [x] **Centralised validation.** `lib/validation.js` holds the rules
      (`text`, `decimal`, `whole`, `choice`, `list`, `email`, `secret`,
      `passthrough`) and a `validate` that reports every bad field at once;
      `lib/schemas.js` holds one schema per entity and the cross-field checks a
      single field can't make — a germination window that runs backwards, a dose
      range printed low-to-high, more containers than seedlings to put in them.
      Hand-rolled rather than Zod: the string→`number|null` conversion with
      comma handling and unit conversion is custom either way, and this keeps
      the runtime dependency count where it was. 101 tests across the two.
- [x] **Errors belong on the field.** `components/FormField.js` pairs an input
      with its own message and outlines it in the error colour. A field is
      checked when it's left; pressing save checks everything and shows all of
      it; a field already showing an error re-checks as it's typed into, so the
      button comes back the moment the last one is fixed.
- [x] **Range and sanity limits everywhere numbers are entered.** Grid sides cap
      at 50 and area at 500 cells — the 999×999 that locked the app is refused
      by both the field and a check on the product. Seed counts are held against
      the pack they come out of, and the rest (wattage, PPFD, efficacy, colour
      temperature, beam angle, doses, watering interval, quantities,
      temperature, humidity, sun hours) carry ranges in `RANGES`, each with a
      note on why it sits where it does. Ranges are expressed in the unit the
      field is labelled with, so an imperial user is told -4 to 140°F rather
      than -20 to 60.
- [x] **Length caps and trimming on every text field**, and enforced in the DB
      by `0013_value_limits.sql` — 61 constraints over 17 tables, the same
      numbers as the app.
- [x] **Locale-safe number parsing.** `lib/numbers.js` — `parseDecimal` and
      `parseWhole`, which keep blank (`null`) and unparseable (`NaN`) apart
      rather than collapsing both to nothing, take either decimal separator, and
      refuse what `Number()` quietly accepts (`0x10`, `1e3`, `Infinity`). Every
      inline `Number(x.replace(',', '.'))` in the app now goes through it.
- [x] **Submit gating.** The button stays live until save is first pressed —
      a dead button on an untouched form explains nothing — and from then on
      disables while anything is still wrong, by which point every reason is on
      screen.
- [x] **Double submission guarded** on every dialog, including the destructive
      ones. `ThinDialog` and `MoveSowingDialog` turned out to hold validation
      state that could never be reached; both were already gated on `isPending`
      and the dead state is gone.

Left open from this phase:

- [ ] **`0013_value_limits.sql` has not been run.** It is checked for balanced
      syntax and duplicate constraint names, not executed — there's no local
      Postgres here. It runs as one transaction, so a row that falls outside a
      limit rolls the whole thing back and names the constraint.
- [ ] **The NPK calculator's own fields are still unvalidated.** It recomputes on
      every keystroke and has to have an answer for a half-typed field, so it
      reads through `parseDecimal` and treats rubbish as zero rather than
      refusing. Fine for the working figures; the point to check is the mix it
      hands to `FeedingDialog`, which does validate.

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
- [x] **Coverage floor**, enforced by `coverageThreshold` and ratcheted as tests
      land. Now 57% of `lib/` statements and lines, 60% of branches, 65% of
      functions.
- [ ] **Coverage badge.** Needs a Codecov or Coveralls upload step; the run
      already produces `lcov`.
- [ ] **Component and integration tests.** Started, not finished.
      `@testing-library/react-native` is in, `jest.config.js` runs a second
      project under the RN preset, and `test/` holds the harness: a hand-rolled
      Supabase fake at the client boundary (`test/fakeSupabase.js`, installed
      through `lib/__mocks__/supabase.js`), and `test/render.js` with the
      providers `App.js` uses. Covered so far: `FormField`, `TextField`,
      `useForm`, `QueryBoundary`, `ErrorBoundary`, and end to end —
      `TrayFormDialog`, login, signup and sowing a tray. **Left: log a feeding,
      transplant a cell, tick off a scheduled action, create a growspace.**
      Then a floor for `components/` and `hooks/`.
- [ ] **A pre-commit hook** (husky + lint-staged) so the above can't rot.
- [ ] **Dependabot or Renovate** — a config file is five lines and shows you
      think about supply chain.
- [x] **A data layer boundary**, done in phase 1: no screen imports `supabase`.
      Phase 2 added `lib/enums.js` underneath it, because the fixed lists of
      values lived beside the queries for the tables they describe — so a module
      of pure validation data couldn't read what a valid light type was without
      loading the client, expo-device and the notification scheduler behind it.
      The lists moved; their old homes re-export them, so nothing else changed.
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

## What phase 3 has turned up so far

Three defects, all found by the first tests that rendered anything:

- **The two auth screens showed the database's own words.** `LoginScreen` and
  `SignupScreen` put `failure.message` straight on screen — so a rejected login
  read "Invalid login credentials" and a duplicate signup "User already
  registered", on the two screens where a bad message costs the most. Both go
  through `messageFor` now, which had the sentences all along.
- **Text inputs had no accessibility label.** Paper draws a field's label as a
  separate animated `Text` rather than naming the input, so TalkBack announced an
  unnamed text field and whatever was typed in it. `TextField` now passes the
  label through as `accessibilityLabel`, which is also how the tests find fields.
- **Two components declared required props they treat as optional** — `tray` on
  `TrayFormDialog` and `onChangeText` on `TextField`. Caught by `tsc` once a test
  rendered them the way the app does.

Two things about the harness worth knowing before adding to it:

- **Paper's animations outlive a test.** A `Menu` that mounts closed starts a
  hide animation whose callback un-renders it; in a test that callback lands
  after the press that opened it, and if the test ends first it lands in the
  _next_ test and closes that one's menu instead. `test/render.js` answers with
  an animation scale of zero and a one-frame `settle()` after render, and
  `pressWhenReady` steps the renderer while waiting. Without them the suite fails
  in alternating tests, which reads like a race in the app and isn't.
- **The fake doesn't resolve embeds.** `select('*, light:grow_lights(*)')`
  returns the seeded row as it stands, so a fixture is written with the embed
  already on it. Teaching it to join would mean teaching it twenty foreign keys,
  and the tests would then be testing the fake.

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
