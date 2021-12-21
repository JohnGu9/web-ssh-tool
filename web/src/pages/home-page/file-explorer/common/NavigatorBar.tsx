import React from "react";
import { Tooltip } from "rmwc";
import GoToDialog from "./GoToDialog";

export function NavigatorBar({ path }: { path: string }) {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: path });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      <Tooltip content={path}>
        <div draggable
          onDragStart={event => {
            event.dataTransfer.setData('text', path);
            event.dataTransfer.dropEffect = 'copy';
          }}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%', padding: '0 8px' }}
          onClick={() => setDialog({ open: true, path: path })}>{path}</div>
      </Tooltip>
      <GoToDialog state={dialog} close={close} />
    </>
  );
}