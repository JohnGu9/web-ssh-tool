import React from "react";
import { Icon, IconButton, TextField, Tooltip } from "rmcw";
import GoToDialog from "./GoToDialog";

export function NavigatorBar({ path }: { path: string }) {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: path });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      {/* <div draggable
          onDragStart={event => {
            event.dataTransfer.setData('text', path);
            event.dataTransfer.dropEffect = 'copy';
          }}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%', padding: '0 8px 0 24px' }}
          onClick={() => setDialog({ open: true, path: path })}>{path}</div> */}
      <div style={{
        padding: '8px 8px 0px 8px',
        display: 'flex',
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TextField label="Path" outlined readOnly
          value={path}
          style={{ flex: 1 }} />
        <div style={{ width: 8 }} />
        <Tooltip label="Go To">
          <IconButton
            onClick={() => {
              setDialog({ open: true, path: path })
            }}>
            <Icon>navigate_next</Icon>
          </IconButton>
        </Tooltip>
      </div>
      <GoToDialog state={dialog} close={close} />
    </>
  );
}
