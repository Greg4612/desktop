/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

add_task(async function test_normal_tabs_pref_default_off() {
  Assert.equal(
    Services.prefs.getBoolPref("zen.spaces-sync.normal-tabs", true),
    false,
    "unpinned tab sync stays opt-in by default"
  );
});

add_task(async function test_spaces_engine_pref_default_on() {
  Assert.equal(
    Services.prefs.getBoolPref("services.sync.engine.spaces", false),
    true,
    "Spaces sidebar sync engine is enabled by default"
  );
});

add_task(async function test_pinned_tab_still_applies() {
  const id = "test-spaces-sync-pinned-default";
  const failed = await ZenSpacesSyncApplier.applyBatch([
    tabRecord(id, { pinned: true, url: "https://example.com/pinned" }),
  ]);
  Assert.deepEqual(failed, [], "pinned tab apply should succeed");

  const tab = gBrowser.tabs.find(t => t.id === id);
  Assert.ok(tab, "pinned synced tab should exist");
  Assert.ok(tab.pinned, "synced tab should be pinned");

  ZenSpacesSyncModel.noteApplied(id, null);
  if (tab && !tab.closing) {
    BrowserTestUtils.removeTab(tab);
  }
});
