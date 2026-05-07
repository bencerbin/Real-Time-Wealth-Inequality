from flask import Flask, jsonify, send_from_directory
import time
import json
import os
import sys

try:
    from flask_cors import CORS
except ImportError:
    def CORS(app, *args, **kwargs):
        return app

sys.path.insert(0, os.path.dirname(__file__))
from services.fetchbillionaires import fetch_billionaires

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

CACHE_DIR = os.path.join(os.path.dirname(__file__), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "cache.json")
CACHE_DURATION = 600  # 10 minutes
CACHE_VERSION = 4
HISTORY_CANDIDATES = [
    os.path.join(CACHE_DIR, "history.json"),
    os.path.join(os.path.dirname(__file__), "services", "history.json"),
]
DETAILS_FILE = os.path.join(CACHE_DIR, "full_person_details.json")
US_STATES = {
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
}


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return None

    with open(CACHE_FILE, "r") as f:
        cache = json.load(f)

    if cache.get("version") != CACHE_VERSION:
        return None

    return cache


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


def load_full_person_details():
    if not os.path.exists(DETAILS_FILE):
        return []

    with open(DETAILS_FILE, "r") as f:
        return json.load(f)


def parse_residence(residence_value):
    residence = str(residence_value or "").strip()
    state = ""
    country = ""

    if "," in residence:
        state = residence.split(",")[-1].strip()
        if state not in US_STATES:
            country = state
            state = ""
        else:
            country = "United States"
    elif residence in US_STATES:
        state = residence
        country = "United States"
    else:
        country = residence

    return residence, state, country


def normalize_explorer_person(person):
    personal_stats = person.get("personal_stats") or []
    residence = ""
    state = ""
    country = ""
    industry = ""
    philanthropy_score = None
    self_made_score = None

    for stat in personal_stats:
        if not isinstance(stat, dict):
            continue

        label = str(stat.get("label") or "").strip().lower()
        value = str(stat.get("value") or "").strip()

        if label == "residence":
            residence, state, country = parse_residence(value)
        elif label == "source of wealth":
            industry = value.split(",")[0].strip()
        elif label == "philanthropy score":
            try:
                philanthropy_score = int(float(value))
            except (TypeError, ValueError):
                philanthropy_score = None
        elif label == "self-made score":
            try:
                self_made_score = int(float(value))
            except (TypeError, ValueError):
                self_made_score = None

    return {
        "id": person.get("id", ""),
        "name": person.get("name", ""),
        "image": person.get("image", ""),
        "wealth": person.get("current_worth"),
        "worth_as_of": person.get("worth_as_of", ""),
        "rank": person.get("rank") or 0,
        "residence": residence,
        "state": state,
        "country": country,
        "industry": industry,
        "philanthropy_score": philanthropy_score,
        "self_made_score": self_made_score,
        "quote": person.get("quote", ""),
        "about": person.get("about") or [],
    }


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


@app.route("/api/billionaires/details/search")
def search_billionaire_details():
    return jsonify([normalize_explorer_person(person) for person in load_full_person_details()])


@app.route("/api/billionaires/details")
def list_billionaire_details():
    return jsonify([normalize_explorer_person(person) for person in load_full_person_details()])


@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_frontend_asset(path):
    asset_path = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(asset_path):
      return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")

if __name__ == "__main__":
    app.run(debug=True)
