import path from "path";
import React from "react";
import { Checkbox, Icon, IconButton, SimpleListItem } from "rmwc";
import { FileType, Lstat } from "../../../../common/Type";
import { SharedAxisTransition } from "../../../../components/Transitions";
import DropZone from "./DropZone";

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

function FileListTile({ dirname, name, stats, selected, onSelect, onSelected, onClick, onDetail, style }: {
  dirname: string,
  name: string,
  stats: Lstat,
  selected: boolean,
  onSelect: boolean,
  onSelected: (selected: boolean) => unknown,
  onClick?: () => unknown,
  onDetail: (stats: Lstat, path: string) => unknown,
  style?: React.CSSProperties,
}) {
  const { setDisabled } = React.useContext(DropZone.Context);
  const targetPath = path.join(dirname, name);
  const [hover, setHover] = React.useState(false);
  const disabled = (() => {
    switch (stats.type) {
      case FileType.file:
        if (onSelect) return false;
        if (stats.size < 1 * 1024 * 1024) return false; // limit to 1MB for preview
        break;
      case FileType.directory:
        return false;
      case FileType.symbolicLink:
        switch (stats.realType) {
          case FileType.file:
            if (onSelect) return false;
            if (stats.size < 1 * 1024 * 1024) return false; // limit to 1MB for preview
            break;
          case FileType.directory:
            return false;
        }
        break;
    }
    return true;
  })();
  return <SimpleListItem draggable
    onDragStart={event => {
      setDisabled(true);
      event.dataTransfer.setData('text', targetPath);
      event.dataTransfer.dropEffect = 'copy';
    }}
    onDragEnd={event => setDisabled(false)}
    graphic={<SharedAxisTransition
      type={SharedAxisTransition.Type.fromLeftToRight} id={onSelect}
      className='column'
      style={{ justifyContent: 'center', alignItems: 'center' }}>
      {onSelect
        ? <Checkbox readOnly checked={selected} style={{ height: 24 }}></Checkbox>
        : <Icon icon={FileIcon(name, stats)}></Icon>}
    </SharedAxisTransition>}
    text={<div style={{ flex: 1, minWidth: 0, overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>}
    meta={<IconButton
      icon='more_horiz'
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        onDetail(stats, targetPath);
      }} />}
    onClick={disabled
      ? undefined
      : (onSelect
        ? () => {
          const value = !selected;
          onSelected(value);
        }
        : onClick)}
    activated={selected && onSelect}
    disabled={disabled}
    style={{ ...style, opacity: disabled ? 0.5 : 1 }}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />
}

export default FileListTile;
