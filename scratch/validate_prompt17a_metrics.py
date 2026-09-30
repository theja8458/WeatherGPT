import time
import json
import httpx

def validate_metrics():
    print("Waiting 3 seconds for backend server to stabilize...")
    time.sleep(3)

    base_url = "http://127.0.0.1:8000"
    client = httpx.Client(base_url=base_url, timeout=15.0)

    print("\n--- 1. Making Initial API Requests ---")
    
    # Request 1: Health check
    r1 = client.get("/health")
    assert r1.status_code == 200, f"Health check failed: {r1.status_code}"
    lat_hdr1 = r1.headers.get("X-Response-Time-Ms")
    print(f"GET /health: {r1.status_code} | X-Response-Time-Ms: {lat_hdr1}ms")
    assert lat_hdr1 is not None, "Missing X-Response-Time-Ms header"

    # Request 2: Location search
    r2 = client.get("/api/v1/locations/search?q=Hyderabad")
    assert r2.status_code == 200, f"Location search failed: {r2.status_code}"
    lat_hdr2 = r2.headers.get("X-Response-Time-Ms")
    print(f"GET /api/v1/locations/search: {r2.status_code} | X-Response-Time-Ms: {lat_hdr2}ms")

    # Request 3: Weather current (Cache Miss / fresh fetch)
    r3 = client.get("/api/v1/weather/current?lat=17.385&lon=78.4867&place_name=Hyderabad")
    assert r3.status_code == 200, f"Weather current failed: {r3.status_code}"
    lat_hdr3 = r3.headers.get("X-Response-Time-Ms")
    data3 = r3.json()
    print(f"GET /api/v1/weather/current (fetch): {r3.status_code} | X-Response-Time-Ms: {lat_hdr3}ms | cached: {data3.get('cached')}")

    # Request 4: Weather current repeat (Cache Hit)
    r4 = client.get("/api/v1/weather/current?lat=17.385&lon=78.4867&place_name=Hyderabad")
    assert r4.status_code == 200, f"Weather current repeat failed: {r4.status_code}"
    lat_hdr4 = r4.headers.get("X-Response-Time-Ms")
    data4 = r4.json()
    print(f"GET /api/v1/weather/current (cache): {r4.status_code} | X-Response-Time-Ms: {lat_hdr4}ms | cached: {data4.get('cached')}")
    assert data4.get("cached") is True, "Expected cached=True on repeated weather call"

    print("\n--- 2. Fetching /api/v1/metrics ---")
    r_metrics = client.get("/api/v1/metrics")
    assert r_metrics.status_code == 200, f"Metrics endpoint failed: {r_metrics.status_code}"
    metrics_data = r_metrics.json()

    print("\n=== METRICS RESPONSE JSON ===")
    print(json.dumps(metrics_data, indent=2))

    print("\n--- 3. Verifying Prompt 17A Assertions ---")
    # Verify request count increases
    assert metrics_data["total_requests"] >= 4, f"total_requests too low: {metrics_data['total_requests']}"
    print(f"[PASS] Total requests tracked: {metrics_data['total_requests']}")

    # Verify latency is recorded and calculated
    assert metrics_data["average_latency_ms"] > 0, "average_latency_ms should be > 0"
    print(f"[PASS] Average latency: {metrics_data['average_latency_ms']} ms")

    # Verify cache hits and misses returned
    assert metrics_data["cache_hits"] >= 1, f"cache_hits should be >= 1, got {metrics_data['cache_hits']}"
    print(f"[PASS] Cache hits: {metrics_data['cache_hits']}")
    assert metrics_data["cache_misses"] >= 1, f"cache_misses should be >= 1, got {metrics_data['cache_misses']}"
    print(f"[PASS] Cache misses: {metrics_data['cache_misses']}")

    # Verify cache hit rate calculated
    assert 0 <= metrics_data["cache_hit_rate"] <= 100, "cache_hit_rate should be percentage"
    print(f"[PASS] Cache hit rate: {metrics_data['cache_hit_rate']}% ({metrics_data.get('cache_hit_rate_pct')})")

    # Verify uptime recorded
    assert metrics_data["uptime"] >= 0, "uptime should be non-negative"
    print(f"[PASS] Uptime: {metrics_data['uptime']} seconds")

    # Also test root /metrics
    r_root_metrics = client.get("/metrics")
    assert r_root_metrics.status_code == 200, "Root /metrics failed"
    print(f"[PASS] Root /metrics accessible: {r_root_metrics.status_code}")

    print("\n[SUCCESS] PROMPT 17A Performance Monitoring and Metrics VALIDATED SUCCESSFULLY!")

if __name__ == "__main__":
    validate_metrics()
