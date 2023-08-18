import React from "react";
import { Icon } from "rmcw";
import TextFieldConfirmDialog from "./TextFieldConfirmDialog";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";

function MoveToDialog({ state, close }: { state: MoveToDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);

  return (<TextFieldConfirmDialog
    open={state.open}
    close={close}
    onSubmit={async (newPath) => {
      const value = await Promise.all(state.objects.map(async value => {
        const { type, path, basename } = value;
        if (path === undefined || path === null) {
          return false;
        }
        switch (type) {
          case FileType.file:
          case FileType.directory: {
            const result = await auth.rest('fs.rename', [[path], [newPath, basename]]);
            if (Rest.isError(result)) return false;
            return true;
          }
        }
        return false;
      }));
      if (value.every(v => v === false)) {
        showMessage({ content: 'Move failed' });
        return false;
      } else {
        if (value.some(value => value === false)) {
          showMessage({ content: 'Some objects move failed' });
          return true;
        } else {
          showMessage({ content: 'Move succeed' });
          return true;
        }
      }

    }}
    initialText={state.initialPath}
    title="Move To"
    submitButton={{
      label: 'move',
      leading: <Icon>drag_handle</Icon>,
    }}
    textField={{
      label: 'path',
    }} />);
}

namespace MoveToDialog {
  export type State = {
    open: boolean,
    initialPath: string,
    objects: Lstat[],
  };
}

export default MoveToDialog;
