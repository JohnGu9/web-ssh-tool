import React from "react";
import { Elevation } from "@rmwc/elevation";
import { LinearProgress } from "@rmwc/linear-progress";

import { wsSafeClose } from "../../common/DomTools";
import { Server } from "../../common/Providers";
import { Rest, Watch } from "../../common/Type";
import { SharedAxisTransition } from "../../components/Transitions";
import FilePreview from "./file-explorer/FilePreview";
import DirectoryPreView from "./file-explorer/DirectoryPreview";
import LostConnection from "./file-explorer/LostConnection";
import ErrorPreview, { UnknownErrorPreview } from "./file-explorer/ErrorPreview";
import Loading from "./file-explorer/Loading";

class FileExplorer extends React.Component<FileExplorer.Props, FileExplorer.State> {
  constructor(props: FileExplorer.Props) {
    super(props);
    this.state = {
      closed: false,
      loading: false,
      config: { showAll: false, sort: DirectoryPreView.SortType.alphabetically }
    };
  }

  protected _ws!: WebSocket;

  protected _onOpen = async () => {
    this.setState({ closed: false, state: undefined })
    const token = await this.props.auth.rest('token', []);
    if (Rest.isError(token)) {
      console.log(token.error);
    } else if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.addEventListener('message', this._onMessage);
      this._ws.send(JSON.stringify({ token }));
    }
  }
  protected _onError = () => { wsSafeClose(this._ws) }
  protected _onClose = (event: CloseEvent) => { this.setState({ closed: true, state: undefined }) }
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

  componentDidMount() {
    this._ws = new WebSocket(`wss://${this.props.server.host}/watch`);
    this._bind(this._ws);
  }

  componentWillUnmount() {
    this._unbind(this._ws);
    wsSafeClose(this._ws);
  }

  render() {
    const { closed, state, loading, config } = this.state;
    return (
      <Elevation z={1} style={{ width: 320, height: '100%' }}>
        <SharedAxisTransition
          className='full-size'
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
              <Content state={state}
                config={config}
                setConfig={(config) => this.setState({ config })}
                cd={(cd?: string) => {
                  this.setState({ loading: true });
                  this._ws.send(JSON.stringify({ cd }));
                }} />
              <LinearProgress style={{ position: 'absolute' }} closed={!loading} />
            </SharedAxisTransition>}
        </SharedAxisTransition>
      </Elevation>
    );
  }
}

export default FileExplorer;

namespace FileExplorer {
  export type Props = {
    server: Server.Type,
    auth: Server.Authentication.Type,
  };

  export type State = {
    closed: boolean,
    state?: Watch.Directory | Watch.File | { error: any },
    loading: boolean,
    config: DirectoryPreView.Config,
  };
}

function Content({ state, cd, config, setConfig }: {
  state?: Watch.Directory | Watch.File | { error: any },
  cd: (path?: string) => unknown,
  config: DirectoryPreView.Config,
  setConfig: (config: DirectoryPreView.Config) => unknown,
}) {
  if (state === undefined) return <Loading />;
  else if ('error' in state) return <ErrorPreview state={state} cd={cd} />;
  if ('content' in state) return <FilePreview state={state} cd={cd} />;
  else if ('files' in state) return <DirectoryPreView state={state} cd={cd} config={config} setConfig={setConfig} />;
  return <UnknownErrorPreview goHome={() => cd()} />
}
