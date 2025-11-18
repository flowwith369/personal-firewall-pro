// ---------------------
// HELPER FUNCTIONS
// ---------------------

async function q(keys) {
  return new Promise(res => chrome.storage.sync.get(keys, res));
}

async function getPassword() {
  const { password = "1234" } = await q(["password"]);
  return password;
}

// ---------------------
// LOAD STATE INTO UI
// ---------------------

async function load() {
  const s = await q([
    "firewallEnabled", "keywordFilter", "httpsOnly", "trustCheck",
     "trustedDomains", "apiKey"
  ]);

  document.getElementById("firewallToggle").checked = s.firewallEnabled ?? false;
  document.getElementById("kwToggle").checked = s.keywordFilter ?? false;
  document.getElementById("httpsToggle").checked = s.httpsOnly ?? false;
  document.getElementById("trustToggle").checked = s.trustCheck ?? false;

  

  updateActiveTabTrust();
}

// ---------------------
// SAVE TOGGLES
// ---------------------

function sendToggles() {
  const data = {
    firewallEnabled: document.getElementById("firewallToggle").checked,
    keywordFilter: document.getElementById("kwToggle").checked,
    httpsOnly: document.getElementById("httpsToggle").checked,
    trustCheck: document.getElementById("trustToggle").checked
  };

  chrome.storage.sync.set(data);
  chrome.runtime.sendMessage({ type: "setToggles", data });
}

// ---------------------
// PASSWORD MODAL
// ---------------------

function showPasswordModal(callback) {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);
                display:flex;align-items:center;justify-content:center;z-index:9999;">
      <div style="background:#fff;padding:20px;border-radius:10px;width:260px;text-align:center;">
        <h3 style="margin-bottom:10px;font-size:16px;">Enter Password</h3>
        <input type="password" id="lockPassword" style="width:100%;padding:8px;margin-bottom:10px;">
        <div>
          <button id="pwSubmit" style="margin-right:6px;">Submit</button>
          <button id="pwCancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#pwSubmit").onclick = async () => {
    const entered = modal.querySelector("#lockPassword").value;
    const stored = await getPassword();
    if (entered === stored) {
      modal.remove();
      callback(true);
    } else {
      alert("Incorrect password!");
      modal.remove();
      callback(false);
    }
  };

  modal.querySelector("#pwCancel").onclick = () => {
    modal.remove();
    callback(false);
  };
}

// ---------------------
// UI EVENTS
// ---------------------

function secureToggle(toggleId, requireOn = false) {
  const el = document.getElementById(toggleId);

  el.addEventListener("change", async (e) => {
    // Case 1: Firewall → require password only for turning OFF
    if (toggleId === "firewallToggle" && !e.target.checked) {
      showPasswordModal((ok) => {
        if (ok) {
          sendToggles();
        } else {
          el.checked = true; // revert
        }
      });
      return;
    }

    // Case 2: Other toggles → require password for any change
    if (toggleId !== "firewallToggle") {
      showPasswordModal((ok) => {
        if (ok) {
          sendToggles();
        } else {
          el.checked = !el.checked; // revert
        }
      });
      return;
    }

    // Default: allow
    sendToggles();
  });
}

// Secure all toggles
secureToggle("firewallToggle");   // 🔐 password only when turning OFF
secureToggle("kwToggle");         // 🔐 password required always
secureToggle("httpsToggle");      // 🔐 password required always
secureToggle("trustToggle");      // 🔐 password required always



// ---------------------
// TRUST STATUS CHECK
// ---------------------

async function updateActiveTabTrust() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) {
      document.getElementById("activeTrust").textContent = "—";
      return;
    }

    const s = await q(["trustCheck", "trustedDomains", "apiKey"]);
    if (!s.trustCheck) {
      document.getElementById("activeTrust").textContent = "Trust check off";
      return;
    }

    const url = tab.url;
    if (!url.startsWith("https://")) {
      document.getElementById("activeTrust").textContent = "Not HTTPS";
      return;
    }

    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const trusted = (s.trustedDomains || []).some(td => host === td || host.endsWith("." + td));

    if (trusted) {
      document.getElementById("activeTrust").textContent = "Trusted (allowlist)";
      return;
    }

    if (s.apiKey && s.apiKey.trim()) {
      chrome.runtime.sendMessage({ type: "checkSafeBrowsing", url }, (resp) => {
        if (resp && resp.safe === true)
          document.getElementById("activeTrust").textContent = "Safe (API)";
        else if (resp && resp.safe === false)
          document.getElementById("activeTrust").textContent = "Dangerous (API)";
        else
          document.getElementById("activeTrust").textContent = "Unknown (API)";
      });
      return;
    }

    document.getElementById("activeTrust").textContent = "Not trusted";
  } catch (e) {
    document.getElementById("activeTrust").textContent = "Error";
  }
}


// ---------------------
// STORAGE WATCHER
// ---------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  if (changes.firewallEnabled)
    document.getElementById("firewallToggle").checked = changes.firewallEnabled.newValue;

  if (changes.keywordFilter)
    document.getElementById("kwToggle").checked = changes.keywordFilter.newValue;

  if (changes.httpsOnly)
    document.getElementById("httpsToggle").checked = changes.httpsOnly.newValue;

  if (changes.trustCheck)
    document.getElementById("trustToggle").checked = changes.trustCheck.newValue;

  if (changes.blockedCount)
    document.getElementById("blockedCount").textContent = changes.blockedCount.newValue;

  if (changes.lastBlockedUrl)
    document.getElementById("lastBlocked").textContent = changes.lastBlockedUrl.newValue || "—";

  updateActiveTabTrust();
});

// ---------------------
// INIT
// ---------------------

document.addEventListener("DOMContentLoaded", load);
// ---------------------
// CHANGE PASSWORD MODAL
// ---------------------

function showChangePasswordModal() {
  const modal = document.createElement("div");
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);
                display:flex;align-items:center;justify-content:center;z-index:9999;">
      <div style="background:#fff;padding:20px;border-radius:10px;width:280px;text-align:center;">
        <h3 style="margin-bottom:10px;font-size:16px;">Change Password</h3>
        <input type="password" id="oldPw" placeholder="Old Password" style="width:100%;padding:8px;margin-bottom:8px;">
        <input type="password" id="newPw" placeholder="New Password" style="width:100%;padding:8px;margin-bottom:8px;">
        <input type="password" id="confirmPw" placeholder="Confirm Password" style="width:100%;padding:8px;margin-bottom:12px;">
        <div>
          <button id="cpSubmit" style="margin-right:6px;">Save</button>
          <button id="cpCancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#cpSubmit").onclick = async () => {
    const oldPw = modal.querySelector("#oldPw").value;
    const newPw = modal.querySelector("#newPw").value;
    const confirmPw = modal.querySelector("#confirmPw").value;
    const storedPw = await getPassword();

    if (oldPw !== storedPw) {
      alert("Old password is incorrect!");
      return;
    }
    if (newPw.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      alert("Passwords do not match!");
      return;
    }

    chrome.storage.sync.set({ password: newPw }, () => {
      alert("Password updated successfully!");
      modal.remove();
    });
  };

  modal.querySelector("#cpCancel").onclick = () => modal.remove();
}

// Attach to button
document.getElementById("btnChangePassword").addEventListener("click", showChangePasswordModal);
