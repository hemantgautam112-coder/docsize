"""Shared test setup.

Environment variables are set before the app is imported, so every test run uses a fresh temporary
database and storage folder, never the developer's storage/ directory.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="hdvault-test-"))
os.environ.update(
    {
        "APP_ENV": "test",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-0123456789",
        "DATABASE_URL": f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}",
        "STORAGE_DIR": str(_TMP_DIR / "storage"),
        "ADMIN_EMAILS": "admin@example.com",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.otp import get_otp_provider, normalize_identifier  # noqa: E402
from app.services.rate_limit import limiter  # noqa: E402
from tests.helpers import make_image_pdf, make_photo_bytes  # noqa: E402


class CapturingOtpProvider:
    """Records codes instead of printing them, so tests can log in."""

    def __init__(self) -> None:
        self.codes: dict[str, str] = {}

    def send_code(self, identifier: str, code: str) -> None:
        self.codes[identifier] = code


class ApiUser:
    """An API client with its own cookie jar. It can be signed in or not yet signed in."""

    def __init__(self, identifier: str, sink: CapturingOtpProvider) -> None:
        self.identifier = identifier
        self.sink = sink
        self.client = TestClient(app)
        self.csrf = self.client.get("/auth/csrf").json()["csrf_token"]

    @property
    def headers(self) -> dict:
        return {"X-CSRF-Token": self.csrf}

    def request_code(self, purpose: str = "signup", consent: bool = True):
        return self.client.post(
            "/auth/request-otp",
            json={"identifier": self.identifier, "purpose": purpose, "consent": consent},
            headers=self.headers,
        )

    def verify(self, code: str | None = None, consent: bool = True, purpose: str = "signup"):
        code = code or self.sink.codes[normalize_identifier(self.identifier)]
        return self.client.post(
            "/auth/verify-otp",
            json={"identifier": self.identifier, "code": code, "consent": consent, "purpose": purpose},
            headers=self.headers,
        )

    def sign_in(self, purpose: str = "signup") -> dict:
        assert self.request_code(purpose).status_code == 202
        response = self.verify(purpose=purpose)
        assert response.status_code == 200, response.text
        return response.json()

    def upload(self, filename: str, data: bytes, document_type: str = "photo", content_type: str = "application/octet-stream"):
        return self.client.post(
            "/documents",
            files={"file": (filename, data, content_type)},
            data={"document_type": document_type},
            headers=self.headers,
        )

    def process(self, document_id: str, body: dict):
        return self.client.post(f"/documents/{document_id}/process", json=body, headers=self.headers)


@pytest.fixture(autouse=True)
def fresh_state():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    limiter.reset()
    yield


@pytest.fixture
def otp_sink():
    sink = CapturingOtpProvider()
    app.dependency_overrides[get_otp_provider] = lambda: sink
    yield sink
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(otp_sink):
    def _make(identifier: str = "9876543210") -> ApiUser:
        return ApiUser(identifier, otp_sink)

    return _make


@pytest.fixture
def admin(make_user) -> ApiUser:
    user = make_user("admin@example.com")
    user.sign_in()
    return user


@pytest.fixture
def create_profile(admin):
    def _create(**overrides) -> dict:
        body = {
            "exam_name": "SSC CGL",
            "post": None,
            "document_type": "photo",
            "max_kb": 20,
            "min_kb": 4,
            "output_format": "jpeg",
            "width_px": 200,
            "height_px": 230,
            "dpi": None,
            "background": "white",
            "notes": "Placeholder for tests.",
            "source_url": None,
            "last_verified_on": None,
            "is_placeholder": True,
        }
        body.update(overrides)
        response = admin.client.post("/profiles", json=body, headers=admin.headers)
        assert response.status_code == 201, response.text
        return response.json()

    return _create


@pytest.fixture(scope="session")
def photo_bytes() -> bytes:
    return make_photo_bytes()


@pytest.fixture(scope="session")
def pdf_bytes() -> bytes:
    return make_image_pdf()
