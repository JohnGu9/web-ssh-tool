import React from "react";
import { Terminal } from "xterm";
import { v1 as uuid } from 'uuid';
import { Server, ThemeContext } from "../../common/Providers";
import { Rest } from '../../common/Type';
import XTerminal from "../../components/XTerminal";
import FadeCrossTransition from "../../components/FadeCrossTransition";
import { Icon } from "@rmwc/icon";
import { IconButton } from "@rmwc/icon-button";
import { Theme } from "@rmwc/theme";
import { Card } from "@rmwc/card";
import { Button } from "@rmwc/button";
import { SharedAxisTransition } from "../../components/Transitions";
import { SimpleListItem } from "@rmwc/list";
import AnimatedList from "../../components/AnimatedList";
import { Typography } from "@rmwc/typography";

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
            addController={() => this.add()}
            current={controller}
            setCurrent={controller => this.setState({ controller })}
            remove={value => this.removeOf(value)} />
        </div>
        <SharedAxisTransition
          id={controller?.id} type={SharedAxisTransition.Type.fromRightToLeft}
          style={{ flex: 3, height: '100%', padding: '0 8px' }}>
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

function XTerminalNavigator({ controllers, addController, current, setCurrent, remove }: {
  controllers: MultiTerminalView.Controller[],
  addController: () => unknown,
  current: MultiTerminalView.Controller | undefined,
  setCurrent: (controller: MultiTerminalView.Controller) => unknown,
  remove: (controller: MultiTerminalView.Controller) => unknown,
}) {
  const { themeData: theme } = React.useContext(ThemeContext);
  return (
    <Theme use='onPrimary' tag='div'
      className='full-size column'
      style={{ alignItems: 'center', background: theme.primary }}>
      <div className='expanded' style={{ overflowY: 'auto', width: '100%' }}>
        <div style={{ height: 8 }} />
        <Typography use='headline6' style={{ margin: 4 }}>Terminal List</Typography>
        <div style={{ height: 8 }} />
        <AnimatedList>
          {controllers.map(value => {
            return {
              listId: value.id,
              children:
                <AnimatedList.Wrap>
                  <div style={{ padding: 4, width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
      <div style={{ padding: 4, width: '100%' }}>
        <Theme use='onSurface' wrap>
          <Card >
            <SimpleListItem
              graphic='add'
              text='NEW TERMINAL'
              onClick={addController} />
          </Card>
        </Theme>
      </div>
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
        <SimpleListItem disabled
          style={{ paddingLeft: 0, paddingRight: 0 }}
          text={controller.id} />
        <Card style={{ flex: 1, width: '100%', overflow: 'auto' }}>
          <XTerminal terminal={controller.xterm} className='full-size' />
        </Card>
        <div style={{ height: 8 }} />
      </div>}
  </FadeCrossTransition>;
}
