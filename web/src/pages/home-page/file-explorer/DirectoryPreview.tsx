import { Stats } from "fs";
import path from "path";
import React from "react";
import { IconButton, SimpleListItem, Tooltip } from "rmwc";
import { ThemeContext } from "../../../common/Providers";
import { FileType, Watch } from "../../../common/Type";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import MoveDialog from "./directory-preview/MoveDialog";
import RenameDialog from "./directory-preview/RenameDialog";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { cd, config, setConfig } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);

  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, path: '', stats: {} as Stats });
  const closeInformation = () => setInformation({ ...information, open: false });

  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, path: '' });
  const closeRename = () => setRename({ ...rename, open: false });

  const [move, setMove] = React.useState<MoveDialog.State>({ open: false, path: '' });
  const closeMove = () => setMove({ ...rename, open: false });

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
      <DropZone style={{ flex: 1, width: '100%', overflowY: 'auto' }} dirname={dir}>
        {fileList.length === 0
          ? <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : <>{FileExplorer.sortArray(fileList, config.sort)
            .map(([key, value]) => {
              return <FileListTile
                key={key}
                dirname={dir}
                name={key}
                stats={value}
                onClick={() => cd(path.join(dir, key))}
                onDetail={(stats, path) => setInformation({ open: true, stats, path })} />
            })}
            <div className='row' style={{ height: 64 }} />
          </>}
      </DropZone>
      <div style={{ height: 16 }} />
      <Tooltip content={dir}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%', padding: '0 8px' }}>{dir}</div>
      </Tooltip>
      <InformationDialog
        key={information.path}
        state={information}
        close={closeInformation}
        move={path => setMove({ open: true, path })}
        rename={path => setRename({ open: true, path })} />
      <RenameDialog
        key={rename.path}
        state={rename} close={closeRename} />
      <MoveDialog
        key={move.path}
        state={move} close={closeMove} />
    </div>
  );
}

export default DirectoryPreView;

function DropZone({ children, style, dirname }: { children: React.ReactNode, dirname: string, style?: React.CSSProperties }) {
  const { upload } = React.useContext(FileExplorer.Context);
  const [drag, setDrag] = React.useState(false);
  return <div style={{ ...style, opacity: drag ? 0.5 : 1, transition: 'opacity 300ms' }}
    onDragEnter={() => setDrag(true)}
    onDragLeave={() => setDrag(false)}
    onDragOver={event => event.preventDefault()}
    onDrop={event => {
      event.preventDefault();
      setDrag(false);
      for (const file of Array.from(event.dataTransfer.files))
        upload(file, dirname);
    }}
  >{children}</div>;
}

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
