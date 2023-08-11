import React from "react";
import { Terminal } from "xterm";
import { Icon, IconButton, Card, Button, Dialog, LinearProgress, Typography, TabBar, Tab, Tooltip, Menu, ListItem, ListDivider, Radio } from 'rmcw';

import { Server, Settings, ThemeContext } from "../../common/Providers";
import { Rest } from '../../common/Type';
import XTerminal from "../../components/XTerminal";
import FadeCrossTransition from "../../components/FadeCrossTransition";
import { SharedAxisTransition } from "../../components/Transitions";
import { FixedSizeList } from "../../components/AdaptedWindow";

class MultiTerminalView extends React.Component<MultiTerminalView.Props, MultiTerminalView.State> {
  constructor(props: any) {
    super(props);
    this._controllers = [new MultiTerminalView.Controller({ auth: props.auth, id: MultiTerminalView.makeId(4) })];
    this.state = {
      controller: this._controllers[0],
      controllers: this._controllers
    };
  }
  protected _controllers: Array<MultiTerminalView.Controller>;

  static makeId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  makeUniqueId(length: number) {
    for (let i = 0; i < 5; i++) {
      const id = MultiTerminalView.makeId(length);
      const same = this._controllers.find(v => v.id === id);
      if (same === undefined) return id;
    }
  }

  add() {
    const id = this.makeUniqueId(4);
    if (id === undefined) return;
    const newClient = new MultiTerminalView.Controller({ auth: this.props.auth, id });
    this._controllers.push(newClient);
    this.setState({
      controllers: this._controllers,
      controller: newClient,
    });
  }

  removeOf(controller: MultiTerminalView.Controller) {
    const { controllers } = this.state;
    const index = controllers.indexOf(controller);
    if (index > -1) this.removeAt(index);
  }

  removeAt(index: number) {
    const controller = this._controllers[index];
    controller.dispose();
    this._controllers.splice(index, 1);
    this.setState({
      controllers: this._controllers,
      controller: this.state.controller?.id === controller.id ? this._controllers[0] : this.state.controller
    });
  }

  override componentWillUnmount() {
    this._controllers.forEach(controller => controller.dispose());
  }

  override render() {
    const { controllers, controller } = this.state;
    return (
      <div className="column" style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ padding: '0 24px' }}>
          <MoreButton />
          <Tooltip label="new terminal">
            <IconButton onClick={() => this.add()}><Icon>add</Icon></IconButton>
          </Tooltip>
          <TabBar
            style={{ flex: 1, minWidth: 0 }}
            selected={controller === undefined ? undefined : controllers.indexOf(controller)}
            onSelected={i => this.setState({ controller: controllers[i] })}>
            {controllers.map((value, index) => {
              return <Tab key={index} label="Terminal" />;
            })}
          </TabBar>
        </div>
        <SharedAxisTransition
          id={controller?.id} type={SharedAxisTransition.Type.fromRightToLeft}
          style={{ flex: 1, padding: '0 24px', overflow: 'hidden' }}>
          {controller
            ? <XTerminalView
              controller={controller}
              remove={value => this.removeOf(value)} />
            : <div className='full-size row' style={{ justifyContent: 'center' }}>
              No shell yet
            </div>}
        </SharedAxisTransition>
      </div>
    );
  }
}

namespace MultiTerminalView {
  export type Props = { auth: Server.Authentication.Type };
  export type State = {
    controller?: MultiTerminalView.Controller,
    controllers: MultiTerminalView.Controller[],
  }
  export class Controller extends EventTarget {
    constructor({ auth, id }: { auth: Server.Authentication.Type, id: string }) {
      super();
      this.id = id;
      this.auth = auth;
      this.xterm.onData(data => this.auth.rest('shell', { id: this.id, data }));
      this.auth.shell.addEventListener(this.id, this._listener);
      this.onClose.addEventListener('close', () => {
        this.auth.shell.removeEventListener(this.id, this._listener);
        this.closed = true;
      }, { once: true });
      this.open();
    }
    readonly auth: Server.Authentication.Type;
    readonly id: string;
    readonly xterm = new Terminal({ allowTransparency: true });
    readonly onClose = new (class extends EventTarget {
      invoke() { this.dispatchEvent(new Event('close')) }
    })();

