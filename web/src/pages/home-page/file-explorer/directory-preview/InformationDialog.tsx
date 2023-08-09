import React from "react";
import { Button, IconButton, Tooltip, Typography, Dialog, ListDivider, Icon } from "rmcw";

import { Server, ThemeContext } from "../../../../common/Providers";
import { FileSize } from "../../../../common/Tools";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import Scaffold from "../../../../components/Scaffold";
import styles from "./InformationDialog.module.css";

function InformationDialog({ state, close, rename }: {
  close: () => unknown,
  rename: () => unknown,
  state: InformationDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (error: any) => showMessage({ content: `Delete failed (${error})`, action: <Button label="close" /> });
  const onDeleted = (path: string) => showMessage({ content: `Deleted (${path})`, action: <Button label="close" /> });
  const { type, size, path, basename, ...stats } = state.stats;
  return (
    <Dialog open={state.open}
      onScrimClick={close}
      onEscapeKey={close}
      title="Information"
      fullscreen
      actions={<>
        {(() => {
          const { stats: { type, path } } = state;
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
          const { type, path } = state.stats;
          if (path !== undefined && path !== null)
            switch (type) {
              case FileType.file:
              case FileType.directory:
                return (
                  <>
                    <Tooltip label='rename'>
                      <IconButton style={{ color: theme.primary }} onClick={() => {
                        close();
                        rename();
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
      <div><Typography.Button className={styles.title}>path</Typography.Button>: {path}</div>
      <div><Typography.Button className={styles.title}>basename</Typography.Button>: {basename}</div>
      {type === undefined ? <></> : <Typography.Button className={styles.title}>type: {type}</Typography.Button>}
      <div ><Typography.Button className={styles.title}>size</Typography.Button>: {size === undefined ? "undefined" : FileSize(size)}</div>
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
  );
}

namespace InformationDialog {
  export type State = {
    open: boolean,
    dirname: string,
    stats: Lstat,
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


