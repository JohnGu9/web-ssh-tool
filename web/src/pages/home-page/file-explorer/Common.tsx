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
  export function switchSortType(current: SortType) {
    switch (current) {
      case SortType.alphabetically:
        return SortType.date;
      case SortType.date:
        return SortType.type;
      case SortType.type:
        return SortType.alphabetically;
    }
  }

  function compare<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  export function sortArray(array: Array<[string, Lstat]>, type: SortType) {
    switch (type) {
      case SortType.type:
        return array.sort(([_, stats0], [__, stats1]) => compare(stats0.type, stats1.type));
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
            case UploadController.State.close:
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
      error?: any
    };

    readonly cancel: () => void;

    close() {
      if (this.detail.state !== UploadController.State.completed) {
        this.cancel();
      }
      this.detail.state = UploadController.State.close;
      this.dispatchEvent(new Event('change'));
    }
  }

  export namespace UploadController {
    export const enum State {
      running, error, completed, cancel, close,
    }
  }

}

export function useUuidV4() {
  return React.useMemo(() => v4(), []);
}

export default FileExplorer;

export * from "./common/NavigatorBar";
export * from "./common/GoToDialog";
