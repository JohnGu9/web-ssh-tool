import React from "react";
import { Button, TextField, Dialog, TextArea } from "rmcw";

import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { Rest } from "../../../../common/Type";
import { useUuidV4 } from "../Common";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";

export function NewFileDialog({ state, close }: { state: NewFileDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = showMessage;
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
          if (name.length === 0) return onError({ content: "Error (File name can't be empty)" });
          const target = [state.path, name];
          const result = await auth.rest('fs.writeFile', [target, content]);
          if (Rest.isError(result)) return onError({ content: `${result.error}` });
          close();
          showMessage({ content: `Created (${target})` });
        }}>
        <TextField id="new-file-path" ref={ref} required value={name} onChange={e => setName(e.target.value)} label='name' style={{ width: 480 }} />
        <div style={{ height: 32 }} />
        <TextArea id="new-file-content" value={content} onChange={e => setContent(e.target.value)} outlined rows={8} label='content' style={{ width: 480 }} />
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
          if (newName.length === 0) return showMessage({ content: "Error (File name can't be empty)" });
          const target = [state.path, newName];
          const result = await auth.rest('fs.mkdir', [target]);
          if (Rest.isError(result)) return showMessage({ content: `${result.error}` });
          close();
          showMessage({ content: `Created (${target})` });
        }}>
        <TextField id="new-directory-path" ref={ref} required value={value} label='name' style={{ width: 480 }}
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
