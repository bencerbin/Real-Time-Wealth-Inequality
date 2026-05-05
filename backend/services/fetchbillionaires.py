import http.client
import json

def fetch_billionaires():
    conn = http.client.HTTPSConnection("forbes-billionaires-api.p.rapidapi.com")

    headers = {
        'x-rapidapi-key': "6cb3dfb09amsh40083cbf6aca36dp16924cjsn428a1429dedc",
        'x-rapidapi-host': "forbes-billionaires-api.p.rapidapi.com",
    }

    conn.request("GET", "/list.php", headers=headers)
    res = conn.getresponse()
    data = res.read()

    parsed = json.loads(data.decode("utf-8"))
    people = parsed["ranking"]

    cleaned = []
    for p in people:
        try:
            cleaned.append({
                "name": p["name"],
                "wealth": float(p["current_worth"]) * 1_000_000_000,
                "rank": int(p["rank"]),
                "delta": (float(p["current_worth"]) - float(p["previous_worth"])) * 1_000_000_000,
                "country": p.get("country"),
                "id": p["id"]
            })
        except:
            continue

    return cleaned