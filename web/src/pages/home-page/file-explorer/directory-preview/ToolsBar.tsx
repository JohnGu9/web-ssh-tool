import path from "path";
import React from "react";
import { Checkbox, IconButton, MenuItem, MenuSurface, MenuSurfaceAnchor, Tooltip } from "rmwc";
import { Server, ThemeContext } from "../../../../common/Providers";
import { any } from "../../../../common/Tools";
import { FileType, Rest, Watch } from "../../../../common/Type";
import { LongPressIconButton } from "../../../../components/LongPressButton";
import { SharedAxisTransition } from "../../../../components/Transitions";
import Scaffold from "../../Scaffold";
import FileExplorer from "../Common";
import CopyToDialog from "./CopyToDialog";
import MoveToDialog from "./MoveToDialog";
import { NewDirectoryDialog, NewFileDialog } from "./NewDialog";

function ToolsBar({ dir, setOnSelect }: { dir: string, setOnSelect: (value: boolean) => unknown }) {
  const { cd } = React.useContext(FileExplorer.Context);
  const disabled = path.dirname(dir) === dir;
  const { themeData: theme } = React.useContext(ThemeContext);
  return (
    <>
      <IconButton style={{ color: disabled ? undefined : theme.primary }} icon='arrow_back'
        disabled={disabled}
        onClick={() => cd(path.dirname(dir))} />
      <div className='expanded' />
      <NewButton dest={dir} />
      <UploadButton dest={dir} />
      <SortButton />
      <ShowAndHideButton />
      <CheckListButton setOnSelect={setOnSelect} />
    </>
  );
}

export default ToolsBar;

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

export function SelectingToolsBar({ state: { path: dir, files }, selected, setSelected, setOnSelect }: { state: Watch.Directory, selected: Set<string>, setSelected: (value: Set<string>) => unknown, setOnSelect: (value: boolean) => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const fileList = Object.keys(files);
  const selectedList = Array.from(selected);
  const checked = fileList.length === selectedList.length;
  return (
    <>
      <div style={{ width: 16 + 3 }} />
      <div className='column' style={{ width: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Tooltip content={checked ? 'cancel select' : 'select all'}>
          <Checkbox checked={checked}
            onChange={event => {
              if (fileList.length === selectedList.length) setSelected(new Set());
              else setSelected(new Set(fileList));
            }} />
        </Tooltip>
      </div>
      <div style={{ width: 16 }} />
      <DownloadButton callback={() =>
        auth.download(Array.from(selected)
          .map(value => path.join(dir, value)))} />
      <MoveButton path={dir}
        onSubmit={async (newPath) => {
          const onCompleted = () => showMessage({ icon: 'checked', title: 'Move completed', actions: [{ label: 'close' }] });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type } = files[value];
            const onError = (error: any) => {
              showMessage({ icon: 'error', title: `Move [${value}] failed`, body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] })
              return false;
            };
            switch (type) {
              case FileType.file:
              case FileType.directory:
                const target = path.join(newPath, value);
                const exists = await auth.rest('fs.exists', [target]);
                if (Rest.isError(exists)) return onError(exists.error);
                if (exists) return onError({ message: `[${target}] already exists` });
                const result = await auth.rest('fs.rename', [path.join(dir, value), target]);
                if (Rest.isError(result)) return onError(result.error);
                return;
            }
          }));
          if (value.length === 0) return true;
          if (any(value, value => value === false)) return false;
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <CopyButton path={dir}
        onSubmit={async (newPath) => {
          const onCompleted = () => showMessage({ icon: 'checked', title: 'Copy completed', actions: [{ label: 'close' }] });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type } = files[value];
            const onError = (error: any) => {
              showMessage({ icon: 'error', title: `Copy [${value}] failed`, body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] });
              return false;
            };
            switch (type) {
              case FileType.file:
              case FileType.directory:
                const result = await auth.rest('fs.cp',
                  [path.join(dir, value), path.join(newPath, value), { errorOnExist: true }]);
                if (Rest.isError(result)) return onError(result.error);
                return;
            }
          }));
          if (value.length === 0) return true;
          if (any(value, value => value === false)) return false;
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <LongPressIconButton icon='delete'
        style={{ color: theme.error }}
        onLongPress={async () => {
          const onCompleted = () => showMessage({ icon: 'checked', title: 'Deleted completed', actions: [{ label: 'close' }] });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type } = files[value];
            const onError = (error: any) => {
              showMessage({ icon: 'error', title: `Delete [${value}] failed`, body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] });
              return false;
            };
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
          if (value.length === 0) return true;
          if (any(value, value => value === false)) return false;
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <div className='expanded' />
      <IconButton icon='close' onClick={event => setOnSelect(false)} />
    </>
  );
}

function DownloadButton({ callback }: { callback: () => unknown }) {
  return (
    <Tooltip content='download'>
      <IconButton icon='download'
        onClick={callback} />
    </Tooltip>
  );
}

function MoveButton({ path, onSubmit }: { path: string, onSubmit: (path: string) => PromiseLike<boolean> }) {
  const [state, setState] = React.useState<MoveToDialog.State>({
    path: path,
    open: false,
    onSubmit: onSubmit,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip content='move'>
        <IconButton icon='drag_handle'
          onClick={() => setState({ ...state, open: true })} />
      </Tooltip>
      <MoveToDialog state={state} close={close} />
    </>
  );
}

function CopyButton({ path, onSubmit }: { path: string, onSubmit: (path: string) => PromiseLike<boolean> }) {
  const [state, setState] = React.useState<CopyToDialog.State>({
    path: path,
    open: false,
    onSubmit: onSubmit,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip content='copy'>
        <IconButton icon='file_copy'
          onClick={() => setState({ ...state, open: true })} />
      </Tooltip>
      <CopyToDialog state={state} close={close} />
    </>
  );
}
