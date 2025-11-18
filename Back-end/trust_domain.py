import sqlite3

DB_PATH = "firewall.db"
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

trusted_domains = [
    "khanacademy.org","bbc.com","google.com",
    "coursera.org","edx.org","udemy.com","nptel.ac.in","mit.edu","harvard.edu",
    "bbc.com","cnn.com","reuters.com","theguardian.com","ndtv.com","timesofindia.indiatimes.com",
    "gmail.com","outlook.com","yahoo.com","protonmail.com",
    "youtube.com","ted.com","discovery.com","nationalgeographic.com","chatgpt.com",
    "pbskids.org","nick.com","cartoonnetwork.com",
    "india.gov.in","usa.gov","who.int","un.org",
    "stackoverflow.com","github.com","w3schools.com","geeksforgeeks.org","mozilla.org","python.org"
]

cursor.executemany(
    "INSERT OR IGNORE INTO firewall_trusted_domains (domain) VALUES (?)",
    [(d,) for d in trusted_domains]
)

conn.commit()
conn.close()
print(f"✅ Inserted {len(trusted_domains)} trusted domains into firewall_trusted_domains table")
