import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
function check(mode, answer, extra = {}) {
  writeFileSync(log, '');
  const clean = { ...process.env };
  for (const name of Object.keys(clean)) if (/^(COMPOSE_|DOCKER_HOST$|DOCKER_CONTEXT$)/i.test(name)) delete clean[name];
  const result = spawnSync(process.execPath, [script, mode], {
    env: { ...clean, PATH: `${dir}${delimiter}${clean.PATH}`, BASIC_MOCK_LOG: log, ...extra },
    input: `${answer}\n`, encoding: 'utf8', timeout: 10000,
  });
  return { ...result, calls: readFileSync(log, 'utf8') };
}
for (const mode of ['local', 'production']) {
  const wrong = check(mode, 'no');
  assert.notEqual(wrong.status, 0);
  assert.doesNotMatch(wrong.calls, / up /);
  const existing = check(mode, 'NO EXISTING BASIC DATABASE', { BASIC_MOCK_EXISTING: '{"ID":"existing"}' });
  assert.notEqual(existing.status, 0);
  assert.doesNotMatch(existing.calls, / up /);
  const success = check(mode, 'NO EXISTING BASIC DATABASE');
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.calls, /compose\.postgres18-init\.yaml up -d --wait db/);
  assert.match(success.calls, / up -d --force-recreate --wait db/);
}
assert.notEqual(check('local', 'NO EXISTING BASIC DATABASE', { COMPOSE_FILE: 'unexpected' }).status, 0);
assert.notEqual(check('local', 'NO EXISTING BASIC DATABASE', { BASIC_MOCK_HOST: 'tcp://fixture.invalid:2375' }).status, 0);
console.log('PASS: helper fails closed on missing confirmation, existing containers, selectors and nonlocal context; confirmed runs select both startup modes');
console.log(`Synthetic helper mock retained at ${dir}`);
