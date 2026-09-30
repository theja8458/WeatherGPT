import httpx
import time
import json

def run_benchmark():
    client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=15.0)

    endpoints = [
        "/weather/current?place=Hyderabad",
        "/weather/forecast/hourly?place=Hyderabad&hours=48",
        "/weather/forecast/daily?place=Hyderabad&days=7",
        "/weather/air-quality?place=Hyderabad",
    ]

    print("=== 1. First Call (Live Provider Fetch & Cache Store) ===")
    for ep in endpoints:
        t0 = time.time()
        r = client.get(ep)
        elapsed = time.time() - t0
        data = r.json()
        print(f"[{r.status_code}] {ep}")
        print(f"     Time: {elapsed:.3f}s | Cached: {data.get('cached')} | Place: {data.get('place_name')}")

    print("\n=== 2. Second Call (Multi-tier Cache Hit Verification) ===")
    for ep in endpoints:
        t0 = time.time()
        r = client.get(ep)
        elapsed = time.time() - t0
        data = r.json()
        print(f"[{r.status_code}] {ep}")
        print(f"     Time: {elapsed:.4f}s | Cached: {data.get('cached')} | Place: {data.get('place_name')}")
        assert elapsed < 1.0, f"Cached request took too long ({elapsed}s >= 1s)"
        assert data.get('cached') is True, "Expected cached=True on second request"

    print("\n=== Sample Current Weather JSON ===")
    sample = client.get("/weather/current?place=Hyderabad").json()
    print(json.dumps(sample, indent=2))

if __name__ == "__main__":
    run_benchmark()
