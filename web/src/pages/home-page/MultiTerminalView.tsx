import React from "react";
import { Terminal } from "xterm";
import { Icon, IconButton, Card, Button, Dialog, Typography, TabBar, Tab, Tooltip, Menu, ListItem, ListDivider, Radio, TextArea } from 'rmcw';

import { Server, Settings, ThemeContext } from "../../common/Providers";
import { DECODE_OPTION, Layout, Rest } from '../../common/Type';
import XTerminal from "../../components/XTerminal";
import { SharedAxis, SharedAxisTransform, FadeThrough } from 'material-design-transform';
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';
import { makeId } from "../../common/Tools";
import HomePage from "../HomePage";

class MultiTerminalView extends React.Component<MultiTerminalView.Props, MultiTerminalView.State> {
  constructor(props: MultiTerminalView.Props) {
    super(props);
    this._controllers = [new MultiTerminalView.Controller({ auth: props.auth, id: makeId(4), textDecoder: this._textDecoder })];
    this.state = {
      controller: this._controllers[0],
      controllers: this._controllers
    };
  }
  protected _controllers: Array<MultiTerminalView.Controller>;
  protected _textDecoder = () => this.props.textDecoder;

  makeUniqueId(length: number) {
    for (let i = 0; i < 5; i++) {
      const id = makeId(length);
      const same = this._controllers.find(v => v.id === id);
      if (same === undefined) return id;
    }
  }

  add() {
    const id = this.makeUniqueId(4);
    if (id === undefined) return;
    const newClient = new MultiTerminalView.Controller({ auth: this.props.auth, id, textDecoder: this._textDecoder });
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
      <div className="column full-size">
        <div className="row" style={{ padding: '0 24px' }}>
          <MoreButton />
          <Tooltip label="new terminal">
            <IconButton onClick={() => this.add()}><Icon>add</Icon></IconButton>
          </Tooltip>
          <TabBar
            className='expanded'
            selected={controller === undefined ? undefined : controllers.indexOf(controller)}
            onSelected={i => this.setState({ controller: controllers[i] })}>
            {controllers.map((value, index) => {
              return <Tab key={index} label="Terminal" />;
            })}
          </TabBar>
        </div>
        <SharedAxis
          keyId={controller?.id} transform={SharedAxisTransform.fromRightToLeft}
          className='expanded'
          style={{ padding: '0 24px', overflow: 'hidden' }}>
          {controller
            ? <XTerminalView
              controller={controller}
              remove={value => this.removeOf(value)} />
            : <div className='full-size row flex-center'>
              No shell yet
            </div>}
        </SharedAxis>
      </div>
    );
  }
}

namespace MultiTerminalView {
  export type Props = {
    auth: Server.Authentication.Type,
    textDecoder: string,
  };
  export type State = {
    controller?: MultiTerminalView.Controller,
    controllers: MultiTerminalView.Controller[],
  }
  export class Controller extends EventTarget {
    constructor({ auth, id, textDecoder }: { auth: Server.Authentication.Type, id: string, textDecoder: () => string }) {
      super();
      this.textDecoder = textDecoder;
      this.id = id;
      this.auth = auth;
      this.xterm.onData(data => {
        const encode = iconv.encode(data, this.textDecoder());
        this.auth.rest('shell', { id: this.id, data: Array.from(encode) });
      });
      this.auth.shell.addEventListener(this.id, this._listener);
      this.onClose.addEventListener('close', () => {
        this.auth.shell.removeEventListener(this.id, this._listener);
        this.closed = true;
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        textDecoder = function () { } as () => string;
      }, { once: true });
      this.open();
    }
    readonly auth: Server.Authentication.Type;
    readonly id: string;
    readonly xterm = new Terminal({ allowTransparency: true });
    readonly onClose = new (class extends EventTarget {
      invoke() { this.dispatchEvent(new Event('close')) }
    })();
    textDecoder: () => string;

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
      if ('close' in detail) {
        this.onClose.invoke();
      } else if ('data' in detail) {
        const data = Buffer.from(detail.data as number[]);
        const text = iconv.decode(data, this.textDecoder());
        this.xterm.write(text);
      }
    }

