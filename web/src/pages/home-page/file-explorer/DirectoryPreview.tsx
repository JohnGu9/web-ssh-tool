import { Stats } from "fs";
import path from "path";
import React from "react";
import { Button, Dialog, DialogActions, DialogButton, IconButton, SimpleListItem, Tooltip } from "rmwc";
import { ThemeContext } from "../../../common/Providers";
import { FileType, Watch } from "../../../common/Type";
import { DialogContent, DialogTitle } from "../../../components/Dialog";
import { SharedAxisTransition } from "../../../components/Transitions";

function DirectoryPreView({ state, cd, config, setConfig }: {
  state: Watch.Directory,
  cd: (path?: string) => unknown,
  config: DirectoryPreView.Config,
  setConfig: (config: DirectoryPreView.Config) => unknown,
}) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const [dialog, setDialog] = React.useState<{ open: boolean, stats: Stats, path: string }>({ open: false, path: '', stats: {} as Stats });
  const { path: dir, files } = state;
  const back = () => {
    const dirname = path.dirname(state.path);
    if (dirname !== state.path) cd(path.dirname(state.path))
  };
  return (
    <div className='full-size column' >
      <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
        <IconButton style={{ color: theme.primary }} icon='arrow_back' onClick={back} />
        <div className='expanded' />
        <SharedAxisTransition
          id={config.showAll}
          type={SharedAxisTransition.Type.fromRightToLeft}>
          {config.showAll
            ? <Button label='hide' onClick={() => setConfig({ ...config, showAll: false })} />
            : <Button label='show all' onClick={() => setConfig({ ...config, showAll: true })} />}
        </SharedAxisTransition>
        <Button label='upload' />
        <Tooltip content={config.sort}>
          <Button label='sort'
            onClick={() => setConfig({
              ...config,
              sort: DirectoryPreView.switchSortType(config.sort),
            })} />
        </Tooltip>
      </div>
      <div style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
        {DirectoryPreView.sortArray(Object.entries(files)
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
        <DialogActions style={{ paddingLeft: 16 }}>
          <DeleteButton />
          <div style={{ minWidth: 64 }} />
          <DialogButton onClick={() => setDialog({ ...dialog, open: false })}>download</DialogButton>
          <DialogButton onClick={() => setDialog({ ...dialog, open: false })}>close</DialogButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}

namespace DirectoryPreView {
  export const enum SortType { none = 'none', date = 'date', alphabetically = 'alphabetically' };
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

export default DirectoryPreView;

function DeleteButton() {
  const { themeData: theme } = React.useContext(ThemeContext);
  const [down, setDown] = React.useState<number | undefined>(undefined);
  return (
    <Tooltip content='Long press to delete' >
      <DialogButton
        style={{
          color: theme.error,
          backgroundColor: down === undefined ? undefined : theme.error,
          transition: 'background-color 1s'
        }}
        onMouseDown={() => setDown(1)}
        onMouseUp={() => setDown(undefined)}
        onMouseLeave={() => setDown(undefined)}>delete</DialogButton>
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
    case FileType.blockDevice:
    case FileType.characterDevice:
      return 'widgets';
    case FileType.socket:
      return 'electrical_services';
    case FileType.fifo:
      return 'route';
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
