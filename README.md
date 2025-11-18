# personal-firewall-pro 
#🔥 Personal Firewall – FastAPI Project

A simple personal firewall system built using **FastAPI + SQLite**.  
It blocks websites using **keywords**, **trusted domains**, and displays a custom **blocked page** with an image.

---

## ✅ Features

- 🔐 Password-protected (default password: `1234`)
- 🚫 Keyword-based website blocking
- 🟢 Trusted domain allowlist
- 📝 Logs all blocked URL requests
- 🌐 View logs:
  - JSON → `/logs`
  - HTML → `/logs/html`
- 🖼 Custom "Site Blocked" page with responsive image
- ⚡ FastAPI backend with auto-reload support

---

## 📁 Project Structure

```
personal-firewall/
│
├── front-end
├── Back-end
├── README.md

```

---

## 🛠 Prerequisites (Windows / Mac / Linux)

Make sure your system has:

### ✔ Python 3.9 or later  
Check:
```sh
python3 --version
```

### ✔ pip  
Check:
```sh
pip3 --version
```

### ✔ Install dependencies  
Run inside project folder:

```sh
pip3 install -r requirements.txt
```

---

## ▶️ Run the Project - go to backend folder and und the below command

Start the server:

```sh
uvicorn backend:app --reload
```

(Or)

```sh
python3 -m uvicorn backend:app --reload
```

Server will run at:

```
http://127.0.0.1:8000
```

---

## 🌍 Useful URLs

| Purpose | URL |
|--------|-----|
| API Documentation | http://127.0.0.1:8000/docs |
| Logs (JSON) | http://127.0.0.1:8000/logs |
| Logs (HTML) | http://127.0.0.1:8000/logs/html |
| Blocked Page | http://127.0.0.1:8000/blocked?url=test&reason=demo |
| Static Image | http://127.0.0.1:8000/static/blocked_img.webp |

---

## 🔐 Password System

Default login password:

```
1234
```

Change password using:

```
POST /change-password
```

---

## 📄 Database Details

The database `firewall.db` is automatically created and contains:

- `firewall_keywords`
- `firewall_trusted_domains`
- `firewall_logs`
- `firewall_settings`

No manual setup required.

---

## 🤝 Contributing

Pull requests are welcome.  
For major updates, open an issue first.

---

