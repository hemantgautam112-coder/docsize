#!/usr/bin/env bash
# Nightly encrypted backup for HDVault: a database dump plus the uploaded and processed files.
# Each backup is encrypted with AES-256 (gpg) before it touches the disk. Plain copies are never written.
# The passphrase is read from ~/.backup_key (chmod 600). Keep a copy of that file somewhere safe:
# without it, the backups cannot be restored.
# Backups older than 14 days are deleted. Run from anywhere: bash ~/docsize/scripts/backup.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEY_FILE="${BACKUP_KEY_FILE:-$HOME/.backup_key}"
STAMP="$(date +%F-%H%M)"

if [ ! -s "$KEY_FILE" ]; then
  echo "Missing backup passphrase file: $KEY_FILE" >&2
  echo "Create it with a long random passphrase and run: chmod 600 $KEY_FILE" >&2
  exit 1
fi
if [ "$(stat -c %a "$KEY_FILE")" != "600" ]; then
  echo "Fix the permissions first: chmod 600 $KEY_FILE" >&2
  exit 1
fi

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

# Encrypts stdin to a file. AES-256 symmetric, passphrase from the key file.
encrypt_to() {
  gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
    --pinentry-mode loopback --passphrase-file "$KEY_FILE" -o "$1"
}

echo "Dumping database..."
docker compose exec -T db pg_dump -U docsize docsize | gzip | encrypt_to "$BACKUP_DIR/db-$STAMP.sql.gz.gpg"

echo "Copying uploaded and processed files..."
docker run --rm \
  -v docsize_docsize_files:/data:ro \
  alpine tar czf - -C /data . | encrypt_to "$BACKUP_DIR/files-$STAMP.tar.gz.gpg"

echo "Removing backups older than 14 days..."
find "$BACKUP_DIR" \( -name 'db-*.sql.gz.gpg' -o -name 'files-*.tar.gz.gpg' \) -mtime +14 -delete

echo "Backup complete: $BACKUP_DIR (stamp $STAMP)"
echo "Restore the database with: gpg -d --pinentry-mode loopback --passphrase-file ~/.backup_key db-$STAMP.sql.gz.gpg | gunzip | docker compose exec -T db psql -U docsize docsize"
