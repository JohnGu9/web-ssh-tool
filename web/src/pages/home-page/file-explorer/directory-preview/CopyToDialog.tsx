import React from "react";
import { Button, Dialog, Icon, IconButton, LinearProgress, ListItem, TextField, Tooltip, } from "rmcw";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";
import FileExplorer from "../Common";
import { FixedSizeList } from "../../../../components/AdaptedWindow";
import { SharedAxis } from "material-design-transform";
import { fileIcon } from "./FileListTile";
import DirectoryPreView from "../DirectoryPreview";

function CopyToDialog({ state: { open, objects }, close }: { state: CopyToDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const id = "copy-confirm";
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { cd } = React.useContext(FileExplorer.Context);
  const baseNames = React.useMemo(() => {
    const s = new Set<string>();
    for (const object of objects) {
      if (typeof object.basename === 'string') {
        s.add(object.basename);
      }
    }
    return s;
  }, [objects]);

  const [value, setValue] = React.useState("");
  const [openInfo, setOpenInfo] = React.useState(false);
  const [openNew, setOpenNew] = React.useState(false);
  const [newDirectory, setNewDirectory] = React.useState("");
  const controller = React.useMemo(() => new FileExplorer.Controller({ auth }), [auth]);
  const { informationDialog } = React.useContext(DirectoryPreView.Context);
  const [state, setState] = React.useState<{
    updating: boolean;
    state: FileExplorer.ControllerState | undefined;
  } | null>(null);

  const ref = useInputAutoFocusRef(open);
  const openNewRef = useInputAutoFocusRef(openNew);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  const closeInfo = () => setOpenInfo(false);
  const closeNew = () => setOpenNew(false);

  const toCopy = async (newPath: string) => {
    const value = await Promise.all(objects.map(async value => {
      const { type, path, basename } = value;
      if (path === undefined || path === null || basename === undefined || basename === null) {
        return false;
      }
      switch (type) {
        case FileType.file:
        case FileType.directory: {
          const result = await auth.rest('fs.cp', [[path], [newPath, basename]]);
          if (Rest.isError(result)) return false;
          return true;
        }
      }
      return false;
    }));

    if (value.every(v => v === false)) {
      showMessage({ content: 'Copy failed' });
      return false;
    } else {
      const action = <Button onClick={() => cd(newPath)}>view</Button>;
      if (value.some(value => value === false)) {
        showMessage({ content: 'Some objects copy failed', action });
        return true;
      } else {
        showMessage({ content: 'Copy succeed', action });
        return true;
      }
    }
  };

  const toMove = async (newPath: string) => {
    const value = await Promise.all(objects.map(async value => {
      const { type, path, basename } = value;
      if (path === undefined || path === null || basename === undefined || basename === null) {
        return false;
      }
      switch (type) {
        case FileType.file:
        case FileType.directory: {
          const result = await auth.rest('fs.rename', [[path], [newPath, basename]]);
          if (Rest.isError(result)) return false;
          return true;
        }
      }
      return false;
    }));
    if (value.every(v => v === false)) {
      showMessage({ content: 'Move failed' });
      return false;
    } else {
      const action = <Button onClick={() => cd(newPath)}>view</Button>;
      if (value.some(value => value === false)) {
        showMessage({ content: 'Some objects move failed', action });
        return true;
      } else {
        showMessage({ content: 'Move succeed', action });
        return true;
      }
    }
  };

  React.useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  React.useEffect(() => {
    if (open) {
      const listener = () => {
        setState(controller.state);
        if (typeof controller.state.state?.path === 'string') {
          setValue(controller.state.state.path);
        }
      };
      listener();
      controller.addEventListener('change', listener);
      return () => {
        controller.removeEventListener('change', listener);
      };
    }
  }, [auth, controller, open]);

  const directory = (() => {
    if (state?.state) {
      if ('entries' in state.state) {
        return state.state;
      }
    }
  })();

  const entries = directory ? Object.entries(directory.entries).sort((f, s) => {
    if (f[1].type === FileType.directory && s[1].type !== FileType.directory) {
      return -1;
    }
    if (f[1].type !== FileType.directory && s[1].type === FileType.directory) {
      return 1;
    }
    return compare(f[0], s[0]);
  }) : undefined;

  const repeats = new Set(objects.filter(v => typeof v.basename === 'string' && directory?.entries?.[v.basename] !== undefined));

  const height = 560 - 59 - 65 - 48 - 56 - 32;

  return (<>
    <Dialog
      ref={dialogRef}
      open={open && !openInfo && !openNew && !informationDialog.open}
      onScrimClick={close}
      onEscapeKey={close}
      fullscreen
      title="Copy"
      actions={<>
        <Button label="move" leading={<Icon>drag_handle</Icon>}
          onClick={async event => {
            event.preventDefault();
            if (await toMove(value)) close();
          }}></Button>
        <div className="expanded" />
        <Button type='submit' form={id}
          label="copy" leading={<Icon>file_copy</Icon>}></Button>
        <Button onClick={close}>close</Button>
      </>}>
      <form id={id} className="column flex-stretch"
        style={{ pointerEvents: state?.updating ? 'none' : undefined }}
        onSubmit={async event => {
          event.preventDefault();
          if (await toCopy(value)) close();
        }}>
        <LinearProgress closed={!(state?.updating)} />
        <div style={{ height: 56 }} className="row">
          <IconButton onClick={e => {
            e.preventDefault();
            controller.cdToParent();
          }}><Icon>arrow_back</Icon></IconButton>
          <div className="expanded" />
          <IconButton onClick={e => {
            e.preventDefault();
            controller.cd(null);
          }}><Icon>home</Icon></IconButton>
          <IconButton onClick={e => {
            e.preventDefault();
            setOpenNew(true);
          }}><Icon>create_new_folder</Icon></IconButton>
          <Tooltip label={repeats.size === 0 ?
            `Total ${objects.length} ${objects.length === 1 ? 'item' : 'items'}` :
            'File name conflict'}>
            <IconButton onClick={e => {
              e.preventDefault();
              setOpenInfo(true);
            }}><Icon style={{
              color: repeats.size === 0 ? undefined : '#b00020',
            }}>info</Icon></IconButton>
          </Tooltip>
        </div>
        <SharedAxis keyId={directory?.path}>
          {entries && entries.length !== 0 ?
            <FixedSizeList style={{ height }} itemCount={entries.length} itemSize={56} >
              {({ style, index }) => {
                const [name, entry] = entries[index];
                return <MyListItem
                  key={index}
                  style={style}
                  stat={entry}
                  baseNames={baseNames}
                  name={name}
                  controller={controller} />;
              }}
            </FixedSizeList> :
            entries === undefined ?
              <div style={{ height }}
                className="column flex-center">
                Unknown directory
              </div> :
              <div style={{ height }}
                className="column flex-center">
                Empty
              </div>}
        </SharedAxis>
        <TextField
          required
          style={{ display: 'block' }}
          id="copy-target-path"
          label="Destination"
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              controller.cd(value);
            }
          }} />
      </form>
    </Dialog>
    <Dialog open={openInfo}
      onScrimClick={closeInfo}
      onEscapeKey={closeInfo}
      fullscreen
      title="Files"
      actions={<Button onClick={closeInfo}>close</Button>}>
      {objects.map((v, index) => {
        const repeat = repeats.has(v);
        return <ListItem key={index}
          selected={repeat}
          graphic={<Icon>{fileIcon(v)}</Icon>}
          primaryText={v.basename}
          secondaryText={repeat ? 'current directory contains repeated name file or directory' : v.path} />
      })}
    </Dialog>
    <Dialog open={openNew}
      onScrimClick={closeNew}
      onEscapeKey={closeNew}
      fullscreen
      title="New Directory"
      actions={<>
        <Button onClick={async e => {
          e.preventDefault();
          if (typeof directory?.path !== 'string') return showMessage({ content: 'Missing parent directory' });
          const newName = newDirectory;
          if (newName.length === 0) return showMessage({ content: "Error (File name can't be empty)" });
          const target = [directory.path, newName];
          const result = await auth.rest('fs.mkdir', [target]);
          if (Rest.isError(result)) return showMessage({ content: `${result.error}` });
          closeNew();
          showMessage({ content: `Created (${target})` });
        }} form="copy-new-directory">create</Button>
        <Button onClick={closeNew}>close</Button>
      </>}>
      <form id="copy-new-directory" className="column flex-stretch">
        <TextField ref={openNewRef} value={newDirectory}
          onChange={e => setNewDirectory(e.target.value)} />
      </form>
    </Dialog>
  </>);
}

