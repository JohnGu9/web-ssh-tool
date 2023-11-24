import React from "react";
import { Lstat, Rest, Watch } from "../../../common/Type";
import { Server } from "../../../common/Providers";
import { SharedAxis, SharedAxisTransform } from "material-design-transform";
import { LinearProgress } from "rmcw";
import DirectoryPreView from "./DirectoryPreview";
import ErrorPreview from "./ErrorPreview";
import FilePreview from "./FilePreview";
import Loading from "./Loading";
import { v1 as uuid } from 'uuid';
import GoToDialog from "./common/GoToDialog";
import LostConnection from "./LostConnection";

// eslint-disable-next-line react-refresh/only-export-components
export * from "./common/NavigatorBar";
// eslint-disable-next-line react-refresh/only-export-components
export * from "./common/GoToDialog";

function FileExplorer({ controller, config, setConfig, upload, uploadItems, openUploadManagement, reconnect }: {
  controller: FileExplorer.Controller,
  config: FileExplorer.Config,
  setConfig: (config: FileExplorer.Config) => unknown,
  upload: (file: File, dest: Rest.PathLike) => void,
  uploadItems: FileExplorer.UploadController[],
  openUploadManagement: () => unknown,
  reconnect: () => Promise<unknown>,
}) {
  const [closed, setClosed] = React.useState(controller.isClosed);
  const [{ updating: loading, state }, setState] = React.useState(controller.state);
  const [transitionStyle, setTransitionStyle] = React.useState({ t: SharedAxisTransform.fromRightToLeft, p: state?.path });
  React.useEffect(() => {
    const listener = () => {
      setTransitionStyle(current => {
        const path = controller.state.state?.path;
        const currentPath = current.p;
        if (path === undefined || path === null) {
          return { t: SharedAxisTransform.fromRightToLeft, p: path };
        } else if (currentPath === undefined || currentPath === null) {
          return { t: SharedAxisTransform.fromLeftToRight, p: path };
        } else {
          return {
            t: path.length > currentPath.length ?
              SharedAxisTransform.fromRightToLeft :
              SharedAxisTransform.fromLeftToRight,
            p: path
          };
        }
      });
      setState(controller.state);
    };
    controller.addEventListener('change', listener);
    return () => {
      controller.removeEventListener('change', listener);
    };
  }, [controller]);

  React.useEffect(() => {
    const listener = () => {
      setClosed(controller.isClosed);
    };
    controller.addEventListener('close', listener);
    return () => controller.removeEventListener('close', listener);
  }, [controller]);

  const keyId = (() => {
    const path = state?.path;
    if (closed) return 0;
    if (state === undefined) return `0${path}`;
    else if ('error' in state) return `1${path}`;
    else if ('entries' in state) return `2${path}`;
    return `3${path}`;
  })();

  const [goToDialog, setGoToDialog] = React.useState<GoToDialog.State>({ open: false, path: '' });

  return (
    <FileExplorer.Context.Provider value={{
      cd: (p) => controller.cd(p),
      cdToParent: () => controller.cdToParent(),
      config,
      uploadItems,
      setConfig,
      upload,
      openUploadManagement,
      setGoToDialog,
    }}>
      <SharedAxis
        className='full-size'
        forceRebuildAfterSwitched={false}
        transform={transitionStyle.t}
        keyId={keyId}
        style={{
          pointerEvents: loading ? 'none' : 'auto',
          position: 'relative'
        }}>
        <LinearProgress style={{ position: 'absolute', top: 0 }} closed={!loading} />
        <Content state={state} closed={closed} reconnect={reconnect} />
      </SharedAxis>
      <GoToDialog
        state={goToDialog}
        close={() => setGoToDialog(v => { return { ...v, open: false } })} />
    </FileExplorer.Context.Provider>
  );
}

namespace FileExplorer {
  export type ControllerState = Watch.Error | Watch.File | Watch.Directory;

  export class Controller extends EventTarget {
    constructor({ auth }: { auth: Server.Authentication.Type }) {
      super();
      this.auth = auth;
      this.open();
    }

    readonly auth: Server.Authentication.Type;
    readonly id = uuid();

    cd(path: string | null) {
      this._updating = true;
      this.dispatchEvent(new Event('change'));
      return this.auth.rest('watch', { id: this.id, cd: path });
    }

    cdToParent() {
      this._updating = true;
      this.dispatchEvent(new Event('change'));
      return this.auth.rest('watch', { id: this.id, cdToParent: null });

    }

    close() {
      return this.auth.rest('watch', { id: this.id, close: {} });
    }
    protected closed = false;
    get isClosed() { return this.closed }

    dispose() {
      if (!this.closed) this.close();
    }

    protected _updating = true;
    protected _state: ControllerState | undefined;
    get state() {
      return {
        updating: this._updating,
        state: this._state
      };
    }

    protected readonly _listener = (event: Event) => {
      const { detail } = event as CustomEvent;
      if ('close' in detail) {
        this.dispatchEvent(new Event('close'));
      } else {
        const path = detail.path as string | null | undefined;
        const error = detail.error as string | null | undefined;
        if (typeof error === 'string') {
          this._state = { path, error };
        } else {
          this._state = detail;
        }
        this._updating = false;
        this.dispatchEvent(new Event('change'));
      }
    }

    protected async open() {
      this.addEventListener('close', () => {
        this.auth.watch.removeEventListener(this.id, this._listener);
        this.closed = true;
        console.log(`file-explorer(${this.id}) closed`);
      }, { once: true });
      this.auth.watch.addEventListener(this.id, this._listener);
      const result = await this.auth.rest('watch', this.id);
      if (Rest.isError(result)) this.dispatchEvent(new Event('close'));
    }
  }

  export type Type = {
    cd: (path: string | null) => unknown,
    cdToParent: () => unknown,
    config: Config,
    setConfig: (config: Config) => unknown,
    upload: (file: File, dest: Rest.PathLike) => void,
    uploadItems: UploadController[],
    openUploadManagement: () => unknown,
    setGoToDialog: React.Dispatch<React.SetStateAction<GoToDialog.State>>,
  }
  export const Context = React.createContext<Type>(undefined as unknown as Type);

  export const enum SortType { alphabetically = 'alphabetically', date = 'date', type = 'type' }
  export type Config = { showAll: boolean, sort: SortType, uploadCompress: boolean };


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
        return array.sort(([, stats0], [, stats1]) => compare(stats0.modifiedTime, stats1.modifiedTime));
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
          // console.log(error);
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

    get id() { return this.detail.id }

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
      error?: unknown,
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

function Content({ state, closed, reconnect }: {
  state?: FileExplorer.ControllerState,
  closed: boolean,
  reconnect: () => Promise<unknown>,
}) {
  if (closed) return <LostConnection reconnect={reconnect} />;
  if (state === undefined) return <Loading />;
  else if ('error' in state) return <ErrorPreview state={state} />;
  else if ('entries' in state) return <DirectoryPreView state={state} />;
  return <FilePreview state={state} />;
}

export default FileExplorer;

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
