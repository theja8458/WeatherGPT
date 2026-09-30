from fastapi.testclient import TestClient
from app.main import app
import json

def test_locations_resolution():
    client = TestClient(app)

    test_queries = ["Kurnool", "Vizag", "Chennai"]
    print("=== Testing Location Search & Resolution ===")

    for query in test_queries:
        r = client.get(f"/api/v1/locations/search?q={query}")
        assert r.status_code == 200, f"Failed search for {query}: {r.status_code}"
        data = r.json()
        results = data.get("results", [])
        assert len(results) > 0, f"No results found for {query}"
        top = results[0]
        print(f"Query: '{query}' -> Resolved to: {top['name']}, {top['state']} (lat: {top['lat']}, lon: {top['lon']}) [score: {top['score']}]")

        # Specific assertions
        if query == "Kurnool":
            assert "Kurnool" in top["name"]
            assert "Andhra Pradesh" in top["state"]
        elif query == "Vizag":
            assert "Visakhapatnam" in top["name"]
            assert "Andhra Pradesh" in top["state"]
        elif query == "Chennai":
            assert "Chennai" in top["name"]
            assert "Tamil Nadu" in top["state"]

    print("\n=== Testing Reverse Geocoding ===")
    # Coordinates of Kurnool
    r_rev1 = client.get("/api/v1/locations/reverse?lat=15.8281&lon=78.0373")
    assert r_rev1.status_code == 200
    rev1 = r_rev1.json()
    print(f"(15.8281, 78.0373) -> Reverse geocoded: {rev1['name']}, {rev1['state']} [Source: {rev1['source']}]")
    assert "Kurnool" in rev1["name"]

    # Coordinates of Chennai
    r_rev2 = client.get("/api/v1/locations/reverse?lat=13.0827&lon=80.2707")
    assert r_rev2.status_code == 200
    rev2 = r_rev2.json()
    print(f"(13.0827, 80.2707) -> Reverse geocoded: {rev2['name']}, {rev2['state']} [Source: {rev2['source']}]")
    assert "Chennai" in rev2["name"]

    print("\n[SUCCESS] All Prompt 4 location resolution tests passed!")

if __name__ == "__main__":
    test_locations_resolution()
