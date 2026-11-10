# Arc-style Sidebar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Zen’s existing Spaces sync engine behave like Arc Sync for sidebar structure (Spaces, folders, pinned/Essentials) by default on all desktop builds, including Windows, with clear Sync settings and first-sync feedback; keep unpinned tabs opt-in.

**Architecture:** Reuse `ZenSpacesSyncModel` / `ZenSpacesSyncEngine` / `ZenSpacesSyncApplier` and Firefox Sync. Phase 1 is defaults + UX + tests — not a new sync protocol. Space Routing sync is Phase 2 (tracked in the design doc, out of this plan).

**Tech Stack:** Zen desktop prefs (`prefs/zen/sync.yaml` via ffprefs), Firefox Sync engines, Preferences Sync pane patches, Fluent (`zen-preferences.ftl`), mochitests under `src/zen/tests/device_sync/`.

**Spec:** `docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md`

## Global Constraints

- Phase 1 syncs Spaces + folders + pinned/Essentials (+ structural splits); unpinned tabs stay opt-in (`zen.spaces-sync.normal-tabs` default `false`).
- Windows is a first-class validation target (protocol is cross-OS; no Windows-only sync code expected).
- Do not sync Boosts, Mods, or Space Routing in this plan.
- Prefer small commits; do not invent a custom sync backend.

## File map

| File | Responsibility |
|---|---|
| `prefs/zen/sync.yaml` | Default `services.sync.engine.spaces` on for all brands (not Twilight-only) |
| `locales/en-US/browser/browser/preferences/zen-preferences.ftl` | Sync settings copy (verify Arc-clear wording) |
| `src/browser/components/preferences/config/account-sync-mjs.patch` | Sync pane toggle already present — verify only |
| `src/zen/sync/ZenSpacesSyncApplier.sys.mjs` | First-sync feedback (existing sweep; optional toast string) |
| `src/zen/tests/device_sync/*` | Regression + default-engine / structure-sync coverage |
| `docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md` | Approved design (Phase 2 backlog recorded) |

---

### Task 1: Enable Spaces sync engine by default (all builds)

**Files:**
- Modify: `prefs/zen/sync.yaml`
- Modify: `docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md` (status → Approved)

**Interfaces:**
- Consumes: ffprefs `@cond` / `@IS_TWILIGHT@` semantics in `tools/ffprefs/src/main.rs`
- Produces: `services.sync.engine.spaces` default `true` in release and Twilight (including Windows)

- [x] **Step 1: Update the design status to Approved**

In `docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md`, set `**Status:** Approved`.

- [x] **Step 2: Change the Spaces engine default pref**

Replace the Twilight-gated block in `prefs/zen/sync.yaml`:

```yaml
- name: services.sync.engine.spaces
  value: true
```

Remove:

```yaml
  value: "@cond"
  condition: "@IS_TWILIGHT@"
```

Leave `zen.spaces-sync.normal-tabs` default `false` unchanged.

- [ ] **Step 3: Sanity-check generated prefs (if engine/`ffprefs` available)**

If `tools/ffprefs` can run:

```bash
cd tools/ffprefs && cargo run --bin ffprefs -- ../../
```

Confirm generated prefs contain `pref("services.sync.engine.spaces", true);` without an `#ifdef` Twilight-only false branch for that name.

If ffprefs cannot run in this environment, skip and rely on the YAML change + later browser test.

- [x] **Step 4: Commit**

```bash
git add prefs/zen/sync.yaml docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md docs/superpowers/plans/2026-11-10-arc-sidebar-sync.md
git commit -m "feat(sync): enable Spaces sidebar sync by default on all builds"
```

---

### Task 2: Confirm Sync settings UX wiring (no duplicate controls)

**Files:**
- Read/verify: `src/browser/components/preferences/config/account-sync-mjs.patch`
- Read/verify: `locales/en-US/browser/browser/preferences/zen-preferences.ftl`
- Modify only if copy is unclear: `locales/en-US/browser/browser/preferences/zen-preferences.ftl`

**Interfaces:**
- Consumes: `zenSyncWorkspaces` → `services.sync.engine.spaces`; `zenSyncNormalTabs` → `zen.spaces-sync.normal-tabs` (visible when workspaces sync on)
- Produces: Unchanged Sync pane behavior with Arc-clear labels

- [ ] **Step 1: Verify Sync pane already exposes sidebar sync**

Confirm `account-sync-mjs.patch` registers:

- `zen-settings-workspaces-sync` toggle → `services.sync.engine.spaces`
- nested `zen-settings-normal-tabs-sync` → `zen.spaces-sync.normal-tabs`

Confirm en-US strings:

```
zen-settings-workspaces-sync =
    .label = Sync your sidebar across devices
    .description = Keep your workspaces, pinned tabs and folders in sync...
zen-settings-normal-tabs-sync =
    .label = Include unpinned tabs
```

- [ ] **Step 2: Only edit copy if needed**

If description does not mention folders/pinned clearly, tighten `.description` only in `locales/en-US/.../zen-preferences.ftl`. Do **not** change other locales in this task (Crowdin owns them).

