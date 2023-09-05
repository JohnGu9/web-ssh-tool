import React from "react";
import { Button, LinearProgress } from "rmcw";

function LostConnection({ reconnect }: { reconnect: () => Promise<unknown> }) {
  const [connecting, setConnecting] = React.useState(false);
  return (
    <div className='full-size column flex-center'
      style={{ position: 'relative' }}>
      <LinearProgress style={{ position: 'absolute', top: 0 }} closed={!connecting} />
      <div style={{ margin: '16px 0' }}>Lost Connection</div>
      <Button buttonStyle="raised" label='Reconnect'
        disabled={connecting}
        onClick={async () => {
          setConnecting(true);
          await reconnect();
          setConnecting(false);
        }} />
    </div>
  );
}

export default LostConnection;
