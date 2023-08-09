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
  export type PathLike = string[];
  export type Map = {
    'token': { parameter: any, return: string },
    'unzip': { parameter: [string /** src */, PathLike /** dest */], return: void },
    'fs.rename': { parameter: [oldPath: PathLike, newPath: PathLike], return: Awaited<ReturnType<typeof fs.rename>> },
    'fs.unlink': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.unlink>> },
    'fs.rm': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.rm>> },
    'fs.exists': { parameter: [path: PathLike], return: boolean },
    'fs.mkdir': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.mkdir>> },
    'fs.writeFile': { parameter: [path: PathLike, data: string], return: Awaited<ReturnType<typeof fs.writeFile>> },
    'fs.cp': { parameter: [oldPath: PathLike, newPath: PathLike], return: Awaited<ReturnType<typeof fs.cp>> },
    'shell': {
      parameter:
      { id: string, data: string } |                                                          // send data
      { id: string, close: any } |                                                            // request close
      { id: string, resize: { rows: number, cols: number, height: number, width: number } } | // resize window
      string,                                                                                 // request open new shell with id
      return: void
    },
    'watch': {
      parameter:
      { id: string, cd: string | null } |
      { id: string, cdToParent: null } |                                                       // send data
      { id: string, close: any } |                                                            // request close
      string,                                                                                 // request open new shell with id
      return: void
    },
  }
  export namespace Map {
    export type Parameter<Key extends keyof Map> = Map[Key] extends { parameter: infer R } ? R : never;
    export type Return<Key extends keyof Map> = Map[Key] extends { return: infer R } ? R : never;
  }
  export type Error = { error: any };

  export function isError(value: any): value is Error {
    return typeof value === 'object' && value !== null && 'error' in value;
  }
}

export type Lstat = {
  type?: FileType | null, path?: string | null, basename?: string | null, size?: number,
  createdTime?: string | null, accessedTime?: string | null, modifiedTime?: string | null,
  realPath?: string | null, realType?: FileType | null,
};

export namespace Watch {
  export type File = Lstat;
  export type Directory = Lstat & { entries: { [filename: string]: Lstat } };
}
