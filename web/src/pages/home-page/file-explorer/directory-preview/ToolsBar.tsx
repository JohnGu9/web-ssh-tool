import React from "react";
import { Checkbox, Icon, IconButton, ListDivider, ListItem, Menu, Radio, Switch, Tooltip, Typography } from "rmcw";
import { Server, ThemeContext } from "../../../../common/Providers";
import { Lstat, Watch } from "../../../../common/Type";
import Scaffold from "../../../../components/Scaffold";
import FileExplorer from "../Common";
import CopyToDialog from "./CopyToDialog";
import MoveToDialog from "./MoveToDialog";
import { NewDirectoryDialog, NewFileDialog } from "./NewDialog";
import DeleteDialog from "./DeleteDialog";
import InformationDialog from "./InformationDialog";
import DirectoryPreView from "../DirectoryPreview";

function ToolsBar() {
  const { state, setOnSelecting, setInformation, setFileMove } = React.useContext(DirectoryPreView.Context);

  const { cdToParent } = React.useContext(FileExplorer.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { parent } = state;
  const hasParent = parent !== null && parent !== undefined;
  return (
    <>
      <div style={{ minWidth: 8 }} />
      <IconButton
        style={{ color: hasParent ? theme.primary : undefined }}
        onClick={cdToParent}
        disabled={!hasParent}
        draggable={hasParent}
        onDragStart={hasParent ? event => {
          event.dataTransfer.setData('text', parent);
          event.dataTransfer.effectAllowed = 'all';
          event.dataTransfer.dropEffect = 'copy';
        } : undefined}
        onDragOver={hasParent ? e => e.preventDefault() : undefined}
        onDrop={hasParent ? event => {
          event.preventDefault();
          const filename = event.dataTransfer.getData('filename');
          const path = event.dataTransfer.getData('text');
          if (parent === path) return;
          if (path.length !== 0 && filename.length !== 0) {
            setFileMove({ open: true, filename, path, target: parent });
          }
        } : undefined}>
        <Icon>arrow_back</Icon>
      </IconButton>
      <div className='expanded' />
      <MoreButton stats={state} setInformation={setInformation} />
      <UploadManagementButton />
      <CheckListButton setOnSelect={setOnSelecting} />
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

function MoreButton({ stats, setInformation }: {
  stats: Watch.Directory,
  setInformation: (value: InformationDialog.State) => unknown,
}) {
  const { path: dest } = stats;
  const { parent } = stats;

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
          {parent !== undefined && parent !== null ?
            <ListItem
              primaryText="About Directory"
              meta={<Icon>info</Icon>}
              onClick={e => {
                e.preventDefault();
                setInformation({ open: true, dirPath: parent, stat: stats })
              }} /> :
            <ListItem
              primaryText="About Directory"
              meta={<Icon>info</Icon>}
              disabled />}
          {typeof dest === 'string' ? <>
            <ListItem primaryText="New File"
              meta={<Icon>text_snippet</Icon>}
              onClick={() => setFile({ open: true, path: dest })} />
            <ListItem primaryText="New Directory"
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
            <ListItem key={t} primaryText={<Typography.Button>{t}</Typography.Button>}
              meta={<Radio checked={config.sort === t} />}
              onClick={() => setConfig({ ...config, sort: t })} />
          )}
          <ListDivider />
          <ListItem primaryText={<span style={{ marginRight: 16 }}>Show Hidden Items</span>}
            meta={<Switch selected={config.showAll} />}
            onClick={() => setConfig({ ...config, showAll: !config.showAll })} />
          <ListItem primaryText="Upload Compress"
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

export function SelectingToolsBar() {
  const { state: { path: dir, entries }, selected, setSelected, setOnSelecting, } = React.useContext(DirectoryPreView.Context);
  const selectedList = Array.from(selected);
  const entriesList = Object.entries(entries);
  const checked = (() => {
    const len = entriesList.length;
    if (len === selectedList.length) return true;
    if (selectedList.length === 0) return false;
    else return "mixed";
  })();
  return (
    <>
      <div style={{ width: 16 + 3 }} />
      <div className='column' style={{ width: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Checkbox checked={checked}
          onChange={() => {
            switch (checked) {
              case true:
                setSelected(new Set());
                break;
              case false:
              case "mixed":
                setSelected(new Set(entriesList.map(v => v[1])));
                break;
            }
          }} />
      </div>
      <div style={{ width: 16 }} />
      <DownloadButton objects={selectedList} />
      <MoveButton
        initialPath={dir ?? ""}
        objects={selectedList} />
      <CopyButton
        objects={selectedList} />
      <DeleteButton objects={selectedList} />
      <div className='expanded' />
      <IconButton onClick={() => setOnSelecting(false)} >
        <Icon>close</Icon>
      </IconButton>
    </>
  );
}

function DownloadButton({ objects }: { objects: Lstat[], }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  return (
    <Tooltip label='download'>
      <IconButton
        disabled={objects.length === 0}
        onClick={async () => auth.download(objects
          .map(v => v.path)
          .filter(v => v !== undefined && v !== null) as string[])
          .catch(e => showMessage({ content: `Download failed: ${e}` }))} >
        <Icon>download</Icon>
      </IconButton>
    </Tooltip>
  );
}

function MoveButton({ objects, initialPath }: { objects: Lstat[], initialPath: string }) {
  const [state, setState] = React.useState<MoveToDialog.State>({
    objects,
    initialPath,
    open: false,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip label='move'>
        <IconButton
          disabled={objects.length === 0}
          onClick={() => setState({ ...state, objects, open: true })} >
          <Icon>drag_handle</Icon>
        </IconButton>
      </Tooltip>
      <MoveToDialog state={state} close={close} />
    </>
  );
}

function CopyButton({ objects }: { objects: Lstat[] }) {
  const [state, setState] = React.useState<CopyToDialog.State>({
    objects,
    open: false,
  });
  const close = () => setState({ ...state, open: false });
  return (
    <>
      <Tooltip label='copy'>
        <IconButton
          disabled={objects.length === 0}
          onClick={() => setState({ objects, open: true })} >
          <Icon>file_copy</Icon>
        </IconButton>
      </Tooltip>
      <CopyToDialog state={state} close={close} />
    </>
  );
}

function DeleteButton({ objects }: { objects: Lstat[] }) {
  const [state, setState] = React.useState<DeleteDialog.State>({
    objects,
    open: false,
  });
  const close = () => setState({ ...state, open: false });
  return (<>
    <Tooltip label='delete'>
      <IconButton
        disabled={objects.length === 0}
        onClick={() => setState({ objects, open: true })} >
        <Icon>delete</Icon>
      </IconButton>
    </Tooltip>
    <DeleteDialog state={state} close={close} />
  </>);
}
