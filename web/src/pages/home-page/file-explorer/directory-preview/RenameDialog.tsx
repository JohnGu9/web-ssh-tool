import path from "path";
import React from "react";
import { SnackbarQueueMessage, TextField } from "rmwc";
import { Dialog, DialogActions, DialogButton } from "@rmwc/dialog";

import { Server, ThemeContext } from "../../../../common/Providers";
import Scaffold from "../../Scaffold";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import { Rest } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import { delay } from "../../../../common/Tools";

function RenameDialog({ state, close }: { state: RenameDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const input = React.useRef<HTMLInputElement>(null);
  const basename = path.basename(state.path);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ ...message, icon: 'error', actions: [{ label: 'close' }] });
  return (
    <Dialog open={state.open} onClose={close}>
      <DialogTitle>Rename</DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={input} defaultValue={basename} style={{ width: 360 }} />
      </DialogContent>
      <DialogActions style={{ paddingLeft: 16, flexDirection: 'row' }}>
        <LongPressButton
          label='overwrite'
          style={{ color: theme.error }}
          onLongPress={async () => {
            const dirname = path.dirname(state.path);
            const newName = input.current?.value ?? '';
            if (newName.length === 0) return onError({ title: 'Error', body: "File name can't be empty" });
            const target = path.join(dirname, newName);
            const result = await auth.rest('fs.rename', [state.path, target]);
            if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
            close();
            await delay(150);
            showMessage({ icon: 'checked', title: 'Overwritten', actions: [{ label: 'close' }] });
          }} />
        <div className='expanded' />
        <DialogButton
          icon='drive_file_rename_outline'
          onClick={async () => {
            const dirname = path.dirname(state.path);
            const newName = input.current?.value ?? '';
            if (newName.length === 0) return onError({ title: 'Error', body: "File name can't be empty" });
            const target = path.join(dirname, newName);
            const exists = await auth.rest('fs.exists', [target]);
            if (Rest.isError(exists)) return onError({ title: exists.error?.name, body: exists.error?.message });
            if (exists) return onError({ title: 'Error', body: `File [${target}] already exists. ` });
            const result = await auth.rest('fs.rename', [state.path, target]);
            if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
            close();
            await delay(150);
            showMessage({ icon: 'checked', title: 'Renamed', actions: [{ label: 'close' }] });
          }}>rename</DialogButton>

        <DialogButton onClick={close}>close</DialogButton>
      </DialogActions>
    </Dialog>
  );
}

namespace RenameDialog {
  export type State = {
    open: boolean,
    path: string
  };
}

export default RenameDialog;
