import '../components/Layout.css';
import React from "react";
import { Card, TextField, Checkbox, Typography, LinearProgress, Button, FormField } from 'rmcw';
import lazy from 'react-lazy-with-preload';

import { SharedAxisTransition } from '../components/Transitions';
import { LocaleContext, LocaleContextType, Server, Settings } from '../common/Providers';
import { Rest } from '../common/Type';
import { wsSafeClose } from '../common/DomTools';
import Scaffold from '../components/Scaffold';

const HomePage = lazy(() => import('./HomePage'));
HomePage.preload();

const { host } = document.location;

function SignInPage() {
  const settings = React.useContext(Settings.Context);
  const locale = React.useContext(LocaleContext);
  const server = React.useContext(Server.Context);
  const snackbar = React.useContext(Scaffold.Snackbar.Context);
  return <Content server={server} settings={settings} locale={locale} snackbar={snackbar}><HomePage /></Content>;
}

export default SignInPage;

class Content extends React.Component<Content.Props, Content.State> {
  constructor(props: Content.Props) {
    super(props);
    const { settings } = this.props;
    this.state = { loading: false, username: settings.sshUserName ?? "", password: settings.sshPassword ?? "" };
  }

  async _submit() {
    if (this.state.auth) return; // already sign in
    const { server, settings } = this.props;
    this.setState({ loading: true });
    const { password, username } = this.state;
    const result = await server.signIn({ username, password });
    if (Rest.isError(result)) {
      this.setState({ loading: false });
      this.props.snackbar.clearAll();
      this.props.snackbar.showMessage({ content: `${result.error}` });
    } else {
      settings.setSshUserName(username);
      settings.setSshPassword(password);
      this.setState({ auth: new Auth({ server }), loading: false });
    }
  }

  override componentDidMount() {
    const { settings } = this.props;
    if (settings.keepSignIn) this._submit();
  }

  override render() {
    const { settings, locale: { locale } } = this.props;
    const { auth, loading } = this.state;
    return (
      <>
        <LinearProgress closed={!loading} style={{ position: 'absolute', top: 0 }} />
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
              <Card style={{ width: '360px', minWidth: 0, padding: '24px', paddingTop: '8px' }}
                actionButtons={<>
                  <Button buttonStyle='raised' type='submit' autoFocus
                    label={locale.next} disabled={loading} form="sign-in" />
                </>}>
                <form id="sign-in" onSubmit={event => {
                  event.preventDefault();
                  this._submit();
                }}>
                  <Typography.Headline5>{locale.signIn}</Typography.Headline5>
                  <div style={{ height: '16px' }} />
                  <TextField outlined type='text'
                    id='username' name='username'
                    style={{ width: '100%' }}
                    label={locale.username}
                    value={this.state.username}
                    onChange={(e) => this.setState({ username: e.target.value })}
                  />
                  <div style={{ height: '16px' }} />
                  <TextField outlined type='password'
                    id='password' name='password'
                    style={{ width: '100%' }}
                    label={locale.password}
                    value={this.state.password}
                    onChange={(e) => this.setState({ password: e.target.value })}
                  />
                  <div style={{ height: '16px' }} />
                  <FormField input={<Checkbox
                    checked={settings.keepSignIn}
                    onChange={() => settings.setKeepSignIn(!settings.keepSignIn)} />
                  }>{locale.keepSignIn}</FormField>
                  <div style={{ height: '48px' }} />
                </form>
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
    readonly snackbar: Scaffold.Snackbar.Type,
    readonly children: React.ReactNode,
  };
  export type State = {
    readonly auth?: Server.Authentication.Type,
    readonly loading: boolean,
    readonly username: string,
    readonly password: string,
  };
}

function Title() {
  return <div className='full-size column' style={{ justifyContent: 'center', alignItems: 'center' }}>
    <Typography.Headline3 style={{ margin: '32px 0' }}>SSH TOOL FOR WEB</Typography.Headline3>
    <Typography.Body1>On browser, nothing to install, everywhere, anytime</Typography.Body1>
    <Typography.Body1>Feature with shell terminal and file explorer</Typography.Body1>
    <Typography.Body1>Ease to deploy, ease to use</Typography.Body1>
  </div>;
}

class Auth implements Server.Authentication.Type {
  constructor(props: { server: Server.Type }) {
    this._ws = props.server.ws;
    this._ws.addEventListener('message', ({ data }) => {
      // console.log(data);
      const { tag, response, event } = JSON.parse(data);
      if (tag !== undefined) {
        const callback = this._callbacks.get(tag);
        this._callbacks.delete(tag);
        callback?.(response);
      } else if (event !== undefined) {
        if ('shell' in event) this.shell.invoke(event.shell);
        else if ('watch' in event) this.watch.invoke(event.watch);
      }
    });
  }

