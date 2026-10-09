"""Authorization: owners only for files, admins only for profile writes."""

from tests.helpers import make_photo_bytes


def _owner_with_document_and_derived(make_user):
    owner = make_user("9000000001")
    owner.sign_in()
    upload = owner.upload("photo.jpg", make_photo_bytes(300, 400), "photo", "image/jpeg")
    assert upload.status_code == 201
    document_id = upload.json()["id"]
    process = owner.process(document_id, {"target_kb": 50})
    assert process.status_code == 201
    return owner, document_id, process.json()["id"]


def test_anonymous_requests_are_rejected(make_user):
    anonymous = make_user("9000000002")

    assert anonymous.client.get("/documents").status_code == 401
    assert anonymous.client.get("/derived").status_code == 401


def test_other_user_gets_403_on_every_document_route(make_user):
    owner, document_id, _derived_id = _owner_with_document_and_derived(make_user)
    intruder = make_user("9000000003")
    intruder.sign_in()

    assert intruder.client.get(f"/documents/{document_id}").status_code == 403
    assert intruder.client.get(f"/documents/{document_id}/file").status_code == 403
    assert intruder.client.post(f"/documents/{document_id}/process", json={"target_kb": 30}, headers=intruder.headers).status_code == 403
    assert intruder.client.delete(f"/documents/{document_id}", headers=intruder.headers).status_code == 403


def test_other_user_gets_403_on_derived_file_routes(make_user):
    owner, _document_id, derived_id = _owner_with_document_and_derived(make_user)
    intruder = make_user("9000000004")
    intruder.sign_in()

    assert intruder.client.get(f"/derived/{derived_id}/file").status_code == 403
    assert intruder.client.delete(f"/derived/{derived_id}", headers=intruder.headers).status_code == 403


def test_other_user_sees_empty_lists(make_user):
    _owner_with_document_and_derived(make_user)
    intruder = make_user("9000000005")
    intruder.sign_in()

    assert intruder.client.get("/documents").json() == []
    assert intruder.client.get("/derived").json() == []


def test_owner_still_has_access(make_user):
    owner, document_id, derived_id = _owner_with_document_and_derived(make_user)

    assert owner.client.get(f"/documents/{document_id}").status_code == 200
    assert owner.client.get(f"/derived/{derived_id}/file").status_code == 200


def test_missing_document_is_404_not_403(make_user):
    user = make_user("9000000006")
    user.sign_in()

    assert user.client.get("/documents/does-not-exist").status_code == 404


def test_non_admin_cannot_create_profile(make_user):
    user = make_user("9000000007")
    user.sign_in()

    response = user.client.post(
        "/profiles",
        json={"exam_name": "X", "document_type": "photo", "max_kb": 20, "output_format": "jpeg"},
        headers=user.headers,
    )

    assert response.status_code == 403


def test_admin_can_create_and_update_profile(admin, create_profile):
    profile = create_profile(exam_name="SSC CHSL", max_kb=40)

    response = admin.client.put(
        f"/profiles/{profile['id']}",
        json={**{k: v for k, v in profile.items() if k != "id"}, "max_kb": 35},
        headers=admin.headers,
    )

    assert response.status_code == 200
    assert response.json()["max_kb"] == 35
    assert admin.client.get(f"/profiles/{profile['id']}").json()["is_placeholder"] is True
