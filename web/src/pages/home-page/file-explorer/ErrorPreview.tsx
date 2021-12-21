import React from "react";
import { Button } from "rmwc";
import FileExplorer from "./Common";
import GoToDialog from "./common/GoToDialog";

function ErrorPreview({ state: { error } }: { state: { error: any } }) {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Error Occur ({error.name ?? error.code})</div>
      <div style={{ height: 16 }} />
      <Button raised label='Return to home' onClick={() => cd()} />
      <div style={{ height: 16 }} />
      <GoToButton />
    </div>
  );
}

export default ErrorPreview;

export function UnknownErrorPreview() {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Unknown State (Server Error)</div>
      <div style={{ height: 16 }} />
      <Button raised label='Return to home' onClick={() => cd()} />
      <div style={{ height: 16 }} />
      <GoToButton />
    </div>
  );
}


function GoToButton() {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: '' });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      <Button label='go to' icon='reply' onClick={() => setDialog({ open: true, path: '' })} />
      <GoToDialog state={dialog} close={close} />
    </>
  );
}