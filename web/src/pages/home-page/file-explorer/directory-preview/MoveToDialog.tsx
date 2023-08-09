import React from "react";
import { Button, TextField, Dialog, Icon } from "rmcw";
import { useUuidV4 } from "../Common";

function MoveToDialog({ state, close }: { state: MoveToDialog.State, close: () => unknown }) {
  const [value, setValue] = React.useState(state.path);
  const id = useUuidV4();
  return (
    <Dialog open={state.open} onScrimClick={close} onEscapeKey={close}
      title="Move To"
      actions={<>
        <Button type='submit' form={id} leading={<Icon>drag_handle</Icon>} label='move' />
        <Button type='button' onClick={close} label='close' />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          if (await state.onSubmit(value)) close();
        }}>
        <TextField autoFocus required value={value} onChange={e => setValue(e.target.value)} style={{ width: 480 }} label='path' />
      </form>
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
