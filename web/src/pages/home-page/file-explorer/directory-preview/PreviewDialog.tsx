import React from "react";
import { Button, CircularProgress, Dialog, Icon, IconButton } from "rmcw";
import { Lstat } from "../../../../common/Type";
import { Server } from "../../../../common/Providers";

function PreviewDialog({ state, close }: {
  close: () => unknown,
  state: PreviewDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const [refresh, setRefresh] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [url, setUrl] = React.useState<URL | null>(null);
  const path = state.lstat?.path;
  React.useEffect(() => {
    if (typeof path === 'string') {
      let abort = false;
      setLoading(true);
      auth.previewUrl(path)
        .then(v => {
          if (abort) return;
          setUrl(v);
        });
      return () => {
        abort = true;
        setLoading(false);
      }
    } else {
      setUrl(null);
    }
  }, [auth, path]);
  return (
    <Dialog
      open={state.open}
      onScrimClick={close}
      onEscapeKey={close}
      fullscreen
      title="Preview"
      actions={<>
        <IconButton
          disabled={url === null}
          onClick={() => {
            if (url) window.open(url);
          }}><Icon>open_in_new</Icon></IconButton>
        {loading ?
          <div className="column flex-center" style={{ height: 48, width: 48 }}>
            <CircularProgress sizing="Small" />
          </div> :
          <IconButton
            onClick={() => {
              setLoading(true);
              setRefresh(v => v + 1)
            }}><Icon>refresh</Icon></IconButton>}
        <div className="expanded" />
        <Button onClick={close}>close</Button>
      </>}>
      <div className="column flex-center">
        <iframe id="preview-iframe" title="Preview"
          key={refresh}
          src={url?.toString()}
          height={300}
          width={300 / window.innerHeight * window.innerWidth}
          style={{ resize: 'both', opacity: loading ? 0.5 : 1 }}
          onLoad={() => setLoading(false)} />
      </div>
    </Dialog>
  );
}

namespace PreviewDialog {
  export type State = {
    open: boolean,
    lstat: Lstat | null,
  };
}

export default PreviewDialog;


