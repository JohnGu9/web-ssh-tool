import React from "react";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { Button, Dialog, Icon } from "rmcw";
import { Rest } from "../../../../common/Type";
import FileExplorer from "../Common";

function FileMoveDialog({ state: { filename, path, target, open }, close, }: { state: FileMoveDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { cd } = React.useContext(FileExplorer.Context);
  const action = <Button onClick={() => cd(target)}>view</Button>;
  return <Dialog
    open={open}
    onScrimClick={close}
    onEscapeKey={close}
    fullscreen
    title="Next"
    actions={<>
      <div style={{ minWidth: 8 }} />
      <Button label="move" leading={<Icon>drag_handle</Icon>}
        onClick={async e => {
          e.preventDefault();
          close();
          const res = await auth.rest('fs.rename', [[path], [target, filename]]);
          if (Rest.isError(res)) showMessage({ content: `Move file [${path}] failed` });
          else showMessage({ content: "Move succeed", action });
        }} />
      <div className='expanded' />
      <Button label="copy" leading={<Icon>file_copy</Icon>}
        onClick={async e => {
          e.preventDefault();
          close();
          const res = await auth.rest('fs.cp', [[path], [target, filename]]);
          if (Rest.isError(res)) showMessage({ content: `Copy file [${path}] failed` });
          else showMessage({ content: "Copy succeed", action });
        }} />
      <Button label="close" onClick={close} />
    </>}>
    [{filename}]{" -> "}[{target}]
  </Dialog>
}

namespace FileMoveDialog {
  export type State = { open: boolean, filename: string, path: string, target: string };
}

export default FileMoveDialog;
