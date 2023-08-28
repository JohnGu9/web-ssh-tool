import React from "react";
import { Elevation, LinearProgress, CircularProgress, IconButton, Icon, Tooltip, Dialog, Button, ListItem } from 'rmcw';
import { v1 as uuid } from 'uuid';

import { FileSize, delay } from "../../common/Tools";
import { Server, Settings } from "../../common/Providers";
import { Rest, Watch } from "../../common/Type";
import AnimatedList from "../../components/AnimatedList";

import FilePreview from "./file-explorer/FilePreview";
import DirectoryPreView from "./file-explorer/DirectoryPreview";
import Loading from "./file-explorer/Loading";
import ErrorPreview from "./file-explorer/ErrorPreview";
import Common from './file-explorer/Common';
import { SharedAxis, SharedAxisTransform } from "material-design-transform";
import { AnimatedSize } from "animated-size";
import { compress } from "../workers/Compress";

// @TODO: real multi explorer support

class MultiFileExplorer extends React.Component<MultiFileExplorer.Props, MultiFileExplorer.State>{
  constructor(props: MultiFileExplorer.Props) {
    super(props);
    this._controller = new MultiFileExplorer.Controller({ auth: props.auth });
    this._controller.addEventListener('close', this._onExplorerControllerClose.bind(this));
    this._uploadItems = [];
    this.state = {
      config: { showAll: false, sort: Common.SortType.alphabetically, uploadCompress: false },
      uploadItems: this._uploadItems,
      uploadManagementOpen: false,
    };
  }
  _controller: MultiFileExplorer.Controller;
  _uploadItems: Common.UploadController[];
  protected _mounted = true;

  protected async _onExplorerControllerClose() {
    this._controller.dispose();
    if (this._mounted) {
      await delay(1000);
      this._controller = new MultiFileExplorer.Controller({ auth: this._controller.auth });
      this._controller.addEventListener('close', this._onExplorerControllerClose.bind(this));
      this.setState({});
    }
  }

  protected _readFileAsArrayBuffer(file: File) {
    return new Promise<string | ArrayBuffer | null | undefined>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target?.result);
      reader.onerror = reject;
      reader.onabort = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  protected _upload(file: File, dest: Rest.PathLike) {
    const { auth } = this.props;
    const abort = new AbortController();
    const target = [...dest, file.name];

    let fileGuard = false;
    const createPlaceholderFile = async () => {
      let res = await auth.rest('fs.writeFile',
        [target, "# Web-ssh-tool try to create file here. Don't edit/move/delete this file"]);
      if (Rest.isError(res)) {
      } else {
        fileGuard = true;
      }
      return res;
    }
    const releaseFileGuard = async () => {
      if (fileGuard) {
        fileGuard = false;
        await auth.rest('fs.unlink', [target]);
      }
    };

    const cancel = async () => {
      abort.abort();
      releaseFileGuard();
    };

    const controller = !this.state.config.uploadCompress ?
      new Common.UploadController({
        id: uuid(), file, dest, basename: file.name,
        upload: async (onUploadProgress, onDownloadProgress, isClosed) => {
          const result = await createPlaceholderFile();
          if (Rest.isError(result)) throw result.error;
          if (isClosed()) return await releaseFileGuard();
          try {
            await auth.upload(file, dest, file.name, {
              signal: abort.signal,
              onUploadProgress,
              onDownloadProgress,
            });
            fileGuard = false;
          } catch (error) {
            await releaseFileGuard();
            throw error;
          }

        },
        cancel,
      }) :
      new Common.UploadController({
        id: uuid(), file, dest, basename: file.name,
        upload: async (onUploadProgress, onDownloadProgress, isClosed) => {
          const [compressed, result] = await Promise.all([
            (async () => {
              // build compress data
              try {
                const buffer = await this._readFileAsArrayBuffer(file);
                if (buffer !== null && buffer instanceof ArrayBuffer) {
                  return await compress(buffer);
                } else {
                  throw new Error(`Read file [${file.name}] failed`);
                }
              } catch (error) {
                return { error };
              }

            })(),
            createPlaceholderFile(),
          ]);
          if (Rest.isError(result)) throw result.error;
          if (isClosed()) return await releaseFileGuard();
          if ('error' in compressed) {
            await releaseFileGuard();
            throw compressed.error;
          }

          const compressedFile = new File([compressed], file.name);
          let multer: Express.Multer.File;
          try {
            multer = await auth.upload(compressedFile, dest, null, {
              signal: abort.signal,
              onUploadProgress,
              onDownloadProgress,
            });
          } catch (error) {
            await releaseFileGuard();
            throw error;
          }

          if (isClosed()) {
            await Promise.all([
              releaseFileGuard(),
              auth.rest('fs.unlink', [[multer.path]]),
            ]);
          } else {
            const unzipResult = await auth.rest('unzip', [multer.path, target]);
            await auth.rest('fs.unlink', [[multer.path]]);
            if (Rest.isError(unzipResult)) {
              await releaseFileGuard();
              throw unzipResult.error;
            } else {
              fileGuard = false;
            }
          }
        },
        cancel,
      });
    const listener = () => {
      const { detail: { state } } = controller;
      switch (state) {
        case Common.UploadController.State.close:
          controller.removeEventListener('change', listener);
          if (this._mounted) {
            this._uploadItems = this._uploadItems.filter(value => {
              return value.detail.state !== Common.UploadController.State.close;
            });
            this.setState({ uploadItems: this._uploadItems });
          }
      }
    }
    controller.addEventListener('change', listener);
    this._uploadItems.push(controller);
    this.setState({
      uploadItems: [...this._uploadItems],
      uploadManagementOpen: true,
    });
  }

