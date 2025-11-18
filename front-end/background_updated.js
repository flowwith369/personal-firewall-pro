// background.js — fixed keyword filtering + trust check + https enforcement

// ---------------------
// BACKEND COMMUNICATION
// ---------------------

async function fetchRulesFromBackend() {
  try {
    let response = await fetch("http://127.0.0.1:8000/rules");
    return await response.json();
  } catch (e) {
    console.error("Failed to fetch rules from backend:", e);
    return { keywords: [], trusted_domains: [] };
  }
}

async function logBlockedToBackend(url, reason) {
  try {
    await fetch("http://127.0.0.1:8000/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, reason })
    });
  } catch (e) {
    console.error("Failed to send log:", e);
  }
}

// ---------------------
// RULE BUILDERS
// ---------------------

function makeHttpsOnlyRule(id) {
  return {
    id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: "http://127.0.0.1:8000/blocked?reason=http_only" }
    },
    condition: { urlFilter: "http://*", resourceTypes: ["main_frame"] }
  };
}

// ---------------------
// HELPERS
// ---------------------

function isSearchHost(host, pathname) {
  if (host.includes("google.")) return true;
  if (host.includes("bing.com")) return true;
  if (host.includes("duckduckgo.com")) return true;
  if (host.includes("yahoo.com")) return true;
  if (host.includes("search.yahoo.com")) return true;
  if (host.includes("brave.com") && pathname.startsWith("/search")) return true;
  return false;
}

function extractSearchQuery(urlObj) {
  try {
    const params = new URLSearchParams(urlObj.search);
    let q = params.get("q") || params.get("query") || "";
    return (q || "").trim().toLowerCase();
  } catch (e) {
    return "";
  }
}

function pathSingleToken(urlObj) {
  const p = urlObj.pathname || "/";
  if (!p || p === "/") return "";
  const trimmed = p.replace(/^\/+|\/+$/g, "");
  if (trimmed.indexOf("/") !== -1) return "";
  if (trimmed.indexOf(".") !== -1) return "";
  const token = decodeURIComponent(trimmed).trim().toLowerCase();
  if (token && token.split(/\s+/).length === 1) return token;
  return "";
}

function normalizeHost(host) {
  return (host || "").toLowerCase();
}

// ---------------------
// MAIN RULE HANDLER
// ---------------------

async function rebuildRules() {
  const {
    firewallEnabled = false,
    httpsOnly = false,
    trustCheck = false
  } = await chrome.storage.sync.get([
    "firewallEnabled",
    "httpsOnly",
    "trustCheck"
  ]);

  const existing = await new Promise(res =>
    chrome.declarativeNetRequest.getDynamicRules(r => res(r.map(x => x.id)))
  );
  if (existing.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing });
  }

  if (!firewallEnabled) {
    console.log("Firewall OFF → rules cleared");
    return;
  }

  const rulesFromBackend = await fetchRulesFromBackend();
  const trustedDomains = rulesFromBackend.trusted_domains || [];
  const keywords = (rulesFromBackend.keywords || []).map(k => k.toLowerCase().trim());

  await chrome.storage.sync.set({ trustedDomains, keywords });

  const rules = [];
  let id = 1;

  if (httpsOnly) {
    rules.push(makeHttpsOnlyRule(id++));
  }

  if (rules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    console.log("Rules applied:", rules.length);
  }
}

// ---------------------
// BLOCK LOGGING
// ---------------------

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
  const url = info?.request?.url || "";
  await logBlockedToBackend(url, "Matched firewall rule");
});

// ---------------------
// NAVIGATION LISTENER
// ---------------------

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  try {
    if (!details || !details.url || !details.tabId) return;
    if (details.url.startsWith("chrome://") || details.url.startsWith("chrome-extension://") || details.url.startsWith("about:")) return;

    let settings = await chrome.storage.sync.get({
      firewallEnabled: true,
      keywordFilter: true,
      httpsOnly: true,
      trustCheck: false,
      trustedDomains: [],
      keywords: []
    });

    if (!settings.firewallEnabled) return;

    const urlObj = new URL(details.url);
    const host = normalizeHost(urlObj.hostname);
    const scheme = urlObj.protocol.replace(":", "");

    if (host === "127.0.0.1" || host === "localhost") return;

    // HTTPS-only check
    if (settings.httpsOnly && scheme !== "https") {
      chrome.tabs.update(details.tabId, {
        url: "http://127.0.0.1:8000/blocked?reason=http_only"
      });
      await logBlockedToBackend(details.url, "HTTP not allowed");
      return;
    }

    // Refresh rules if empty
    if ((!settings.trustedDomains?.length) || (!settings.keywords?.length)) {
      const r = await fetchRulesFromBackend();
      settings.trustedDomains = r.trusted_domains || [];
      settings.keywords = (r.keywords || []).map(k => k.toLowerCase().trim());
      await chrome.storage.sync.set(settings);
    }

    // Trust check
    if (settings.trustCheck) {
      const allowed = settings.trustedDomains.some(d => {
        const domain = d.toLowerCase().trim();
        return host === domain || host.endsWith("." + domain);
      });

      if (!allowed) {
        chrome.tabs.update(details.tabId, {
          url: "http://127.0.0.1:8000/blocked?reason=Untrusted Domain&url=" + encodeURIComponent(details.url)
        });
        await logBlockedToBackend(details.url, "Untrusted domain");
        return;
      }
      // Don't return → still check keywords
    }

    // Keyword filtering
    if (settings.keywordFilter) {
      const keywords = settings.keywords || [];

      // Search query check
      if (isSearchHost(host, urlObj.pathname)) {
        const q = extractSearchQuery(urlObj);
        if (q) {
          const tokens = q.split(/\s+/).filter(Boolean);
          if (tokens.length === 1) {
            const token = tokens[0].toLowerCase();
            if (keywords.includes(token)) {
              chrome.tabs.update(details.tabId, {
                url: "http://127.0.0.1:8000/blocked?reason=keyword&word=" + encodeURIComponent(token)
              });
              await logBlockedToBackend(details.url, "Blocked search keyword: " + token);
              return;
            }
          }
        }
      } else {
        // Path token check
        const token = pathSingleToken(urlObj);
        if (token && keywords.includes(token)) {
          chrome.tabs.update(details.tabId, {
            url: "http://127.0.0.1:8000/blocked?reason=keyword&word=" + encodeURIComponent(token)
          });
          await logBlockedToBackend(details.url, "Blocked path keyword: " + token);
          return;
        }
      }
    }
  } catch (err) {
    console.error("nav listener error:", err);
  }
}, { url: [{ schemes: ["http", "https"] }] });

// ---------------------
// STARTUP + TOGGLE LISTENER
// ---------------------

rebuildRules();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" &&
      (changes.firewallEnabled || changes.keywordFilter ||
       changes.httpsOnly || changes.trustCheck)) {
    rebuildRules();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "setToggles") {
    chrome.storage.sync.set(msg.data, rebuildRules);
  }
  sendResponse(true);
});
