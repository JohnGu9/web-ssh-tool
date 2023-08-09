import React from "react";
import { Button, Checkbox, Icon, IconButton, ListDivider, ListItem, Menu, Radio, Switch, Tooltip } from "rmcw";
import { Server, ThemeContext } from "../../../../common/Providers";
import { FileType, Lstat, Rest, Watch } from "../../../../common/Type";
import { LongPressIconButton } from "../../../../components/LongPressButton";
import Scaffold from "../../../../components/Scaffold";
import FileExplorer from "../Common";
import CopyToDialog from "./CopyToDialog";
import MoveToDialog from "./MoveToDialog";
import { NewDirectoryDialog, NewFileDialog } from "./NewDialog";

function ToolsBar({ path: dir, realPath, setOnSelect }: {
  path: string | null | undefined,
  realPath: string | null | undefined,
  setOnSelect: (value: boolean) => unknown
}) {
  const { cdToParent } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  return (
    <>
      <IconButton style={{ color: theme.primary }}
        onClick={cdToParent} ><Icon>arrow_back</Icon></IconButton>
      <div className='expanded' />
      <MoreButton dest={dir} />
      <UploadManagementButton />
      <CheckListButton setOnSelect={setOnSelect} />
    </>
  );
}

export default ToolsBar;

function UploadManagementButton() {
  const { openUploadManagement } = React.useContext(FileExplorer.Context);
  return (
    <Tooltip label={'Open upload management'}>
      <IconButton
        onClick={openUploadManagement} >
        <Icon>upload</Icon>
      </IconButton>
    </Tooltip>
  );
}

function MoreButton({ dest }: { dest: string | null | undefined }) {
  const [file, setFile] = React.useState<NewFileDialog.State>({ open: false, path: "" });
  const closeFile = () => setFile({ ...file, open: false });

  const [directory, setDirectory] = React.useState<NewDirectoryDialog.State>({ open: false, path: "" });
  const closeDirectory = () => setDirectory({ ...directory, open: false });

  const [open, setOpen] = React.useState(false);
  const { config, setConfig } = React.useContext(FileExplorer.Context);
  React.useEffect(() => {
    if (open) {
      const listener = () => {
        setOpen(false);
      };
      window.addEventListener('click', listener);
      return () => window.removeEventListener('click', listener);
    }
  }, [open]);
  return (
    <Tooltip label={'More operation'}>
      <Menu
        open={open}
        anchorCorner="bottom-right"
        anchorQuadrant="bottom-left"
        surface={<div>
          {typeof dest === 'string' ? <>
            <ListItem primaryText="New file"
              meta={<Icon>text_snippet</Icon>}
              onClick={() => setFile({ open: true, path: dest })} />
            <ListItem primaryText="New directory"
              meta={<Icon>folder</Icon>}
              onClick={() => setDirectory({ open: true, path: dest })} />
            <ListDivider />
          </> : <></>}
          <ListItem nonInteractive
            primaryText="Sort"
            meta={<Icon>sort</Icon>} />
          {[FileExplorer.SortType.alphabetically,
          FileExplorer.SortType.date,
          FileExplorer.SortType.type].map(t =>
            <ListItem key={t} primaryText={t}
              meta={<Radio checked={config.sort === t} />}
              onClick={() => setConfig({ ...config, sort: t })} />
          )}
          <ListDivider />
          <ListItem primaryText={<span style={{ marginRight: 16 }}>Show hidden items</span>}
            meta={<Switch selected={config.showAll} />}
            onClick={() => setConfig({ ...config, showAll: !config.showAll })} />
          <ListItem primaryText="Upload compress"
            meta={<Switch selected={config.uploadCompress} />}
            onClick={() => setConfig({ ...config, uploadCompress: !config.uploadCompress })} />
        </div>}
      >
        <IconButton
          onClick={() => {
            requestAnimationFrame(() => {
              setOpen(true);
            });
          }} >
          <Icon>more_vert</Icon>
        </IconButton>
      </Menu>
      <NewFileDialog state={file} close={closeFile} />
      <NewDirectoryDialog state={directory} close={closeDirectory} />
    </Tooltip>
  );
}

function CheckListButton({ setOnSelect }: { setOnSelect: (value: boolean) => unknown }) {
  return (
    <Tooltip label='select'>
      <IconButton
        onClick={event => setOnSelect(true)} >
        <Icon>checklist</Icon>
      </IconButton>
    </Tooltip>
  );
}

