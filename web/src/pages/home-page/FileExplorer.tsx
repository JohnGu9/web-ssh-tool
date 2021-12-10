import React from "react";
import { Button } from "@rmwc/button";
import { CircularProgress } from "@rmwc/circular-progress";
import { Elevation } from "@rmwc/elevation";
import { IconButton } from "@rmwc/icon-button";
import { LinearProgress } from "@rmwc/linear-progress";
import { SimpleListItem } from "@rmwc/list";
import { Tooltip } from "@rmwc/tooltip";
import { Dialog, DialogActions, DialogButton } from "@rmwc/dialog";
import { Stats } from "fs";
import path from 'path';

import { wsSafeClose } from "../../common/DomTools";
import { Server, ThemeContext } from "../../common/Providers";
import { FileType, Rest, Watch } from "../../common/Type";
import { DialogContent, DialogTitle } from "../../components/Dialog";
import { SharedAxisTransition } from "../../components/Transitions";

class FileExplorer extends React.Component<FileExplorer.Props, FileExplorer.State> {
  constructor(props: any) {
    super(props);
    this.state = {
      closed: false,
      loading: false,
      config: { showAll: false, sort: FileExplorer.SortType.none }
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
    config: Config,
  };

  export const enum SortType { none = 'none', date = 'date', alphabetically = 'alphabetically' };
  export type Config = { showAll: boolean, sort: SortType };
  export function switchSortType(current: SortType) {
    switch (current) {
      case SortType.none:
        return SortType.date;
      case SortType.date:
        return SortType.alphabetically;
      case SortType.alphabetically:
        return SortType.none;
    }
  }
  export function sortArray(array: Array<[string, Stats]>, type: SortType) {
    switch (type) {
      case SortType.none:
        return array;
      case SortType.date:
        const dateCompare = (nameA: Date, nameB: Date) => {
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        }
        return array.sort(([_, stats0], [__, stats1]) => dateCompare(stats0.mtime, stats1.mtime));
      case SortType.alphabetically:
        const stringCompare = (nameA: string, nameB: string) => {
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        }
        return array.sort(([key0], [key1]) => stringCompare(key0, key1));
    }
  }
}

function LostConnection({ reconnect }: { reconnect: () => Promise<unknown> }) {
  const [connecting, setConnecting] = React.useState(false);
  return (
    <div className='full-size column'
      style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <LinearProgress style={{ position: 'absolute', top: 0 }} closed={!connecting} />
      <div style={{ margin: '16px 0' }}>Lost Connection</div>
      <Button raised label='Reconnect'
        disabled={connecting}
        onClick={async () => {
          setConnecting(true);
          await reconnect();
          setConnecting(false);
        }} />
    </div>
  );
}

function Content({ state, cd, config, setConfig }: {
  state?: Watch.Directory | Watch.File | { error: any },
  cd: (path?: string) => unknown,
  config: FileExplorer.Config,
  setConfig: (config: FileExplorer.Config) => unknown,
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const [dialog, setDialog] = React.useState<{ open: boolean, stats: Stats, path: string }>({ open: false, path: '', stats: {} as Stats });
  const goHome = () => cd();
  if (state === undefined) {
    return (
      <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </div>
    );
  } else if ('error' in state) {
    const { error } = state;
    return (
      <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ margin: '16px 0' }}>Error Occur ({error.name ?? error.code})</div>
        <Button raised label='Return to home' onClick={goHome} />
      </div>
    );
  }

