import React from "react";
import { Button, Dialog, Icon, IconButton, LinearProgress } from "rmcw";
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
          setLoading(false);
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
        <IconButton
          onClick={() => setRefresh(v => v + 1)}><Icon>refresh</Icon></IconButton>
        <div className="expanded" />
        <Button onClick={close}>close</Button>
      </>}>
      <LinearProgress closed={!loading} />
      <iframe id="preview-iframe" key={refresh} title="Preview" src={url?.toString()} height={300} width={512} style={{ resize: 'both' }} />
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


