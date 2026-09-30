import time
import asyncio
import logging
import threading
from enum import Enum
from typing import Callable, Any, Optional, Dict

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"        # Normal operation: requests pass through
    OPEN = "OPEN"            # Service failed repeatedly: requests fail-fast
    HALF_OPEN = "HALF_OPEN"  # Testing recovery: single trial call permitted


class CircuitBreakerOpenException(Exception):
    """Raised when an external service is unavailable and its circuit is OPEN."""
    def __init__(self, service_name: str, cooldown_remaining: float):
        super().__init__(
            f"Circuit breaker for '{service_name}' is OPEN. "
            f"External service is temporarily unavailable. Retry in {cooldown_remaining:.1f}s."
        )
        self.service_name = service_name
        self.cooldown_remaining = cooldown_remaining


class CircuitBreaker:
    """
    Thread-safe & async-compatible Circuit Breaker protecting external APIs
    from cascading failures and preventing repeated hammering of down services.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        cooldown_seconds: float = 30.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds

        self._lock = threading.Lock()
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time = 0.0
        self.total_trips = 0
        self.total_calls = 0
        self.total_failures = 0

    def _update_state(self) -> None:
        """Transitions from OPEN to HALF_OPEN if cooldown period has passed."""
        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self.last_failure_time
            if elapsed >= self.cooldown_seconds:
                self.state = CircuitState.HALF_OPEN
                logger.info(
                    f"CircuitBreaker [{self.name}]: Cooldown of {self.cooldown_seconds}s expired. "
                    f"State transitioned to HALF_OPEN (trial call)."
                )

    def can_execute(self) -> tuple[bool, float]:
        """Checks if a call is allowed through the circuit breaker."""
        with self._lock:
            self._update_state()
            if self.state == CircuitState.OPEN:
                remaining = max(0.0, self.cooldown_seconds - (time.time() - self.last_failure_time))
                return False, remaining
            return True, 0.0

    def record_success(self) -> None:
        """Records a successful API call, resetting failure counters."""
        with self._lock:
            self.total_calls += 1
            if self.state in [CircuitState.HALF_OPEN, CircuitState.OPEN]:
                logger.info(
                    f"CircuitBreaker [{self.name}]: Trial call succeeded. Resetting circuit to CLOSED."
                )
            self.state = CircuitState.CLOSED
            self.consecutive_failures = 0

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Records an API failure and trips to OPEN if threshold reached."""
        with self._lock:
            self.total_calls += 1
            self.total_failures += 1
            self.consecutive_failures += 1
            self.last_failure_time = time.time()

            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                self.total_trips += 1
                logger.warning(
                    f"CircuitBreaker [{self.name}]: Trial call failed ({error}). "
                    f"Circuit re-opened for {self.cooldown_seconds}s."
                )
            elif self.consecutive_failures >= self.failure_threshold and self.state != CircuitState.OPEN:
                self.state = CircuitState.OPEN
                self.total_trips += 1
                logger.error(
                    f"CircuitBreaker [{self.name}]: {self.consecutive_failures} consecutive failures reached ({error}). "
                    f"Circuit tripped to OPEN for {self.cooldown_seconds}s cooldown."
                )

    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """Executes an async callable protected by the circuit breaker."""
        can_run, remaining = self.can_execute()
        if not can_run:
            raise CircuitBreakerOpenException(self.name, remaining)

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as exc:
            self.record_failure(exc)
            raise

    def get_status(self) -> Dict[str, Any]:
        """Returns non-sensitive status of the circuit breaker."""
        with self._lock:
            self._update_state()
            return {
                "name": self.name,
                "state": self.state.value,
                "consecutive_failures": self.consecutive_failures,
                "total_calls": self.total_calls,
                "total_failures": self.total_failures,
                "total_trips": self.total_trips,
            }


# Pre-configured Circuit Breakers for external providers
open_meteo_circuit = CircuitBreaker("open-meteo", failure_threshold=5, cooldown_seconds=30.0)
gemini_circuit = CircuitBreaker("gemini-llm", failure_threshold=4, cooldown_seconds=30.0)
location_circuit = CircuitBreaker("geocoding-api", failure_threshold=5, cooldown_seconds=30.0)
