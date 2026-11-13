#!/bin/sh
set -eu
touch "$PGDATA/.synthetic-slow-init-started"
# Deliberately fake an early marker so the test also proves TCP readiness is
# required while the entrypoint's temporary Unix-socket server is running.
printf 'premature-test-marker\n' > "$PGDATA/.basic-init-complete"
sleep 12
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE TABLE synthetic_slow_init(value text); INSERT INTO synthetic_slow_init VALUES ('completed');"
touch "$PGDATA/.synthetic-slow-init-finished"
