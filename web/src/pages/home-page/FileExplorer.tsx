import React from "react";
import { Elevation } from "@rmwc/elevation";
import { LinearProgress } from "@rmwc/linear-progress";
import { CircularProgress } from "@rmwc/circular-progress";
import { Typography } from "@rmwc/typography";
import { IconButton } from "@rmwc/icon-button";
import { v1 as uuid } from 'uuid';
import path from "path";

import { wsSafeClose } from "../../common/DomTools";
import { Server } from "../../common/Providers";
import { Rest, Watch } from "../../common/Type";
import { SharedAxisTransition } from "../../components/Transitions";

import FilePreview from "./file-explorer/FilePreview";
import DirectoryPreView from "./file-explorer/DirectoryPreview";
import LostConnection from "./file-explorer/LostConnection";
import Loading from "./file-explorer/Loading";
import ErrorPreview, { UnknownErrorPreview } from "./file-explorer/ErrorPreview";
import Common from './file-explorer/Common';
import AnimatedList from "../../components/AnimatedList";
import { Icon } from "@rmwc/icon";
import { Tooltip } from "@rmwc/tooltip";
import { Theme } from "@rmwc/theme";

class FileExplorer extends React.Component<FileExplorer.Props, FileExplorer.State> {
  constructor(props: FileExplorer.Props) {
    super(props);
    this.state = {
      closed: false,
      loading: false,
      config: { showAll: false, sort: Common.SortType.alphabetically }
    };
  }

