import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { licenseBundle } from './build-liscense'

export function run(command: string) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true });
    child.stdout.on('data', (data) => console.log(data.toString()));
    child.stderr.on('data', (data) => console.warn(data.toString()));
    child.on('error', reject);
    child.on('exit', resolve);
  });
}


async function main() {
  console.log('running build.ts');

  // bundle licenses to frontend
  console.log('checking licenses...');
  const webBuildPath = path.join(__dirname, 'web', 'build');
  await licenseBundle(path.join(webBuildPath, 'LICENSE'));
  await fs.cp(webBuildPath, path.join(__dirname, 'node', 'assets'), { recursive: true });

  // pkg
  console.log('bundle project to executables...');
  await run('cd node && npx pkg --compress Brotli package.json');

  // print information
  console.log('🚚 application built! ');
  const buildProjectFilePath = path.join(__dirname, 'node', 'package.json');
  const buildProjectJson = JSON.parse(await fs.readFile(buildProjectFilePath).then(value => value.toString()));
  const projectName = buildProjectJson['name'];
  console.log(`📦 output executables: `);
  for await (const { name: file } of await fs.opendir('build')) {
    if (file.indexOf(projectName) !== -1) {
      const filePath = path.join('build', file);
      const state = await fs.lstat(filePath);
      const size = state.size / (1024 * 1024);
      console.log(`  [\x1b[32m${filePath}\x1b[0m] ${size.toFixed(2)}MB`)
    }
  }
}

main();