    title = "Terminal";
    protected _titleListener = this.xterm.onTitleChange((title) => {
      this.title = title;
      this.dispatchEvent(new CustomEvent("title-change"))
    });

    protected _size = { rows: 80, cols: 80, height: 240, width: 240 };
    get size() { return this._size; }

    resize(resize: { rows: number, cols: number, height: number, width: number }) {
      this._size = resize;
      this.dispatchEvent(new CustomEvent("resize"))
      return this.auth.rest('shell', { id: this.id, resize });
    }

    close() {
      return this.auth.rest('shell', { id: this.id, close: {} });
    }
    closed = false;

    dispose() {
      if (this.closed === false) this.close();
      this._titleListener.dispose();
      this.xterm.dispose();
    }

    protected readonly _listener = (event: Event) => {
      const { detail } = event as CustomEvent;
      if ('close' in detail) this.onClose.invoke();
      else if ('data' in detail) this.xterm.write(detail.data);
    }

    protected async open() {
      const result = await this.auth.rest('shell', this.id);
      if (Rest.isError(result)) this.onClose.invoke();
    }
  }
}

export default MultiTerminalView;

function MoreButton() {
  const auth = React.useContext(Server.Authentication.Context);
  const settings = React.useContext(Settings.Context);
  const darkMode = settings.darkMode;
  // const snackbar = React.useContext(Scaffold.Snackbar.Context);

  const [open, setOpen] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const close = () => setOpenDialog(false);
  React.useEffect(() => {
    if (open) {
      const i = () => { setOpen(false) };
      window.addEventListener("click", i);
      return () => window.removeEventListener("click", i);
    }
  }, [open]);
  return (
    <Menu open={open}
      surface={<div style={{ padding: "4px 0" }}>
        <ListItem nonInteractive
          graphic={<Icon>palette</Icon>}
          primaryText="Theme" />
        <ListItem
          graphic={<Icon>lightbulb</Icon>}
          primaryText="Auto"
          meta={<Radio checked={darkMode !== 'dark' && darkMode !== 'light'} />}
          onClick={() => settings.setDarkMode(null)}
        />
        <ListItem
          graphic={<Icon>light_mode</Icon>}
          primaryText="Light"
          meta={<Radio checked={darkMode === 'light'} />}
          onClick={() => settings.setDarkMode('light')}
        />
        <ListItem
          graphic={<Icon>dark_mode</Icon>}
          primaryText="Dark"
          meta={<Radio checked={darkMode === 'dark'} />}
          onClick={() => settings.setDarkMode('dark')}
        />
        <ListDivider />
        <ListItem
          graphic={<Icon>terminal</Icon>}
          primaryText="Use system ssh tool"
          onClick={() => {
            const { hostname } = document.location;
            window.open(`ssh://${hostname}`);
          }} />
        <ListItem
          graphic={<Icon>info</Icon>}
          primaryText="About"
          onClick={() => setOpenDialog(true)} />
        <ListItem
          graphic={<Icon>logout</Icon>}
          primaryText="Logout"
          onClick={() => {
            settings.setKeepSignIn(false);
            auth.signOut();
          }} />
      </div>}>
      <Tooltip label="more">
        <IconButton onClick={() => {
          requestAnimationFrame(() => setOpen(true));
        }}><Icon>expand_more</Icon></IconButton>
      </Tooltip>
      <Dialog open={openDialog}
        onScrimClick={close}
        onEscapeKey={close}
        title="ABOUT"
        fullscreen
        actions={<>
          {/* <Button label="test" onClick={() => snackbar.showMessage({ content: "Hello world", action: <Button label="close" /> })} /> */}
          <Button onClick={close} label='close' />
        </>}>
        <Typography.Subtitle1>Version</Typography.Subtitle1>
        <Typography.Body1>v0.1.0</Typography.Body1>
        <div style={{ height: 16 }} />
        <Typography.Subtitle1>License</Typography.Subtitle1>
        <div style={{ width: '100%', height: '400px' }}>
          <License />
        </div>
      </Dialog>
    </Menu>

  );
}

