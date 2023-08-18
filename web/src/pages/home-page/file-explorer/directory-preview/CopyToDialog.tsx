import React from "react";
import { Icon } from "rmcw";
import TextFieldConfirmDialog from "./TextFieldConfirmDialog";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { FileType, Lstat, Rest } from "../../../../common/Type";

function CopyToDialog({ state, close }: { state: CopyToDialog.State, close: () => unknown }) {
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
            const result = await auth.rest('fs.cp', [[path], [newPath, basename]]);
            if (Rest.isError(result)) return false;
            return true;
          }
        }
        return false;
      }));
      if (value.every(v => v === false)) {
        showMessage({ content: 'Copy failed' });
        return false;
      } else {
        if (value.some(value => value === false)) {
          showMessage({ content: 'Some objects copy failed' });
          return true;
        } else {
          showMessage({ content: 'Copy succeed' });
          return true;
        }
      }

    }}
    initialText=""
    title="Copy To"
    submitButton={{
      label: 'copy',
      leading: <Icon>file_copy</Icon>,
    }}
    textField={{
      label: 'path',
    }} />);
}

namespace CopyToDialog {
  export type State = {
    open: boolean,
    objects: Lstat[],
  };
}

export default CopyToDialog;
