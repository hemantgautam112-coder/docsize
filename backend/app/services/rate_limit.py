"""In-process sliding-window rate limiter.

Good enough for one server process. With several workers or servers, move this to a shared store
such as Redis. Behind a reverse proxy, the client IP must come from a trusted proxy header.
"""

from collections import deque
from threading import Lock
from time import monotonic


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        """Record a hit and return True, or return False without recording when the limit is reached."""
        now = monotonic()
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
