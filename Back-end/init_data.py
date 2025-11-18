import sqlite3

DB_PATH = "firewall.db"
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

keywords = [
    # Betting
    "bet","betting","gambling","casino","poker","lottery","jackpot","roulette","cricketbet","footballbet",
    "iplbet","bet365","dream11","fantasybet","rummy","satta",
    # Drugs
    "drugs","weed","cocaine","heroin","marijuana","hashish","lsd","mdma","ecstasy","opium","narcotics",
    "addiction","pillshop","buydrugs",
    # Crime / Violence
    "murder","rape","kill","gun","shooting","weapon","knife","terror","bomb","suicide","torture","hostage",
    "blood","fight","attack","assault","violence",
    # Scam / Fraud
    "scam","fraud","hacking","phishing","darkweb","deepweb","carding","stealer","keylogger","malware",
    "virus","spyware","exploit","hacktool","cracker","ransomware"

    # Adult
    "sex","porn","xxx","nude","hotsex","redtube","xvideos","xhamster","pornhub",
    "erotic","hentai","escort","cams","fetish","hardcore","incest","blowjob","anal","bdsm","onlyfans",
    
]

# Insert keywords into DB
cursor.executemany("INSERT INTO firewall_keywords (keyword) VALUES (?)",
                   [(k,) for k in keywords])



conn.commit()
conn.close()
print(f"✅ Inserted {len(keywords)} keywords into firewall_keywords table")
