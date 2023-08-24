import React from "react";
import { Checkbox, Icon, IconButton, ListItem } from "rmcw";
import { FileType, Lstat } from "../../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import DropZone from "./DropZone";
import { Server } from "../../../../common/Providers";

function FileListTile({ name, stats, uploading, selected, onSelecting, onClick, onSelected, onDetail, onFileMove, style }: {
  name: string,
  stats: Lstat,
  uploading: boolean,
  selected: boolean,
  onSelecting: boolean,
  onClick: (() => unknown) | undefined, // cd
  onSelected: ((selected: boolean) => unknown) | undefined,
  onDetail: (stats: Lstat) => unknown,
  onFileMove: (filename: string, path: string, target: string) => unknown,
  style?: React.CSSProperties,
}) {
  const { hovering, dragging, setDragging } = React.useContext(DropZone.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const [hover, setHover] = React.useState(false);
  const { path, type, realType } = stats;
  const [disabled, isFile, isDirectory] = (() => {
    if (!uploading) {
      switch (type) {
        case FileType.file:
          return [false, true, false];
        case FileType.directory:
          return [false, false, true];
        case FileType.symbolicLink:
          switch (realType) {
            case FileType.file:
              return [false, true, false];
            case FileType.directory:
              return [false, false, true];
          }
      }
    }
    return [true, false, false];
  })();
  const onDragging = dragging === path;
  const onHovering = isDirectory &&
    hovering instanceof HTMLLIElement &&
    hovering.dataset['dropzone'] === path;
  return <ListItem
    style={{
      ...style,
      opacity: disabled || onHovering || onDragging ? 0.5 : 1,
      outline: onHovering ? '3px dotted #666' : '3px dotted rgba(0,0,0,0)',
    }}
    data-dropzone={isDirectory ? path : DropZone.noDrop}
    draggable={(onDragging || dragging === null) && !onSelecting}
    nonInteractive={disabled}
    onDragStart={event => {
      if (path === undefined || path === null) return;
      setDragging(path);
      event.dataTransfer.setData('filename', name);
      event.dataTransfer.setData('text', path);
      event.dataTransfer.effectAllowed = 'all';
      event.dataTransfer.dropEffect = 'copy';
    }}
    onDragEnd={() => setDragging(null)}
    onDragOver={isDirectory ? e => e.preventDefault() : undefined}
    onDrop={isDirectory ? event => {
      event.preventDefault();
      const filename = event.dataTransfer.getData('filename');
      const path = event.dataTransfer.getData('text');
      if (stats.path === path) return;
      if (stats.path === undefined || stats.path === null) return;
      if (path.length !== 0 && filename.length !== 0) {
        onFileMove(filename, path, stats.path);
      }
    } : undefined}
    graphic={<SharedAxis
      keyId={onSelecting ? 0 : 1}
      transform={SharedAxisTransform.fromLeftToRight}
      forceRebuildAfterSwitched={false}
      className='column'
      style={{ justifyContent: 'center', alignItems: 'center' }}>
      {onSelecting
        ? <Checkbox readOnly checked={selected} style={{ height: 24 }}></Checkbox>
        : <Icon>{uploading ? 'file_upload' : FileIcon(name, stats)}</Icon>}
    </SharedAxis>}
    primaryText={<div style={{ flex: 1, minWidth: 0, overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>}
    meta={<IconButton
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        onDetail(stats);
      }} >
      <Icon>more_horiz</Icon>
    </IconButton>}
    onClick={disabled
      ? undefined
      : (onSelecting
        ? () => {
          onSelected?.(!selected);
        }
        : () => {
          if (isFile) {
            if (typeof stats.path === 'string') {
              auth.preview(stats.path);
              return;
            }
          }
          return onClick?.();
        })}
    activated={selected && onSelecting}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />
}

function FileIcon(name: string, { type }: { type?: FileType | null, }) {
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

export default FileListTile;
