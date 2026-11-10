<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

# Arc-style Sidebar Sync — Design

**Date:** 2026-11-10  
**Status:** Approved  
**Branch:** `cursor/arc-sidebar-sync-af9f`  
**Approach:** A — Arc-parity on Zen’s existing Spaces sync engine

## Problem

Arc’s strongest cross-desktop habit was: with Sync on, your **entire sidebar structure** — Spaces, folders, and pinned tabs — appeared automatically and stayed identical on every logged-in device.

Zen already has a Spaces sync engine that targets this, but release defaults, discoverability, and fidelity/trust still fall short of that Arc “it just shows up” experience.

## Goal (Phase 1)

When the user is signed into a Mozilla account and sidebar sync is enabled:

- Spaces, folders, Essentials/pinned tabs, and structural split groups sync across desktops automatically.
- A second device materializes the same sidebar structure without manual recreate.
- Unpinned / open (“Today”) tabs remain **opt-in**, not default.

### Platform requirement: Windows

Phase 1 **must work on Windows** as a first-class desktop target — not macOS-only and not “best effort.”

- Windows ↔ Windows: same Mozilla account → identical sidebar structure.
- Cross-OS is in scope for the sync protocol (Windows ↔ macOS/Linux) because records are Firefox Sync JSON, not OS-specific; Windows is the required validation surface for this project.
- No Windows-only code paths in `src/zen/sync/` today (engine is JS + Firefox Sync); work is defaults/UX/fidelity, verified on Windows builds and device_sync tests in CI where Windows runs.

## Non-goals (Phase 1)

- Defaulting open-tab sync on (Approach B — later backlog)
- Syncing Boosts, Mods, or Space Routing (phased later)
- Mobile Space viewer / companion
- Replacing Firefox Sync with a custom backend

## Current architecture (reuse)

Do **not** invent a new sync stack. Extend and productize:

| Piece | Role |
|---|---|
| `src/zen/sync/ZenSpacesSyncModel.sys.mjs` | Projects local sidebar → sync records |
| `src/zen/sync/ZenSpacesSyncEngine` (`ZenSpacesSync.sys.mjs`) | Firefox Sync engine for Spaces |
| `src/zen/sync/ZenSpacesSyncApplier.sys.mjs` | Applies cloud records into the local window/sidebar |
| Pref `services.sync.engine.spaces` | Master engine enable |
| Pref `zen.spaces-sync.normal-tabs` | Opt-in unpinned tab sync (default `false`) |

Record kinds already modeled: `container`, `space`, `tab`, `folder`, `split`, `layout`.

Settings copy already describes the Arc promise (`zen-settings-workspaces-sync`):

> Sync your sidebar across devices — Keep your workspaces, pinned tabs and folders in sync on all your devices through your Mozilla account.

## What syncs

### Default (Phase 1 / Arc sidebar parity)

| Entity | Sync |
|---|---|
| Spaces (name, icon/theme, order) | Yes |
| Folders (structure, nesting, order) | Yes |
| Essentials / pinned tabs (canonical pin URL, title, icon, identity) | Yes |
| Split-view groups that are part of sidebar structure | Yes |
| Containers mapped into Spaces | Yes (existing builtin/opaque ID mapping) |
| Unpinned / open tabs | **No by default** (existing “Include unpinned tabs” toggle) |

### Fidelity rules

- Canonical pin payload is the **original pinned URL**, not the live navigated URL.
- Space / folder / pin ordering must round-trip across devices.
- Deletes propagate via tombstones.
- First enable merges local + cloud Spaces (existing behavior); surface the outcome clearly so users aren’t surprised.
- Conflict handling stays on Firefox Sync / engine reconciliation — no “this device owns the sidebar” fork unless a wipe is explicit.

## Product / default changes

1. **Release-enable the Spaces sync engine**  
   Today `services.sync.engine.spaces` is gated with `@IS_TWILIGHT@` in `prefs/zen/sync.yaml`. Phase 1 turns this on for release builds so Arc-style sidebar sync is available outside Twilight.

2. **Signed-in default**  
   When the user signs into (or is already signed into) a Mozilla account, sidebar sync should be on unless they turned it off.

3. **Settings UX**  
   Keep Sync settings wording Arc-clear:
   - Primary: “Sync your sidebar across devices”
   - Secondary opt-in: “Include unpinned tabs”
   Ensure the control is findable from Sync / Spaces settings, not buried as an experiment.

4. **First-sync feedback**  
   On first successful enable/merge, show a short confirmation (toast / notice) that the sidebar is now shared across devices. Reuse or extend `zen.spaces-sync.first-sync-animation-shown` if appropriate.

## Error handling & safety

- If no suitable window exists to apply into, fail the batch for retry (existing applier behavior) rather than dropping records.
- Prefer not navigating existing local pins solely because of a remote update when that would clobber in-progress browsing (preserve hardened pin semantics).
- Preserve local-only unpinned tabs when remote structure changes, unless the user opted into unpinned sync.
- Debug logging remains behind `zen.spaces-sync.debug`.

## Testing

Extend `src/zen/tests/device_sync/`:

- Release/default: Spaces engine enabled when expected for signed-in profiles.
- First merge: local + cloud Spaces combine without silent loss.
- Pin reorder / rename round-trips.
- Folder create/move/delete propagates.
- Space delete tombstones correctly.
- With `zen.spaces-sync.normal-tabs=false`, unpinned tabs do not overwrite the peer device.
- With the opt-in on, unpinned tabs apply (existing coverage in `browser_normal_tabs_apply.js`).

## Phased roadmap (tracked for later)

### Phase 1 — this design
Arc-style **sidebar structure** sync: Spaces + folders + pins/Essentials (+ structural splits). Open tabs stay opt-in.

### Phase 2 — Space Routing sync
Sync Air-Traffic-Control–style rules from `src/zen/space-routing` so URL→Space routes are identical on every device. Depends on stable Phase 1 Space identity.

### Later backlog

| Item | Notes |
|---|---|
| Boosts sync | Separate store; previously called out as follow-up |
| Mods sync | UI chrome packs; trust/size concerns |
| Approach B: open tabs on by default | Product risk; keep opt-in until Phase 1 is trusted |
| Mobile Space viewer | Different client surface |

## Success criteria

- Sign in on device 2 → Spaces / folders / pins appear without manual setup.
- Reorder / rename / pin on device 1 → same structure on device 2 after sync.
- First enable merges without silent data loss and communicates that sync is active.
- Settings and defaults read as Arc-style sidebar sync, not a Twilight-only experiment.
- Unpinned tabs do **not** flood peer devices unless explicitly enabled.
- **Verified on Windows** (local or CI): signed-in sidebar sync enable, first merge, and pin/folder/space round-trip.

## Open implementation notes

- Confirm all call sites that assume Twilight-only Spaces sync still behave with release-default-on.
- Verify Sync prefs UI wiring for `services.sync.engine.spaces` in release preference panes.
- Prefer small, reviewable PRs: (1) defaults/prefs, (2) UX/first-sync feedback, (3) fidelity fixes + tests as needed.
