import React from "react";
import { Button, Dialog, Icon } from "rmcw";
import { useUuidV4 } from "../Common";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import DirectoryPreView from "../DirectoryPreview";

function DeleteDialog({ state, close }: { state: DeleteDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const id = useUuidV4();
  const { setInformation } = React.useContext(DirectoryPreView.Context);

  return (
    <Dialog open={state.open}
      onScrimClick={close}
      onEscapeKey={close}
      title="Delete"
      fullscreen
      actions={<>
        <Button label="delete forever"
          style={{ color: '#b00020' }}
          onClick={async e => {
            const value = await Promise.all(state.objects.map(async ({ type, path }) => {
              if (path !== null && path !== undefined) {
                switch (type) {
                  case FileType.file: {
                    const res = await auth.rest('fs.unlink', [[path]]);
                    if (Rest.isError(res)) return false;
                    return true;
                  }
                  case FileType.symbolicLink:
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
              // @TODO: close related dialog
              setInformation(v => {
                if (state.objects.some((e, index) => e.path === v.stat.path && value[index])) {
                  return { ...v, open: false };
                }
                return v;
              })
              close();

            }
          }} />
        <div className="expanded" />
        <Button type='submit' form={id} leading={<Icon>delete</Icon>} label='trash' />
        <Button type='button' onClick={close} label='close' />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          const value = await Promise.all(state.objects.map(async ({ type, path }) => {
            if (path !== null && path !== undefined) {
              const res = await auth.rest('fs.trash', [[path]]);
              if (Rest.isError(res)) return false;
              return true;
            }
            return false;
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
        Do you sure to delete
        {state.objects.length < 4 ?
          <ul>
            {state.objects.map((v, index) => {
              return <li key={index}>{v.path}</li>
            })}
          </ul> :
          <ul>
            {state.objects.slice(0, 3).map((v, index) => {
              return <li key={index}>{v.path}</li>
            })}
            <li >And {state.objects.length - 3} items more...</li>
          </ul>}
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
