import { Stats } from "fs";
import path from "path";
import React from "react";
import { IconButton, MenuItem, MenuSurface, MenuSurfaceAnchor, Tooltip } from "rmwc";
import { Server, ThemeContext } from "../../../common/Providers";
import { Rest, Watch } from "../../../common/Type";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer from "./Common";
import GoToDialog from "./directory-preview/GoToDialog";
import InformationDialog from "./directory-preview/InformationDialog";
import MoveDialog from "./directory-preview/MoveDialog";
import { NewDirectoryDialog, NewFileDialog } from "./directory-preview/NewDialog";
import RenameDialog from "./directory-preview/RenameDialog";
import FileListTile from "./FileListTile";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { cd, config, setConfig } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);

  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, path: '', stats: {} as Stats });
  const closeInformation = () => setInformation({ ...information, open: false });

  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, path: '' });
  const closeRename = () => setRename({ ...rename, open: false });

  const [move, setMove] = React.useState<MoveDialog.State>({ open: false, path: '' });
  const closeMove = () => setMove({ ...move, open: false });

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
        <NewButton dest={dir} />
        <UploadButton dest={dir} />
        <SortButton config={config} setConfig={setConfig} />
        <ShowAndHideButton config={config} setConfig={setConfig} />
      </div>
      <DropZone style={{ flex: 1, width: '100%', overflowY: 'auto' }} dirname={dir}>
        {fileList.length === 0
          ? <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            Nothing here...
          </div>
          : <>
            {FileExplorer.sortArray(fileList, config.sort)
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
      <Navigator dir={dir} />
      <InformationDialog
        key={information.path}
        state={information}
        close={closeInformation}
        move={path => setMove({ open: true, path })}
        rename={path => setRename({ open: true, path })} />
      <RenameDialog
        key={`rename: ${rename.path}`}
        state={rename} close={closeRename} />
      <MoveDialog
        key={`move: ${move.path}`}
        state={move} close={closeMove} />
    </div>
  );
}

export default DirectoryPreView;

function DropZone({ children, style, dirname }: { children: React.ReactNode, dirname: string, style?: React.CSSProperties }) {
  const { upload } = React.useContext(FileExplorer.Context);
  const [drag, setDrag] = React.useState(false);
  const auth = React.useContext(Server.Authentication.Context);
  return <div style={{ ...style, opacity: drag ? 0.5 : 1, transition: 'opacity 300ms' }}
    onDragEnter={() => setDrag(true)}
    onDragLeave={() => setDrag(false)}
    onDragOver={event => event.preventDefault()}
    onDrop={event => {
      event.preventDefault();
      setDrag(false);
      const { items, files } = event.dataTransfer;
      if (items && items.length > 0 && 'webkitGetAsEntry' in items[0]) {
        try {
          for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry();
            if (entry) uploadItem(dirname, entry, upload, auth);
          }
          return;
        } catch (error) {
          // browser not support webkit
        }
      }
      for (const file of Array.from(files))
        upload(file, dirname);
    }}
  >{children}</div>;
}

async function uploadItem(dest: string, entry: FileSystemEntry, upload: (file: File, dest: string) => void, auth: Server.Authentication.Type): Promise<unknown> {
  if (entry.isFile) {
    const file = await new Promise<File>(resolve => (entry as unknown as any).file(resolve));
    return upload(file, dest);
  } else if (entry.isDirectory) {
    const newDest = path.join(dest, entry.name);
    const dirReader = (entry as unknown as any).createReader();
    const [result, entries] = await Promise.all([
      auth.rest('fs.mkdir', [newDest]),
      new Promise<FileSystemEntry[]>(resolve => dirReader.readEntries(resolve)),
    ]);
    if (Rest.isError(result)) return;
    const list = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      list.push(uploadItem(newDest, entry, upload, auth));
    }
    return Promise.all(list);
  }
}

function Navigator({ dir }: { dir: string }) {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: dir });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      <Tooltip content={dir}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%', padding: '0 8px' }}
          onClick={() => setDialog({ open: true, path: dir })}>{dir}</div>
      </Tooltip>
      <GoToDialog state={dialog} close={close} />
    </>
  );
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

function NewButton({ dest }: { dest: string }) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  const [file, setFile] = React.useState<NewFileDialog.State>({ open: false, path: dest });
  const closeFile = () => setFile({ ...file, open: false });

  const [directory, setDirectory] = React.useState<NewDirectoryDialog.State>({ open: false, path: dest });
  const closeDirectory = () => setDirectory({ ...directory, open: false });

  return (
    <>
      <MenuSurfaceAnchor>
        <MenuSurface anchorCorner='bottomStart'
          open={open}
          onClose={close}>
          <MenuItem onClick={() => {
            close();
            setFile({ open: true, path: dest });
          }}>File</MenuItem>
          <MenuItem onClick={() => {
            close();
            setDirectory({ open: true, path: dest });
          }}>Directory</MenuItem>
        </MenuSurface>
        <Tooltip content='new' open={open ? false : undefined}>
          <IconButton
            icon='add'
            onClick={event => setOpen(true)} />
        </Tooltip>
      </MenuSurfaceAnchor>
      <NewFileDialog state={file} close={closeFile} />
      <NewDirectoryDialog state={directory} close={closeDirectory} />
    </>
  );
}
