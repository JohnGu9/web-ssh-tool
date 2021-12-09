import 'xterm/css/xterm.css';
import './Layout.css'

import React from "react";
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import LayoutBuilder from "./LayoutBuilder";

function XTerminal({ style, className, terminal }: {
  style?: React.CSSProperties,
  className?: string,
  terminal: Terminal,
}) {
  return <Content
    style={style}
    className={className}
    terminal={terminal} />;
}

export default XTerminal;

class Content extends React.Component<Content.Props> {
  constructor(props: Content.Props) {
    super(props);
    this._ref = React.createRef();
    this._fit = new FitAddon();
  }

  readonly _ref: React.RefObject<HTMLDivElement>;
  _fit: FitAddon;
  protected _timer!: number;

  componentDidMount() {
    this._timer = window.setInterval(() => this._fit.fit(), 10);
    const current = this._ref.current!;
    this.props.terminal.loadAddon(this._fit);
    this.props.terminal.open(current);
    this.props.terminal.focus();
  }

  componentDidUpdate(oldProps: Content.Props) {
    if (oldProps.terminal !== this.props.terminal) {
      this._fit.dispose();
      this._fit = new FitAddon();
      const current = this._ref.current!;
      this.props.terminal.loadAddon(this._fit);
      this.props.terminal.open(current);
      this.props.terminal.focus();
    }
  }

  componentWillUnmount() {
    window.clearInterval(this._timer);
    this._fit.dispose();
  }

  render() {
    const { style, className } = this.props;
    return <LayoutBuilder
      style={style}
      className={className}
      builder={() => {
        return <div
          key={this.props.terminal as any}
          ref={this._ref}
          className='full-size' />;
      }} />;
  }
}

namespace Content {
  export type Props = {
    readonly style?: React.CSSProperties,
    readonly className?: string,
    readonly terminal: Terminal,
  };
}
