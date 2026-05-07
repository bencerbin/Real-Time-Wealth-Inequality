from datetime import datetime
import json
import os
import time

from fetchbillionaires import fetch_billionaires
from fetchdetail import fetch_detail


BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "full_person_details.json")


def to_billions(value):
    try:
        return round(float(value) / 1_000_000_000, 1)
    except (TypeError, ValueError):
        return None


def current_date_label():
    now = datetime.now()
    return f"{now.strftime('%B')} {now.day}, {now.year}"


def normalize_history_entries(history):
    normalized = []

    for entry in history or []:
      worth = entry.get("worth")
      if worth is None:
          continue

      normalized.append({
          "date": entry.get("date", ""),
          "worth": round(float(worth), 1),
      })

    return normalized


def normalize_forbes_list(forbes_list):
    normalized = []

    for entry in forbes_list or []:
        if not isinstance(entry, dict):
            continue

        normalized.append({
            "rank": entry.get("rank", ""),
            "list": entry.get("list", ""),
        })

    return normalized


def normalize_personal_stats(personal_stats):
    normalized = []

    for entry in personal_stats or []:
        if not isinstance(entry, dict):
            continue

        normalized.append({
            "label": entry.get("label", ""),
            "value": entry.get("value", ""),
        })

    return normalized


def normalize_detail_record(person, detail_data):
    current_worth = to_billions(person.get("wealth"))
    previous_worth = current_worth

    if person.get("wealth") is not None:
        previous_worth = to_billions(person.get("wealth") - person.get("delta", 0))

    if isinstance(detail_data, dict):
        previous_worth = (
            to_billions(detail_data.get("previous_worth"))
            or previous_worth
        )
        current_worth = (
            to_billions(detail_data.get("current_worth"))
            or current_worth
        )

    image = ""
    about = []
    wealth_history = []
    forbes_list = []
    personal_stats = []
    did_you_know_facts = []
    quote = ""
    rank = 0

    if isinstance(detail_data, dict):
        image = detail_data.get("image") or detail_data.get("photo") or ""
        about_value = detail_data.get("about") or detail_data.get("bio") or detail_data.get("description")
        if isinstance(about_value, list):
            about = about_value
        elif isinstance(about_value, str) and about_value.strip():
            about = [about_value.strip()]

        wealth_history = normalize_history_entries(detail_data.get("wealth_history"))
        forbes_list = normalize_forbes_list(detail_data.get("forbes_list"))
        personal_stats = normalize_personal_stats(detail_data.get("personal_stats"))

        raw_facts = detail_data.get("did_you_know_facts") or []
        did_you_know_facts = [fact for fact in raw_facts if isinstance(fact, str) and fact.strip()]
        quote = detail_data.get("quote") or ""

        detail_rank = detail_data.get("rank")
        if isinstance(detail_rank, int):
            rank = detail_rank

    return {
        "id": person.get("id", ""),
        "name": person.get("name", ""),
        "current_worth": current_worth,
        "previous_worth": previous_worth,
        "image": image,
        "worth_as_of": current_date_label(),
        "rank": rank,
        "about": about,
        "wealth_history": wealth_history,
        "forbes_list": forbes_list,
        "personal_stats": personal_stats,
        "did_you_know_facts": did_you_know_facts,
        "quote": quote,
    }


def build_full_person_dataset(output_file=OUTPUT_FILE, sleep_seconds=1.0):
    people = fetch_billionaires()
    records = []

    for index, person in enumerate(people, start=1):
        detail_data = {}

        try:
            detail_data = fetch_detail(person["id"])
            print(f"[{index}/{len(people)}] fetched {person['name']}")
        except Exception as err:
            print(f"[{index}/{len(people)}] ERROR {person.get('name', person.get('id', 'unknown'))}: {err}")

        records.append(normalize_detail_record(person, detail_data))

        # Sleep after each request to stay under the API rate limit.
        if sleep_seconds:
            time.sleep(sleep_seconds)

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(records, f, indent=2)

    return records


if __name__ == "__main__":
    build_full_person_dataset()
