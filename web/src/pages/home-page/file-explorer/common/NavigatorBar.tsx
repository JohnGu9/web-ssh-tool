import React from "react";
import { Icon, IconButton, TextField, Tooltip } from "rmcw";
import GoToDialog from "./GoToDialog";

export function NavigatorBar({ path }: { path: string }) {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: path });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      <div className="row"
        style={{ padding: '8px 8px 0px 8px', width: '100%' }}>
        <TextField
          outlined
          readOnly
          label="Path"
          id="navigation"
          autoComplete='off'
          value={path}
          style={{ flex: 1 }}
          onFocus={e => e.target.select()} />
        <div style={{ width: 8 }} />
        <Tooltip label="Go To">
          <IconButton
            onClick={() => {
              setDialog({ open: true, path: path });
            }}>
            <Icon>navigate_next</Icon>
          </IconButton>
        </Tooltip>
      </div>
      <GoToDialog state={dialog} close={close} />
    </>
  );
}
