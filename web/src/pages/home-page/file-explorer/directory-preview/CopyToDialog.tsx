import React from "react";
import { Button, TextField } from "rmwc";
import { Dialog, DialogActions } from "@rmwc/dialog";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";

function CopyToDialog({ state, close }: { state: CopyToDialog.State, close: () => unknown }) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <Dialog tag='form' open={state.open} onClose={close}
      onSubmit={async event => {
        event.preventDefault();
        const { current } = input;
        if (current && current.value) {
          if (await state.onSubmit(current.value)) close();
        }
      }}>
      <DialogTitle>Copy To</DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={input} defaultValue={state.path} style={{ width: 480 }} label='path' />
      </DialogContent>
      <DialogActions style={{ paddingLeft: 16, flexDirection: 'row' }}>
        <Button type='submit' icon='file_copy' label='copy' />
        <Button type='button' onClick={close} label='close' />
      </DialogActions>
    </Dialog>
  );
}

namespace CopyToDialog {
  export type State = {
    open: boolean,
    path: string,
    onSubmit: (path: string) => PromiseLike<boolean>,
  };
}

export default CopyToDialog;
