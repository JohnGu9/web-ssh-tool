import '../components/Layout.css';
import React from "react";
import path from 'path';

import { Card } from "@rmwc/card";
import { TextField } from '@rmwc/textfield';
import { Checkbox } from '@rmwc/checkbox';
import { Typography } from '@rmwc/typography';
import { LinearProgress } from '@rmwc/linear-progress';
import { Button } from '@rmwc/button';

import { SharedAxisTransition } from '../components/Transitions';
import { LocaleContext, LocaleContextType, Server, Settings } from '../common/Providers';
import { Rest } from '../common/Type';

function SignInPage({ children }: { children: React.ReactNode }) {
  const settings = React.useContext(Settings.Context);
  const locale = React.useContext(LocaleContext);
  const server = React.useContext(Server.Context);
  return <Content server={server} settings={settings} locale={locale}>{children}</Content>;
}

export default SignInPage;

class Content extends React.Component<Content.Props, Content.State> {
  constructor(props: Content.Props) {
    super(props);
    this.state = { loading: false };
    this._usernameRef = React.createRef();
    this._passwordRef = React.createRef();
  }
  _usernameRef: React.RefObject<HTMLInputElement>;
  _passwordRef: React.RefObject<HTMLInputElement>;

  async _submit() {
    if (this.state.auth) return; // already sign in
    const usernameRef = this._usernameRef.current;
    const passwordRef = this._passwordRef.current;
    if (usernameRef && passwordRef) {
      const { server, settings } = this.props;
      this.setState({ loading: true });
      const username = usernameRef.value;
      const password = passwordRef.value;
      const result = await server.signIn({ username, password });
      if (Rest.isError(result)) {
        console.dir(result.error);
        this.setState({ loading: false });
      } else {
        settings.setSshUserName(username);
        settings.setSshPassword(password);
        this.setState({ auth: new Auth({ server }), loading: false });
      }
    }
  }

  componentDidMount() {
    const { settings } = this.props;
    if (settings.keepSignIn) this._submit();
  }

  render() {
    const { settings, locale: { locale } } = this.props;
    const { auth, loading } = this.state;
    return (
      <>
        <LinearProgress closed={!loading} style={{ position: 'absolute' }} />
        <SharedAxisTransition
          className='full-size row'
          id={auth}
          type={SharedAxisTransition.Type.fromRightToLeft}>
          {auth
            ? <Server.Authentication.Context.Provider value={auth}>
              {this.props.children}
            </Server.Authentication.Context.Provider>
            : <>
              <div style={{ flex: 3 }} >
                <Title />
              </div>
              <Card tag='form' style={{ width: '360px', minWidth: 0, padding: '24px', paddingTop: '8px' }}>
                <Typography tag='h1' use='headline6'>{locale.signIn}</Typography>
                <div style={{ height: '16px' }} />
                <TextField outlined type='text' id='username' name='username'
                  label={locale.username} inputRef={this._usernameRef}
                  defaultValue={settings.sshUserName ?? undefined} />
                <div style={{ height: '16px' }} />
                <TextField outlined type='password' id='password' name='password'
                  label={locale.password} inputRef={this._passwordRef}
                  defaultValue={settings.sshPassword ?? undefined} />
                <div style={{ height: '48px' }} />
                <Checkbox label={locale.keepSignIn}
                  style={{ padding: 0, margin: 0 }}
                  checked={settings.keepSignIn}
                  onChange={() => settings.setKeepSignIn(!settings.keepSignIn)} />
                <div style={{ height: '16px' }} />
                <Button raised type='submit' autoFocus
                  label={locale.next} disabled={loading}
                  onClick={async event => {
                    event.preventDefault();
                    await this._submit();
                  }} />
                <div style={{ height: '8px' }} />
              </Card>
              <div style={{ flex: 1 }} />
            </>}
        </SharedAxisTransition>
      </>
    );
  }
}

namespace Content {
  export type Props = {
    readonly locale: LocaleContextType,
    readonly server: Server.Type,
    readonly settings: Settings.Type,
    readonly children: React.ReactNode,
  };
  export type State = {
    readonly auth?: Server.Authentication.Type,
    readonly loading: boolean,
  };
}

function Title() {
  return <div className='full-size column' style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Typography use='headline3' style={{ margin: '32px 0' }}>SSH TOOL FOR WEB</Typography>
    <Typography use='body1'>Feature with shell terminal and file explorer</Typography>
    <Typography use='body1'>Ease to deploy, ease to use</Typography>
  </div>;
}

class Auth implements Server.Authentication.Type {
  constructor(props: { server: Server.Type }) {
    this._ws = props.server.ws;
    this._host = props.server.host;
    this._ws.addEventListener('message', ({ data }) => {
      const { tag, response, event } = JSON.parse(data);
      if (tag !== undefined) {
        const callback = this._callbacks.get(tag);
        callback?.(response);
      } else if (event) {
        if ('shell' in event) this.shell.invoke(event.shell);
      }
    });
  }

  protected _ws: WebSocket;
  protected _host: string;
  protected _tag = 0;
  protected _callbacks = new Map<number, (response: any) => unknown>();

  get ws() { return this._ws }

  readonly shell = new (class extends EventTarget {
    invoke(props: Server.Authentication.ShellEventDetail & { id: string }) {
      const event: Server.Authentication.ShellEvent = new CustomEvent(props.id, { detail: props });
      this.dispatchEvent(event);
    }
  })();

  async rest<T extends Rest.Type>(type: T, parameter: Rest.Map.Parameter<T>): Promise<Rest.Map.Return<T> | Rest.Error> {
    return new Promise(resolve => {
      const tag = this._tag++;
      this._callbacks.set(tag, resolve);
      this._ws.send(JSON.stringify({ tag, request: { [type]: parameter } }));
    });
  }

  async upload(data: File | File[] | FormData): Promise<Express.Multer.File> {
    const token = await this.rest('token', []);
    if (Rest.isError(token)) throw token.error;
    const formData: FormData = (() => {
      if (data instanceof File) {
        const formData = new FormData();
        formData.append('file', data);
        return formData;
      } else if (data instanceof Array) {
        const formData = new FormData();
        for (const file of data)
          formData.append('file', file);
        return formData;
      } else if (data instanceof FormData) {
        return data;
      }
      throw new Error('upload data type error');
    })();
    const response = await fetch(`https://${this._host}/upload?t=${token}`,
      { method: 'POST', body: formData });
    return response.json();
  }

  async download(filePath: string): Promise<void> {
    const token = await this.rest('token', []);
    if (Rest.isError(token)) throw token.error;
    const element = document.createElement('a');
    element.setAttribute('href', `https://${this._host}/download?t=${token}&p=${encodeURIComponent(filePath)}`);
    element.setAttribute('download', path.basename(filePath));
    element.style.display = 'none';
    element.click();
  }

  signOut() { this.ws.close() }

}