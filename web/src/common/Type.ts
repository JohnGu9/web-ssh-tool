import { Stats } from 'fs';
import fs from 'fs/promises';

export type ProcessPipeLine = ({ stdin: string } | { stdout: string } | { stderr: string })[];
export type CommandResult = { output: ProcessPipeLine, exitCode: number | null };

export const enum FileType {
  file = 'file',
  directory = 'directory',
  blockDevice = 'block device',
  characterDevice = 'character device',
  symbolicLink = 'symbolic link',
  fifo = 'fifo',
  socket = 'socket'
};

export namespace Rest {
  export type Map = {
    'token': { parameter: any, return: string },
    'fs.rename': { parameter: Parameters<typeof fs.rename>, return: Awaited<ReturnType<typeof fs.rename>> },
    'fs.unlink': { parameter: Parameters<typeof fs.unlink>, return: Awaited<ReturnType<typeof fs.unlink>> },
    'fs.rm': { parameter: Parameters<typeof fs.rm>, return: Awaited<ReturnType<typeof fs.rm>> },
    'fs.exists': { parameter: Parameters<typeof fs.access>, return: boolean },
    'fs.mkdir': { parameter: Parameters<typeof fs.mkdir>, return: Awaited<ReturnType<typeof fs.mkdir>> },
    'fs.writeFile': { parameter: Parameters<typeof fs.writeFile>, return: Awaited<ReturnType<typeof fs.writeFile>> },
    'shell': {
      parameter:
      { id: string, data: string } | // request close
      { id: string, close: any } | // send data
      string, // request open new shell with id
      return: { open: string } | void
    }
  }
  export type Type = keyof Map;
  export namespace Map {
    export type Parameter<Key extends keyof Map> = Map[Key] extends { parameter: infer R } ? R : never;
    export type Return<Key extends keyof Map> = Map[Key] extends { return: infer R } ? R : never;
  }
  export type Error = { error: any };

  export function isError(value: any): value is Error {
    return typeof value === 'object' && 'error' in value;
  }
}

export namespace Watch {
  export type File = { path: string, content: string, lstat: Stats & { type?: FileType } }
  export type Directory = { path: string, files: { [key: string]: Stats & { type?: FileType } }, lstat: Stats }
}