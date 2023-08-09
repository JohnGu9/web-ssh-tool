import { promises as fs } from 'fs';
import path from 'path';
import { licenseBundle, run } from './build';

async function main() {
  await run('npm run build:web');
  await run('npm run build:node');
  await licenseBundle();
  await fs.cp(path.join(__dirname, 'web', 'build'), path.join(__dirname, 'node', 'assets'), { recursive: true });
  await run('cd node && node index.js');
}

main();