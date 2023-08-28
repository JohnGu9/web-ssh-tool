import React from "react";
import { Button, IconButton, Tooltip, Typography, Dialog, ListDivider, Icon, TextField } from "rmcw";

import { Server, ThemeContext } from "../../../../common/Providers";
import { FileSize } from "../../../../common/Tools";
import { FileType, Lstat, Rest, Watch } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import Scaffold from "../../../../components/Scaffold";
import styles from "./InformationDialog.module.css";
import { useUuidV4 } from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";

function InformationDialog({ state, close }: {
  close: () => unknown,
  state: InformationDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (error: any) => showMessage({ content: `Delete failed (${error})`, action: <Button label="close" /> });
  const onDeleted = (path: string) => showMessage({ content: `Deleted (${path})`, action: <Button label="close" /> });
  const { type, size, path, basename, entries, ...stats } = state.stat as Watch.Directory;

  const [rename, setRename] = React.useState<RenameDialog.State>({ open: false, dirPath: state.dirPath, file: state.stat });
  const closeRename = () => setRename(v => { return { ...v, open: false } });

  return (
    <>
      <Dialog open={state.open && !rename.open}
        onScrimClick={close}
        onEscapeKey={close}
        title="Information"
        fullscreen
        actions={<>
          {(() => {
            const { stat: { type, path } } = state;
            if (path === undefined || path === null) {
              return (<Button
                leading={<Icon>delete</Icon>}
                label='delete'
                disabled />);
            }
            switch (type) {
              case FileType.file:
                return <DeleteButton onLongPress={async () => {
                  close();
                  const result = await auth.rest('fs.unlink', [[path]]);
                  if (Rest.isError(result)) return onError(result.error);
                  onDeleted(path);
                }} />;
              case FileType.directory:
                return <DeleteButton onLongPress={async () => {
                  close();
                  const result = await auth.rest('fs.rm', [[path]]);
                  if (Rest.isError(result)) return onError(result.error);
                  onDeleted(path);
                }} />;
            }
          })()}
          <div style={{ minWidth: 32, flex: 1 }} />
          {(() => {
            const { type, path } = state.stat;
            if (path !== undefined && path !== null)
              switch (type) {
                case FileType.file:
                case FileType.directory:
                  return (
                    <>
                      <Tooltip label='rename'>
                        <IconButton style={{ color: theme.primary }} onClick={() => {
                          setRename(v => { return { ...v, open: true } })
                        }} ><Icon>drive_file_rename_outline</Icon></IconButton>
                      </Tooltip>
                      <Tooltip label='download'>
                        <IconButton style={{ color: theme.primary }}
                          onClick={() => auth.download(path)
                            .catch(e => showMessage({ content: `Download failed: ${e}` }))} >
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
            return <div ><Typography.Button className={styles.title}>size</Typography.Button>: {size === undefined ? "undefined" : FileSize(size)}</div>
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
        state={rename}
        close={closeRename}
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

function DeleteButton({ onLongPress }: { onLongPress: () => unknown }) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const [down, setDown] = React.useState<boolean>(false);
  return <LongPressButton
    onLongPress={onLongPress}
    onLongPressStart={() => setDown(true)}
    onLongPressEnd={() => setDown(false)}
    icon='delete'
    label='delete'
    style={{
      color: theme.primary,
      backgroundColor: down ? theme.primary : undefined,
      transition: 'background-color 1s'
    }}
    tooltip='Long press to delete' />;
}

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
        <TextField name="rename" ref={ref} required value={value} onChange={e => setValue(e.target.value)} style={{ width: 360 }} />
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
