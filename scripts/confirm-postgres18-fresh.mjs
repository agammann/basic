import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync } from 'node:fs';
import { URL } from 'node:url';

const mode = process.argv[2];
if (!['local', 'production'].includes(mode) || process.argv.length !== 3)
  throw Error('Choose exactly local or production.');
const selector = /^(DATABASE_URL|POSTGRES_PASSWORD|DB_ADMIN_PASSWORD|DB_APP_PASSWORD|DB_OPERATOR_PASSWORD|BASIC_DOMAIN|BASIC_PG18_FRESH_INSTALL|COMPOSE_.*|DOCKER_.*|DOTENV_CONFIG_.*|PG[A-Z_]*)$/i;
for (const key of Object.keys(process.env))
  if (selector.test(key)) throw Error(`Unset inherited ${key} before initialization.`);
if (['compose.override.yaml', 'compose.override.yml', 'docker-compose.override.yaml', 'docker-compose.override.yml'].some(existsSync))
  throw Error('Automatic Compose overrides need a separately reviewed procedure.');
if (mode === 'local' && ['.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'].some(existsSync))
  throw Error('Additional Next.js environment files need a separately reviewed procedure.');
const environmentFile = mode === 'local' ? '.env' : 'deploy/production.env';
process.loadEnvFile(environmentFile);
const allowed = mode === 'local'
  ? ['DATABASE_URL', 'POSTGRES_PASSWORD']
  : ['DB_ADMIN_PASSWORD', 'DB_APP_PASSWORD', 'DB_OPERATOR_PASSWORD', 'BASIC_DOMAIN'];
for (const key of Object.keys(process.env))
  if (selector.test(key) && !allowed.includes(key)) throw Error(`Remove ${key} from ${environmentFile} before initialization.`);
if (mode === 'local') {
  let database, password;
  try { database = new URL(process.env.DATABASE_URL); password = decodeURIComponent(database.password); }
  catch { throw Error('A valid default local DATABASE_URL is required.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['localhost', '127.0.0.1'].includes(database.hostname) ||
      database.port !== '55432' || database.username !== 'basic' || database.pathname !== '/basic' || database.search || database.hash ||
      !/^[A-Za-z0-9_-]+$/.test(process.env.POSTGRES_PASSWORD ?? '') || password !== process.env.POSTGRES_PASSWORD)
    throw Error('DATABASE_URL and POSTGRES_PASSWORD must identify the same default Basic database.');
} else {
  const passwords = ['DB_ADMIN_PASSWORD', 'DB_APP_PASSWORD', 'DB_OPERATOR_PASSWORD'].map((name) => process.env[name] ?? '');
  if (passwords.some((value) => !/^[a-f0-9]{64,}$/i.test(value)) || new Set(passwords).size !== passwords.length)
    throw Error('Production requires three distinct random hexadecimal passwords of at least 32 bytes.');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(process.env.BASIC_DOMAIN ?? '') || process.env.BASIC_DOMAIN === 'basic.example.com')
    throw Error('Set the approved production BASIC_DOMAIN in deploy/production.env.');
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw Error('Docker command failed; inspect the local context without sharing credentials.');
  return result.stdout;
}
const host = JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']));
if (typeof host !== 'string' || !/^(unix:\/\/|npipe:\/\/)/i.test(host))
  throw Error('A local Docker context is required; use a reviewed procedure for other hosts.');
const base = mode === 'local'
  ? ['compose', '-p', 'basic', '--env-file', '.env', '-f', 'compose.yaml']
  : ['compose', '-p', 'basic-production', '--env-file', 'deploy/production.env', '-f', 'compose.production.yaml'];
const existing = docker([...base, 'ps', '-a', '--format', 'json']).trim();
if (existing && existing !== '[]')
  throw Error('This project already has containers. Stop and identify the existing installation; do not initialize.');
console.log('This is ONLY for a fresh installation. It does not migrate data.');
console.log('Inspect all prior Basic projects, Docker hosts, volumes, bind mounts, overrides and remote databases first.');
console.log('The guard cannot discover storage outside the selected project.');
console.log('Keep all potential Basic writers and storage changes stopped throughout initialization.');
const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question('Type NO EXISTING BASIC DATABASE to confirm: ');
rl.close();
if (answer !== 'NO EXISTING BASIC DATABASE') throw Error('Fresh installation was not confirmed.');
const env = { ...process.env, BASIC_PG18_FRESH_INSTALL: 'confirmed-no-existing-basic-database' };
docker([...base, '-f', 'compose.postgres18-init.yaml', 'up', '-d', '--wait', 'db'], { stdio: 'inherit', env });
docker([...base, 'up', '-d', '--force-recreate', '--wait', 'db'], { stdio: 'inherit', env });
console.log('Fresh PostgreSQL 18 database initialized. Continue with the setup guide.');
