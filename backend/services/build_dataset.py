from fetchbillionaires import fetch_billionaires
from fetchdetail import fetch_detail
import json
import time
import os

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

data = fetch_billionaires()
data = [p for p in data if p.get("country") == "United States"]

enriched = []

def get_last_year_worth(detail_data):
    history = detail_data.get("wealth_history", [])
    
    for entry in reversed(history):
        if "2025" in entry["date"]:  # adjust if needed
            return entry["worth"] * 1_000_000_000

    return None
    
    
for person in data:  # START SMALL (avoid rate limit)
    try:
        detail = fetch_detail(person["id"])
        last_year = get_last_year_worth(detail)

        person["last_year_wealth"] = last_year

        enriched.append(person)

        print(f"Done: {person['name']}")

        time.sleep(1)  # VERY IMPORTANT (rate limiting)

    except Exception as e:
        print("ERROR:", e)

os.makedirs(DATA_DIR, exist_ok=True)
with open(HISTORY_FILE, "w") as f:
    json.dump(enriched, f)