function XTerminalView({ controller, remove }: {
  controller: MultiTerminalView.Controller,
  remove: (controller: MultiTerminalView.Controller) => unknown,
}) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const [closed, setClosed] = React.useState(controller.closed);
  React.useEffect(() => {
    const control = controller;
    if (control.closed) return;
    const onClose = () => setClosed(true);
    control.onClose?.addEventListener('close', onClose);
    return () => { control.onClose?.removeEventListener('close', onClose); };
  });
  if (controller.xterm)
    controller.xterm.options.theme = {
      background: theme.surface,
      foreground: theme.onSurface,
      cursor: theme.onSurface,
      cursorAccent: theme.secondary
    };
  return <FadeCrossTransition id={closed} className='full-size'>
    {closed
      ? <div className='full-size column'>
        <div style={{ height: 8 }} />
        <Card
          style={{
            flex: 1, width: '100%', overflow: 'auto', padding: 8,
            justifyContent: 'center', alignItems: 'center'
          }}>
          Shell already closed
        </Card>
        <div className='row' style={{ height: 56 }}>
          <IconButton
            onClick={() => remove(controller)}
          ><Icon>close</Icon></IconButton>
          <div className='expanded' />
        </div>
        <div style={{ height: 16 }} />
      </div>
      : <div className='full-size column'>
        <div style={{ height: 8 }} />
        <Card style={{ flex: 1, width: '100%', overflow: 'auto', padding: 8 }}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            const data = event.dataTransfer.getData('text');
            controller.xterm.paste(data);
            controller.xterm.focus();
          }}>
          <XTerminal terminal={controller.xterm} className='full-size'
            onResize={resize => controller.resize(resize)} />
        </Card>
        <div className='row' style={{ height: 56 }}>
          <IconButton
            onClick={() => remove(controller)}
          ><Icon>close</Icon></IconButton>
          <IconButton
            onClick={() => controller.xterm.clear()}
          ><Icon>clear_all</Icon></IconButton>
          <div className='expanded' />
          <Typography.Button><SizeHint controller={controller} /></Typography.Button>
        </div>
        <div style={{ height: 16 }} />
      </div>}
  </FadeCrossTransition>;
}

function SizeHint({ controller }: {
  controller: MultiTerminalView.Controller,
}) {
  const [size, setSize] = React.useState(controller.size);
  React.useEffect(() => {
    const listener = () => {
      setSize(controller.size);
    };
    controller.addEventListener("resize", listener);
    return () => controller.removeEventListener("resize", listener);
  }, [controller]);
  return (<>{size.rows} x {size.cols}</>);
}

class License extends React.Component<{}, { value?: string[] }> {
  static _cache?: string[];
  constructor(props: {}) {
    super(props);
    this.state = { value: License._cache };
  }

  _mounted = true;

  override componentDidMount() {
    if (this.state.value === undefined)
      fetch('/LICENSE')
        .then(response => response.text())
        .then(text => {
          License._cache = ['', ...text.split('\n'), ''];
          if (this._mounted) this.setState({ value: License._cache })
        });
  }

  override componentWillUnmount() {
    this._mounted = false;
  }

  override render() {
    const { value } = this.state;
    return <FadeCrossTransition id={value === undefined} className='full-size'>
      {value === undefined
        ? <LinearProgress></LinearProgress>
        : <FixedSizeList
          itemCount={value.length}
          itemSize={16}
          className='full-size'>
          {({ index, style }) => {
            return <code style={{ ...style, padding: '0 1em', opacity: 0.5 }}>{value[index]}</code>;
          }}</FixedSizeList>}
    </FadeCrossTransition>;
  }
}
