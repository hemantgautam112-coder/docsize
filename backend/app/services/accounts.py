"""Account deletion: removes every stored file and every database row that belongs to the user."""

from sqlalchemy.orm import Session

from app.models import User
from app.services.storage import get_storage


def delete_account(db: Session, user: User) -> None:
    keys = [doc.storage_key for doc in user.originals]
    keys += [derived.storage_key for doc in user.originals for derived in doc.derived_files]
    keys += [derived.storage_key for derived in user.derived_files]

    db.delete(user)
    db.commit()

    storage = get_storage()
    for key in set(keys):
        storage.delete(key)
