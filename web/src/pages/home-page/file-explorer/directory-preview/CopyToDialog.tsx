import React from "react";
import { Button, Dialog, ListItem, TextField, } from "rmcw";
import { Server } from "../../../../common/Providers";
import Scaffold from "../../../../components/Scaffold";
import { FileType, Lstat, Rest } from "../../../../common/Type";
import useInputAutoFocusRef from "../../../../components/InputAutoFocusRef";

function CopyToDialog({ state: { open, objects }, close }: { state: CopyToDialog.State, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const id = "copy-confirm";
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const ref = useInputAutoFocusRef(open);
  const [value, setValue] = React.useState("");

  const toCopy = async (newPath: string) => {
    const value = await Promise.all(objects.map(async value => {
      const { type, path, basename } = value;
      if (path === undefined || path === null || basename === undefined || basename === null) {
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
  };

  const toMove = async (newPath: string) => {
    const value = await Promise.all(objects.map(async value => {
      const { type, path, basename } = value;
      if (path === undefined || path === null || basename === undefined || basename === null) {
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
  };

  return (<Dialog
    open={open}
    onScrimClick={close}
    onEscapeKey={close}
    title="Copy"
    actions={<>
      <Button onClick={() => toMove(value)}>move</Button>
      <div className="expanded" />
      <Button type='submit' form={id} >copy</Button>
      <Button onClick={close}>close</Button>
    </>}>
    <form id={id}
      onSubmit={async event => {
        event.preventDefault();
        if (await toCopy(value)) close();
      }}>
      <TextField
        required
        id="copy-target-path"
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ width: 480, display: 'block' }} />
      <ListItem defaultExpanded={false}
        primaryText={`Total ${objects.length} ${objects.length === 1 ? 'item' : 'items'}`}>
        {objects.map((value, index) => {
          return <ListItem key={index} nonInteractive primaryText={value.path} />
        })}
      </ListItem>
    </form>
  </Dialog>);
}

namespace CopyToDialog {
  export type State = {
    open: boolean,
    objects: Lstat[],
  };
}

export default CopyToDialog;
