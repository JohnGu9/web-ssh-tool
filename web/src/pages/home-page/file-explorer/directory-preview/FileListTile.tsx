import React from "react";
import { Checkbox, Icon, IconButton, ListItem } from "rmcw";
import { FileType, Lstat } from "../../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import DropZone from "./DropZone";
import { Server } from "../../../../common/Providers";

function FileListTile({ name, stats, uploading, selected, onSelecting: onSelect, onClick, onSelected, onDetail, style }: {
  name: string,
  stats: Lstat,
  uploading: boolean,
  selected: boolean,
  onSelecting: boolean,
  onClick: (() => unknown) | undefined, // cd
  onSelected: ((selected: boolean) => unknown) | undefined,
  onDetail: (stats: Lstat) => unknown,
  style?: React.CSSProperties,
}) {
  const { setDisabled } = React.useContext(DropZone.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const [hover, setHover] = React.useState(false);
  const [disabled, isPreview] = (() => {
    if (!uploading) {
      switch (stats.type) {
        case FileType.file:
          return [false, true];
        case FileType.directory:
          return [false, false];
        case FileType.symbolicLink:
          switch (stats.realType) {
            case FileType.file:
              return [false, true];
            case FileType.directory:
              return [false, false];
          }
      }
    }
    return [true, false];
  })();
  return <ListItem draggable
    nonInteractive={disabled}
    onDragStart={event => {
      const { path } = stats;
      if (path === undefined || path === null) return;
      setDisabled(true);
      event.dataTransfer.setData('text', path);
      event.dataTransfer.dropEffect = 'copy';
    }}
    onDragEnd={() => setDisabled(false)}
    graphic={<SharedAxis
      transform={SharedAxisTransform.fromLeftToRight} keyId={onSelect ? 0 : 1}
      className='column'
      style={{ justifyContent: 'center', alignItems: 'center' }}>
      {onSelect
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
      : (onSelect
        ? () => {
          onSelected?.(!selected);
        }
        : () => {
          if (isPreview) {
            if (typeof stats.path === 'string') {
              auth.preview(stats.path);
              return;
            }
          }
          return onClick?.();
        })}
    activated={selected && onSelect}
    style={{ ...style, opacity: disabled ? 0.5 : 1 }}
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
