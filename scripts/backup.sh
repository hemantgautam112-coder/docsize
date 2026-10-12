#!/usr/bin/env bash
# Nightly backup for HDVault: a database dump plus the uploaded and processed files.
# Backups older than 14 days are deleted. Run from anywhere: bash ~/docsize/scripts/backup.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
STAMP="$(date +%F-%H%M)"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

echo "Dumping database..."
docker compose exec -T db pg_dump -U docsize docsize | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

echo "Copying uploaded and processed files..."
docker run --rm \
  -v docsize_docsize_files:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/files-$STAMP.tar.gz" -C /data .

echo "Removing backups older than 14 days..."
find "$BACKUP_DIR" \( -name 'db-*.sql.gz' -o -name 'files-*.tar.gz' \) -mtime +14 -delete

echo "Backup complete: $BACKUP_DIR (stamp $STAMP)"
