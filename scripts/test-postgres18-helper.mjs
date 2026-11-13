import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.platform === 'win32') {
  console.log('Helper command mock requires POSIX; hosted Linux runs this check.');
  process.exit(0);
}
const dir = mkdtempSync(join(tmpdir(), 'basic-pg18-helper-'));
const log = join(dir, 'calls');
const mock = join(dir, 'docker');
writeFileSync(mock, `#!/bin/sh
printf '%s\\n' "$*" >> "$BASIC_MOCK_LOG"
if [ "$1" = context ]; then printf '"%s"\\n' "\${BASIC_MOCK_HOST:-unix:///fixture}"; exit 0; fi
case " $* " in *' ps -a '*) printf '%s\\n' "\${BASIC_MOCK_EXISTING:-[]}" ;; esac
`, { mode: 0o755 });
const script = resolve('scripts/confirm-postgres18-fresh.mjs');
let count = 0;
const local = 'DATABASE_URL=postgresql://basic:synthetic-only@localhost:55432/basic\nPOSTGRES_PASSWORD=synthetic-only\n';
const production = `BASIC_DOMAIN=fixture.invalid\nDB_ADMIN_PASSWORD=${'a'.repeat(64)}\nDB_APP_PASSWORD=${'b'.repeat(64)}\nDB_OPERATOR_PASSWORD=${'c'.repeat(64)}\n`;
function check(mode, answer, extra = {}, options = {}) {
  writeFileSync(log, '');
  const cwd = join(dir, String(count++)); mkdirSync(cwd); mkdirSync(join(cwd, 'deploy'));
  writeFileSync(join(cwd, mode === 'local' ? '.env' : 'deploy/production.env'), options.file ?? (mode === 'local' ? local : production));
  if (options.extraFile) writeFileSync(join(cwd, options.extraFile), 'DATABASE_URL=postgresql://other.invalid/other\n');
  const clean = { ...process.env };
  for (const name of Object.keys(clean)) if (/^(DATABASE_URL|POSTGRES_PASSWORD|DB_ADMIN_PASSWORD|DB_APP_PASSWORD|DB_OPERATOR_PASSWORD|BASIC_DOMAIN|BASIC_PG18_FRESH_INSTALL|COMPOSE_.*|DOCKER_HOST|DOCKER_CONTEXT|DOTENV_CONFIG_.*|PG[A-Z_]*)$/i.test(name)) delete clean[name];
  const result = spawnSync(process.execPath, [script, mode], {
    cwd, env: { ...clean, PATH: `${dir}${delimiter}${clean.PATH}`, BASIC_MOCK_LOG: log, ...extra },
    input: `${answer}\n`, encoding: 'utf8', timeout: 10000,
  });
  return { ...result, calls: readFileSync(log, 'utf8') };
}
const confirmed = 'NO EXISTING BASIC DATABASE';
for (const mode of ['local', 'production']) {
  const failures = [
    check(mode, 'no'),
    check(mode, confirmed, { BASIC_MOCK_EXISTING: '{"ID":"existing"}' }),
    check(mode, confirmed, { COMPOSE_FILE: 'unexpected' }),
    check(mode, confirmed, { BASIC_MOCK_HOST: 'tcp://fixture.invalid:2375' }),
    check(mode, confirmed, { DATABASE_URL: 'postgresql://remote.invalid/real' }),
    check(mode, confirmed, { POSTGRES_PASSWORD: 'other' }),
    check(mode, confirmed, { PGHOST: 'other' }),
    check(mode, confirmed, { DOTENV_CONFIG_OVERRIDE: 'true' }),
    check(mode, confirmed, {}, { extraFile: 'compose.override.yaml' }),
  ];
  for (const failure of failures) {
    assert.notEqual(failure.status, 0);
    assert.doesNotMatch(failure.calls, / up /);
  }
  const success = check(mode, confirmed);
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.calls, /compose\.postgres18-init\.yaml up -d --wait db/);
  assert.match(success.calls, / up -d --force-recreate --wait db/);
}
for (const failure of [
  check('local', confirmed, {}, { file: local.replace('localhost:55432', 'remote.invalid:55432') }),
  check('local', confirmed, {}, { file: local.replace('POSTGRES_PASSWORD=synthetic-only', 'POSTGRES_PASSWORD=mismatch') }),
  check('local', confirmed, {}, { file: local + 'PGHOST=other\n' }),
  check('local', confirmed, {}, { file: local + 'DOTENV_CONFIG_PATH=other\n' }),
  check('local', confirmed, {}, { extraFile: '.env.local' }),
  check('production', confirmed, { BASIC_DOMAIN: 'other.invalid' }),
  check('production', confirmed, { DB_ADMIN_PASSWORD: 'other' }),
  check('production', confirmed, {}, { file: production.replace('b'.repeat(64), 'a'.repeat(64)) }),
  check('production', confirmed, {}, { file: production + 'COMPOSE_FILE=other\n' }),
]) {
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(failure.calls, / up /);
}
console.log('PASS: fresh helper rejects inherited/file selectors, mismatched or remote database, Next/Compose overrides and unsafe production credentials');
console.log(`Synthetic helper mock retained at ${dir}`);
