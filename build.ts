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

async function main() {
  console.log('running build.ts');

  // sync package
  const nodeProjectFilePath = path.resolve(__dirname, 'node', 'package.json');
  const buildProjectFilePath = path.resolve(__dirname, 'package.json');
  const [buildProjectFile, nodeProjectFile] = await Promise.all([
    fs.readFile(buildProjectFilePath).then(value => value.toString()),
    fs.readFile(nodeProjectFilePath).then(value => value.toString()),
  ]);
  const buildProjectJson = JSON.parse(buildProjectFile);
  const nodeProjectJson = JSON.parse(nodeProjectFile);

  if (Object.entries(nodeProjectJson["dependencies"]).some(
    ([value, version]) => buildProjectJson["dependencies"]?.[value] !== version)
    || Object.entries(nodeProjectJson["optionalDependencies"]).some(
      ([value, version]) => buildProjectJson["optionalDependencies"]?.[value] !== version)) {
    console.log('synchronize packages...');
    buildProjectJson["dependencies"] = nodeProjectJson["dependencies"];
    buildProjectJson["optionalDependencies"] = nodeProjectJson["optionalDependencies"];
    await fs.writeFile(buildProjectFilePath, JSON.stringify(buildProjectJson, null, 2));
    await run('npm i');
  }

  // bundle licenses to frontend
  console.log('checking licenses...');
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
      for (const [name, { licenseFile }] of Object.entries(licenses)) {
        if (licenseFile) {
          const buffer0 = Buffer.from(`\n${name}\n`);
          const buffer1 = await fs.readFile(licenseFile);
          const buffer2 = Buffer.from('\n\n');
          const buffer = Buffer.concat([buffer0, buffer1, buffer2]);
          await fs.appendFile(target, buffer);
        }
      }
      break;
    }
  }

  // pkg
  console.log('bundle project to executables...')
  await fs.copyFile(path.resolve(__dirname, 'node', 'index.js'), 'index.js');
  await run('npx pkg --compress Brotli package.json');

  // clean up
  console.log('clean up useless files');
  fs.unlink('index.js');

  // print information
  console.log('🚚 application built! ');
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