namespace CopyToDialog {
  export type State = {
    open: boolean,
    objects: Lstat[],
  };
}

export default CopyToDialog;

function MyListItem({ stat: entry, baseNames, name, style, controller }: {
  stat: Lstat,
  baseNames: Set<string>,
  name: string,
  style: React.CSSProperties,
  controller: FileExplorer.Controller,
}) {
  const [hover, setHover] = React.useState(false);
  const { state, setInformation } = React.useContext(DirectoryPreView.Context);
  const repeat = baseNames.has(name);

  switch (entry.type) {
    case FileType.directory:
      return <ListItem style={style}
        selected={repeat}
        graphic={<Icon>folder</Icon>}
        primaryText={name}
        meta={<IconButton
          style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
          onClick={event => {
            event.stopPropagation();
            if (typeof state.path === 'string')
              setInformation({ open: true, stat: entry, dirPath: state.path });
          }} >
          <Icon>more_horiz</Icon>
        </IconButton>}
        onClick={e => {
          e.preventDefault();
          if (typeof entry.path === 'string') {
            controller?.cd(entry.path);
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)} />;
  }
  return <ListItem nonInteractive
    style={style}
    selected={repeat}
    graphic={<Icon>{fileIcon(entry)}</Icon>}
    primaryText={name}
    secondaryText={repeat ? "repeated name" : undefined}
    meta={<IconButton
      style={{ opacity: hover ? 1 : 0, transition: 'opacity 300ms' }}
      onClick={event => {
        event.stopPropagation();
        if (typeof state.path === 'string')
          setInformation({ open: true, stat: entry, dirPath: state.path });
      }} >
      <Icon>more_horiz</Icon>
    </IconButton>}
    onMouseEnter={() => setHover(true)}
    onMouseLeave={() => setHover(false)} />;
}

function compare(a: string, b: string) {
  if (!a.startsWith('.') && b.startsWith('.')) return -1;
  if (a.startsWith('.') && !b.startsWith('.')) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
