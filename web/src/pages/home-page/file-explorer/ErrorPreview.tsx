import React from "react";
import { Button, Icon } from "rmcw";
import FileExplorer from "./Common";
import GoToDialog from "./common/GoToDialog";

function ErrorPreview({ state: { error, path } }: { state: { error: any, path: string | null | undefined } }) {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Error Occur ({error.name ?? error.code})</div>
      <div style={{ height: 16 }} />
      <Button buttonStyle="raised" label='Return to home' onClick={() => cd(null)} />
      <div style={{ height: 16 }} />
      <GoToButton path={path} />
    </div>
  );
}

export default ErrorPreview;

export function UnknownErrorPreview() {
  const { cd, cdToParent } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Unknown State (Server Error)</div>
      <div style={{ height: 16 }} />
      <Button buttonStyle="raised" label='Return to parent directory' onClick={cdToParent} />
      <div style={{ height: 16 }} />
      <Button label='Return to home' onClick={() => cd(null)} />
      <div style={{ height: 16 }} />
      <GoToButton path={undefined} />
    </div>
  );
}


function GoToButton({ path }: { path: string | null | undefined }) {
  const [dialog, setDialog] = React.useState<GoToDialog.State>({ open: false, path: path ?? '' });
  const close = () => setDialog({ ...dialog, open: false });
  return (
    <>
      <Button label='go to' onClick={() => setDialog({ open: true, path: path ?? '' })} ><Icon>reply</Icon></Button>
      <GoToDialog state={dialog} close={close} />
    </>
  );
}
