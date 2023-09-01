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
    'token': { parameter: any, return: string | Uint8Array },
    'unzip': { parameter: [string /** src */, PathLike /** dest */], return: void },
    'fs.rename': { parameter: [oldPath: PathLike, newPath: PathLike], return: Awaited<ReturnType<typeof fs.rename>> },
    'fs.unlink': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.unlink>> }, // delete file
    'fs.rm': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.rm>> }, // delete directory
    'fs.exists': { parameter: [path: PathLike], return: boolean },
    'fs.mkdir': { parameter: [path: PathLike], return: Awaited<ReturnType<typeof fs.mkdir>> },
    'fs.writeFile': { parameter: [path: PathLike, data: string], return: Awaited<ReturnType<typeof fs.writeFile>> }, // can't overwrite file
    'fs.cp': { parameter: [oldPath: PathLike, newPath: PathLike], return: Awaited<ReturnType<typeof fs.cp>> },
    'shell': {
      parameter:
      { id: string, data: string | number[] } |                                                          // send data
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
  parent?: string | null,
};

export namespace Watch {
  export type File = Lstat;
  export type Directory = Lstat & { entries: { [filename: string]: Lstat } };
  export type Error = { path?: string | null, error: string }
}

// https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings
export const DECODE_OPTION = [
  'utf-8',
  'utf-16be',
  'utf-16le',
  'ascii',
  'macintosh',
  'iso-8859-2',
  'iso-8859-3',
  'iso-8859-4',
  'iso-8859-5',
  'iso-8859-6',
  'iso-8859-7',
  'iso-8859-8',
  'iso-8859-10',
  'iso-8859-13',
  'iso-8859-14',
  'iso-8859-15',
  'iso-8859-16',
  'koi8-r',
  'koi8-u',
  'windows-874',
  'windows-1250',
  'windows-1251',
  'windows-1253',
  'windows-1254',
  'windows-1255',
  'windows-1256',
  'windows-1257',
  'windows-1258',
  'gbk',
  'gb18030',
  'big5',
  'euc-jp',
  'shift-jis',
  'euc-kr',
];
