"""File storage adapters.

Callers address files only by opaque keys such as "originals/<32 hex>.jpg".
User-supplied names never become paths. Writes never overwrite an existing file.
"""

import hashlib
import re
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path

from app.config import settings

NAMESPACES = ("originals", "derived")
EXTENSIONS = ("jpg", "png", "pdf")
_KEY_PATTERN = re.compile(rf"^({'|'.join(NAMESPACES)})/[0-9a-f]{{32}}\.({'|'.join(EXTENSIONS)})$")


class StorageError(Exception):
    """Raised for invalid keys or namespaces. Never includes file contents."""


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class StorageProvider(ABC):
    @abstractmethod
    def save(self, data: bytes, *, namespace: str, extension: str) -> str:
        """Store bytes under a new random key and return that key. Never overwrites."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        """Return the stored bytes. Raises FileNotFoundError if the key is missing."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return True if the key is stored."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the key. Does nothing if it is already gone."""


class LocalStorage(StorageProvider):
    """Stores files under a local directory. Development default."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        if not _KEY_PATTERN.fullmatch(key):
            raise StorageError("Invalid storage key.")
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise StorageError("Invalid storage key.")
        return path

    def save(self, data: bytes, *, namespace: str, extension: str) -> str:
        if namespace not in NAMESPACES or extension not in EXTENSIONS:
            raise StorageError("Unsupported namespace or extension.")
        key = f"{namespace}/{uuid.uuid4().hex}.{extension}"
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Mode "xb" fails if the file already exists, so originals can never be overwritten.
        with path.open("xb") as fh:
            fh.write(data)
        return key

    def read(self, key: str) -> bytes:
        return self._path_for(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path_for(key).is_file()

    def delete(self, key: str) -> None:
        self._path_for(key).unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_storage() -> StorageProvider:
    if settings.storage_backend == "local":
        return LocalStorage(settings.storage_path)
    raise StorageError(f"Unknown storage backend: {settings.storage_backend}")
