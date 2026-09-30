import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.services.metrics_service import MetricsService, metrics_service


def test_metrics_service_unit():
    service = MetricsService()
    assert service.total_requests == 0
    assert service.cache_hits == 0
    assert service.cache_misses == 0
    assert service.get_metrics()["average_latency_ms"] == 0.0

    # Record requests
    service.record_request("GET", "/api/v1/health", 200, 10.5)
    service.record_request("GET", "/api/v1/weather/current", 200, 25.5)

    # Record cache hits & misses
    service.record_cache_hit()
    service.record_cache_hit()
    service.record_cache_miss()

    metrics = service.get_metrics()
    assert metrics["total_requests"] == 2
    assert metrics["average_latency_ms"] == 18.0
    assert metrics["cache_hits"] == 2
    assert metrics["cache_misses"] == 1
    assert round(metrics["cache_hit_rate"], 2) == 66.67
    assert metrics["status_breakdown"].get(200) == 2
    assert metrics["methods_breakdown"].get("GET") == 2
    assert metrics["uptime"] >= 0.0


def test_metrics_endpoint_and_middleware():
    client = TestClient(app)

    # Make initial requests
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert "x-response-time-ms" in [k.lower() for k in r1.headers.keys()]

    # Call /api/v1/metrics
    resp = client.get("/api/v1/metrics")
    assert resp.status_code == 200
    data = resp.json()

    assert "uptime" in data
    assert "total_requests" in data
    assert data["total_requests"] >= 1
    assert "average_latency" in data
    assert "cache_hits" in data
    assert "cache_misses" in data
    assert "cache_hit_rate" in data

    # Root /metrics check
    resp_root = client.get("/metrics")
    assert resp_root.status_code == 200
    data_root = resp_root.json()
    assert data_root["total_requests"] >= 1


if __name__ == "__main__":
    test_metrics_service_unit()
    test_metrics_endpoint_and_middleware()
    print("[SUCCESS] All metrics service & middleware tests passed!")
