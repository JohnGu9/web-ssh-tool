import { spawn } from 'child_process';
import process from 'process';

import { ProcessPipeLine, CommandResult } from 'web/common/Type';
import { sliceOutput } from 'web/common/Tools';
import { WebSocket } from 'ws';
import { promises as fs } from 'fs';

export * from 'web/common/Tools';

export async function exists(...argv: Parameters<typeof fs.access>) {
  try {
    await fs.access(...argv);
    return true;
  } catch (error) {
    return false;
  }
}

// https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
// https://nodejs.org/api/child_process.html#class-childprocess
export const exec = (command: string) => {
  return new Promise<CommandResult>((resolve, reject) => {
    const output: ProcessPipeLine = [];
    const process = spawn(command, { shell: true });
    process.stdout.on('data', data => { output.push({ stdout: `${data}` }) });
    process.stderr.on('data', data => { output.push({ stderr: `${data}` }) });
    process
      .on('error', error => {
        process.removeAllListeners();
        reject({ ...error, output: output, exitCode: null });
      })
      .on('exit', code => {
        process.removeAllListeners();
        if (code === 0)
          resolve({ output: output, exitCode: code });
        else
          reject({ name: 'ExecError', message: sliceOutput(output).stderr, output: output, exitCode: code });
      });
  })
}

export function chunk(str: string, size: number) {
  return str.match(new RegExp('.{1,' + size + '}', 'g'));
}

export function getArgv(...candidates: string[]) {
  const argv = process.argv;

  function getParament(value: string) {
    const eqIndex = value.indexOf('=');
    if (eqIndex === -1) throw new Error(`Arguments error [${value}] format error`);
    return value.substring(eqIndex + 1).split('"')[0];
  }

  const target = argv.find((value) => {
    for (const candidate of candidates) {
      if (value.startsWith(candidate))
        return true;
    }
    return false;
  });

  if (target === undefined) return undefined;
  else return getParament(target);
}

export function isArgvExists(...candidates: string[]) {
  const argv = process.argv;
  const target = argv.find((value) => {
    for (const candidate of candidates) {
      if (value.startsWith(candidate))
        return true;
    }
    return false;
  });
  return target !== undefined;
}

export function wsSafeClose(ws: WebSocket) {
  switch (ws.readyState) {
    case WebSocket.CLOSED:
    case WebSocket.CLOSING:
      return;
  }
  ws.close();
}
