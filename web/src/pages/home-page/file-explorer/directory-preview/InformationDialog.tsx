import React from "react";
import { Button, IconButton, Tooltip, Typography, Dialog, DialogActions, ListDivider } from "rmwc";

import { Server, ThemeContext } from "../../../../common/Providers";
import { delay } from "../../../../common/Tools";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import LongPressButton from "../../../../components/LongPressButton";
import Scaffold from "../../Scaffold";

function InformationDialog({ state: dialog, close, rename }: {
  close: () => unknown,
  rename: (path: string) => unknown,
  state: InformationDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (error: any) => showMessage({ icon: 'error', title: 'Delete failed', body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] });
  const onDeleted = (path: string) => showMessage({ icon: 'checked', title: 'Deleted', body: path, actions: [{ label: 'close' }] });
  const { type, size, atime, mtime, ctime, birthtime, ...stats } = dialog.stats;
  return (
    <Dialog open={dialog.open} onClose={close}>
      <DialogTitle>Information</DialogTitle>
      <DialogContent style={{ overflow: 'auto', maxHeight: 360 }}>
        <div style={{ margin: '0 0 16px' }}><Typography use='button' >path</Typography>: {dialog.path}</div>
        <ListDivider />
        <div style={{ margin: '16px 0 8px', opacity: 0.5 }}>Basic</div>
        {type === undefined ? <></> : <Typography use='button'>type: {type}</Typography>}
        <div ><Typography use='button'>size</Typography>: {FileSize(size)}</div>
        <div ><Typography use='button'>atime</Typography>: {atime}</div>
        <div ><Typography use='button'>mtime</Typography>: {mtime}</div>
        <div ><Typography use='button'>ctime</Typography>: {ctime}</div>
        <div ><Typography use='button'>birthtime</Typography>: {birthtime}</div>
        <div style={{ height: 8 }} />
        <ListDivider />
        <div style={{ margin: '16px 0 8px', opacity: 0.5 }}>Advance</div>
        {Object.entries(stats)
          .map(([key, value]) => {
            return <div key={key}><Typography use='button'>{key}</Typography>: {value}</div>;
          })}
        <div style={{ height: 32 }} />
      </DialogContent>
      <DialogActions style={{ paddingLeft: 16, flexDirection: 'row', width: 560 }}>
        {(() => {
          const { path, stats: { type } } = dialog;
          switch (type) {
            case FileType.file:
              return <DeleteButton onLongPress={async () => {
                close();
                const result = await auth.rest('fs.unlink', [path]);
                if (Rest.isError(result)) return onError(result.error);
                onDeleted(path);
              }} />;
            case FileType.directory:
              return <DeleteButton onLongPress={async () => {
                close();
                const result = auth.rest('fs.rm', [path, { recursive: true }]);
                if (Rest.isError(result)) return onError(result.error);
                onDeleted(path);
              }} />;
          }
        })()}
        <div style={{ minWidth: 32, flex: 1 }} />
        {(() => {
          const { type } = dialog.stats;
          switch (type) {
            case FileType.file:
            case FileType.directory:
              return (
                <>
                  <Tooltip content='rename'>
                    <IconButton style={{ color: theme.primary }} icon='drive_file_rename_outline' onClick={async () => {
                      close();
                      await delay(150);
                      rename(dialog.path);
                    }} />
                  </Tooltip>
                  <Tooltip content='download'>
                    <IconButton style={{ color: theme.primary }} icon='download' onClick={() => auth.download(dialog.path)} />
                  </Tooltip>
                </>
              );
          }
        })()}
        <Button onClick={close} label='close' />
      </DialogActions>
    </Dialog>
  );
}

namespace InformationDialog {
  export type State = {
    open: boolean,
    stats: Lstat,
    path: string
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
      color: theme.error,
      backgroundColor: down ? theme.error : undefined,
      transition: 'background-color 1s'
    }}
    tooltip='Long press to delete' />;
}

function FileSize(size: number) {
  if (size > 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB (${size} bytes)`;
  else if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB (${size} bytes)`;
  else if (size > 1024) return `${(size / (1024)).toFixed(2)} KB (${size} bytes)`;
  else return `${size} bytes`;
}
