from fetchbillionaires import fetch_billionaires
import json
import os

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
HISTORY_CANDIDATES = [
    os.path.join(DATA_DIR, "history.json"),
    os.path.join(BASE_DIR, "history.json"),
]

def load_history():
    history_path = next((path for path in HISTORY_CANDIDATES if os.path.exists(path)), None)
    if not history_path:
        return {}

    with open(history_path) as f:
        raw = json.load(f)

    # 🔥 convert list → dict keyed by id
    history_dict = {}
    for person in raw:
        history_dict[person["id"]] = person

    return history_dict


history = load_history()
data = fetch_billionaires()

# filter US
data = [p for p in data if p.get("country") == "United States"]

merged = []

for p in data:
    person_id = p.get("id")

    last_year = None
    if person_id in history:
        last_year = history[person_id].get("last_year_wealth")
    if last_year is None:
        last_year = p.get("wealth")

    merged.append({
        **p,
        "last_year_wealth": last_year
    })

# --- PRINT SAMPLE ---
print("\nFIRST 5:\n")
for person in merged[:5]:
    print(person)

# --- SAVE FULL ---
os.makedirs(DATA_DIR, exist_ok=True)
with open(os.path.join(DATA_DIR, "debug_merged.json"), "w") as f:
    json.dump(merged, f, indent=2)

print("\nSaved to data/debug_merged.json")
