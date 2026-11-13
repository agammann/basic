import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const mode = process.argv[2];
if (!['local', 'production'].includes(mode) || process.argv.length !== 3)
  throw Error('Choose exactly local or production.');
for (const key of Object.keys(process.env)) {
  if (/^(COMPOSE_|DOCKER_HOST$|DOCKER_CONTEXT$)/i.test(key))
    throw Error(`Unset ${key} and identify the intended local Docker context and project first.`);
}
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw Error(`Docker command failed: ${result.error?.message ?? result.stderr ?? result.status}`);
  return result.stdout;
}
const host = JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']));
if (typeof host !== 'string' || !/^(unix:\/\/|npipe:\/\/)/i.test(host))
  throw Error('A local Docker context is required; use a reviewed procedure for other hosts.');
const base = mode === 'local'
  ? ['compose', '-p', 'basic', '-f', 'compose.yaml']
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
