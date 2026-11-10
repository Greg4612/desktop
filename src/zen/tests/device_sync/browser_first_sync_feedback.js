/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const FIRST_SYNC_ANIMATION_PREF = "zen.spaces-sync.first-sync-animation-shown";

add_task(async function test_first_sync_shows_toast_once() {
  Services.prefs.setBoolPref(FIRST_SYNC_ANIMATION_PREF, false);

  const toastCalls = [];
  const originalShowToast = gZenUIManager.showToast.bind(gZenUIManager);
  gZenUIManager.showToast = (id, options) => {
    toastCalls.push({ id, options });
  };

  const originalSweep = gZenStartup.playWindowSweepAnimation.bind(gZenStartup);
  let sweepCount = 0;
  gZenStartup.playWindowSweepAnimation = () => {
    sweepCount += 1;
  };

  try {
    const id = "test-spaces-sync-first-feedback";
    let failed = await ZenSpacesSyncApplier.applyBatch([
      tabRecord(id, { pinned: true, url: "https://example.com/first-sync" }),
    ]);
    Assert.deepEqual(failed, [], "first apply should succeed");
    Assert.equal(sweepCount, 1, "first sync plays the window sweep once");
    Assert.ok(
      toastCalls.some(c => c.id === "zen-spaces-sync-enabled-toast"),
      "first sync shows the sidebar sync toast"
    );
    Assert.equal(
      Services.prefs.getBoolPref(FIRST_SYNC_ANIMATION_PREF, false),
      true,
      "first-sync pref is set after feedback"
    );

    const toastCountAfterFirst = toastCalls.length;
    failed = await ZenSpacesSyncApplier.applyBatch([
      tabRecord(id, {
        pinned: true,
        url: "https://example.com/first-sync",
        title: "Updated",
      }),
    ]);
    Assert.deepEqual(failed, [], "second apply should succeed");
    Assert.equal(sweepCount, 1, "sweep does not replay on later syncs");
    Assert.equal(
      toastCalls.length,
      toastCountAfterFirst,
      "toast does not replay on later syncs"
    );

    ZenSpacesSyncModel.noteApplied(id, null);
    const tab = gBrowser.tabs.find(t => t.id === id);
    if (tab && !tab.closing) {
      BrowserTestUtils.removeTab(tab);
    }
  } finally {
    gZenUIManager.showToast = originalShowToast;
    gZenStartup.playWindowSweepAnimation = originalSweep;
    Services.prefs.setBoolPref(FIRST_SYNC_ANIMATION_PREF, true);
  }
});
