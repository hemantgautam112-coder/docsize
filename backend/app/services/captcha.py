"""Cloudflare Turnstile check. Stops scripts from requesting login codes in bulk.

Turnstile is free. The secret key stays on the server, and the public site key goes to the browser.
"""

import requests

from app.config import settings

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_captcha(token: str | None, client_ip: str) -> bool:
    if not settings.turnstile_secret_key:
        # Only reachable in development and tests, because production requires the secret key.
        return True
    if not token:
        return False
    try:
        response = requests.post(
            TURNSTILE_VERIFY_URL,
            data={"secret": settings.turnstile_secret_key, "response": token, "remoteip": client_ip},
            timeout=5,
        )
        return bool(response.json().get("success"))
    except (requests.RequestException, ValueError):
        return False
