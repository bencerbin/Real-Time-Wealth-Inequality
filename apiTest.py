import http.client
import json

conn = http.client.HTTPSConnection("forbes-billionaires-api.p.rapidapi.com")

headers = {
    'x-rapidapi-key': "6cb3dfb09amsh40083cbf6aca36dp16924cjsn428a1429dedc",
    'x-rapidapi-host': "forbes-billionaires-api.p.rapidapi.com",
    'Content-Type': "application/json"
}

conn.request("GET", "/list.php", headers=headers)

res = conn.getresponse()
data = res.read()

# --- PARSE JSON ---
parsed = json.loads(data.decode("utf-8"))

# --- DEBUG STRUCTURE ---
print("Type:", type(parsed))

if isinstance(parsed, dict):
    print("Keys:", parsed.keys())

# --- FIND THE LIST ---
if isinstance(parsed, list):
    people = parsed
elif isinstance(parsed, dict):
    people = None
    for key, value in parsed.items():
        if isinstance(value, list):
            print("Using key:", key)
            people = value
            break
    
    if people is None:
        raise Exception("No list found in response")
else:
    raise Exception("Unexpected format")

print(f"Found {len(people)} people")

# --- PRINT SAMPLE ---
for person in people[:3]:
    print(person)