  protected _ws: WebSocket;
  protected _tag = 0;
  protected _callbacks = new Map<number, (response: any) => unknown>();

  get ws() { return this._ws }

  readonly shell = new (class extends EventTarget {
    invoke({ id, ...props }: Server.Authentication.ShellEventDetail & { id: string }) {
      const event = new CustomEvent(id, { detail: props });
      this.dispatchEvent(event);
    }
  })();

  readonly watch = new (class extends EventTarget {
    invoke({ id, ...props }: Server.Authentication.WatchEventDetail & { id: string }) {
      const event = new CustomEvent(id, { detail: props });
      this.dispatchEvent(event);
    }
  })();

  async rest<T extends keyof Rest.Map>(type: T, parameter: Rest.Map.Parameter<T>): Promise<Rest.Map.Return<T> | Rest.Error> {
    return new Promise(resolve => {
      const tag = this._tag++;
      // console.log(`rest ${tag} ${type} ${JSON.stringify(parameter)}`);
      this._callbacks.set(tag, resolve);
      this._ws.send(JSON.stringify({ tag, request: { [type]: parameter } }));
    });
  }

  async upload(data: File, dest: Rest.PathLike, filename: string | null, init?: {
    signal?: AbortSignal | null
    onUploadProgress?: (progress: ProgressEvent) => unknown,
    onDownloadProgress?: (progress: ProgressEvent) => unknown,
  }): Promise<Express.Multer.File> {
    const token = await this.rest('token', []);
    if (Rest.isError(token)) throw token.error;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (init) {
        const { onUploadProgress, onDownloadProgress, signal } = init;
        if (onUploadProgress) xhr.upload.addEventListener('progress', onUploadProgress);
        if (onDownloadProgress) xhr.addEventListener('progress', onDownloadProgress);
        if (signal) signal.addEventListener('abort', () => xhr.abort());
      }
      const listenerOptions: AddEventListenerOptions = { once: true };
      xhr.addEventListener('abort', event => reject(new CustomEvent('AbortError', { detail: event })), listenerOptions);
      xhr.addEventListener('error', event => reject(new CustomEvent('UnknownError', { detail: event })), listenerOptions);
      xhr.addEventListener('timeout', event => reject(new CustomEvent('TimeoutError', { detail: event })), listenerOptions);
      xhr.onload = event => {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          reject(error);
        }
      }
      xhr.open('POST', `https://${host}/upload?t=${token}${dest.map(value => `&u=${encodeURIComponent(value)}`).join('')}${filename === null ? '' : `&n=${encodeURIComponent(filename)}`}`, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('Content-Disposition', `attachment"${filename === null ? '' : `; filename=${encodeURI(filename)}`}"`);
      xhr.send(data);
    });
  }

  async download(filePath: string | string[]): Promise<void> {
    const token = await this.rest('token', []);
    if (Rest.isError(token)) throw token.error;
    const element = document.createElement('a');
    if (typeof filePath === 'string') {
      element.setAttribute('href', `https://${host}/download?t=${token}&p=${encodeURIComponent(filePath)}`);
      element.setAttribute('download', "");
    } else {
      if (filePath.length === 0) return;
      element.setAttribute('href', `https://${host}/download?t=${token}${filePath.map(value => `&p=${encodeURIComponent(value)}`).join('')}`);
      element.setAttribute('download', 'bundle.zip');
    }
    element.click();
  }

  async preview(path: string) {
    const token = await this.rest('token', []);
    if (Rest.isError(token)) throw token.error;
    window.open(`https://${host}/preview?t=${token}&v=${encodeURIComponent(path)}`);
  }

  signOut() { wsSafeClose(this.ws) }

}
