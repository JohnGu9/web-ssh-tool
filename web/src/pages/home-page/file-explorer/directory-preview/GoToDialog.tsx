import React from "react";
import { Button, SnackbarQueueMessage, TextField } from "rmwc";
import { Dialog, DialogActions } from "@rmwc/dialog";

import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import Scaffold from "../../Scaffold";
import FileExplorer from "../Common";

function GoToDialog({ state: { open, path }, close }: { state: GoToDialog.State, close: () => unknown}) {
  const input = React.useRef<HTMLInputElement>(null);
  const { cd } = React.useContext(FileExplorer.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ icon: 'error', actions: [{ label: 'close' }], ...message, });
  return (
    <Dialog key={path} open={open} onClose={close}>
      <DialogTitle>
        Go To
      </DialogTitle>
      <DialogContent>
        <TextField autoFocus required
          inputRef={input} label='path' defaultValue={path}
          style={{ width: 480 }} />
      </DialogContent>
      <DialogActions>
        <Button label='go' onClick={() => {
          const newPath = input.current?.value ?? '';
          if (newPath.length === 0) return onError({ title: 'Error', body: "File name can't be empty" });
          close();
          cd(newPath);
        }} />
        <Button label='close' onClick={close} />
      </DialogActions>
    </Dialog>
  );
}

namespace GoToDialog {
  export type State = { open: boolean, path: string };
}

export default GoToDialog;