export function SelectingToolsBar({ state: { path: dir, entries }, selected, setSelected, setOnSelect }: { state: Watch.Directory, selected: Set<Lstat>, setSelected: (value: Set<Lstat>) => unknown, setOnSelect: (value: boolean) => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const selectedList = Array.from(selected);
  const checked = Object.entries(entries).length === selectedList.length;
  return (
    <>
      <div style={{ width: 16 + 3 }} />
      <div className='column' style={{ width: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Tooltip label={checked ? 'cancel select' : 'select all'}>
          <Checkbox checked={checked}
            onChange={() => {
              if (checked) setSelected(new Set());
              else setSelected(new Set(Object.values(entries)));
            }} />
        </Tooltip>
      </div>
      <div style={{ width: 16 }} />
      <DownloadButton callback={async () => auth.download(Array.from(selected)
        .map(v => v.path)
        .filter(v => v !== undefined && v !== null) as string[])
        .catch(e => showMessage({ content: `Download failed: ${e}` }))} />
      <MoveButton path={dir}
        onSubmit={async (newPath) => {
          const onCompleted = () => showMessage({ content: 'Move completed', action: <Button label="close" /> });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type, path } = value;
            const onError = (error: any) => {
              showMessage({ content: `Move [${value}] failed (${error})`, action: <Button label="close" /> })
              return false;
            };
            if (path === undefined || path === null) {
              onError(`No path associate with file ${value}`);
              return;
            }
            switch (type) {
              case FileType.file:
              case FileType.directory:
                const result = await auth.rest('fs.rename', [[path], [newPath]]);
                if (Rest.isError(result)) return onError(result.error);
                return;
            }
          }));
          if (value.length === 0) return true;
          if (value.some(value => value === false)) return false;
          setSelected(new Set());
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <CopyButton path={dir}
        onSubmit={async (newPath) => {
          const onCompleted = () => showMessage({ content: 'Copy completed', action: <Button label="close" /> });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type, path } = value;
            const onError = (error: any) => {
              showMessage({ content: `Copy [${value}] failed (${error})`, action: <Button label="close" /> });
              return false;
            };
            if (path === undefined || path === null) {
              onError(`No path associate with file ${value}`);
              return;
            }
            switch (type) {
              case FileType.file:
              case FileType.directory:
                const result = await auth.rest('fs.cp',
                  [[path], [newPath]]);
                if (Rest.isError(result)) return onError(result.error);
                return;
            }
          }));
          if (value.length === 0) return true;
          if (value.some(value => value === false)) return false;
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <LongPressIconButton
        icon='delete'
        onLongPress={async () => {
          const onCompleted = () => showMessage({ content: 'Deleted completed', action: <Button label="close" /> });
          const value = await Promise.all(Array.from(selected).map(async value => {
            const { type, path } = value;
            const onError = (error: any) => {
              showMessage({ content: `Delete [${value}] failed (${error})`, action: <Button label="close" /> });
              return false;
            };
            if (path === undefined || path === null) {
              onError(`No path associate with file ${value}`);
              return;
            }
            switch (type) {
              case FileType.file: {
                const result = await auth.rest('fs.unlink', [[path]]);
                if (Rest.isError(result)) return onError(result.error);
                return;
              }
              case FileType.directory: {
                const result = await auth.rest('fs.rm', [[path]]);
                if (Rest.isError(result)) return onError(result.error);
                return;
              }
            }
          }));
          setSelected(new Set());
          if (value.length === 0) return true;
          if (value.some(value => value === false)) return false;
          onCompleted();
          setOnSelect(false);
          return true;
        }} />
      <div className='expanded' />
      <IconButton onClick={event => setOnSelect(false)} >
        <Icon>close</Icon>
      </IconButton>
    </>
  );
}

function DownloadButton({ callback }: { callback: () => unknown }) {
  return (
    <Tooltip label='download'>
      <IconButton
        onClick={callback} >
        <Icon>download</Icon>
      </IconButton>
    </Tooltip>
  );
}

function MoveButton({ path, onSubmit }: { path: string | null | undefined, onSubmit: (path: string) => PromiseLike<boolean> }) {
  const [state, setState] = React.useState<MoveToDialog.State>({
    path: path ?? "",
    open: false,
    onSubmit: onSubmit,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip label='move'>
        <IconButton
          disabled={path === undefined || path === null}
          onClick={() => setState({ ...state, open: true })} >
          <Icon>drag_handle</Icon>
        </IconButton>
      </Tooltip>
      <MoveToDialog state={state} close={close} />
    </>
  );
}

function CopyButton({ path, onSubmit }: { path: string | null | undefined, onSubmit: (path: string) => PromiseLike<boolean> }) {
  const [state, setState] = React.useState<CopyToDialog.State>({
    path: path ?? "",
    open: false,
    onSubmit: onSubmit,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip label='copy'>
        <IconButton
          disabled={path === undefined || path === null}
          onClick={() => setState({ ...state, open: true })} >
          <Icon>file_copy</Icon>
        </IconButton>
      </Tooltip>
      <CopyToDialog state={state} close={close} />
    </>
  );
}
