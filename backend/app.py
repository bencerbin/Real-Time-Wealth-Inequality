from flask import Flask, jsonify
from flask_cors import CORS
from services.fetchbillionaires import fetch_billionaires
import time
import json
import os

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

CACHE_DIR = os.path.join(os.path.dirname(__file__), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "cache.json")
CACHE_DURATION = 600  # 10 minutes
CACHE_VERSION = 4
HISTORY_CANDIDATES = [
    os.path.join(CACHE_DIR, "history.json"),
    os.path.join(os.path.dirname(__file__), "services", "history.json"),
]


# --- Load cache from disk ---
def load_cache():
    if not os.path.exists(CACHE_FILE):
        return None

    with open(CACHE_FILE, "r") as f:
        cache = json.load(f)

    if cache.get("version") != CACHE_VERSION:
        return None

    return cache


# --- Save cache to disk ---
def save_cache(data):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)
        
def load_history():
    history_path = next((path for path in HISTORY_CANDIDATES if os.path.exists(path)), None)
    if not history_path:
        return {}

    with open(history_path) as f:
        raw = json.load(f)

    # 🔥 convert list → dict keyed by id
    return {p["id"]: p for p in raw}


@app.route("/api/billionaires")
def get_billionaires():
    cache = load_cache()
    current_time = time.time()

    if cache:
        age = current_time - cache["timestamp"]
        if age < CACHE_DURATION:
            print("CACHE USED")
            return jsonify(cache["data"])

    try:
        history = load_history()

        data = fetch_billionaires()
        data = [p for p in data if p.get("country") == "United States"]

        merged = []

        for p in data:
            person_id = p.get("id")

            last_year = history.get(person_id, {}).get("last_year_wealth")
            if last_year is None:
                last_year = p.get("wealth")

            merged.append({
                **p,
                "last_year_wealth": last_year
            })

        result = merged 

        save_cache({
            "version": CACHE_VERSION,
            "timestamp": current_time,
            "data": result
        })

        return jsonify(result)

    except Exception as e:
        print("ERROR:", e)

        if cache:
            return jsonify(cache["data"])

        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
