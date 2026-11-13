#!/bin/sh
set -eu
[ "${PGDATA:-}" = /var/lib/postgresql/18/docker ]
[ "$(cat "$PGDATA/PG_VERSION")" = 18 ]
control=$(pg_controldata "$PGDATA")
identity=$(printf '%s\n' "$control" | sed -n 's/^Database system identifier:[[:space:]]*//p')
case "$identity" in ''|*[!0-9]*) exit 1 ;; esac
printf 'basic-postgres18-initialization-complete-v1:%s\n' "$identity" > "$PGDATA/.basic-init-complete"
sync "$PGDATA/.basic-init-complete" "$PGDATA"
