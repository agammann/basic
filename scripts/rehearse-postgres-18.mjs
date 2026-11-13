import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// This creates only randomly named local resources and fictional data.
if (['.env', '.env.local'].some(existsSync)) throw new Error('Run from a clean checkout without local env files.');
if (Object.keys(process.env).some(key => /^(DATABASE_URL|DOCKER_HOST|DOCKER_CONTEXT|COMPOSE_.*|PG[A-Z_]*)$/i.test(key))) {
  throw new Error('Unset inherited database and Docker selectors.');
}
const suffix = randomBytes(8).toString('hex');
const oldName = `basic-pg-fixture-${suffix}-old`;
const newName = `basic-pg-fixture-${suffix}-new`;
const invalidName = `basic-pg-fixture-${suffix}-invalid`;
const oldVolume = `${oldName}-data`, newVolume = `${newName}-data`;
const adminPassword = randomBytes(24).toString('hex');
const operatorPassword = randomBytes(24).toString('hex');
const readerPassword = randomBytes(24).toString('hex');
const created = [];
function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: null, maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${program} failed: ${result.error?.message || result.stderr?.toString().trim() || `exit ${result.status}`}`);
  return result.stdout;
}
const docker = (...args) => run('docker', args);
const endpoint = JSON.parse(docker('context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}').toString());
if (typeof endpoint !== 'string' || !/^(unix:\/\/|npipe:\/\/)/i.test(endpoint)) throw new Error('A local Docker context is required.');
function start(name, volume, image, mount, pgdata) {
  docker('run', '-d', '--name', name, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_USER=basic_admin', '-e', `POSTGRES_PASSWORD=${adminPassword}`, '-e', 'POSTGRES_DB=basic', '-e', `PGDATA=${pgdata}`, '-v', `${volume}:${mount}`, image);
  created.push(name);
}
async function ready(name) {
  for (let i = 0; i < 90; i++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'basic_admin', '-d', 'basic'], { stdio: 'ignore' }).status === 0) return;
    await delay(1000);
  }
  throw new Error('Fixture database did not become ready.');
}
function initializeRoles(name) {
  const init = readFileSync('deploy/db-init.sh', 'utf8').replaceAll('\r\n', '\n');
  run('docker', ['exec', '-i', '-e', `BASIC_APP_PASSWORD=${readerPassword}`, '-e', `BASIC_OPERATOR_PASSWORD=${operatorPassword}`, name, 'sh', '-s'], { input: init });
}
function sql(name, role, password, input) {
  return run('docker', ['exec', '-i', '-e', `PGPASSWORD=${password}`, name, 'psql', '-h', '127.0.0.1', '-X', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'basic', '-At'], { input }).toString().trim();
}
function migrate(name) {
  const port = docker('port', name, '5432/tcp').toString().trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error('Expected a loopback-only fixture port.');
  const env = { ...process.env, DATABASE_URL: `postgresql://basic_operator:${operatorPassword}@127.0.0.1:${port}/basic` };
  run(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/operator.ts', 'migrate'], { env });
}
function verifyRoles(name) {
  assert.equal(sql(name, 'basic_reader', readerPassword, `SELECT registry_name FROM profiles WHERE id='fixture-profile'`), 'example.invalid/fixture');
  assert.equal(sql(name, 'basic_admin', adminPassword, `SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename='profiles'`), 'basic_operator');
  sql(name, 'basic_reader', readerPassword, `INSERT INTO rate_buckets(key,window_at,count) VALUES ('fixture-rate',now(),1) ON CONFLICT(key) DO UPDATE SET count=rate_buckets.count+1`);
  const denied = spawnSync('docker', ['exec', '-i', '-e', `PGPASSWORD=${readerPassword}`, name, 'psql', '-h', '127.0.0.1', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'basic_reader', '-d', 'basic'], { input: `DELETE FROM profiles WHERE id='fixture-profile'`, encoding: 'utf8' });
  if (denied.error || denied.status === 0 || !/permission denied for table profiles/i.test(denied.stderr)) throw new Error('Reader unexpectedly modified profiles or failed for another reason.');
}
const snapshot = `SELECT (SELECT count(*) FROM profiles) || ':' || (SELECT count(*) FROM migrations) || ':' || (SELECT count(*) FROM registry_records);`;
try {
  start(oldName, oldVolume, 'postgres:17.6-alpine', '/var/lib/postgresql/data', '/var/lib/postgresql/data');
  await ready(oldName);
  initializeRoles(oldName);
  migrate(oldName);
  sql(oldName, 'basic_operator', operatorPassword, `INSERT INTO registry_records(name,version,status,data,collected_at) VALUES ('example.invalid/fixture','1','active','{}',now());
INSERT INTO profiles(id,registry_name,published,data,search_vector) VALUES ('fixture-profile','example.invalid/fixture',false,'{}',to_tsvector('english','fictional profile'));`);
  const before = sql(oldName, 'basic_admin', adminPassword, snapshot);
  assert.equal(before, '1:4:1');
  verifyRoles(oldName);
  // There are no app writers in this fixture; retain source after the final dump.
  const dump = docker('exec', oldName, 'pg_dump', '-U', 'basic_admin', '-d', 'basic', '-Fc');
  docker('stop', oldName);
  docker('run', '-d', '--name', invalidName, '--network', 'none', '-e', 'POSTGRES_USER=basic_admin', '-e', `POSTGRES_PASSWORD=${adminPassword}`, '-e', 'POSTGRES_DB=basic', '-e', 'PGDATA=/var/lib/postgresql/data', '-v', `${oldVolume}:/var/lib/postgresql/data`, 'postgres:18.4-alpine');
  created.push(invalidName);
  assert.notEqual(run('docker', ['wait', invalidName], { timeout: 20000 }).toString().trim(), '0');
  const invalidLogs = spawnSync('docker', ['logs', invalidName], { encoding: 'utf8', timeout: 10000 });
  if (invalidLogs.error || invalidLogs.status !== 0) throw new Error('Could not inspect the incompatible fixture.');
  const diagnostic = `${invalidLogs.stdout}\n${invalidLogs.stderr}`;
  assert.match(diagnostic, /database files are incompatible with server/i);
  assert.match(diagnostic, /initialized by PostgreSQL version 17.*version 18/i);
  start(newName, newVolume, 'postgres:18.4-alpine', '/var/lib/postgresql', '/var/lib/postgresql/18/docker');
  await ready(newName);
  initializeRoles(newName);
  run('docker', ['exec', '-i', newName, 'pg_restore', '--exit-on-error', '-U', 'basic_admin', '-d', 'basic'], { input: dump });
  assert.equal(sql(newName, 'basic_admin', adminPassword, snapshot), before);
  migrate(newName);
  verifyRoles(newName);
  sql(newName, 'basic_operator', operatorPassword, `INSERT INTO profiles(id,registry_name,published,data,search_vector) VALUES ('post-cutover','example.invalid/fixture',false,'{}',to_tsvector('english','later write'))`);
  assert.equal(sql(newName, 'basic_admin', adminPassword, snapshot), '2:4:1');
  docker('stop', newName);
  docker('start', oldName);
  await ready(oldName);
  assert.equal(sql(oldName, 'basic_admin', adminPassword, snapshot), before);
  verifyRoles(oldName);
  console.log('PASS: synthetic PG17→18 restore preserves Basic roles and data; old volume omits post-cutover writes.');
} finally {
  for (const name of created) spawnSync('docker', ['stop', name], { stdio: 'ignore' });
  console.log(`Synthetic resources retained: ${created.join(', ')}; volumes ${oldVolume}, ${newVolume}`);
}

