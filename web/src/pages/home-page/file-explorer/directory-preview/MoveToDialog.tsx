import React from "react";
import { Button, TextField, Dialog, DialogActions } from "rmwc";
import { DialogContent, DialogTitle } from "../../../../components/Dialog";

function MoveToDialog({ state, close }: { state: MoveToDialog.State, close: () => unknown }) {
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
      <DialogTitle>Move To</DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={input} defaultValue={state.path} style={{ width: 480 }} label='path' />
      </DialogContent>
      <DialogActions style={{ paddingLeft: 16, flexDirection: 'row' }}>
        <Button type='submit' icon='drag_handle' label='move' />
        <Button type='button' onClick={close} label='close' />
      </DialogActions>
    </Dialog>
  );
}

namespace MoveToDialog {
  export type State = {
    open: boolean,
    path: string,
    onSubmit: (path: string) => PromiseLike<boolean>,
  };
}

export default MoveToDialog;
