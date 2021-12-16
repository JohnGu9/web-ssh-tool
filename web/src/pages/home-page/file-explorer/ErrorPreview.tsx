import React from "react";
import { Button } from "rmwc";
import FileExplorer from "./Common";

function ErrorPreview({ state: { error } }: { state: { error: any } }) {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Error Occur ({error.name ?? error.code})</div>
      <Button raised label='Return to home' onClick={() => cd()} />
    </div>
  );
}

export default ErrorPreview;

export function UnknownErrorPreview() {
  const { cd } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Unknown State (Server Error)</div>
      <Button raised label='Return to home' onClick={() => cd()} />
    </div>
  );
}
