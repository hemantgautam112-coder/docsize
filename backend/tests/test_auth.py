"""Authentication: OTP login, consent, lockout, CSRF, sessions, and account deletion."""

from datetime import timedelta

from app.db import SessionLocal
from app.models import OtpCode, OriginalDocument, User
from app.services.storage import get_storage
from app.services.otp import normalize_identifier
from app.db import utcnow
from tests.helpers import make_photo_bytes


def test_new_user_signs_up_with_otp_and_gets_session_cookie(make_user):
    user = make_user("9876543210")

    assert user.request_code().status_code == 202
    response = user.verify(consent=True)

    assert response.status_code == 200
    body = response.json()
    assert body["mobile"] == "9876543210"
    assert body["is_admin"] is False
    assert "docsize_session" in response.cookies or "docsize_session" in user.client.cookies
    assert user.client.get("/auth/me").status_code == 200


def test_new_account_requires_consent(make_user):
    user = make_user("9876543211")
    user.request_code()

    response = user.verify(consent=False)

    assert response.status_code == 400
    assert "privacy policy" in response.json()["detail"]


def test_wrong_codes_lock_out_the_correct_code(make_user, otp_sink):
    user = make_user("9876543212")
    user.request_code()
    correct = otp_sink.codes[normalize_identifier(user.identifier)]
    wrong = "000000" if correct != "000000" else "111111"

    for _ in range(3):
        assert user.verify(code=wrong).status_code == 400

    assert user.verify(code=correct).status_code == 400


def test_expired_code_is_rejected(make_user):
    user = make_user("9876543213")
    user.request_code()
    with SessionLocal() as db:
        for otp in db.query(OtpCode).all():
            otp.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()

    assert user.verify().status_code == 400


def test_mutating_request_without_csrf_header_is_rejected(make_user):
    user = make_user("9876543214")

    response = user.client.post("/auth/request-otp", json={"identifier": user.identifier})

    assert response.status_code == 403


def test_mutating_request_with_wrong_csrf_token_is_rejected(make_user):
    user = make_user("9876543215")

    response = user.client.post(
        "/auth/request-otp",
        json={"identifier": user.identifier},
        headers={"X-CSRF-Token": "not-the-cookie-value"},
    )

    assert response.status_code == 403


def test_me_requires_login(make_user):
    user = make_user("9876543216")

    assert user.client.get("/auth/me").status_code == 401


def test_logout_ends_the_session(make_user):
    user = make_user("9876543217")
    user.sign_in()

    assert user.client.post("/auth/logout", headers=user.headers).status_code == 200
    assert user.client.get("/auth/me").status_code == 401


def test_invalid_identifier_is_rejected_with_plain_message(make_user):
    user = make_user("12345")

    response = user.request_code()

    assert response.status_code == 422
    assert "10-digit mobile number" in response.json()["detail"]


def test_account_deletion_removes_rows_and_stored_files(make_user):
    user = make_user("9876543218")
    user.sign_in()
    upload = user.upload("photo.jpg", make_photo_bytes(300, 400), "photo", "image/jpeg")
    assert upload.status_code == 201
    document_id = upload.json()["id"]
    process = user.process(document_id, {"target_kb": 50})
    assert process.status_code == 201
    derived_key = _derived_key(process.json()["id"])
    original_key = _original_key(document_id)

    response = user.client.delete("/auth/account", headers=user.headers)

    assert response.status_code == 204
    storage = get_storage()
    assert not storage.exists(original_key)
    assert not storage.exists(derived_key)
    with SessionLocal() as db:
        assert db.query(User).filter(User.mobile == "9876543218").count() == 0
        assert db.query(OriginalDocument).filter(OriginalDocument.id == document_id).count() == 0


def _original_key(document_id: str) -> str:
    with SessionLocal() as db:
        return db.get(OriginalDocument, document_id).storage_key


def _derived_key(derived_id: str) -> str:
    from app.models import DerivedFile

    with SessionLocal() as db:
        return db.get(DerivedFile, derived_id).storage_key


def test_login_for_unknown_account_says_to_sign_up(make_user):
    user = make_user("9876500001")

    response = user.request_code(purpose="login")

    assert response.status_code == 404
    assert "Sign up first" in response.json()["detail"]


def test_signup_for_existing_account_says_to_log_in(make_user):
    user = make_user("9876500002")
    user.sign_in()

    response = user.request_code(purpose="signup")

    assert response.status_code == 409
    assert "Log in instead" in response.json()["detail"]


def test_existing_user_can_log_in_with_a_new_session(make_user):
    user = make_user("9876500003")
    user.sign_in()
    returning = make_user("9876500003")

    assert returning.request_code(purpose="login").status_code == 202
    response = returning.verify(consent=False, purpose="login")

    assert response.status_code == 200
    assert returning.client.get("/auth/me").json()["mobile"] == "9876500003"


def test_login_never_creates_an_account(make_user):
    user = make_user("9876500004")
    user.request_code(purpose="signup")
    response = user.verify(consent=True, purpose="login")

    assert response.status_code == 404
    with SessionLocal() as db:
        assert db.query(User).filter(User.mobile == "9876500004").count() == 0


def test_google_sign_in_is_unavailable_until_client_id_is_configured(make_user):
    user = make_user("9876500005")

    response = user.client.post(
        "/auth/google",
        json={"credential": "x" * 40, "purpose": "login"},
        headers=user.headers,
    )

    assert response.status_code == 503


def test_google_signup_creates_account_and_login_reuses_it(make_user, monkeypatch):
    from app.api import auth as auth_api
    from app.services.google_auth import GoogleIdentity

    monkeypatch.setattr(
        auth_api, "verify_google_credential",
        lambda credential: GoogleIdentity(sub="google-sub-1", email="student@gmail.com"),
    )
    user = make_user("unused")

    signup = user.client.post(
        "/auth/google", json={"credential": "x" * 40, "purpose": "signup", "consent": True}, headers=user.headers
    )
    assert signup.status_code == 200
    assert signup.json()["email"] == "student@gmail.com"

    again = make_user("unused")
    login = again.client.post(
        "/auth/google", json={"credential": "x" * 40, "purpose": "login"}, headers=again.headers
    )
    assert login.status_code == 200
    assert login.json()["id"] == signup.json()["id"]


def test_google_signup_needs_consent(make_user, monkeypatch):
    from app.api import auth as auth_api
    from app.services.google_auth import GoogleIdentity

    monkeypatch.setattr(
        auth_api, "verify_google_credential",
        lambda credential: GoogleIdentity(sub="google-sub-2", email="nocons@gmail.com"),
    )
    user = make_user("unused")

    response = user.client.post(
        "/auth/google", json={"credential": "x" * 40, "purpose": "signup", "consent": False}, headers=user.headers
    )

    assert response.status_code == 400
