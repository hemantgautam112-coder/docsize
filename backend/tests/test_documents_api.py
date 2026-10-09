"""Documents: upload validation, immutability of originals, processing, downloads, and retention."""

import hashlib
from datetime import timedelta
from io import BytesIO

from pypdf import PdfReader, PdfWriter

from app.db import SessionLocal, utcnow
from app.models import DerivedFile
from app.services.derived import purge_expired_derived
from app.services.storage import get_storage
from tests.helpers import make_photo_bytes, make_text_pdf


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def test_upload_reports_size_dimensions_and_hash(make_user, photo_bytes):
    user = make_user("9100000001")
    user.sign_in()

    response = user.upload("photo.jpg", photo_bytes, "photo", "image/jpeg")

    assert response.status_code == 201
    body = response.json()
    assert body["size_bytes"] == len(photo_bytes)
    assert body["sha256"] == _sha(photo_bytes)
    assert (body["width_px"], body["height_px"]) == (900, 1100)
    assert body["mime_type"] == "image/jpeg"


def test_renamed_file_is_rejected_by_magic_bytes(make_user):
    user = make_user("9100000002")
    user.sign_in()

    response = user.upload("photo.jpg", b"this is plain text, not a picture", "photo", "image/jpeg")

    assert response.status_code == 415


def test_oversize_upload_is_rejected(make_user):
    user = make_user("9100000003")
    user.sign_in()
    too_big = b"\xff\xd8\xff" + b"0" * (10 * 1024 * 1024)

    response = user.upload("big.jpg", too_big, "photo", "image/jpeg")

    assert response.status_code == 413


def test_password_protected_pdf_is_rejected(make_user):
    user = make_user("9100000004")
    user.sign_in()
    writer = PdfWriter(clone_from=PdfReader(BytesIO(make_text_pdf(1))))
    writer.encrypt("secret")
    out = BytesIO()
    writer.write(out)

    response = user.upload("marksheet.pdf", out.getvalue(), "marksheet_10", "application/pdf")

    assert response.status_code == 415
    assert "Password-protected" in response.json()["detail"]


def test_original_hash_is_unchanged_after_processing(make_user, photo_bytes):
    user = make_user("9100000005")
    user.sign_in()
    document = user.upload("photo.jpg", photo_bytes, "photo", "image/jpeg").json()

    process = user.process(document["id"], {"target_kb": 60, "width": 3.5, "height": 4.5, "unit": "cm", "dpi": 200})
    assert process.status_code == 201

    download = user.client.get(f"/documents/{document['id']}/file", headers=user.headers)
    assert download.status_code == 200
    assert _sha(download.content) == document["sha256"]
    assert _sha(get_storage().read(_stored_key(document["id"]))) == document["sha256"]


def test_exam_profile_mode_with_override_and_download_name(make_user, create_profile, photo_bytes):
    profile = create_profile(exam_name="SSC CGL", document_type="photo", max_kb=20, min_kb=4)
    user = make_user("9100000006")
    user.sign_in()
    document = user.upload("me.jpg", photo_bytes, "photo", "image/jpeg").json()

    process = user.process(document["id"], {"profile_id": profile["id"]})

    assert process.status_code == 201
    body = process.json()
    assert body["download_name"] == "photo_SSC_CGL_20KB.jpg"
    assert body["parameters"]["mode"] == "exam"
    assert body["report"]["target_kb"] == 20
    assert body["size_bytes"] <= 20 * 1024 or body["target_met"] is False

    overridden = user.process(document["id"], {"profile_id": profile["id"], "target_kb": 30}).json()
    assert overridden["download_name"] == "photo_SSC_CGL_30KB.jpg"


def test_profile_for_wrong_document_type_is_rejected(make_user, create_profile, photo_bytes):
    profile = create_profile(document_type="signature")
    user = make_user("9100000007")
    user.sign_in()
    document = user.upload("me.jpg", photo_bytes, "photo", "image/jpeg").json()

    response = user.process(document["id"], {"profile_id": profile["id"]})

    assert response.status_code == 422
    assert "signature" in response.json()["detail"]


def test_custom_mode_image_returns_warning_when_target_unreachable(make_user):
    user = make_user("9100000008")
    user.sign_in()
    png = _noise_png()
    document = user.upload("sign.png", png, "signature", "image/png").json()

    process = user.process(document["id"], {"target_kb": 5, "output_format": "png"})

    assert process.status_code == 201
    body = process.json()
    assert body["target_met"] is False
    assert body["report"]["warnings"]


def test_custom_mode_pdf_is_processed_and_downloads(make_user, pdf_bytes):
    user = make_user("9100000009")
    user.sign_in()
    document = user.upload("marksheet.pdf", pdf_bytes, "marksheet_10", "application/pdf").json()

    process = user.process(document["id"], {"target_kb": 150})
    assert process.status_code == 201
    body = process.json()
    assert body["mime_type"] == "application/pdf"
    assert body["download_name"] == "marksheet_10_custom_150KB.pdf"

    download = user.client.get(f"/derived/{body['id']}/file", headers=user.headers)
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert "attachment" in download.headers["content-disposition"]
    assert len(download.content) <= 150 * 1024 or body["target_met"] is False


def test_derived_file_can_be_redownloaded_and_deleted(make_user, photo_bytes):
    user = make_user("9100000010")
    user.sign_in()
    document = user.upload("photo.jpg", photo_bytes, "photo", "image/jpeg").json()
    derived = user.process(document["id"], {"target_kb": 60}).json()

    first = user.client.get(f"/derived/{derived['id']}/file", headers=user.headers)
    second = user.client.get(f"/derived/{derived['id']}/file", headers=user.headers)
    assert first.content == second.content
    assert _sha(first.content) == derived["sha256"]

    assert user.client.delete(f"/derived/{derived['id']}", headers=user.headers).status_code == 204
    assert user.client.get(f"/derived/{derived['id']}/file", headers=user.headers).status_code == 404


def test_deleting_original_removes_its_derived_files(make_user, photo_bytes):
    user = make_user("9100000011")
    user.sign_in()
    document = user.upload("photo.jpg", photo_bytes, "photo", "image/jpeg").json()
    derived = user.process(document["id"], {"target_kb": 60}).json()
    derived_key = _derived_key(derived["id"])

    assert user.client.delete(f"/documents/{document['id']}", headers=user.headers).status_code == 204

    assert not get_storage().exists(derived_key)
    assert user.client.get("/derived").json() == []


def test_expired_derived_files_are_purged(make_user, photo_bytes):
    user = make_user("9100000012")
    user.sign_in()
    document = user.upload("photo.jpg", photo_bytes, "photo", "image/jpeg").json()
    derived = user.process(document["id"], {"target_kb": 60}).json()
    derived_key = _derived_key(derived["id"])
    with SessionLocal() as db:
        db.get(DerivedFile, derived["id"]).expires_at = utcnow() - timedelta(days=1)
        db.commit()

    with SessionLocal() as db:
        assert purge_expired_derived(db) == 1

    assert not get_storage().exists(derived_key)
    assert user.client.get(f"/derived/{derived['id']}/file", headers=user.headers).status_code == 404


def _noise_png() -> bytes:
    from tests.helpers import make_noise_image, to_bytes

    return to_bytes(make_noise_image(800, 800), "PNG")


def _stored_key(document_id: str) -> str:
    from app.models import OriginalDocument

    with SessionLocal() as db:
        return db.get(OriginalDocument, document_id).storage_key


def _derived_key(derived_id: str) -> str:
    with SessionLocal() as db:
        return db.get(DerivedFile, derived_id).storage_key
