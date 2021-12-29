import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import licenseChecker, { ModuleInfos } from 'license-checker';

export { };

function run(command: string) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true });
    child.stdout.on('data', (data) => console.log(data.toString()));
    child.stderr.on('data', (data) => console.warn(data.toString()));
    child.on('error', reject);
    child.on('exit', resolve);
  });
}

function checker() {
  return new Promise<ModuleInfos>(resolve =>
    licenseChecker.init(
      { start: __dirname },
      (error, result) => resolve(result)),
  );
}

async function licenseBundle() {
  const webBuiltDirectory = path.resolve(__dirname, 'web', 'build', 'static', 'js');
  for await (const { name: file } of await fs.opendir(webBuiltDirectory)) {
    if (file.endsWith('LICENSE.txt')) {
      const target = path.resolve(__dirname, 'web', 'build', 'LICENSE');
      const [licenses] = await Promise.all([
        checker(),
        (async () => {
          const buffer = await fs.readFile(path.join(webBuiltDirectory, file));
          await fs.writeFile(target, buffer);
        })(),
      ]);
      const buffer2 = Buffer.from('\n\n');
      for (const [name, { licenseFile }] of Object.entries(licenses)) {
        if (licenseFile) {
          const buffer0 = Buffer.from(`\n${name}\n`);
          const buffer1 = await fs.readFile(licenseFile);
          await fs.appendFile(target, Buffer.concat([buffer0, buffer1, buffer2]));
        }
      }
      break;
    }
  }
}

async function main() {
  console.log('running build.ts');

  // bundle licenses to frontend
  console.log('checking licenses...');
  await licenseBundle();
  await fs.cp(path.join(__dirname, 'web', 'build'), path.join(__dirname, 'node', 'assets'), { recursive: true });

  // pkg
  console.log('bundle project to executables...');
  await run('cd node && npx pkg --compress Brotli package.json');

  // print information
  console.log('🚚 application built! ');
  const buildProjectFilePath = path.resolve(__dirname, 'node', 'package.json');
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
