import { Stats } from "fs";
import path from "path";
import React from "react";
import { Dialog, DialogActions, DialogButton, IconButton, SimpleListItem, Tooltip, Typography } from "rmwc";
import { Server, ThemeContext } from "../../../common/Providers";
import { FileType, Watch } from "../../../common/Type";
import { DialogContent, DialogTitle } from "../../../components/Dialog";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer from "./Common";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { cd, config, setConfig } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const auth = React.useContext(Server.Authentication.Context);
  const [dialog, setDialog] = React.useState<{ open: boolean, stats: Stats & { type?: FileType }, path: string }>({ open: false, path: '', stats: {} as Stats });
  const close = () => setDialog({ ...dialog, open: false });
  const { path: dir, files } = state;
  const back = () => {
    const dirname = path.dirname(state.path);
    if (dirname !== state.path) cd(path.dirname(state.path))
  };
  const fileList = Object.entries(files).filter(config.showAll
    ? () => true
    : ([key]) => !key.startsWith('.'));
  return (
    <div className='full-size column' >
      <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
        <IconButton style={{ color: theme.primary }} icon='arrow_back' onClick={back} />
        <div className='expanded' />
        <UploadButton dest={dir} />
        <SortButton config={config} setConfig={setConfig} />
        <ShowAndHideButton config={config} setConfig={setConfig} />
      </div>
      <div style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
        {fileList.length === 0
          ? <div className='column' style={{ height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : FileExplorer.sortArray(fileList, config.sort)
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
      <Tooltip content={dir}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%', padding: '0 8px' }}>{dir}</div>
      </Tooltip>
      <Dialog open={dialog.open} onClose={close}>
        <DialogTitle>Information</DialogTitle>
        <DialogContent style={{ overflow: 'auto' }}>
          <div style={{ margin: '0 0 16px' }}><Typography use='button'>path</Typography>: {dialog.path}</div>
          {Object.entries(dialog.stats)
            .map(([key, value]) => {
              return <div key={key}><Typography use='button'>{key}</Typography>: {value}</div>;
            })}
          <div style={{ height: 32 }} />
        </DialogContent>
        <DialogActions style={{ paddingLeft: 16, flexDirection: 'row', width: 560 }}>
          {(() => {
            const { type } = dialog.stats;
            switch (type) {
              case FileType.file:
                return <DeleteButton onLongPress={() => {
                  close();
                  return auth.rest('fs.unlink', [dialog.path])
                }} />;
              case FileType.directory:
                return <DeleteButton onLongPress={() => {
                  close();
                  return auth.rest('fs.rmdir', [dialog.path, { maxRetries: 7 }]);
                }} />;
            }
          })()}
          <div style={{ minWidth: 32, flex: 1 }} />
          {(() => {
            const { type } = dialog.stats;
            switch (type) {
              case FileType.file:
              case FileType.directory:
                return (
                  <>
                    <Tooltip content='move'>
                      <IconButton style={{ color: theme.primary }} icon='drag_handle' onClick={() => {
                        close();
                      }} />
                    </Tooltip>
                    <Tooltip content='rename'>
                      <IconButton style={{ color: theme.primary }} icon='drive_file_rename_outline' onClick={() => {
                        close();
                      }} />
                    </Tooltip>
                    <Tooltip content='download'>
                      <IconButton style={{ color: theme.primary }} icon='download' onClick={() => auth.download(dialog.path)} />
                    </Tooltip>
                  </>
                );
            }
          })()}
          <DialogButton onClick={close}>close</DialogButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}

namespace DirectoryPreView {
}

export default DirectoryPreView;

function ShowAndHideButton({ config, setConfig }: {
  config: FileExplorer.Config,
  setConfig: (config: FileExplorer.Config) => unknown,
}) {
  return (
    <SharedAxisTransition
      id={config.showAll}
      type={SharedAxisTransition.Type.fromRightToLeft}>
      {config.showAll
        ? <Tooltip content='hide hidden file'><IconButton icon='visibility_off' onClick={() => setConfig({ ...config, showAll: false })} /></Tooltip>
        : <Tooltip content='show hidden file'><IconButton icon='visibility' onClick={() => setConfig({ ...config, showAll: true })} /></Tooltip>}
    </SharedAxisTransition>
  );
}

function SortButton({ config, setConfig }: {
  config: FileExplorer.Config,
  setConfig: (config: FileExplorer.Config) => unknown,
}) {
  return (
    <Tooltip content={`sort: ${config.sort}`}>
      <IconButton icon='sort'
        onClick={() => setConfig({
          ...config,
          sort: FileExplorer.switchSortType(config.sort),
        })} />
    </Tooltip>
  );
}

function UploadButton({ dest }: { dest: string }) {
  const { upload } = React.useContext(FileExplorer.Context);
  return (
    <Tooltip content='upload'>
      <IconButton
        icon='upload'
        onClick={event => {
          event.preventDefault();
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.onchange = async () => {
            if (input.files) Array
              .from(input.files)
              .forEach(file => upload(file, dest));
          };
          input.click();
        }} />
    </Tooltip>
  );
}

function DeleteButton({ onLongPress }: { onLongPress: () => unknown }) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const [tooltip, setTooltip] = React.useState(false);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  const clear = () => {
    window.clearTimeout(down);
    setDown(undefined);
    setTooltip(false);
  }
  return (
    <Tooltip content='Long press to delete' open={tooltip}>
      <DialogButton
        icon='delete'
        style={{
          color: theme.error,
          backgroundColor: down === undefined ? undefined : theme.error,
          transition: 'background-color 1s'
        }}
        onMouseDown={() => {
          setTooltip(true);
          const id = window.setTimeout(onLongPress, 1000);
          setDown(id);
        }}
        onMouseUp={clear}
        onMouseLeave={clear}>delete</DialogButton>
    </Tooltip>
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
    case FileType.symbolicLink:
      return 'link';
    case FileType.socket:
      return 'electrical_services';
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