  const back = () => {
    const dirname = path.dirname(state.path);
    if (dirname !== state.path) cd(path.dirname(state.path))
  };
  if ('content' in state) {
    const { path, content } = state;
    return (
      <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
          <IconButton icon='arrow_back' onClick={back} />
          <div className='expanded' />
          <Button label='download' onClick={() => auth.download(path)} />
        </div>
        <FilePreview name={path} content={content} />
        <div style={{ height: 16 }} />
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%' }}>{path}</div>
        <div style={{ height: 24 }} />
      </div>
    );
  } else if ('files' in state) {
    const { path: dir, files } = state;
    return (
      <div className='full-size column' >
        <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
          <IconButton style={{ color: theme.primary }} icon='arrow_back' onClick={back} />
          <div className='expanded' />
          <SharedAxisTransition
            id={config.showAll}
            type={SharedAxisTransition.Type.fromTopToBottom}>
            {config.showAll
              ? <Button label='hide' onClick={() => setConfig({ ...config, showAll: false })} />
              : <Button label='show all' onClick={() => setConfig({ ...config, showAll: true })} />}
          </SharedAxisTransition>
          <Tooltip content={config.sort}>
            <Button label='sort'
              onClick={() => setConfig({
                ...config,
                sort: FileExplorer.switchSortType(config.sort),
              })} />
          </Tooltip>
        </div>
        <div style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
          {FileExplorer.sortArray(Object.entries(files)
            .filter(config.showAll
              ? () => true
              : ([key]) => !key.startsWith('.')),
            config.sort)
            .map(([key, value]) => {
              return <FileListTile
                key={key}
                name={key}
                stats={value}
                onClick={() => cd(path.join(dir, key))}
                onDetail={(stats) => setDialog({ open: true, stats, path: path.join(dir, key) })} />
            })}
          <div className='row' style={{ padding: '32px 0', justifyContent: 'center', opacity: 0.5 }}>
          </div>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%' }}>{dir}</div>
        <div style={{ height: 24 }} />
        <Dialog open={dialog.open} onClose={() => setDialog({ ...dialog, open: false })}>
          <DialogTitle>File Information</DialogTitle>
          <DialogContent style={{ overflow: 'auto' }}>
            <div style={{ margin: '16px 0' }}>{dialog.path}</div>
            {Object.entries(dialog.stats)
              .map(([key, value]) => {
                return <div key={key}>{key}: {value}</div>;
              })}
          </DialogContent>
          <DialogActions>
            <DialogButton onClick={() => setDialog({ ...dialog, open: false })}>close</DialogButton>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Unknown State (Server Error)</div>
      <Button raised label='Return to home' onClick={goHome} />
    </div>
  );
}

function FileIcon(name: string, { type }: { type?: FileType, }) {
  switch (type) {
    case FileType.directory:
      return 'folder';
    case FileType.file: {
      const chips = name.split('.').filter(value => value.length > 0);
      if (chips.length > 1) {
        const last = chips[chips.length - 1];
        switch (last.toLowerCase()) {
          case 'jpg':
          case 'jpeg':
          case 'png':
          case 'svg':
          case 'tif':
          case 'tiff':
          case 'bmp':
          case 'gif':
          case 'raw':
            return 'image';
          case 'mp4':
          case 'flv':
          case 'avi':
          case 'mkv':
            return 'videocam';
          case 'zip':
          case '7z':
          case 'tar':
          case 'txz':
          case 'tgz':
          case 'bz2':
          case 'tbz2':
          case 'gz':
          case 'xz':
          case 'rar':
          case 'z':
            return 'folder_zip';
        }
      }
      return 'text_snippet';
    }
    default:
      return 'browser_not_supported';
  }
}

function FileListTile({ name, stats, onClick, onDetail }: {
  name: string,
  stats: Stats & { type?: FileType },
  onClick?: () => unknown,
  onDetail: (stats: Stats & { type?: FileType }) => unknown,
}) {
  const [hover, setHover] = React.useState(false);
  const disabled = (() => {
    switch (stats.type) {
      case FileType.file:
        if (stats.size < 1 * 1024 * 1024) return false; // limit to 1MB for preview
        break;
      case FileType.directory:
        return false;
    }
    return true;
  })();
  return <SimpleListItem
    graphic={FileIcon(name, stats)}
    text={name}
    meta={<IconButton
      icon='more_horiz'
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        onDetail(stats);
      }} />}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{ opacity: disabled ? 0.5 : 1 }}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className='column'
    style={{ flex: 1, width: '100%', overflow: 'auto', justifyContent: 'center', padding: '0 8px' }}>
    {children}
  </div>;
}

function FilePreview({ name, content }: { name: string, content: string }) {
  const chips = name.split('.').filter(value => value.length > 0);
  if (chips.length > 1) {
    const last = chips[chips.length - 1].toLowerCase();
    switch (last) {
      case 'jpg':
      case 'jpeg':
        return <Center><img src={`data:image/jpeg;base64,${content}`} alt='Loading' /></Center>;
      case 'png':
        return <Center><img src={`data:image/png;base64,${content}`} alt='Loading' /></Center>;
      case 'svg':
        return <Center><img src={`data:image/svg+xml;base64,${content}`} alt='Loading' /></Center>;
      case 'bmp':
        return <Center><img src={`data:image/bmp;base64,${content}`} alt='Loading' /></Center>;
      case 'gif':
        return <Center><img src={`data:image/gif;base64,${content}`} alt='Loading' /></Center>;
      case 'tif':
      case 'tiff':
        return <Center><img src={`data:image/tiff;base64,${content}`} alt='Loading' /></Center>;
      case 'raw':
        return <Center><img src={`data:image/${last};base64,${content}`} alt='Loading' /></Center>;
    }
  }
  return <code style={{ flex: 1, width: '100%', overflow: 'auto', whiteSpace: 'pre' }}>
    {Buffer.from(content, 'base64').toString()}
  </code>;
}
