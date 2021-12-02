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

// typescript 4.5 offer built-in Awaited to unwrap PromiseLike type
// ready to remove when project upgrade to typescript 4.5
export type Await<T> = T extends PromiseLike<infer U> ? U : T;
export type AwaitProps<T> = { [P in keyof T]: Await<T[P]> }

export async function concurrent<T extends object>(obj: T): Promise<AwaitProps<T>> {
  const result: { [key: string]: unknown } = {};
  for (const [key, value] of Object.entries(obj)) result[key] = await value;
  return result as AwaitProps<T>;
}
