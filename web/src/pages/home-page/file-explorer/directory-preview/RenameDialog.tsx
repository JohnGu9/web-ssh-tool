import React from "react";
import { Button, TextField, Dialog, Icon } from "rmcw";

import { Server } from "../../../../common/Providers";
import Scaffold, { SnackbarQueueMessage } from "../../../../components/Scaffold";
import { Lstat, Rest } from "../../../../common/Type";
import LongPressButton from "../../../../components/LongPressButton";
import { delay } from "../../../../common/Tools";
import { useUuidV4 } from "../Common";

function RenameDialog({ state: { file, dirname, open }, close }: { state: RenameDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [value, setValue] = React.useState(file.basename ?? "");
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ action: <Button label="close" />, ...message, });
  const id = useUuidV4();
  return (
    <Dialog open={open} onScrimClick={close} onEscapeKey={close}
      title="Rename"
      actions={<>
        <LongPressButton
          label='overwrite'
          onLongPress={async () => {
            const currentPath = file.path;
            const newName = value;
            if (currentPath === undefined || currentPath === null) return onError({ content: "Error (File name isn't supported)" });
            if (newName.length === 0) return onError({ content: "Error (File name can't be empty)" });
            const target = [dirname, newName];
            const result = await auth.rest('fs.rename', [[currentPath], target]);
            if (Rest.isError(result)) return onError({ content: `${result.error}` });
            close();
            await delay(150);
            showMessage({ content: 'Overwritten', action: <Button label="close" /> });
          }} />
        <div className='expanded' />
        <Button type='submit' form={id} leading={<Icon>drive_file_rename_outline</Icon>} label='rename' />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          const currentPath = file.path;
          const newName = value;
          if (currentPath === undefined || currentPath === null) return onError({ content: "Error (File name isn't supported)" });
          if (newName.length === 0) return onError({ content: "Error (File name can't be empty)" });
          const target = [dirname, newName];
          const exists = await auth.rest('fs.exists', [target]);
          if (Rest.isError(exists)) return onError({ content: `${exists.error}` });
          if (exists) return onError({ content: `Error (File [${target}] already exists)` });
          const result = await auth.rest('fs.rename', [[currentPath], target]);
          if (Rest.isError(result)) return onError({ content: `${result.error}` });
          close();
          await delay(150);
          showMessage({ content: 'Renamed', action: <Button label="close" /> });
        }}>
        <TextField autoFocus required value={value} onChange={e => setValue(e.target.value)} style={{ width: 360 }} />
      </form>
    </Dialog>
  );
}

namespace RenameDialog {
  export type State = {
    open: boolean,
    dirname: string,
    file: Lstat,
  };
}

export default RenameDialog;