    protected async open() {
      const result = await this.auth.rest('shell', this.id);
      this.onClose.addEventListener('close', () => {
        console.log(`terminal(${this.id}) closed`);
      }, { once: true });
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
  const [openTextDecode, setOpenTextDecode] = React.useState(false);
  const close = () => setOpenDialog(false);
  const closeTextDecode = () => setOpenTextDecode(false);
  React.useEffect(() => {
    if (open) {
      const i = () => { setOpen(false) };
      window.addEventListener("click", i, { passive: true });
      return () => window.removeEventListener("click", i);
    }
  }, [open]);
  const { layout, setLayout } = React.useContext(HomePage.Context);

  const license = `${document.location.href}LICENSE`;
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
        {layout === Layout.both ?
          <ListItem
            graphic={<Icon>fullscreen</Icon>}
            primaryText="Hide File Explorer"
            onClick={() => setLayout(Layout.terminal)} /> :
          <ListItem
            graphic={<Icon>fullscreen_exit</Icon>}
            primaryText="Show File Explorer"
            onClick={() => setLayout(Layout.both)} />}
        <ListItem
          graphic={<Icon>tag</Icon>}
          primaryText="SSH Text Decode"
          onClick={() => setOpenTextDecode(true)} />
        <ListItem
          graphic={<Icon>terminal</Icon>}
          primaryText="System SSH Tool"
          meta={<span style={{ minWidth: 36 }}></span>}
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
            settings.setRememberPassword(false);
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
        <Typography.Subtitle1>Repository</Typography.Subtitle1>
        <Typography.Body1><a href="https://github.com/JohnGu9/web-ssh-tool" target="_blank" rel="noreferrer">https://github.com/JohnGu9/web-ssh-tool</a></Typography.Body1>
        <div style={{ height: 16 }} />
        <Typography.Subtitle1>License</Typography.Subtitle1>
        <Typography.Body1><a href={license} target="_blank" rel="noreferrer">{license}</a></Typography.Body1>
      </Dialog>
      <Dialog open={openTextDecode}
        onScrimClick={closeTextDecode}
        onEscapeKey={closeTextDecode}
        title="Text Decode"
        fullscreen
        actions={<Button onClick={closeTextDecode} label='close' />}>
        <ListItem primaryText='utf-8' meta={<Radio checked={settings.textDecode === 'utf-8' || settings.textDecode === null} />}
          onClick={() => settings.setTextDecode(null)} />
        {DECODE_OPTION.filter(v => v !== 'utf-8')
          .map((v) => {
            return <ListItem key={v} primaryText={v} meta={<Radio checked={settings.textDecode === v} />}
              onClick={() => settings.setTextDecode(v)} />;
          })}
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
  }, [controller]);
  if (controller.xterm)
    controller.xterm.options.theme = {
      background: theme.surface,
      foreground: theme.onSurface,
      cursor: theme.onSurface,
      cursorAccent: theme.secondary
    };
  return <FadeThrough keyId={closed ? 0 : 1} className='full-size'>
    {closed ?
      <div className='full-size column'>
        <div style={{ height: 8 }} />
        <Card
          className="column flex-center expanded"
          style={{
            width: '100%',
            overflow: 'auto',
            padding: 8
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
      </div> :
      <div className='full-size column'>
        <div style={{ height: 8 }} />
        <Card className="expanded" style={{ width: '100%', overflow: 'auto', padding: 8 }}
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
          <CommandButton runCommand={command => {
            controller.xterm.paste(command);
          }} />
          <div className='expanded' />
          <Typography.Button><SizeHint controller={controller} /></Typography.Button>
        </div>
        <div style={{ height: 16 }} />
      </div>}
  </FadeThrough>;
}

function SizeHint({ controller }: {
  controller: MultiTerminalView.Controller,
}) {
  const [size, setSize] = React.useState(controller.size);
  React.useEffect(() => {
    const listener = () => {
      setSize(controller.size);
    };
    controller.addEventListener("resize", listener, { passive: true });
    return () => controller.removeEventListener("resize", listener);
  }, [controller]);
  return (<>{size.rows} x {size.cols}</>);
}

function CommandButton({ runCommand }: { runCommand: (c: string) => unknown }) {
  const settings = React.useContext(Settings.Context);
  const [open, setOpen] = React.useState(false);
  const [openCustom, setOpenCustom] = React.useState(false);
  const [command, setCommand] = React.useState("");
  const [label, setLabel] = React.useState("");
  const close = () => setOpen(false);
  const closeCustom = () => setOpenCustom(false);

  const commandsRaw = settings.quickCommands;
  const commands = React.useMemo<Array<{ command: string, label: string | null }>>(() => {
    if (commandsRaw !== null) {
      try {
        const list = JSON.parse(commandsRaw);
        if (list instanceof Array) {
          return list.filter(v => typeof v.command === 'string');
        }
      } catch { /* empty */ }
    }
    return [];
  }, [commandsRaw]);
  return (<>
    <IconButton
      onClick={() => setOpen(true)}
    ><Icon>code</Icon></IconButton>
    <Dialog open={open && !openCustom}
      onScrimClick={close}
      onEscapeKey={close}
      fullscreen
      title="Quick Command"
      actions={<>
        <Button onClick={() => setOpenCustom(true)}>add custom command</Button>
        <div className="expanded" />
        <Button onClick={close}>close</Button>
      </>}>
      { }
      {commands.length === 0 ?
        <div className="column flex-center">No command</div> :
        commands.map(({ command, label }, index) =>
          <ListItem key={index}
            primaryText={command}
            secondaryText={label ?? undefined}
            meta={<IconButton onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              const newCommands = commands.filter((_, i) => i !== index)
              settings.setQuickCommands(JSON.stringify(newCommands));
            }}><Icon>close</Icon></IconButton>}
            onClick={e => {
              close();
              runCommand(command);
            }} />)}
    </Dialog>
    <Dialog open={openCustom}
      onScrimClick={closeCustom}
      onEscapeKey={closeCustom}
      title="Edit Custom Command"
      actions={<>
        <Button onClick={() => {
          const l = label.length === 0 ? null : label;
          const newCommands = [...commands, { command, label: l }];
          settings.setQuickCommands(JSON.stringify(newCommands));
          closeCustom();
        }}>add</Button>
        <Button onClick={closeCustom}>close</Button>
      </>}>
      <TextArea id="edit-custom-command"
        style={{ width: '100%', display: 'block' }}
        required
        label="Command"
        value={command}
        onChange={e => setCommand(e.target.value)} />
      <div style={{ minHeight: 16, minWidth: 320 }} />
      <TextArea id="edit-custom-command-label"
        style={{ width: '100%', display: 'block' }}
        label="Label (optional)"
        value={label}
        onChange={e => setLabel(e.target.value)} />
    </Dialog>
  </>);
}
