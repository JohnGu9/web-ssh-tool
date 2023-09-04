import { Button, Dialog, LinearProgress } from "rmcw";
import { Server } from "../../../../common/Providers";
import React from "react";
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';
import Scaffold from "../../../../components/Scaffold";
import { DECODE_OPTION } from "../../../../common/Type";

function RequestPreviewDialog({ state, close }: {
  close: () => unknown,
  state: RequestPreviewDialog.State
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const [previewState, setPreviewState] = React.useState<{ open: boolean, path: string | null }>({ open: false, path: null });
  return (
    <>
      <Dialog
        open={state.open}
        onScrimClick={close}
        onEscapeKey={close}
        title="Attention"
        actions={<>
          <div style={{ minWidth: 8 }} />
          <Button onClick={async (e) => {
            e.preventDefault();
            close();
            setPreviewState({ open: true, path: state.path });
          }}>force view in text</Button>
          <div className="expanded" />
          <Button onClick={(e) => {
            e.preventDefault();
            close();
            auth.preview(state.path);
          }}>preview</Button>
          <Button onClick={close}>close</Button>
        </>}>
        This file maybe an unsupported file for preview.
        <div style={{ opacity: 0.7 }}>
          Try to preview unsupported files that may just trigger download action (action depending on browser).
        </div>
      </Dialog>
      <PreviewWindow {...previewState}
        close={() => setPreviewState(v => { return { ...v, open: false } })} />
    </>);
}

namespace RequestPreviewDialog {
  export type State = {
    open: boolean,
    path: string,
  };
}

export default RequestPreviewDialog;

function PreviewWindow({ open, path, close }: { open: boolean, path: string | null, close: () => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const [refresh, setRefresh] = React.useState(0);
  const [decode, setDecode] = React.useState('utf-8');
  const [loading, setLoading] = React.useState<boolean | number>(false);
  const [data, setData] = React.useState<ArrayBuffer | null>(null);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const text = React.useMemo(() => {
    if (data === null) return null;
    const buffer = Buffer.from(data);
    return iconv.decode(buffer, decode);
  }, [data, decode]);
  React.useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let abort = false;
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = event => {
      if (event.total === 0) {
      } else if (event.lengthComputable) {
        setLoading(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      const arr = xhr.response as ArrayBuffer;
      setData(arr);
      setLoading(false);
    };
    xhr.onerror = () => {
      // @TODO: error handle
      setLoading(false);
    }
    auth.previewUrl(path)
      .then(v => {
        if (abort) return;
        xhr.open('GET', v, true);
        xhr.send();
      })
      .catch(() => {
        // @TODO: error handle
        setLoading(false);
      });

    return () => {
      abort = true;
      xhr.abort();
    };
  }, [auth, path, refresh]);
  return <Dialog open={open}
    onScrimClick={close}
    onEscapeKey={close}
    fullscreen
    title="Preview"
    actions={<>
      <div style={{ minWidth: 16 }} />
      <select name="text-decode"
        value={decode}
        onChange={e => {
          if (iconv.encodingExists(e.target.value)) {
            setDecode(e.target.value);
          } else {
            e.preventDefault();
            showMessage({ content: `Decoder[${e.target.value}] not available` });
          }
        }}>
        {DECODE_OPTION.map(v => {
          return <option key={v} value={v}>{v}</option>
        })}
      </select>
      <div className="expanded" />
      <Button disabled={loading !== false}
        onClick={() => setRefresh(v => v + 1)}>refresh</Button>
      <Button onClick={close}>close</Button>
    </>}>
    <LinearProgress closed={loading === false} progress={typeof loading === 'number' ? loading : undefined}
      style={{ position: 'sticky', top: 0 }} />
    <code style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 200ms' }}>{text}</code>
  </Dialog>
}
