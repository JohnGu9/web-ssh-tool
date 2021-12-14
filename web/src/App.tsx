import { CircularProgress } from '@rmwc/circular-progress';
import React from 'react';
import { ConnectConfig } from 'ssh2';
import delay from './common/Delay';
import { wsSafeClose } from './common/DomTools';
import { LocaleContext, LocaleContextType, LocaleService, Server, SettingsService, ThemeService } from './common/Providers';
import { SharedAxisTransition } from './components/Transitions';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';

function App() {
  return (
    <SettingsService>
      <LocaleService>
        <ThemeService>
          <LocaleContext.Consumer>
            {locale => <Service locale={locale}>
              <SignInPage >
                <HomePage />
              </SignInPage>
            </Service>}
          </LocaleContext.Consumer>
        </ThemeService>
      </LocaleService>
    </SettingsService>
  );
}

export default App;

const isDebug = process.env.NODE_ENV !== 'production'; // do not export this variable
const { host, hostname } = document.location;
const remoteHost = isDebug ? `${hostname}:7200` : host;

class AppServer implements Server.Type {
  constructor(props: { ws: WebSocket }) {
    this._ws = props.ws;
  }

  protected _ws: WebSocket;
  get ws() { return this._ws }
  readonly host = remoteHost;

  async signIn(props: { username: string, password: string }): Promise<{ token: string; } | { error: Error; }> {
    const config: ConnectConfig = { ...props };
    return new Promise(resolve => {
      const ws = this._ws;
      const onMessage = ({ data }: MessageEvent) => resolve(JSON.parse(data));
      ws.addEventListener('message', onMessage, { once: true });
      ws.send(JSON.stringify(config));
    });
  };
}

class Service extends React.Component<Service.Props, Service.State> {
  constructor(props: Service.Props) {
    super(props);
    this.state = {};
    this._debugFetch();
  }
  ws!: WebSocket;

  protected _mounted = true;
  protected async _debugFetch() {
    if (isDebug) { await fetch(`https://${remoteHost}/`, { mode: 'cors' }).catch(error => { }) }
  }

  protected readonly _onOpen = () => this.setState({ server: new AppServer({ ws: this.ws! }) })
  protected readonly _onError = () => { if (this.ws) wsSafeClose(this.ws) }
  protected readonly _onClose = async () => {
    if (this.ws) wsSafeClose(this.ws);
    if (!this._mounted) return;
    this.setState({ server: undefined });
    await delay(300);
    await this._debugFetch();
    if (!this._mounted) return;
    this.ws = new WebSocket(`wss://${remoteHost}/rest`);
    this.ws.addEventListener('error', this._onError, { once: true });
    this.ws.addEventListener('close', this._onClose);
    this.ws.addEventListener('open', this._onOpen);
  }

  componentDidMount() {
    this.ws = new WebSocket(`wss://${remoteHost}/rest`);
    this.ws.addEventListener('error', this._onError, { once: true });
    this.ws.addEventListener('close', this._onClose);
    this.ws.addEventListener('open', this._onOpen);
  }

  componentWillUnmount() {
    this._mounted = false;
    wsSafeClose(this.ws);
  }

  render() {
    const { server } = this.state;
    const { children, locale: { locale } } = this.props;
    return (
      <SharedAxisTransition
        className='full-size'
        type={SharedAxisTransition.Type.fromTopToBottom}
        id={server}>
        {server
          ? <Server.Context.Provider value={server}>
            {children}
          </Server.Context.Provider>
          : <div className='row full-size' style={{ justifyContent: 'center' }}>
            <CircularProgress />
            <div style={{ minWidth: 16 }} />
            {locale.connecting} .....
          </div>}
      </SharedAxisTransition>
    );
  }
}

namespace Service {
  export type Props = { readonly children: React.ReactNode, readonly locale: LocaleContextType, };
  export type State = { readonly server?: Server.Type };
}