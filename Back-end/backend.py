from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
import sqlite3
from urllib.parse import urlparse

# ----------------------------
# Database setup (SQLite)
# ----------------------------
DB_PATH = "firewall.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Keywords table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS firewall_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL
    )""")

    # Trusted domains table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS firewall_trusted_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL
    )""")

    # Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS firewall_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")

    # Settings table (for password)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS firewall_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE,
        setting_value TEXT
    )""")

    # Insert default password if not exists
    cursor.execute(
        "INSERT OR IGNORE INTO firewall_settings (setting_key, setting_value) VALUES (?, ?)",
        ("password", "1234")  # default password
    )

    conn.commit()
    conn.close()

init_db()

# ----------------------------
# FastAPI App
# ----------------------------
app = FastAPI()

# Pydantic Models
class LogEntry(BaseModel):
    url: str
    reason: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class PasswordVerify(BaseModel):
    password: str

# ----------------------------
# Endpoints
# ----------------------------

@app.get("/logs")
def get_logs():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
          url,
          reason,
          timestamp AS ts_utc,
          datetime(timestamp, 'localtime') AS ts_local
        FROM firewall_logs
        ORDER BY id DESC
        LIMIT 200
    """)
    rows = cursor.fetchall()
    conn.close()
    return {
        "logs": [
            {
                "url": r[0],
                "reason": r[1],
                "timestamp_utc": r[2],
                "timestamp_local": r[3]
            } for r in rows
        ]
    }


from fastapi.responses import HTMLResponse

@app.get("/logs/html", response_class=HTMLResponse)
def get_logs_html():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
          url,
          reason,
          timestamp AS ts_utc,
          datetime(timestamp, 'localtime') AS ts_local
        FROM firewall_logs
        ORDER BY id DESC
        LIMIT 200
    """)
    rows = cursor.fetchall()
    conn.close()

    html = """
    <html>
      <head>
        <title>Firewall Logs</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h2 { color: #2563eb; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f1f5f9; }
          tr:nth-child(even) { background: #f9fafb; }
          small { color:#64748b; }
        </style>
      </head>
      <body>
        <h2>Firewall Logs</h2>
        <table>
          <tr>
            <th>Reason</th>
            <th>Timestamp (Local)</th>
            <th>URL</th>
          </tr>
    """
    for url, reason, ts_utc, ts_local in rows:
        html += f"<tr><td>{reason}</td><td>{ts_local} <small>(UTC: {ts_utc})</small></td><td>{url}</td></tr>"
    html += "</table></body></html>"
    return html


# ----------------------------
# Password Endpoints
# ----------------------------

@app.post("/verify-password")
def verify_password(entry: PasswordVerify):
    """Check if entered password is correct"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT setting_value FROM firewall_settings WHERE setting_key='password'")
    row = cursor.fetchone()
    conn.close()

    if row and row[0] == entry.password:
        return {"valid": True}
    else:
        raise HTTPException(status_code=401, detail="Invalid password")

@app.post("/change-password")
def change_password(entry: PasswordChange):
    """Change firewall password (requires old password)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT setting_value FROM firewall_settings WHERE setting_key='password'")
    row = cursor.fetchone()
    if not row or row[0] != entry.old_password:
        conn.close()
        raise HTTPException(status_code=401, detail="Old password is wrong")

    cursor.execute("UPDATE firewall_settings SET setting_value=? WHERE setting_key='password'",
                   (entry.new_password,))
    conn.commit()
    conn.close()
    return {"status": "password_changed"}

@app.get("/rules")
def get_rules():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT keyword FROM firewall_keywords")
    keywords = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT domain FROM firewall_trusted_domains")
    trusted = [row[0] for row in cursor.fetchall()]

    conn.close()
    return {"keywords": keywords, "trusted_domains": trusted}
@app.get("/blocked", response_class=HTMLResponse)
def blocked_page(url: str = "", reason: str = "Blocked by Firewall"):
    """Custom blocked page for redirection"""
    return f"""
    <html>
      <head>
        <title>Site Blocked</title>
        <style>
          body {{
            font-family: Arial, sans-serif;
            background: #f8fafc;
            text-align: center;
            padding: 50px;
          }}
          h1 {{ color: #dc2626; }}
          p {{ color: #334155; }}
        </style>
      </head>
      <body>
        <h1>🚫 Site Blocked</h1>
        <p><b>Reason:</b> {reason}</p>
      
        <p>This site has been blocked for your safety.</p>
      </body>
    </html>
    """