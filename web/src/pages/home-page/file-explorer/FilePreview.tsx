import React from "react";
import path from "path";
import { Button, IconButton } from "rmwc";
import { Server } from "../../../common/Providers";
import { Watch } from "../../../common/Type";

function FilePreview({ state, cd }: { state: Watch.File, cd: (path?: string) => unknown }) {
  const auth = React.useContext(Server.Authentication.Context);
  const { path: filePath, content } = state;
  const back = () => {
    const dirname = path.dirname(state.path);
    if (dirname !== state.path) cd(path.dirname(state.path))
  };
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
        <IconButton icon='arrow_back' onClick={back} />
        <div className='expanded' />
        <Button label='download' onClick={() => auth.download(filePath)} />
      </div>
      <PreviewWindow name={filePath} content={content} />
      <div style={{ height: 16 }} />
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre', width: '100%' }}>{filePath}</div>
      <div style={{ height: 24 }} />
    </div>
  );
}

function PreviewWindow({ name, content }: { name: string, content: string }) {
  const chips = name.split('.').filter(value => value.length > 0);
  if (chips.length > 1) {
    const last = chips[chips.length - 1].toLowerCase();
    switch (last) {
      case 'jpg':
      case 'jpeg':
        return <Center><img src={`data:image/jpeg;base64,${content}`} alt='Loading' /></Center>;
      case 'tif':
      case 'tiff':
        return <Center><img src={`data:image/tiff;base64,${content}`} alt='Loading' /></Center>;
      case 'svg':
        return <Center><img src={`data:image/svg+xml;base64,${content}`} alt='Loading' /></Center>;

      case 'png':
      case 'bmp':
      case 'gif':
      case 'raw':
        return <Center><img src={`data:image/${last};base64,${content}`} alt='Loading' /></Center>;
    }
  }
  return <code style={{ flex: 1, width: '100%', overflow: 'auto', whiteSpace: 'pre' }}>
    {Buffer.from(content, 'base64').toString()}
  </code>;
}

export default FilePreview;

function Center({ children }: { children: React.ReactNode }) {
  return <div className='column'
    style={{ flex: 1, width: '100%', overflow: 'auto', justifyContent: 'center', padding: '0 8px' }}>
    {children}
  </div>;
}
