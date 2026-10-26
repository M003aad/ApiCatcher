(() => {
  const MESSAGE_TYPE = "APICATCHER_RESPONSE";
  const ROOT_ID = "apicatcher-root";
  const STORAGE_KEY = "apicatcher-panel-state";
  const state = {
    requests: [],
    cookies: [],
    cookiesLoaded: false,
    mode: "hidden",
    activeTab: "api",
    nextId: 1
  };

  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.mode === "open" || saved?.mode === "minimized") {
      state.mode = saved.mode;
    }
  } catch {
    // Use the required hidden default when page storage is unavailable.
  }

  const root = document.createElement("aside");
  root.id = ROOT_ID;
  root.setAttribute("aria-label", "ApiCatcher network inspector");
  root.innerHTML = `
    <div class="apicatcher-header">
      <div class="apicatcher-title">
        <span class="apicatcher-logo" aria-hidden="true">&lt;/&gt;</span>
        <span>ApiCatcher</span>
        <span class="apicatcher-count" data-api-count>0</span>
      </div>
      <div class="apicatcher-actions">
        <button type="button" class="apicatcher-icon-button" data-close aria-label="Hide panel">×</button>
        <button type="button" class="apicatcher-icon-button" data-minimize aria-label="Minimize panel">−</button>
      </div>
    </div>
    <nav class="apicatcher-tabs" aria-label="ApiCatcher views">
      <button type="button" class="apicatcher-tab is-active" data-tab="api">API Requests <span data-tab-api-count>0</span></button>
      <button type="button" class="apicatcher-tab" data-tab="cookies">Cookies <span data-tab-cookie-count>0</span></button>
    </nav>
    <div class="apicatcher-body">
      <section class="apicatcher-view" data-view="api">
        <div class="apicatcher-view-toolbar">
          <span>JSON responses</span>
          <div class="apicatcher-toolbar-actions">
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-copy-requests aria-label="Copy all requests" title="Copy all requests"></button>
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-refresh-requests aria-label="Refresh requests" title="Refresh requests"></button>
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-clear-requests aria-label="Clear all requests" title="Clear all requests"></button>
          </div>
        </div>
        <div class="apicatcher-empty" data-empty><strong>Waiting for JSON APIs</strong><span>Fetch and XHR responses will appear here.</span></div>
        <div class="apicatcher-list" data-list></div>
      </section>
      <section class="apicatcher-view" data-view="cookies" hidden>
        <div class="apicatcher-view-toolbar">
          <span data-cookie-summary>Cookies for this site</span>
          <div class="apicatcher-toolbar-actions">
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-copy-cookies aria-label="Copy all cookies" title="Copy all cookies"></button>
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-refresh-cookies aria-label="Refresh cookies" title="Refresh cookies"></button>
            <button type="button" class="apicatcher-tool-button apicatcher-icon-action" data-clear-cookies aria-label="Clear all cookies" title="Clear all cookies"></button>
          </div>
        </div>
        <div class="apicatcher-cookie-state" data-cookie-state>Click Refresh to load cookies.</div>
        <div class="apicatcher-cookie-table-wrap">
          <table class="apicatcher-cookie-table">
            <thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Flags</th></tr></thead>
            <tbody data-cookie-list></tbody>
          </table>
        </div>
      </section>
    </div>
    <button type="button" class="apicatcher-mini-button" data-restore aria-label="Open ApiCatcher">ApiCatcher</button>
  `;

  const list = root.querySelector("[data-list]");
  const empty = root.querySelector("[data-empty]");
  const cookieList = root.querySelector("[data-cookie-list]");
  const cookieState = root.querySelector("[data-cookie-state]");
  const cookieSummary = root.querySelector("[data-cookie-summary]");
  const apiCount = root.querySelector("[data-api-count]");
  const cookieCount = root.querySelector("[data-tab-cookie-count]");
  const mainHeaderCount = root.querySelector(".apicatcher-count");

  document.documentElement.appendChild(root);

  const iconMarkup = (name) => {
    const paths = {
      check: '<path d="m5 12 4 4L19 6"/>',
      copy: '<rect x="9" y="9" width="10" height="10" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
      refresh: '<path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10"/><path d="M3 4v6h6"/><path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14"/><path d="M21 20v-6h-6"/>',
      trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 13h12l1-13"/><path d="M9 7V4h6v3"/>'
    };
    return `<svg class="apicatcher-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  };

  root.querySelectorAll("[data-copy-requests], [data-copy-cookies]").forEach((button) => {
    button.innerHTML = iconMarkup("copy");
  });
  root.querySelectorAll("[data-refresh-requests], [data-refresh-cookies]").forEach((button) => {
    button.innerHTML = iconMarkup("refresh");
  });
  root.querySelectorAll("[data-clear-requests], [data-clear-cookies]").forEach((button) => {
    button.innerHTML = iconMarkup("trash");
  });

  const updateMainHeaderTotal = () => {
    mainHeaderCount.textContent = String(state.requests.length + state.cookies.length);
  };

  const saveMode = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode }));
    } catch {
      // The panel remains functional when storage is blocked.
    }
  };

  const sendBadgeUpdate = () => {
    const message = {
      action: "updateBadge",
      apiCount: state.requests.length
    };
    if (state.cookiesLoaded) {
      message.cookieCount = state.cookies.length;
    }
    chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
  };

  const copyText = async (text, button, defaultLabel) => {
    const defaultContent = button.dataset.defaultContent || button.innerHTML;
    button.dataset.defaultContent = defaultContent;
    try {
      await navigator.clipboard.writeText(text);
      button.innerHTML = iconMarkup("check");
      button.setAttribute("aria-label", "Copied");
      window.setTimeout(() => {
        button.innerHTML = defaultContent;
        button.setAttribute("aria-label", defaultLabel);
      }, 1200);
    } catch {
      button.setAttribute("aria-label", "Copy failed");
    }
  };

  const shortenUrl = (value) => {
    try {
      const parsed = new URL(value);
      const path = `${parsed.pathname}${parsed.search}`;
      return `${parsed.host}${path.length > 55 ? `${path.slice(0, 52)}...` : path}`;
    } catch {
      return value.length > 65 ? `${value.slice(0, 62)}...` : value;
    }
  };

  const createTag = (text, className) => {
    const tag = document.createElement("span");
    tag.className = `apicatcher-cookie-tag ${className}`;
    tag.textContent = text;
    return tag;
  };

  const renderRequests = () => {
    list.replaceChildren();
    empty.hidden = state.requests.length > 0;
    apiCount.textContent = String(state.requests.length);
    root.querySelector("[data-tab-api-count]").textContent = String(state.requests.length);
    updateMainHeaderTotal();

    state.requests.forEach((request) => {
      const item = document.createElement("article");
      item.className = "apicatcher-request";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "apicatcher-request-toggle";
      toggle.setAttribute("aria-expanded", "false");
      const method = document.createElement("span");
      method.className = `apicatcher-method apicatcher-method-${request.method.toLowerCase()}`;
      method.textContent = request.method;
      const url = document.createElement("span");
      url.className = "apicatcher-url";
      url.title = request.url;
      url.textContent = shortenUrl(request.url);
      const status = document.createElement("span");
      status.className = `apicatcher-status ${request.status >= 200 && request.status < 400 ? "is-success" : "is-error"}`;
      status.textContent = String(request.status);
      const chevron = document.createElement("span");
      chevron.className = "apicatcher-chevron";
      chevron.textContent = "›";
      toggle.append(method, url, status, chevron);

      const details = document.createElement("div");
      details.className = "apicatcher-details";
      details.hidden = true;
      const toolbar = document.createElement("div");
      toolbar.className = "apicatcher-detail-toolbar";
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "apicatcher-button-group";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "apicatcher-copy apicatcher-item-button";
      copy.innerHTML = iconMarkup("copy");
      copy.setAttribute("aria-label", "Copy request");
      copy.title = "Copy request";
      copy.addEventListener("click", () => copyText(JSON.stringify(request.data, null, 2), copy, "Copy"));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "apicatcher-delete apicatcher-item-button";
      remove.innerHTML = iconMarkup("trash");
      remove.setAttribute("aria-label", "Delete request");
      remove.title = "Delete request";
      remove.addEventListener("click", () => {
        state.requests = state.requests.filter((item) => item.id !== request.id);
        renderRequests();
        sendBadgeUpdate();
      });
      buttonGroup.append(copy, remove);
      toolbar.appendChild(buttonGroup);
      const json = document.createElement("pre");
      json.className = "apicatcher-json";
      json.textContent = JSON.stringify(request.data, null, 2);
      details.append(toolbar, json);
      toggle.addEventListener("click", () => {
        const open = details.hidden;
        details.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        item.classList.toggle("is-expanded", open);
      });
      item.append(toggle, details);
      list.appendChild(item);
    });
  };

  const renderCookies = () => {
    cookieList.replaceChildren();
    cookieCount.textContent = String(state.cookies.length);
    cookieSummary.textContent = `${state.cookies.length} cookie${state.cookies.length === 1 ? "" : "s"} for this site`;
    updateMainHeaderTotal();

    state.cookies.forEach((cookie) => {
      const item = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = cookie.name;
      const valueCell = document.createElement("td");
      valueCell.textContent = cookie.value;
      valueCell.title = cookie.value;
      const domainCell = document.createElement("td");
      domainCell.textContent = cookie.domain;
      const flagsCell = document.createElement("td");
      flagsCell.className = "apicatcher-cookie-flags";
      if (cookie.secure) flagsCell.appendChild(createTag("Secure", "is-secure"));
      if (cookie.httpOnly) flagsCell.appendChild(createTag("HttpOnly", "is-http-only"));
      if (!cookie.secure && !cookie.httpOnly) flagsCell.textContent = "—";
      item.append(nameCell, valueCell, domainCell, flagsCell);

      const detailsRow = document.createElement("tr");
      detailsRow.className = "apicatcher-cookie-details-row";
      detailsRow.hidden = true;
      const detailsCell = document.createElement("td");
      detailsCell.colSpan = 4;
      const toolbar = document.createElement("div");
      toolbar.className = "apicatcher-detail-toolbar";
      const buttonGroup = document.createElement("div");
      buttonGroup.className = "apicatcher-button-group";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "apicatcher-copy apicatcher-item-button";
      copy.innerHTML = iconMarkup("copy");
      copy.setAttribute("aria-label", "Copy cookie");
      copy.title = "Copy cookie";
      copy.addEventListener("click", () => copyText(JSON.stringify(cookie, null, 2), copy, "Copy"));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "apicatcher-delete apicatcher-item-button";
      remove.innerHTML = iconMarkup("trash");
      remove.setAttribute("aria-label", "Delete cookie");
      remove.title = "Delete cookie";
      remove.addEventListener("click", () => {
        remove.disabled = true;
        chrome.runtime.sendMessage({ action: "deleteCookie", cookie }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            remove.disabled = false;
            cookieState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to delete cookie.";
            return;
          }
          loadCookies();
        });
      });
      buttonGroup.append(copy, remove);
      toolbar.appendChild(buttonGroup);
      const json = document.createElement("pre");
      json.className = "apicatcher-json";
      json.textContent = JSON.stringify(cookie, null, 2);
      detailsCell.append(toolbar, json);
      detailsRow.appendChild(detailsCell);

      item.className = "apicatcher-cookie-row";
      item.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        detailsRow.hidden = !detailsRow.hidden;
        item.classList.toggle("is-expanded", !detailsRow.hidden);
      });
      cookieList.append(item, detailsRow);
    });
    sendBadgeUpdate();
  };

  const loadCookies = () => {
    cookieState.textContent = "Loading cookies...";
    chrome.runtime.sendMessage({ action: "getCookies", url: window.location.href }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        cookieState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to load cookies.";
        return;
      }
      state.cookies = response.cookies || [];
      state.cookiesLoaded = true;
      cookieState.textContent = state.cookies.length ? "" : "No cookies found for this site.";
      renderCookies();
    });
  };

  const setMode = (mode) => {
    state.mode = mode;
    root.classList.toggle("is-minimized", mode === "minimized");
    root.hidden = mode === "hidden";
    saveMode();
  };

  root.querySelector("[data-copy-requests]").addEventListener("click", (event) => {
    const text = state.requests.map((request) => JSON.stringify(request.data, null, 2)).join("\n\n");
    copyText(text, event.currentTarget, "Copy All");
  });
  root.querySelector("[data-refresh-requests]").addEventListener("click", renderRequests);
  root.querySelector("[data-clear-requests]").addEventListener("click", () => {
    state.requests = [];
    renderRequests();
    sendBadgeUpdate();
  });
  root.querySelector("[data-close]").addEventListener("click", () => setMode("hidden"));
  root.querySelector("[data-restore]").addEventListener("click", () => setMode("open"));
  root.querySelector("[data-minimize]").addEventListener("click", () => setMode(state.mode === "minimized" ? "open" : "minimized"));
  root.querySelector("[data-refresh-cookies]").addEventListener("click", loadCookies);
  root.querySelector("[data-copy-cookies]").addEventListener("click", (event) => {
    const text = state.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    copyText(text, event.currentTarget, "Copy All");
  });
  root.querySelector("[data-clear-cookies]").addEventListener("click", (event) => {
    event.currentTarget.disabled = true;
    chrome.runtime.sendMessage({ action: "clearCookies", url: window.location.href }, (response) => {
      event.currentTarget.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) {
        cookieState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to clear cookies.";
        return;
      }
      loadCookies();
    });
  });
  root.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
      root.querySelectorAll("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== state.activeTab; });
      if (state.activeTab === "cookies" && !state.cookies.length) loadCookies();
    });
  });

  let dragStart = null;
  const header = root.querySelector(".apicatcher-header");
  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    const bounds = root.getBoundingClientRect();
    dragStart = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const left = Math.max(0, Math.min(window.innerWidth - root.offsetWidth, dragStart.left + event.clientX - dragStart.x));
    const top = Math.max(0, Math.min(window.innerHeight - 40, dragStart.top + event.clientY - dragStart.y));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  });
  header.addEventListener("pointerup", () => { dragStart = null; });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "ApiCatcher" || event.data.type !== MESSAGE_TYPE) return;
    const payload = event.data.payload;
    if (!payload || typeof payload.url !== "string" || typeof payload.method !== "string" || typeof payload.data === "undefined") return;
    state.requests.unshift({
      id: state.nextId++,
      url: payload.url,
      method: payload.method,
      status: Number(payload.status) || 0,
      data: payload.data
    });
    renderRequests();
    sendBadgeUpdate();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "APICATCHER_TOGGLE") setMode(state.mode === "hidden" ? "open" : "hidden");
  });

  renderRequests();
  renderCookies();
  setMode(state.mode);
  sendBadgeUpdate();
  loadCookies();
})();
