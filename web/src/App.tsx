import React from 'react';
import { CircularProgress } from 'rmcw';
import delay from './common/Delay';
import { wsSafeClose } from './common/DomTools';
import { LocaleContext, LocaleContextType, LocaleService, Server, SettingsService, ThemeService } from './common/Providers';
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import SignInPage, { decodeMessage } from './pages/SignInPage';
import Scaffold from './components/Scaffold';
import { stringifyAndCompress } from './pages/workers/Compress';

function App() {
  return (
    <SettingsService>
      <LocaleService>
        <ThemeService>
          <Scaffold>
            <LocaleContext.Consumer>
              {locale => <Service locale={locale}>
                <SignInPage />
              </Service>}
            </LocaleContext.Consumer>
          </Scaffold>
        </ThemeService>
      </LocaleService>
    </SettingsService>
  );
}

export default App;

const { host } = document.location;

// const isDebug = process.env.NODE_ENV !== 'production'; // do not export this variable
// const _ = process.env.NODE_ENV !== 'production' ? fetch(`https://${hostname}:7200/`, { mode: 'cors' }).catch(error => { }) : {};
// @ts-ignore
// const wsUri = import.meta.env.DEV ? `wss://${hostname}:7200/rest` : `wss://${host}/rest`

const wsUri = `wss://${host}/rest`;

class AppServer implements Server.Type {
  static _id = 0;
  constructor(props: { ws: WebSocket }) {
    this.ws = props.ws;
    this.id = AppServer._id;
    AppServer._id++;
  }

  readonly id: number;
  readonly ws: WebSocket;

  async signIn(props: { username: string, password: string }): Promise<{ token: string; } | { error: Error; }> {
    const config = { ...props };
    return new Promise(async (resolve, reject) => {
      const ws = this.ws;
      ws.addEventListener('message',
        async ({ data }) => {
          let obj = await decodeMessage(data);
          if (obj === undefined) reject(obj);
          resolve(obj)
        }, { once: true });

      const arr = await stringifyAndCompress(config);
      ws.send(arr);
    });
  };
}


class Service extends React.Component<Service.Props, Service.State> {
  constructor(props: Service.Props) {
    super(props);
    this.state = {};
  }
  protected _ws!: WebSocket;
  protected _mounted = true;
  protected _connectionMayBeLost = false;

  protected _connect() {
    this._ws = new WebSocket(wsUri);
    this._ws.addEventListener('error', this._onError, { once: true });
    this._ws.addEventListener('close', this._onClose);
    this._ws.addEventListener('open', this._onOpen);
  }

  protected readonly _onOpen = () => {
    this._connectionMayBeLost = false;
    this.setState({ server: new AppServer({ ws: this._ws! }) });
  }
  protected readonly _onError = () => {
    if (this._ws) wsSafeClose(this._ws)
  }
  protected readonly _onClose = async () => {
    if (this._ws) wsSafeClose(this._ws);
    if (!this._mounted) return;
    this.setState({ server: undefined });

    if (this._connectionMayBeLost) {
      await delay(2000);
      if (!this._mounted) return;
    }
    this._connectionMayBeLost = true;
    this._connect();
  }

  override componentDidMount() {
    this._connect();
  }

  override componentWillUnmount() {
    this._mounted = false;
    wsSafeClose(this._ws);
  }

  override render() {
    const { server } = this.state;
    const { children, locale: { meta } } = this.props;
    return (
      <SharedAxis
        className='full-size'
        transform={SharedAxisTransform.fromTopToBottom}
        keyId={server?.id}>
        {server
          ? <Server.Context.Provider value={server}>
            {children}
          </Server.Context.Provider>
          : <div className='row full-size' style={{ justifyContent: 'center' }}>
            <CircularProgress />
            <div style={{ minWidth: 16 }} />
            {meta.connecting} .....
          </div>}
      </SharedAxis>
    );
  }
}

namespace Service {
  export type Props = { readonly children: React.ReactNode, readonly locale: LocaleContextType, };
  export type State = { readonly server?: Server.Type };
}
