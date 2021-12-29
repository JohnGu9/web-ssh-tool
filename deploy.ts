import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

function run(command: string) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true });
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', reject);
    child.on('exit', resolve);
  });
}

async function main() {
  await run('npm run build:web');
  await run('npm run build:node');
  await fs.cp(path.join(__dirname, 'web', 'build'), path.join(__dirname, 'node', 'assets'), { recursive: true });
  await run('cd node && node index.js');
}

main();