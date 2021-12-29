import React from "react";
import path from 'path-browserify';
import { Button, SnackbarQueueMessage, TextField, Dialog, DialogActions } from "rmwc";

import { DialogContent, DialogTitle } from "../../../../components/Dialog";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../Scaffold";
import { Rest } from "../../../../common/Type";
import { delay } from "../../../../common/Tools";

export function NewFileDialog({ state, close }: { state: NewFileDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const nameInput = React.useRef<HTMLInputElement>(null);
  const contentInput = React.useRef<HTMLInputElement>(null);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ icon: 'error', actions: [{ label: 'close' }], ...message, });
  return (
    <Dialog tag='form' open={state.open} onClose={close}
      onSubmit={async event => {
        event.preventDefault();
        const newName = nameInput.current?.value ?? '';
        if (newName.length === 0) return onError({ title: 'Error', body: "File name can't be empty" });
        const target = path.join(state.path, newName);
        const exists = await auth.rest('fs.exists', [target]);
        if (Rest.isError(exists)) return onError({ title: exists.error?.name, body: exists.error?.message });
        if (exists) return onError({ title: 'Error', body: `File [${target}] already exists. ` });
        const result = await auth.rest('fs.writeFile', [target, contentInput.current?.value ?? '']);
        if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
        close();
        await delay(150);
        showMessage({ icon: 'checked', title: 'Created', body: target, actions: [{ label: 'close' }] });
      }}>
      <DialogTitle>
        New File
      </DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={nameInput} label='name' style={{ width: 480 }} />
        <div style={{ height: 32 }} />
        <TextField autoFocus inputRef={contentInput} textarea outlined fullwidth rows={8} label='content' style={{ width: 480 }} />
      </DialogContent>
      <DialogActions>
        <Button type='submit' label='new' />
        <Button type='button' label='close' onClick={close} />
      </DialogActions>
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
  const nameInput = React.useRef<HTMLInputElement>(null);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const onError = (message: SnackbarQueueMessage) =>
    showMessage({ icon: 'error', actions: [{ label: 'close' }], ...message, });
  return (
    <Dialog tag='form' open={state.open} onClose={close}
      onSubmit={async event => {
        event.preventDefault();
        const newName = nameInput.current?.value ?? '';
        if (newName.length === 0) return onError({ title: 'Error', body: "File name can't be empty" });
        const target = path.join(state.path, newName);
        const exists = await auth.rest('fs.exists', [target]);
        if (Rest.isError(exists)) return onError({ title: exists.error?.name, body: exists.error?.message });
        if (exists) return onError({ title: 'Error', body: `File [${target}] already exists. ` });
        const result = await auth.rest('fs.mkdir', [target]);
        if (Rest.isError(result)) return onError({ title: result.error?.name, body: result.error?.message });
        close();
        await delay(150);
        showMessage({ icon: 'checked', title: 'Created', body: target, actions: [{ label: 'close' }] });
      }}>
      <DialogTitle>
        New Directory
      </DialogTitle>
      <DialogContent>
        <TextField autoFocus required inputRef={nameInput} label='name' />
      </DialogContent>
      <DialogActions>
        <Button type='submit' label='new' />
        <Button type='button' label='close' onClick={close} />
      </DialogActions>
    </Dialog>
  );
}

export namespace NewDirectoryDialog {
  export type State = {
    open: boolean,
    path: string
  };
}
