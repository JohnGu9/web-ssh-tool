import React from "react";
import { Button, Icon, IconButton, Typography } from "rmcw";
import FileExplorer, { NavigatorBar } from "./Common";
import { ThemeContext } from "../../../common/Providers";

function ErrorPreview({ state: { error, path } }: { state: { error: unknown, path?: string | null } }) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const { cd, cdToParent, setGoToDialog } = React.useContext(FileExplorer.Context);
  return (
    <div className='full-size column flex-center'>
      <div className="row" style={{ height: 56, padding: '0 8px 0 0' }}>
        <div style={{ width: 8 }} />
        <IconButton style={{ color: theme.primary }}
          onClick={cdToParent}>
          <Icon>arrow_back</Icon>
        </IconButton>
        <div className="expanded" />
        <Button style={{ alignSelf: 'end' }} trailing={<Icon>home</Icon>} label='home' onClick={() => cd(null)} />
        {path === undefined || path === null ?
          <Button style={{ alignSelf: 'end' }} label='go to' trailing={<Icon>reply</Icon>} onClick={() => setGoToDialog({ open: true, path: path ?? '' })} /> :
          <></>
        }
      </div>
      <div className="expanded" />
      <Typography.Subtitle1 className="row flex-center" style={{ padding: '0px 16px' }}><Icon style={{ marginRight: 8 }}>error</Icon>Error Occur</Typography.Subtitle1>
      <Typography.Body1 style={{ margin: '0 16px', opacity: 0.7 }}>{error as React.ReactNode}</Typography.Body1>
      <div style={{ height: 64 }} />
      <div className="expanded" />
      {path === undefined || path === null ?
        <></> : // @TODO: new navigator bar
        <NavigatorBar path={path} />}
    </div>
  );
}

export default ErrorPreview;
