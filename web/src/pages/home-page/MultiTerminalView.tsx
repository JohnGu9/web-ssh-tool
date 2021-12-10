import React from "react";
import { Terminal } from "xterm";
import { v1 as uuid } from 'uuid';
import { Server, Settings, ThemeContext } from "../../common/Providers";
import { Rest } from '../../common/Type';
import XTerminal from "../../components/XTerminal";
import FadeCrossTransition from "../../components/FadeCrossTransition";
import { Icon } from "@rmwc/icon";
import { IconButton } from "@rmwc/icon-button";
import { Theme } from "@rmwc/theme";
import { Card } from "@rmwc/card";
import { Button } from "@rmwc/button";
import { SharedAxisTransition } from "../../components/Transitions";
import { ListDivider, SimpleListItem } from "@rmwc/list";
import AnimatedList from "../../components/AnimatedList";
import { Dialog, DialogActions, DialogButton, LinearProgress, Typography } from "rmwc";
import { DialogContent, DialogTitle } from "../../components/Dialog";
import { FixedSizeList } from "../../components/AdaptedWindow";

class MultiTerminalView extends React.Component<MultiTerminalView.Props, MultiTerminalView.State> {
  protected _controllers: Array<MultiTerminalView.Controller> = [new MultiTerminalView.Controller({ auth: this.props.auth })];
  constructor(props: any) {
    super(props);
    this.state = {
      controller: this._controllers[0],
      controllers: this._controllers
    };
  }

  add() {
    const newClient = new MultiTerminalView.Controller({ auth: this.props.auth });
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

  componentWillUnmount() {
    this._controllers.forEach(controller => controller.close());
  }

  render() {
    const { controllers, controller } = this.state;
    return (
      <>
        <div style={{ width: 240, height: '100%' }}>
          <XTerminalNavigator
            controllers={controllers}
            current={controller}
            setCurrent={controller => this.setState({ controller })}
            add={() => this.add()}
            remove={value => this.removeOf(value)} />
        </div>
        <SharedAxisTransition
          id={controller?.id} type={SharedAxisTransition.Type.fromRightToLeft}
          style={{ flex: 3, height: '100%', padding: '0 24px', overflow: 'hidden' }}>
          {controller
            ? <XTerminalView
              controller={controller}
              remove={value => this.removeOf(value)} />
            : <div className='full-size row' style={{ justifyContent: 'center' }}>
              No shell yet
            </div>}
        </SharedAxisTransition>
      </>
    );
  }
}

namespace MultiTerminalView {
  export type Props = { auth: Server.Authentication.Type };
  export type State = {
    controller?: MultiTerminalView.Controller,
    controllers: MultiTerminalView.Controller[],
  }
  export class Controller {
    constructor(props: { auth: Server.Authentication.Type }) {
      this.auth = props.auth;
      this.xterm.onData(data => this.auth.rest('shell', { id: this.id, data }));
      this.auth.shell.addEventListener(this.id, this._listener);
      this.onClose.addEventListener('close', () => {
        this.auth.shell.removeEventListener(this.id, this._listener);
        this.closed = true;
      }, { once: true });
      this.open();
    }
    readonly auth: Server.Authentication.Type;
    readonly id = uuid();
    readonly xterm = new Terminal({ rendererType: 'dom', allowTransparency: true });
    readonly onClose = new (class extends EventTarget {
      invoke() { this.dispatchEvent(new Event('close')) }
    })();

    close() { this.auth.rest('shell', { id: this.id, close: {} }); }
    closed = false;

    dispose() {
      if (this.closed === false) this.close();
      this.xterm.dispose();
    }

    protected readonly _listener = (event: Event) => {
      const { detail } = event as Server.Authentication.ShellEvent;
      if ('close' in detail) this.onClose.invoke();
      else if ('data' in detail) this.xterm.write(detail.data);
    }

