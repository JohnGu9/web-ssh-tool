import React from "react";
import { Elevation, LinearProgress, CircularProgress, Typography, IconButton, Icon, Tooltip, Theme } from 'rmwc';
import { v1 as uuid } from 'uuid';
import path from "path-browserify";

import { wsSafeClose } from "../../common/DomTools";
import { Server, Settings } from "../../common/Providers";
import { Rest, Watch } from "../../common/Type";
import { SharedAxisTransition } from "../../components/Transitions";
import AnimatedList from "../../components/AnimatedList";

import FilePreview from "./file-explorer/FilePreview";
import DirectoryPreView from "./file-explorer/DirectoryPreview";
import LostConnection from "./file-explorer/LostConnection";
import Loading from "./file-explorer/Loading";
import ErrorPreview, { UnknownErrorPreview } from "./file-explorer/ErrorPreview";
import Common from './file-explorer/Common';
import { SimpleListItem } from "rmwc";
import { FileSize } from "../../common/Tools";

// @ts-ignore: Unreachable code error
import Worker from './FileExplorer.worker';

const { host } = document.location;
let tag = 0;

class FileExplorer extends React.Component<FileExplorer.Props, FileExplorer.State> {
  constructor(props: FileExplorer.Props) {
    super(props);
    this.state = {
      closed: false,
      loading: false,
      config: { showAll: false, sort: Common.SortType.alphabetically },
      uploadItems: [],
    };
  }