  override componentWillUnmount(): void {
    this._mounted = false;
    this._controller.dispose();
    this._uploadItems.forEach(v => v.close());
  }

  override render() {
    const { config, uploadItems, uploadManagementOpen } = this.state;
    const closeUploadManagement = () => this.setState({ uploadManagementOpen: false });
    return (
      <Common.Context.Provider value={{
        config, uploadItems,
        setConfig: config => this.setState({ config }),
        cd: (p) => this._controller.cd(p),
        cdToParent: () => this._controller.cdToParent(),
        upload: (file, dest) => this._upload(file, dest),
        openUploadManagement: () => this.setState({ uploadManagementOpen: true }),
      }}>

        <MyResize>
          <Elevation className='full-size column' depth={2}
            style={{ paddingBottom: 16, }}>
            <MultiFileExplorer.FileExplorer controller={this._controller} />
          </Elevation>
        </MyResize>

        <Dialog open={uploadManagementOpen}
          fullscreen
          onScrimClick={closeUploadManagement}
          onEscapeKey={closeUploadManagement}
          title="Upload"
          actions={<>
            <Button
              leading={<Icon>upload</Icon>}
              onClick={(e) => {
                e.preventDefault();
                const input = document.createElement('input');
                input.type = "file";
                input.multiple = true;
                input.onchange = (e) => {
                  const input = e.target as HTMLInputElement;
                  const { files } = input;
                  const { state } = this._controller.state;
                  if (files !== null && state !== undefined && typeof state.path === 'string') {
                    for (let i = 0; i < files.length; i++) {
                      const file = files.item(i);
                      if (file !== null) {
                        this._upload(file, [state.path]);
                      }
                    }
                  }
                };
                input.click();
              }}>Upload local files</Button>
            <div style={{ flex: 1 }} />
            <Button
              disabled={uploadItems.length === 0}
              onClick={() => {
                const uploadItems = this._uploadItems;
                this._uploadItems = [];
                this.setState({ uploadItems: this._uploadItems });
                for (const item of Array.from(uploadItems))
                  item.close();
              }}>clear all</Button>
            <Button onClick={closeUploadManagement}>close</Button>
          </>}>
          <AnimatedSize heightFactor={uploadItems.length === 0 ?
            {} :
            { size: 0 }}>No upload task</AnimatedSize>
          <AnimatedList>
            {uploadItems.map(value => {
              return {
                listId: value.detail.id,
                children: <AnimatedList.Wrap><UploadItem key={value as any} controller={value} /></AnimatedList.Wrap>,
              }
            })}
          </AnimatedList>
        </Dialog>

      </Common.Context.Provider>
    );
  }
}

namespace MultiFileExplorer {
  export type Props = {
    readonly settings: Settings.Type,
    readonly server: Server.Type,
    readonly auth: Server.Authentication.Type,
  };

  export type State = {
    config: Common.Config,
    uploadItems: Common.UploadController[],
    uploadManagementOpen: boolean,
  };

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
      if ('close' in detail) this.dispatchEvent(new Event('close'));
      else {
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
      }, { once: true });
      this.auth.watch.addEventListener(this.id, this._listener);
      const result = await this.auth.rest('watch', this.id);
      if (Rest.isError(result)) this.dispatchEvent(new Event('close'));
    }
  };

  export function FileExplorer({ controller }: { controller: Controller }) {
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

    const keyId = (() => {
      const path = state?.path;
      if (state === undefined) return `0${path}`;
      else if ('error' in state) return `1${path}`;
      else if ('entries' in state) return `2${path}`;
      return `3${path}`;
    })();

    return (
      <SharedAxis
        className='full-size'
        transform={transitionStyle.t}
        keyId={keyId}
        style={{
          pointerEvents: loading ? 'none' : 'auto',
          position: 'relative'
        }}>
        <LinearProgress style={{ position: 'absolute', top: 0 }} closed={!loading} />
        <Content state={state} />
      </SharedAxis>
    );
  }
}

