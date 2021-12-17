import { Stats } from "fs";
import path from "path";
import React from "react";
import { IconButton, SimpleListItem } from "rmwc";
import { FileType } from "../../../common/Type";

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

function FileListTile({ dirname, name, stats, onClick, onDetail }: {
  dirname: string,
  name: string,
  stats: Stats & { type?: FileType },
  onClick?: () => unknown,
  onDetail: (stats: Stats & { type?: FileType }, path: string) => unknown,
}) {
  const targetPath = path.join(dirname, name);
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
    draggable
    onDragStart={event => event.dataTransfer.setData('text', targetPath)}
    graphic={FileIcon(name, stats)}
    text={name}
    meta={<IconButton
      icon='more_horiz'
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        onDetail(stats, targetPath);
      }} />}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{ opacity: disabled ? 0.5 : 1 }}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />
}

export default FileListTile;
