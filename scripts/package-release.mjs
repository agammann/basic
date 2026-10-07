import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const run = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
if (resolve(run(['rev-parse', '--show-toplevel'])) !== process.cwd()) {
  throw new Error('Run packaging from the repository root.');
}
if (run(['status', '--porcelain', '--untracked-files=normal'])) {
  throw new Error('Source packaging requires a clean committed tree.');
}
const files = run(['ls-files']).split('\n');
if (files.some(filename => /^(node_modules|\.next|backups|work|release-artifacts)\//.test(filename) ||
    /(^|\/)\.env(\.|$)/.test(filename) && filename !== '.env.example' ||
    filename === 'deploy/production.env' || /^curation\/sources\/.*\.txt$/.test(filename))) {
  throw new Error('Private configuration or generated local files are tracked.');
}
for (const required of ['LICENSE', 'pnpm-lock.yaml', 'docs/SETUP.md', 'docs/v1.md']) {
  if (!files.includes(required)) throw new Error('Required distribution file is missing: ' + required);
}
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version)) {
  throw new Error('Expected a stable semantic version in package.json.');
}
const directory = resolve('release-artifacts');
mkdirSync(directory, { recursive: true });
const filename = `basic_${version}_source.zip`;
const output = resolve(directory, filename);
execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', 'archive', '--format=zip', `--prefix=basic-${version}/`, `--output=${output}`, 'HEAD'], { windowsHide: true });
const digest = createHash('sha256').update(readFileSync(output)).digest('hex');
writeFileSync(output + '.sha256', digest + '  ' + filename + '\n');
console.log(`Packaged ${filename} from ${run(['rev-parse', 'HEAD'])}`);
