export type ProcessPipeLine = ({ stdin: string } | { stdout: string } | { stderr: string })[];
export type CommandResult = { output: ProcessPipeLine, exitCode: number | null };

export const enum FileType {
  file,
  directory,
  blockDevice,
  characterDevice,
  symbolicLink,
  fifo,
  socket
};

export namespace Rest {
  export type Map = {
    'token': { parameter: any, return: string }
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