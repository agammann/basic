import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// All projects, volumes and containers in this test have unpredictable names.
// Only fixture credentials and data are used. No existing Compose stack is read.
const prefix = `basicpg18test${randomBytes(8).toString('hex')}`;
const env = {
  ...process.env,
  POSTGRES_PASSWORD: 'synthetic-local-only',
  DB_ADMIN_PASSWORD: 'synthetic-admin-only',
  DB_APP_PASSWORD: 'synthetic-reader-only',
  DB_OPERATOR_PASSWORD: 'synthetic-operator-only',
  BASIC_DOMAIN: 'fixture.invalid',
  BASIC_PG18_FRESH_INSTALL: 'confirmed-no-existing-basic-database',
};
for (const name of Object.keys(env)) if (/^(COMPOSE_|DOCKER_HOST$|DOCKER_CONTEXT$)/i.test(name)) delete env[name];
const containers = [];
function cmd(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', args, { env, encoding: 'utf8', timeout: 120000 });
  if (result.error || (!allowFailure && result.status !== 0)) throw Error(`docker ${args.slice(0, 4).join(' ')}: ${result.error?.message || result.stderr}`);
  return result;
}
const host = JSON.parse(cmd(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']).stdout);
if (typeof host !== 'string' || !/^(unix:\/\/|npipe:\/\/)/i.test(host)) throw Error('Only a local Docker context is supported.');
// Use one unique private fixture network for all sequential projects rather than
// consuming a new Docker address pool for each negative case.
const network = `${prefix}network`;
cmd(['network', 'create', '--internal', network]);
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'basic-pg18-network-'));
const networkFile = join(fixtureDirectory, 'compose-network.yaml');
writeFileSync(networkFile, `networks:\n  default: !override { external: true, name: ${network} }\n  private: !override { external: true, name: ${network} }\n`);
const compose = (project, file, init = false) => ['compose', '-p', project, '-f', file, ...(init ? ['-f', 'compose.postgres18-init.yaml'] : []), '-f', networkFile];
function rejected(args, pattern) {
  const r = cmd(args, { allowFailure: true });
  assert.notEqual(r.status, 0, `Unexpected success: ${args.join(' ')}`);
  assert.match(`${r.stdout}\n${r.stderr}`, pattern);
}
async function ready(container) {
  for (let i = 0; i < 90; i++) {
    const status = cmd(['inspect', '--format', '{{.State.Running}}', container], { allowFailure: true });
    if (status.stdout.trim() !== 'true') throw Error(`Fixture stopped before readiness: ${cmd(['logs', container], { allowFailure: true }).stdout}`);
    if (cmd(['exec', container, 'pg_isready', '-h', '127.0.0.1'], { allowFailure: true }).status === 0) return;
    await delay(1000);
  }
  throw Error('Fixture database did not become ready.');
}
async function launch(project, file, init = false) {
  const id = cmd([...compose(project, file, init), 'run', '-d', '--no-deps', '--use-aliases', 'db']).stdout.trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  containers.push(id);
  await ready(id);
  return id;
}
function fixtureVolume(project, suffix) { return `${project}_${suffix}`; }
function mutate(volume, script) {
  cmd(['run', '--name', `${prefix}mutation${containers.length}${randomBytes(3).toString('hex')}`, '--network', 'none', '--entrypoint', 'sh', '-v', `${volume}:/fixture`, 'postgres:18.4-alpine', '-c', script]);
}
try {
  const local = `${prefix}local`;
  const base = compose(local, 'compose.yaml');
  rejected([...base, 'run', '--no-deps', 'db'], /cluster is missing|attempt record is missing/i);
  rejected([...base, 'run', '--no-deps', '-e', 'PGDATA=/tmp/unreviewed', 'db'], /unexpected PGDATA/i);
  env.BASIC_PG18_FRESH_INSTALL = 'not-confirmed';
  rejected([...compose(local, 'compose.yaml', true), 'run', '--no-deps', 'db'], /fresh-install confirmation required/i);
  env.BASIC_PG18_FRESH_INSTALL = 'confirmed-no-existing-basic-database';
  const first = await launch(local, 'compose.yaml', true);
  assert.equal(cmd(['exec', first, 'psql', '-U', 'basic', '-d', 'basic', '-Atc', 'SHOW server_version_num']).stdout.trim().slice(0, 2), '18');
  rejected([...compose(local, 'compose.yaml', true), 'run', '--no-deps', 'db'], /target storage is not empty/i);
  cmd(['stop', first]);
  const restarted = await launch(local, 'compose.yaml');
  cmd(['stop', restarted]);
  const target = fixtureVolume(local, 'basic-data-18');
  mutate(target, 'mv /fixture/18/docker/.basic-init-complete /fixture/18/docker/.saved-marker');
  rejected([...base, 'run', '--no-deps', 'db'], /marker is missing/i);
  mutate(target, 'printf "basic-postgres18-initialization-complete-v1:123\n" > /fixture/18/docker/.basic-init-complete');
  rejected([...base, 'run', '--no-deps', 'db'], /marker does not match/i);
  mutate(target, 'mv -f /fixture/18/docker/.saved-marker /fixture/18/docker/.basic-init-complete; mv /fixture/18/docker /fixture/18/docker.saved');
  rejected([...base, 'run', '--no-deps', 'db'], /cluster is missing/i);
  mutate(target, 'mv /fixture/18/docker.saved /fixture/18/docker');
  const restored = await launch(local, 'compose.yaml');
  cmd(['stop', restored]);
  console.log('PASS: first install, restart, confirmation, nonempty target and missing/mismatched marker or cluster');

  const legacy = `${prefix}legacy`;
  const oldVolume = fixtureVolume(legacy, 'basic-data');
  const old = cmd(['run', '-d', '--network', 'none', '-e', 'POSTGRES_PASSWORD=synthetic-old-only', '-e', 'POSTGRES_USER=basic', '-e', 'POSTGRES_DB=basic', '-v', `${oldVolume}:/var/lib/postgresql/data`, 'postgres:17.6-alpine']).stdout.trim();
  assert.match(old, /^[a-f0-9]{64}$/);
  containers.push(old);
  await ready(old);
  cmd(['exec', old, 'psql', '-U', 'basic', '-d', 'basic', '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE synthetic_legacy(value text); INSERT INTO synthetic_legacy VALUES ('preserved');"]);
  cmd(['stop', old]);
  rejected([...compose(legacy, 'compose.yaml', true), 'run', '--no-deps', 'db'], /legacy storage is populated/i);
  rejected([...compose(legacy, 'compose.yaml'), 'run', '--no-deps', 'db'], /legacy storage is populated/i);
  cmd(['start', old]);
  await ready(old);
  assert.equal(cmd(['exec', old, 'psql', '-U', 'basic', '-d', 'basic', '-Atc', 'SELECT value FROM synthetic_legacy']).stdout.trim(), 'preserved');
  cmd(['stop', old]);
  console.log('PASS: PG17 legacy cluster is preserved and blocks initialization and startup');

  const populatedTarget = `${prefix}populatedtarget`;
  mutate(fixtureVolume(populatedTarget, 'basic-data-18'), 'printf existing-target > /fixture/sentinel');
  rejected([...compose(populatedTarget, 'compose.yaml', true), 'run', '--no-deps', 'db'], /target storage is not empty/i);
  mutate(fixtureVolume(populatedTarget, 'basic-data-18'), 'test "$(cat /fixture/sentinel)" = existing-target');
  console.log('PASS: a populated target is not initialized');

  const production = `${prefix}production`;
  const prod = await launch(production, 'compose.production.yaml', true);
  const roles = cmd(['exec', prod, 'psql', '-U', 'basic_admin', '-d', 'basic', '-Atc', "SELECT count(*) FROM pg_roles WHERE rolname IN ('basic_reader','basic_operator')"]).stdout.trim();
  assert.equal(roles, '2');
  cmd(['exec', prod, 'psql', '-U', 'basic_admin', '-d', 'basic', '-v', 'ON_ERROR_STOP=1', '-c', "CREATE TABLE synthetic_backup(value text); INSERT INTO synthetic_backup VALUES ('fixture');"]);
  const backup = cmd([...compose(production, 'compose.production.yaml'), 'run', '-d', '--no-deps', 'backup']).stdout.trim();
  assert.match(backup, /^[a-f0-9]{64}$/);
  containers.push(backup);
  let backupPath = '';
  for (let i = 0; i < 30; i++) {
    const result = cmd(['exec', backup, 'sh', '-c', 'ls /backups/basic-*.dump'], { allowFailure: true });
    if (result.status === 0) { backupPath = result.stdout.trim(); break; }
    await delay(1000);
  }
  assert.match(backupPath, /^\/backups\/basic-[0-9TZ]+\.dump$/);
  const dump = spawnSync('docker', ['exec', backup, 'cat', backupPath], { env, timeout: 30000 });
  assert.equal(dump.status, 0);
  cmd(['exec', prod, 'createdb', '-U', 'basic_admin', 'basic_restore_fixture']);
  const restore = spawnSync('docker', ['exec', '-i', prod, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-U', 'basic_admin', '-d', 'basic_restore_fixture'], { env, input: dump.stdout, timeout: 30000 });
  assert.equal(restore.status, 0, restore.stderr?.toString());
  assert.equal(cmd(['exec', prod, 'psql', '-U', 'basic_admin', '-d', 'basic_restore_fixture', '-Atc', 'SELECT value FROM synthetic_backup']).stdout.trim(), 'fixture');
  cmd(['stop', backup]);
  cmd(['stop', prod]);
  const prodRestart = await launch(production, 'compose.production.yaml');
  cmd(['stop', prodRestart]);
  console.log('PASS: production initialization, role setup, backup/restore and restart');

  const prodLegacy = `${prefix}prodlegacy`;
  const prodOld = fixtureVolume(prodLegacy, 'pgdata');
  mutate(prodOld, 'printf old-production > /fixture/sentinel');
  rejected([...compose(prodLegacy, 'compose.production.yaml', true), 'run', '--no-deps', 'db'], /legacy storage is populated/i);
  mutate(prodOld, 'test "$(cat /fixture/sentinel)" = old-production');
  console.log('PASS: production legacy volume is preserved and blocks initialization');

  const guard = resolve('deploy/postgres18-guard.sh');
  const lsFail = resolve('tests/fixtures/pg18-ls-fail.sh');
  const inspectOld = `${prefix}inspectold`, newer = `${prefix}inspectnew`;
  rejected(['run', '--network', 'none', '--entrypoint', 'sh', '-e', 'PATH=/test-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', '-v', `${inspectOld}:/basic/legacy:ro`, '-v', `${newer}:/var/lib/postgresql`, '-v', `${guard}:/basic/guard.sh:ro`, '-v', `${lsFail}:/test-bin/ls:ro`, 'postgres:18.4-alpine', '/basic/guard.sh', 'start', 'postgres'], /could not inspect legacy storage/i);
  console.log('PASS: a failed legacy listing is fatal');

  const interruptedOld = `${prefix}interruptedold`, interruptedNew = `${prefix}interruptednew`;
  const readyScript = resolve('deploy/postgres18-ready.sh');
  const failingInit = resolve('tests/fixtures/pg18-init-fail.sh');
  const interruptedArgs = ['run', '--network', 'none', '--entrypoint', 'sh', '-e', 'POSTGRES_PASSWORD=synthetic-interrupted-only', '-e', 'BASIC_PG18_FRESH_INSTALL=confirmed-no-existing-basic-database', '-v', `${interruptedOld}:/basic/legacy:ro`, '-v', `${interruptedNew}:/var/lib/postgresql`, '-v', `${guard}:/basic/guard.sh:ro`, '-v', `${failingInit}:/docker-entrypoint-initdb.d/yy-synthetic-failure.sh:ro`, '-v', `${readyScript}:/docker-entrypoint-initdb.d/zz-basic-ready.sh:ro`, 'postgres:18.4-alpine', '/basic/guard.sh'];
  rejected([...interruptedArgs, 'initialize', 'postgres'], /synthetic initialization failure/i);
  rejected([...interruptedArgs, 'start', 'postgres'], /marker is missing/i);
  rejected([...interruptedArgs, 'initialize', 'postgres'], /target storage is not empty/i);
  console.log('PASS: an actual failed init script leaves an incomplete cluster blocked');

  const raceOld = `${prefix}raceold`, raceNew = `${prefix}racenew`;
  // Create the random volumes first so concurrent Docker volume creation does not
  // affect the guard race; neither volume existed before this fixture.
  assert.equal(cmd(['volume', 'create', raceOld]).stdout.trim(), raceOld);
  assert.equal(cmd(['volume', 'create', raceNew]).stdout.trim(), raceNew);
  const raceArgs = ['run', '--network', 'none', '--entrypoint', 'sh', '-e', 'BASIC_PG18_FRESH_INSTALL=confirmed-no-existing-basic-database', '-v', `${raceOld}:/basic/legacy:ro`, '-v', `${raceNew}:/var/lib/postgresql`, '-v', `${guard}:/basic/guard.sh:ro`, 'postgres:18.4-alpine', '/basic/guard.sh', 'initialize', 'postgres', '--help'];
  const race = () => new Promise((done, reject) => {
    const child = spawn('docker', raceArgs, { env, stdio: 'ignore' });
    child.once('error', reject); child.once('exit', (code) => done(code));
  });
  const outcomes = await Promise.all([race(), race()]);
  assert.equal(outcomes.filter((n) => n === 0).length, 1, `Expected one initializer: ${outcomes}`);
  console.log('PASS: concurrent initializers cannot both claim the target');
} finally {
  for (const container of containers) spawnSync('docker', ['stop', container], { env, stdio: 'ignore', timeout: 30000 });
  console.log(`Synthetic Docker resources retained under prefix ${prefix}`);
}
