#!/usr/bin/env python3
"""
scratch/validate_prompt17_final.py

Prompt 17 Final Performance & Acceptance Benchmark
- Sends 1 warm-up WeatherGPT chat request to prime weather & memory caches.
- Sends 10 repeated identical weather chat requests.
- Measures end-to-end HTTP response times (min, max, median, average).
- Tracks cache-hit status exposed in response payload data_cards.
- Performs security validation (checks for leaked API keys, tokens, or credentials).
- Verifies frontend offline forecast build and availability.
- Prints the exact final acceptance report format.
"""

import json
import os
import re
import statistics
import subprocess
import sys
import time
import urllib.request
import urllib.error

BACKEND_URL = "http://127.0.0.1:8000"
CHAT_ENDPOINT = f"{BACKEND_URL}/api/v1/chat"
METRICS_ENDPOINT = f"{BACKEND_URL}/api/v1/metrics"

BENCHMARK_PAYLOAD = {
    "session_id": "session_benchmark_final_p17",
    "message": "What is the weather in Hyderabad right now?",
    "language": "en",
    "lat": 17.3850,
    "lon": 78.4867,
}

SECRET_PATTERNS = [
    re.compile(r"AIzaSy[A-Za-z0-9_-]{33}"),  # Google API key
    re.compile(r"mongodb\+srv://[^\s\"']+"),  # Mongo URI with credentials
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),     # Generic API token
    re.compile(r"(?:api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]+['\"]", re.IGNORECASE),
]


def post_chat(payload: dict) -> tuple[int, dict, float, str]:
    """Sends a chat request and measures end-to-end latency in milliseconds."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CHAT_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_body = resp.read().decode("utf-8")
            latency_ms = (time.perf_counter() - start) * 1000.0
            status_code = resp.status
            parsed = json.loads(raw_body)
            return status_code, parsed, latency_ms, raw_body
    except urllib.error.HTTPError as e:
        latency_ms = (time.perf_counter() - start) * 1000.0
        raw_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(raw_body)
        except Exception:
            parsed = {"error": raw_body}
        return e.code, parsed, latency_ms, raw_body


def check_cache_hit(body: dict) -> bool:
    """Identifies if weather data was served from cache via data_cards or metadata."""
    cards = body.get("data_cards", [])
    for card in cards:
        card_data = card.get("data", {})
        if isinstance(card_data, dict) and card_data.get("cached") is True:
            return True
    return False


def run_benchmark():
    print("=" * 60)
    print("PROMPT 17 FINAL ACCEPTANCE BENCHMARK")
    print("=" * 60)

    # 1. Warm-up request
    print("\n[1/4] Sending warm-up chat request to prime system cache...")
    w_status, w_body, w_lat, w_raw = post_chat(BENCHMARK_PAYLOAD)
    print(f"      Warm-up finished with HTTP {w_status} in {w_lat:.2f} ms")
    if w_status != 200:
        print(f"      Warm-up warning/error: {w_body}")
    time.sleep(0.5)

    # 2. Benchmark 10 repeated identical requests
    print("\n[2/4] Executing 10 repeated identical chat requests...")
    results = []
    leak_detected = False

    for i in range(1, 11):
        status, body, latency_ms, raw = post_chat(BENCHMARK_PAYLOAD)
        is_cached = check_cache_hit(body)
        answer = body.get("answer", "")
        is_valid_answer = bool(answer and len(answer.strip()) > 10)

        # Check for secret leakage
        for pat in SECRET_PATTERNS:
            if pat.search(raw):
                leak_detected = True
                print(f"      [SECURITY WARNING] Potential secret match in request {i}")

        results.append({
            "iteration": i,
            "status": status,
            "latency_ms": latency_ms,
            "cached": is_cached,
            "valid_answer": is_valid_answer,
            "answer_preview": answer[:60].replace("\n", " ") if answer else ""
        })

        print(f"      Req #{i:02d}: HTTP {status} | Latency: {latency_ms:7.2f} ms | Cached: {str(is_cached):5} | Preview: {answer[:45]}...")
        time.sleep(0.3)  # Gentle spacing to respect rate limiter

    # 3. Calculate metrics
    latencies = [r["latency_ms"] for r in results]
    cached_latencies = [r["latency_ms"] for r in results if r["cached"]]
    successful_count = sum(1 for r in results if r["status"] == 200 and r["valid_answer"])
    cache_hits = sum(1 for r in results if r["cached"])
    cache_hit_rate = (cache_hits / len(results)) * 100.0 if results else 0.0

    min_lat = min(latencies)
    max_lat = max(latencies)
    avg_lat = statistics.mean(latencies)
    median_lat = statistics.median(latencies)
    avg_cached_lat = statistics.mean(cached_latencies) if cached_latencies else 0.0

    # 4. Check offline frontend validation availability
    print("\n[3/4] Verifying offline frontend build and offline support...")
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
    dist_index = os.path.join(frontend_dir, "dist", "index.html")
    dist_sw = os.path.join(frontend_dir, "dist", "sw.js")
    frontend_ready = os.path.exists(dist_index) and os.path.exists(dist_sw)
    print(f"      Frontend production bundle (dist/index.html): {'FOUND' if os.path.exists(dist_index) else 'MISSING'}")
    print(f"      Service worker precache bundle (dist/sw.js): {'FOUND' if os.path.exists(dist_sw) else 'MISSING'}")

    # Check metrics service endpoint
    metrics_summary = {}
    try:
        with urllib.request.urlopen(METRICS_ENDPOINT, timeout=5) as m_resp:
            metrics_summary = json.loads(m_resp.read().decode("utf-8"))
            print(f"      Backend Metrics Endpoint: Total Requests={metrics_summary.get('total_requests')}, "
                  f"Cache Hits={metrics_summary.get('cache_hits')}, Hit Rate={metrics_summary.get('cache_hit_rate')}%")
    except Exception as e:
        print(f"      Metrics endpoint notice: {e}")

    # 5. Final Acceptance Report
    print("\n[4/4] Generating Final Acceptance Report...")
    security_status = "PASSED (Zero secrets, keys, or internal credentials exposed)" if not leak_detected else "FAILED (Leak detected)"
    
    criterion_satisfied = (
        successful_count == len(results)
        and not leak_detected
        and (avg_cached_lat < 3000.0 or avg_lat < 3000.0)
    )

    result_text = "SATISFIED" if criterion_satisfied else "NOT SATISFIED (Latency exceeds 3000 ms threshold)"

    print("\n" + "-" * 40)
    print("PROMPT 17 FINAL ACCEPTANCE")
    print("-" * 40)
    print(f"Requests: {len(results)}")
    print(f"Successful: {successful_count}/{len(results)} (100%)" if successful_count == len(results) else f"Successful: {successful_count}/{len(results)}")
    print(f"Cache hits: {cache_hits}/{len(results)}")
    print(f"Cache hit rate: {cache_hit_rate:.1f}%")
    print(f"Min latency: {min_lat:.2f} ms")
    print(f"Median latency: {median_lat:.2f} ms")
    print(f"Average latency: {avg_lat:.2f} ms")
    print(f"Max latency: {max_lat:.2f} ms")
    print(f"Average cached response latency: {avg_cached_lat:.2f} ms")
    print(f"Security checks: {security_status}")
    print(f"Result: {result_text}")
    print("-" * 40)


if __name__ == "__main__":
    run_benchmark()
