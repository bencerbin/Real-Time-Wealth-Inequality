import http.client
import json

def fetch_detail(person_id):
    conn = http.client.HTTPSConnection("forbes-billionaires-api.p.rapidapi.com")

    headers = {
        'x-rapidapi-key': "6cb3dfb09amsh40083cbf6aca36dp16924cjsn428a1429dedc",
        'x-rapidapi-host': "forbes-billionaires-api.p.rapidapi.com"
    }

    endpoint = f"/detail.php?id={person_id}"

    conn.request("GET", endpoint, headers=headers)
    res = conn.getresponse()
    data = res.read()

    return json.loads(data.decode("utf-8"))