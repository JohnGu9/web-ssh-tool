import React from "react";
import { Button, TextField, Dialog, Icon } from "rmcw";
import { useUuidV4 } from "../Common";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { FileType, Lstat, Rest } from "../../../../common/Type";

function DeleteDialog({ state, close }: { state: DeleteDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const id = useUuidV4();
  return (
    <Dialog open={state.open} onScrimClick={close} onEscapeKey={close}
      title="Delete"
      actions={<>
        <Button type='submit' form={id} leading={<Icon>delete</Icon>} label='delete' />
        <Button type='button' onClick={close} label='close' />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          for (const { type, path } of state.objects) {
            if (type !== null && type !== undefined &&
              path !== null && path !== undefined) {
              switch (type) {
                case FileType.file:
                case FileType.symbolicLink:

                case FileType.directory:
              }
            }

          }
          const value = await Promise.all(state.objects.map(async ({ type, path }) => {
            if (path !== null && path !== undefined) {
              switch (type) {
                case FileType.file:
                case FileType.symbolicLink: {
                  const res = await auth.rest('fs.unlink', [[path]]);
                  if (Rest.isError(res)) return false;
                  return true;
                }
                case FileType.directory: {
                  const res = await auth.rest('fs.rm', [[path]]);
                  if (Rest.isError(res)) return false;
                  return true;
                }

              }
            } return false;
          }));
          if (value.every(v => v === false)) {
            showMessage({ content: 'Delete failed' });
          } else {
            if (value.some(v => v === false)) {
              showMessage({ content: 'Some objects delete failed' });
            } else {
              showMessage({ content: 'Delete succeed' });
            }
            close();
          }

        }}>
        {state.objects.length === 1 ?
          `Do you sure to delete [${state.objects[0].path}]?` :
          `Do you sure to delete [${state.objects.length}] objects?`}
      </form>
    </Dialog>
  );
}

namespace DeleteDialog {
  export type State = {
    open: boolean,
    objects: Lstat[],
  };
}

export default DeleteDialog;
