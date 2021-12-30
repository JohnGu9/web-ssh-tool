import React from 'react';
import { CircularProgress } from 'rmwc';
import { ConnectConfig } from 'ssh2';
import delay from './common/Delay';
import { wsSafeClose } from './common/DomTools';
import { LocaleContext, LocaleContextType, LocaleService, Server, SettingsService, ThemeService } from './common/Providers';
import { SharedAxisTransition } from './components/Transitions';
import SignInPage from './pages/SignInPage';

function App() {
  return (
    <SettingsService>
      <LocaleService>
        <ThemeService>
          <LocaleContext.Consumer>
            {locale => <Service locale={locale}>
              <SignInPage />
            </Service>}
          </LocaleContext.Consumer>
        </ThemeService>
      </LocaleService>
    </SettingsService>
  );
}

export default App;

const isDebug = process.env.NODE_ENV !== 'production'; // do not export this variable

class AppServer implements Server.Type {
  constructor(props: { ws: WebSocket }) {
    this._ws = props.ws;
  }

  protected _ws: WebSocket;
  get ws() { return this._ws }

  async signIn(props: { username: string, password: string }): Promise<{ token: string; } | { error: Error; }> {
    const config: ConnectConfig = { ...props };
    return new Promise(resolve => {
      const ws = this._ws;
      ws.addEventListener('message',
        ({ data }) => resolve(JSON.parse(data)), { once: true });
      ws.send(JSON.stringify(config));
    });
  };
}

const { host, hostname } = document.location;

class Service extends React.Component<Service.Props, Service.State> {
  constructor(props: Service.Props) {
    super(props);
    this.state = {};
    this._debugFetch();
  }
  protected _ws!: WebSocket;
  protected _mounted = true;
  protected async _debugFetch() {
    if (isDebug) { await fetch(`https://${hostname}:7200/`, { mode: 'cors' }).catch(error => { }) }
  }

  protected readonly _onOpen = () => this.setState({ server: new AppServer({ ws: this._ws! }) })
  protected readonly _onError = () => { if (this._ws) wsSafeClose(this._ws) }
  protected readonly _onClose = async () => {
    if (this._ws) wsSafeClose(this._ws);
    if (!this._mounted) return;
    this.setState({ server: undefined });
    await delay(300);
    await this._debugFetch();
    if (!this._mounted) return;
    this._ws = new WebSocket(`wss://${host}/rest`);
    this._ws.addEventListener('error', this._onError, { once: true });
    this._ws.addEventListener('close', this._onClose);
    this._ws.addEventListener('open', this._onOpen);
  }

  override componentDidMount() {
    this._ws = new WebSocket(`wss://${host}/rest`);
    this._ws.addEventListener('error', this._onError, { once: true });
    this._ws.addEventListener('close', this._onClose);
    this._ws.addEventListener('open', this._onOpen);
  }

  override componentWillUnmount() {
    this._mounted = false;
    wsSafeClose(this._ws);
  }

  override render() {
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