  protected readonly _worker = new Worker();
  protected _mounted = true;
  protected _ws!: WebSocket;
  protected readonly _onError = () => { wsSafeClose(this._ws) }
  protected readonly _onClose = (event: CloseEvent) => { this.setState({ closed: true, state: undefined }) }
  protected readonly _onOpen = async () => {
    this.setState({ closed: false, state: undefined })
    const token = await this.props.auth.rest('token', []);
    if (Rest.isError(token)) {
      // unexpected case
    } else if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.addEventListener('message', this._onMessage);
      if (this.props.settings.lastPath === null)
        this._ws.send(JSON.stringify({ token }));
      else
        this._ws.send(JSON.stringify({ token, cd: this.props.settings.lastPath }));
    }
  }
  protected readonly _onMessage = ({ data }: MessageEvent<string>) => {
    const state = JSON.parse(data);
    this.setState({ state, loading: false });
  }

  protected _bind(ws: WebSocket) {
    ws.addEventListener('open', this._onOpen, { once: true });
    ws.addEventListener('close', this._onClose, { once: true });
    ws.addEventListener('error', this._onError, { once: true });
  }

  protected _unbind(ws: WebSocket) {
    ws.removeEventListener('open', this._onOpen);
    ws.removeEventListener('message', this._onMessage);
    ws.removeEventListener('close', this._onClose);
    ws.removeEventListener('error', this._onError);
  }

  protected _cd(cd?: string) {
    this.setState({ loading: true });
    this._ws.send(JSON.stringify({ cd }));
    if (cd === undefined) this.props.settings.setLastPath(null);
    else this.props.settings.setLastPath(cd);
  }

  protected _upload(file: File, dest: string) {
    const { auth } = this.props;
    const abort = new AbortController();
    const target = path.join(dest, file.name);
    const controller = new Common.UploadController({
      id: uuid(), file, dest, fullPath: target,
      upload: async (onUploadProgress, onDownloadProgress) => {
        const [deflate, result] = await Promise.all([
          (async () => {
            // build compress data
            const buffer = await new Promise<string | ArrayBuffer | null | undefined>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = event => resolve(event.target?.result);
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
            });
            if (!(buffer instanceof ArrayBuffer)) throw new Error('Zip file failed');
            const deflate = await new Promise<Uint8Array>((resolve, reject) => {
              const messageTag = tag++;
              const listener = (msg: MessageEvent) => {
                const { tag, data, error } = msg.data;
                if (messageTag === tag) {
                  this._worker.addEventListener('message', listener);
                  if (error) reject(error);
                  else resolve(data);
                }
              };
              this._worker.addEventListener('message', listener);
              this._worker.postMessage({ tag: messageTag, data: buffer }, [buffer]);
            });
            return deflate;
          })(),
          (async () => {
            // create a placeholder file at target path
            const result = await auth.rest('fs.writeFile',
              [target, "Web-ssh-tool try to create file here. Don't edit, move or delete this file", { flag: 'wx' }]);
            return result;
          })(),
        ]);
        if (Rest.isError(result)) throw result.error;
        const blob = new Blob([deflate]);
        const formData = new FormData();
        formData.append('file', blob, file.name);
        return auth.upload(formData, {
          signal: abort.signal,
          onUploadProgress,
          onDownloadProgress,
        })
      },
      operate: async (multer) => {
        // overwrite the placeholder file
        const result = await auth.rest('unzip', { src: multer.path, dest: target });
        if (Rest.isError(result)) throw result.error;
        await auth.rest('fs.unlink', [multer.path]);
      },
      cancel: () => {
        abort.abort();
        return auth.rest('fs.unlink', [target]);
      },
    });
    const listener = () => {
      const { detail: { state } } = controller;
      switch (state) {
        case Common.UploadController.State.cancel:
        case Common.UploadController.State.close:
          controller.removeEventListener('change', listener);
          if (this._mounted) {
            const { uploadItems } = this.state;
            const index = uploadItems.indexOf(controller);
            if (index > -1) this.setState({
              uploadItems: [...uploadItems.filter(value => {
                switch (value.detail.state) {
                  case Common.UploadController.State.cancel:
                  case Common.UploadController.State.close:
                    return false;
                }
                return true;
              })]
            });
          }
      }
    }
    controller.addEventListener('change', listener);
    this.setState({ uploadItems: [...this.state.uploadItems, controller] });
  }

  override componentDidMount() {
    this._ws = new WebSocket(`wss://${host}/watch`);
    this._bind(this._ws);
  }

  override componentWillUnmount() {
    this._mounted = false;
    this._unbind(this._ws);
    this._worker.terminate();
    wsSafeClose(this._ws);
  }

  override render() {
    const { closed, state, loading, config, uploadItems } = this.state;
    return (
      <Common.Context.Provider value={{
        config, uploadItems,
        setConfig: config => this.setState({ config }),
        cd: cd => this._cd(cd),
        upload: (file, dest) => this._upload(file, dest),
      }}>
        <Elevation className='column' z={2} style={{ width: 320 }}>
          <SharedAxisTransition
            className='expanded'
            style={{ width: '100%' }}
            type={SharedAxisTransition.Type.fromRightToLeft}
            id={closed}>
            {closed
              ? <LostConnection reconnect={() => {
                return new Promise(resolve => {
                  this._ws = new WebSocket(`wss://${host}/watch`);
                  this._bind(this._ws);
                  this._ws.addEventListener('open', resolve, { once: true });
                  this._ws.addEventListener('close', resolve, { once: true });
                  this._ws.addEventListener('error', resolve, { once: true });
                });
              }} />
              : <SharedAxisTransition
                className='full-size'
                type={SharedAxisTransition.Type.fromRightToLeft}
                id={(state as any)?.path}
                style={{
                  pointerEvents: loading ? 'none' : 'auto',
                  opacity: loading ? 0.5 : 1,
                  transition: 'opacity 300ms',
                  position: 'relative'
                }}>
                <Content state={state} />
                <LinearProgress style={{ position: 'absolute', top: 0 }} closed={!loading} />
              </SharedAxisTransition>}
          </SharedAxisTransition>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <AnimatedList>
              {uploadItems.map(value => {
                return {
                  listId: value.detail.id,
                  children: <AnimatedList.Wrap><UploadItem key={value as any} controller={value} /></AnimatedList.Wrap>,
                }
              })}
            </AnimatedList>
          </div>
          <div style={{ height: 8 }} />
          <SimpleListItem text='Cancel all' metaIcon='clear_all'
            style={uploadItems.length > 2
              ? {
                height: 48,
                opacity: 1,
                transition: 'height 300ms, opacity 300ms',
              }
              : {
                pointerEvents: 'none',
                height: 0,
                opacity: 0,
                transition: 'height 300ms, opacity 210ms',
              }}
            onClick={() => {
              this.setState({ uploadItems: [] });
              for (const item of Array.from(uploadItems)) item.cancel();
            }} />
          <div style={{ height: 16 }} />
        </Elevation>
      </Common.Context.Provider>
    );
  }
}

