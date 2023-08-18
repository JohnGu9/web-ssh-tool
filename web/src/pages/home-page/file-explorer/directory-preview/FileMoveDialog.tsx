import React from "react";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { Button, Dialog, Icon } from "rmcw";
import { Rest } from "../../../../common/Type";

function FileMoveDialog({ open, close, filename, path, target }: FileMoveDialog.State & { close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);

  return <Dialog
    open={open}
    onScrimClick={close}
    onEscapeKey={close}
    title="Next"
    actions={<>
      <div style={{ minWidth: 8 }} />
      <Button label="copy" leading={<Icon>file_copy</Icon>}
        onClick={async e => {
          e.preventDefault();
          close();
          const res = await auth.rest('fs.cp', [[path], [target, filename]]);
          if (Rest.isError(res)) showMessage({ content: `Copy file [${path}] failed` });
          else showMessage({ content: "Copy succeed" });
        }} />
      <Button label="move" leading={<Icon>drag_handle</Icon>}
        onClick={async e => {
          e.preventDefault();
          close();
          const res = await auth.rest('fs.rename', [[path], [target, filename]]);
          if (Rest.isError(res)) showMessage({ content: `Move file [${path}] failed` });
          else showMessage({ content: "Move succeed" });
        }} />
      <div style={{ flex: 1 }} />
      <Button label="close" onClick={close} />
    </>}>
    [{filename}]{" -> "}[{target}]
  </Dialog>
}

namespace FileMoveDialog {
  export type State = { open: boolean, filename: string, path: string, target: string };
}

export default FileMoveDialog;