- [ ] **Step 3: Commit only if strings changed; otherwise note “no code change” in the session log**

```bash
git add locales/en-US/browser/browser/preferences/zen-preferences.ftl
git commit -m "chore(sync): clarify Arc-style sidebar sync settings copy"
```

---

### Task 3: First-sync feedback toast (Windows-safe)

**Files:**
- Modify: `src/zen/sync/ZenSpacesSyncApplier.sys.mjs` (`#maybePlayFirstSyncAnimation`)
- Modify: `locales/en-US/browser/browser/zen-general.ftl` (or `zen-workspaces.ftl` if that is where sync toasts live — prefer existing sync toast style)
- Test: extend or add under `src/zen/tests/device_sync/` if a lightweight assertion is feasible; otherwise manual verification notes

**Interfaces:**
- Consumes: `zen.spaces-sync.first-sync-animation-shown`, `win.gZenStartup.playWindowSweepAnimation()`
- Produces: Same one-shot gate, plus a user-visible confirmation that sidebar sync is active

- [ ] **Step 1: Find existing toast / notification helper used by Spaces**

Search for toast patterns near Spaces (e.g. space-routing toast `zen-space-routing-tab-routed-toast`) and reuse that mechanism.

- [ ] **Step 2: Add Fluent string (en-US only)**

Example (adjust id to match chosen ftl file):

```
zen-spaces-sync-enabled-toast = Your sidebar is syncing across devices
```

- [ ] **Step 3: Show toast once alongside the existing sweep animation**

In `#maybePlayFirstSyncAnimation(win)` after setting the pref / playing animation, fire the same style of confirmation toast used elsewhere in Zen. Keep the pref gate so it only runs once per profile.

- [ ] **Step 4: Commit**

```bash
git add src/zen/sync/ZenSpacesSyncApplier.sys.mjs locales/en-US/browser/browser/*.ftl
git commit -m "feat(sync): confirm first Spaces sidebar sync with a toast"
```

---

### Task 4: Device-sync regression coverage for structure-only default

**Files:**
- Modify/Create: `src/zen/tests/device_sync/browser_engine_default.js` (or similarly named)
- Modify: `src/zen/tests/device_sync/browser.toml`
- Modify: `src/zen/tests/device_sync/head.js` only if shared helpers are needed

**Interfaces:**
- Consumes: `Services.prefs`, existing `ZenSpacesSyncModel` / `ZenSpacesSyncApplier` test helpers in `head.js`
- Produces: Automated proof that unpinned sync stays off by default and structure records still apply

- [ ] **Step 1: Add a test that normal-tabs pref defaults off and pinned apply still works**

In a new `browser_engine_default.js` (pattern from `browser_normal_tabs_apply.js`):

```js
add_task(async function test_normal_tabs_pref_default_off() {
  Assert.equal(
    Services.prefs.getBoolPref("zen.spaces-sync.normal-tabs", true),
    false,
    "unpinned tab sync stays opt-in"
  );
});

add_task(async function test_pinned_tab_still_applies() {
  // reuse tabRecord(..., { pinned: true }) helper from head.js
  // applyBatch → assert tab exists / pinned
});
```

- [ ] **Step 2: Register the test in `browser.toml`**

Add the new file to the manifest alongside existing device_sync tests.

- [ ] **Step 3: Run device_sync tests if mach/engine available**

```bash
# from repo with engine present:
cd engine && ./mach test zen/tests/device_sync
```

If engine is not present in this workspace, run whatever subset is available or document deferred CI verification (Windows CI / local Windows build).

- [ ] **Step 4: Commit**

```bash
git add src/zen/tests/device_sync/
git commit -m "test(sync): cover structure-only Spaces sync defaults"
```

---

### Task 5: Spec/plan checklist + push

**Files:**
- Modify: `docs/superpowers/plans/2026-11-10-arc-sidebar-sync.md` (check off completed tasks)
- Modify: `docs/superpowers/specs/2026-11-10-arc-sidebar-sync-design.md` if implementation notes need a short “Done in PR” note

- [ ] **Step 1: Mark completed checkboxes in the plan**
- [ ] **Step 2: Push branch `cursor/arc-sidebar-sync-af9f` and open/update PR against `dev`**
- [ ] **Step 3: In the PR body, call out Phase 2 (Space Routing sync) and later backlog so they stay tracked**

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Release-enable Spaces engine | Task 1 |
| Signed-in / default sidebar sync available | Task 1 (+ existing Sync engine registration) |
| Settings UX Arc-clear | Task 2 |
| First-sync feedback | Task 3 |
| Structure-only; unpinned opt-in | Tasks 1 + 4 |
| Windows as required surface | Global constraint; Task 4/5 CI + PR notes |
| Phase 2 Space Routing tracked, not built | Design doc + Task 5 PR body |
| Boosts/Mods/Approach B out of scope | Non-goals — no tasks |

## Out of scope reminders

- Phase 2: Space Routing sync (`src/zen/space-routing`)
- Later: Boosts sync, Mods sync, open tabs on by default, mobile viewer
