import React from "react";
import { Button, TextField, Dialog, Icon } from "rmcw";
import { useUuidV4 } from "../Common";

function CopyToDialog({ state, close }: { state: CopyToDialog.State, close: () => unknown }) {
  const [value, setValue] = React.useState("");
  const id = useUuidV4();
  return (
    <Dialog open={state.open} onScrimClick={close} onEscapeKey={close}
      title="Copy To"
      actions={<>
        <Button type='submit' form={id} leading={<Icon>file_copy</Icon>} label='copy' />
        <Button type='button' onClick={close} label='close' />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          if (await state.onSubmit(value)) close();
        }}>
        <TextField autoFocus required value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 480 }} label='path' />
      </form>
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
