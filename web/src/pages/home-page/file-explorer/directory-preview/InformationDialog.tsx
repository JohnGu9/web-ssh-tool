import React from "react";
import { Button, IconButton, Tooltip, Typography, Dialog, ListDivider, Icon, TextField } from "rmcw";

import { Server, ThemeContext } from "../../../../common/Providers";
import { fileSize } from "../../../../common/Tools";
import { FileType, Lstat, Rest, Watch } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import Scaffold from "../../../../components/Scaffold";
import styles from "./InformationDialog.module.css";
import { useUuidV4 } from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";
import DirectoryPreView from "../DirectoryPreview";

function InformationDialog({ state, close }: {
  close: () => unknown,
  state: InformationDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { type, size, path, basename, entries, ...stats } = state.stat as Watch.Directory;

  const [renameDialog, setRenameDialog] = React.useState<RenameDialog.State>({ open: false, dirPath: state.dirPath, file: state.stat });
  const closeRenameDialog = () => setRenameDialog(v => { return { ...v, open: false } });
  const { deleteDialog, setDeleteDialog } = React.useContext(DirectoryPreView.Context);

  const toRename = () => {
    setRenameDialog({ open: true, dirPath: state.dirPath, file: state.stat });
  };
  const toDelete = () => {
    setDeleteDialog({ open: true, objects: [state.stat] });
  };

  return (
    <>
      <Dialog open={state.open && !renameDialog.open && !deleteDialog.open}
        onScrimClick={close}
        onEscapeKey={close}
        title="Information"
        fullscreen
        actions={<>
          <Button
            leading={<Icon>delete</Icon>}
            label='delete'
            onClick={toDelete} />
          <div className='expanded' />
          {(() => {
            const { type, path } = state.stat;
            if (path !== undefined && path !== null)
              switch (type) {
                case FileType.file:
                case FileType.directory:
                  return (
                    <>
                      <Tooltip label='rename'>
                        <IconButton style={{ color: theme.primary }} onClick={toRename} >
                          <Icon>drive_file_rename_outline</Icon>
                        </IconButton>
                      </Tooltip>
                      <Tooltip label='download'>
                        <IconButton style={{ color: theme.primary }}
                          onClick={() => {
                            showMessage({ content: "Preparing to download" });
                            auth.download(path)
                              .catch(e => showMessage({ content: `Download failed: ${e}` }));
                          }} >
                          <Icon>download</Icon>
                        </IconButton>
                      </Tooltip>
                    </>
                  );
              }
          })()}
          <Button onClick={close} label='close' />
        </>}>
        <div style={{ margin: '16px 0 8px', opacity: 0.5 }}>Basic</div>
        <div><Typography.Button className={styles.title}>path</Typography.Button>: {path ?? '<UNKNOWN>'}</div>
        <div><Typography.Button className={styles.title}>basename</Typography.Button>: {basename ?? '<UNKNOWN>'}</div>
        {type === undefined ? <></> : <Typography.Button className={styles.title}>type: {type ?? '<UNKNOWN>'}</Typography.Button>}
        {(() => {
          if (entries !== undefined) {
            return <div><Typography.Button className={styles.title}>file amount</Typography.Button>: {Object.entries(entries).length}</div>
          } else {
            return <div><Typography.Button className={styles.title}>size</Typography.Button>: {size === undefined ? "undefined" : fileSize(size)}</div>
          }
        })()}
        <div style={{ height: 8 }} />
        <ListDivider />
        <div style={{ margin: '16px 0 8px', opacity: 0.5 }}>Advance</div>
        {Object.entries(stats)
          .map(([key, value]) => {
            if (value === undefined || value === null) return <React.Fragment key={key}></React.Fragment>;
            return <div key={key}><Typography.Button className={styles.title}>{key}</Typography.Button>: {`${value}`}</div>;
          })}
        <div style={{ height: 32 }} />
      </Dialog>
      <RenameDialog
        state={renameDialog}
        close={closeRenameDialog}
        onRenamed={() => {
          close();
          showMessage({ content: "Rename succeed" });
        }} />
    </>
  );
}

namespace InformationDialog {
  export type State = {
    open: boolean,
    dirPath: string,
    stat: Watch.Directory | Watch.File,
  };
}

export default InformationDialog;

function RenameDialog({ state: { file, dirPath, open }, close, onRenamed }: { state: RenameDialog.State, close: () => unknown, onRenamed: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [value, setValue] = React.useState(file.basename ?? "");
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const id = useUuidV4();
  const ref = useInputAutoFocusRef(open);
  return (
    <Dialog open={open}
      onScrimClick={close}
      onEscapeKey={close}
      title="Rename"
      actions={<>
        <LongPressButton
          label='overwrite'
          onLongPress={async () => {
            const currentPath = file.path;
            const newName = value;
            if (currentPath === undefined || currentPath === null) return showMessage({ content: "Error (File name isn't supported)" });
            if (newName.length === 0) return showMessage({ content: "Error (File name can't be empty)" });
            const target = [dirPath, newName];
            const result = await auth.rest('fs.rename', [[currentPath], target]);
            if (Rest.isError(result)) return showMessage({ content: `${result.error}` });
            close();
            onRenamed();
          }} />
        <div className='expanded' />
        <Button type='submit' form={id} leading={<Icon>drive_file_rename_outline</Icon>} label='rename' />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          const currentPath = file.path;
          const newName = value;
          if (currentPath === undefined || currentPath === null) return showMessage({ content: "Error (File name isn't supported)" });
          if (newName.length === 0) return showMessage({ content: "Error (File name can't be empty)" });
          const target = [dirPath, newName];
          const exists = await auth.rest('fs.exists', [target]);
          if (Rest.isError(exists)) return showMessage({ content: `${exists.error}` });
          if (exists) return showMessage({ content: `Error (File [${target}] already exists)` });
          const result = await auth.rest('fs.rename', [[currentPath], target]);
          if (Rest.isError(result)) return showMessage({ content: `${result.error}` });
          close();
          onRenamed();
        }}>
        <TextField required
          id='rename'
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)} style={{ width: 360 }} />
      </form>
    </Dialog>
  );
}

namespace RenameDialog {
  export type State = {
    open: boolean,
    dirPath: string,
    file: Lstat,
  };
}
