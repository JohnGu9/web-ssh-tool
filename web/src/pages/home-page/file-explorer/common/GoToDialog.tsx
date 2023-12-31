import React from "react";
import { Button, TextField, Dialog } from "rmcw";
import FileExplorer from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";
import { useUuidV4 } from "./UuidV4";

function GoToDialog({ state: { open, path }, close }: { state: GoToDialog.State, close: () => unknown }) {
  const [value, setValue] = React.useState(path);
  const { cd } = React.useContext(FileExplorer.Context);
  const id = useUuidV4();
  const ref = useInputAutoFocusRef(open);
  React.useEffect(() => {
    if (open) {
      setValue(path);
    }
  }, [open, path]);
  return (
    <Dialog
      open={open}
      onScrimClick={close}
      onEscapeKey={close}
      title="Go To"
      actions={<>
        <Button type='submit' label='go' form={id} />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={event => {
          event.preventDefault();
          close();
          cd(value);
        }}>
        <TextField
          required
          ref={ref}
          label='path'
          id='go-to'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 480 }} />
      </form>
    </Dialog>
  );
}

namespace GoToDialog {
  export type State = { open: boolean, path: string };
}

export default GoToDialog;
