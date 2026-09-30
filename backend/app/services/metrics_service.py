import time
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List


class MetricsService:
    def __init__(self):
        self._lock = threading.Lock()
        self.start_time = time.time()
        self.started_at = datetime.now(timezone.utc).isoformat()

        self.total_requests = 0
        self.total_latency_ms = 0.0

        self.cache_hits = 0
        self.cache_misses = 0

        # High-level breakdowns
        self.status_codes: Dict[int, int] = {}
        self.methods: Dict[str, int] = {}
        self.recent_latencies: List[float] = []

    def record_request(self, method: str, path: str, status_code: int, latency_ms: float):
        """Thread-safe fast recording of an HTTP request latency and status."""
        with self._lock:
            self.total_requests += 1
            self.total_latency_ms += latency_ms

            self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1
            method_upper = method.upper()
            self.methods[method_upper] = self.methods.get(method_upper, 0) + 1

            self.recent_latencies.append(latency_ms)
            if len(self.recent_latencies) > 200:
                self.recent_latencies.pop(0)

    def record_cache_hit(self):
        """Records a successful cache lookup (Level 1 in-memory or Level 2 DB cache)."""
        with self._lock:
            self.cache_hits += 1

    def record_cache_miss(self):
        """Records a cache miss requiring external API retrieval."""
        with self._lock:
            self.cache_misses += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Returns non-sensitive performance, latency, uptime, and cache statistics."""
        with self._lock:
            uptime_sec = round(time.time() - self.start_time, 2)
            avg_latency = (
                round(self.total_latency_ms / self.total_requests, 2)
                if self.total_requests > 0
                else 0.0
            )

            total_cache_ops = self.cache_hits + self.cache_misses
            hit_rate = (
                round((self.cache_hits / total_cache_ops) * 100, 2)
                if total_cache_ops > 0
                else 0.0
            )

            p95_latency = 0.0
            if self.recent_latencies:
                sorted_lats = sorted(self.recent_latencies)
                idx = int(len(sorted_lats) * 0.95)
                p95_latency = round(sorted_lats[min(idx, len(sorted_lats) - 1)], 2)

            return {
                "uptime": uptime_sec,
                "uptime_seconds": uptime_sec,
                "started_at": self.started_at,
                "total_requests": self.total_requests,
                "average_latency_ms": avg_latency,
                "average_latency": avg_latency,
                "p95_latency_ms": p95_latency,
                "cache_hits": self.cache_hits,
                "cache_misses": self.cache_misses,
                "cache_hit_rate": hit_rate,
                "cache_hit_rate_pct": f"{hit_rate}%",
                "status_breakdown": dict(self.status_codes),
                "methods_breakdown": dict(self.methods),
            }


metrics_service = MetricsService()
