import React from "react";
import { Button, TextField, Dialog, TextArea } from "rmcw";

import { Server } from "../../../../common/Providers";
import Scaffold, { SnackbarQueueMessage } from "../../../../components/Scaffold";
import { Rest } from "../../../../common/Type";
import { delay } from "../../../../common/Tools";
import { useUuidV4 } from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";

export function NewFileDialog({ state, close }: { state: NewFileDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ action: <Button label="close" />, ...message, });
  const id = useUuidV4();

  const ref = useInputAutoFocusRef(state.open);

  return (
    <Dialog open={state.open}
      onScrimClick={close}
      onEscapeKey={close}
      title="New File"
      actions={<>
        <Button type='submit' label='new' form={id} />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          const newName = name;
          if (newName.length === 0) return onError({ content: "Error (File name can't be empty)" });
          const target = [state.path, newName];
          const exists = await auth.rest('fs.exists', [target]);
          if (Rest.isError(exists)) return onError({ content: `${exists.error}` });
          if (exists) return onError({ content: `Error (File [${target}] already exists)` });
          const result = await auth.rest('fs.writeFile', [target, content]);
          if (Rest.isError(result)) return onError({ content: `${result.error}` });
          close();
          await delay(150);
          showMessage({ content: `Created (${target})`, action: <Button label="close" /> });
        }}>
        <TextField name="new-file-path" ref={ref} required value={name} onChange={e => setName(e.target.value)} label='name' style={{ width: 480 }} />
        <div style={{ height: 32 }} />
        <TextArea name="new-file-content" value={content} onChange={e => setContent(e.target.value)} outlined rows={8} label='content' style={{ width: 480 }} />
      </form>
    </Dialog>
  );
}

export namespace NewFileDialog {
  export type State = {
    open: boolean,
    path: string
  };
}

export function NewDirectoryDialog({ state, close }: { state: NewFileDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [value, setValue] = React.useState("");
  const id = useUuidV4();
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ action: <Button label="close" />, ...message, });

  const ref = useInputAutoFocusRef(state.open);

  return (
    <Dialog open={state.open} onScrimClick={close} onEscapeKey={close}
      title="New Directory"
      actions={<>
        <Button type='submit' form={id} label='new' />
        <Button type='button' label='close' onClick={close} />
      </>}>
      <form id={id}
        onSubmit={async event => {
          event.preventDefault();
          const newName = value;
          if (newName.length === 0) return onError({ content: "Error (File name can't be empty)" });
          const target = [state.path, newName];
          const exists = await auth.rest('fs.exists', [target]);
          if (Rest.isError(exists)) return onError({ content: `${exists.error}` });
          if (exists) return onError({ content: `Error (File [${target}] already exists)` });
          const result = await auth.rest('fs.mkdir', [target]);
          if (Rest.isError(result)) return onError({ content: `${result.error}` });
          close();
          await delay(150);
          showMessage({ content: `Created (${target})`, action: <Button label="close" /> });
        }}>
        <TextField name="new-directory-path" ref={ref} required value={value} label='name' style={{ width: 480 }}
          onChange={e => setValue(e.target.value)} />
      </form>
    </Dialog>
  );
}

export namespace NewDirectoryDialog {
  export type State = {
    open: boolean,
    path: string
  };
}
