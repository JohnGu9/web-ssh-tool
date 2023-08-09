import React from "react";
import { Button, TextField, Dialog } from "rmcw";

import Scaffold, { SnackbarQueueMessage } from "../../../../components/Scaffold";
import FileExplorer, { useUuidV4 } from "../Common";

function GoToDialog({ state: { open, path }, close }: { state: GoToDialog.State, close: () => unknown }) {
  const [value, setValue] = React.useState(path);
  const { cd } = React.useContext(FileExplorer.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ action: <Button label="close" />, ...message, });
  const id = useUuidV4();
  React.useEffect(() => {
    setValue(path);
  }, [path]);
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
          const newPath = value;
          if (newPath.length === 0) return onError({ content: "File name can't be empty" });
          close();
          cd(newPath);
        }}>
        <TextField autoFocus required
          label='path'
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
