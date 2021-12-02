import { createWriteStream, PathLike, WriteStream } from "fs";

export interface Logger {
  log: (message: string) => void,
  error: (message: string) => void,
};

export class FileLogger implements Logger {
  constructor(props: { path: PathLike }) {
    this._path = props.path;
    this._fileStream = createWriteStream(this._path);
  }

  protected _path: PathLike;
  protected _fileStream: WriteStream;

  log(message: string) { return this._fileStream.write(`${new Date()} [INFO]  ${message.replace(/(\r\n|\n|\r)/gm, '\\n')}\r\n`); }
  error(message: string) {
    console.warn(message);
    return this._fileStream.write(`${new Date()} [ERROR] ${message.replace(/(\r\n|\n|\r)/gm, '\\n')}\r\n`);
  }
}
