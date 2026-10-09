"""Google Sign-In. Verifies the ID token that Google Identity Services gives the browser.

The check runs on the server: signature, expiry, and that the token was issued for our client ID.
The browser's claim that someone is signed in is never trusted on its own.
"""

from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings


class GoogleNotConfiguredError(Exception):
    pass


class GoogleAuthError(Exception):
    """A user-facing failure. The message is safe to show."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str  # Google's permanent ID for the account
    email: str


def verify_google_credential(credential: str) -> GoogleIdentity:
    if not settings.google_client_id:
        raise GoogleNotConfiguredError("Google sign-in is not configured on this server.")
    try:
        claims = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)
    except ValueError as exc:
        raise GoogleAuthError("Google sign-in could not be verified. Please try again.") from exc

    if not claims.get("email_verified"):
        raise GoogleAuthError("This Google account's email address is not verified.")
    return GoogleIdentity(sub=claims["sub"], email=claims["email"].lower())
