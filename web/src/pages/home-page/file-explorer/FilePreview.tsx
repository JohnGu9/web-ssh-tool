import React from "react";
import { Button, Icon, IconButton, Tooltip } from "rmcw";
import { Server, ThemeContext } from "../../../common/Providers";
import { Watch } from "../../../common/Type";
import FileExplorer, { NavigatorBar } from "./Common";
import { FixedSizeList } from "../../../components/AdaptedWindow";
import Scaffold from "../../../components/Scaffold";
import DirectoryPreView from "./DirectoryPreview";

function FilePreview({ state }: { state: Watch.File }) {
  const { setPreview } = React.useContext(DirectoryPreView.Context);
  const { cdToParent } = React.useContext(FileExplorer.Context);
  const auth = React.useContext(Server.Authentication.Context);
  const { themeData: theme } = React.useContext(ThemeContext);
  const { showMessage } = React.useContext(Scaffold.Snackbar.Context);
  const { path: filePath } = state;
  return (
    <div className='full-size column flex-center'>
      <div className='row' style={{ height: 56, padding: '0 8px 0 0' }}>
        <IconButton style={{ color: theme.primary }} onClick={cdToParent} >
          <Icon>arrow_back</Icon>
        </IconButton>
        <div className='expanded' />
        <Tooltip label='download'>
          <IconButton
            disabled={filePath === undefined || filePath === null}
            onClick={filePath === undefined || filePath === null
              ? undefined
              : () => auth.download(filePath).catch(e => showMessage({ content: `Download failed: ${e}` }))} >
            <Icon>download</Icon>
          </IconButton>
        </Tooltip>
      </div>
      <Center>
        <Button buttonStyle="raised"
          onClick={() => {
            setPreview({ open: true, lstat: state });
          }}>Preview</Button>
      </Center>
      <div style={{ height: 16 }} />
      {filePath === undefined || filePath === null ? <></> : <NavigatorBar path={filePath} />}
    </div>
  );
}

export default FilePreview;

function PreviewWindow({ name, content }: { name: string, content: string }) {
  const chips = name.split('.').filter(value => value.length > 0);
  if (chips.length > 1) {
    const last = chips[chips.length - 1].toLowerCase();
    switch (last) {
      case 'jpg':
      case 'jpeg':
        return <Center><img src={`data:image/jpeg;base64,${content}`} alt='File Preview' /></Center>;
      case 'tif':
      case 'tiff':
        return <Center><img src={`data:image/tiff;base64,${content}`} alt='File Preview' /></Center>;
      case 'svg':
        return <Center><img src={`data:image/svg+xml;base64,${content}`} alt='File Preview' /></Center>;
      case 'png':
      case 'bmp':
      case 'gif':
      case 'raw':
        return <Center><img src={`data:image/${last};base64,${content}`} alt='File Preview' /></Center>;
    }
  }
  return <PlainTextPreview base64Content={content} style={{ flex: 1, width: '100%' }} />
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className='column flex-center expanded'
    style={{ width: '100%', overflow: 'auto', padding: '0 8px' }}>
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
