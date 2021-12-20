import { Stats } from "fs";
import path from "path";
import React from "react";
import { Button, IconButton, MenuItem, MenuSurface, MenuSurfaceAnchor, Tooltip } from "rmwc";
import { Server, ThemeContext } from "../../../common/Providers";
import { FileType, Rest, Watch } from "../../../common/Type";
import { SharedAxisTransition } from "../../../components/Transitions";
import FileExplorer from "./Common";
import GoToDialog from "./directory-preview/GoToDialog";
import InformationDialog from "./directory-preview/InformationDialog";
import MoveDialog from "./directory-preview/MoveDialog";
import { NewDirectoryDialog, NewFileDialog } from "./directory-preview/NewDialog";
import RenameDialog from "./directory-preview/RenameDialog";
import FileListTile from "./directory-preview/FileListTile";
import LongPressButton from "../../../components/LongPressButton";
import DropZone from "./directory-preview/DropZone";
import Scaffold from "../Scaffold";

function DirectoryPreView({ state: { path: dir, files } }: { state: Watch.Directory }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { cd, config } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const [onSelect, setOnSelect] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<string>());
  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, path: '', stats: {} as Stats });
  const fileList = Object.entries(files).filter(config.showAll
    ? () => true
    : ([key]) => !key.startsWith('.'));
  const disabled = path.dirname(dir) === dir;
  return (
    <div className='full-size column' >
      <SharedAxisTransition className='row' style={{ height: 56, padding: '0 8px 0 0' }}
        type={SharedAxisTransition.Type.fromTopToBottom} id={onSelect}>
        {onSelect
          ? <>
            <div style={{ width: 8 }} />
            <Button icon='download' label='download'
              onClick={() => auth.download(Array.from(selected).map(value => path.join(dir, value)))} />
            <LongPressButton icon='delete' label='delete'
              style={{ color: theme.error }}
              onLongPress={async () => {
                const onError = (error: any) => showMessage({ icon: 'error', title: 'Delete failed', body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] });
                const onDeleted = () => showMessage({ icon: 'checked', title: 'Deleted', actions: [{ label: 'close' }] });
                const value = await Promise.all(Array.from(selected).map(async value => {
                  const { type } = files[value];
                  switch (type) {
                    case FileType.file: {
                      const result = await auth.rest('fs.unlink', [path.join(dir, value)]);
                      if (Rest.isError(result)) return onError(result.error);
                      return;
                    }
                    case FileType.directory: {
                      const result = await auth.rest('fs.rm', [path.join(dir, value), { recursive: true }]);
                      if (Rest.isError(result)) return onError(result.error);
                      return;
                    }
                  }
                }));
                if (value.length === 0) return;
                onDeleted();
              }} />
            <div className='expanded' />
            <IconButton icon='close' onClick={event => setOnSelect(false)} />
          </>
          : <>
            <IconButton style={{ color: disabled ? undefined : theme.primary }} icon='arrow_back'
              disabled={disabled}
              onClick={() => cd(path.dirname(dir))} />
            <div className='expanded' />
            <NewButton dest={dir} />
            <UploadButton dest={dir} />
            <SortButton />
            <ShowAndHideButton />
            <CheckListButton setOnSelect={setOnSelect} />
          </>}
      </SharedAxisTransition>
      <DropZone style={{ flex: 1, width: '100%', minHeight: 0, overflowY: 'auto' }} dirname={dir}>
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
                  selected={selected.has(key)}
                  onSelect={onSelect}
                  onSelected={value => {
                    if (value) {
                      selected.add(key);
                      setSelected(new Set(selected));
                    } else {
                      selected.delete(key);
                      setSelected(new Set(selected));
                    }
                  }}
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
      <Dialogs information={information} setInformation={setInformation} />
    </div>
  );
}

export default DirectoryPreView;

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

function ShowAndHideButton() {
  const { config, setConfig } = React.useContext(FileExplorer.Context);
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

function SortButton() {
  const { config, setConfig } = React.useContext(FileExplorer.Context);
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

function CheckListButton({ setOnSelect }: { setOnSelect: (value: boolean) => unknown }) {
  return (
    <Tooltip content='select'>
      <IconButton
        icon='checklist'
        onClick={event => setOnSelect(true)} />
    </Tooltip>
  );
}


function Dialogs({ children, information, setInformation }: {
  children?: React.ReactNode,
  information: InformationDialog.State,
  setInformation: (state: InformationDialog.State) => unknown,
}) {
  const closeInformation = () => setInformation({ ...information, open: false });
  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, path: '' });
  const closeRename = () => setRename({ ...rename, open: false });
  const [move, setMove] = React.useState<MoveDialog.State>({ open: false, path: '' });
  const closeMove = () => setMove({ ...move, open: false });
  return (
    <>
      {children}
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
    </>
  );
}