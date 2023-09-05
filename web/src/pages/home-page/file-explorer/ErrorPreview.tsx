import React from "react";
import { Button, Icon, Typography } from "rmcw";
import FileExplorer from "./Common";
import GoToDialog from "./common/GoToDialog";

function ErrorPreview({ state: { error, path } }: { state: { error: any, path?: string | null } }) {
  const { cd, cdToParent } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column flex-center'>
      <Typography.Subtitle1 className="row" style={{ margin: '8px 16px' }}><Icon style={{ marginRight: 8 }}>error</Icon>Error Occur</Typography.Subtitle1>
      <Typography.Body1 style={{ margin: '0 16px', opacity: 0.7 }}>{error}</Typography.Body1>
      <div style={{ height: 16 }} />
      <Button buttonStyle="raised" label='Return to parent' onClick={cdToParent} />
      <div style={{ height: 16 }} />
      <Button trailing={<Icon>home</Icon>} label='home' onClick={() => cd(null)} />
      <GoToButton path={path} />
    </div>
  );
}

export default ErrorPreview;

export function UnknownErrorPreview() {
  const { cd, cdToParent } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column flex-center'>
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
      <Button label='go to' trailing={<Icon>reply</Icon>} onClick={() => setDialog({ open: true, path: path ?? '' })} />
      <GoToDialog state={dialog} close={close} />
    </>
  );
}
