import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  function run(command: string) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true });
      child.stdout.on('data', (data) => console.log(data.toString()));
      child.stderr.on('data', (data) => console.warn(data.toString()));
      child.on('error', reject);
      child.on('exit', resolve);
    });
  }
  await run('cd web && npm i');
  await run('npm run build:web');
  await run('cd node && npm i');
  await run('npm run build:node');
  await fs.copyFile(path.resolve(__dirname, 'node', 'index.js'), 'index.js');
  await run('node index.js');
}

main();