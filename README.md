# 🧱 Personal Firewall Pro

A Chrome extension combined with a FastAPI backend that acts as a **personal firewall** — blocking unsafe or unwanted websites using **keyword filters**, **HTTPS enforcement**, and **trusted domain validation**.

---

## 🚀 Features
- ✅ **Keyword Filtering** — Blocks pages containing restricted words (e.g., adult content)
- 🔒 **HTTPS Only Mode** — Prevents insecure HTTP browsing
- 🌐 **Trusted Domain Check** — Allows only verified domains from the backend database
- 📜 **Logging System** — Tracks all blocked attempts
- 👨‍👩‍👧 **Parent Control Mode** — PIN-protected access to change settings

---

## 🛠️ Tech Stack
- **Frontend**: Chrome Extension (HTML, JS)
- **Backend**: FastAPI (Python)
- **Database**: SQLite3
- **Browser APIs**: chrome.declarativeNetRequest, webNavigation

---

## 🧩 Project Structure
