import { ProcessPipeLine } from "./Type";

export function sliceOutput(output: ProcessPipeLine) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const stdin: string[] = [];
  for (const data of output) {
    if ('stdout' in data) stdout.push(data.stdout);
    else if ('stderr' in data) stderr.push(data.stderr);
    else if ('stdin' in data) stdin.push(data.stdin);
  }
  return {
    stdout: stdout.join(''),
    stderr: stderr.join(''),
    stdin: stdin.join(''),
  };
}

export { default as delay } from './Delay';

export type AwaitProps<T> = { [P in keyof T]: Awaited<T[P]> }

export async function concurrent<T extends object>(obj: T): Promise<AwaitProps<T>> {
  const result: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(obj)) result[key] = await value;
  return result as AwaitProps<T>;
}

export function fileSize(size: number) {
  if (size > (1024 * 1024 * 1024)) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB (${size} bytes)`;
  else if (size > (1024 * 1024)) return `${(size / (1024 * 1024)).toFixed(2)} MB (${size} bytes)`;
  else if (size > 1024) return `${(size / (1024)).toFixed(2)} KB (${size} bytes)`;
  else return `${size} Bytes`;
}
