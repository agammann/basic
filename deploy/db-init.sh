#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv reader_password BASIC_APP_PASSWORD
\getenv operator_password BASIC_OPERATOR_PASSWORD
CREATE ROLE basic_reader LOGIN PASSWORD :'reader_password';
CREATE ROLE basic_operator LOGIN PASSWORD :'operator_password';
GRANT CONNECT ON DATABASE basic TO basic_reader, basic_operator;
ALTER SCHEMA public OWNER TO basic_operator;
GRANT USAGE ON SCHEMA public TO basic_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE basic_operator IN SCHEMA public GRANT SELECT ON TABLES TO basic_reader;
SQL
