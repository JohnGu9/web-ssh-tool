import { Dialog, DialogActions, DialogButton } from "@rmwc/dialog";
import { Stats } from "fs";
import React from "react";
import { IconButton, Tooltip, Typography } from "rmwc";

import { Server, ThemeContext } from "../../../../common/Providers";
import { delay } from "../../../../common/Tools";
import { FileType, Rest } from "../../../../common/Type";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import LongPressButton from "../../../../components/LongPressButton";
import Scaffold from "../../Scaffold";

function InformationDialog({ state: dialog, close, move, rename }: {
  close: () => unknown,
  move: (path: string) => unknown,
  rename: (path: string) => unknown,
  state: InformationDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (error: any) => showMessage({ icon: 'error', title: 'Delete failed', body: error?.message ?? error?.name ?? 'Unknown issue', actions: [{ label: 'close' }] });
  const onDeleted = (path: string) => showMessage({ icon: 'checked', title: 'Deleted', body: path, actions: [{ label: 'close' }] });
  return (
    <Dialog open={dialog.open} onClose={close}>
      <DialogTitle>Information</DialogTitle>
      <DialogContent style={{ overflow: 'auto' }}>
        <div style={{ margin: '0 0 16px' }}><Typography use='button'>path</Typography>: {dialog.path}</div>
        {Object.entries(dialog.stats)
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
                  <Tooltip content='move'>
                    <IconButton style={{ color: theme.primary }} icon='drag_handle' onClick={async () => {
                      close();
                      await delay(150);
                      move(dialog.path);
                    }} />
                  </Tooltip>
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
        <DialogButton onClick={close}>close</DialogButton>
      </DialogActions>
    </Dialog>
  );
}

namespace InformationDialog {
  export type State = {
    open: boolean,
    stats: Stats & { type?: FileType },
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
