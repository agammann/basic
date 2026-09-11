#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  if pg_dump --format=custom --no-owner --no-acl --file="/backups/basic-$stamp.dump.partial"; then
    mv "/backups/basic-$stamp.dump.partial" "/backups/basic-$stamp.dump"
    printf '{"event":"backup-complete"}\n'
    find /backups -maxdepth 1 -name 'basic-*.dump' -type f -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
  else
    printf '{"event":"backup-failed"}\n' >&2
  fi
  sleep 86400
done