function MyResize({ children }: { children: React.ReactNode }) {
  const [enable, setEnable] = React.useState(0);
  const [width, setWidth] = React.useState(320);
  const startDrag = enable > 0;
  React.useEffect(() => {
    const onUp = () => setEnable(v => Math.max(v - 1, 0));
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
    }
  });
  React.useEffect(() => {
    if (startDrag) {
      const onMove = (e: Event) => {
        e.preventDefault();
        setWidth(width => Math.max(width - (e as MouseEvent).movementX, 300));
      };
      window.addEventListener('mousemove', onMove);
      return () => {
        window.removeEventListener('mousemove', onMove);
      }
    }
  }, [startDrag]);
  return (
    <div style={{ position: 'relative', height: '100%', width }}>
      {children}
      <div style={{ position: 'absolute', height: '100%', width: 8, left: 0, top: 0, cursor: 'ew-resize' }}
        onMouseDown={(e) => {
          e.preventDefault();
          setEnable(v => v + 1);
        }}></div>
    </div>
  );
}

function Content({ state }: { state?: MultiFileExplorer.ControllerState }) {
  if (state === undefined) return <Loading />;
  else if ('error' in state) return <ErrorPreview state={state} />;
  else if ('entries' in state) return <DirectoryPreView state={state} />;
  return <FilePreview state={state} />;
}

function UploadItem(props: { controller: Common.UploadController }) {
  const [state, setState] = React.useState<Common.UploadController.State>(props.controller.detail.state);
  const [upload, setUpload] = React.useState(props.controller.upload);
  React.useEffect(() => {
    const { controller } = props;
    const onChange = () => setState(controller.detail.state);
    const onUpload = () => setUpload(controller.upload);
    controller.addEventListener('change', onChange);
    controller.addEventListener('upload', onUpload);
    return () => {
      controller.removeEventListener('change', onChange);
      controller.removeEventListener('upload', onUpload);
    };
  });
  const { controller: { detail: { file, dest, error } } } = props;
  return (
    <ListItem
      graphic={
        <SharedAxis
          keyId={state}
          transform={SharedAxisTransform.fromRightToLeft}
          forceRebuildAfterSwitched={false}
          style={{ width: 24 }}>
          {(() => {
            switch (state) {
              case Common.UploadController.State.running: {
                if (upload && upload.lengthComputable) {
                  if (upload.lengthComputable) {
                    const progress = upload.loaded / upload.total;
                    return (
                      <Tooltip label={`${(progress * 100).toFixed(1)} %; ${FileSize(upload.loaded)}; ${FileSize(upload.total)}`}>
                        <CircularProgress progress={progress} sizing='Small' />
                      </Tooltip>
                    );
                  } else {
                    return (
                      <Tooltip label={FileSize(upload.loaded)}>
                        <CircularProgress sizing='Small' />
                      </Tooltip>
                    );
                  }
                } else {
                  return <Tooltip label='Initialization'>
                    <CircularProgress sizing='Small' />
                  </Tooltip>;
                }

              }
              case Common.UploadController.State.error: {
                return <Icon>error</Icon>;
              }
              case Common.UploadController.State.cancel:
                return <Icon >cancel</Icon>;
              default:
                return <Icon>checked</Icon>;

            }
          })()}
        </SharedAxis>
      }
      primaryText={file.name}
      secondaryText={(() => {
        switch (state) {
          case Common.UploadController.State.error: {
            return <>{`${error}`}</>;
          }
        }
        return <>{dest}</>;
      })()}
      meta={
        <SharedAxis
          keyId={state}
          transform={SharedAxisTransform.fromTopToBottom}
          forceRebuildAfterSwitched={false}>
          {(() => {
            switch (state) {
              case Common.UploadController.State.running:
                return <IconButton onClick={() => props.controller.cancel()}>
                  <Icon>close</Icon>
                </IconButton>;
              default:
                return <IconButton onClick={() => props.controller.close()} >
                  <Icon>close</Icon>
                </IconButton>;
            }
          })()}
        </SharedAxis>
      }
    />
  );
}


export default MultiFileExplorer;
