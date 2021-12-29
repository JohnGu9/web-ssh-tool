import React from "react";
import path from "path-browserify";
import { IconButton, Tooltip } from "rmwc";
import { Server, ThemeContext } from "../../../common/Providers";
import { Watch } from "../../../common/Type";
import FileExplorer, { NavigatorBar } from "./Common";
import { FixedSizeList } from "../../../components/AdaptedWindow";

function FilePreview({ state }: { state: Watch.File }) {
  const { cd } = React.useContext(FileExplorer.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { path: filePath, content } = state;
  const back = () => {
    const dirname = path.dirname(filePath);
    if (dirname !== filePath) cd(path.dirname(filePath));
  };
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
        <IconButton icon='arrow_back' style={{ color: theme.primary }} onClick={back} />
        <div className='expanded' />
        <Tooltip content='open in full'>
          <IconButton icon='open_in_full' />
        </Tooltip>
        <Tooltip content='download'>
          <IconButton icon='download' onClick={() => auth.download(filePath)} />
        </Tooltip>
      </div>
      <PreviewWindow name={filePath} content={content} />
      <div style={{ height: 16 }} />
      <NavigatorBar path={filePath} />
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
  return <PlainTextPreview base64Content={content} style={{ flex: 1, width: '100%' }} />
}

export default FilePreview;

function Center({ children }: { children: React.ReactNode }) {
  return <div className='column'
    style={{ flex: 1, width: '100%', overflow: 'auto', justifyContent: 'center', padding: '0 8px' }}>
    {children}
  </div>;
}

function PlainTextPreview({ base64Content: content, style }: { base64Content: string, style?: React.CSSProperties }) {
  const lines = React.useMemo(() => {
    const text = Buffer.from(content, 'base64').toString();
    return text.split('\n');
  }, [content]);
  const builder = React.useCallback(({ style, index }: { style: React.CSSProperties, index: number }) => {
    return <code style={style}>{lines[index]}</code>
  }, [lines]);
  return (
    <FixedSizeList itemCount={lines.length} itemSize={16} style={style}>
      {builder}
    </FixedSizeList>
  );
}
