/**
 * FrontFilter background event handler.
 * Keeps MV3 declarative navigation rules synchronized with stored settings.
 */

// These settings belonged to features removed in previous releases. Removing
// them on update prevents stale data from surviving indefinitely.
const OBSOLETE_STORAGE_KEYS = ["blockNsfw", "blockAll", "blockNew", "blockTop"];
let ruleSyncQueue = Promise.resolve();

function replaceNavigationRules() {
  return Promise.all([
    chrome.storage.local.get(FrontFilter.NAVIGATION_STORAGE_KEYS),
    chrome.declarativeNetRequest.getDynamicRules(),
  ]).then(([storedSettings, currentRules]) => {
    const removeRuleIds = currentRules
      .filter(({ id }) => FrontFilter.isNavigationRuleId(id))
      .map(({ id }) => id);
    const addRules = FrontFilter.createNavigationRules(
      storedSettings,
      chrome.runtime.getURL("blocked/index.html"),
    );

    return chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  });
}

function syncNavigationRules() {
  ruleSyncQueue = ruleSyncQueue
    .catch(() => undefined)
    .then(replaceNavigationRules);
  return ruleSyncQueue;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local
    .remove(OBSOLETE_STORAGE_KEYS)
    .then(syncNavigationRules)
    .catch((error) => console.error("Could not migrate FrontFilter settings:", error));
});

chrome.runtime.onStartup.addListener(() => {
  void syncNavigationRules().catch((error) => {
    console.error("Could not initialize FrontFilter navigation rules:", error);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!Object.keys(changes).some((key) => FrontFilter.NAVIGATION_STORAGE_KEYS.includes(key))) {
    return;
  }

  void syncNavigationRules().catch((error) => {
    console.error("Could not update FrontFilter navigation rules:", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "openSettings") {
    chrome.tabs
      .create({ url: chrome.runtime.getURL("popup/index.html?standalone=true") })
      .then(
        () => sendResponse({ success: true }),
        (error) => sendResponse({ success: false, error: error.message }),
      );
    return true;
  }

  if (message?.action === "syncNavigationRules") {
    syncNavigationRules().then(
      () => sendResponse({ success: true }),
      (error) => sendResponse({ success: false, error: error.message }),
    );
    return true;
  }

  return false;
});

void syncNavigationRules().catch((error) => {
  console.error("Could not initialize FrontFilter navigation rules:", error);
});
