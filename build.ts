import path from 'path';
import { promises as fs } from 'fs';
import { exec as execCallback } from 'child_process';
import util from 'util';
import licenseChecker, { ModuleInfos } from 'license-checker';

export { };

const exec = util.promisify(execCallback);

function any<T>(array: Array<T>, test: (value: T) => boolean) {
  for (const value of array) {
    if (test(value)) return true;
  }
  return false;
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

  const nodeProjectFilePath = path.resolve(__dirname, 'node', 'package.json');
  const buildProjectFilePath = path.resolve(__dirname, 'package.json');
  const [buildProjectFile, nodeProjectFile] = await Promise.all([
    fs.readFile(buildProjectFilePath).then(value => value.toString()),
    fs.readFile(nodeProjectFilePath).then(value => value.toString()),
  ]);
  const buildProjectJson = JSON.parse(buildProjectFile);
  const nodeProjectJson = JSON.parse(nodeProjectFile);

  if (any(Object.entries(nodeProjectJson["dependencies"]),
    ([value, version]) => buildProjectJson["dependencies"]?.[value] !== version)
    || any(Object.entries(nodeProjectJson["optionalDependencies"]),
      ([value, version]) => buildProjectJson["optionalDependencies"]?.[value] !== version)) {
    console.log('Sync node_modules...');
    buildProjectJson["dependencies"] = nodeProjectJson["dependencies"];
    buildProjectJson["optionalDependencies"] = nodeProjectJson["optionalDependencies"];
    const { stdout, stderr } = await exec('npm i');
    console.log(stdout);
    console.warn(stderr);
  }

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
      for (const [name, value] of Object.entries(licenses)) {
        if (value.licenseFile) {
          const buffer0 = Buffer.from(`\n${name}\n`);
          const buffer1 = await fs.readFile(value.licenseFile);
          const buffer2 = Buffer.from('\n');
          const buffer = Buffer.concat([buffer0, buffer1, buffer2]);
          await fs.appendFile(target, buffer);
        }
      }
      break;
    }
  }

  console.log('bundle project to executables...')
  await fs.copyFile(path.resolve(__dirname, 'node', 'index.js'), 'index.js');
  await exec('npx pkg --compress Brotli package.json');

  console.log('clean up useless files');
  fs.unlink('index.js');

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