    protected async open() {
      const result = await this.auth.rest('shell', this.id);
      if (Rest.isError(result)) {
        this.onClose.invoke();
      }
    }
  }
}

export default MultiTerminalView;

function XTerminalNavigator({ controllers, add, current, setCurrent, remove }: {
  controllers: MultiTerminalView.Controller[],
  current: MultiTerminalView.Controller | undefined,
  setCurrent: (controller: MultiTerminalView.Controller) => unknown,
  add: () => unknown,
  remove: (controller: MultiTerminalView.Controller) => unknown,
}) {
  const { themeData: theme } = React.useContext(ThemeContext);
  const auth = React.useContext(Server.Authentication.Context);
  const settings = React.useContext(Settings.Context);
  return (
    <Theme use='onPrimary' tag='div'
      className='full-size column'
      style={{ alignItems: 'center', background: theme.primary, padding: '0 0 8px' }}>
      <div className='row' style={{ height: 56, justifyContent: 'center', alignItems: 'center', padding: '0 8px' }}>
        <div className='expanded'><Icon icon='menu' /></div>
        <div className='expanded row' style={{ justifyContent: 'center' }}>SHELL</div>
        <div className='expanded'></div>
      </div>
      <div className='expanded' style={{ overflowY: 'auto', width: '100%' }}>
        <AnimatedList>
          {controllers.map(value => {
            return {
              listId: value.id,
              children:
                <AnimatedList.Wrap>
                  <div style={{ padding: '4px 8px', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <Theme use='onSurface' wrap>
                      <Card >
                        <SimpleListItem
                          activated={current === value}
                          graphic={<Icon icon='terminal' />}
                          secondaryText={value.id}
                          meta={<IconButton icon='close' onClick={event => {
                            event.stopPropagation();
                            remove(value);
                          }}></IconButton>}
                          onClick={() => setCurrent(value)}
                          style={{ paddingRight: 0, width: '100%' }} />
                      </Card>
                    </Theme>
                  </div>
                </AnimatedList.Wrap>
            };
          })}
        </AnimatedList>
      </div>
      <div style={{ height: 32 }} />
      <ListDivider />
      <div style={{ padding: '4px 8px', width: '100%' }}>
        <Theme use='onSurface' wrap>
          <Card >
            <SimpleListItem
              graphic='add'
              text='NEW TERMINAL'
              onClick={add} />
          </Card>
        </Theme>
      </div>
      <div style={{ padding: '4px 8px', width: '100%' }}>
        <Theme use='onSurface' wrap>
          <Card >
            <AboutButton />
          </Card>
        </Theme>
      </div>
      <div style={{ padding: '4px 8px', width: '100%' }}>
        <Theme use='onSurface' wrap>
          <Card >
            <SimpleListItem
              graphic='logout'
              text='SIGN OUT'
              onClick={() => {
                settings.setKeepSignIn(false);
                auth.signOut();
              }} />
          </Card>
        </Theme>
      </div>
      <div style={{ height: 4 }} />
    </Theme>
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
      background: 'rgba(0, 0, 0, 0)',
      foreground: theme.textPrimaryOnBackground,
      cursor: theme.textPrimaryOnBackground,
      cursorAccent: theme.secondary
    };
  return <FadeCrossTransition id={closed} className='full-size'>
    {closed
      ? <Card className='full-size column'
        style={{ justifyContent: 'center', alignItems: 'center' }}>
        Shell already closed
        <div style={{ height: 16 }} />
        <Button raised label='Close windows' onClick={() => remove(controller)} />
      </Card>
      : <div className='full-size column'>
        <div className='row' style={{ height: 56 }}>
          <Button raised label='clipboard'
            onClick={() => { }} />
          <div className='expanded' />
          <Button label='use system ssh tool' onClick={() => {
            const { hostname } = document.location;
            window.open(`ssh://${hostname}`);
          }} />
          <Button label='clear'
            onClick={() => controller.xterm.clear()} />
        </div>
        <div style={{ height: 8 }} />
        <Card style={{ flex: 1, width: '100%', overflow: 'auto' }}>
          <XTerminal terminal={controller.xterm} className='full-size' />
        </Card>
        <div style={{ height: 16 }} />
      </div>}
  </FadeCrossTransition>;
}


function AboutButton() {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false)
  return (
    <>
      <SimpleListItem
        graphic='info'
        text='ABOUT'
        onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={close}>
        <DialogTitle>ABOUT</DialogTitle>
        <DialogContent >
          <div className='column' style={{ width: 480, height: 480 }}>
            <div style={{ height: 16 }} />
            <Typography use='subtitle1'>Version</Typography>
            <div style={{ height: 8 }} />
            <Typography use='body1'>v0.1.0</Typography>
            <div style={{ height: 32 }} />
            <Typography use='subtitle1'>License</Typography>
            <div style={{ flex: 1 }}>
              <License />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <DialogButton onClick={close}>close</DialogButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

class License extends React.Component<{}, { value?: string[] }> {
  static _cache?: string[];
  constructor(props: {}) {
    super(props);
    this.state = { value: License._cache };
  }

  _mounted = true;

  componentDidMount() {
    if (this.state.value === undefined)
      fetch('/LICENSE')
        .then(response => response.text())
        .then(text => {
          License._cache = ['', ...text.split('\n'), ''];
          if (this._mounted) this.setState({ value: License._cache })
        });
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  render() {
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