export default FileExplorer;

namespace FileExplorer {
  export type Props = {
    readonly settings: Settings.Type,
    readonly server: Server.Type,
    readonly auth: Server.Authentication.Type,
  };

  export type State = {
    closed: boolean,
    state?: Watch.Directory | Watch.File | { error: any },
    loading: boolean,
    config: Common.Config,
    uploadItems: Common.UploadController[],
  };
}

function Content({ state }: { state?: Watch.Directory | Watch.File | { error: any } }) {
  if (state === undefined) return <Loading />;
  else if ('error' in state) return <ErrorPreview state={state} />;
  else if ('content' in state) return <FilePreview state={state} />;
  else if ('files' in state) return <DirectoryPreView state={state} />;
  else return <UnknownErrorPreview />;
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
  const { controller: { detail: { file, dest } } } = props;
  return (
    <div className='row' style={{ padding: 8, alignItems: 'center' }}>
      <SharedAxisTransition
        id={state}
        type={SharedAxisTransition.Type.fromRightToLeft}
        className='column'
        style={{ height: 48, width: 48, justifyContent: 'center', alignItems: 'center' }}>
        {(() => {
          switch (state) {
            case Common.UploadController.State.upload: {
              if (upload && upload.lengthComputable) {
                if (upload.lengthComputable) {
                  const progress = upload.loaded / upload.total;
                  return (
                    <Tooltip content={`${(progress * 100).toFixed(1)} %; ${FileSize(upload.loaded)}; ${FileSize(upload.total)}`}>
                      <CircularProgress progress={progress} />
                    </Tooltip>
                  );
                } else {
                  return (
                    <Tooltip content={FileSize(upload.loaded)}>
                      <CircularProgress />
                    </Tooltip>
                  );
                }
              } else {
                return <Tooltip content='Deflate file and initialize network request...'>
                  <CircularProgress />
                </Tooltip>;
              }

            }
            case Common.UploadController.State.operate:
              return <Tooltip content='Moving file'>
                <CircularProgress />
              </Tooltip>;
            case Common.UploadController.State.close:
              return <Icon icon='checked' />;
            case Common.UploadController.State.error: {
              const { error } = props.controller.detail;
              return <Tooltip content={error?.message ?? error?.name ?? error?.code ?? error?.errno ?? 'Unknown error'}>
                <Theme use='error'><Icon icon='error' /></Theme>
              </Tooltip>;
            }
            case Common.UploadController.State.cancel:
              return <Icon icon='cancel' />;
          }
        })()}
      </SharedAxisTransition>
      <div style={{ width: 8 }} />
      <div className='column expanded' style={{ justifyContent: 'space-around' }}>
        <Typography use='subtitle1'>{file.name}</Typography>
        <Typography use='caption' style={{
          width: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>{dest}</Typography>
      </div>
      <div style={{ width: 8 }} />
      <SharedAxisTransition
        id={state}
        type={SharedAxisTransition.Type.fromTopToBottom}>
        {(() => {
          switch (state) {
            case Common.UploadController.State.upload:
              return <IconButton icon='close' onClick={() => props.controller.cancel()} />;
            case Common.UploadController.State.error:
              return <IconButton icon='close' onClick={() => props.controller.cleanup()} />;
          }
        })()}
      </SharedAxisTransition>

    </div>
  );
}