  protected _mounted = true;
  protected _controllers: UploadItem.Controller[] = [];
  protected _ws!: WebSocket;
  protected _onError = () => { wsSafeClose(this._ws) }
  protected _onClose = (event: CloseEvent) => { this.setState({ closed: true, state: undefined }) }
  protected _onOpen = async () => {
    this.setState({ closed: false, state: undefined })
    const token = await this.props.auth.rest('token', []);
    if (Rest.isError(token)) {
      // unexpected case
    } else if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.addEventListener('message', this._onMessage);
      this._ws.send(JSON.stringify({ token }));
    }
  }
  protected _onMessage = ({ data }: MessageEvent<string>) => {
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
  }

  protected _upload(file: File, dest: string) {
    const { auth } = this.props;
    const abort = new AbortController();
    const target = path.join(dest, file.name);
    const checkFileExists = async () => {
      const exists = await auth.rest('fs.exists', [target]);
      if (Rest.isError(exists)) throw exists.error;
      if (exists) throw new Error(`File [${target}] already exists. `);
    }

    const controller = new UploadItem.Controller({
      id: uuid(), file, dest,
      upload: async () => {
        await checkFileExists();
        return auth.upload(file, { signal: abort.signal })
      },
      operate: async (multer) => {
        await checkFileExists();
        const result = await auth.rest('fs.rename', [multer.path, target]);
        if (Rest.isError(result)) throw result.error;
      },
      cancel: () => abort.abort(),
    });
    const listener = () => {
      const { detail: { state } } = controller;
      switch (state) {
        case UploadItem.State.cancel:
        case UploadItem.State.close:
          controller.removeEventListener('change', listener);
          const index = this._controllers.indexOf(controller);
          if (index > -1) {
            this._controllers.splice(index, 1);
            if (this._mounted) this.forceUpdate();
          }
      }
    }
    controller.addEventListener('change', listener);
    this._controllers.push(controller);
    this.forceUpdate();
  }

  componentDidMount() {
    this._ws = new WebSocket(`wss://${this.props.server.host}/watch`);
    this._bind(this._ws);
  }

  componentWillUnmount() {
    this._mounted = false;
    this._unbind(this._ws);
    wsSafeClose(this._ws);
  }

  render() {
    const { closed, state, loading, config } = this.state;
    return (
      <Common.Context.Provider value={{
        config,
        setConfig: config => this.setState({ config }),
        cd: cd => this._cd(cd),
        upload: (file, dest) => this._upload(file, dest),
      }}>
        <Elevation className='column' z={2} style={{ width: 320 }}>
          <SharedAxisTransition
            className='expanded'
            style={{ width: '100%', minHeight: 480 }}
            type={SharedAxisTransition.Type.fromRightToLeft}
            id={closed}>
            {closed
              ? <LostConnection reconnect={() => {
                return new Promise(resolve => {
                  this._ws = new WebSocket(`wss://${this.props.server.host}/watch`);
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
                <LinearProgress style={{ position: 'absolute' }} closed={!loading} />
              </SharedAxisTransition>}
          </SharedAxisTransition>
          <AnimatedList>
            {this._controllers.map(value => {
              return {
                listId: value.detail.id,
                children: <AnimatedList.Wrap><UploadItem controller={value} /></AnimatedList.Wrap>,
              }
            })}
          </AnimatedList>
          <div style={{ height: 24 }} />
        </Elevation>
      </Common.Context.Provider>
    );
  }
}

export default FileExplorer;

namespace FileExplorer {
  export type Props = {
    readonly server: Server.Type,
    readonly auth: Server.Authentication.Type,
  };

  export type State = {
    closed: boolean,
    state?: Watch.Directory | Watch.File | { error: any },
    loading: boolean,
    config: Common.Config,
  };
}

function Content({ state }: { state?: Watch.Directory | Watch.File | { error: any } }) {
  if (state === undefined) return <Loading />;
  else if ('error' in state) return <ErrorPreview state={state} />;
  else if ('content' in state) return <FilePreview state={state} />;
  else if ('files' in state) return <DirectoryPreView state={state} />;
  else return <UnknownErrorPreview />;
}

function UploadItem(props: { controller: UploadItem.Controller }) {
  const [state, setState] = React.useState<UploadItem.State>(props.controller.detail.state);
  React.useEffect(() => {
    const { controller } = props;
    const listener = () => setState(controller.detail.state);
    controller.addEventListener('change', listener);
    return () => controller.removeEventListener('change', listener);
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
            case UploadItem.State.upload:
            case UploadItem.State.operate:
              return <CircularProgress />;
            case UploadItem.State.close:
              return <Icon icon='checked' />;
            case UploadItem.State.error:
              const { error } = props.controller.detail;
              return <Tooltip content={error?.message ?? error?.name ?? 'Unknown error'}>
                <Theme use='error'><Icon icon='error' /></Theme>
              </Tooltip>;
            case UploadItem.State.cancel:
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
            case UploadItem.State.upload:
            case UploadItem.State.error:
              return <IconButton icon='close' onClick={() => props.controller.cleanup()} />;
          }
        })()}
      </SharedAxisTransition>

    </div>
  );
}

namespace UploadItem {
  export const enum State {
    upload, operate, error, close, cancel
  }
  export class Controller extends EventTarget {
    constructor(props: {
      id: string,
      file: File,
      dest: string,
      upload: () => Promise<Express.Multer.File>,
      operate: (file: Express.Multer.File) => Promise<unknown>,
      cancel: () => unknown,
    }) {
      super();
      this.cancel = () => {
        this.detail.state = State.cancel;
        this.dispatchEvent(new Event('change'));
        props.cancel();
      };
      this.detail = {
        id: props.id,
        file: props.file,
        dest: props.dest,
        state: State.upload,
      };
      props.upload()
        .then((file) => {
          if (this.detail.state !== State.cancel) {
            this.detail.state = State.operate;
            this.dispatchEvent(new Event('change'));
            return props.operate(file).then(() => {
              this.detail.state = State.close;
              this.dispatchEvent(new Event('change'))
            });
          }
        })
        .catch((error) => {
          if (this.detail.state !== State.cancel) {
            this.detail.error = error;
            this.detail.state = State.error;
            this.dispatchEvent(new Event('change'))
          }
        });
    }

    readonly detail: {
      id: string,
      file: File,
      dest: string,
      state: State,
      error?: any
    };

    readonly cancel: () => void;
    cleanup() {
      if (this.detail.state === State.error) {
        this.detail.state = State.cancel;
        this.dispatchEvent(new Event('change'));
      }
    }
  }

}