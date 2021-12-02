import React, { RefObject, CSSProperties } from "react";
import { Button, Checkbox, TextField, LinearProgress, Tooltip } from "rmwc";
import { ConnectConfig } from 'ssh2';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import 'xterm/css/xterm.css';
import './Layout.css'

import { Server, Settings } from "../common/Providers";
import FadeCrossTransition from "./FadeCrossTransition";
import LayoutBuilder from "./LayoutBuilder";
import { SharedAxisTransition } from "./Transitions";
import WebSocketProvider from "./WebSocketProvider";
import { Interactive } from "../common/Type";

function XTerminal({ style, className, onSignIn }: {
  style?: CSSProperties,
  className?: string,
  onSignIn: (ws: WebSocket) => Promise<boolean>,
}) {
  const auth = React.useContext(Server.Authentication.Context);
  return <WebSocketProvider
    url={auth.ssh()}
    interval={500}
    builder={ws => {
      return <FadeCrossTransition id={ws}
        style={style}
        className={className}>
        {ws
          ? <SignIn ws={ws} onSignIn={onSignIn}><Content ws={ws} /></SignIn>
          : <LinearProgress></LinearProgress>}
      </FadeCrossTransition>;
    }} />;
}

export default XTerminal;

function SignIn({ children, ws, onSignIn }: {
  children: React.ReactNode,
  ws: WebSocket,
  onSignIn: (ws: WebSocket) => Promise<boolean>,
}) {
  const auth = React.useContext(Server.Authentication.Context);
  const settings = React.useContext(Settings.Context);
  const [state, setState] = React.useState(false);
  const username = React.useRef<HTMLInputElement>(null);
  const password = React.useRef<HTMLInputElement>(null);
  const submit = async () => {
    const user = username.current?.value;
    const pass = password.current?.value;
    if (settings.sshSave) {
      settings.setSshUserName(user ?? null);
      settings.setSshPassword(pass ?? null);
    }
    const confirm = await onSignIn(ws);
    if (confirm) {
      setState(true);
      const obj: ConnectConfig = {
        username: user?.length !== 0 ? user : undefined,
        password: pass?.length !== 0 ? pass : undefined,
        port: 22,
      };
      const token = await auth.interactive('.token', []);
      if (Interactive.NodeJs.isError(token)) return;
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({
          token: token,
          config: obj
        }));
    }
  };
  return (
    <>
      <SharedAxisTransition className='full-size' id={state}
        type={SharedAxisTransition.Type.fromLeftToRight}>
        {state
          ? children
          : <div className='column'
            onKeyDown={event => { switch (event.key) { case 'Enter': return submit() } }}>
            <div style={{ height: 16 }} />
            <TextField outlined label='用户' required inputRef={username}
              defaultValue={settings.sshUserName ?? undefined}
              autoFocus={settings.sshUserName === null}
              onChange={event => { }}></TextField>
            <div style={{ height: 16 }} />
            <TextField outlined label='密码' type='password' required inputRef={password}
              defaultValue={settings.sshPassword ?? undefined}
              onChange={event => { }}></TextField>
            <div style={{ height: 42 }} />
            <div className='row'>
              <Tooltip content='请不要在非信任计算机或浏览器中勾选此选项'>
                <Checkbox checked={settings.sshSave}
                  onChange={event => {
                    if (settings.sshSave) {
                      settings.setSshUserName(null);
                      settings.setSshPassword(null);
                      settings.setSshSave(false);
                    } else
                      settings.setSshSave(true);
                  }}>
                  记住用户与密码
                </Checkbox>
              </Tooltip>
              <div className='expanded' />
              <Button raised label='登录'
                autoFocus={settings.sshUserName !== null && settings.sshPassword !== null}
                onClick={submit}></Button>
            </div>
          </div>}
      </SharedAxisTransition>
    </>
  );
}

class Content extends React.Component<Content.Props> {
  constructor(props: Content.Props) {
    super(props);
    this._ref = React.createRef();
    this._term = new Terminal();
    this._fit = new FitAddon();
    this._term.loadAddon(this._fit);
  }

  readonly _ref: RefObject<HTMLDivElement>;
  readonly _fit: FitAddon;
  readonly _term: Terminal;
  readonly _onMessage = ({ data }: MessageEvent) => this._term.write(data)

  componentDidMount() {
    const current = this._ref.current!;
    this._term.open(current);
    this._term.focus();
    this._term.onData((data) => this.props.ws.send(data));
    this.props.ws.addEventListener('message', this._onMessage);
    this._fit.fit();
  }

  componentDidUpdate(oldProps: Content.Props) {
    if (oldProps.ws !== this.props.ws) throw new Error();
  }

  componentWillUnmount() {
    this.props.ws.removeEventListener('message', this._onMessage);
    this._term.dispose();
  }

  render() {
    return <LayoutBuilder className='full-size' builder={() => {
      this._fit.fit();
      return <div key={null} ref={this._ref} className='full-size'></div>;
    }} />;
  }
}

namespace Content {
  export type Props = {
    ws: WebSocket,
  };
}
