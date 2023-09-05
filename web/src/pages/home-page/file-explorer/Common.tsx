import React from "react";
import { Lstat, Rest } from "../../../common/Type";
import { v4 } from "uuid";

namespace FileExplorer {
  export type Type = {
    cd: (path: string | null) => unknown,
    cdToParent: () => unknown,
    config: Config,
    setConfig: (config: Config) => unknown,
    upload: (file: File, dest: Rest.PathLike) => void,
    uploadItems: UploadController[],
    openUploadManagement: () => unknown,
  }
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export const enum SortType { alphabetically = 'alphabetically', date = 'date', type = 'type' };
  export type Config = { showAll: boolean, sort: SortType, uploadCompress: boolean };

  function compare<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  function stringReserveCompare(a: string, b: string) {
    const aLen = a.length;
    const bLen = b.length;
    for (let i = 0; i < aLen && i < bLen; i++) {
      const aCode = a.charCodeAt(aLen - i - 1);
      const bCode = b.charCodeAt(bLen - i - 1);
      if (aCode === bCode) { continue; }
      return aCode - bCode;
    }
    return aLen - bLen;
  }
  export function sortArray(array: Array<[string, Lstat]>, type: SortType) {
    switch (type) {
      case SortType.type:
        return array.sort(([key0, stats0], [key1, stats1]) => {
          const res = compare(stats0.type, stats1.type);
          if (res === 0) {
            return stringReserveCompare(key0, key1);
          }
          return res;
        });
      case SortType.date:
        return array.sort(([_, stats0], [__, stats1]) => compare(stats0.modifiedTime, stats1.modifiedTime));
      case SortType.alphabetically:
        return array.sort(([key0], [key1]) => compare(key0, key1));
    }
  }

  export class UploadController extends EventTarget {
    constructor(props: {
      id: string,
      file: File,
      dest: Rest.PathLike,
      basename: string,
      upload: (onUploadProgress: (progress: ProgressEvent) => unknown,
        onDownloadProgress: (progress: ProgressEvent) => unknown,
        isCanceled: () => boolean,) => Promise<unknown>,
      cancel: () => unknown,
    }) {
      super();
      this.detail = {
        id: props.id,
        file: props.file,
        dest: props.dest,
        basename: props.basename,
        state: UploadController.State.running,
        isClosed: false,
      };
      this.cancel = () => {
        this.detail.state = UploadController.State.cancel;
        this.dispatchEvent(new Event('change'));
        props.cancel();
      };

      props.upload(
        event => this._onUpload(event),
        event => this._onDownload(event),
        () => {
          switch (this.detail.state) {
            case UploadController.State.completed:
            case UploadController.State.error:
            case UploadController.State.cancel:
              return true;
          }
          return false;
        },
      ).then(() => {
        if (this.detail.state === UploadController.State.running) {
          this.detail.state = UploadController.State.completed;
          this.dispatchEvent(new Event('change'));
        }
      }).catch((error) => {
        if (this.detail.state === UploadController.State.running) {
          this.detail.error = error;
          console.log(error);
          this.detail.state = UploadController.State.error;
          this.dispatchEvent(new Event('change'))
        }
      });
    }

    protected _onUpload(event: ProgressEvent) {
      this._upload = event;
      this.dispatchEvent(new CustomEvent('upload', { detail: event }));
    }

    protected _onDownload(event: ProgressEvent) {
      this._download = event;
      this.dispatchEvent(new CustomEvent('download', { detail: event }));
    }

    protected _upload?: ProgressEvent;
    get upload() { return this._upload }

    protected _download?: ProgressEvent;
    get download() { return this._download }

    readonly detail: {
      id: string,
      file: File,
      dest: Rest.PathLike,
      basename: string,
      state: UploadController.State,
      error?: any,
      isClosed: boolean,
    };

    readonly cancel: () => void;

    close() {
      if (this.detail.state !== UploadController.State.completed) {
        this.cancel();
      }
      this.detail.isClosed = true;
      this.dispatchEvent(new Event('change'));
    }
  }

  export namespace UploadController {
    export const enum State {
      running, error, completed, cancel
    }
  }

}

export function useUuidV4() {
  return React.useMemo(() => v4(), []);
}

export default FileExplorer;

export * from "./common/NavigatorBar";
export * from "./common/GoToDialog";
