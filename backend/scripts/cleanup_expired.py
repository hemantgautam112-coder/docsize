"""Deletes expired processed copies and old OTP records. Run it once a day, for example from cron.

Inside the API container:  python scripts/cleanup_expired.py
Only counts are printed. No file names, identifiers, or contents go to the log.
"""

from app.db import SessionLocal
from app.services.derived import purge_expired_derived
from app.services.otp import purge_expired_otps


def main() -> None:
    with SessionLocal() as db:
        derived_deleted = purge_expired_derived(db)
        otps_deleted = purge_expired_otps(db)
    print(f"Deleted {derived_deleted} expired processed files and {otps_deleted} old OTP records.")


if __name__ == "__main__":
    main()
