const tabCounts = new Map();

const updateBadge = async (tabId, counts = {}) => {
  const previous = tabCounts.get(tabId) || { api: 0, cookies: 0 };
  const next = {
    api: Number.isFinite(counts.api) ? counts.api : previous.api,
    cookies: Number.isFinite(counts.cookies) ? counts.cookies : previous.cookies
  };
  tabCounts.set(tabId, next);

  const total = next.api + next.cookies;
  const text = total > 99 ? "99+" : total > 0 ? String(total) : "";
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2f81f7" });
};

const getCookiesForUrl = (url) => new Promise((resolve, reject) => {
  chrome.cookies.getAll({ url }, (cookies) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }
    resolve(cookies);
  });
});

const refreshCookieBadge = async (tabId, url) => {
  if (!url || !/^https?:\/\//i.test(url)) {
    await updateBadge(tabId);
    return;
  }

  try {
    const cookies = await getCookiesForUrl(url);
    await updateBadge(tabId, { cookies: cookies.length });
  } catch {
    await updateBadge(tabId, { cookies: 0 });
  }
};

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "APICATCHER_TOGGLE" }, () => {
    void chrome.runtime.lastError;
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    tabCounts.set(tabId, { api: 0, cookies: 0 });
    void refreshCookieBadge(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCounts.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) {
    return;
  }

  if (message?.action === "updateBadge") {
    void updateBadge(tabId, {
      api: Number(message.apiCount),
      cookies: Number(message.cookieCount)
    });
    sendResponse({ ok: true });
    return;
  }

  if (message?.action === "getCookies") {
    const url = message.url || sender.tab.url;
    if (!url) {
      sendResponse({ ok: false, error: "The current tab URL is unavailable." });
      return;
    }

    getCookiesForUrl(url)
      .then(async (cookies) => {
        await updateBadge(tabId, { cookies: cookies.length });
        sendResponse({ ok: true, cookies });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.action === "deleteCookie") {
    const cookie = message.cookie;
    if (!cookie?.name || !cookie?.domain) {
      sendResponse({ ok: false, error: "Cookie name and domain are required." });
      return;
    }

    const domain = cookie.domain.replace(/^\./, "");
    const protocol = cookie.secure ? "https" : "http";
    const url = `${protocol}://${domain}${cookie.path || "/"}`;
    chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId }, async (removed) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (!removed) {
        sendResponse({ ok: false, error: "Cookie was not found." });
        return;
      }

      await refreshCookieBadge(tabId, sender.tab.url);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.action === "clearCookies") {
    const url = message.url || sender.tab.url;
    if (!url) {
      sendResponse({ ok: false, error: "The current tab URL is unavailable." });
      return;
    }

    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      sendResponse({ ok: false, error: "The current tab URL is invalid." });
      return;
    }

    new Promise((resolve, reject) => {
      chrome.cookies.getAll({ domain: hostname }, (cookies) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(cookies);
      });
    })
      .then((cookies) => Promise.all(cookies.map((cookie) => new Promise((resolve, reject) => {
        const domain = cookie.domain.replace(/^\./, "");
        const protocol = cookie.secure ? "https" : "http";
        const cookieUrl = `${protocol}://${domain}${cookie.path || "/"}`;
        chrome.cookies.remove({ url: cookieUrl, name: cookie.name, storeId: cookie.storeId }, (removed) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!removed) {
            reject(new Error(`Cookie "${cookie.name}" was not found.`));
            return;
          }
          resolve();
        });
      }))))
      .then(async () => {
        await updateBadge(tabId, { cookies: 0 });
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
