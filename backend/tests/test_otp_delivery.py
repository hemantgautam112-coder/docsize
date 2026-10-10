"""OTP delivery: email goes over SMTP when configured, mobile stays on the console."""

from app.config import settings
from app.services import otp as otp_module


class FakeSmtp:
    sent: list = []
    logins: list = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def starttls(self):
        self.tls = True

    def login(self, username, password):
        FakeSmtp.logins.append((username, password))

    def send_message(self, message):
        FakeSmtp.sent.append(message)


def _reset_fake():
    FakeSmtp.sent = []
    FakeSmtp.logins = []


def test_email_code_is_sent_over_smtp_when_configured(monkeypatch):
    _reset_fake()
    monkeypatch.setattr(otp_module.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_username", "sender@example.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr(settings, "smtp_from", "HDVault <sender@example.com>")

    otp_module.RoutingOtpProvider().send_code("student@example.com", "482913")

    assert len(FakeSmtp.sent) == 1
    message = FakeSmtp.sent[0]
    assert message["To"] == "student@example.com"
    assert "482913" in message.get_content()
    assert FakeSmtp.logins == [("sender@example.com", "app-password")]


def test_email_falls_back_to_console_when_smtp_not_configured(monkeypatch, capsys):
    _reset_fake()
    monkeypatch.setattr(otp_module.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(settings, "smtp_host", "")

    otp_module.RoutingOtpProvider().send_code("student@example.com", "111222")

    assert FakeSmtp.sent == []
    assert "111222" in capsys.readouterr().out


def test_mobile_code_stays_on_console_even_when_smtp_is_configured(monkeypatch, capsys):
    _reset_fake()
    monkeypatch.setattr(otp_module.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")

    otp_module.RoutingOtpProvider().send_code("9876543210", "333444")

    assert FakeSmtp.sent == []
    assert "333444" in capsys.readouterr().out
