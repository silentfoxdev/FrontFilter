/**
 * FrontFilter - Popup Script
 * Handles settings, import/export, and auto-save.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (
    new URLSearchParams(globalThis.location?.search).get("standalone") ===
    "true"
  ) {
    document.body.classList.add("standalone");
  }

  // Keep panels mounted: switching sections must preserve edits and scroll position.
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  function selectTab(selectedTab) {
    for (const tab of tabs) {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden =
        !selected;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        nextIndex = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  }

  const blockedListEl = document.getElementById("blocked-list");
  const blockedCount = document.getElementById("blocked-count");
  const addBtn = document.getElementById("add-subreddit");
  const addCurrent = document.getElementById("add-current-subreddit");
  const allowedListEl = document.getElementById("allowed-list");
  const allowedCount = document.getElementById("allowed-count");
  const addAllowed = document.getElementById("add-allowed-subreddit");
  const addCurrentAllowed = document.getElementById(
    "add-current-allowed-subreddit",
  );
  const titleKeywordListEl = document.getElementById("title-keyword-list");
  const titleKeywordCount = document.getElementById("title-keyword-count");
  const addTitleKeyword = document.getElementById("add-title-keyword");
  const saveIndicator = document.getElementById("save-indicator");
  const toast = document.getElementById("toast");
  const exportBtn = document.getElementById("export-config");
  const importBtn = document.getElementById("import-config");
  const importFile = document.getElementById("import-file");
  const scrollLimit = document.getElementById("scroll-limit");
  const scrollMode = document.getElementById("scroll-mode");
  const colorTheme = document.getElementById("color-theme");

  const checkboxIds = {
    blockHomepage: "block-homepage",
    blockPopular: "block-popular",
    blockExplore: "block-explore",
    blockNews: "block-news",
    blockSubHome: "block-sub-home",
    hideComments: "hide-comments",
    hideCommentReplies: "hide-comment-replies",
    disableAutoplay: "disable-autoplay",
    hideNavbar: "hide-navbar",
    hideNavbarMenu: "hide-navbar-menu",
    hideNavbarSearch: "hide-navbar-search",
    hideNavbarChat: "hide-navbar-chat",
    hideNavbarNotifications: "hide-navbar-notifications",
    hideNavbarProfile: "hide-navbar-profile",
    hideNavbarOthers: "hide-navbar-others",
    hideLeftSidebar: "hide-left-sidebar",
    hideLeftSidebarGames: "hide-left-sidebar-games",
    hideLeftSidebarCustomFeeds: "hide-left-sidebar-custom-feeds",
    hideLeftSidebarRecent: "hide-left-sidebar-recent",
    hideLeftSidebarCommunities: "hide-left-sidebar-communities",
    hideLeftSidebarResources: "hide-left-sidebar-resources",
    hideRelatedPosts: "hide-right-sidebar",
    limitInfiniteScroll: "limit-infinite-scroll",
  };
  const checkboxes = Object.fromEntries(
    Object.entries(checkboxIds).map(([key, id]) => [
      key,
      document.getElementById(id),
    ]),
  );

  let entries = [];
  let allowedEntries = [];
  let keywordEntries = [];
  let toastTimer = null;
  let indicatorTimer = null;
  let debounceTimer = null;
  let saveQueue = Promise.resolve();
  let latestSaveId = 0;
  let controlsDisabled = false;
  let lastScrollLimit = FrontFilter.DEFAULT_SETTINGS.scrollLimit;
  const navbarSectionKeys = [
    "hideNavbarMenu",
    "hideNavbarSearch",
    "hideNavbarChat",
    "hideNavbarNotifications",
    "hideNavbarProfile",
    "hideNavbarOthers",
  ];
  const leftSidebarSectionKeys = [
    "hideLeftSidebarGames",
    "hideLeftSidebarCustomFeeds",
    "hideLeftSidebarRecent",
    "hideLeftSidebarCommunities",
    "hideLeftSidebarResources",
  ];

  function setControlsDisabled(disabled) {
    controlsDisabled = disabled;
    for (const control of [
      ...Object.values(checkboxes),
      addBtn,
      addCurrent,
      addAllowed,
      addCurrentAllowed,
      addTitleKeyword,
      exportBtn,
      importBtn,
      importFile,
      scrollLimit,
      scrollMode,
      colorTheme,
    ]) {
      control.disabled = disabled;
    }

    blockedListEl
      .querySelectorAll("input, select, button")
      .forEach((control) => {
        control.disabled = disabled;
      });
    allowedListEl
      .querySelectorAll("input, button")
      .forEach((control) => {
        control.disabled = disabled;
      });
    titleKeywordListEl
      .querySelectorAll("input, button")
      .forEach((control) => {
        control.disabled = disabled;
      });
    updateScrollControls();
    updateCommentControls();
    updateNavbarControls();
    updateLeftSidebarControls();
  }

  function updateScrollControls() {
    const disabled =
      controlsDisabled || !checkboxes.limitInfiniteScroll.checked;
    scrollLimit.disabled = disabled;
    scrollMode.disabled = disabled;
  }

  function updateCommentControls() {
    if (checkboxes.hideComments.checked) {
      checkboxes.hideCommentReplies.checked = true;
    }
    checkboxes.hideCommentReplies.disabled = controlsDisabled
      || checkboxes.hideComments.checked;
  }

  function updateNavbarControls() {
    for (const key of navbarSectionKeys) {
      if (checkboxes.hideNavbar.checked) checkboxes[key].checked = true;
      checkboxes[key].disabled = controlsDisabled || checkboxes.hideNavbar.checked;
    }
  }

  function updateLeftSidebarControls() {
    for (const key of leftSidebarSectionKeys) {
      if (checkboxes.hideLeftSidebar.checked) checkboxes[key].checked = true;
      checkboxes[key].disabled = controlsDisabled
        || checkboxes.hideLeftSidebar.checked;
    }
  }

  function showToast(message, type = "info") {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `show ${type}`;
    toastTimer = setTimeout(() => {
      toast.className = "";
    }, 2500);
  }

  function showSaving() {
    clearTimeout(indicatorTimer);
    saveIndicator.textContent = "Saving...";
    saveIndicator.classList.add("visible");
  }

  function showSaved(saveId) {
    if (saveId !== latestSaveId) return;

    clearTimeout(indicatorTimer);
    saveIndicator.textContent = "Saved";
    indicatorTimer = setTimeout(
      () => saveIndicator.classList.remove("visible"),
      1200,
    );
  }

  function showSaveFailed(saveId) {
    if (saveId !== latestSaveId) return;

    clearTimeout(indicatorTimer);
    saveIndicator.textContent = "Save failed";
    saveIndicator.classList.add("visible");
  }

  function getCheckboxSettings() {
    return Object.fromEntries(
      Object.entries(checkboxes).map(([key, checkbox]) => [
        key,
        checkbox.checked,
      ]),
    );
  }

  function getSettingsSnapshot() {
    return {
      ...getCheckboxSettings(),
      blockedSubreddits: FrontFilter.normalizeBlockedSubreddits(entries),
      allowedSubreddits: FrontFilter.normalizeAllowedSubreddits(
        allowedEntries.map((entry) => entry.name),
      ),
      blockedTitleKeywords: FrontFilter.normalizeTitleKeywords(
        keywordEntries.map((entry) => entry.value),
      ),
      scrollLimit: lastScrollLimit,
      scrollMode: scrollMode.value === "button" ? "button" : "fixed",
      theme: FrontFilter.normalizeTheme(colorTheme.value),
    };
  }

  function applyTheme(theme) {
    const normalizedTheme = FrontFilter.normalizeTheme(theme);
    document.documentElement.setAttribute("data-theme", normalizedTheme);
    try {
      globalThis.localStorage?.setItem("frontfilter-theme", normalizedTheme);
    } catch {
      // The theme still works for this page if local storage is unavailable.
    }
    return normalizedTheme;
  }

  function queueSave() {
    const saveId = ++latestSaveId;
    const snapshot = getSettingsSnapshot();
    updateBlockedCount();
    updateAllowedCount();
    updateTitleKeywordCount();
    showSaving();

    enqueueStorageWrite(snapshot);
    saveQueue.then(
      () => showSaved(saveId),
      (error) => {
        showSaveFailed(saveId);
        showToast(`Save failed: ${error.message}`, "error");
      },
    );
    return saveQueue;
  }

  function enqueueStorageWrite(settings) {
    return enqueueStorageOperation(() => chrome.storage.local.set(settings));
  }

  function enqueueStorageOperation(operation) {
    saveQueue = saveQueue.catch(() => undefined).then(operation);
    return saveQueue;
  }

  function scheduleAutoSave(immediate = false) {
    clearTimeout(debounceTimer);
    debounceTimer = null;

    if (immediate) {
      queueSave();
      return;
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      queueSave();
    }, 700);
  }

  async function flushPendingSave() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      queueSave();
    }

    await saveQueue;
  }

  function sortEntries() {
    entries.sort((a, b) => {
      if (!a.name && !b.name) return 0;
      if (!a.name) return -1;
      if (!b.name) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function renderEmptyState() {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.textContent = "-";

    empty.appendChild(icon);
    empty.appendChild(document.createTextNode("No subreddits blocked yet"));
    blockedListEl.appendChild(empty);
  }

  function updateBlockedCount() {
    const count = FrontFilter.normalizeBlockedSubreddits(entries).length;
    blockedCount.textContent = `${count} ${count === 1 ? "rule" : "rules"}`;
  }

  function updateAllowedCount() {
    const count = FrontFilter.normalizeAllowedSubreddits(
      allowedEntries.map((entry) => entry.name),
    ).length;
    allowedCount.textContent = `${count} ${count === 1 ? "exception" : "exceptions"}`;
  }

  function updateTitleKeywordCount() {
    const count = FrontFilter.normalizeTitleKeywords(
      keywordEntries.map((entry) => entry.value),
    ).length;
    titleKeywordCount.textContent = `${count} ${count === 1 ? "keyword" : "keywords"}`;
  }

  function renderList() {
    blockedListEl.innerHTML = "";
    updateBlockedCount();

    if (entries.length === 0) {
      renderEmptyState();
      return;
    }

    sortEntries();
    entries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "blocked-item";

      const input = document.createElement("input");
      input.type = "text";
      input.value = entry.name;
      input.placeholder = "Subreddit, wildcard, or Reddit URL";
      input.setAttribute("aria-label", "Subreddit, wildcard, or Reddit URL");
      input.spellcheck = false;
      input.disabled = controlsDisabled;

      const select = document.createElement("select");
      select.className = "mode-badge";
      select.setAttribute("aria-label", "Block mode");
      select.disabled = controlsDisabled;
      for (const mode of ["home", "all"]) {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode.toUpperCase();
        option.selected = entry.mode === mode;
        select.appendChild(option);
      }

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove subreddit rule");
      removeBtn.textContent = "x";
      removeBtn.disabled = controlsDisabled;

      input.addEventListener("input", (event) => {
        entry.name = event.target.value;
        scheduleAutoSave();
      });
      input.addEventListener("blur", (event) => {
        const normalizedName = FrontFilter.normalizeSubredditName(
          event.target.value,
        );
        entry.name = normalizedName;
        event.target.value = normalizedName;
        scheduleAutoSave(true);
      });
      select.addEventListener("change", (event) => {
        entry.mode = event.target.value === "all" ? "all" : "home";
        scheduleAutoSave(true);
      });
      removeBtn.addEventListener("click", () => {
        const entryIndex = entries.indexOf(entry);
        if (entryIndex < 0) return;
        entries.splice(entryIndex, 1);
        renderList();
        scheduleAutoSave(true);
      });

      item.appendChild(input);
      item.appendChild(select);
      item.appendChild(removeBtn);
      blockedListEl.appendChild(item);
    });
  }

  function focusEntry(name, animate) {
    const normalizedName = FrontFilter.normalizeSubredditName(name);
    const allItems = blockedListEl.querySelectorAll(".blocked-item");
    const target = normalizedName
      ? Array.from(allItems).find(
          (el) => el.querySelector("input").value === normalizedName,
        )
      : allItems[0];

    if (!target) return;
    if (animate) target.classList.add("pop-in");
    target.querySelector("input").focus();
  }

  function addEntry(name = "", mode = "all", animate = true) {
    const normalizedName = FrontFilter.normalizeSubredditName(name);
    entries.unshift({
      name: normalizedName,
      mode: mode === "all" ? "all" : "home",
    });
    renderList();
    focusEntry(normalizedName, animate);

    if (normalizedName) scheduleAutoSave(true);
  }

  function normalizeAllowedName(value) {
    return FrontFilter.normalizeAllowedSubreddits([value])[0] || "";
  }

  function sortAllowedEntries() {
    allowedEntries.sort((a, b) => {
      if (!a.name && !b.name) return 0;
      if (!a.name) return -1;
      if (!b.name) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function renderAllowedEmptyState() {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.textContent = "-";
    empty.appendChild(icon);
    empty.appendChild(document.createTextNode("No subreddit exceptions yet"));
    allowedListEl.appendChild(empty);
  }

  function renderAllowedList() {
    allowedListEl.innerHTML = "";
    updateAllowedCount();

    if (allowedEntries.length === 0) {
      renderAllowedEmptyState();
      return;
    }

    sortAllowedEntries();
    allowedEntries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "allowed-item";

      const input = document.createElement("input");
      input.type = "text";
      input.value = entry.name;
      input.placeholder = "Exact subreddit or Reddit URL";
      input.setAttribute("aria-label", "Allowed subreddit or Reddit URL");
      input.spellcheck = false;
      input.disabled = controlsDisabled;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove subreddit exception");
      removeBtn.textContent = "x";
      removeBtn.disabled = controlsDisabled;

      input.addEventListener("input", (event) => {
        entry.name = event.target.value;
        scheduleAutoSave();
      });
      input.addEventListener("blur", (event) => {
        const normalizedName = normalizeAllowedName(event.target.value);
        if (event.target.value.trim() && !normalizedName) {
          showToast("Whitelist entries must be exact subreddit names", "error");
        }
        entry.name = normalizedName;
        event.target.value = normalizedName;
        scheduleAutoSave(true);
      });
      removeBtn.addEventListener("click", () => {
        const entryIndex = allowedEntries.indexOf(entry);
        if (entryIndex < 0) return;
        allowedEntries.splice(entryIndex, 1);
        renderAllowedList();
        scheduleAutoSave(true);
      });

      item.appendChild(input);
      item.appendChild(removeBtn);
      allowedListEl.appendChild(item);
    });
  }

  function focusAllowedEntry(name, animate) {
    const normalizedName = normalizeAllowedName(name);
    const allItems = allowedListEl.querySelectorAll(".allowed-item");
    const target = normalizedName
      ? Array.from(allItems).find(
          (element) => element.querySelector("input").value === normalizedName,
        )
      : allItems[0];

    if (!target) return;
    if (animate) target.classList.add("pop-in");
    target.querySelector("input").focus();
  }

  function addAllowedEntry(name = "", animate = true) {
    const normalizedName = normalizeAllowedName(name);
    allowedEntries.unshift({ name: normalizedName });
    renderAllowedList();
    focusAllowedEntry(normalizedName, animate);

    if (normalizedName) scheduleAutoSave(true);
  }

  function sortKeywordEntries() {
    keywordEntries.sort((a, b) => {
      if (!a.value && !b.value) return 0;
      if (!a.value) return -1;
      if (!b.value) return 1;
      return a.value.localeCompare(b.value, undefined, { sensitivity: "base" });
    });
  }

  function renderKeywordEmptyState() {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.textContent = "-";

    empty.appendChild(icon);
    empty.appendChild(document.createTextNode("No post keywords filtered yet"));
    titleKeywordListEl.appendChild(empty);
  }

  function renderKeywordList() {
    titleKeywordListEl.innerHTML = "";
    updateTitleKeywordCount();

    if (keywordEntries.length === 0) {
      renderKeywordEmptyState();
      return;
    }

    sortKeywordEntries();
    keywordEntries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "keyword-item";

      const input = document.createElement("input");
      input.type = "text";
      input.value = entry.value;
      input.placeholder = "Keyword or phrase";
      input.setAttribute("aria-label", "Post keyword or phrase");
      input.spellcheck = false;
      input.disabled = controlsDisabled;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove post keyword");
      removeBtn.textContent = "x";
      removeBtn.disabled = controlsDisabled;

      input.addEventListener("input", (event) => {
        entry.value = event.target.value;
        scheduleAutoSave();
      });
      input.addEventListener("blur", (event) => {
        const [normalizedKeyword = ""] = FrontFilter.normalizeTitleKeywords([
          event.target.value,
        ]);
        entry.value = normalizedKeyword;
        event.target.value = normalizedKeyword;
        scheduleAutoSave(true);
      });
      removeBtn.addEventListener("click", () => {
        const entryIndex = keywordEntries.indexOf(entry);
        if (entryIndex < 0) return;
        keywordEntries.splice(entryIndex, 1);
        renderKeywordList();
        scheduleAutoSave(true);
      });

      item.appendChild(input);
      item.appendChild(removeBtn);
      titleKeywordListEl.appendChild(item);
    });
  }

  function focusKeyword(keyword, animate) {
    const [normalizedKeyword = ""] = FrontFilter.normalizeTitleKeywords([keyword]);
    const allItems = titleKeywordListEl.querySelectorAll(".keyword-item");
    const target = normalizedKeyword
      ? Array.from(allItems).find(
          (element) => element.querySelector("input").value === normalizedKeyword,
        )
      : allItems[0];

    if (!target) return;
    if (animate) target.classList.add("pop-in");
    target.querySelector("input").focus();
  }

  function addKeyword(keyword = "", animate = true) {
    const [normalizedKeyword = ""] = FrontFilter.normalizeTitleKeywords([keyword]);
    keywordEntries.unshift({ value: normalizedKeyword });
    renderKeywordList();
    focusKeyword(normalizedKeyword, animate);

    if (normalizedKeyword) scheduleAutoSave(true);
  }

  async function loadSettings() {
    const result = FrontFilter.coerceSettings(
      await chrome.storage.local.get(FrontFilter.STORAGE_KEYS),
    );

    entries = result.blockedSubreddits;
    allowedEntries = result.allowedSubreddits.map((name) => ({ name }));
    keywordEntries = result.blockedTitleKeywords.map((value) => ({ value }));
    scrollLimit.value = String(result.scrollLimit);
    lastScrollLimit = result.scrollLimit;
    scrollMode.value = result.scrollMode;
    colorTheme.value = applyTheme(result.theme);
    Object.entries(checkboxes).forEach(([key, checkbox]) => {
      checkbox.checked = result[key];
    });
    renderList();
    renderAllowedList();
    renderKeywordList();
  }

  async function exportConfig() {
    try {
      await flushPendingSave();
      const data = FrontFilter.coerceSettings(
        await chrome.storage.local.get(FrontFilter.STORAGE_KEYS),
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "frontfilter-config.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Configuration exported!", "success");
    } catch (error) {
      showToast(`Export failed: ${error.message}`, "error");
    }
  }

  async function importConfig(file) {
    setControlsDisabled(true);
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        showToast("Invalid config: expected a JSON object", "error");
        return;
      }

      const filtered = Object.fromEntries(
        Object.entries(data).filter(([key]) =>
          FrontFilter.STORAGE_KEYS.includes(key),
        ),
      );

      if (Object.keys(filtered).length === 0) {
        showToast("Invalid config: no recognized keys", "error");
        return;
      }

      const invalidKeys = FrontFilter.getInvalidSettingKeys(filtered);
      if (invalidKeys.length > 0) {
        showToast(`Invalid config values: ${invalidKeys.join(", ")}`, "error");
        return;
      }

      await flushPendingSave();
      await enqueueStorageOperation(async () => {
        const current = await chrome.storage.local.get(FrontFilter.STORAGE_KEYS);
        await chrome.storage.local.set(
          FrontFilter.coerceSettings({ ...current, ...filtered }),
        );
      });
      await loadSettings();
      showToast("Configuration imported!", "success");
    } catch (error) {
      showToast(`Import failed: ${error.message}`, "error");
    } finally {
      setControlsDisabled(false);
    }
  }

  Object.entries(checkboxes).forEach(([key, checkbox]) => {
    checkbox.addEventListener("change", () => {
      if (key === "hideNavbar") {
        for (const sectionKey of navbarSectionKeys) {
          checkboxes[sectionKey].checked = checkbox.checked;
        }
      }
      if (key === "hideLeftSidebar") {
        for (const sectionKey of leftSidebarSectionKeys) {
          checkboxes[sectionKey].checked = checkbox.checked;
        }
      }
      updateScrollControls();
      updateCommentControls();
      updateNavbarControls();
      updateLeftSidebarControls();
      scheduleAutoSave(true);
    });
  });

  scrollLimit.addEventListener("change", () => {
    const value = Number(scrollLimit.value);
    if (!Number.isSafeInteger(value) || value < 1) {
      showToast("Enter a positive whole number of posts", "error");
      scrollLimit.value = String(lastScrollLimit);
      return;
    }
    lastScrollLimit = value;
    scheduleAutoSave(true);
  });
  scrollMode.addEventListener("change", () => scheduleAutoSave(true));
  colorTheme.addEventListener("change", () => {
    colorTheme.value = applyTheme(colorTheme.value);
    scheduleAutoSave(true);
  });

  addBtn.addEventListener("click", () => addEntry());
  addAllowed.addEventListener("click", () => addAllowedEntry());
  addTitleKeyword.addEventListener("click", () => addKeyword());

  async function addCurrentSubreddit(addEntryCallback) {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.url) return;

      const url = FrontFilter.getRedditUrl(tab.url);
      const subreddit = url && FrontFilter.getSubredditPath(url.pathname);
      subreddit
        ? addEntryCallback(subreddit.name)
        : showToast("No subreddit found on current tab", "error");
    } catch {
      showToast("Could not access current tab", "error");
    }
  }

  addCurrent.addEventListener("click", () => addCurrentSubreddit(addEntry));
  addCurrentAllowed.addEventListener("click", () =>
    addCurrentSubreddit(addAllowedEntry)
  );

  exportBtn.addEventListener("click", exportConfig);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) importConfig(file);
    importFile.value = "";
  });

  setControlsDisabled(true);
  loadSettings()
    .catch((error) => {
      showToast(`Could not load settings: ${error.message}`, "error");
    })
    .finally(() => setControlsDisabled(false));
});
