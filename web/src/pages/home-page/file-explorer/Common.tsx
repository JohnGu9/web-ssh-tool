import { Stats } from "fs";
import React from "react";

namespace FileExplorer {
  export type Type = {
    cd: (path?: string) => unknown,
    config: Config,
    setConfig: (config: Config) => unknown,
    upload: (file: File, dest: string) => void,
    uploadItems: UploadController[],
  }
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export const enum SortType { alphabetically = 'alphabetically', date = 'date', none = 'none' };
  export type Config = { showAll: boolean, sort: SortType };
  export function switchSortType(current: SortType) {
    switch (current) {
      case SortType.alphabetically:
        return SortType.date;
      case SortType.date:
        return SortType.none;
      case SortType.none:
        return SortType.alphabetically;
    }
  }

  function compare<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  export function sortArray(array: Array<[string, Stats]>, type: SortType) {
    switch (type) {
      case SortType.none:
        return array;
      case SortType.date:
        return array.sort(([_, stats0], [__, stats1]) => compare(stats0.mtime, stats1.mtime));
      case SortType.alphabetically:
        return array.sort(([key0], [key1]) => compare(key0, key1));
    }
  }

  export class UploadController extends EventTarget {
    constructor(props: {
      id: string,
      file: File,
      dest: string,
      fullPath: string,
      upload: (onUploadProgress: (progress: ProgressEvent) => unknown,
        onDownloadProgress: (progress: ProgressEvent) => unknown,) => Promise<Express.Multer.File>,
      operate: (file: Express.Multer.File) => Promise<unknown>,
      cancel: () => unknown,
    }) {
      super();
      this.cancel = () => {
        this.detail.state = UploadController.State.cancel;
        this.dispatchEvent(new Event('change'));
        props.cancel();
      };
      this.detail = {
        id: props.id,
        file: props.file,
        dest: props.dest,
        fullPath: props.fullPath,
        state: UploadController.State.upload,
      };
      props.upload(
        event => this._onUpload(event),
        event => this._onDownload(event),
      ).then((file) => {
        if ('error' in file) {
          this.detail.error = (file as unknown as any).error;
          this.detail.state = UploadController.State.error;
          this.dispatchEvent(new Event('change'));
        } else if (this.detail.state !== UploadController.State.cancel) {
          this.detail.state = UploadController.State.operate;
          this.dispatchEvent(new Event('change'));
          return props.operate(file).then(() => {
            this.detail.state = UploadController.State.close;
            this.dispatchEvent(new Event('change'))
          });
        }
      }).catch((error) => {
        this.detail.error = error;
        if (this.detail.state !== UploadController.State.cancel) {
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
      dest: string,
      fullPath: string,
      state: UploadController.State,
      error?: any
    };

    readonly cancel: () => void;
    cleanup() {
      if (this.detail.state === UploadController.State.error) {
        this.detail.state = UploadController.State.cancel;
        this.dispatchEvent(new Event('change'));
      }
    }
  }

  export namespace UploadController {
    export const enum State {
      upload, operate, error, close, cancel
    }
  }

}

export default FileExplorer;

export * from "./common/NavigatorBar";
export * from "./common/GoToDialog";