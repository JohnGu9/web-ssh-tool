import React from "react";
import { Checkbox, Icon, IconButton, ListItem } from "rmcw";
import { FileType, Lstat } from "../../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import DropZone from "./DropZone";
import DirectoryPreView from "../DirectoryPreview";
import FileExplorer from "../Common";
import { fileIcon } from "../common/FileIcon";

function FileListTile({ name, stats, uploading, style }: {
  name: string,
  stats: Lstat,
  uploading: boolean,
  style?: React.CSSProperties,
}) {
  const { cd } = React.useContext(FileExplorer.Context);
  const { state, selected, setSelected, onSelecting, setInformation, setFileMove, setPreview, setRequestPreview } = React.useContext(DirectoryPreView.Context);
  const { hovering, dragging, setDragging } = React.useContext(DropZone.Context);
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

  const extension = fileExtension(name, stats.type);
  const beSelected = selected.has(stats);

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
      event.dataTransfer.dropEffect = 'move';
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
        setFileMove({ open: true, filename, path, target: stats.path });
      }
    } : undefined}
    graphic={<SharedAxis
      keyId={onSelecting ? 0 : 1}
      transform={SharedAxisTransform.fromLeftToRight}
      forceRebuildAfterSwitched={false}
      className='column flex-center'>
      {onSelecting
        ? <Checkbox readOnly checked={beSelected} style={{ height: 24 }}></Checkbox>
        : <Icon>{uploading ? 'file_upload' : fileIcon(stats, extension)}</Icon>}
    </SharedAxis>}
    primaryText={<div className='expanded' style={{ overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>}
    meta={<IconButton
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        // console.log(stats);
        if (typeof state.path === 'string')
          setInformation({ open: true, stat: stats, dirPath: state.path });
      }} >
      <Icon>more_horiz</Icon>
    </IconButton>}
    onClick={disabled
      ? undefined
      : (onSelecting
        ? () => {
          setSelected(v => {
            const success = v.delete(stats);
            if (!success) v.add(stats);
            return new Set(v);
          });
        }
        : () => {
          if (isFile) {
            if (typeof stats.path === 'string') {
              if (checkTypeSupport(extension)) {
                setPreview({ open: true, lstat: stats });
              } else {
                setRequestPreview({ open: true, lstat: stats })
              }
              return;
            }
          }
          if (typeof path === 'string') {
            cd(path);
            return;
          }
        })}
    activated={beSelected && onSelecting}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />
}

function fileExtension(name: string, type?: FileType | null) {
  if (type !== FileType.file) return;
  const chips = name.split('.').filter(value => value.length > 0);
  if (chips.length > 0) return chips[chips.length - 1];
}

function checkTypeSupport(extension?: string) {
  if (extension === undefined) return true;
  switch (extension.toLowerCase()) {
    // text
    case 'txt':
    case 'pdf':
    case 'json':
      return true;
    // audio
    case 'mp3':
    case 'wav':
    case 'ogg':
      return true;
    // video
    case 'mp4':
    case 'webm':
      return true;

    // image
    case 'apng':
    case 'avif':
    case 'jpg':
    case 'jpeg':
    case 'pjpeg':
    case 'jfif':
    case 'pjp':
    case 'png':
    case 'svg':
    case 'webp':
    case 'tif':
    case 'tiff':
    case 'ico':
    case 'cur':
    case 'bmp':
    case 'gif':
      return true;

  }
  return false;
}


export default FileListTile;
