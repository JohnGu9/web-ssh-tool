import React from "react";
import { Button, SnackbarQueueMessage, TextField } from "rmwc";
import { Dialog, DialogActions } from "@rmwc/dialog";

import { Server, ThemeContext } from "../../../../common/Providers";
import Scaffold from "../../Scaffold";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import { Rest } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import delay from "../../../../common/Delay";

function MoveDialog({ state, close }: { state: MoveDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const input = React.useRef<HTMLInputElement>(null);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ icon: 'error', actions: [{ label: 'close' }], ...message, });
  return (
    <Dialog tag='form' open={state.open} onClose={close}
      onSubmit={async event => {
        event.preventDefault();
        const target = input.current?.value ?? '';
        if (target.length === 0) return onError({ title: 'Error', body: "Path can't be empty" });
        const exists = await auth.rest('fs.exists', [target]);
        if (Rest.isError(exists)) return onError({ title: exists.error?.name, body: exists.error?.message });
        if (exists) return onError({ title: 'Error', body: `File [${target}] already exists. ` });
        const result = await auth.rest('fs.rename', [state.path, target]);
        if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
        close();
        await delay(150);
        showMessage({ icon: 'checked', title: 'Moved', actions: [{ label: 'close' }] });
      }}>
      <DialogTitle>Move</DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={input} defaultValue={state.path} style={{ width: 480 }} />
      </DialogContent>
      <DialogActions style={{ paddingLeft: 16, flexDirection: 'row' }}>
        <LongPressButton
          type='button'
          label='overwrite'
          style={{ color: theme.error }}
          onLongPress={async () => {
            const target = input.current?.value ?? '';
            if (target.length === 0) return onError({ title: 'Error', body: "Path can't be empty" });
            const result = await auth.rest('fs.rename', [state.path, target]);
            if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
            close();
            await delay(150);
            showMessage({ icon: 'checked', title: 'Overwritten', actions: [{ label: 'close' }] });
          }} />
        <div className='expanded' />
        <Button type='submit' icon='drag_handle' label='move' />
        <Button type='button' onClick={close} label='close' />
      </DialogActions>
    </Dialog>
  );
}

namespace MoveDialog {
  export type State = {
    open: boolean,
    path: string
  };
}

export default MoveDialog;
